import { generateKeyPairSync } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { GaError, createGaRealtime, parseServiceAccount } from './adapters/gaRealtime.js'
import { loadConfig } from './config.js'

const { privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048, privateKeyEncoding: { type: 'pkcs8', format: 'pem' }, publicKeyEncoding: { type: 'spki', format: 'pem' } })
const creds = { propertyId: '123456', clientEmail: 'sa@p.iam.gserviceaccount.com', privateKey }

const json = (body, status = 200) => ({ ok: status < 400, status, json: async () => body })
const row = (dim, v) => ({ dimensionValues: [{ value: dim }], metricValues: [{ value: String(v) }] })

function fakeGoogle({ tokenStatus = 200, apiStatus = 200 } = {}) {
  return vi.fn(async (url, init) => {
    if (String(url).includes('oauth2')) return json({ access_token: 'tok', expires_in: 3600 }, tokenStatus)
    const body = JSON.parse(init.body)
    if (apiStatus !== 200) return json({}, apiStatus)
    const dim = body.dimensions?.[0]?.name
    if (!dim) return json({ rows: [{ metricValues: [{ value: '7' }, { value: '21' }] }] })
    if (dim === 'minutesAgo') return json({ rows: [row('00', 4), row('02', 3), row('45', 9)] })
    if (dim === 'unifiedScreenName') return json({ rows: [row('Trang chủ', 2), row('/san-pham', 5)] })
    if (dim === 'country') return json({ rows: [row('Vietnam', 6), row('Japan', 1)] })
    return json({ rows: [row('mobile', 5), row('desktop', 2)] })
  })
}

describe('createGaRealtime', () => {
  it('thiếu cấu hình → null', () => {
    expect(createGaRealtime({})).toBeNull()
    expect(createGaRealtime({ ...creds, propertyId: 'abc' })).toBeNull()
    expect(createGaRealtime({ ...creds, privateKey: '' })).toBeNull()
  })

  it('gộp số liệu: tổng, 30 phút đủ cột, xếp giảm dần, bỏ phút ngoài khoảng', async () => {
    const fetchImpl = fakeGoogle()
    const snap = await createGaRealtime({ ...creds, fetchImpl }).snapshot()
    expect(snap).toMatchObject({ configured: true, activeUsers: 7, pageViews: 21 })
    expect(snap.perMinute).toHaveLength(30)
    expect(snap.perMinute[0].users).toBe(4)
    expect(snap.perMinute[2].users).toBe(3)
    expect(snap.perMinute.reduce((a, m) => a + m.users, 0)).toBe(7)
    expect(snap.pages.map((p) => p.name)).toEqual(['/san-pham', 'Trang chủ'])
    expect(snap.countries[0]).toEqual({ name: 'Vietnam', value: 6 })
  })

  it('cache 15 giây và dùng lại token', async () => {
    let t = 1_000_000
    const fetchImpl = fakeGoogle()
    const ga = createGaRealtime({ ...creds, fetchImpl, now: () => t })
    await ga.snapshot()
    const calls = fetchImpl.mock.calls.length
    await ga.snapshot()
    expect(fetchImpl.mock.calls.length).toBe(calls)
    t += 20_000
    await ga.snapshot()
    expect(fetchImpl.mock.calls.filter(([u]) => String(u).includes('oauth2'))).toHaveLength(1)
    expect(fetchImpl.mock.calls.length).toBe(calls + 5)
  })

  it('JWT gửi đúng audience/scope', async () => {
    const fetchImpl = fakeGoogle()
    await createGaRealtime({ ...creds, fetchImpl }).snapshot()
    const [, init] = fetchImpl.mock.calls.find(([u]) => String(u).includes('oauth2'))
    const jwt = new URLSearchParams(init.body).get('assertion')
    const claim = JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url'))
    expect(claim).toMatchObject({ iss: creds.clientEmail, aud: 'https://oauth2.googleapis.com/token', scope: expect.stringContaining('analytics.readonly') })
  })

  it.each([
    [{ tokenStatus: 400 }, 'AUTH'],
    [{ apiStatus: 403 }, 'AUTH'],
    [{ apiStatus: 429 }, 'QUOTA'],
    [{ apiStatus: 500 }, 'UPSTREAM'],
  ])('lỗi từ Google %o → GaError %s', async (opts, code) => {
    const ga = createGaRealtime({ ...creds, fetchImpl: fakeGoogle(opts) })
    await expect(ga.snapshot()).rejects.toMatchObject({ code })
    await expect(ga.snapshot()).rejects.toBeInstanceOf(GaError)
  })
})

describe('parseServiceAccount / config', () => {
  const sa = { client_email: 'a@b', private_key: 'KEY' }
  it('nhận JSON thô, base64, hoặc cặp email + key có \\n chữ', () => {
    expect(parseServiceAccount({ GA_SERVICE_ACCOUNT_JSON: JSON.stringify(sa) })).toEqual({ clientEmail: 'a@b', privateKey: 'KEY' })
    expect(parseServiceAccount({ GA_SERVICE_ACCOUNT_JSON: Buffer.from(JSON.stringify(sa)).toString('base64') })).toEqual({ clientEmail: 'a@b', privateKey: 'KEY' })
    expect(parseServiceAccount({ GA_CLIENT_EMAIL: 'a@b', GA_PRIVATE_KEY: 'L1\\nL2' })).toEqual({ clientEmail: 'a@b', privateKey: 'L1\nL2' })
  })
  it('khoá hỏng/thiếu → null, không ném lỗi', () => {
    expect(parseServiceAccount({ GA_SERVICE_ACCOUNT_JSON: '{oops' })).toBeNull()
    expect(parseServiceAccount({ GA_SERVICE_ACCOUNT_JSON: '{"client_email":"a"}' })).toBeNull()
    expect(parseServiceAccount({})).toBeNull()
    expect(loadConfig({}).gaRealtime.propertyId).toBeNull()
  })
})

describe('GET /api/admin/analytics/realtime', () => {
  async function setup(gaRealtime) {
    const repo = createMemoryRepo()
    const auth = createMemoryAuth()
    const storage = createMemoryStorage({ maxBytes: 1024 })
    const app = createApp({ repo, auth, storage, config: { publicSiteUrl: 'https://x.test' }, gaRealtime })
    const login = async (email, role) => {
      const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
      await repo.upsertProfile({ id: user.id, fullName: email, role })
      return `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
    }
    return { app, admin: await login('a@x.test', 'admin'), customer: await login('c@x.test', 'customer') }
  }

  it('chỉ admin xem được', async () => {
    const { app, customer } = await setup(null)
    expect((await request(app).get('/api/admin/analytics/realtime')).status).toBe(401)
    expect((await request(app).get('/api/admin/analytics/realtime').set('Authorization', customer)).status).toBe(403)
  })

  it('chưa cấu hình → 200 configured:false', async () => {
    const { app, admin } = await setup(null)
    const res = await request(app).get('/api/admin/analytics/realtime').set('Authorization', admin)
    expect(res.body).toEqual({ configured: false })
  })

  it('trả snapshot; lỗi GA → 502 với mã GA_*, không lộ chi tiết', async () => {
    const ok = await setup({ snapshot: async () => ({ configured: true, activeUsers: 3 }) })
    expect((await request(ok.app).get('/api/admin/analytics/realtime').set('Authorization', ok.admin)).body.activeUsers).toBe(3)
    const bad = await setup({ snapshot: async () => { throw new GaError('QUOTA') } })
    const res = await request(bad.app).get('/api/admin/analytics/realtime').set('Authorization', bad.admin)
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('GA_QUOTA')
  })
})
