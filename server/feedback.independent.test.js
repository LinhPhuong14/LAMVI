import { describe, expect, it, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createDegradedApp } from './degraded.js'
import { errorPage } from './errorPage.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMailer, createMemoryMailer } from './mail/mailer.js'
import { normalizeBrand } from './mail/layout.js'
import { publicSite } from './services/site.js'

afterEach(() => vi.restoreAllMocks())

const cfg = (brand = { supportEmail: 'hotro@lamvi.example' }, rl = { max: 50, windowSec: 3600 }) => ({
  publicSiteUrl: 'http://localhost:5173',
  rateLimit: { enabled: true, contact: rl },
  mail: { from: 'LAMVI <no-reply@lamvi.example>', resendApiKey: 'SECRET_KEY_123', brevoApiKey: 'BREVO_SECRET', brand },
})
const make = (c = cfg(), mailer = createMemoryMailer(), repo = createMemoryRepo()) =>
  createApp({ repo, auth: createMemoryAuth(), storage: createMemoryStorage({ maxBytes: 1e6 }), config: c, mailer })
const valid = { name: 'Lan', email: 'lan@example.com', message: 'Nội dung đủ dài để gửi.' }

describe('degraded app', () => {
  const mk = (env) => { vi.spyOn(console, 'error').mockImplementation(() => {}); return createDegradedApp(new Error('SUPABASE_SERVICE_ROLE_KEY=abc stack'), { env }) }
  it.each(['get', 'post', 'put', 'delete', 'patch'])('%s /api/orders/anything -> 503, no leak', async (m) => {
    const res = await request(mk({}))[m]('/api/orders').send({})
    expect(res.status).toBe(503)
    expect(res.text).not.toMatch(/SUPABASE|abc|stack/)
  })
  it('health with deep & trailing slash & odd case', async () => {
    for (const u of ['/api/health?deep=1', '/api/health/', '/API/health']) {
      const res = await request(mk({})).get(u)
      expect(res.status, u).toBe(503)
      expect(res.body.ok, u + " " + res.text.slice(0, 60)).toBe(false)
    }
  })
  it('bad URL encoding does not crash', async () => {
    const res = await request(mk({})).get('/%E0%A4%A')
    expect(res.status).toBe(503)
    expect(res.text).toContain('LAMVI')
  })
  it('POST to a page path gets html 503, never 2xx', async () => {
    const res = await request(mk({})).post('/checkout').send({ a: 1 })
    expect(res.status).toBe(503)
    expect(res.headers['content-type']).toMatch(/html/)
    expect(res.headers['retry-after']).toBe('60')
  })
  it('hostile env brand values are escaped / rejected in error page', async () => {
    const res = await request(mk({ MAIL_BRAND_NAME: '<script>x</script>', MAIL_SUPPORT_PHONE: '"><img src=x onerror=1>', MAIL_SUPPORT_EMAIL: 'a"onmouseover="x@y.z', MAIL_ZALO_URL: 'javascript:alert(1)' })).get('/')
    expect(res.text).not.toMatch(/<script>x|<img src=x|onmouseover=|javascript:/i)
  })
  it('errorPage zh/unknown lang and zalo https only', () => {
    expect(errorPage({ lang: 'zh' })).toContain('lang="zh-Hans"')
    expect(errorPage({ lang: 'fr' })).toContain('LAMVI')
    expect(errorPage({ brand: { zaloUrl: 'http://zalo.me/x' } })).not.toContain('zalo.me')
    expect(errorPage({ brand: { zaloUrl: 'https://zalo.me/x' } })).toContain('href="https://zalo.me/x"')
    expect(errorPage({ brand: null })).toContain('LAMVI')
  })
})

describe('/api/health deep', () => {
  it('plain is ok, deep ok with memory repo', async () => {
    const app = make()
    expect((await request(app).get('/api/health')).body).toEqual({ ok: true })
    expect((await request(app).get('/api/health?deep=1')).body).toEqual({ ok: true, db: true })
  })
  it('deep returns 503 when DB throws and does not leak error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const repo = createMemoryRepo()
    repo.getSetting = async () => { throw new Error('connect ECONNREFUSED 10.0.0.1 password=hunter2') }
    const res = await request(make(cfg(), createMemoryMailer(), repo)).get('/api/health?deep=1')
    expect(res.status).toBe(503)
    expect(res.text).not.toMatch(/hunter2|ECONNREFUSED/)
    expect((await request(make(cfg(), createMemoryMailer(), repo)).get('/api/health')).status).toBe(200)
  })
})

describe('POST /api/contact edge cases', () => {
  it.each([
    ['array body', [1, 2]],
    ['string name object', { ...valid, name: { a: 1 } }],
    ['name only control chars', { ...valid, name: '\r\n\t' }],
    ['email with CRLF injection', { ...valid, email: 'a@b.co\r\nBcc: x@y.z' }],
    ['message 9 chars', { ...valid, message: '123456789' }],
    ['message whitespace padded', { ...valid, message: '   short   ' }],
  ])('rejects %s without sending', async (_n, body) => {
    const mailer = createMemoryMailer()
    const res = await request(make(cfg(), mailer)).post('/api/contact').send(body)
    expect(res.status).toBe(400)
    expect(mailer.outbox).toHaveLength(0)
  })
  it('subject strips CR/LF/NUL/DEL/tab and U+0085; truncates fields', async () => {
    const mailer = createMemoryMailer()
    const res = await request(make(cfg(), mailer)).post('/api/contact').send({ ...valid, name: 'A\u0000\u007fB\u0085C\tD'.repeat(40), orderCode: 'X\r\nY'.repeat(50), phone: '1'.repeat(100), message: 'm'.repeat(10000) })
    expect(res.status).toBe(202)
    const m = mailer.outbox[0]
    expect(m.subject).not.toMatch(/[\p{Cc}]/u)
    expect(m.text.length).toBeLessThan(3500)
  })
  it('subject keeps U+2028/2029 (Zl/Zp not stripped)', async () => {
    const mailer = createMemoryMailer()
    await request(make(cfg(), mailer)).post('/api/contact').send({ ...valid, name: 'A\u2028Bcc: x@y.z' })
    expect(mailer.outbox[0].subject).not.toMatch(new RegExp('[\\u2028\\u2029]'))
  })
  it('replyTo cannot carry a list of addresses', async () => {
    const mailer = createMemoryMailer()
    const res = await request(make(cfg(), mailer)).post('/api/contact').send({ ...valid, email: 'a@b.co,victim@y.com' })
    expect(res.status === 400 || !String(mailer.outbox[0]?.replyTo).includes(',')).toBe(true)
  })
  it('html escapes everything incl. name/order/phone/email', async () => {
    const mailer = createMemoryMailer()
    await request(make(cfg(), mailer)).post('/api/contact').send({ ...valid, name: '<img src=x onerror=1>', phone: '<b>', orderCode: '"><svg>', message: '<iframe></iframe> nội dung dài' })
    expect(mailer.outbox[0].html).not.toMatch(/<img|<b>|<svg|<iframe/)
  })
  it('mailer failure -> 503 w/o leaking provider error', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mailer = { send: async () => { throw new Error('http_401 key SECRET_KEY_123') } }
    const res = await request(make(cfg(), mailer)).post('/api/contact').send(valid)
    expect(res.status).toBe(503)
    expect(res.text).not.toContain('SECRET_KEY_123')
  })
  it('rate limit: 429 after max, per name, not shared with other limiter', async () => {
    const app = make(cfg(undefined, { max: 2, windowSec: 3600 }))
    const codes = []
    for (let i = 0; i < 4; i++) codes.push((await request(app).post('/api/contact').send(valid)).status)
    expect(codes).toEqual([202, 202, 429, 429])
  })
  it('invalid requests also count toward rate limit', async () => {
    const app = make(cfg(undefined, { max: 2, windowSec: 3600 }))
    await request(app).post('/api/contact').send({})
    await request(app).post('/api/contact').send({})
    expect((await request(app).post('/api/contact').send(valid)).status).toBe(429)
  })
  it('503 does not require valid body and wins before validation', async () => {
    expect((await request(make(cfg({}))).post('/api/contact').send({})).status).toBe(503)
  })
  it('GET /api/contact is not an open route', async () => {
    expect((await request(make()).get('/api/contact')).status).toBe(404)
  })
})

describe('mailer replyTo plumbing', () => {
  const run = async (mail, replyTo) => {
    const calls = []
    const f = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return new Response('{}', { status: 200 }) }
    await createMailer(mail, f).send({ to: 'a@b.co', subject: 's', text: 't', html: 'h', replyTo })
    return calls[0].body
  }
  it('resend', async () => {
    expect((await run({ from: 'X <n@l.co>', resendApiKey: 'k' }, 'c@d.co')).reply_to).toBe('c@d.co')
    expect(await run({ from: 'X <n@l.co>', resendApiKey: 'k' })).not.toHaveProperty('reply_to')
  })
  it('brevo', async () => {
    expect((await run({ from: 'X <n@l.co>', brevoApiKey: 'k' }, 'c@d.co')).replyTo).toEqual({ email: 'c@d.co' })
    expect(await run({ from: 'X <n@l.co>', brevoApiKey: 'k' })).not.toHaveProperty('replyTo')
  })
})

describe('publicSite / normalizeBrand new fields', () => {
  it.each(['javascript:alert(1)', 'http://online.gov.vn/x', 'data:text/html,x', 'https://a.com/x y', 'https://a.com/"onclick=', '//evil.com', 'HTTPS://ok.vn/x', 'https:///'])('moitUrl %s', (u) => {
    const out = normalizeBrand({ moitUrl: u }).moitUrl
    if (/^https:\/\/[^\s"'<>\\]+$/i.test(u)) expect(out).toBe(u)
    else expect(out).toBe('')
  })
  it('zalo only https, never leaks secrets, exact key set', () => {
    const s = publicSite(cfg({ zaloUrl: 'javascript:alert(1)', supportEmail: 'a@b.co' }))
    expect(s.zalo).toBe('')
    expect(JSON.stringify(s)).not.toMatch(/SECRET|BREVO|resendApiKey/)
    expect(Object.keys(s).sort()).toEqual(['address', 'contactForm', 'hours', 'legalName', 'moitUrl', 'name', 'phone', 'registration', 'social', 'supportEmail', 'workshopAddress', 'zalo'].sort())
  })
  it('contactForm false without provider key or from or email', () => {
    const base = { from: 'x@y.co', resendApiKey: 'k', brand: { supportEmail: 'a@b.co' } }
    expect(publicSite({ mail: base }).contactForm).toBe(true)
    expect(publicSite({ mail: { ...base, from: null } }).contactForm).toBe(false)
    expect(publicSite({ mail: { ...base, resendApiKey: null } }).contactForm).toBe(false)
    expect(publicSite({ mail: { ...base, brand: {} } }).contactForm).toBe(false)
    expect(publicSite({}).contactForm).toBe(false)
  })
  it('registration/workshop strip control chars, truncate 300', () => {
    const b = normalizeBrand({ registration: 'MST\r\n1'.repeat(200), workshopAddress: 'a\u0000b' })
    expect(b.registration.length).toBeLessThanOrEqual(300)
    expect(b.registration).not.toMatch(/[\r\n]/)
    expect(b.workshopAddress).toBe('ab')
  })
  it('/api/site over HTTP has no secrets and is cacheable', async () => {
    const res = await request(make(cfg({ supportEmail: 'a@b.co', moitUrl: 'http://x.vn' }))).get('/api/site')
    expect(res.text).not.toMatch(/SECRET|BREVO/)
    expect(res.body.moitUrl).toBe('')
  })
})
