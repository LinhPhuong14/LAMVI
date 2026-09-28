// Kiểm thử độc lập: adapter Supabase cho giám sát (D-52, D-53, D-54)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { createSupabaseRepo } from './repo.js'
import { createSupabaseAuth } from './auth.js'
import { createSupabaseStorage } from './storage.js'

// Client giả kiểu chainable: ghi lại lời gọi, lọc gte/lt/order/limit trên dữ liệu
function fakeClient(tables = {}, { error, rpcError } = {}) {
  const calls = []
  const client = {
    calls,
    rpc(name, args) {
      calls.push({ rpc: name, args })
      return Promise.resolve(rpcError ? { data: null, error: rpcError } : { data: null, error: null })
    },
    from(table) {
      const ops = []
      calls.push({ table, ops })
      let rows = [...(tables[table] ?? [])]
      const result = () => (error ? { data: null, error } : { data: rows, error: null })
      const b = {
        select: (...a) => (ops.push(['select', ...a]), b),
        insert: (v) => (ops.push(['insert', v]), b),
        upsert: (v) => (ops.push(['upsert', v]), (rows = [v]), b),
        delete: () => (ops.push(['delete']), b),
        eq: (c, v) => (ops.push(['eq', c, v]), (rows = rows.filter((r) => r[c] === v)), b),
        gte: (c, v) => (ops.push(['gte', c, v]), (rows = rows.filter((r) => new Date(r[c]) >= new Date(v))), b),
        lt: (c, v) => (ops.push(['lt', c, v]), b),
        limit: (n) => (ops.push(['limit', n]), (rows = rows.slice(0, n)), b),
        order: (c, o) => {
          ops.push(['order', c, o])
          rows = [...rows].sort((x, y) => String(x[c]).localeCompare(String(y[c])) * (o?.ascending === false ? -1 : 1))
          return b
        },
        maybeSingle: () => (ops.push(['maybeSingle']), Promise.resolve(error ? { data: null, error } : { data: rows[0] ?? null, error: null })),
        single: () => (ops.push(['single']), Promise.resolve(error ? { data: null, error } : { data: rows[0] ?? null, error: null })),
        then: (res, rej) => Promise.resolve(result()).then(res, rej),
      }
      return b
    },
  }
  return client
}

const row = (over) => ({ bucket: '2026-09-28T10:00:00+00:00', method: 'GET', route: '/api/x', status: 200, count: 1, total_ms: 5, max_ms: 5, le_50: 1, le_100: 0, le_250: 0, le_500: 0, le_1000: 0, le_2500: 0, gt_2500: 0, ...over })

describe('Supabase repo — số liệu API', () => {
  it('recordApiMetrics gọi rpc record_api_metrics với nguyên các dòng', async () => {
    const c = fakeClient()
    const rows = [row({ bucket: '2026-09-28T10:00:00.000Z' })]
    await createSupabaseRepo(c).recordApiMetrics(rows)
    expect(c.calls).toEqual([{ rpc: 'record_api_metrics', args: { rows } }])
  })

  it('recordApiMetrics: rpc lỗi → ném lỗi', async () => {
    const c = fakeClient({}, { rpcError: new Error('function missing') })
    await expect(createSupabaseRepo(c).recordApiMetrics([row()])).rejects.toThrow('function missing')
  })

  it('listApiMetrics lọc gte bucket, chuẩn hoá bucket về ISO UTC', async () => {
    const c = fakeClient({ api_metrics: [row(), row({ bucket: '2026-09-27T00:00:00+00:00', route: '/api/old' })] })
    const out = await createSupabaseRepo(c).listApiMetrics({ since: '2026-09-28T09:00:00.000Z' })
    expect(out).toHaveLength(1)
    expect(out[0].bucket).toBe('2026-09-28T10:00:00.000Z')
    expect(c.calls[0].ops).toContainEqual(['gte', 'bucket', '2026-09-28T09:00:00.000Z'])
  })

  it('listApiErrors: gte at, order desc, limit, at về ISO', async () => {
    const errs = [
      { id: 1, at: '2026-09-28T09:00:00+00:00', method: 'GET', route: '/a', path: '/a', status: 500 },
      { id: 2, at: '2026-09-28T10:00:00+00:00', method: 'GET', route: '/b', path: '/b', status: 500 },
    ]
    const c = fakeClient({ api_errors: errs })
    const out = await createSupabaseRepo(c).listApiErrors({ since: '2026-09-28T00:00:00Z', limit: 1 })
    expect(out).toEqual([expect.objectContaining({ id: 2, at: '2026-09-28T10:00:00.000Z' })])
    const ops = c.calls[0].ops
    expect(ops).toContainEqual(['order', 'at', { ascending: false }])
    expect(ops).toContainEqual(['limit', 1])
  })

  it('recordApiErrors: insert vào api_errors; mảng rỗng không gọi DB', async () => {
    const c = fakeClient()
    const repo = createSupabaseRepo(c)
    await repo.recordApiErrors([])
    expect(c.calls).toEqual([])
    const e = [{ at: '2026-09-28T10:00:00.000Z', method: 'GET', route: '/a', path: '/a', status: 500, code: null, message: null }]
    await repo.recordApiErrors(e)
    expect(c.calls[0]).toMatchObject({ table: 'api_errors', ops: [['insert', e]] })
  })

  it('deleteApiMetricsBefore xoá cả api_metrics (bucket) và api_errors (at)', async () => {
    const c = fakeClient()
    await createSupabaseRepo(c).deleteApiMetricsBefore('2026-08-29T00:00:00.000Z')
    expect(c.calls.map((x) => [x.table, x.ops])).toEqual([
      ['api_metrics', [['delete'], ['lt', 'bucket', '2026-08-29T00:00:00.000Z']]],
      ['api_errors', [['delete'], ['lt', 'at', '2026-08-29T00:00:00.000Z']]],
    ])
  })

  it('lỗi select/insert/delete được ném ra', async () => {
    const repo = createSupabaseRepo(fakeClient({}, { error: new Error('boom') }))
    await expect(repo.listApiMetrics({ since: 'x' })).rejects.toThrow('boom')
    await expect(repo.listApiErrors({ since: 'x' })).rejects.toThrow('boom')
    await expect(repo.recordApiErrors([{}])).rejects.toThrow('boom')
    await expect(repo.deleteApiMetricsBefore('x')).rejects.toThrow('boom')
    await expect(repo.ping()).rejects.toThrow('boom')
    await expect(repo.getSetting('maintenance')).rejects.toThrow('boom')
    await expect(repo.setSetting('maintenance', { enabled: true }, 'u')).rejects.toThrow('boom')
  })

  it('ping đọc products limit 1', async () => {
    const c = fakeClient({ products: [{ id: 'p1' }] })
    expect(await createSupabaseRepo(c).ping()).toBe(true)
    expect(c.calls[0]).toMatchObject({ table: 'products', ops: [['select', 'id'], ['limit', 1]] })
  })
})

describe('Supabase repo — app_settings (D-54)', () => {
  it('getSetting map snake_case → camelCase; không có → null', async () => {
    const c = fakeClient({ app_settings: [{ key: 'maintenance', value: { enabled: true }, updated_by: 'u1', updated_at: 't' }] })
    const repo = createSupabaseRepo(c)
    expect(await repo.getSetting('maintenance')).toEqual({ key: 'maintenance', value: { enabled: true }, updatedBy: 'u1', updatedAt: 't' })
    expect(await repo.getSetting('khac')).toBeNull()
  })

  it('setSetting upsert key/value/updated_by/updated_at', async () => {
    const c = fakeClient()
    const s = await createSupabaseRepo(c).setSetting('maintenance', { enabled: false }, null)
    const [, up] = c.calls[0].ops[0]
    expect(c.calls[0].table).toBe('app_settings')
    expect(up).toMatchObject({ key: 'maintenance', value: { enabled: false }, updated_by: null })
    expect(Number.isNaN(Date.parse(up.updated_at))).toBe(false)
    expect(s).toMatchObject({ key: 'maintenance', value: { enabled: false }, updatedBy: null })
  })
})

describe('Supabase auth/storage — ping', () => {
  it('auth.ping gọi admin.listUsers; lỗi → ném', async () => {
    const calls = []
    const admin = (error) => ({ auth: { admin: { listUsers: async (a) => (calls.push(a), { data: {}, error }) } } })
    await createSupabaseAuth({ admin: admin(null), makePublicClient: () => ({}) }).ping()
    expect(calls[0]).toEqual({ page: 1, perPage: 1 })
    await expect(createSupabaseAuth({ admin: admin(new Error('401')), makePublicClient: () => ({}) }).ping()).rejects.toThrow('401')
  })

  it('storage.ping gọi getBucket(batch-videos); lỗi → ném', async () => {
    const got = []
    const admin = (error) => ({ storage: { getBucket: async (b) => (got.push(b), { data: {}, error }), from: () => ({}) } })
    await createSupabaseStorage(admin(null)).ping()
    expect(got).toEqual(['batch-videos'])
    await expect(createSupabaseStorage(admin(new Error('not found'))).ping()).rejects.toThrow('not found')
  })
})

describe('Migration 20260928000003_it.sql', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260928000003_it.sql', import.meta.url), 'utf8')
  const norm = sql.replace(/\s+/g, ' ')

  it("role check có 'it' (và vẫn customer/admin)", () => {
    expect(norm).toMatch(/profiles_role_check check \(role in \('customer', 'admin', 'it'\)\)/)
  })

  it('api_metrics có PK (bucket, method, route, status) và đủ cột histogram', () => {
    expect(norm).toMatch(/create table public\.api_metrics \(.*primary key \(bucket, method, route, status\)/)
    for (const c of ['le_50', 'le_100', 'le_250', 'le_500', 'le_1000', 'le_2500', 'gt_2500', 'total_ms', 'max_ms', 'count']) {
      expect(norm, c).toMatch(new RegExp(`${c} (integer|double precision) not null default 0`))
    }
  })

  it('record_api_metrics cộng dồn khi trùng khoá (on conflict do update, max bằng greatest)', () => {
    expect(norm).toMatch(/function public\.record_api_metrics\(rows jsonb\)/)
    expect(norm).toMatch(/on conflict \(bucket, method, route, status\) do update set/)
    for (const c of ['count', 'total_ms', 'le_50', 'le_100', 'le_250', 'le_500', 'le_1000', 'le_2500', 'gt_2500']) {
      expect(norm, c).toContain(`${c} = m.${c} + excluded.${c}`)
    }
    expect(norm).toContain('max_ms = greatest(m.max_ms, excluded.max_ms)')
  })

  it('RLS bật cho api_metrics, api_errors, app_settings (không có policy công khai)', () => {
    for (const t of ['api_metrics', 'api_errors', 'app_settings']) {
      expect(norm).toContain(`alter table public.${t} enable row level security`)
    }
    expect(norm).not.toMatch(/create policy/i)
  })

  it('api_errors có index theo at; app_settings.updated_by tham chiếu auth.users', () => {
    expect(norm).toMatch(/create index \w+ on public\.api_errors \(at desc\)/)
    expect(norm).toMatch(/updated_by uuid references auth\.users \(id\) on delete set null/)
  })
})
