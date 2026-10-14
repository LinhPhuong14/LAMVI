import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMessageService } from './messages/service.js'
import { STORY_MAX, validateProduct } from './domain/admin.js'
import { presentProduct } from './domain/catalog.js'
import { collections, products } from './data/seed.js'

// G-108, D-105: trang kể chuyện theo từng mẫu đèn (QR trên thiệp cảm ơn → câu chuyện mẫu → lời chúc)
const realRepo = () => createMemoryRepo({ products, collections })
const makeApp = (repo = realRepo(), auth = createMemoryAuth()) =>
  createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })

describe('validateProduct — story', () => {
  const v = (story) => validateProduct({ story }, { partial: true })
  it('null/rỗng → null; nhận nhiều đoạn', () => {
    expect(v(null).values.story).toBeNull()
    expect(v({ vi: '  ' }).values.story).toBeNull()
    expect(v({ vi: 'Đoạn 1\n\nĐoạn 2' }).values.story).toEqual({ vi: 'Đoạn 1\n\nĐoạn 2' })
  })
  it('kiểu sai, ngôn ngữ lạ, thiếu tiếng Việt, quá dài → lỗi', () => {
    expect(v('abc').errors.story).toBe('INVALID')
    expect(v([]).errors.story).toBe('INVALID')
    expect(v({ fr: 'x' }).errors.story).toBe('INVALID')
    expect(v({ en: 'only en' }).errors.story).toBe('VI_REQUIRED')
    expect(v({ vi: 'x'.repeat(STORY_MAX + 1) }).errors.story).toBe('TOO_LONG')
    expect(v({ vi: 'x'.repeat(STORY_MAX) }).errors.story).toBeUndefined()
  })
})

describe('presentProduct — story chỉ ở trang chi tiết', () => {
  const p = { slug: 'a', name: { vi: 'A' }, story: { vi: 'Viet', en: 'Eng' } }
  it('mặc định không có khoá story (danh sách/giỏ/đơn nhẹ payload)', () => {
    expect('story' in presentProduct(p, 'vi')).toBe(false)
  })
  it('withStory: chọn ngôn ngữ, rơi về vi, null khi chưa nhập', () => {
    expect(presentProduct(p, 'en', { withStory: true }).story).toBe('Eng')
    expect(presentProduct(p, 'zh', { withStory: true }).story).toBe('Viet')
    expect(presentProduct({ ...p, story: null }, 'vi', { withStory: true }).story).toBeNull()
  })
})

describe('API công khai', () => {
  it('chi tiết đèn trả câu chuyện theo ngôn ngữ; danh sách thì không', async () => {
    const app = makeApp()
    for (const [lang, needle] of [['vi', 'Có những mùa quả ngọt'], ['en', 'Some sweet harvests'], ['zh', '有些甜美的收成']]) {
      const r = await request(app).get(`/api/products/den-thu-hoach?lang=${lang}`)
      expect(r.status).toBe(200)
      expect(r.body.item.story).toContain(needle)
      expect(r.body.item.story.split(/\n{2,}/).length).toBeGreaterThanOrEqual(3)
    }
    const list = await request(app).get('/api/products')
    expect(list.body.items).toHaveLength(5)
    for (const it of list.body.items) expect('story' in it).toBe(false)
    expect(JSON.stringify((await request(app).get('/api/collections')).body)).not.toContain('Có những mùa quả ngọt')
  })

  it('đèn nháp không lộ câu chuyện (404)', async () => {
    const repo = createMemoryRepo({ products: products.map((p) => (p.slug === 'den-lon-dan' ? { ...p, status: 'draft' } : p)), collections })
    const r = await request(makeApp(repo)).get('/api/products/den-lon-dan')
    expect(r.status).toBe(404)
    expect(JSON.stringify(r.body)).not.toContain('Âm Dương')
  })
})

describe('Seed thật có câu chuyện cho cả 5 đèn', () => {
  it('đủ vi/en/zh, các đoạn cách nhau dòng trống, trong giới hạn', () => {
    expect(products).toHaveLength(5)
    for (const p of products) {
      for (const l of ['vi', 'en', 'zh']) {
        const t = p.story[l]
        expect(t?.trim(), `${p.slug}.${l}`).toBeTruthy()
        expect(t.length).toBeLessThanOrEqual(STORY_MAX)
        expect(t.split(/\n{2,}/).length).toBeGreaterThanOrEqual(3)
      }
    }
  })
  it('không còn ý "QR khắc trên đèn" và không bịa số liệu', () => {
    const all = products.flatMap((p) => Object.values(p.story)).join('\n')
    expect(all).not.toMatch(/khắc (mã|QR)|engraved|刻(上|有|在)?二维码/i)
  })
})

describe('API admin: lưu câu chuyện', () => {
  it('PATCH story → khách thấy; xoá bằng null; lỗi 400 khi quá dài', async () => {
    const repo = realRepo()
    const auth = createMemoryAuth()
    const { user } = await auth.signUp({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'Ad', role: 'admin' })
    const token = `Bearer ${(await auth.signIn({ email: 'ad@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    const app = makeApp(repo, auth)
    const p = (await repo.listProducts({ publishedOnly: true })).find((x) => x.slug === 'den-tu-linh')
    const patch = (body) => request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', token).send(body)
    expect((await patch({ story: { vi: 'x'.repeat(STORY_MAX + 1) } })).status).toBe(400)
    expect((await patch({ story: { en: 'only english' } })).status).toBe(400)
    const ok = await patch({ story: { vi: 'Đoạn một.\n\nĐoạn hai.', en: 'Para one.\n\nPara two.' } })
    expect(ok.status).toBe(200)
    expect((await request(app).get('/api/products/den-tu-linh')).body.item.story).toBe('Đoạn một.\n\nĐoạn hai.')
    expect((await request(app).get('/api/products/den-tu-linh?lang=en')).body.item.story).toBe('Para one.\n\nPara two.')
    expect((await request(app).get('/api/products/den-tu-linh?lang=zh')).body.item.story).toBe('Đoạn một.\n\nĐoạn hai.')
    expect((await patch({ story: null })).status).toBe(200)
    expect((await request(app).get('/api/products/den-tu-linh')).body.item.story).toBeNull()
  })
})

describe('MessageService.view — lamps (QR trên thiệp mở câu chuyện trước lời chúc)', () => {
  const now = new Date('2026-10-14T00:00:00Z')
  const P = {
    'den-thu-hoach': { slug: 'den-thu-hoach', name: { vi: 'Đèn Thu Hoạch', en: 'Harvest' }, description: { vi: 'Mô tả' }, story: { vi: 'Truyện 1\n\nTruyện 2', en: 'Story 1' }, tone: 'amber', imageUrl: 'https://img/x.jpg', imageAlt: { vi: 'Ảnh' }, status: 'hidden' },
    'den-lon-dan': { slug: 'den-lon-dan', name: { vi: 'Đèn Lợn Đàn' }, description: { vi: 'Mô tả 2' }, story: null, tone: 'dusk', status: 'published' },
  }
  function view(items, { lang = 'vi', message = { text: 'Chúc mừng', textLang: 'vi', confirmedAt: now.toISOString() } } = {}) {
    const repo = {
      getOrderByQrToken: async () => ({ id: 'o1', status: 'delivered', orderKind: 'gift', hasMessage: true, qrLang: lang, deliveredAt: now.toISOString(), items }),
      getGiftMessage: async () => message,
      listBatches: async () => [],
      getProductBySlug: async (slug) => P[slug] ?? null,
    }
    return createMessageService({ repo, storage: { signedUrl: async () => 'u', removeObject: async () => {} }, now: () => now }).view('a'.repeat(64))
  }

  it('trả mỗi mẫu đèn trong đơn: tên, mô tả, câu chuyện, ảnh — kể cả đèn đã bị ẩn', async () => {
    const item = await view([{ slug: 'den-thu-hoach' }, { slug: 'den-lon-dan' }])
    expect(item.lamps.map((l) => l.slug)).toEqual(['den-thu-hoach', 'den-lon-dan'])
    expect(item.lamps[0]).toMatchObject({ name: 'Đèn Thu Hoạch', story: 'Truyện 1\n\nTruyện 2', image: { url: 'https://img/x.jpg', alt: 'Ảnh' } })
    // đèn không có ảnh admin → ảnh mặc định từ fanpage (server/domain/photos.js)
    expect(item.lamps[1]).toMatchObject({ story: null, image: { url: '/images/lamps/lon-dan.jpg', alt: 'Đèn Lợn Đàn' }, description: 'Mô tả 2' })
  })
  it('theo ngôn ngữ trang lời chúc (qrLang), rơi về tiếng Việt', async () => {
    const item = await view([{ slug: 'den-thu-hoach' }, { slug: 'den-lon-dan' }], { lang: 'en' })
    expect(item.lamps[0]).toMatchObject({ name: 'Harvest', story: 'Story 1' })
    expect(item.lamps[1].name).toBe('Đèn Lợn Đàn')
  })
  it('gộp dòng hàng trùng slug, bỏ slug không còn trong DB, giới hạn 10 mẫu', async () => {
    const dup = await view([{ slug: 'den-lon-dan' }, { slug: 'den-lon-dan' }, { slug: 'khong-co' }, {}])
    expect(dup.lamps.map((l) => l.slug)).toEqual(['den-lon-dan'])
    const many = await view(Array.from({ length: 30 }, (_, i) => ({ slug: i % 2 ? 'den-lon-dan' : `x${i}` })))
    expect(many.lamps.length).toBeLessThanOrEqual(10)
    expect((await view(undefined)).lamps).toEqual([])
  })
  it('lời chúc trống vẫn có câu chuyện; chưa xác nhận (greeting) thì chưa lộ gì', async () => {
    const empty = await view([{ slug: 'den-thu-hoach' }], { message: { text: null, confirmedAt: now.toISOString() } })
    expect(empty.lamps).toHaveLength(1)
    const greeting = await view([{ slug: 'den-thu-hoach' }], { message: { text: 'x', confirmedAt: null } })
    expect(greeting).toEqual({ state: 'greeting', lang: 'vi', orderKind: 'gift' })
  })
})
