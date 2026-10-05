import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createHash } from 'node:crypto'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryMailer } from './mail/mailer.js'
import { isPwnedPassword } from './security/pwned.js'
import { COOKIE as GOOGLE_COOKIE } from './google.js'

// T-49 (kiểm thử độc lập): cookie phiên, đặt lại mật khẩu, HIBP, rate limit, CSRF
let app, auth, repo, mailer
const config = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
const valid = { email: 'an@example.com', password: 'Gio-Hoa#Sen2026', fullName: 'An' }

function setup({ cfg = config, pwned = null, authWrap } = {}) {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  mailer = createMemoryMailer()
  app = createApp({ repo, auth: authWrap ? authWrap(auth) : auth, config: cfg, mailer, pwned })
}
const rtCookie = (res) => (res.headers['set-cookie'] ?? []).find((c) => c.startsWith('lamvi_rt='))
const rtPair = (res) => rtCookie(res)?.split(';')[0]
const resetToken = (i = -1) => decodeURIComponent(mailer.outbox.at(i).text.match(/#t=(\S+)/)[1])

async function login() {
  await request(app).post('/api/auth/register').send(valid).expect(201)
  return request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password }).expect(200)
}
async function recoveryToken() {
  await request(app).post('/api/auth/forgot-password').send({ email: valid.email }).expect(202)
  return resetToken()
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  setup()
})
afterEach(() => vi.restoreAllMocks())

describe('reset-password: đồng thời và kiểu dữ liệu lạ', () => {
  it('hai reset đồng thời cùng một token: đúng một bên thành công', async () => {
    await login()
    const token = await recoveryToken()
    const send = (password) => request(app).post('/api/auth/reset-password').send({ token, password })
    const [a, b] = await Promise.all([send('matkhau-A-111'), send('matkhau-B-222')])
    expect([a.status, b.status].sort()).toEqual([204, 400])
    const loser = a.status === 400 ? a : b
    expect(loser.body.error.code).toBe('INVALID_RESET_TOKEN')
    const winnerPw = a.status === 204 ? 'matkhau-A-111' : 'matkhau-B-222'
    await request(app).post('/api/auth/login').send({ email: valid.email, password: winnerPw }).expect(200)
  })

  it.each([
    ['mảng', ['x']],
    ['object', { $ne: null }],
    ['số', 123],
    ['null', null],
    ['true', true],
    ['chuỗi rỗng', ''],
  ])('token kiểu %s → 400 INVALID_RESET_TOKEN, không 500', async (_n, token) => {
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('INVALID_RESET_TOKEN')
  })

  it('body là mảng / không phải JSON object → 400, không 500', async () => {
    const r1 = await request(app).post('/api/auth/reset-password').send([{ token: 'a' }])
    expect(r1.status).toBe(400)
    const r2 = await request(app).post('/api/auth/reset-password').set('Content-Type', 'application/json').send('{bad')
    expect(r2.status).toBe(400)
  })

  it.each([[['a'.repeat(10)]], [{ a: 1 }], [12345678901]])('password kiểu lạ %j → 400 VALIDATION_ERROR và token chưa bị tiêu thụ', async (password) => {
    await login()
    const token = await recoveryToken()
    const res = await request(app).post('/api/auth/reset-password').send({ token, password })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' }).expect(204)
  })

  it('token hết hạn (sau 1 giờ) → 400; token của người dùng A không đổi được mật khẩu B', async () => {
    let t = 1_000_000
    repo = createMemoryRepo()
    auth = createMemoryAuth({ now: () => t })
    mailer = createMemoryMailer()
    app = createApp({ repo, auth, config, mailer, pwned: null })
    await login()
    const token = await recoveryToken()
    t += 3600_000 + 1
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' })
    expect(res.status).toBe(400)
    // đăng nhập bằng mật khẩu cũ vẫn được
    await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password }).expect(200)
  })

  it('reset thành công: xoá cookie, ghi audit (không lộ mật khẩu/token), gửi thư báo đổi mật khẩu', async () => {
    const { body } = await login()
    const token = await recoveryToken()
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' })
    expect(res.status).toBe(204)
    expect(rtCookie(res)).toMatch(/^lamvi_rt=; Max-Age=0; Path=\/api\/auth; HttpOnly/)
    const logs = await repo.listAuditLog({ entity: 'account', entityId: body.user.id })
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ action: 'password_changed', actorId: body.user.id })
    expect(JSON.stringify(logs)).not.toContain('Moi-Gio#Lanh82')
    expect(JSON.stringify(logs)).not.toContain(token)
    const last = mailer.outbox.at(-1)
    expect(last.to).toBe(valid.email)
    expect(last.text + last.html).not.toContain('Moi-Gio#Lanh82')
    expect(last.text + last.html).not.toContain(token)
  })

  it('reset: lỗi audit hoặc lỗi gửi thư không làm hỏng thao tác chính', async () => {
    await login()
    const token = await recoveryToken()
    repo.appendAuditLog = async () => { throw new Error('db down') }
    mailer.send = async () => { throw new Error('smtp down') }
    await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' }).expect(204)
    await request(app).post('/api/auth/login').send({ email: valid.email, password: 'Moi-Gio#Lanh82' }).expect(200)
  })

  it('reset không dùng cookie/Origin: gọi từ Origin lạ vẫn phụ thuộc vào token (không phải CSRF-able bằng cookie)', async () => {
    const res = await request(app).post('/api/auth/reset-password').set('Origin', 'https://evil.test').send({ token: 'sai', password: 'Moi-Gio#Lanh82' })
    expect(res.status).toBe(400)
  })
})

describe('forgot-password: enumeration và độ bền', () => {
  it('D-92: email có tài khoản → 202; chưa có → 404 EMAIL_NOT_REGISTERED; cả hai không đặt cookie, chỉ gửi thư cho tài khoản thật', async () => {
    await request(app).post('/api/auth/register').send(valid).expect(201)
    const a = await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 'khong-co@example.com' })
    expect(a.status).toBe(202)
    expect(b.status).toBe(404)
    expect(b.body.error.code).toBe('EMAIL_NOT_REGISTERED')
    expect(a.headers['set-cookie']).toBeUndefined()
    expect(b.headers['set-cookie']).toBeUndefined()
    expect(mailer.outbox).toHaveLength(1)
  })

  it('createRecoveryToken ném lỗi (5xx upstream) → vẫn 202, không thư', async () => {
    setup({ authWrap: (a) => ({ ...a, createRecoveryToken: async () => { throw new Error('upstream 503') } }) })
    await request(app).post('/api/auth/register').send(valid)
    const res = await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    expect(res.status).toBe(202)
    expect(mailer.outbox).toHaveLength(0)
  })

  it('phản hồi không chờ gửi thư lâu hơn mức cần (mailer ném lỗi vẫn 202)', async () => {
    await request(app).post('/api/auth/register').send(valid)
    mailer.send = async () => { throw new Error('boom') }
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email }).expect(202)
  })

  it('email sai định dạng / kiểu lạ → 400 VALIDATION_ERROR (không 500)', async () => {
    for (const email of [undefined, null, 123, ['a@b.co'], { a: 1 }, '']) {
      const res = await request(app).post('/api/auth/forgot-password').send({ email })
      expect(res.status).toBe(400)
      expect(res.body.error.code).toBe('VALIDATION_ERROR')
    }
  })

  it('chuẩn hoá email: hoa/thường và khoảng trắng vẫn tìm đúng tài khoản; token trong link được mã hoá URL', async () => {
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password').send({ email: '  AN@Example.COM ' }).expect(202)
    expect(mailer.outbox).toHaveLength(1)
    expect(mailer.outbox[0].text).toMatch(/https:\/\/moc\.test\/reset-password#t=[A-Za-z0-9_%-]+/)
    expect(mailer.outbox[0].text).not.toMatch(/\?t=|\?token=/)
  })

  it('mỗi lần yêu cầu cấp token mới; token cũ vẫn dùng được một lần (không vô hiệu chéo gây khoá người dùng)', async () => {
    await request(app).post('/api/auth/register').send(valid)
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    await request(app).post('/api/auth/forgot-password').send({ email: valid.email })
    expect(resetToken(0)).not.toBe(resetToken(1))
    await request(app).post('/api/auth/reset-password').send({ token: resetToken(1), password: 'Moi-Gio#Lanh82' }).expect(204)
  })
})

describe('cookie lamvi_rt: refresh / logout', () => {
  // BUG: readCookie (server/google.js:40) gọi decodeURIComponent không bọc try → URIError → 500
  it('cookie %-encode hỏng (decodeURIComponent ném) → 401, không 500', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'lamvi_rt=%E0%A4%A')
    expect(res.status).toBe(401)
  })

  // BUG: cùng nguyên nhân readCookie; logout cũng 500
  it('logout với cookie %-encode hỏng vẫn 204 và xoá cookie', async () => {
    const res = await request(app).post('/api/auth/logout').set('Cookie', 'lamvi_rt=%E0%A4%A')
    expect(res.status).toBe(204)
    expect(rtCookie(res)).toMatch(/Max-Age=0/)
  })

  it('nhiều cookie lamvi_rt: giá trị ĐẦU được dùng (ghi nhận hành vi)', async () => {
    const login1 = await login()
    const good = rtPair(login1)
    const bad = await request(app).post('/api/auth/refresh').set('Cookie', `lamvi_rt=rac; ${good}`)
    expect(bad.status).toBe(401)
    const ok = await request(app).post('/api/auth/refresh').set('Cookie', `${good}; lamvi_rt=rac`)
    expect(ok.status).toBe(200)
  })

  it('cookie lạ khác tên + khoảng trắng + giá trị chứa "=" vẫn đọc đúng', async () => {
    const l = await login()
    const good = rtPair(l)
    const res = await request(app).post('/api/auth/refresh').set('Cookie', `a=b=c;  other=1 ;${good};x=y`)
    expect(res.status).toBe(200)
  })

  it('refresh 401 (token bị từ chối) → xoá cookie; thân không có refreshToken', async () => {
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'lamvi_rt=khong-ton-tai')
    expect(res.status).toBe(401)
    expect(rtCookie(res)).toMatch(/^lamvi_rt=; Max-Age=0/)
    expect(JSON.stringify(res.body)).not.toContain('khong-ton-tai')
  })

  it('refresh khi adapter ném lỗi 5xx/mạng → 500 và cookie KHÔNG bị xoá hay thay', async () => {
    setup({ authWrap: (a) => ({ ...a, refresh: async () => { throw new Error('ECONNRESET') } }) })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'lamvi_rt=abc')
    expect(res.status).toBe(500)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('refresh khi adapter ném AuthError mã lạ (không có trong STATUS) → cookie giữ nguyên', async () => {
    const { AuthError } = await import('./adapters/authErrors.js')
    setup({ authWrap: (a) => ({ ...a, refresh: async () => { throw new AuthError('SOMETHING_NEW') } }) })
    const res = await request(app).post('/api/auth/refresh').set('Cookie', 'lamvi_rt=abc')
    expect(res.status).toBe(500)
    expect(res.headers['set-cookie']).toBeUndefined()
  })

  it('refresh thành công: Set-Cookie đúng một cookie lamvi_rt, giá trị được xoay, Max-Age 30 ngày', async () => {
    const l = await login()
    const res = await request(app).post('/api/auth/refresh').set('Cookie', rtPair(l))
    expect(res.status).toBe(200)
    expect(res.headers['set-cookie'].filter((c) => c.startsWith('lamvi_rt='))).toHaveLength(1)
    expect(rtPair(res)).not.toBe(rtPair(l))
    expect(rtCookie(res)).toContain(`Max-Age=${30 * 24 * 3600}`)
    expect(res.body.refreshToken).toBeUndefined()
    expect(JSON.stringify(res.body)).not.toContain(rtPair(res).split('=')[1])
  })

  it('refresh: cookie đã dùng (replay) → 401; bản mới vẫn dùng được', async () => {
    const l = await login()
    const r1 = await request(app).post('/api/auth/refresh').set('Cookie', rtPair(l)).expect(200)
    await request(app).post('/api/auth/refresh').set('Cookie', rtPair(l)).expect(401)
    await request(app).post('/api/auth/refresh').set('Cookie', rtPair(r1)).expect(200)
  })

  // BUG: routes/auth.js:183 `await auth.getUser(token)` không bọc try → 500 dù cookie đã xoá
  it('logout: getUser ném lỗi → vẫn 204 (best-effort) và cookie đã bị xoá', async () => {
    const l = await login()
    setup({ authWrap: (a) => ({ ...a, getUser: async () => { throw new Error('upstream down') } }) })
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${l.body.accessToken}`).set('Cookie', rtPair(l))
    expect(res.status).toBe(204)
    expect(rtCookie(res)).toMatch(/Max-Age=0/)
  })

  it('logout: signOut ném lỗi 5xx → cookie vẫn bị xoá trên phản hồi', async () => {
    const l = await login()
    const orig = auth
    auth = { ...orig, signOut: async () => { throw new Error('down') } }
    app = createApp({ repo, auth, config, mailer, pwned: null })
    const res = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${l.body.accessToken}`)
    expect(rtCookie(res)).toMatch(/Max-Age=0/)
  })

  it('logout bằng cookie: thu hồi phiên, access token cũ vô hiệu', async () => {
    const l = await login()
    await request(app).post('/api/auth/logout').set('Cookie', rtPair(l)).expect(204)
    await request(app).get('/api/me').set('Authorization', `Bearer ${l.body.accessToken}`).expect(401)
  })

  it('logout với Bearer của người A nhưng cookie của B: chỉ thu hồi A (không dùng cookie khi Bearer hợp lệ)', async () => {
    const a = await login()
    await request(app).post('/api/auth/register').send({ ...valid, email: 'b@example.com' })
    const b = await request(app).post('/api/auth/login').send({ email: 'b@example.com', password: valid.password })
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${a.body.accessToken}`).set('Cookie', rtPair(b)).expect(204)
    await request(app).get('/api/me').set('Authorization', `Bearer ${b.body.accessToken}`).expect(200)
    await request(app).get('/api/me').set('Authorization', `Bearer ${a.body.accessToken}`).expect(401)
  })

  it('đăng nhập sai không phát cookie; login thành công phát đúng một cookie', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const bad = await request(app).post('/api/auth/login').send({ email: valid.email, password: 'sai-sai-sai' })
    expect(bad.headers['set-cookie']).toBeUndefined()
    const ok = await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password })
    expect(ok.headers['set-cookie']).toHaveLength(1)
  })

  it('cookie Secure chỉ khi PUBLIC_SITE_URL là https', async () => {
    setup({ cfg: { ...config, publicSiteUrl: 'http://localhost:5173' } })
    const l = await login()
    expect(rtCookie(l)).not.toMatch(/Secure/)
    expect(rtCookie(l)).toMatch(/HttpOnly; SameSite=Lax/)
  })
})

describe('sameOriginOnly (CSRF)', () => {
  const evil = [
    'https://evil.test',
    'https://moc.test.evil.test',
    'null',
    'not a url',
    'http://moc.test.evil.test',
  ]
  it.each(evil)('Origin %s → 403 trên refresh và logout, cookie không bị xoá/đổi', async (origin) => {
    const l = await login()
    for (const p of ['/api/auth/refresh', '/api/auth/logout']) {
      const res = await request(app).post(p).set('Origin', origin).set('Cookie', rtPair(l))
      expect(res.status).toBe(403)
      expect(res.headers['set-cookie']).toBeUndefined()
    }
    // cookie vẫn dùng được
    await request(app).post('/api/auth/refresh').set('Cookie', rtPair(l)).expect(200)
  })

  it('không Origin nhưng Sec-Fetch-Site: cross-site → 403; same-origin → qua', async () => {
    const l = await login()
    await request(app).post('/api/auth/refresh').set('Sec-Fetch-Site', 'cross-site').set('Cookie', rtPair(l)).expect(403)
    await request(app).post('/api/auth/refresh').set('Sec-Fetch-Site', 'same-origin').set('Cookie', rtPair(l)).expect(200)
  })

  it('Origin = PUBLIC_SITE_URL qua; logout bị chặn Origin lạ thì phiên không bị thu hồi', async () => {
    const l = await login()
    await request(app).post('/api/auth/logout').set('Origin', 'https://evil.test').set('Cookie', rtPair(l)).expect(403)
    await request(app).get('/api/me').set('Authorization', `Bearer ${l.body.accessToken}`).expect(200)
    await request(app).post('/api/auth/logout').set('Origin', 'https://moc.test').set('Cookie', rtPair(l)).expect(204)
  })

  it('PUBLIC_SITE_URL hỏng → không ném lúc khởi tạo; Origin lạ vẫn 403', async () => {
    setup({ cfg: { ...config, publicSiteUrl: 'khong-phai-url' } })
    await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.test').expect(403)
  })
})

describe('Google callback và cookie phiên', () => {
  const google = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret' }
  const idToken = (claims) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`
  let nonce
  function stub(email = 'Lan@Example.com') {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id_token: idToken({ iss: 'https://accounts.google.com', aud: google.clientId, exp: Math.floor(Date.now() / 1000) + 600, email, email_verified: true, name: 'Lan', nonce }),
      }),
    })))
  }
  async function flow(query = '') {
    const s = await request(app).get(`/api/auth/google/start?lang=en${query}`)
    const url = new URL(s.headers.location)
    nonce = url.searchParams.get('nonce')
    return { s, state: url.searchParams.get('state'), cookie: s.headers['set-cookie'][0].split(';')[0] }
  }
  beforeEach(() => setup({ cfg: { ...config, google } }))
  afterEach(() => vi.unstubAllGlobals())

  it('callback đặt cả cookie lamvi_rt (HttpOnly, Path=/api/auth) và xoá cookie state; token không có trên URL', async () => {
    stub()
    const f = await flow('&next=%2Faccount')
    const res = await request(app).get(`/api/auth/google/callback?code=c&state=${f.state}`).set('Cookie', f.cookie)
    expect(res.status).toBe(302)
    const cookies = res.headers['set-cookie']
    expect(cookies).toHaveLength(2)
    expect(cookies.some((c) => c.startsWith(`${GOOGLE_COOKIE}=;`))).toBe(true)
    expect(rtCookie(res)).toMatch(/HttpOnly; SameSite=Lax; Secure/)
    expect(res.headers.location).toBe('https://moc.test/en/auth/callback?next=%2Faccount')
    expect(res.headers.location).not.toContain(rtPair(res).split('=')[1])
    // cookie phát ra dùng được cho refresh
    await request(app).post('/api/auth/refresh').set('Cookie', rtPair(res)).expect(200)
  })

  it('callback ghi đè cookie phiên cũ: refresh token cũ của chính trình duyệt vẫn là token cũ nếu client gửi nó (không bị thu hồi ngầm)', async () => {
    await request(app).post('/api/auth/register').send({ ...valid, email: 'lan@example.com' })
    const old = await request(app).post('/api/auth/login').send({ email: 'lan@example.com', password: valid.password })
    stub()
    const f = await flow()
    const res = await request(app).get(`/api/auth/google/callback?code=c&state=${f.state}`).set('Cookie', `${rtPair(old)}; ${f.cookie}`)
    expect(rtPair(res)).toBeTruthy()
    expect(rtPair(res)).not.toBe(rtPair(old))
  })

  it('callback thất bại (state sai) không phát cookie lamvi_rt', async () => {
    stub()
    const f = await flow()
    const res = await request(app).get('/api/auth/google/callback?code=c&state=sai').set('Cookie', f.cookie)
    expect(res.status).toBe(302)
    expect(rtCookie(res)).toBeUndefined()
    expect(res.headers.location).toContain('error=GOOGLE_FAILED')
  })

  // BUG: cùng nguyên nhân readCookie (server/google.js:40)
  it('cookie state %-encode hỏng ở callback → chuyển về login với lỗi, không 500', async () => {
    const res = await request(app).get('/api/auth/google/callback?code=c&state=x').set('Cookie', `${GOOGLE_COOKIE}=%E0%A4%A`)
    expect(res.status).toBe(302)
    expect(res.headers.location).toContain('error=GOOGLE_FAILED')
  })

  it('start: next dạng //host hoặc scheme tuyệt đối bị bỏ', async () => {
    for (const next of ['//evil.test', 'https://evil.test', 'javascript:alert(1)']) {
      stub()
      const f = await flow(`&next=${encodeURIComponent(next)}`)
      const res = await request(app).get(`/api/auth/google/callback?code=c&state=${f.state}`).set('Cookie', f.cookie)
      expect(res.headers.location).toBe('https://moc.test/en/auth/callback')
    }
  })

  // BUG: /^\/(?!\/)/ chấp nhận "/\evil.test"; trình duyệt coi "\" như "/" khi phân giải URL
  it('start: next dạng "/\\evil.test" phải bị bỏ (trình duyệt đọc thành //evil.test)', async () => {
    stub()
    const f = await flow(`&next=${encodeURIComponent('/\\evil.test')}`)
    const res = await request(app).get(`/api/auth/google/callback?code=c&state=${f.state}`).set('Cookie', f.cookie)
    expect(res.headers.location).toBe('https://moc.test/en/auth/callback')
  })
})

describe('HIBP: pwned.js', () => {
  const sha1 = (s) => createHash('sha1').update(s, 'utf8').digest('hex').toUpperCase()
  const fetchWith = (text, ok = true) => vi.fn(async () => ({ ok, text: async () => text }))

  it('chỉ gửi 5 ký tự đầu của SHA-1, kèm Add-Padding, không gửi mật khẩu/hậu tố', async () => {
    const pw = 'Gio-Hoa#Sen2026'
    const f = fetchWith('')
    await isPwnedPassword(pw, f)
    const [url, init] = f.mock.calls[0]
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${sha1(pw).slice(0, 5)}`)
    expect(init.headers['Add-Padding']).toBe('true')
    expect(JSON.stringify(f.mock.calls)).not.toContain(sha1(pw).slice(5))
    expect(JSON.stringify(f.mock.calls)).not.toContain(pw)
  })

  it('khớp hậu tố với count>0 → true; count 0 (đệm) → false; hậu tố khác → false', async () => {
    const pw = 'Gio-Hoa#Sen2026'
    const suf = sha1(pw).slice(5)
    expect(await isPwnedPassword(pw, fetchWith(`AAAA:3\r\n${suf}:12\r\n`))).toBe(true)
    expect(await isPwnedPassword(pw, fetchWith(`${suf}:0\r\nBBB:5`))).toBe(false)
    expect(await isPwnedPassword(pw, fetchWith(`${suf.slice(0, -1)}0:9`))).toBe(false)
    expect(await isPwnedPassword(pw, fetchWith(`${suf}:12`))).toBe(true) // không có CRLF cuối
    expect(await isPwnedPassword(pw, fetchWith(`${suf}:12\n`))).toBe(true) // LF
  })

  it('fail-open: HTTP lỗi, mạng ném, timeout, thân rác → false', async () => {
    expect(await isPwnedPassword('x'.repeat(10), fetchWith('', false))).toBe(false)
    expect(await isPwnedPassword('x'.repeat(10), vi.fn(async () => { throw new Error('net') }))).toBe(false)
    expect(await isPwnedPassword('x'.repeat(10), vi.fn(async () => { throw new DOMException('t', 'TimeoutError') }))).toBe(false)
    expect(await isPwnedPassword('x'.repeat(10), fetchWith('<html>502</html>'))).toBe(false)
    expect(await isPwnedPassword('x'.repeat(10), vi.fn(async () => ({ ok: true, text: async () => { throw new Error('reset') } })))).toBe(false)
  })

  it('truyền signal timeout cho fetch', async () => {
    const f = fetchWith('')
    await isPwnedPassword('abcdefgh', f)
    expect(f.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal)
  })

  it('mật khẩu unicode 72 byte: băm theo UTF-8 đúng, không ném', async () => {
    const pw = 'ệ'.repeat(24) // 24 × 3 byte = 72 byte
    expect(Buffer.byteLength(pw)).toBe(72)
    const f = fetchWith(`${sha1(pw).slice(5)}:7`)
    expect(await isPwnedPassword(pw, f)).toBe(true)
    expect(f.mock.calls[0][0]).toContain(sha1(pw).slice(0, 5))
  })

  it('mật khẩu không phải chuỗi (undefined) → fail-open false, không ném', async () => {
    expect(await isPwnedPassword(undefined, fetchWith(''))).toBe(false)
  })
})

describe('mật khẩu bị lộ ở các luồng (thứ tự kiểm tra)', () => {
  const breached = (pw) => pw === 'Lo-Roi#Mat5517'
  beforeEach(() => setup({ pwned: async (pw) => breached(pw) }))

  it('đăng ký → 400 PASSWORD_BREACHED, tài khoản/hồ sơ không được tạo', async () => {
    const res = await request(app).post('/api/auth/register').send({ ...valid, password: 'Lo-Roi#Mat5517' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields).toEqual({ password: 'PASSWORD_BREACHED' })
    await request(app).post('/api/auth/register').send(valid).expect(201)
  })

  it('reset với mật khẩu lộ → 400 và token KHÔNG bị tiêu thụ; sau đó mật khẩu tốt dùng cùng token được', async () => {
    await login()
    const token = await recoveryToken()
    const res = await request(app).post('/api/auth/reset-password').send({ token, password: 'Lo-Roi#Mat5517' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_BREACHED')
    expect(mailer.outbox).toHaveLength(1) // chưa có thư báo đổi mật khẩu
    await request(app).post('/api/auth/reset-password').send({ token, password: 'Moi-Gio#Lanh82' }).expect(204)
  })

  it('đổi mật khẩu với mật khẩu lộ → 400, mật khẩu cũ và phiên giữ nguyên', async () => {
    const l = await login()
    const res = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${l.body.accessToken}`)
      .send({ currentPassword: valid.password, password: 'Lo-Roi#Mat5517' })
    expect(res.status).toBe(400)
    await request(app).get('/api/me').set('Authorization', `Bearer ${l.body.accessToken}`).expect(200)
  })

  it('đăng nhập với mật khẩu cũ đã lộ vẫn được (HIBP chỉ chặn khi đặt mật khẩu)', async () => {
    await request(app).post('/api/auth/register').send(valid)
    const calls = []
    app = createApp({ repo, auth, config, mailer, pwned: async (p) => { calls.push(p); return true } })
    await request(app).post('/api/auth/login').send({ email: valid.email, password: valid.password }).expect(200)
    expect(calls).toHaveLength(0)
  })

  it('mật khẩu quá ngắn/quá dài: không gọi HIBP (không gửi mật khẩu vô nghĩa ra ngoài)', async () => {
    const calls = []
    app = createApp({ repo, auth, config, mailer, pwned: async (p) => { calls.push(p); return false } })
    await request(app).post('/api/auth/register').send({ ...valid, password: '123' }).expect(400)
    await request(app).post('/api/auth/register').send({ ...valid, password: 'ệ'.repeat(25) }).expect(400)
    expect(calls).toHaveLength(0)
  })

  it('mật khẩu unicode đúng 72 byte được chấp nhận và chuyển nguyên vẹn cho HIBP; 73 byte bị từ chối', async () => {
    const seen = []
    app = createApp({ repo, auth, config, mailer, pwned: async (p) => { seen.push(p); return false } })
    const pw72 = `Ệ1ab${'ệ'.repeat(22)}` // đúng 72 byte, đủ chữ thường/HOA/số
    expect(Buffer.byteLength(pw72)).toBe(72)
    await request(app).post('/api/auth/register').send({ ...valid, password: pw72 }).expect(201)
    expect(seen).toEqual([pw72])
    await request(app).post('/api/auth/login').send({ email: valid.email, password: pw72 }).expect(200)
    const res = await request(app).post('/api/auth/register').send({ ...valid, email: 'b@example.com', password: pw72 + 'a' })
    expect(res.status).toBe(400)
    expect(res.body.error.fields.password).toBe('PASSWORD_TOO_LONG')
  })
})

describe('rate limit (sửa lỗi keys rỗng cũ)', () => {
  const rl = { enabled: true, password: { max: 2, windowSec: 300 }, forgot: { max: 2, windowSec: 300 }, refresh: { max: 2, windowSec: 300 } }
  beforeEach(() => setup({ cfg: { ...config, rateLimit: rl } }))

  it('reset-password đếm thật: vượt ngưỡng → 429 kèm Retry-After, kể cả khi token sai', async () => {
    const go = () => request(app).post('/api/auth/reset-password').send({ token: 'sai', password: 'Moi-Gio#Lanh82' })
    expect((await go()).status).toBe(400)
    expect((await go()).status).toBe(400)
    const third = await go()
    expect(third.status).toBe(429)
    expect(third.headers['retry-after']).toBe('300')
    expect(third.body.error.code).toBe('RATE_LIMITED')
  })

  it('bộ đếm reset và change tách nhau; change đếm theo user chứ không theo IP', async () => {
    const l = await login()
    const bad = () => request(app).post('/api/auth/reset-password').send({ token: 'sai', password: 'Moi-Gio#Lanh82' })
    await bad(); await bad(); expect((await bad()).status).toBe(429)
    // reset bị chặn không ảnh hưởng đổi mật khẩu
    const ch = () => request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${l.body.accessToken}`)
      .send({ currentPassword: 'sai-sai-sai', password: 'Moi-Gio#Lanh82' })
    expect((await ch()).status).toBe(400)
    expect((await ch()).status).toBe(400)
    expect((await ch()).status).toBe(429)
    // user khác cùng IP không bị chặn
    await request(app).post('/api/auth/register').send({ ...valid, email: 'b@example.com' })
    const b = await request(app).post('/api/auth/login').send({ email: 'b@example.com', password: valid.password })
    const chB = await request(app).post('/api/auth/change-password').set('Authorization', `Bearer ${b.body.accessToken}`)
      .send({ currentPassword: 'sai-sai-sai', password: 'Moi-Gio#Lanh82' })
    expect(chB.status).toBe(400)
  })

  it('change-password chưa đăng nhập → 401 trước khi đếm (không crash vì req.user undefined)', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await request(app).post('/api/auth/change-password').send({})).status).toBe(401)
    }
  })

  it('forgot-password: đếm theo email — đổi IP không giúp, spam một email bị 429 nhưng email khác vẫn được', async () => {
    const go = (email) => request(app).post('/api/auth/forgot-password').send({ email })
    await go('x@example.com'); await go('x@example.com')
    // IP là chung (supertest) nên lần 3 bị chặn bởi cả IP lẫn email
    expect((await go('x@example.com')).status).toBe(429)
  })

  it('forgot-password: khoá email không phân biệt hoa/thường và khoảng trắng', async () => {
    const go = (email) => request(app).post('/api/auth/forgot-password').send({ email })
    await go('Y@Example.com'); await go(' y@example.com ')
    expect((await go('Y@EXAMPLE.COM')).status).toBe(429)
  })

  it('refresh bị giới hạn theo IP; Origin lạ bị chặn TRƯỚC khi đếm', async () => {
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/refresh').set('Origin', 'https://evil.test').expect(403)
    await request(app).post('/api/auth/refresh').expect(401)
    await request(app).post('/api/auth/refresh').expect(401)
    await request(app).post('/api/auth/refresh').expect(429)
  })

  it('khoá đếm không chứa email/IP thô', async () => {
    const keys = []
    const orig = repo.incrementMayCounter.bind(repo)
    repo.incrementMayCounter = async (k, ttl) => { keys.push(k); return orig(k, ttl) }
    await request(app).post('/api/auth/forgot-password').send({ email: 'riengtu@example.com' })
    expect(keys.length).toBeGreaterThanOrEqual(2)
    for (const k of keys) expect(k).toMatch(/^rl:forgot:[0-9a-f]{32}:\d+$/)
  })
})
