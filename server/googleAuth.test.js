import { afterEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'

// D-78: đăng nhập Google qua OAuth trực tiếp (GOOGLE_CLIENT_ID/SECRET), không dùng provider của Supabase
const google = { clientId: 'cid.apps.googleusercontent.com', clientSecret: 'secret' }
const base = { publicSiteUrl: 'https://moc.test', rateLimit: { enabled: false } }
let repo, auth

const idToken = (claims) =>
  `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`

function stubGoogle(claimsOverride = {}, ok = true) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url, init) => {
      stubGoogle.last = { url, body: String(init.body) }
      const nonce = stubGoogle.nonce
      return {
        ok,
        json: async () => ({
          id_token: idToken({
            iss: 'https://accounts.google.com',
            aud: google.clientId,
            exp: Math.floor(Date.now() / 1000) + 600,
            email: 'Lan@Example.com',
            email_verified: true,
            name: 'Lan Phạm',
            nonce,
            ...claimsOverride,
          }),
        }),
      }
    }),
  )
}

async function start(app, query = '') {
  const res = await request(app).get(`/api/auth/google/start?lang=en${query}`)
  const url = new URL(res.headers.location)
  stubGoogle.nonce = url.searchParams.get('nonce')
  return { res, url, cookie: res.headers['set-cookie'][0].split(';')[0] }
}

const makeApp = (cfg = { ...base, google }) => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  return createApp({ repo, auth, config: cfg })
}

afterEach(() => vi.unstubAllGlobals())

describe('Google OAuth (D-78)', () => {
  it('/auth/providers phản ánh cấu hình', async () => {
    expect((await request(makeApp()).get('/api/auth/providers')).body).toEqual({ google: true })
    expect((await request(makeApp(base)).get('/api/auth/providers')).body).toEqual({ google: false })
  })

  it('start chuyển tới Google với client_id/redirect_uri/state/nonce và đặt cookie HttpOnly', async () => {
    const { res, url } = await start(makeApp())
    expect(res.status).toBe(302)
    expect(url.origin + url.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(url.searchParams.get('client_id')).toBe(google.clientId)
    expect(url.searchParams.get('redirect_uri')).toBe('https://moc.test/api/auth/google/callback')
    expect(url.searchParams.get('scope')).toBe('openid email profile')
    expect(url.searchParams.get('state')).toBeTruthy()
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly.*SameSite=Lax.*Secure/)
  })

  it('chưa cấu hình → về /login báo GOOGLE_UNAVAILABLE', async () => {
    const res = await request(makeApp(base)).get('/api/auth/google/start')
    expect(res.headers.location).toBe('https://moc.test/login?error=GOOGLE_UNAVAILABLE')
  })

  it('callback hợp lệ: tạo tài khoản + hồ sơ, đặt cookie phiên, chuyển về /auth/callback (không token trên URL)', async () => {
    const app = makeApp()
    const { url, cookie } = await start(app, '&next=/checkout')
    stubGoogle()
    const res = await request(app)
      .get(`/api/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(302)
    const loc = new URL(res.headers.location)
    expect(loc.pathname).toBe('/en/auth/callback')
    // T-49: không có token trên URL; chỉ `next`
    expect(loc.hash).toBe('')
    expect(loc.search).toBe('?next=%2Fcheckout')
    expect(stubGoogle.last.body).toContain('client_secret=secret')
    // cookie flow bị xoá sau khi dùng; cookie phiên HttpOnly được đặt
    const cookies = res.headers['set-cookie']
    expect(cookies.find((c) => c.startsWith('lamvi_gauth='))).toContain('Max-Age=0')
    const rt = cookies.find((c) => c.startsWith('lamvi_rt='))
    expect(rt).toMatch(/HttpOnly; SameSite=Lax; Secure/)
    // trang /auth/callback đổi cookie lấy access token
    const session = await request(app).post('/api/auth/refresh').set('Cookie', rt.split(';')[0])
    expect(session.body.user.email).toBe('lan@example.com')
    const me = await request(app).get('/api/me').set('Authorization', `Bearer ${session.body.accessToken}`)
    expect(me.body.profile.fullName).toBe('Lan Phạm')
  })

  it('đăng nhập lại cùng email → cùng tài khoản, không ghi đè hồ sơ', async () => {
    const app = makeApp()
    const run = async () => {
      const { url, cookie } = await start(app)
      stubGoogle()
      const res = await request(app)
        .get(`/api/auth/google/callback?code=abc&state=${url.searchParams.get('state')}`)
        .set('Cookie', cookie)
      const rt = res.headers['set-cookie'].find((c) => c.startsWith('lamvi_rt=')).split(';')[0]
      return (await request(app).post('/api/auth/refresh').set('Cookie', rt)).body.user.id
    }
    expect(await run()).toBe(await run())
  })

  it.each([
    ['sai state', { state: 'x' }, {}],
    ['email chưa xác minh', {}, { email_verified: false }],
    ['sai aud', {}, { aud: 'khac' }],
    ['sai nonce', {}, { nonce: 'khac' }],
    ['token hết hạn', {}, { exp: 1 }],
  ])('%s → về /login báo GOOGLE_FAILED', async (_n, q, claims) => {
    const app = makeApp()
    const { url, cookie } = await start(app)
    stubGoogle(claims)
    const state = q.state ?? url.searchParams.get('state')
    const res = await request(app).get(`/api/auth/google/callback?code=abc&state=${state}`).set('Cookie', cookie)
    expect(res.headers.location).toBe('https://moc.test/en/login?error=GOOGLE_FAILED')
  })

  it('không có cookie hoặc cookie bị sửa → GOOGLE_FAILED', async () => {
    const app = makeApp()
    const { url, cookie } = await start(app)
    stubGoogle()
    const s = url.searchParams.get('state')
    const none = await request(app).get(`/api/auth/google/callback?code=a&state=${s}`)
    expect(none.headers.location).toContain('GOOGLE_FAILED')
    const forged = await request(app).get(`/api/auth/google/callback?code=a&state=${s}`).set('Cookie', cookie + 'x')
    expect(forged.headers.location).toContain('GOOGLE_FAILED')
  })

  it('người dùng huỷ ở Google → GOOGLE_CANCELLED; Google từ chối đổi code → GOOGLE_FAILED', async () => {
    const app = makeApp()
    let f = await start(app)
    let res = await request(app)
      .get(`/api/auth/google/callback?error=access_denied&state=${f.url.searchParams.get('state')}`)
      .set('Cookie', f.cookie)
    expect(res.headers.location).toContain('GOOGLE_CANCELLED')
    f = await start(app)
    stubGoogle({}, false)
    res = await request(app)
      .get(`/api/auth/google/callback?code=a&state=${f.url.searchParams.get('state')}`)
      .set('Cookie', f.cookie)
    expect(res.headers.location).toContain('GOOGLE_FAILED')
  })

  it('next ngoài site bị bỏ (chống open redirect)', async () => {
    const app = makeApp()
    const { url, cookie } = await start(app, '&next=//evil.com')
    stubGoogle()
    const res = await request(app)
      .get(`/api/auth/google/callback?code=a&state=${url.searchParams.get('state')}`)
      .set('Cookie', cookie)
    expect(new URL(res.headers.location).search).toBe('')
  })
})
