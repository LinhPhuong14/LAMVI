import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'

describe('GET /api/shipping-policy (feedback 08/10, 7.1)', () => {
  it('trả mức mặc định 30.000 ₫, miễn phí từ 1.000.000 ₫, cho phép cache CDN', async () => {
    const app = createApp({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://lamvi.test' } })
    const res = await request(app).get('/api/shipping-policy')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ fee: 30000, freeFrom: 1000000 })
    expect(res.headers['cache-control']).toMatch(/s-maxage=300/)
  })

  it('theo cấu hình đã lưu trong app_settings', async () => {
    const repo = createMemoryRepo()
    await repo.setSetting('pricing', { shippingFee: 25000, freeShippingFrom: 500000 }, null)
    const app = createApp({ repo, config: { publicSiteUrl: 'https://lamvi.test' } })
    const res = await request(app).get('/api/shipping-policy')
    expect(res.body).toEqual({ fee: 25000, freeFrom: 500000 })
  })
})

describe('Cache API công khai (feedback 08/10, mục 22)', () => {
  it('/api/products cho CDN cache ngắn, /api/cart vẫn no-store', async () => {
    const app = createApp({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://lamvi.test' } })
    const res = await request(app).get('/api/products')
    expect(res.headers['cache-control']).toMatch(/s-maxage=60/)
    expect(res.headers['cache-control']).not.toMatch(/no-store/)
    const bad = await request(app).get('/api/products/khong-ton-tai')
    expect(bad.status).toBe(404)
    expect(bad.headers['cache-control']).toBe('no-store')
  })
})
