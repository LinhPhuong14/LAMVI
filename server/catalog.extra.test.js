import { readFileSync } from 'node:fs'
import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { products, faqEntries, demoBatches } from './data/seed.js'
import { pick, normalizeLang } from './i18n.js'
import { isBatchPublic } from './domain/catalog.js'

const makeApp = (data) => createApp({ repo: createMemoryRepo(data) })

const expectErrorShape = (res, status, code) => {
  expect(res.status).toBe(status)
  expect(res.headers['content-type']).toMatch(/application\/json/)
  expect(Object.keys(res.body)).toEqual(['error'])
  expect(res.body.error.code).toBe(code)
  expect(typeof res.body.error.message).toBe('string')
}

afterEach(() => vi.restoreAllMocks())

describe('Sản phẩm — edge case', () => {
  it('không lộ trường nội bộ (id, status, sortOrder) ở danh sách và chi tiết', async () => {
    const app = makeApp()
    const list = await request(app).get('/api/products')
    const detail = await request(app).get('/api/products/den-nguyet')
    for (const item of [...list.body.items, detail.body.item]) {
      expect(Object.keys(item).sort()).toEqual(
        ['badge', 'currency', 'description', 'kind', 'name', 'price', 'slug', 'tone'].sort(),
      )
    }
  })

  it('FR-CAT-001: sắp xếp theo sortOrder, không theo thứ tự nhập', async () => {
    const data = {
      products: [
        { ...products[0], sortOrder: 30 },
        { ...products[1], sortOrder: 10 },
        { ...products[2], sortOrder: 20 },
      ],
    }
    const res = await request(makeApp(data)).get('/api/products')
    expect(res.body.items.map((p) => p.slug)).toEqual(['den-vong', 'den-sum-vay', 'den-nguyet'])
  })

  it('D-39: trạng thái viết hoa/lạ (vd "Published", "archived") không được coi là published', async () => {
    const data = {
      products: [
        { ...products[0], status: 'Published' },
        { ...products[1], status: 'archived' },
        { ...products[2], status: undefined },
      ],
    }
    const app = makeApp(data)
    expect((await request(app).get('/api/products')).body.items).toEqual([])
    for (const slug of ['den-nguyet', 'den-vong', 'den-sum-vay']) {
      expect((await request(app).get(`/api/products/${slug}`)).status).toBe(404)
    }
  })

  it('D-39: sản phẩm hidden/draft → 404 cùng định dạng với slug không tồn tại', async () => {
    const data = { products: [{ ...products[0], status: 'hidden' }, { ...products[1], status: 'draft' }] }
    const app = makeApp(data)
    const a = await request(app).get('/api/products/den-nguyet')
    const b = await request(app).get('/api/products/den-vong')
    const c = await request(app).get('/api/products/khong-ton-tai')
    expectErrorShape(a, 404, 'NOT_FOUND')
    expect(a.body).toEqual(c.body)
    expect(b.body).toEqual(c.body)
  })

  it('danh sách rỗng → 200 { items: [] }', async () => {
    const res = await request(makeApp({ products: [] })).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [] })
  })

  it.each([
    ['Đèn-Nguyệt (unicode)', '/api/products/%C4%90%C3%A8n-Nguy%E1%BB%87t'],
    ['khoảng trắng', '/api/products/den%20nguyet'],
    ['chữ hoa', '/api/products/DEN-NGUYET'],
    ['ký tự SQL', "/api/products/den-nguyet'%20or%201=1--"],
    ['dấu chấm', '/api/products/..'],
    ['slug rất dài', `/api/products/${'a'.repeat(2000)}`],
  ])('slug lạ (%s) → 404 NOT_FOUND, không lỗi 500', async (_label, url) => {
    const res = await request(makeApp()).get(url)
    expectErrorShape(res, 404, 'NOT_FOUND')
  })

  it('slug percent-encoding hỏng (%E0%A4%A) → lỗi 4xx JSON, không phải 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(makeApp()).get('/api/products/%E0%A4%A')
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
    expect(res.body.error).toBeDefined()
  })

  it('slug có dấu "/" mã hóa (%2F) → 404', async () => {
    const res = await request(makeApp()).get('/api/products/den%2Fnguyet')
    expectErrorShape(res, 404, 'NOT_FOUND')
  })

  it('giá là số nguyên, currency luôn VND (T-09)', async () => {
    const res = await request(makeApp()).get('/api/products')
    for (const p of res.body.items) {
      expect(Number.isInteger(p.price)).toBe(true)
      expect(p.currency).toBe('VND')
    }
    expect(res.body.items.map((p) => p.price)).toEqual([890000, 1050000, 1680000])
  })
})

describe('Ngôn ngữ (D-37, D-40, NFR-L10N-001)', () => {
  it.each([
    ['?lang=', 'Đèn Nguyệt'],
    ['?lang=en&lang=zh', 'Đèn Nguyệt'],
    ['?lang[x]=en', 'Đèn Nguyệt'],
    ['?lang=EN', 'Đèn Nguyệt'],
    ['?lang=%20en', 'Đèn Nguyệt'],
    ['?lang=zh-Hans', 'Đèn Nguyệt'],
    ['?lang=en', 'Nguyet Lantern'],
    ['?lang=zh', '月灯'],
    ['?lang=vi', 'Đèn Nguyệt'],
  ])('lang %s → %s, không lỗi', async (qs, expected) => {
    const res = await request(makeApp()).get(`/api/products/den-nguyet${qs}`)
    expect(res.status).toBe(200)
    expect(res.body.item.name).toBe(expected)
  })

  it('badge null giữ null ở mọi ngôn ngữ', async () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const res = await request(makeApp()).get(`/api/products/den-nguyet?lang=${lang}`)
      expect(res.body.item.badge).toBeNull()
    }
  })

  it('D-40: badge chỉ có vi → lang=zh hiện tiếng Việt', async () => {
    const data = { products: [{ ...products[0], badge: { vi: 'Mới' } }] }
    const res = await request(makeApp(data)).get('/api/products/den-nguyet?lang=zh')
    expect(res.body.item.badge).toBe('Mới')
  })

  it('D-40: bản dịch rỗng "" → dùng tiếng Việt', async () => {
    const data = { products: [{ ...products[0], name: { vi: 'Đèn Nguyệt', en: '' } }] }
    const res = await request(makeApp(data)).get('/api/products/den-nguyet?lang=en')
    expect(res.body.item.name).toBe('Đèn Nguyệt')
  })

  it('D-40: FAQ thiếu bản zh → câu hỏi/trả lời tiếng Việt', async () => {
    const data = {
      faqEntries: [{ id: 'f1', sortOrder: 1, isPublished: true, question: { vi: 'Hỏi?', en: 'Q?' }, answer: { vi: 'Đáp' } }],
    }
    const res = await request(makeApp(data)).get('/api/faq?lang=zh')
    expect(res.body.items[0]).toMatchObject({ question: 'Hỏi?', answer: 'Đáp' })
  })

  it('pick / normalizeLang (hàm thuần)', () => {
    expect(pick(undefined, 'en')).toBeNull()
    expect(pick('chuỗi thuần', 'en')).toBe('chuỗi thuần')
    expect(pick({}, 'en')).toBeNull()
    expect(pick({ en: 'only en' }, 'zh')).toBeNull()
    expect(normalizeLang(['en', 'zh'])).toBe('vi')
    expect(normalizeLang(undefined)).toBe('vi')
    expect(normalizeLang('zh')).toBe('zh')
  })

  it('lô: title thiếu bản dịch en → tiếng Việt; story null giữ null', async () => {
    const data = { batches: [{ ...demoBatches[0], title: { vi: 'Lô A' }, story: null }] }
    const res = await request(makeApp(data)).get('/api/batches/DEMO-2026-01?lang=en')
    expect(res.body.item).toMatchObject({ title: 'Lô A', story: null })
  })
})

describe('FAQ — edge case', () => {
  const faq = (id, sortOrder, isPublished) => ({
    id,
    sortOrder,
    isPublished,
    question: { vi: `Q${id}` },
    answer: { vi: `A${id}` },
  })

  it('G-07: FAQ is_published=false bị ẩn', async () => {
    const data = { faqEntries: [faq('a', 1, true), faq('b', 2, false), faq('c', 3, true)] }
    const res = await request(makeApp(data)).get('/api/faq')
    expect(res.body.items.map((f) => f.id)).toEqual(['a', 'c'])
  })

  it('FAQ sắp xếp theo sortOrder', async () => {
    const data = { faqEntries: [faq('c', 3, true), faq('a', 1, true), faq('b', 2, true)] }
    const res = await request(makeApp(data)).get('/api/faq')
    expect(res.body.items.map((f) => f.id)).toEqual(['a', 'b', 'c'])
  })

  it('FAQ không lộ sortOrder/isPublished; trả đúng 3 trường', async () => {
    const res = await request(makeApp()).get('/api/faq?lang=en')
    for (const f of res.body.items) expect(Object.keys(f).sort()).toEqual(['answer', 'id', 'question'])
    expect(res.body.items[0].question).toBe(faqEntries[0].question.en)
  })

  it('§31.3: không FAQ nào (3 ngôn ngữ) còn hứa lưu giọng nói/video "vĩnh viễn" vô điều kiện', async () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const res = await request(makeApp()).get(`/api/faq?lang=${lang}`)
      const all = res.body.items.map((f) => f.answer).join('\n')
      expect(all).toMatch(/30/)
    }
  })
})

describe('Lô (D-43, US-005, [ASSUMPTION] video_published + videoUrl)', () => {
  const batch = (over) => ({ ...demoBatches[0], ...over })

  it('status video_published nhưng videoUrl null → 404', async () => {
    const res = await request(makeApp({ batches: [batch({ videoUrl: null })] })).get('/api/batches/DEMO-2026-01')
    expectErrorShape(res, 404, 'NOT_FOUND')
  })

  it('status video_published nhưng videoUrl rỗng "" → 404', async () => {
    const res = await request(makeApp({ batches: [batch({ videoUrl: '' })] })).get('/api/batches/DEMO-2026-01')
    expectErrorShape(res, 404, 'NOT_FOUND')
  })

  it('status created nhưng đã có videoUrl → vẫn 404', async () => {
    const res = await request(makeApp({ batches: [batch({ status: 'created' })] })).get('/api/batches/DEMO-2026-01')
    expectErrorShape(res, 404, 'NOT_FOUND')
  })

  it('lô chưa công khai và lô không tồn tại trả body giống hệt nhau (không lộ sự tồn tại)', async () => {
    const app = makeApp()
    const a = await request(app).get('/api/batches/DEMO-2026-02')
    const b = await request(app).get('/api/batches/KHONG-CO')
    expect(a.status).toBe(b.status)
    expect(a.body).toEqual(b.body)
  })

  it('không lộ id/status của lô; trả đúng các trường công khai', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026-01')
    expect(Object.keys(res.body.item).sort()).toEqual(['code', 'producedOn', 'story', 'title', 'videoUrl'])
  })

  it('D-43: mã lô khớp chính xác (không khớp tiền tố)', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026')
    expect(res.status).toBe(404)
  })

  it('US-005 AC-001: truy cập lô không cần header xác thực, có cookie/Authorization rác vẫn 200', async () => {
    const res = await request(makeApp())
      .get('/api/batches/DEMO-2026-01')
      .set('Authorization', 'Bearer rac')
      .set('Cookie', 'sb=rac')
    expect(res.status).toBe(200)
  })

  it('isBatchPublic (hàm thuần)', () => {
    expect(isBatchPublic({ status: 'video_published', videoUrl: 'https://x' })).toBe(true)
    expect(isBatchPublic({ status: 'video_published', videoUrl: null })).toBe(false)
    expect(isBatchPublic({ status: 'VIDEO_PUBLISHED', videoUrl: 'https://x' })).toBe(false)
  })
})

describe('Adapter bộ nhớ — trả bản sao', () => {
  it('sửa kết quả listProducts/getProductBySlug không làm đổi dữ liệu repo', async () => {
    const repo = createMemoryRepo()
    const list = await repo.listProducts()
    list[0].name.vi = 'BỊ SỬA'
    list[0].status = 'hidden'
    list.pop()
    const one = await repo.getProductBySlug('den-vong')
    one.price = 1
    const again = await repo.listProducts()
    expect(again).toHaveLength(3)
    expect(again[0].name.vi).toBe('Đèn Nguyệt')
    expect(again[0].status).toBe('published')
    expect((await repo.getProductBySlug('den-vong')).price).toBe(1050000)
  })

  it('sửa kết quả listFaq/getBatchByCode không làm đổi dữ liệu repo', async () => {
    const repo = createMemoryRepo()
    const faq = await repo.listFaq()
    faq[0].isPublished = false
    faq[0].answer.vi = 'x'
    const b = await repo.getBatchByCode('DEMO-2026-01')
    b.videoUrl = null
    expect((await repo.listFaq())[0]).toMatchObject({ isPublished: true, answer: faqEntries[0].answer })
    expect((await repo.getBatchByCode('DEMO-2026-01')).videoUrl).toBe(demoBatches[0].videoUrl)
  })

  it('không làm thay đổi dữ liệu seed truyền vào (kể cả thứ tự)', async () => {
    const input = [{ ...products[2], sortOrder: 9 }, products[0]]
    const snapshot = structuredClone(input)
    const repo = createMemoryRepo({ products: input })
    await repo.listProducts()
    ;(await repo.listProducts())[0].slug = 'x'
    expect(input).toEqual(snapshot)
    expect(products[0].name.vi).toBe('Đèn Nguyệt')
  })

  it('listProducts không truyền statuses → trả tất cả (dùng cho admin)', async () => {
    const repo = createMemoryRepo({ products: [{ ...products[0], status: 'draft' }, products[1]] })
    expect(await repo.listProducts()).toHaveLength(2)
    expect(await repo.listProducts({ statuses: ['published'] })).toHaveLength(1)
  })
})

describe('Định dạng lỗi {error:{code,message}}', () => {
  it('repo ném lỗi (vd lỗi Supabase) → 500 INTERNAL_ERROR, không lộ thông điệp gốc', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.listProducts = async () => {
      throw Object.assign(new Error('relation "products" does not exist'), { code: '42P01' })
    }
    const res = await request(createApp({ repo })).get('/api/products')
    expectErrorShape(res, 500, 'INTERNAL_ERROR')
    expect(JSON.stringify(res.body)).not.toContain('relation')
    expect(JSON.stringify(res.body)).not.toContain('42P01')
  })

  it('JSON hỏng → 400 INVALID_JSON', async () => {
    const res = await request(makeApp()).post('/api/faq').set('Content-Type', 'application/json').send('{hong')
    expectErrorShape(res, 400, 'INVALID_JSON')
  })

  it('body quá 100kb → 413 JSON, không phải 500', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const res = await request(makeApp())
      .post('/api/faq')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ a: 'x'.repeat(200_000) }))
    expect(res.status).toBe(413)
    expect(res.body.error.code).toBeDefined()
  })

  it('phương thức không hỗ trợ (POST/DELETE /api/products) → 404 JSON', async () => {
    const app = makeApp()
    expectErrorShape(await request(app).post('/api/products'), 404, 'NOT_FOUND')
    expectErrorShape(await request(app).delete('/api/products/den-nguyet'), 404, 'NOT_FOUND')
  })

  it('không có header X-Powered-By; /api/health ok', async () => {
    const res = await request(makeApp()).get('/api/health')
    expect(res.body).toEqual({ ok: true })
    expect(res.headers['x-powered-by']).toBeUndefined()
  })
})

describe('Migration SQL (D-39, D-43)', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20260928000001_init.sql', import.meta.url), 'utf8')
  const table = (name) => sql.match(new RegExp(`create table public\\.${name} \\(([\\s\\S]*?)\\n\\);`))[1]

  it('D-39: products.status chỉ draft/published/hidden, mặc định draft; slug unique', () => {
    const t = table('products')
    expect(t).toMatch(/status text not null default 'draft' check \(status in \('draft', 'published', 'hidden'\)\)/)
    expect(t).toMatch(/slug text not null unique/)
    expect(t).toMatch(/price_excl_vat integer not null check \(price_excl_vat >= 0\)/)
  })

  it('D-43: batches.code unique; video_published bắt buộc có video_url', () => {
    const t = table('batches')
    expect(t).toMatch(/code text not null unique/)
    expect(t).toMatch(/check \(status in \('created', 'video_published'\)\)/)
    expect(t).toMatch(/check \(status <> 'video_published' or coalesce\(video_url, ''\) <> ''\)/)
  })

  it('FAQ có is_published; bật RLS cho mọi bảng', () => {
    expect(table('faq_entries')).toMatch(/is_published boolean not null/)
    for (const name of ['products', 'faq_entries', 'batches', 'profiles']) {
      expect(sql).toContain(`alter table public.${name} enable row level security;`)
      expect(sql).toMatch(new RegExp(`create table public\\.${name} `))
    }
  })

  it('seed.js tuân thủ ràng buộc migration (status, kind, giá nguyên ≥ 0, slug/code duy nhất)', () => {
    for (const p of products) {
      expect(['draft', 'published', 'hidden']).toContain(p.status)
      expect(['single', 'set']).toContain(p.kind)
      expect(Number.isInteger(p.price) && p.price >= 0).toBe(true)
    }
    expect(new Set(products.map((p) => p.slug)).size).toBe(products.length)
    for (const b of demoBatches) {
      expect(['created', 'video_published']).toContain(b.status)
      if (b.status === 'video_published') expect(b.videoUrl).toBeTruthy()
    }
    expect(new Set(demoBatches.map((b) => b.code)).size).toBe(demoBatches.length)
  })
})
