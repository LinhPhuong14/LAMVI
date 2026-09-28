import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { products } from './data/seed.js'

const makeApp = (data) => createApp({ repo: createMemoryRepo(data) })

describe('GET /api/products', () => {
  it('FR-CAT-001: trả danh sách sản phẩm published, giá số nguyên VND chưa VAT', async () => {
    const res = await request(makeApp()).get('/api/products')
    expect(res.status).toBe(200)
    expect(res.body.items.map((p) => p.slug)).toEqual(['den-nguyet', 'den-vong', 'den-sum-vay'])
    expect(res.body.items[0]).toMatchObject({ name: 'Đèn Nguyệt', priceExclVat: 890000, currency: 'VND' })
  })

  it('D-39: ẩn sản phẩm draft/hidden', async () => {
    const data = {
      products: [
        { ...products[0], status: 'hidden' },
        { ...products[1], status: 'draft' },
        products[2],
      ],
    }
    const res = await request(makeApp(data)).get('/api/products')
    expect(res.body.items.map((p) => p.slug)).toEqual(['den-sum-vay'])
    expect((await request(makeApp(data)).get('/api/products/den-nguyet')).status).toBe(404)
  })

  it('FR-I18N-001 / D-40: chọn ngôn ngữ, thiếu bản dịch thì dùng tiếng Việt', async () => {
    const data = { products: [{ ...products[0], name: { vi: 'Đèn Nguyệt' } }] }
    const res = await request(makeApp(data)).get('/api/products?lang=en')
    expect(res.body.items[0].name).toBe('Đèn Nguyệt')
    expect(res.body.items[0].description).toBe(products[0].description.en)
  })

  it('ngôn ngữ lạ → vi', async () => {
    const res = await request(makeApp()).get('/api/products/den-vong?lang=fr')
    expect(res.body.item.name).toBe('Đèn Vọng')
    expect(res.body.item.badge).toBe('Bán chạy')
  })
})

describe('GET /api/faq', () => {
  it('G-07 + §31.3: FAQ từ dữ liệu, không còn hứa lưu "vĩnh viễn" cho media', async () => {
    const res = await request(makeApp()).get('/api/faq')
    expect(res.status).toBe(200)
    expect(res.body.items).toHaveLength(5)
    expect(res.body.items[0].answer).toContain('30 ngày')
  })
})

describe('GET /api/batches/:code', () => {
  it('US-005 AC-001: lô có video → trả video, không cần đăng nhập', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026-01?lang=zh')
    expect(res.status).toBe(200)
    expect(res.body.item).toMatchObject({ code: 'DEMO-2026-01', title: '2026年9月批次' })
    expect(res.body.item.videoUrl).toMatch(/^https:/)
  })

  it('lô chưa xuất bản video hoặc không tồn tại → 404 chung', async () => {
    for (const code of ['DEMO-2026-02', 'KHONG-CO']) {
      const res = await request(makeApp()).get(`/api/batches/${code}`)
      expect(res.status).toBe(404)
      expect(res.body.error.code).toBe('NOT_FOUND')
    }
  })
})

it('endpoint không tồn tại → 404 JSON', async () => {
  const res = await request(makeApp()).get('/api/khong-co')
  expect(res.status).toBe(404)
  expect(res.body.error.code).toBe('NOT_FOUND')
})
