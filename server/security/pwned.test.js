import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { isPwnedPassword } from './pwned.js'
import { createApp } from '../app.js'
import { createMemoryRepo } from '../adapters/memory/repo.js'
import { createMemoryAuth } from '../adapters/memory/auth.js'
import { createMemoryMailer } from '../mail/mailer.js'

const sha1 = (p) => createHash('sha1').update(p).digest('hex').toUpperCase()
const range = (p, count = 3) => `0000000000000000000000000000000000A:0\r\n${sha1(p).slice(5)}:${count}\r\nFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:2`
const respond = (text, ok = true) => vi.fn(async () => ({ ok, text: async () => text }))

describe('isPwnedPassword — HIBP k-anonymity (T-49)', () => {
  it('chỉ gửi 5 ký tự đầu của SHA-1, có Add-Padding', async () => {
    const f = respond(range('password1'))
    await isPwnedPassword('password1', f)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1('password1').slice(0, 5)}`)
    expect(url).not.toContain(sha1('password1').slice(5))
    expect(init.headers['Add-Padding']).toBe('true')
  })

  it('có trong danh sách → true; không có → false; dòng đệm count 0 → false', async () => {
    expect(await isPwnedPassword('password1', respond(range('password1')))).toBe(true)
    expect(await isPwnedPassword('mat-khau-hiem-gap-9X!', respond(range('khac')))).toBe(false)
    expect(await isPwnedPassword('padded', respond(range('padded', 0)))).toBe(false)
  })

  it('FAIL-OPEN: HTTP lỗi, mạng lỗi, timeout → false', async () => {
    expect(await isPwnedPassword('x', respond('', false))).toBe(false)
    expect(await isPwnedPassword('x', async () => { throw new Error('ECONNRESET') })).toBe(false)
    expect(await isPwnedPassword('x', async () => { throw new DOMException('t', 'TimeoutError') })).toBe(false)
  })
})

describe('Mật khẩu đã lộ bị từ chối ở đăng ký / đặt lại / đổi (T-49)', () => {
  const config = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
  const pwned = vi.fn(async (p) => p === 'matkhaudalo1')
  const valid = { email: 'an@example.com', password: 'matkhau123', fullName: 'An' }
  const build = () => {
    const mailer = createMemoryMailer()
    const auth = createMemoryAuth()
    return { app: createApp({ repo: createMemoryRepo(), auth, config, mailer, pwned }), mailer }
  }

  it('register → 400 fields.password = PASSWORD_BREACHED, không tạo tài khoản', async () => {
    const { app } = build()
    const res = await request(app).post('/api/auth/register').send({ ...valid, password: 'matkhaudalo1' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ password: 'PASSWORD_BREACHED' })
    expect((await request(app).post('/api/auth/login').send({ ...valid, password: 'matkhaudalo1' })).status).toBe(401)
    expect((await request(app).post('/api/auth/register').send(valid)).status).toBe(201)
  })

  it('không gọi dịch vụ ngoài khi mật khẩu đã sai định dạng (tiết kiệm + không rò)', async () => {
    const { app } = build()
    pwned.mockClear()
    await request(app).post('/api/auth/register').send({ ...valid, password: 'ngan' })
    expect(pwned).not.toHaveBeenCalled()
  })

  it('reset-password → 400 và token chưa bị tiêu thụ', async () => {
    const { app, mailer } = build()
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const token = decodeURIComponent(mailer.outbox[0].text.match(/#t=(\S+)/)[1])
    const bad = await request(app).post('/api/auth/reset-password').send({ token, password: 'matkhaudalo1' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields.password).toBe('PASSWORD_BREACHED')
    await request(app).post('/api/auth/reset-password').send({ token, password: 'matkhaumoi1' }).expect(204)
  })

  it('change-password → 400, mật khẩu cũ vẫn dùng được', async () => {
    const { app } = build()
    await request(app).post('/api/auth/register').send(valid)
    const { body } = await request(app).post('/api/auth/login').send(valid)
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ currentPassword: valid.password, password: 'matkhaudalo1' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_BREACHED')
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(200)
  })
})
