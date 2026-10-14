// Kiểm thử độc lập (T-11) cho ảnh đèn tách nền (T-87, D-107): tệp, tỉ lệ, không rò vào og:image/JSON-LD, ảnh admin không bị đè
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { collections, products } from './data/seed.js'
import { lampCutoutUrl, productImage } from './domain/photos.js'

const pub = join(import.meta.dirname, '..', 'public')
const SLUGS = ['den-thu-hoach', 'den-tu-linh', 'den-phuc-loc-song-toan', 'den-ga-tam-duong-khai-thai', 'den-lon-dan']
const mkApp = (prods = products) =>
  createApp({ repo: createMemoryRepo({ products: prods, collections }), auth: createMemoryAuth(), storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })

// kích thước WebP: VP8X (canvas 24 bit) hoặc VP8L (14 bit)
const webpSize = (file) => {
  const b = readFileSync(file)
  if (b.toString('ascii', 8, 12) !== 'WEBP') return null
  const fmt = b.toString('ascii', 12, 16)
  if (fmt === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3), alpha: !!(b[20] & 0x10) }
  if (fmt === 'VP8L') { const v = b.readUInt32LE(21); return { w: 1 + (v & 0x3fff), h: 1 + ((v >> 14) & 0x3fff), alpha: !!((v >> 28) & 1) } }
  return { w: 0, h: 0, alpha: false }
}

describe('lampCutoutUrl / productImage', () => {
  it('slug lạ hoặc trùng thuộc tính của Object → null (không rò prototype)', () => {
    for (const s of ['den-khong-co', '__proto__', 'constructor', 'toString', '', undefined]) expect(lampCutoutUrl(s)).toBeNull()
    expect(productImage({ slug: 'constructor', name: { vi: 'x' } }, 'vi')).toBeNull()
  })
  it('ảnh admin tải lên luôn thắng: không có khoá cutout', () => {
    const p = { slug: 'den-tu-linh', name: { vi: 'Tứ Linh' }, imageUrl: 'https://cdn.test/a.jpg', imageAlt: { vi: 'Alt' } }
    const img = productImage(p, 'vi')
    expect(img).toEqual({ url: 'https://cdn.test/a.jpg', alt: 'Alt' })
    expect('cutout' in img).toBe(false)
  })
})

describe('tệp cutout', () => {
  it('5 tệp WebP có alpha, tỉ lệ rộng/cao trong 0,40–0,52 (gần gợi ý 0,44 của ProductImage)', () => {
    for (const s of SLUGS) {
      const info = webpSize(join(pub, lampCutoutUrl(s)))
      expect(info, s).not.toBeNull()
      expect(info.alpha, s).toBe(true)
      const r = info.w / info.h
      expect(r, s).toBeGreaterThan(0.4)
      expect(r, s).toBeLessThan(0.52)
    }
  })
})

describe('API + SEO với seed thật', () => {
  it('cutout chỉ nằm ở image của sản phẩm; giỏ/đơn không bắt buộc, bộ sưu tập có cutout cho từng đèn', async () => {
    const app = mkApp()
    const col = await request(app).get('/api/collections/bo-suu-tap-dau-tien')
    expect(col.status).toBe(200)
    expect(col.body.item.lamps.map((l) => l.image.cutout)).toEqual(SLUGS.map(lampCutoutUrl))
    if (col.body.item.set?.image) expect(col.body.item.set.image.cutout).toBeUndefined()
  })
  it('ảnh admin trên một đèn → đèn đó không có cutout, đèn khác vẫn có', async () => {
    const prods = products.map((p) => (p.slug === 'den-tu-linh' ? { ...p, imageUrl: 'https://cdn.test/own.jpg' } : p))
    const res = await request(mkApp(prods)).get('/api/collections/bo-suu-tap-dau-tien')
    const by = Object.fromEntries(res.body.item.lamps.map((l) => [l.slug, l.image]))
    expect(by['den-tu-linh']).toEqual(expect.objectContaining({ url: 'https://cdn.test/own.jpg' }))
    expect(by['den-tu-linh'].cutout).toBeUndefined()
    expect(by['den-lon-dan'].cutout).toBe('/images/lamps/lon-dan-cutout.webp')
  })
  it('SEO (head.js, ProductPage) chỉ đọc image.url — không dùng image.cutout cho og:image/JSON-LD', () => {
    const root = join(import.meta.dirname, '..', 'src')
    for (const f of ['seo/head.js', 'pages/ProductPage.jsx']) expect(readFileSync(join(root, f), 'utf8')).not.toMatch(/image\??\.cutout/)
  })
})
