import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { createSupabaseRepo } from './repo.js'

// Client giả lập kiểu chainable: ghi lại chuỗi lời gọi, mô phỏng lọc eq/in/order trên dữ liệu
function fakeClient(tables, { error } = {}) {
  const calls = []
  const client = {
    calls,
    from(table) {
      const ops = []
      calls.push({ table, ops })
      let rows = [...(tables[table] ?? [])]
      const b = {
        select: (...a) => (ops.push(['select', ...a]), b),
        order: (col, opts) => {
          ops.push(['order', col, opts])
          rows = [...rows].sort((x, y) => (x[col] - y[col]) * (opts?.ascending === false ? -1 : 1))
          return b
        },
        eq: (col, v) => (ops.push(['eq', col, v]), (rows = rows.filter((r) => r[col] === v)), b),
        in: (col, vs) => (ops.push(['in', col, vs]), (rows = rows.filter((r) => vs.includes(r[col]))), b),
        maybeSingle: () => (ops.push(['maybeSingle']), Promise.resolve(error ? { data: null, error } : { data: rows[0] ?? null, error: null })),
        then: (res, rej) => Promise.resolve(error ? { data: null, error } : { data: rows, error: null }).then(res, rej),
      }
      return b
    },
  }
  return client
}

const productRow = (over) => ({
  id: 'p1',
  slug: 'den-nguyet',
  kind: 'single',
  status: 'published',
  price: 890000,
  tone: 'amber',
  sort_order: 1,
  name: { vi: 'Đèn Nguyệt' },
  description: null,
  badge: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
  ...over,
})

describe('createSupabaseRepo — mapping snake_case → camelCase', () => {
  it('listProducts map đủ trường (updatedAt cho admin), bỏ created_at', async () => {
    const repo = createSupabaseRepo(fakeClient({ products: [productRow()] }))
    const [p] = await repo.listProducts()
    expect(p).toEqual({
      id: 'p1',
      slug: 'den-nguyet',
      kind: 'single',
      status: 'published',
      price: 890000,
      tone: 'amber',
      sortOrder: 1,
      name: { vi: 'Đèn Nguyệt' },
      description: null,
      badge: null,
      imageUrl: undefined,
      imagePath: undefined,
      imageAlt: undefined,
      collectionSlug: null,
      pieceOrder: 0,
      updatedAt: expect.anything(),
    })
    expect(p).not.toHaveProperty('createdAt')
  })

  it('listProducts({statuses}) lọc bằng in(status) và order(sort_order)', async () => {
    const client = fakeClient({
      products: [
        productRow({ id: 'a', status: 'hidden', sort_order: 1 }),
        productRow({ id: 'b', status: 'published', sort_order: 3 }),
        productRow({ id: 'c', status: 'draft', sort_order: 0 }),
        productRow({ id: 'd', status: 'published', sort_order: 2 }),
      ],
    })
    const items = await createSupabaseRepo(client).listProducts({ statuses: ['published'] })
    expect(items.map((p) => p.id)).toEqual(['d', 'b'])
    const ops = client.calls[0].ops
    expect(client.calls[0].table).toBe('products')
    expect(ops).toContainEqual(['in', 'status', ['published']])
    expect(ops.some((o) => o[0] === 'order' && o[1] === 'sort_order')).toBe(true)
  })

  it('listProducts() không truyền statuses → không lọc status', async () => {
    const client = fakeClient({ products: [productRow({ status: 'draft' })] })
    expect(await createSupabaseRepo(client).listProducts()).toHaveLength(1)
    expect(client.calls[0].ops.some((o) => o[0] === 'in')).toBe(false)
  })

  it('getProductBySlug: eq(slug) + maybeSingle; không có → null', async () => {
    const client = fakeClient({ products: [productRow()] })
    const repo = createSupabaseRepo(client)
    expect((await repo.getProductBySlug('den-nguyet')).price).toBe(890000)
    expect(await repo.getProductBySlug('khong-co')).toBeNull()
    expect(client.calls[0].ops).toContainEqual(['eq', 'slug', 'den-nguyet'])
    expect(client.calls[0].ops).toContainEqual(['maybeSingle'])
  })

  it('listFaq: mặc định chỉ is_published=true, map isPublished/sortOrder', async () => {
    const client = fakeClient({
      faq_entries: [
        { id: 'f2', sort_order: 2, is_published: true, question: { vi: 'Q2' }, answer: { vi: 'A2' } },
        { id: 'f1', sort_order: 1, is_published: false, question: { vi: 'Q1' }, answer: { vi: 'A1' } },
        { id: 'f0', sort_order: 0, is_published: true, question: { vi: 'Q0' }, answer: { vi: 'A0' } },
      ],
    })
    const repo = createSupabaseRepo(client)
    const items = await repo.listFaq()
    expect(items).toEqual([
      { id: 'f0', sortOrder: 0, isPublished: true, question: { vi: 'Q0' }, answer: { vi: 'A0' } },
      { id: 'f2', sortOrder: 2, isPublished: true, question: { vi: 'Q2' }, answer: { vi: 'A2' } },
    ])
    expect(client.calls[0].table).toBe('faq_entries')
    expect(client.calls[0].ops).toContainEqual(['eq', 'is_published', true])
    expect(await repo.listFaq({ publishedOnly: false })).toHaveLength(3)
  })

  it('getBatchByCode map video_url/produced_on → videoUrl/producedOn', async () => {
    const client = fakeClient({
      batches: [
        {
          id: 'b1',
          code: 'L-01',
          status: 'video_published',
          video_url: 'https://v',
          produced_on: '2026-09-01',
          title: { vi: 'Lô' },
          story: null,
        },
      ],
    })
    const b = await createSupabaseRepo(client).getBatchByCode('L-01')
    expect(b).toEqual({
      id: 'b1',
      code: 'L-01',
      status: 'video_published',
      videoUrl: 'https://v',
      producedOn: '2026-09-01',
      title: { vi: 'Lô' },
      story: null,
    })
    expect(client.calls[0].ops).toContainEqual(['eq', 'code', 'L-01'])
    expect(await createSupabaseRepo(client).getBatchByCode('X')).toBeNull()
  })

  it('lỗi Supabase được ném ra (để errorHandler trả 500), không nuốt thành rỗng', async () => {
    const err = { message: 'permission denied', code: '42501' }
    const repo = createSupabaseRepo(fakeClient({}, { error: err }))
    await expect(repo.listProducts()).rejects.toBe(err)
    await expect(repo.getProductBySlug('x')).rejects.toBe(err)
    await expect(repo.listFaq()).rejects.toBe(err)
    await expect(repo.getBatchByCode('x')).rejects.toBe(err)
  })
})

describe('createSupabaseRepo với supabase-js thật (fetch giả, không gọi mạng)', () => {
  function realClient(body = []) {
    const urls = []
    const fetch = async (url) => {
      urls.push(decodeURIComponent(String(url)))
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }
    const client = createClient('http://supabase.test', 'service-role-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch },
    })
    return { client, urls }
  }

  it('chuỗi order() rồi in()/eq() tạo đúng query PostgREST', async () => {
    const { client, urls } = realClient([])
    const repo = createSupabaseRepo(client)
    await repo.listProducts({ statuses: ['published'] })
    await repo.listFaq()
    expect(urls[0]).toContain('/rest/v1/products?')
    expect(urls[0]).toContain('order=sort_order.asc')
    expect(urls[0]).toContain('status=in.(published)')
    expect(urls[1]).toContain('/rest/v1/faq_entries?')
    expect(urls[1]).toContain('is_published=eq.true')
  })
})
