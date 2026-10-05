import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { normalizeVnPhone } from './domain/account.js'
import { createMemoryMailer } from './mail/mailer.js'

// Test bổ sung độc lập cho FR-ACC-001 (D-36, D-38, D-42)
let app, auth, repo, clock, mailer
// G-20: tắt rate limit trong bộ test chức năng (nhiều test đăng ký/đăng nhập liên tiếp từ cùng
// một IP). Hành vi giới hạn được kiểm riêng ở server/rateLimit.extra.test.js.
const config = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
const valid = { email: 'an@example.com', password: 'Gio-Hoa#Sen2026', fullName: 'Nguyễn An' }

function setup(opts = {}) {
  clock = { t: Date.UTC(2026, 8, 1) }
  repo = createMemoryRepo()
  auth = createMemoryAuth({ now: () => clock.t, ...opts })
  mailer = createMemoryMailer()
  app = createApp({ repo, auth, config, mailer })
}

// T-49: refresh token ở cookie HttpOnly — lấy từ Set-Cookie để gửi lại thủ công
const cookieOf = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lamvi_rt='))?.split(';')[0]
const resetToken = (i = -1) => decodeURIComponent(mailer.outbox.at(i).text.match(/#t=(\S+)/)[1])
const refresh = (cookie) => request(app).post('/api/auth/refresh').set('Cookie', cookie)

const register = (data = {}, q = '') => request(app).post(`/api/auth/register${q}`).send({ ...valid, ...data })
const login = (data = {}) => request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password, ...data })
const me = (token) => request(app).get('/api/me').set('Authorization', `Bearer ${token}`)

async function registerAndLogin(data = {}) {
  await register(data).expect(201)
  const res = await login({ email: data.email ?? valid.email, password: data.password ?? valid.password }).expect(200)
  return { ...res.body, cookie: cookieOf(res) }
}

beforeEach(() => setup())

describe('Đăng ký — kiểm tra đầu vào (FR-ACC-001, D-42)', () => {
  it('email có khoảng trắng + chữ hoa → chuẩn hoá; đăng nhập không phân biệt hoa thường', async () => {
    const res = await register({ email: '  An@EXAMPLE.com  ' })
    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe('an@example.com')
    expect((await login({ email: ' AN@example.COM ' })).status).toBe(200)
    // Đăng ký lại cùng email khác hoa thường → trùng
    expect((await register({ email: 'AN@example.com' })).status).toBe(409)
  })

  it('email có khoảng trắng ở giữa / thiếu miền → INVALID_EMAIL', async () => {
    for (const email of ['a n@example.com', 'an@example', 'an@@example.com', 'an']) {
      const res = await register({ email })
      expect(res.status, email).toBe(400)
      expect(res.body.error.fields.email, email).toBe('INVALID_EMAIL')
    }
  })

  it('email không phải chuỗi → REQUIRED, không 500', async () => {
    const res = await register({ email: ['an@example.com'] })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.email).toBe('REQUIRED')
  })

  it('mật khẩu 8 ký tự và 72 byte hợp lệ; 7 ký tự và 73 byte bị từ chối (D-91)', async () => {
    const ok72 = `Ab1${'x'.repeat(69)}`
    expect(Buffer.byteLength(ok72)).toBe(72)
    expect((await register({ email: 'a8@example.com', password: 'Abcdefg1' })).status).toBe(201)
    expect((await register({ email: 'a72@example.com', password: ok72 })).status).toBe(201)
    const short = await register({ email: 'a7@example.com', password: 'Abcdef1' })
    expect(short.body.error.fields.password).toBe('PASSWORD_TOO_SHORT')
    const long = await register({ email: 'a73@example.com', password: `${ok72}x` })
    expect(long.status).toBe(400)
    expect(long.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
  })

  it('mật khẩu không phải chuỗi → REQUIRED', async () => {
    const res = await register({ password: 12345678 })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('REQUIRED')
  })

  it('fullName 100 ký tự hợp lệ (sau khi trim); 101 ký tự → TOO_LONG', async () => {
    const ok = await register({ email: 'n100@example.com', fullName: `  ${'a'.repeat(100)}  ` })
    expect(ok.status).toBe(201)
    expect((await repo.getProfile(ok.body.user.id)).fullName).toBe('a'.repeat(100))
    const bad = await register({ email: 'n101@example.com', fullName: 'a'.repeat(101) })
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields.fullName).toBe('TOO_LONG')
  })

  it('thiếu fullName → REQUIRED; fullName không phải chuỗi → REQUIRED', async () => {
    expect((await register({ fullName: undefined })).body.error.fields.fullName).toBe('REQUIRED')
    expect((await register({ fullName: { vi: 'x' } })).body.error.fields.fullName).toBe('REQUIRED')
  })

  it('SĐT không bắt buộc (D-42): bỏ trống / null → lưu null', async () => {
    const a = await register({ email: 'p1@example.com' })
    expect((await repo.getProfile(a.body.user.id)).phone).toBeNull()
    const b = await register({ email: 'p2@example.com', phone: '' })
    expect((await repo.getProfile(b.body.user.id)).phone).toBeNull()
    const c = await register({ email: 'p3@example.com', phone: null })
    expect(c.status).toBe(201)
    expect((await repo.getProfile(c.body.user.id)).phone).toBeNull()
  })

  it('SĐT +84 / 84 / 0, có dấu chấm, cách, gạch → chuẩn hoá 0xxxxxxxxx', async () => {
    const cases = {
      '+84901234567': '0901234567',
      '84901234567': '0901234567',
      '0901234567': '0901234567',
      '090.123.4567': '0901234567',
      '+84 90 123 4567': '0901234567',
      '0987-654-321': '0987654321',
      '0321234567': '0321234567',
      '0561234567': '0561234567',
      '0761234567': '0761234567',
      '0861234567': '0861234567',
    }
    let i = 0
    for (const [input, expected] of Object.entries(cases)) {
      const res = await register({ email: `sdt${i++}@example.com`, phone: input })
      expect(res.status, input).toBe(201)
      expect((await repo.getProfile(res.body.user.id)).phone, input).toBe(expected)
    }
  })

  it('SĐT đầu số không hợp lệ / sai độ dài / không phải chuỗi → INVALID_PHONE', async () => {
    for (const phone of ['0201234567', '0123456789', '0401234567', '0601234567', '090123456', '09012345678', '+85901234567', 'abc', 901234567]) {
      const res = await register({ phone })
      expect(res.status, String(phone)).toBe(400)
      expect(res.body.error.fields.phone, String(phone)).toBe('INVALID_PHONE')
    }
    expect(normalizeVnPhone(undefined)).toBeNull()
  })

  it('preferredLocale mặc định theo ?lang; ?lang lạ → vi; giá trị gửi lên được ưu tiên', async () => {
    const zh = await register({ email: 'l1@example.com' }, '?lang=zh')
    expect((await repo.getProfile(zh.body.user.id)).preferredLocale).toBe('zh')
    const fr = await register({ email: 'l2@example.com' }, '?lang=fr')
    expect((await repo.getProfile(fr.body.user.id)).preferredLocale).toBe('vi')
    const none = await register({ email: 'l3@example.com' })
    expect((await repo.getProfile(none.body.user.id)).preferredLocale).toBe('vi')
    const explicit = await register({ email: 'l4@example.com', preferredLocale: 'en' }, '?lang=zh')
    expect((await repo.getProfile(explicit.body.user.id)).preferredLocale).toBe('en')
  })

  it('body là mảng → 400 VALIDATION_ERROR; chuỗi / null / JSON hỏng → 400, không 500', async () => {
    const arr = await request(app).post('/api/auth/register').send([valid])
    expect(arr.status).toBe(400)
    expect(arr.body.error.code).toBe('VALIDATION_ERROR')
    for (const raw of ['"abc"', 'null', '{bad json', '123']) {
      const res = await request(app).post('/api/auth/register').set('Content-Type', 'application/json').send(raw)
      expect(res.status, raw).toBe(400)
    }
  })

  it('body gửi dạng text/plain → 400, không tạo tài khoản', async () => {
    const res = await request(app).post('/api/auth/register').set('Content-Type', 'text/plain').send(JSON.stringify(valid))
    expect(res.status).toBe(400)
    expect((await login()).status).toBe(401)
  })
})

describe('Không nâng quyền (D-38)', () => {
  it('register kèm role/id/email khác trong body không có tác dụng', async () => {
    const res = await register({ role: 'admin', id: 'fixed-id', createdAt: '2000-01-01' })
    expect(res.status).toBe(201)
    expect(res.body.user.id).not.toBe('fixed-id')
    const profile = await repo.getProfile(res.body.user.id)
    expect(profile.role).toBe('customer')
    expect(await repo.getProfile('fixed-id')).toBeNull()
  })

  it('PATCH /me với role/id/email không đổi quyền, không sửa hồ sơ người khác (IDOR)', async () => {
    const b = await registerAndLogin({ email: 'b@example.com', fullName: 'Bình' })
    const a = await registerAndLogin()
    const res = await request(app)
      .patch('/api/me')
      .set('Authorization', `Bearer ${a.accessToken}`)
      .send({ id: b.user.id, role: 'admin', email: 'hacker@example.com', fullName: 'Đã đổi' })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ id: a.user.id, email: 'an@example.com', role: 'customer', fullName: 'Đã đổi' })
    expect((await repo.getProfile(b.user.id)).fullName).toBe('Bình')
    expect((await repo.getProfile(a.user.id)).role).toBe('customer')
  })

  it('admin sửa hồ sơ vẫn giữ role admin', async () => {
    const a = await registerAndLogin()
    await repo.upsertProfile({ id: a.user.id, role: 'admin' })
    const res = await request(app).patch('/api/me').set('Authorization', `Bearer ${a.accessToken}`).send({ fullName: 'Quản trị' })
    expect(res.body.profile.role).toBe('admin')
  })
})

describe('PATCH /me — đầu vào', () => {
  let token
  beforeEach(async () => {
    token = (await registerAndLogin({ phone: '0901234567' })).accessToken
  })
  const patch = (b) => request(app).patch('/api/me').set('Authorization', `Bearer ${token}`).send(b)

  it('chỉ cập nhật trường gửi lên (partial)', async () => {
    const res = await patch({ preferredLocale: 'en' })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ fullName: 'Nguyễn An', phone: '0901234567', preferredLocale: 'en' })
  })

  it('fullName rỗng / 101 ký tự / locale lạ → 400 theo trường, không lưu gì', async () => {
    const res = await patch({ fullName: '  ', preferredLocale: 'fr', phone: '0201234567' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ fullName: 'REQUIRED', preferredLocale: 'INVALID_LOCALE', phone: 'INVALID_PHONE' })
    expect((await patch({ fullName: 'a'.repeat(101) })).body.error.fields.fullName).toBe('TOO_LONG')
    const cur = await me(token)
    expect(cur.body.profile).toMatchObject({ fullName: 'Nguyễn An', phone: '0901234567', preferredLocale: 'vi' })
  })

  it('body là mảng / JSON chuỗi → không 500', async () => {
    expect((await patch([{ fullName: 'x' }])).status).toBeLessThan(500)
    const raw = await request(app).patch('/api/me').set('Authorization', `Bearer ${token}`).set('Content-Type', 'application/json').send('"x"')
    expect(raw.status).toBe(400)
  })

  it('PATCH không có token → 401', async () => {
    expect((await request(app).patch('/api/me').send({ fullName: 'x' })).status).toBe(401)
  })
})

describe('Header Authorization', () => {
  let token
  beforeEach(async () => {
    token = (await registerAndLogin()).accessToken
  })

  it('token hợp lệ nhưng sai scheme / định dạng → 401 UNAUTHORIZED', async () => {
    const headers = [
      `Basic ${token}`,
      token,
      'Bearer',
      'Bearer ',
      `Bearer ${token} extra`,
      `Bearer${token}`,
      `Token ${token}`,
      `Bearer "${token}"`,
    ]
    for (const h of headers) {
      const res = await request(app).get('/api/me').set('Authorization', h)
      expect(res.status, h).toBe(401)
      expect(res.body.error.code, h).toBe('UNAUTHORIZED')
    }
  })

  it('scheme "bearer" chữ thường vẫn được chấp nhận', async () => {
    expect((await request(app).get('/api/me').set('Authorization', `bearer ${token}`)).status).toBe(200)
  })

  it('header rất dài → 401 (hoặc 431), không 500', async () => {
    const res = await request(app).get('/api/me').set('Authorization', `Bearer ${'a'.repeat(8000)}`)
    expect(res.status).toBe(401)
    let status
    try {
      status = (await request(app).get('/api/me').set('Authorization', `Bearer ${'a'.repeat(20000)}`)).status
    } catch {
      status = 431 // Node đóng kết nối do header quá lớn
    }
    expect([401, 431]).toContain(status)
  })

  it('refresh token dùng làm access token → 401', async () => {
    const s = await login()
    expect((await me(decodeURIComponent(cookieOf(s).split('=')[1]))).status).toBe(401)
  })
})

describe('Đăng nhập — không rò rỉ thông tin', () => {
  it('sai mật khẩu và email không tồn tại trả body giống hệt nhau', async () => {
    await register().expect(201)
    const a = await login({ password: 'sai-mat-khau' })
    const b = await login({ email: 'khong-co@example.com' })
    expect(a.status).toBe(401)
    expect(b.status).toBe(401)
    expect(a.body).toEqual(b.body)
  })

  it('body không hợp lệ (mảng, email/mật khẩu không phải chuỗi) → 401 INVALID_CREDENTIALS', async () => {
    await register().expect(201)
    for (const body of [[valid], { email: valid.email, password: ['Gio-Hoa#Sen2026'] }, { email: { $ne: '' }, password: valid.password }]) {
      const res = await request(app).post('/api/auth/login').send(body)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
    }
  })

  it('email chưa xác nhận + sai mật khẩu → 401 (không lộ trạng thái xác nhận)', async () => {
    setup({ requireEmailConfirmation: true })
    await register().expect(201)
    const res = await login({ password: 'sai-mat-khau' })
    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('mật khẩu dài hơn 72 ký tự khi đăng nhập → 401, không 500', async () => {
    await register().expect(201)
    expect((await login({ password: 'x'.repeat(10000) })).status).toBe(401)
  })
})

describe('Phiên (access token hết hạn, refresh, đăng xuất)', () => {
  it('access token hết hạn → 401; refresh vẫn cấp token mới dùng được', async () => {
    setup({ accessTtlMs: 60_000 })
    const s = await registerAndLogin()
    expect((await me(s.accessToken)).status).toBe(200)
    clock.t += 59_999
    expect((await me(s.accessToken)).status).toBe(200)
    clock.t += 1
    const expired = await me(s.accessToken)
    expect(expired.status).toBe(401)
    expect(expired.body.error.code).toBe('UNAUTHORIZED')
    const r = await refresh(s.cookie)
    expect(r.status).toBe(200)
    expect(r.body.expiresAt).toBe(Math.floor((clock.t + 60_000) / 1000))
    expect((await me(r.body.accessToken)).status).toBe(200)
  })

  it('token hết hạn không đổi được mật khẩu; đăng xuất vẫn xoá cookie và thu hồi phiên', async () => {
    setup({ accessTtlMs: 1000 })
    const s = await registerAndLogin()
    clock.t += 1000
    const change = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send({ currentPassword: valid.password, password: 'Moi-Nang#Xuan71' })
    expect(change.status).toBe(401)
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${s.accessToken}`).set('Cookie', s.cookie)
    expect(out.status).toBe(204)
    expect(out.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=; Max-Age=0/)
    expect((await refresh(s.cookie)).status).toBe(401)
  })

  it('cookie refresh thiếu / rỗng / sai → 401 UNAUTHORIZED; refreshToken trong body bị bỏ qua', async () => {
    for (const cookie of [undefined, 'lamvi_rt=', 'lamvi_rt=khong-ton-tai', 'khac=1']) {
      const req = request(app).post('/api/auth/refresh').send({ refreshToken: 'x' })
      const res = await (cookie ? req.set('Cookie', cookie) : req)
      expect(res.status).toBe(401)
      expect(res.body.error.code).toBe('UNAUTHORIZED')
    }
    const s = await registerAndLogin()
    const viaBody = await request(app).post('/api/auth/refresh').send({ refreshToken: decodeURIComponent(s.cookie.split('=')[1]) })
    expect(viaBody.status).toBe(401)
  })

  it('đăng xuất vô hiệu mọi access/refresh token của user (nhiều thiết bị), không ảnh hưởng user khác', async () => {
    const d1 = await registerAndLogin()
    const d2res = await login()
    const d2 = { ...d2res.body, cookie: cookieOf(d2res) }
    const other = await registerAndLogin({ email: 'b@example.com' })
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${d1.accessToken}`).expect(204)
    expect((await me(d1.accessToken)).status).toBe(401)
    expect((await me(d2.accessToken)).status).toBe(401)
    expect((await refresh(d1.cookie)).status).toBe(401)
    expect((await refresh(d2.cookie)).status).toBe(401)
    expect((await me(other.accessToken)).status).toBe(200)
  })

  it('đăng xuất không cần token (luôn xoá cookie) và idempotent', async () => {
    const none = await request(app).post('/api/auth/logout')
    expect(none.status).toBe(204)
    expect(none.headers['set-cookie'].join(';')).toMatch(/lamvi_rt=; Max-Age=0/)
    const s = await registerAndLogin()
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${s.accessToken}`).expect(204)
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${s.accessToken}`).expect(204)
  })

  it('GET /me tự tạo hồ sơ customer nếu tài khoản chưa có hồ sơ', async () => {
    // Tài khoản tạo ngoài API
    await auth.signUp({ email: 'ngoai@example.com', password: 'Gio-Hoa#Sen2026' })
    const s = await auth.signIn({ email: 'ngoai@example.com', password: 'Gio-Hoa#Sen2026' })
    expect(await repo.getProfile(s.user.id)).toBeNull()
    const res = await me(s.accessToken)
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ id: s.user.id, email: 'ngoai@example.com', role: 'customer', preferredLocale: 'vi', fullName: null, phone: null })
    expect(await repo.getProfile(s.user.id)).not.toBeNull()
  })

  it('PATCH /me cho tài khoản chưa có hồ sơ → tạo hồ sơ customer', async () => {
    await auth.signUp({ email: 'ngoai@example.com', password: 'Gio-Hoa#Sen2026' })
    const s = await auth.signIn({ email: 'ngoai@example.com', password: 'Gio-Hoa#Sen2026' })
    const res = await request(app).patch('/api/me').set('Authorization', `Bearer ${s.accessToken}`).send({ fullName: 'Ngoài' })
    expect(res.status).toBe(200)
    expect(res.body.profile).toMatchObject({ fullName: 'Ngoài', role: 'customer' })
  })
})

describe('Quên / đặt lại mật khẩu — bảo mật', () => {
  it('forgot-password (D-92): email đã đăng ký → 202; email chưa đăng ký → 404 EMAIL_NOT_REGISTERED, không thư', async () => {
    await register().expect(201)
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'AN@example.com ' })
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'khong-co@example.com' })
    expect(a.status).toBe(202)
    expect(b.status).toBe(404)
    expect(b.body.error.code).toBe('EMAIL_NOT_REGISTERED')
    expect(b.headers['set-cookie']).toBeUndefined()
    // email hoa thường/khoảng trắng vẫn gửi đúng người
    expect(mailer.outbox).toHaveLength(1)
    expect(mailer.outbox[0].to).toBe('an@example.com')
  })

  it('forgot-password: email sai định dạng / body mảng → 400 VALIDATION_ERROR (kiểm định dạng trước khi tra email)', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: 'sai' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.email).toBe('INVALID_EMAIL')
    const arr = await request(app).post('/api/auth/forgot-password').send([{ email: 'an@example.com' }])
    expect(arr.status).toBe(400)
    expect(arr.body.error.fields.email).toBe('REQUIRED')
  })

  it('forgot-password: ?lang=zh → link /zh/reset-password; lang lạ → mặc định vi', async () => {
    await register().expect(201)
    await request(app).post('/api/auth/forgot-password?lang=zh').send({ email: valid.email }).expect(202)
    await request(app).post('/api/auth/forgot-password?lang=xx').send({ email: valid.email }).expect(202)
    expect(mailer.outbox.map((m) => m.text.match(/https:\/\/\S+?#/)[0])).toEqual([
      'https://moc.test/zh/reset-password#',
      'https://moc.test/reset-password#',
    ])
  })

  it('reset-password vô hiệu token và mọi phiên cũ (access + refresh) của user', async () => {
    const s = await registerAndLogin()
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const rec = resetToken()
    await request(app).post('/api/auth/reset-password').send({ token: rec, password: 'Moi-Nang#Xuan71' }).expect(204)
    expect((await me(s.accessToken)).status).toBe(401)
    expect((await refresh(s.cookie)).status).toBe(401)
    expect((await request(app).post('/api/auth/reset-password').send({ token: rec, password: 'Moi-Nang#Xuan72' })).status).toBe(400)
  })

  it('reset-password: mật khẩu mới quá dài / thiếu → 400 và token vẫn còn dùng được', async () => {
    await register().expect(201)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const token = resetToken()
    const long = await request(app).post('/api/auth/reset-password').send({ token, password: 'x'.repeat(73) })
    expect(long.status).toBe(400)
    expect(long.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
    const missing = await request(app).post('/api/auth/reset-password').send({ token })
    expect(missing.body.error.fields.password).toBe('REQUIRED')
    await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Nang#Xuan71' }).expect(204)
  })

  it('reset-password: token hết hạn sau 1 giờ → 400', async () => {
    await register().expect(201)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    clock.t += 3600_000
    const res = await request(app).post('/api/auth/reset-password').send({ token: resetToken(), password: 'Moi-Nang#Xuan71' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('reset-password không gửi token → 400 INVALID_RESET_TOKEN', async () => {
    const res = await request(app).post('/api/auth/reset-password').send({ password: 'Moi-Nang#Xuan71' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN')
  })
})

describe('Adapter bộ nhớ — hành vi riêng', () => {
  it('refresh xoay vòng: refresh token mới khác cũ; token cũ không dùng lại được', async () => {
    const s = await auth.signUp({ email: 'x@example.com', password: 'Gio-Hoa#Sen2026' }).then(() =>
      auth.signIn({ email: 'x@example.com', password: 'Gio-Hoa#Sen2026' }),
    )
    const r = await auth.refresh(s.refreshToken)
    expect(r.refreshToken).not.toBe(s.refreshToken)
    await expect(auth.refresh(s.refreshToken)).rejects.toMatchObject({ code: 'UNAUTHORIZED' })
  })

  it('đăng nhập đúng mật khẩu nhưng chưa xác nhận → EMAIL_NOT_CONFIRMED; xác nhận xong đăng nhập được', async () => {
    setup({ requireEmailConfirmation: true })
    await register().expect(201)
    expect((await login()).status).toBe(403)
    auth.confirmEmail(valid.email)
    expect((await login()).status).toBe(200)
  })
})

// Kiểm thử độc lập (T-11) — G-18: đổi mật khẩu khi đang đăng nhập
describe('G-18 — /auth/change-password: biên và tác dụng phụ', () => {
  const change = (token, b) =>
    request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${token}`).send(b)

  it('đổi sang CHÍNH mật khẩu cũ → vẫn nhận (204) và vẫn thu hồi mọi phiên', async () => {
    const s = await registerAndLogin()
    await change(s.accessToken, { currentPassword: valid.password, password: valid.password }).expect(204)
    expect((await me(s.accessToken)).status).toBe(401)
    expect((await login()).status).toBe(200)
  })

  it('mật khẩu mới > 72 byte (giới hạn bcrypt) → PASSWORD_TOO_LONG, không đụng mật khẩu cũ', async () => {
    const s = await registerAndLogin()
    const res = await change(s.accessToken, { currentPassword: valid.password, password: 'x'.repeat(73) })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
    // 72 ký tự tiếng Việt có dấu = 144 byte → cũng phải bị chặn
    const utf8 = await change(s.accessToken, { currentPassword: valid.password, password: 'ố'.repeat(72) })
    expect(utf8.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
    expect((await login()).status).toBe(200)
  })

  it('mật khẩu mới không hợp lệ → phiên hiện tại KHÔNG bị thu hồi', async () => {
    const s = await registerAndLogin()
    await change(s.accessToken, { currentPassword: valid.password, password: 'ngan' }).expect(400)
    expect((await me(s.accessToken)).status).toBe(200)
  })

  it('currentPassword sai kiểu (số, mảng, rỗng) → REQUIRED, không phải 500', async () => {
    const s = await registerAndLogin()
    for (const currentPassword of [123, ['a'], { a: 1 }, '', null]) {
      const res = await change(s.accessToken, { currentPassword, password: 'Moi-Nang#Xuan71' })
      expect(res.status, JSON.stringify(currentPassword)).toBe(400)
      expect(res.body.error.fields.currentPassword).toBe('REQUIRED')
    }
    expect((await login()).status).toBe(200)
  })

  it('body là mảng → 400 (không ném lỗi)', async () => {
    const s = await registerAndLogin()
    const res = await request(app)
      .post('/api/auth/change-password')
      .set('Authorization', `Bearer ${s.accessToken}`)
      .send([{ currentPassword: valid.password, password: 'Moi-Nang#Xuan71' }])
    expect(res.status).toBe(400)
    expect((await login()).status).toBe(200)
  })

  it('xin quên mật khẩu KHÔNG làm mất phiên đang đăng nhập', async () => {
    const s = await registerAndLogin()
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email }).expect(202)
    expect((await me(s.accessToken)).status).toBe(200)
  })
})
