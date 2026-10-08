import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMemoryMailer } from './mail/mailer.js'

const config = (brand = { supportEmail: 'hotro@lamvi.example' }) => ({
  publicSiteUrl: 'http://localhost:5173',
  rateLimit: { enabled: true, contact: { max: 2, windowSec: 3600 } },
  mail: { from: 'LAMVI <no-reply@lamvi.example>', resendApiKey: 'k', brand },
})
const make = (cfg = config(), mailer = createMemoryMailer()) => ({
  mailer,
  app: createApp({ repo: createMemoryRepo(), auth: createMemoryAuth(), storage: createMemoryStorage({ maxBytes: 1e6 }), config: cfg, mailer }),
})
const valid = { name: 'Lan', email: 'Lan@Example.com', orderCode: 'LV-123', message: 'Đèn của tôi bị móp khi nhận hàng.' }

describe('POST /api/contact (feedback 08/10, mục 4)', () => {
  it('gửi thư tới hộp thư hỗ trợ, Reply-To là email khách', async () => {
    const { app, mailer } = make()
    const res = await request(app).post('/api/contact').send(valid)
    expect(res.status).toBe(202)
    expect(mailer.outbox).toHaveLength(1)
    expect(mailer.outbox[0]).toMatchObject({ to: 'hotro@lamvi.example', replyTo: 'lan@example.com' })
    expect(mailer.outbox[0].subject).toContain('LV-123')
    expect(mailer.outbox[0].text).toContain('Đèn của tôi bị móp')
  })

  it('kiểm tra dữ liệu', async () => {
    const { app, mailer } = make()
    const res = await request(app).post('/api/contact').send({ name: '', email: 'x', message: 'ngắn' })
    expect(res.status).toBe(400)
    expect(Object.keys(res.body.error.fields).sort()).toEqual(['email', 'message', 'name'])
    expect(mailer.outbox).toHaveLength(0)
  })

  it('chặn chèn xuống dòng vào tiêu đề và escape HTML', async () => {
    const { app, mailer } = make()
    await request(app).post('/api/contact').send({ ...valid, name: 'A\r\nBcc: x@y.z <b>', message: '<script>alert(1)</script> nội dung dài' })
    const m = mailer.outbox[0]
    expect(m.subject).not.toMatch(/[\r\n]/)
    expect(m.html).not.toContain('<script>')
  })

  it('503 khi chưa có hộp thư nhận hoặc chưa có nhà cung cấp thư', async () => {
    expect((await request(make(config({})).app).post('/api/contact').send(valid)).status).toBe(503)
    expect((await request(make(config(), null).app).post('/api/contact').send(valid)).status).toBe(503)
  })

  it('giới hạn số lần gửi theo IP', async () => {
    const { app } = make()
    for (let i = 0; i < 2; i++) expect((await request(app).post('/api/contact').send(valid)).status).toBe(202)
    expect((await request(app).post('/api/contact').send(valid)).status).toBe(429)
  })

  it('/api/site báo form liên hệ bật/tắt', async () => {
    expect((await request(make().app).get('/api/site')).body.contactForm).toBe(true)
    expect((await request(make(config({})).app).get('/api/site')).body.contactForm).toBe(false)
  })
})
