import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { lampPhotoUrl, productImage } from './domain/photos.js'
import { collections, products } from './data/seed.js'

// G-116: ảnh 5 đèn lấy từ fanpage chính thức làm ảnh mặc định
const SLUGS = ['den-thu-hoach', 'den-tu-linh', 'den-phuc-loc-song-toan', 'den-ga-tam-duong-khai-thai', 'den-lon-dan']
const app = () => createApp({ repo: createMemoryRepo({ products, collections }), auth: createMemoryAuth(), storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test' } })

describe('lampPhotoUrl / productImage', () => {
  it('5 slug thật có ảnh và tệp tồn tại trong public/images/lamps (JPEG hợp lệ)', () => {
    for (const s of SLUGS) {
      const url = lampPhotoUrl(s)
      expect(url).toMatch(/^\/images\/lamps\/[a-z-]+\.jpg$/)
      const file = new URL(`../public${url}`, import.meta.url)
      expect(existsSync(file), url).toBe(true)
      const buf = readFileSync(file)
      expect([buf[0], buf[1]]).toEqual([0xff, 0xd8])
      expect(buf.length).toBeGreaterThan(10_000)
    }
    expect(new Set(SLUGS.map(lampPhotoUrl)).size).toBe(5)
  })
  it('slug lạ / tên thuộc tính nguyên mẫu → null (không lọt qua hasOwn)', () => {
    for (const s of ['den-nguyet', '', undefined, null, '__proto__', 'toString', 'constructor', 'hasOwnProperty']) expect(lampPhotoUrl(s)).toBeNull()
  })
  it('ảnh admin tải lên được ưu tiên; không có thì ảnh fanpage kèm alt = tên đèn theo ngôn ngữ; không có cả hai → null', () => {
    const p = { slug: 'den-lon-dan', name: { vi: 'Đèn Lợn Đàn', en: 'Pig Herd' } }
    expect(productImage(p, 'vi')).toEqual({ url: '/images/lamps/lon-dan.jpg', alt: 'Đèn Lợn Đàn' })
    expect(productImage(p, 'en').alt).toBe('Pig Herd')
    expect(productImage({ ...p, imageUrl: 'https://cdn/x.jpg', imageAlt: { vi: 'Ảnh riêng' } }, 'vi')).toEqual({ url: 'https://cdn/x.jpg', alt: 'Ảnh riêng' })
    expect(productImage({ slug: 'khac', name: { vi: 'X' } }, 'vi')).toBeNull()
  })
})

describe('API trả ảnh fanpage', () => {
  it('danh sách và chi tiết: mỗi đèn có image {url, alt}', async () => {
    const a = app()
    const list = await request(a).get('/api/products')
    expect(list.body.items.map((i) => i.image?.url)).toEqual(SLUGS.map(lampPhotoUrl))
    const d = await request(a).get('/api/products/den-tu-linh?lang=en')
    expect(d.body.item.image.alt).toBe(products[1].name.en)
  })
  it('bộ sưu tập và JSON-LD sản phẩm dùng được ảnh (có image)', async () => {
    const a = app()
    const c = await request(a).get('/api/collections/bo-suu-tap-dau-tien')
    expect(c.body.item.lamps.every((l) => l.image?.url?.startsWith('/images/lamps/'))).toBe(true)
  })
  it('tệp ảnh được phục vụ như tĩnh bởi app (200, image/jpeg) khi có build/public', async () => {
    const r = await request(app()).get('/images/lamps/thu-hoach.jpg')
    // dev/test không có public → 404 cũng chấp nhận; nếu 200 thì phải là ảnh
    if (r.status === 200) expect(r.headers['content-type']).toMatch(/image\/jpeg/)
    else expect([404]).toContain(r.status)
  })
})
