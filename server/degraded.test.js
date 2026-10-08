import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createDegradedApp } from './degraded.js'
import { errorPage } from './errorPage.js'

describe('chế độ dự phòng khi khởi động thất bại (feedback 08/10, mục 1)', () => {
  const make = (env = {}) => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    return createDegradedApp(new Error('Deployment configuration incomplete: SUPABASE_BINDINGS'), { env })
  }

  it('/api/health trả 503 để uptime monitor báo ngay', async () => {
    const res = await request(make()).get('/api/health')
    expect(res.status).toBe(503)
    expect(res.body).toEqual({ ok: false, degraded: true })
  })

  it('API khác trả 503 JSON, không lộ nguyên nhân', async () => {
    const res = await request(make()).post('/api/checkout').send({})
    expect(res.status).toBe(503)
    expect(res.body.error.code).toBe('SERVICE_UNAVAILABLE')
    expect(JSON.stringify(res.body)).not.toMatch(/SUPABASE/)
  })

  it('mọi đường dẫn khác trả trang lỗi tiếng Việt có thương hiệu, không cache', async () => {
    const res = await request(make({ MAIL_SUPPORT_PHONE: '0901 234 567' })).get('/robots.txt')
    expect(res.status).toBe(503)
    expect(res.headers['cache-control']).toBe('no-store')
    expect(res.text).toContain('LAMVI')
    expect(res.text).toContain('Thử lại')
    expect(res.text).toContain('tel:0901234567')
    expect(res.text).not.toMatch(/SUPABASE/)
  })

  it('theo ngôn ngữ trong URL', async () => {
    const res = await request(make()).get('/en/shop')
    expect(res.text).toContain('Try again')
  })
})

describe('errorPage', () => {
  it('không bịa thông tin liên hệ khi chưa cấu hình', () => {
    const html = errorPage({ lang: 'vi' })
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('mailto:')
  })

  it('escape dữ liệu cấu hình', () => {
    const html = errorPage({ brand: { supportEmail: 'a@b.vn', zaloUrl: 'https://zalo.me/x"><script>' } })
    expect(html).not.toContain('<script>')
  })
})
