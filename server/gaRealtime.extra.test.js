import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { GaError, createGaRealtime } from './adapters/gaRealtime.js'
import { loadConfig } from './config.js'

// Kiểm thử độc lập bổ sung: báo cáo GA realtime (T-11) — dữ liệu thiếu/lạ, token, đồng thời, rò rỉ bí mật
const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const creds = { propertyId: '123456', clientEmail: 'sa@p.iam.gserviceaccount.com', privateKey }

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const row = (dim, v) => ({ dimensionValues: [{ value: dim }], metricValues: [{ value: String(v) }] })
const isToken = (u) => String(u).includes('oauth2')

// reports: map dimension name ('' = tổng) → body | fn
function google({ reports = {}, token = () => json({ access_token: 'tok', expires_in: 3600 }), api } = {}) {
  return vi.fn(async (url, init) => {
    if (isToken(url)) return token(init)
    if (api) {
      const r = api(url, init)
      if (r) return r
    }
    const dim = JSON.parse(init.body).dimensions?.[0]?.name ?? ''
    const r = reports[dim]
    return json(typeof r === 'function' ? r() : (r ?? {}))
  })
}

describe('GA realtime — dữ liệu thiếu / lạ', () => {
  it('GA trả {} cho mọi báo cáo → số 0, đủ 30 cột, danh sách rỗng', async () => {
    const snap = await createGaRealtime({ ...creds, fetchImpl: google() }).snapshot()
    expect(snap).toMatchObject({ configured: true, activeUsers: 0, pageViews: 0, pages: [], countries: [], devices: [] })
    expect(snap.perMinute).toHaveLength(30)
    expect(snap.perMinute.every((m) => m.users === 0)).toBe(true)
  })

  it('rows rỗng / dòng không có metricValues / dimensionValues → tên rỗng, giá trị 0, không ném', async () => {
    const reports = {
      '': { rows: [] },
      minutesAgo: { rows: [{}] },
      unifiedScreenName: { rows: [{}, { dimensionValues: [], metricValues: [] }] },
      country: { rows: [{ dimensionValues: [{}], metricValues: [{}] }] },
    }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(snap.activeUsers).toBe(0)
    expect(snap.pages).toEqual([
      { name: '', value: 0 },
      { name: '', value: 0 },
    ])
    expect(snap.countries).toEqual([{ name: '', value: 0 }])
  })

  it('giá trị không phải số → 0 (không NaN/null)', async () => {
    const reports = {
      '': { rows: [{ metricValues: [{ value: 'abc' }, { value: null }] }] },
      unifiedScreenName: { rows: [row('A', 'x'), row('B', '')] },
      minutesAgo: { rows: [row('abc', 5), row('3', 'NaN')] },
    }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(snap.activeUsers).toBe(0)
    expect(snap.pageViews).toBe(0)
    expect(snap.pages.every((p) => p.value === 0)).toBe(true)
    expect(snap.perMinute.reduce((a, m) => a + m.users, 0)).toBe(0)
    expect(JSON.stringify(snap)).not.toMatch(/null|NaN/)
  })

  it('số lớn dạng chuỗi và giá trị Infinity không làm hỏng JSON', async () => {
    const reports = { '': { rows: [{ metricValues: [{ value: 'Infinity' }, { value: '1e3' }] }] } }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(Number.isFinite(snap.activeUsers)).toBe(true)
    expect(snap.pageViews).toBe(1000)
  })

  it('minutesAgo rỗng hoặc lẻ không được tính vào phút hiện tại / không ném', async () => {
    const reports = { minutesAgo: { rows: [row('', 9), row('1.5', 4), row('-1', 2), row('30', 3)] } }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(snap.perMinute[0].users).toBe(0)
    expect(snap.perMinute.reduce((a, m) => a + m.users, 0)).toBe(0)
  })

  it('chỉ giữ top 8, giảm dần, kể cả khi GA trả 50 dòng', async () => {
    const reports = { country: { rows: Array.from({ length: 50 }, (_, i) => row(`C${i}`, i)) } }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(snap.countries).toHaveLength(8)
    expect(snap.countries.map((c) => c.value)).toEqual([49, 48, 47, 46, 45, 44, 43, 42])
  })

  it('không rò dữ liệu thừa của GA vào snapshot (chỉ trường đã biết)', async () => {
    const reports = { country: { rows: [{ ...row('VN', 1), extra: 'secret' }], propertyQuota: { x: 1 } } }
    const snap = await createGaRealtime({ ...creds, fetchImpl: google({ reports }) }).snapshot()
    expect(Object.keys(snap).sort()).toEqual(['activeUsers', 'configured', 'countries', 'devices', 'fetchedAt', 'pageViews', 'pages', 'perMinute'])
    expect(JSON.stringify(snap)).not.toContain('secret')
  })
})

describe('GA realtime — token & đồng thời', () => {
  it('lần đầu 5 báo cáo song song chỉ đổi token 1 lần', async () => {
    const fetchImpl = google()
    await createGaRealtime({ ...creds, fetchImpl }).snapshot()
    expect(fetchImpl.mock.calls.filter(([u]) => isToken(u))).toHaveLength(1)
  })

  it('snapshot() đồng thời dùng chung 1 lần tải (không nhân số lần gọi GA)', async () => {
    const fetchImpl = google()
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => 1_000_000 })
    await Promise.all([ga.snapshot(), ga.snapshot(), ga.snapshot()])
    const reportCalls = fetchImpl.mock.calls.filter(([u]) => !isToken(u))
    expect(reportCalls).toHaveLength(5)
  })

  it('đổi token lỗi không "đầu độc" lần thử sau', async () => {
    let fail = true
    const fetchImpl = google({ token: () => (fail ? json({}, 500) : json({ access_token: 'tok2', expires_in: 3600 })) })
    const ga = createGaRealtime({ ...creds, fetchImpl })
    await expect(ga.snapshot()).rejects.toMatchObject({ code: 'UPSTREAM' })
    fail = false
    await expect(ga.snapshot()).resolves.toMatchObject({ configured: true })
    const auths = fetchImpl.mock.calls.filter(([u]) => !isToken(u)).map(([, i]) => i.headers.authorization)
    expect(new Set(auths)).toEqual(new Set(['Bearer tok2']))
  })

  it('lỗi mạng khi đổi token rồi phục hồi', async () => {
    let boom = true
    const fetchImpl = vi.fn(async (url, _init) => {
      if (isToken(url)) {
        if (boom) throw new TypeError('fetch failed')
        return json({ access_token: 't', expires_in: 3600 })
      }
      return json({})
    })
    const ga = createGaRealtime({ ...creds, fetchImpl })
    await expect(ga.snapshot()).rejects.toThrow()
    boom = false
    await expect(ga.snapshot()).resolves.toMatchObject({ configured: true })
  })

  it('lỗi không được cache: lần sau gọi lại GA ngay', async () => {
    let status = 500
    const fetchImpl = google({ api: () => (status !== 200 ? json({}, status) : null) })
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => 5_000_000 })
    await expect(ga.snapshot()).rejects.toBeInstanceOf(GaError)
    status = 200
    await expect(ga.snapshot()).resolves.toMatchObject({ configured: true })
  })

  it('token gần hết hạn (<60s) được đổi mới; còn hạn thì dùng lại', async () => {
    let t = 1_000_000
    let n = 0
    const fetchImpl = google({ token: () => json({ access_token: `tok${++n}`, expires_in: 3600 }) })
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => t })
    await ga.snapshot()
    t = 1_000_000 + 3600_000 - 120_000 // còn 120s → dùng lại
    await ga.snapshot()
    expect(n).toBe(1)
    t = 1_000_000 + 3600_000 - 30_000 // còn 30s → đổi mới
    await ga.snapshot()
    expect(n).toBe(2)
    const last = fetchImpl.mock.calls.filter(([u]) => !isToken(u)).at(-1)[1].headers.authorization
    expect(last).toBe('Bearer tok2')
  })

  it('expires_in ngắn (30s) → mỗi lần báo cáo sau cache đều đổi token, không lặp vô hạn', async () => {
    let t = 1_000_000
    let n = 0
    const fetchImpl = google({ token: () => json({ access_token: `tok${++n}`, expires_in: 30 }) })
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => t })
    await ga.snapshot()
    expect(n).toBeGreaterThanOrEqual(1)
    expect(n).toBeLessThanOrEqual(5)
  })

  it.each([401, 403])('API trả %i → bỏ token, lần sau đổi token mới', async (status) => {
    let n = 0
    let reject = true
    const fetchImpl = google({
      token: () => json({ access_token: `tok${++n}`, expires_in: 3600 }),
      api: (u, init) => (reject && init.headers.authorization === 'Bearer tok1' ? json({}, status) : null),
    })
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => 1_000_000 })
    await expect(ga.snapshot()).rejects.toMatchObject({ code: 'AUTH' })
    reject = false
    await expect(ga.snapshot()).resolves.toMatchObject({ configured: true })
    expect(n).toBe(2)
  })

  it('token endpoint 401/400 → AUTH, 5xx/429 → UPSTREAM', async () => {
    for (const [status, code] of [[400, 'AUTH'], [401, 'AUTH'], [500, 'UPSTREAM'], [429, 'UPSTREAM'], [403, 'UPSTREAM']]) {
      const ga = createGaRealtime({ ...creds, fetchImpl: google({ token: () => json({}, status) }) })
      await expect(ga.snapshot()).rejects.toMatchObject({ code })
    }
  })

  it('token endpoint trả 200 nhưng thiếu access_token → báo lỗi AUTH/UPSTREAM, không gửi "Bearer undefined"', async () => {
    const fetchImpl = google({ token: () => json({}) })
    const ga = createGaRealtime({ ...creds, fetchImpl })
    await expect(ga.snapshot()).rejects.toBeInstanceOf(GaError)
    const auths = fetchImpl.mock.calls.filter(([u]) => !isToken(u)).map(([, i]) => i.headers.authorization)
    expect(auths).not.toContain('Bearer undefined')
  })

  it('lỗi mạng / khoá RSA hỏng được quy về GaError (để route trả 502 GA_*)', async () => {
    const net = createGaRealtime({ ...creds, fetchImpl: vi.fn(async () => { throw new TypeError('fetch failed') }) })
    await expect(net.snapshot()).rejects.toBeInstanceOf(GaError)
    const bad = createGaRealtime({ ...creds, privateKey: 'not a key', fetchImpl: google() })
    await expect(bad.snapshot()).rejects.toBeInstanceOf(GaError)
  })

  it('tạo adapter với propertyId có khoảng trắng / số âm → null', () => {
    expect(createGaRealtime({ ...creds, propertyId: ' 123' })).toBeNull()
    expect(createGaRealtime({ ...creds, propertyId: '-1' })).toBeNull()
    expect(createGaRealtime({ ...creds, propertyId: '123\n' })).toBeNull()
  })
})

describe('GA realtime — không rò bí mật', () => {
  async function setup(gaRealtime, config = { publicSiteUrl: 'https://x.test' }) {
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const storage = createMemoryStorage({ maxBytes: 1024 })
    const app = createApp({ repo, auth, storage, config, gaRealtime })
    const { user } = await auth.signUp({ email: 'a@x.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'A', role: 'admin' })
    const admin = `Bearer ${(await auth.signIn({ email: 'a@x.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    return { app, admin }
  }

  it('lỗi từ Google chứa khoá/token → response 502 chỉ có mã GA_*', async () => {
    const leaky = (status, body) => google({
      token: () => json({ error: 'invalid_grant', error_description: `PRIVATE-KEY-LEAK ${privateKey.slice(30, 60)}` }, 400),
      api: status ? () => json(body, status) : undefined,
    })
    for (const fetchImpl of [leaky(), google({ api: () => json({ error: { message: 'LEAK-MSG' } }, 500) })]) {
      const ga = createGaRealtime({ ...creds, fetchImpl })
      const { app, admin } = await setup(ga)
      const res = await request(app).get('/api/admin/analytics/realtime').set('Authorization', admin)
      expect(res.status).toBe(502)
      expect(res.text).not.toMatch(/LEAK|BEGIN|PRIVATE|sa@p\.iam|Bearer|tok/)
      expect(Object.keys(res.body.error).sort()).toEqual(['code', 'message'])
      expect(res.body.error.code).toMatch(/^GA_(AUTH|QUOTA|UPSTREAM)$/)
    }
  })

  it('lỗi không phải GaError → 500 chung chung, không lộ nội dung lỗi', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { app, admin } = await setup({ snapshot: async () => { throw new Error('SECRET-KEY-123') } })
    const res = await request(app).get('/api/admin/analytics/realtime').set('Authorization', admin)
    expect(res.status).toBe(500)
    expect(res.text).not.toContain('SECRET-KEY-123')
    vi.restoreAllMocks()
  })

  it('chưa cấu hình → đúng { configured: false } và không kèm trường nào khác; cache không nằm trên URL khác', async () => {
    const { app, admin } = await setup(null)
    const res = await request(app).get('/api/admin/analytics/realtime').set('Authorization', admin)
    expect(res.body).toEqual({ configured: false })
  })

  it('snapshot thành công không chứa khoá, email service account hay token', async () => {
    const ga = createGaRealtime({ ...creds, fetchImpl: google({ reports: { country: { rows: [row('VN', 1)] } } }) })
    const { app, admin } = await setup(ga)
    const res = await request(app).get('/api/admin/analytics/realtime').set('Authorization', admin)
    expect(res.status).toBe(200)
    expect(res.text).not.toMatch(/BEGIN|sa@p\.iam|tok"/)
  })

  it('không có route công khai nào trả config (khoá GA không lộ qua API)', async () => {
    const env = { GA_PROPERTY_ID: '123456', GA_CLIENT_EMAIL: creds.clientEmail, GA_PRIVATE_KEY: privateKey.replace(/\n/g, '\\n') }
    const cfg = loadConfig(env)
    expect(cfg.gaRealtime.privateKey).toContain('BEGIN')
    const { app, admin } = await setup(undefined, { ...cfg, publicSiteUrl: 'https://x.test' })
    for (const path of ['/api/health', '/api/config', '/api/admin/config', '/api/it/config', '/', '/admin/analytics']) {
      for (const headers of [{}, { Authorization: admin }]) {
        const res = await request(app).get(path).set(headers)
        expect(res.text).not.toMatch(/BEGIN (RSA )?PRIVATE|sa@p\.iam/)
      }
    }
  })

  it('config: GA_PROPERTY_ID rỗng/thiếu khoá → adapter null, thiếu từng biến đều "chưa cấu hình"', () => {
    const sa = { GA_CLIENT_EMAIL: 'a@b', GA_PRIVATE_KEY: 'K' }
    expect(createGaRealtime(loadConfig({ ...sa }).gaRealtime)).toBeNull()
    expect(createGaRealtime(loadConfig({ GA_PROPERTY_ID: '1', GA_CLIENT_EMAIL: 'a@b' }).gaRealtime)).toBeNull()
    expect(createGaRealtime(loadConfig({ GA_PROPERTY_ID: '1', GA_SERVICE_ACCOUNT_JSON: '{bad' }).gaRealtime)).toBeNull()
  })
})
