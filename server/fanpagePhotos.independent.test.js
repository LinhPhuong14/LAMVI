// Kiểm thử độc lập (T-11) cho ảnh fanpage (T-86, G-116): ảnh mặc định theo slug, ảnh admin ưu tiên, tệp tồn tại
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import request from 'supertest'
import { describe, expect, it } from 'vitest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { collections, products } from './data/seed.js'
import { lampPhotoUrl, productImage } from './domain/photos.js'
import { presentProduct } from './domain/catalog.js'

const pub = join(import.meta.dirname, '..', 'public')
const jpegSize = (file) => {
  const b = readFileSync(file)
  for (let i = 2; i < b.length; ) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xc0 && m <= 0xc3) return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return null
}
const realApp = () => {
  const repo = createMemoryRepo({ products, collections })
  const app = createApp({ repo, auth: createMemoryAuth(), storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })
  return { repo, app }
}

describe('lampPhotoUrl / productImage', () => {
  it('5 slug thật → ảnh tồn tại trên đĩa; slug lạ và khoá prototype → null', () => {
    for (const p of products.filter((x) => x.kind === 'single')) {
      const url = lampPhotoUrl(p.slug)
      expect(url, p.slug).toMatch(/^\/images\/lamps\/[a-z-]+\.jpg$/)
      expect(existsSync(join(pub, url)), url).toBe(true)
      expect(url.toLowerCase()).not.toContain('lamvi')
    }
    for (const s of ['den-khong-co', '__proto__', 'constructor', 'toString', 'hasOwnProperty', '', undefined, null]) expect(lampPhotoUrl(s)).toBeNull()
  })
  it('ảnh admin ưu tiên; chuỗi rỗng coi như chưa có; alt đúng ngôn ngữ', () => {
    const p = { slug: 'den-tu-linh', name: { vi: 'Tứ Linh', en: 'Four Sacred' }, imageUrl: 'https://cdn/x.jpg', imageAlt: { vi: 'alt vi', en: 'alt en' } }
    expect(productImage(p, 'en')).toEqual({ url: 'https://cdn/x.jpg', alt: 'alt en' })
    expect(productImage({ ...p, imageUrl: '' }, 'en')).toEqual({ url: '/images/lamps/tu-linh.jpg', alt: 'Four Sacred', cutout: '/images/lamps/tu-linh-cutout.webp' })
    expect(productImage({ ...p, slug: 'khac', imageUrl: null }, 'vi')).toBeNull()
  })
  it('presentProduct dùng ảnh mặc định, không đụng sản phẩm khác', () => {
    expect(presentProduct({ ...products[1], imageUrl: null }, 'vi').image?.url).toMatch(/^\/images\/lamps\//)
  })
})

describe('API với danh mục thật', () => {
  it('GET /api/products: mỗi đèn có ảnh mặc định, alt không rỗng; ảnh admin thắng và giữ nguyên sau khi tải lại', async () => {
    const { app, repo } = realApp()
    const list = await request(app).get('/api/products').expect(200)
    const singles = list.body.items.filter((i) => i.image)
    expect(singles.length).toBeGreaterThanOrEqual(5)
    for (const i of singles) expect(i.image.alt).toBeTruthy()
    const p = await repo.getProductBySlug('den-lon-dan')
    await repo.updateProduct(p.id, { imageUrl: 'https://cdn.lamvi.test/up.jpg', imageAlt: { vi: 'Ảnh tải lên' } })
    const one = await request(app).get('/api/products/den-lon-dan').expect(200)
    expect(one.body.item.image).toEqual({ url: 'https://cdn.lamvi.test/up.jpg', alt: 'Ảnh tải lên' })
  })
  it('giỏ khách (quote) trả ảnh mặc định cho đèn chưa có ảnh admin', async () => {
    const { app } = realApp()
    const q = await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-thu-hoach', quantity: 1 }] }).expect(200)
    expect(q.body.items[0].product.image.url).toBe('/images/lamps/thu-hoach.jpg')
  })
})

describe('Tệp ảnh', () => {
  it('kích thước đúng, tên tệp không chứa "lamvi"', () => {
    for (const d of ['lamps', 'brand', 'og']) for (const f of readdirSync(join(pub, 'images', d))) expect(f.toLowerCase(), f).not.toContain('lamvi')
    expect(jpegSize(join(pub, 'images/brand/cover-1672x800.jpg'))).toEqual({ w: 1672, h: 800 })
    expect(jpegSize(join(pub, 'images/brand/logo-round-400.jpg'))).toEqual({ w: 400, h: 400 })
    const og = PNG.sync.read(readFileSync(join(pub, 'images/og/default.png')))
    expect([og.width, og.height]).toEqual([1200, 630])
  })
  it('index.html trỏ favicon/apple-touch-icon tới tệp có thật', () => {
    const html = readFileSync(join(import.meta.dirname, '..', 'index.html'), 'utf8')
    for (const m of html.matchAll(/rel="(?:icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)) expect(existsSync(join(pub, m[1])), m[1]).toBe(true)
  })
  // G-115: bản gốc 960×540 còn dải liên hệ chưa xác nhận (địa chỉ, hotline, email) — đã chuyển sang docs/brand-source/.
  it('không phát công khai bản ảnh bìa gốc còn dải thông tin liên hệ chưa xác nhận', () => {
    expect(existsSync(join(pub, 'images/brand/cover-960.jpg'))).toBe(false)
  })
})
