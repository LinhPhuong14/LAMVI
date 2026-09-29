// Kiểm thử độc lập: giỏ hàng (FR-CART-001, §11, §12, BR-PRC-002/003, D-59…D-61, D-54)
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { MAX_LINES, parseLine } from './cart/service.js'

let app, repo, auth, maintenance, token, clock

async function login(email) {
  const { user } = await auth.signUp({ email, password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: email })
  return `Bearer ${(await auth.signIn({ email, password: 'matkhau123' })).accessToken}`
}

beforeEach(async () => {
  clock = Date.now()
  repo = createMemoryRepo()
  auth = createMemoryAuth({ accessTtlMs: 60_000, now: () => clock })
  maintenance = createMaintenance({ repo, ttlMs: 0 })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' }, maintenance })
  token = await login('an@moc.test')
})

const put = (slug, quantity, t = token) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', t).send({ quantity })
const del = (slug, t = token) => request(app).delete(`/api/cart/items/${slug}`).set('Authorization', t)
const get = (t = token, lang = 'vi') => request(app).get(`/api/cart?lang=${lang}`).set('Authorization', t)
const quote = (items) => request(app).post('/api/cart/quote').send({ items })
const merge = (items, t = token) => request(app).post('/api/cart/merge').set('Authorization', t).send({ items })
const setStatus = async (slug, status) => {
  const p = await repo.getProductBySlug(slug)
  await repo.updateProduct(p.id, { status })
}
const addProducts = async (n) => {
  const slugs = []
  for (let i = 0; i < n; i++) {
    const slug = `den-thu-${i}`
    await repo.createProduct({
      slug,
      kind: 'single',
      status: 'published',
      priceExclVat: 100000 + i,
      tone: 'amber',
      sortOrder: 100 + i,
      name: { vi: `Đèn ${i}` },
      description: null,
      badge: null,
    })
    slugs.push(slug)
  }
  return slugs
}

describe('Không tin dữ liệu từ trình duyệt (§12, BR-PRC-002)', () => {
  it('quote bỏ qua giá, tên, id, tổng tiền do client gửi', async () => {
    const res = await request(app)
      .post('/api/cart/quote')
      .send({
        subtotalExclVat: 1,
        items: [
          {
            slug: 'den-nguyet',
            quantity: 2,
            priceExclVat: 1,
            lineTotalExclVat: 2,
            available: true,
            id: '11111111-1111-4111-8111-000000000002',
            product: { name: 'HACK', priceExclVat: 1 },
          },
        ],
      })
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([
      expect.objectContaining({ slug: 'den-nguyet', quantity: 2, lineTotalExclVat: 1780000, product: expect.objectContaining({ name: 'Đèn Nguyệt', priceExclVat: 890000 }) }),
    ])
    expect(res.body.subtotalExclVat).toBe(1780000)
  })

  it('merge bỏ qua mọi trường khác slug/quantity; không ghi theo id client gửi', async () => {
    const res = await merge([{ slug: 'den-nguyet', quantity: 1, productId: '11111111-1111-4111-8111-000000000002', priceExclVat: 1, userId: 'x' }])
    expect(res.status).toBe(200)
    expect(res.body.items.map((i) => [i.slug, i.quantity, i.lineTotalExclVat])).toEqual([['den-nguyet', 1, 890000]])
  })

  it('PUT bỏ qua giá trong body', async () => {
    const res = await request(app).put('/api/cart/items/den-nguyet').set('Authorization', token).send({ quantity: 1, priceExclVat: 1 })
    expect(res.body.subtotalExclVat).toBe(890000)
  })
})

describe('Slug lạ không gây 500', () => {
  const weird = ['DEN-NGUYET', 'đèn-nguyệt', '..', '../admin', 'a'.repeat(5000), '%00', 'den nguyet', 'den--nguyet', '-den', '中文']

  it.each(weird)('PUT %s → 4xx', async (slug) => {
    const res = await request(app).put(`/api/cart/items/${encodeURIComponent(slug)}`).set('Authorization', token).send({ quantity: 1 })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it.each(weird)('DELETE %s → không 500, giỏ không đổi', async (slug) => {
    await put('den-nguyet', 1)
    const res = await request(app).delete(`/api/cart/items/${encodeURIComponent(slug)}`).set('Authorization', token)
    expect(res.status).toBeLessThan(500)
    expect((await get()).body.items.map((i) => i.slug)).toEqual(['den-nguyet'])
  })

  it('quote/merge: slug lạ hoặc không phải chuỗi bị bỏ qua', async () => {
    const items = [...weird.map((slug) => ({ slug, quantity: 1 })), { slug: 123, quantity: 1 }, { slug: { $ne: '' }, quantity: 1 }, { slug: ['den-vong'], quantity: 1 }, { quantity: 1 }]
    const q = await quote(items)
    expect(q.status).toBe(200)
    expect(q.body.items).toEqual([])
    const m = await merge(items)
    expect(m.status).toBe(200)
    expect(m.body.items).toEqual([])
  })

  it('parseLine: slug dài quá 80 bị loại', () => {
    expect(parseLine({ slug: 'a'.repeat(81), quantity: 1 })).toBeNull()
    expect(parseLine({ slug: 'a'.repeat(80), quantity: 1 })).toEqual({ slug: 'a'.repeat(80), quantity: 1 })
  })
})

describe('Số lượng biên (D-60)', () => {
  it.each([
    [1, 200],
    [10, 200],
    [11, 400],
    [0, 400],
    [-1, 400],
    [1e9, 400],
    [2.5, 400],
    ['5', 400],
    [true, 400],
    [[3], 400],
    [{}, 400],
    [undefined, 400],
  ])('PUT quantity=%j → %i', async (q, status) => {
    const res = await put('den-nguyet', q)
    expect(res.status).toBe(status)
    if (status === 400) expect(res.body.error.code).toBe('VALIDATION_ERROR')
  })

  it('PUT NaN/Infinity (gửi JSON thô) → 400', async () => {
    for (const raw of ['{"quantity":NaN}', '{"quantity":Infinity}', '{"quantity":1e400}']) {
      const res = await request(app).put('/api/cart/items/den-nguyet').set('Authorization', token).set('Content-Type', 'application/json').send(raw)
      expect(res.status, raw).toBe(400)
    }
  })

  it('quote: số lượng sai bị bỏ dòng; lớn quá bị giới hạn 10; cộng dồn dòng trùng tối đa 10', async () => {
    const res = await quote([
      { slug: 'den-nguyet', quantity: 0 },
      { slug: 'den-nguyet', quantity: -1 },
      { slug: 'den-nguyet', quantity: 1.5 },
      { slug: 'den-nguyet', quantity: '3' },
      { slug: 'den-nguyet', quantity: null },
      { slug: 'den-vong', quantity: 1e9 },
      { slug: 'den-sum-vay', quantity: 6 },
      { slug: 'den-sum-vay', quantity: 6 },
    ])
    expect(res.body.items.map((i) => [i.slug, i.quantity])).toEqual([
      ['den-vong', 10],
      ['den-sum-vay', 10],
    ])
  })

  it('merge: số lượng lớn → tối đa 10', async () => {
    const res = await merge([{ slug: 'den-vong', quantity: 1e9 }])
    expect(res.body.items[0].quantity).toBe(10)
  })
})

describe('Body items sai định dạng', () => {
  it.each([
    ['không có items', {}],
    ['items là object', { items: { slug: 'den-vong', quantity: 1 } }],
    ['items là chuỗi', { items: 'den-vong' }],
    ['items null', { items: null }],
    ['items quá dài', { items: Array.from({ length: MAX_LINES * 2 + 1 }, () => ({ slug: 'den-vong', quantity: 1 })) }],
  ])('%s → 400 (quote và merge)', async (_, body) => {
    expect((await request(app).post('/api/cart/quote').send(body)).status).toBe(400)
    expect((await request(app).post('/api/cart/merge').set('Authorization', token).send(body)).status).toBe(400)
  })

  it('phần tử null/số/chuỗi trong items bị bỏ qua, không 500', async () => {
    const items = [null, 1, 'x', [], { slug: 'den-vong', quantity: 1 }]
    const q = await quote(items)
    expect(q.status).toBe(200)
    expect(q.body.items.map((i) => i.slug)).toEqual(['den-vong'])
    const m = await merge(items)
    expect(m.status).toBe(200)
    expect(m.body.items.map((i) => i.slug)).toEqual(['den-vong'])
  })

  it('đúng 100 dòng (giới hạn) vẫn nhận', async () => {
    expect((await quote(Array.from({ length: MAX_LINES * 2 }, () => ({ slug: 'den-vong', quantity: 1 })))).status).toBe(200)
  })

  it('JSON hỏng → 400', async () => {
    const res = await request(app).post('/api/cart/quote').set('Content-Type', 'application/json').send('{items:')
    expect(res.status).toBe(400)
  })
})

describe('Phân quyền giỏ', () => {
  it('người này không đọc/sửa/xoá được giỏ người khác', async () => {
    const other = await login('binh@moc.test')
    await put('den-nguyet', 4, other)
    await put('den-vong', 1)
    await del('den-nguyet')
    await merge([{ slug: 'den-nguyet', quantity: 3 }])
    expect((await get(other)).body.items.map((i) => [i.slug, i.quantity])).toEqual([['den-nguyet', 4]])
    // Tham số lạ (userId) không đổi được người sở hữu
    await request(app).put('/api/cart/items/den-sum-vay?userId=x').set('Authorization', token).send({ quantity: 1, userId: 'x' })
    expect((await get(other)).body.items).toHaveLength(1)
  })

  it('token hết hạn / sai / thiếu → 401 cho GET, PUT, DELETE, merge', async () => {
    await put('den-nguyet', 1)
    clock += 61_000
    for (const t of [token, 'Bearer sai', undefined]) {
      const set = (r) => (t ? r.set('Authorization', t) : r)
      expect((await set(request(app).get('/api/cart'))).status).toBe(401)
      expect((await set(request(app).put('/api/cart/items/den-nguyet')).send({ quantity: 2 })).status).toBe(401)
      expect((await set(request(app).delete('/api/cart/items/den-nguyet'))).status).toBe(401)
      expect((await set(request(app).post('/api/cart/merge')).send({ items: [] })).status).toBe(401)
    }
  })

  it('quote không cần đăng nhập và không đọc giỏ tài khoản', async () => {
    await put('den-nguyet', 5)
    const res = await request(app).post('/api/cart/quote').set('Authorization', token).send({ items: [] })
    expect(res.status).toBe(200)
    expect(res.body.items).toEqual([])
  })
})

describe(`Tối đa ${MAX_LINES} dòng [ASSUMPTION]`, () => {
  it('dòng thứ 51 → 409 CART_FULL; sửa dòng cũ vẫn được', async () => {
    const slugs = await addProducts(MAX_LINES + 1)
    for (const s of slugs.slice(0, MAX_LINES)) expect((await put(s, 1)).status).toBe(200)
    const res = await put(slugs[MAX_LINES], 1)
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('CART_FULL')
    expect((await put(slugs[0], 3)).status).toBe(200)
    expect((await get()).body.items).toHaveLength(MAX_LINES)
  })

  it('merge vượt 50 dòng: phần dư bị bỏ, vẫn cộng được dòng đã có', async () => {
    const slugs = await addProducts(MAX_LINES + 5)
    for (const s of slugs.slice(0, MAX_LINES - 2)) await put(s, 1)
    const res = await merge([...slugs.slice(MAX_LINES - 2).map((slug) => ({ slug, quantity: 1 })), { slug: slugs[0], quantity: 2 }])
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(MAX_LINES)
    expect(res.body.items.find((i) => i.slug === slugs[0]).quantity).toBe(3)
  })

  it('quote: tối đa 50 dòng trả về', async () => {
    const slugs = await addProducts(MAX_LINES + 10)
    const res = await quote(slugs.map((slug) => ({ slug, quantity: 1 })))
    expect(res.body.items).toHaveLength(MAX_LINES)
  })
})

describe('Trạng thái sản phẩm (§11, D-39, D-41)', () => {
  it('sản phẩm bị xoá khỏi DB biến khỏi giỏ (GET, tạm tính, itemCount)', async () => {
    await put('den-nguyet', 2)
    await put('den-vong', 3)
    const p = await repo.getProductBySlug('den-vong')
    await repo.deleteProduct(p.id)
    const res = await get()
    expect(res.body.items.map((i) => i.slug)).toEqual(['den-nguyet'])
    expect(res.body).toMatchObject({ subtotalExclVat: 1780000, itemCount: 2, hasUnavailable: false })
    // quote vãng lai cũng bỏ
    expect((await quote([{ slug: 'den-vong', quantity: 1 }])).body.items).toEqual([])
  })

  it.each(['hidden', 'draft'])('%s: không thêm mới, giữ nguyên/giảm/xoá được; không tính tạm tính, itemCount', async (status) => {
    await put('den-nguyet', 1)
    await put('den-vong', 5)
    await setStatus('den-vong', status)
    expect((await put('den-vong', 6)).status).toBe(409)
    expect((await put('den-vong', 5)).status).toBe(200)
    const dec = await put('den-vong', 2)
    expect(dec.status).toBe(200)
    expect(dec.body).toMatchObject({ subtotalExclVat: 890000, itemCount: 1, hasUnavailable: true })
    expect(dec.body.items.find((i) => i.slug === 'den-vong')).toMatchObject({ quantity: 2, available: false, lineTotalExclVat: null })
    // merge không thêm/tăng sản phẩm không còn bán
    const m = await merge([{ slug: 'den-vong', quantity: 3 }])
    expect(m.body.items.find((i) => i.slug === 'den-vong').quantity).toBe(2)
    expect((await del('den-vong')).body.items.map((i) => i.slug)).toEqual(['den-nguyet'])
    // Chưa có trong giỏ → không thêm được
    await setStatus('den-sum-vay', status)
    expect((await put('den-sum-vay', 1)).status).toBeGreaterThanOrEqual(400)
  })

  it('hiện lại (published) → tính lại vào tạm tính', async () => {
    await put('den-vong', 2)
    await setStatus('den-vong', 'hidden')
    expect((await get()).body.subtotalExclVat).toBe(0)
    await setStatus('den-vong', 'published')
    expect((await get()).body).toMatchObject({ subtotalExclVat: 2100000, itemCount: 2, hasUnavailable: false })
  })

  it('giá đổi → giỏ (tài khoản và vãng lai) theo giá mới', async () => {
    await put('den-vong', 3)
    const p = await repo.getProductBySlug('den-vong')
    await repo.updateProduct(p.id, { priceExclVat: 1234567 })
    expect((await get()).body.subtotalExclVat).toBe(3 * 1234567)
    expect((await quote([{ slug: 'den-vong', quantity: 3 }])).body.subtotalExclVat).toBe(3 * 1234567)
  })

  it('tạm tính là số nguyên (không lệch float), itemCount chỉ đếm dòng còn bán', async () => {
    const slugs = await addProducts(3)
    for (const [i, s] of slugs.entries()) {
      const p = await repo.getProductBySlug(s)
      await repo.updateProduct(p.id, { priceExclVat: [333333, 999999, 1] [i] })
      await put(s, 10)
    }
    await put('den-nguyet', 7)
    await setStatus('den-nguyet', 'hidden')
    const res = await get()
    expect(res.body.subtotalExclVat).toBe(10 * (333333 + 999999 + 1))
    expect(Number.isInteger(res.body.subtotalExclVat)).toBe(true)
    for (const i of res.body.items) if (i.available) expect(Number.isInteger(i.lineTotalExclVat)).toBe(true)
    expect(res.body.itemCount).toBe(30)
  })

  it('D-39: quote của khách không lộ tên sản phẩm nháp (Draft/Hidden = "không tìm thấy" với khách)', async () => {
    await repo.createProduct({
      slug: 'den-bi-mat',
      kind: 'single',
      status: 'draft',
      priceExclVat: 500000,
      tone: 'amber',
      sortOrder: 99,
      name: { vi: 'Đèn Bí Mật Chưa Ra Mắt' },
      description: null,
      badge: null,
    })
    const res = await quote([{ slug: 'den-bi-mat', quantity: 1 }])
    expect(JSON.stringify(res.body)).not.toContain('Bí Mật')
  })
})

describe('Bảo trì (D-54)', () => {
  it('PUT/DELETE/merge 503; GET và quote chạy; quote không ghi gì', async () => {
    await put('den-nguyet', 2)
    await maintenance.set(true, null)
    expect((await put('den-nguyet', 3)).status).toBe(503)
    expect((await del('den-nguyet')).status).toBe(503)
    expect((await merge([{ slug: 'den-vong', quantity: 1 }])).status).toBe(503)
    expect((await request(app).post('/api/cart/merge/').set('Authorization', token).send({ items: [] })).status).toBe(503)
    expect((await request(app).post('/api/CART/MERGE').set('Authorization', token).send({ items: [{ slug: 'den-vong', quantity: 1 }] })).status).toBe(503)
    const g = await get()
    expect(g.status).toBe(200)
    expect(g.body.items.map((i) => [i.slug, i.quantity])).toEqual([['den-nguyet', 2]])
    const q = await request(app).post('/api/cart/quote').set('Authorization', token).send({ items: [{ slug: 'den-vong', quantity: 4 }] })
    expect(q.status).toBe(200)
    expect(q.body.subtotalExclVat).toBe(4200000)
    expect((await get()).body.items.map((i) => [i.slug, i.quantity])).toEqual([['den-nguyet', 2]])
  })

  it('allowlist quote không mở đường ghi: /api/cart/quote/../merge, quote?x → merge không lọt', async () => {
    await maintenance.set(true, null)
    const res = await request(app).post('/api/cart/merge?next=/api/cart/quote').set('Authorization', token).send({ items: [{ slug: 'den-vong', quantity: 1 }] })
    expect(res.status).toBe(503)
  })
})

describe('Đồng thời', () => {
  it('nhiều PUT song song không vượt 10', async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => put('den-nguyet', (i % 10) + 1)))
    const q = (await get()).body.items[0].quantity
    expect(q).toBeGreaterThanOrEqual(1)
    expect(q).toBeLessThanOrEqual(10)
  })

  it('nhiều merge song song không vượt 10', async () => {
    await put('den-nguyet', 5)
    await Promise.all(Array.from({ length: 10 }, () => merge([{ slug: 'den-nguyet', quantity: 9 }])))
    expect((await get()).body.items[0].quantity).toBe(10)
  })

  it(`PUT song song khi giỏ gần đầy không vượt ${MAX_LINES} dòng`, async () => {
    const slugs = await addProducts(MAX_LINES + 5)
    for (const s of slugs.slice(0, MAX_LINES - 1)) await put(s, 1)
    const res = await Promise.all(slugs.slice(MAX_LINES - 1).map((s) => put(s, 1)))
    expect(res.filter((r) => r.status === 200).length).toBeLessThanOrEqual(1)
    expect((await get()).body.items.length).toBeLessThanOrEqual(MAX_LINES)
  })
})

describe('SSR /cart là trang riêng tư (BR-SEO-001, D-49)', () => {
  it.each(['/cart', '/en/cart', '/zh/cart'])('%s: khung rỗng + noindex, không nạp dữ liệu', async (url) => {
    const { renderPage } = await import('./ssr.js')
    const { render } = await import('../src/entry-server.jsx')
    const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const r = await renderPage({ repo, config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url })
    expect(r.status).toBe(200)
    expect(r.noindex).toBe(true)
    expect(r.html).toContain('<div id="root"></div>')
    expect(r.html).toMatch(/<meta name="robots" content="noindex/)
    expect(r.html).not.toContain('__INITIAL_DATA__=')
  })

  it('sitemap không chứa /cart', async () => {
    const res = await request(app).get('/sitemap.xml')
    expect(res.text).not.toMatch(/\/cart/)
  })
})

describe('Migration cart_items', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260929000005_cart.sql', import.meta.url), 'utf8')
  it('check quantity 1..10, PK (user_id, product_id), cascade, RLS bật, không có policy mở cho anon', () => {
    expect(sql).toMatch(/check\s*\(\s*quantity\s+between\s+1\s+and\s+10\s*\)/i)
    expect(sql).toMatch(/primary key\s*\(\s*user_id\s*,\s*product_id\s*\)/i)
    expect(sql).toMatch(/user_id uuid not null references auth\.users \(id\) on delete cascade/i)
    expect(sql).toMatch(/product_id uuid not null references public\.products \(id\) on delete cascade/i)
    expect(sql).toMatch(/alter table public\.cart_items enable row level security/i)
    expect(sql).not.toMatch(/create policy[\s\S]*cart_items[\s\S]*\banon\b/i)
    expect(sql).not.toMatch(/grant[\s\S]*cart_items[\s\S]*to\s+(anon|public)/i)
  })
})
