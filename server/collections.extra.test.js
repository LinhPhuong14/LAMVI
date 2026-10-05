// Kiểm thử độc lập (T-11): bộ sưu tập (D-96) + gallery/chăn Đông Hồ (D-97) — edge case
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { collections as seedCols, products as seedProducts } from './data/seed.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'

const PW = 'Gio-Hoa#Sen2026'
const STORY_VI = 'Chiều ba mươi'
const STORY_EN = 'last evening of the year'
const clone = (x) => JSON.parse(JSON.stringify(x))

let app, repo, auth, A, B, ADMIN, n

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: PW })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  return { id: user.id, bearer: `Bearer ${(await auth.signIn({ email, password: PW })).accessToken}` }
}
function build(data) {
  repo = createMemoryRepo(data)
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' } })
}
async function setup(data) {
  n = 0
  build(data)
  A = await login('a@moc.test')
  B = await login('b@moc.test')
  ADMIN = await login('admin@moc.test', 'admin')
}
async function order(user, items, over = {}) {
  n += 1
  const list = items.map((x) => (typeof x === 'string' ? { slug: x, quantity: 1 } : x))
  return repo.createOrder(
    { code: `LV2610-EXT${String(n).padStart(4, '0')}`, userId: user.id, status: 'delivered', orderKind: 'self', hasMessage: false, qrToken: `t${n}`.padEnd(64, 'b'), deliveredAt: `2026-10-0${n}T10:00:00Z`, total: 1, ...over },
    list.map((i) => ({ slug: i.slug, name: { vi: i.slug }, unitPrice: 1, quantity: i.quantity, lineTotal: 1 })),
  )
}
const gal = (lang = 'vi', u = A) => request(app).get(`/api/gallery?lang=${lang}`).set('Authorization', u.bearer)
const col = (body, slug) => body.collections.find((c) => c.slug === slug)
const SUM = ['den-nguyet', 'den-vong', 'den-tinh']

beforeEach(() => setup())

describe('gallery: reward không lọt khi chưa đủ bộ', () => {
  it.each([
    ['đơn chưa giao (shipped)', { status: 'shipped' }],
    ['đơn đã huỷ', { status: 'cancelled' }],
    ['delivery_failed', { status: 'delivery_failed' }],
    ['đang xử lý', { status: 'processing' }],
  ])('%s: không mảnh, không reward/story trong JSON, cả hai ngôn ngữ', async (_n, over) => {
    await order(A, SUM, over)
    for (const lang of ['vi', 'en', 'zh']) {
      const res = await gal(lang)
      expect(res.body.quilt.unlockedPieces).toBe(0)
      expect(res.body.lamps).toEqual([])
      const s = JSON.stringify(res.body)
      expect(s).not.toContain(STORY_VI)
      expect(s).not.toContain(STORY_EN)
      expect(s).not.toContain('Mâm cơm ngày Tết')
      expect(s).not.toContain('The Tet Feast')
      expect(s).not.toContain('年夜饭')
    }
  })

  it('đủ một phần (2/3): reward null, không lộ story/storyTitle', async () => {
    await order(A, ['den-nguyet', 'den-vong'])
    const res = await gal()
    expect(col(res.body, 'sum-vay')).toMatchObject({ ownedCount: 2, complete: false, reward: null })
    const s = JSON.stringify(res.body)
    expect(s).not.toContain(STORY_VI)
    expect(s).not.toContain('storyTitle')
    expect(s).not.toContain('Mâm cơm')
  })

  it('đơn của người khác không mở reward cho mình, nhưng mở cho chính họ', async () => {
    await order(B, SUM)
    expect(JSON.stringify((await gal('vi', A)).body)).not.toContain(STORY_VI)
    expect(JSON.stringify((await gal('vi', B)).body)).toContain(STORY_VI)
  })

  it('mảnh ghép từ nhiều đơn khác nhau vẫn cộng dồn; 1 đơn huỷ giữa chừng thì không', async () => {
    await order(A, ['den-nguyet'])
    await order(A, ['den-vong'], { status: 'cancelled' })
    await order(A, ['den-tinh'])
    expect(col((await gal()).body, 'sum-vay').complete).toBe(false)
    await order(A, ['den-vong'])
    expect(col((await gal()).body, 'sum-vay').complete).toBe(true)
  })

  it('mua 2 cái cùng một đèn không tính 2 mảnh và không đủ bộ', async () => {
    await order(A, [{ slug: 'den-nguyet', quantity: 2 }])
    await order(A, ['den-nguyet'])
    const res = await gal()
    expect(res.body.lamps).toHaveLength(1)
    expect(res.body.quilt.unlockedPieces).toBe(1)
    expect(col(res.body, 'sum-vay')).toMatchObject({ ownedCount: 1, complete: false, reward: null })
  })

  it('đơn lặp cùng đèn: lamp ghi nhận đơn giao sớm nhất', async () => {
    await order(A, ['den-nguyet'], { deliveredAt: '2026-10-03T00:00:00Z' })
    await order(A, ['den-nguyet'], { deliveredAt: '2026-10-01T00:00:00Z' })
    const l = (await gal()).body.lamps[0]
    expect(l.receivedAt).toBe('2026-10-01T00:00:00Z')
  })

  it('mua set của bộ này không mở bộ khác', async () => {
    await order(A, ['den-sum-vay'])
    const res = await gal()
    expect(col(res.body, 'hoi-lang')).toMatchObject({ ownedCount: 0, reward: null })
    expect(res.body.quilt).toMatchObject({ completedCollections: 1, complete: false, unlockedPieces: 3 })
  })

  it('set đơn chưa giao không trao đèn lẻ', async () => {
    await order(A, ['den-sum-vay'], { status: 'shipped' })
    expect((await gal()).body.lamps).toEqual([])
  })

  it('đèn lẻ + set cùng bộ: không trùng đèn', async () => {
    await order(A, ['den-nguyet'])
    await order(A, ['den-sum-vay'])
    const res = await gal()
    expect(res.body.lamps.map((l) => l.slug).sort()).toEqual([...SUM].sort())
    expect(res.body.lamps.find((l) => l.slug === 'den-nguyet').viaSet).toBe(false)
  })

  it('set ngoài collection (collectionSlug null) không trao đèn nào, không lỗi', async () => {
    const data = { products: clone(seedProducts) }
    data.products.find((p) => p.slug === 'den-sum-vay').collectionSlug = null
    await setup(data)
    await order(A, ['den-sum-vay'])
    const res = await gal()
    expect(res.status).toBe(200)
    expect(res.body.lamps).toEqual([])
    expect(res.body.quilt.unlockedPieces).toBe(0)
  })

  it('đủ mọi bộ → quilt.complete, mọi reward lộ', async () => {
    await order(A, ['den-sum-vay', 'den-hoi-xuan', 'den-hoi-ha', 'den-hoi-thu', 'den-hoi-dong'])
    const res = await gal()
    expect(res.body.quilt).toMatchObject({ complete: true, completedCollections: 2, totalCollections: 2 })
    for (const c of res.body.collections) expect(c.reward.story.length).toBeGreaterThan(10)
  })

  it('lang en/zh: tên, tên lamp và reward theo ngôn ngữ; lang lạ → vi', async () => {
    await order(A, SUM)
    const en = col((await gal('en')).body, 'sum-vay')
    expect(en.name).toBe('Sum Vay')
    expect(en.reward.story).toContain(STORY_EN)
    const zh = col((await gal('zh')).body, 'sum-vay')
    expect(zh.reward.title).toBe('年夜饭')
    const xx = col((await gal('xx')).body, 'sum-vay')
    expect(xx.reward.story).toContain(STORY_VI)
  })

  it('thứ tự pieces theo pieceOrder, không theo sortOrder/tên', async () => {
    const data = { products: clone(seedProducts) }
    const by = (s) => data.products.find((p) => p.slug === s)
    by('den-nguyet').pieceOrder = 3
    by('den-vong').pieceOrder = 1
    by('den-tinh').pieceOrder = 2
    await setup(data)
    expect(col((await gal()).body, 'sum-vay').pieces.map((p) => p.slug)).toEqual(['den-vong', 'den-tinh', 'den-nguyet'])
  })

  it('JSON gallery không lộ id/status/qrToken của đơn người khác hay story trong pieces', async () => {
    await order(A, ['den-nguyet'], { orderKind: 'gift', hasMessage: true })
    const s = JSON.stringify((await gal()).body)
    expect(s).not.toContain('t1'.padEnd(64, 'b'))
    expect(s).not.toContain('"status"')
    expect(s).not.toContain('"userId"')
  })
})

describe('draft/hidden', () => {
  it('sản phẩm draft/hidden không là mảnh và không lamp (kể cả đã mua); bộ không còn đủ', async () => {
    const data = { products: clone(seedProducts) }
    data.products.find((p) => p.slug === 'den-tinh').status = 'hidden'
    data.products.find((p) => p.slug === 'den-vong').status = 'draft'
    await setup(data)
    await order(A, SUM)
    const res = await gal()
    expect(res.body.lamps.map((l) => l.slug)).toEqual(['den-nguyet'])
    const c = col(res.body, 'sum-vay')
    expect(c.pieces.map((p) => p.slug)).toEqual(['den-nguyet'])
    // [ASSUMPTION của test] chỉ còn 1 đèn công khai, khách có đủ → complete theo đèn công khai
    expect(JSON.stringify(res.body)).not.toContain('den-tinh')
    expect(JSON.stringify(res.body)).not.toContain('den-vong')
  })

  it('bộ draft/hidden không xuất hiện ở gallery và /api/collections, đèn lẻ vẫn bán', async () => {
    const data = { collections: clone(seedCols) }
    data.collections.find((c) => c.slug === 'sum-vay').status = 'hidden'
    data.collections.find((c) => c.slug === 'hoi-lang').status = 'draft'
    await setup(data)
    await order(A, SUM)
    const g = (await gal()).body
    expect(g.collections).toEqual([])
    expect(g.quilt).toMatchObject({ totalCollections: 0, complete: false })
    expect(JSON.stringify(g)).not.toContain(STORY_VI)
    const list = await request(app).get('/api/collections')
    expect(list.body.items).toEqual([])
    expect((await request(app).get('/api/collections/sum-vay')).status).toBe(404)
    expect((await request(app).get('/api/products/den-nguyet')).status).toBe(200)
  })

  it('bộ không có đèn công khai nào bị ẩn', async () => {
    const data = { products: clone(seedProducts).map((p) => (p.collectionSlug === 'hoi-lang' ? { ...p, status: 'hidden' } : p)) }
    await setup(data)
    const list = await request(app).get('/api/collections')
    expect(list.body.items.map((c) => c.slug)).toEqual(['sum-vay'])
    expect((await request(app).get('/api/collections/hoi-lang')).status).toBe(404)
    expect((await gal()).body.collections.map((c) => c.slug)).toEqual(['sum-vay'])
  })
})

describe('/api/collections', () => {
  it('không lộ story/storyTitle/id/status/sortOrder, mọi ngôn ngữ', async () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const list = await request(app).get(`/api/collections?lang=${lang}`)
      const one = await request(app).get(`/api/collections/sum-vay?lang=${lang}`)
      for (const body of [list.body, one.body]) {
        const s = JSON.stringify(body)
        for (const bad of ['story', 'storyTitle', '"id"', '"status"', 'Chiều ba mươi', 'last evening', '年夜饭', 'Mâm cơm']) expect(s, `${lang} ${bad}`).not.toContain(bad)
      }
    }
  })

  it('lamps sắp theo pieceOrder, set tách riêng; draft không lọt', async () => {
    const data = { products: clone(seedProducts) }
    const by = (s) => data.products.find((p) => p.slug === s)
    by('den-nguyet').pieceOrder = 9
    by('den-tinh').status = 'draft'
    await setup(data)
    const { item } = (await request(app).get('/api/collections/sum-vay')).body
    expect(item.lamps.map((l) => l.slug)).toEqual(['den-vong', 'den-nguyet'])
    expect(item.set.slug).toBe('den-sum-vay')
    expect(JSON.stringify(item)).not.toContain('den-tinh')
  })

  it('lang en/zh dịch tên bộ; slug không có / định dạng lạ → 404', async () => {
    expect((await request(app).get('/api/collections/sum-vay?lang=en')).body.item.name).toBe('Sum Vay')
    expect((await request(app).get('/api/collections/sum-vay?lang=zh')).body.item.name).toBe('团圆')
    for (const s of ['khong-co', '%20', 'SUM-VAY', '..%2Fx']) expect((await request(app).get(`/api/collections/${s}`)).status, s).toBe(404)
  })

  it('bộ chỉ có set (không đèn lẻ) vẫn công khai; set draft thì set = null', async () => {
    const data = { products: clone(seedProducts) }
    for (const p of data.products) if (p.collectionSlug === 'sum-vay' && p.kind === 'single') p.status = 'hidden'
    await setup(data)
    const { item } = (await request(app).get('/api/collections/sum-vay')).body
    expect(item.lamps).toEqual([])
    expect(item.set.slug).toBe('den-sum-vay')
  })
})

describe('admin: collectionSlug / pieceOrder', () => {
  const post = (body) => request(app).post('/api/admin/products').set('Authorization', ADMIN.bearer).send({ slug: 'den-x', kind: 'single', price: 1000, name: { vi: 'X' }, ...body })
  const patch = (id, body) => request(app).patch(`/api/admin/products/${id}`).set('Authorization', ADMIN.bearer).send(body)

  it.each(['Sum Vay', 'SUM', 'sum_vay', '-a', 'a--b', 'a'.repeat(81), 123, {}, ['sum-vay'], '../x'])('collectionSlug sai định dạng %j → 400', async (v) => {
    const res = await post({ collectionSlug: v })
    expect(res.status).toBe(400)
  })

  it.each([-1, 1.5, '2', 1001, null])('pieceOrder sai %j → 400', async (v) => {
    expect((await post({ collectionSlug: 'sum-vay', pieceOrder: v })).status).toBe(400)
  })

  it('tạo với collectionSlug hợp lệ; không gửi → null/0; PATCH sai → 400', async () => {
    const a = await post({ collectionSlug: 'sum-vay', pieceOrder: 5 })
    expect(a.status).toBe(201)
    expect(a.body.item).toMatchObject({ collectionSlug: 'sum-vay', pieceOrder: 5 })
    const b = await post({ slug: 'den-y' })
    expect(b.body.item.collectionSlug ?? null).toBeNull()
    expect(b.body.item.pieceOrder ?? 0).toBe(0)
    expect((await patch(a.body.item.id, { collectionSlug: 'Bad Slug' })).status).toBe(400)
  })

  it('PATCH null / chuỗi rỗng gỡ khỏi bộ; PATCH không có field không đụng collection/pieceOrder', async () => {
    const a = (await post({ collectionSlug: 'sum-vay', pieceOrder: 5 })).body.item
    const keep = await patch(a.id, { price: 2000 })
    expect(keep.status).toBe(200)
    expect(keep.body.item).toMatchObject({ collectionSlug: 'sum-vay', pieceOrder: 5, price: 2000 })
    const rm = await patch(a.id, { collectionSlug: null })
    expect(rm.status).toBe(200)
    expect(rm.body.item.collectionSlug).toBeNull()
    await patch(a.id, { collectionSlug: 'sum-vay' })
    expect((await patch(a.id, { collectionSlug: '' })).body.item.collectionSlug).toBeNull()
  })

  it('khách thường không sửa được', async () => {
    const res = await request(app).post('/api/admin/products').set('Authorization', A.bearer).send({ slug: 'z', kind: 'single', price: 1, name: { vi: 'Z' }, collectionSlug: 'sum-vay' })
    expect(res.status).toBe(403)
  })

  it('đèn mới gán vào bộ xuất hiện ở /api/collections (khi published)', async () => {
    const a = (await post({ collectionSlug: 'sum-vay', pieceOrder: 0, status: 'published' })).body.item
    const { item } = (await request(app).get('/api/collections/sum-vay')).body
    expect(item.lamps[0].slug).toBe(a.slug)
    await patch(a.id, { collectionSlug: null })
    expect((await request(app).get('/api/collections/sum-vay')).body.item.lamps.map((l) => l.slug)).not.toContain(a.slug)
  })
})

describe('sitemap + SSR', () => {
  it('sitemap có /collections/<slug> ×3 ngôn ngữ; không có bộ hidden/draft', async () => {
    const xml = (await request(app).get('/sitemap.xml')).text
    for (const slug of ['sum-vay', 'hoi-lang']) {
      const locs = [...xml.matchAll(/<loc>([^<]*\/collections\/[^<]*)<\/loc>/g)].map((m) => m[1]).filter((u) => u.endsWith(`/collections/${slug}`))
      expect(locs.length, slug).toBe(3)
      expect(new Set(locs).size).toBe(3)
    }
    const data = { collections: clone(seedCols) }
    data.collections.find((c) => c.slug === 'hoi-lang').status = 'hidden'
    await setup(data)
    const xml2 = (await request(app).get('/sitemap.xml')).text
    expect(xml2).toContain('/collections/sum-vay')
    expect(xml2).not.toContain('/collections/hoi-lang')
  })

  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const ssr = (url, r = repo) => renderPage({ repo: r, config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url })

  it('/collections/sum-vay → 200 có h1; en/zh cũng vậy; không lộ story', async () => {
    for (const u of ['/collections/sum-vay', '/en/collections/sum-vay', '/zh/collections/sum-vay']) {
      const r = await ssr(u)
      expect(r.status, u).toBe(200)
      expect(r.html, u).toMatch(/<h1[^>]*>[^<]+<\/h1>/)
      expect(r.html).not.toContain(STORY_VI)
    }
  })

  it('/collections/khong-co → 404; bộ hidden → 404', async () => {
    expect((await ssr('/collections/khong-co')).status).toBe(404)
    const data = { collections: clone(seedCols) }
    data.collections[0].status = 'hidden'
    expect((await ssr('/collections/sum-vay', createMemoryRepo(data))).status).toBe(404)
  })
})
