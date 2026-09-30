import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'

let app, auth, repo
// G-20: tắt rate limit trong bộ test chức năng (nhiều test đăng ký/đăng nhập liên tiếp từ cùng
// một IP). Hành vi giới hạn được kiểm riêng ở server/rateLimit.extra.test.js.
const config = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
const valid = { email: 'An@Example.com', password: 'matkhau123', fullName: 'Nguyễn An', phone: '090 123 4567' }

function setup(opts) {
  repo = createMemoryRepo()
  auth = createMemoryAuth(opts)
  app = createApp({ repo, auth, config })
}

async function registerAndLogin() {
  await request(app).post('/api/auth/register').send(valid).expect(201)
  const res = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password })
  return res.body.accessToken
}

beforeEach(() => setup())

describe('POST /api/auth/register (FR-ACC-001)', () => {
  it('tạo tài khoản + hồ sơ; email chuẩn hoá, SĐT chuẩn hoá', async () => {
    const res = await request(app).post('/api/auth/register?lang=en').send(valid)
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('an@example.com')
    expect(res.body.needsConfirmation).toBe(false)
    const profile = await repo.getProfile(res.body.user.id)
    expect(profile).toMatchObject({ fullName: 'Nguyễn An', phone: '0901234567', preferredLocale: 'en', role: 'customer' })
  })

  it('dữ liệu sai → 400 VALIDATION_ERROR kèm mã theo trường', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sai', password: '123', fullName: ' ', phone: '12345', preferredLocale: 'fr' })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      fields: {
        email: 'INVALID_EMAIL',
        password: 'PASSWORD_TOO_SHORT',
        fullName: 'REQUIRED',
        phone: 'INVALID_PHONE',
        preferredLocale: 'INVALID_LOCALE',
      },
    })
  })

  it('email đã đăng ký → 409 EMAIL_TAKEN', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201)
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'an@example.com' })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('EMAIL_TAKEN')
  })

  it('không cho tự đặt role admin khi đăng ký', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, role: 'admin' })
    expect((await repo.getProfile(res.body.user.id)).role).toBe('customer')
  })
})

describe('POST /api/auth/login', () => {
  it('đúng thông tin → token; sai → 401 INVALID_CREDENTIALS (không phân biệt email hay mật khẩu sai)', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const ok = await request(app).post('/api/auth/login').send({ email: 'an@example.com', password: valid.password })
    expect(ok.status).toBe(200)
    expect(ok.body).toMatchObject({ accessToken: expect.any(String), refreshToken: expect.any(String) })

    for (const creds of [
      { email: 'an@example.com', password: 'sai-mat-khau' },
      { email: 'khong@co.vn', password: valid.password },
      {},
    ]) {
      const bad = await request(app).post('/api/auth/login').send(creds)
      expect(bad.status).toBe(401)
      expect(bad.body.error.code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('email chưa xác nhận → 403 EMAIL_NOT_CONFIRMED', async () => {
    setup({ requireEmailConfirmation: true })
    const reg = await request(app).post('/api/auth/register').send(valid)
    expect(reg.body.needsConfirmation).toBe(true)
    const res = await request(app).post('/api/auth/login').send(valid)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('EMAIL_NOT_CONFIRMED')
    expect(auth.outbox[0]).toMatchObject({ type: 'confirm', redirectTo: 'https://moc.test/login' })
  })
})

describe('/api/me', () => {
  it('chưa đăng nhập / token sai → 401', async () => {
    expect((await request(app).get('/api/me')).status).toBe(401)
    expect((await request(app).get('/api/me').set('Authorization', 'Bearer sai')).status).toBe(401)
  })

  it('xem và sửa hồ sơ; không đổi được role', async () => {
    const token = await registerAndLogin()
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)
    expect(me.body.profile).toMatchObject({ email: 'an@example.com', fullName: 'Nguyễn An', role: 'customer' })

    const patched = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${token}`)
      .send({ fullName: 'An Nguyễn', phone: '', preferredLocale: 'zh', role: 'admin' })
    expect(patched.status).toBe(200)
    expect(patched.body.profile).toMatchObject({ fullName: 'An Nguyễn', phone: null, preferredLocale: 'zh', role: 'customer' })
  })

  it('PATCH dữ liệu sai → 400', async () => {
    const token = await registerAndLogin()
    const res = await request(app).patch('/api/me').set('Authorization', `Bearer ${token}`).send({ phone: 'abc' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ phone: 'INVALID_PHONE' })
  })
})

describe('Đăng xuất, làm mới phiên', () => {
  it('logout vô hiệu token', async () => {
    const token = await registerAndLogin()
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`).expect(204)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
  })

  it('refresh cấp token mới; refresh token dùng lại → 401', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const login = await request(app).post('/api/auth/login').send(valid)
    const r1 = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })
    expect(r1.status).toBe(200)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${r1.body.accessToken}`)).status).toBe(200)
    const r2 = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })
    expect(r2.status).toBe(401)
  })
})

describe('Quên / đặt lại mật khẩu', () => {
  it('luôn trả 202, không tiết lộ email có tồn tại', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'an@example.com' })
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'khong@co.vn' })
    expect(a.status).toBe(202)
    expect(b.status).toBe(202)
    expect(a.body).toEqual(b.body)
    expect(auth.outbox).toHaveLength(1)
  })

  it('link theo ngôn ngữ; token khôi phục đổi được mật khẩu và bị vô hiệu sau đó', async () => {
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password?lang=en').send({ email: valid.email })
    const mail = auth.outbox[0]
    expect(mail.redirectTo).toBe('https://moc.test/en/reset-password')

    await request(app)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${mail.accessToken}`)
      .send({ password: 'matkhaumoi1' })
      .expect(204)
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ ...valid, password: 'matkhaumoi1' })).status).toBe(200)
    const again = await request(app)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${mail.accessToken}`)
      .send({ password: 'matkhaumoi2' })
    expect(again.status).toBe(401)
  })

  it('mật khẩu mới quá ngắn → 400', async () => {
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${auth.outbox[0].accessToken}`)
      .send({ password: 'ngan' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_SHORT')
  })

  // G-18: trước đây mọi access token hợp lệ đều đổi được mật khẩu
  it('token đăng nhập thường KHÔNG đặt lại được mật khẩu, phải là token từ link email', async () => {
    const token = await registerAndLogin()
    const res = await request(app)
      .post('/api/auth/reset-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ password: 'matkhaumoi1' })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('RECOVERY_TOKEN_REQUIRED')
    // Mật khẩu cũ vẫn dùng được
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(200)
  })
})

// G-18: đổi mật khẩu khi đang đăng nhập
describe('Đổi mật khẩu', () => {
  const change = (token, body) =>
    request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body)

  it('đúng mật khẩu hiện tại → đổi được, mọi phiên bị thu hồi', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { currentPassword: valid.password, password: 'matkhaumoi1' })
    expect(res.status).toBe(204)
    // Phiên cũ hết hiệu lực
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ ...valid, password: 'matkhaumoi1' })).status).toBe(200)
  })

  it('sai mật khẩu hiện tại → 400, mật khẩu không đổi', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { currentPassword: 'saibetnhe', password: 'matkhaumoi1' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.currentPassword).toBe('INVALID_CREDENTIALS')
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(200)
  })

  it('thiếu mật khẩu hiện tại → 400 theo trường', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { password: 'matkhaumoi1' })
    expect(res.body.error.fields.currentPassword).toBe('REQUIRED')
  })

  it('mật khẩu mới quá ngắn → 400, kiểm tra trước khi đụng tới mật khẩu cũ', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { currentPassword: valid.password, password: 'ngan' })
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_SHORT')
  })

  it('chưa đăng nhập → 401', async () => {
    expect((await request(app).post('/api/auth/change-password').send({ currentPassword: 'a', password: 'b' })).status).toBe(401)
  })
})

describe('Hồi quy sau kiểm thử độc lập', () => {
  it('đăng ký lại email đã có hồ sơ (chưa xác nhận) không ghi đè hồ sơ', async () => {
    const res = await request(app).post('/api/auth/register').send(valid)
    const id = res.body.user.id
    // Giả lập Supabase trả lại user cũ
    auth.signUp = async () => ({ user: { id, email: 'an@example.com' }, needsConfirmation: true })
    await request(app).post('/api/auth/register').send({ ...valid, fullName: 'Kẻ Mạo Danh', phone: '0987654321' }).expect(201)
    expect((await repo.getProfile(id)).fullName).toBe('Nguyễn An')
  })

  it('mật khẩu quá 72 byte (ký tự có dấu) → PASSWORD_TOO_LONG', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, password: 'ệ'.repeat(30) })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
  })
})
