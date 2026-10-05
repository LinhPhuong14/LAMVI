import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryMailer } from './mail/mailer.js'

let app, auth, repo, mailer
// G-20: tắt rate limit trong bộ test chức năng (nhiều test đăng ký/đăng nhập liên tiếp từ cùng
// một IP). Hành vi giới hạn được kiểm riêng ở server/rateLimit.extra.test.js.
const config = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
const valid = { email: 'An@Example.com', password: 'Gio-Hoa#Sen2026', fullName: 'Nguyễn An', phone: '090 123 4567' }

function setup(opts) {
  repo = createMemoryRepo()
  auth = createMemoryAuth(opts)
  mailer = createMemoryMailer()
  app = createApp({ repo, auth, config, mailer })
}

// Cookie refresh (HttpOnly, Secure theo https) lấy từ Set-Cookie để gửi lại thủ công
const cookieOf = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lamvi_rt='))?.split(';')[0]
// Token đặt lại mật khẩu trong fragment của link thư gần nhất
const resetToken = (i = -1) => decodeURIComponent(mailer.outbox.at(i).text.match(/#t=(\S+)/)[1])

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
    expect(ok.body).toMatchObject({ accessToken: expect.any(String), user: { email: 'an@example.com' } })
    // T-49: refresh token chỉ ở cookie HttpOnly, không có trong body
    expect(ok.body.refreshToken).toBeUndefined()
    expect(ok.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=[^;]+; Max-Age=\d+; Path=\/api\/auth; HttpOnly; SameSite=Lax; Secure/)

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

describe('Đăng xuất, làm mới phiên (T-49: cookie HttpOnly)', () => {
  const loginWithCookie = async () => {
    await request(app).post('/api/auth/register').send(valid)
    const login = await request(app).post('/api/auth/login').send(valid)
    return { login, cookie: cookieOf(login) }
  }

  it('logout vô hiệu token và xoá cookie', async () => {
    const token = await registerAndLogin()
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${token}`)
    expect(out.status).toBe(204)
    expect(out.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=; Max-Age=0/)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
  })

  it('logout khi access token đã hết hạn vẫn thu hồi phiên nhờ cookie', async () => {
    const { login, cookie } = await loginWithCookie()
    await request(app).post('/api/auth/logout').set('Cookie', cookie).set('Authorization', 'Bearer het-han').expect(204)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${login.body.accessToken}`)).status).toBe(401)
    // refresh token trong cookie cũng bị thu hồi
    expect((await request(app).post('/api/auth/refresh').set('Cookie', cookie)).status).toBe(401)
  })

  it('refresh đọc cookie, cấp token mới + xoay vòng cookie; cookie cũ dùng lại → 401', async () => {
    const { cookie } = await loginWithCookie()
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(r1.status).toBe(200)
    expect(r1.body.refreshToken).toBeUndefined()
    expect(cookieOf(r1)).toBeTruthy()
    expect(cookieOf(r1)).not.toBe(cookie)
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${r1.body.accessToken}`)).status).toBe(200)
    const r2 = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(r2.status).toBe(401)
    expect(r2.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=; Max-Age=0/)
  })

  it('refresh không có cookie, hoặc gửi refreshToken trong body → 401', async () => {
    const { login } = await loginWithCookie()
    expect((await request(app).post('/api/auth/refresh')).status).toBe(401)
    const body = await request(app).post('/api/auth/refresh').send({ refreshToken: 'x' })
    expect(body.status).toBe(401)
    expect(login.body.refreshToken).toBeUndefined()
  })

  it('CSRF: Origin lạ → 403 dù cookie hợp lệ; cùng host hoặc PUBLIC_SITE_URL → qua', async () => {
    const { cookie } = await loginWithCookie()
    const evil = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'https://evil.test')
    expect(evil.status).toBe(403)
    const site = await request(app).post('/api/auth/refresh').set('Cookie', cookie).set('Origin', 'https://moc.test')
    expect(site.status).toBe(200)
    const sameHost = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieOf(site))
      .set('Host', 'preview.moc.test')
      .set('Origin', 'http://preview.moc.test')
    expect(sameHost.status).toBe(200)
    const crossSite = await request(app).post('/api/auth/logout').set('Sec-Fetch-Site', 'cross-site')
    expect(crossSite.status).toBe(403)
  })
})

describe('Quên / đặt lại mật khẩu (T-49: thư do server gửi, token một lần)', () => {
  it('D-92: email đã đăng ký → 202 và gửi thư; email chưa từng đăng ký → 404 EMAIL_NOT_REGISTERED, không gửi thư', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'an@example.com' })
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'khong@co.vn' })
    expect(a.status).toBe(202)
    expect(b.status).toBe(404)
    expect(b.body.error.code).toBe('EMAIL_NOT_REGISTERED')
    expect(mailer.outbox).toHaveLength(1)
    expect(mailer.outbox[0].to).toBe('an@example.com')
  })

  it('gửi thư lỗi / chưa cấu hình mailer vẫn trả 202 (không lộ, không 500)', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const broken = { send: async () => { throw new Error('mail 500') } }
    const app2 = createApp({ repo, auth, config, mailer: broken })
    expect((await request(app2).post('/api/auth/forgot-password').send({ email: valid.email })).status).toBe(202)
    const app3 = createApp({ repo, auth, config, mailer: null })
    expect((await request(app3).post('/api/auth/forgot-password').send({ email: valid.email })).status).toBe(202)
  })

  it('link theo ngôn ngữ, token trong fragment; đổi được mật khẩu, token dùng một lần, thu hồi mọi phiên', async () => {
    const token = await registerAndLogin()
    await request(app).post('/api/auth/forgot-password?lang=en').send({ email: valid.email })
    const mail = mailer.outbox[0]
    expect(mail.text).toMatch(/https:\/\/moc\.test\/en\/reset-password#t=\S+/)
    expect(mail.html).toContain('/en/reset-password#t=')
    expect(mail.subject).toMatch(/Reset/)

    await request(app).post('/api/auth/reset-password').send({ token: resetToken(), password: 'Moi-Nang#Xuan71' }).expect(204)
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ ...valid, password: 'Moi-Nang#Xuan71' })).status).toBe(200)
    // phiên cũ bị thu hồi
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
    // dùng lại token → 400
    const again = await request(app).post('/api/auth/reset-password').send({ token: resetToken(0), password: 'Moi-Nang#Xuan72' })
    expect(again.status).toBe(400)
    expect(again.body.error.code).toBe('INVALID_RESET_TOKEN')
    // thư báo đã đổi mật khẩu + nhật ký
    expect(mailer.outbox.at(-1).subject).toMatch(/đã được đổi/)
    expect((await repo.listAuditLog({ entity: 'account' })).map((e) => e.action)).toEqual(['password_changed'])
  })

  it('mật khẩu mới quá ngắn → 400 và token KHÔNG bị tiêu thụ', async () => {
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const t = resetToken()
    const res = await request(app).post('/api/auth/reset-password').send({ token: t, password: 'ngan' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_SHORT')
    await request(app).post('/api/auth/reset-password').send({ token: t, password: 'Moi-Nang#Xuan71' }).expect(204)
  })

  it('thiếu / sai token → 400 INVALID_RESET_TOKEN', async () => {
    for (const token of [undefined, '', 'sai-token', 123]) {
      const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Nang#Xuan71' })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('INVALID_RESET_TOKEN')
    }
  })

  it('token đăng nhập thường không thay được token đặt lại', async () => {
    const access = await registerAndLogin()
    const res = await request(app).post('/api/auth/reset-password').send({ token: access, password: 'Moi-Nang#Xuan71' })
    expect(res.status).toBe(400)
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(200)
  })
})

// G-18: đổi mật khẩu khi đang đăng nhập
describe('Đổi mật khẩu', () => {
  const change = (token, body) =>
    request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(body)

  it('đúng mật khẩu hiện tại → đổi được, mọi phiên bị thu hồi', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { currentPassword: valid.password, password: 'Moi-Nang#Xuan71' })
    expect(res.status).toBe(204)
    // Phiên cũ hết hiệu lực
    expect((await request(app).get('/api/me').set('Authorization', `Bearer ${token}`)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(401)
    expect((await request(app).post('/api/auth/login').send({ ...valid, password: 'Moi-Nang#Xuan71' })).status).toBe(200)
  })

  it('sai mật khẩu hiện tại → 400, mật khẩu không đổi', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { currentPassword: 'saibetnhe', password: 'Moi-Nang#Xuan71' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.currentPassword).toBe('INVALID_CREDENTIALS')
    expect((await request(app).post('/api/auth/login').send(valid)).status).toBe(200)
  })

  it('thiếu mật khẩu hiện tại → 400 theo trường', async () => {
    const token = await registerAndLogin()
    const res = await change(token, { password: 'Moi-Nang#Xuan71' })
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
