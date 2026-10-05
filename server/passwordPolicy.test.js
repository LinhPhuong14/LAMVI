// Chính sách mật khẩu production (D-91) và ô "nhập lại mật khẩu mới" ở đăng ký/đặt lại/đổi mật khẩu.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMemoryMailer } from './mail/mailer.js'

const config = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
const GOOD = 'Gio-Hoa#Sen2026'
const NEW = 'Moi-Nang#Xuan71'
let app, repo, auth, pwned, mailer

beforeEach(() => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  pwned = vi.fn(async () => false)
  mailer = createMemoryMailer()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config, mailer, pwned })
})

const register = (over = {}) =>
  request(app).post('/api/auth/register').send({ email: 'an.nguyen@example.com', fullName: 'Nguyễn Hoàng', password: GOOD, ...over })

async function session(email = 'phien@example.com', password = GOOD) {
  await auth.signUp({ email, password })
  const s = await auth.signIn({ email, password })
  return { token: `Bearer ${s.accessToken}`, email, password }
}

describe('Đăng ký — quy tắc mật khẩu', () => {
  it.each([
    ['Abcdef1', 'PASSWORD_TOO_SHORT'],
    ['abcdefgh1', 'PASSWORD_NEEDS_VARIETY'],
    ['ABCDEFGH1', 'PASSWORD_NEEDS_VARIETY'],
    ['Abcdefghi', 'PASSWORD_NEEDS_VARIETY'],
    [' Gio-Hoa#Sen2026', 'PASSWORD_WHITESPACE'],
  ])('%s → %s, không tạo tài khoản, không gọi HIBP', async (password, code) => {
    const r = await register({ password })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.password).toBe(code)
    expect((await repo.listProfiles()).total).toBe(0) // không tạo hồ sơ
    expect(pwned).not.toHaveBeenCalled()
  })

  it('không khắt khe: mật khẩu hay gặp nhưng đủ quy tắc cơ bản vẫn được nhận (không chặn theo danh sách phổ biến)', async () => {
    for (const [i, password] of ['Password1', 'Matkhau123', 'Qwerty123'].entries()) {
      expect((await register({ email: `de${i}@example.com`, password })).status, password).toBe(201)
    }
  })

  it('mật khẩu đạt → 201; nếu bật kiểm rò rỉ (PWNED_CHECK=1) thì HIBP được hỏi sau chính sách', async () => {
    const r = await register()
    expect(r.status).toBe(201)
    expect(pwned).toHaveBeenCalledWith(GOOD)
  })

  it('gửi confirmPassword không khớp → 400 PASSWORD_MISMATCH, không tạo tài khoản', async () => {
    const r = await register({ confirmPassword: `${GOOD}x` })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.confirmPassword).toBe('PASSWORD_MISMATCH')
    expect(await repo.listProfiles()).toMatchObject({ total: 0 })
  })
})

describe('Đặt lại mật khẩu — xác nhận mật khẩu mới', () => {
  async function token(email = 'quen@example.com') {
    await auth.signUp({ email, password: GOOD })
    return auth.createRecoveryToken(email)
  }
  const reset = (body) => request(app).post('/api/auth/reset-password').send(body)

  it('không khớp → 400 PASSWORD_MISMATCH và token CHƯA bị tiêu thụ (dùng lại được)', async () => {
    const t = await token()
    const bad = await reset({ token: t, password: NEW, confirmPassword: 'Khac-Hoan#Toan9' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields.confirmPassword).toBe('PASSWORD_MISMATCH')
    expect((await reset({ token: t, password: NEW, confirmPassword: NEW })).status).toBe(204)
  })

  it('khớp → 204; đăng nhập được bằng mật khẩu mới', async () => {
    const t = await token('moi@example.com')
    expect((await reset({ token: t, password: NEW, confirmPassword: NEW })).status).toBe(204)
    expect((await request(app).post('/api/auth/login').send({ email: 'moi@example.com', password: NEW })).status).toBe(200)
  })

  it('mật khẩu yếu → bị từ chối TRƯỚC khi tiêu thụ token (link không cháy)', async () => {
    const t = await token('yeu@example.com')
    const weak = await reset({ token: t, password: 'abcdefgh1', confirmPassword: 'abcdefgh1' })
    expect(weak.body.error.fields.password).toBe('PASSWORD_NEEDS_VARIETY')
    expect((await reset({ token: t, password: NEW, confirmPassword: NEW })).status).toBe(204)
  })

  it('xác nhận sai kiểu (số, mảng) → coi là không khớp', async () => {
    const t = await token('kieu@example.com')
    for (const c of [12345, ['x'], {}, null]) {
      const r = await reset({ token: t, password: NEW, confirmPassword: c })
      expect(r.status, JSON.stringify(c)).toBe(400)
    }
  })

  it('không gửi confirmPassword (API/tích hợp cũ) vẫn dùng được', async () => {
    const t = await token('cu@example.com')
    expect((await reset({ token: t, password: NEW })).status).toBe(204)
  })
})

describe('Đổi mật khẩu khi đang đăng nhập', () => {
  const change = (who, body) => request(app).post('/api/auth/change-password').set('Authorization', who.token).send(body)

  it('không khớp → 400 PASSWORD_MISMATCH, mật khẩu cũ giữ nguyên, phiên không bị thu hồi', async () => {
    const who = await session()
    const r = await change(who, { currentPassword: GOOD, password: NEW, confirmPassword: 'Khac-Hoan#Toan9' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.confirmPassword).toBe('PASSWORD_MISMATCH')
    expect((await request(app).get('/api/me').set('Authorization', who.token)).status).toBe(200)
    expect(await auth.verifyPassword((await auth.getUser(who.token.slice(7))).id, GOOD)).toBe(true)
  })

  it('đạt chính sách + khớp → 204', async () => {
    const who = await session('doi@example.com')
    expect((await change(who, { currentPassword: GOOD, password: NEW, confirmPassword: NEW })).status).toBe(204)
  })
})

describe('Thư đặt lại mật khẩu dùng khung thư mới (banner + bố cục)', () => {
  it('quên mật khẩu → thư có banner ở địa chỉ của site, nút đặt lại, link có token trong fragment', async () => {
    await auth.signUp({ email: 'thu@example.com', password: GOOD })
    expect((await request(app).post('/api/auth/forgot-password').send({ email: 'thu@example.com' })).status).toBe(202)
    const m = mailer.outbox.at(-1)
    expect(m.to).toBe('thu@example.com')
    expect(m.html).toContain('<img src="https://lamvi.test/images/mail/banner.jpg"')
    expect(m.html).toMatch(/href="https:\/\/lamvi\.test\/reset-password#t=[^"]+"/)
    expect(m.text).toMatch(/https:\/\/lamvi\.test\/reset-password#t=/)
  })

  it('đặt lại xong → thư báo đổi mật khẩu có banner và KHÔNG có link nào', async () => {
    await auth.signUp({ email: 'xong@example.com', password: GOOD })
    const t = await auth.createRecoveryToken('xong@example.com')
    await request(app).post('/api/auth/reset-password').send({ token: t, password: NEW, confirmPassword: NEW }).expect(204)
    const m = mailer.outbox.at(-1)
    expect(m.subject).toBe('Mật khẩu LAMVI đã được đổi')
    expect(m.html).toContain('banner.jpg')
    expect(m.html).not.toContain('<a ')
  })
})

describe('Quên mật khẩu chỉ dành cho email đã đăng ký (D-92)', () => {
  const forgot = (email) => request(app).post('/api/auth/forgot-password').send({ email })

  it('email chưa từng đăng ký → 404 EMAIL_NOT_REGISTERED, không tạo token, không gửi thư', async () => {
    const issued = vi.spyOn(auth, 'createRecoveryToken')
    const r = await forgot('chua-dang-ky@example.com')
    expect(r.status).toBe(404)
    expect(r.body.error.code).toBe('EMAIL_NOT_REGISTERED')
    expect(mailer.outbox).toHaveLength(0)
    expect(issued).toHaveBeenCalledTimes(1)
    expect(await issued.mock.results[0].value).toBeNull()
  })

  it('email đã đăng ký (kể cả viết hoa/khoảng trắng) → 202 và có thư', async () => {
    await auth.signUp({ email: 'da-dk@example.com', password: GOOD })
    expect((await forgot('  DA-DK@Example.com ')).status).toBe(202)
    expect(mailer.outbox).toHaveLength(1)
  })

  it('tài khoản tạo bằng Google (không có mật khẩu) vẫn đặt được mật khẩu qua quên mật khẩu', async () => {
    await auth.signInVerifiedEmail('google@example.com')
    expect((await forgot('google@example.com')).status).toBe(202)
    expect(mailer.outbox.at(-1).to).toBe('google@example.com')
  })

  it('lỗi hạ tầng của nhà cung cấp Auth (không phải "không có user") → 202 và ghi log, không báo "chưa đăng ký" sai', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(auth, 'createRecoveryToken').mockRejectedValueOnce(new Error('upstream 503'))
    expect((await forgot('bat-ky@example.com')).status).toBe(202)
    expect(mailer.outbox).toHaveLength(0)
    expect(err).toHaveBeenCalled()
    err.mockRestore()
  })

  it('email sai định dạng → 400 (kiểm định dạng trước khi tra tài khoản)', async () => {
    const r = await forgot('khong-phai-email')
    expect(r.status).toBe(400)
    expect(r.body.error.fields.email).toBe('INVALID_EMAIL')
  })

  it('vẫn bị giới hạn tốc độ theo email để giảm dò email (G-20)', async () => {
    const limited = createApp({
      repo,
      auth,
      storage: createMemoryStorage(),
      config: { ...config, rateLimit: { enabled: true, forgot: { max: 2, windowSec: 300 } } },
      mailer,
      pwned,
    })
    const go = () => request(limited).post('/api/auth/forgot-password').send({ email: 'do-email@example.com' })
    expect((await go()).status).toBe(404)
    expect((await go()).status).toBe(404)
    const third = await go()
    expect(third.status).toBe(429)
    expect(third.headers['retry-after']).toBeTruthy()
  })
})
