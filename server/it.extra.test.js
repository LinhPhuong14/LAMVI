// Kiểm thử độc lập: vai trò IT + dashboard IT (D-51…D-54)
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import express from 'express'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMetrics, percentile, routeLabel } from './monitoring/metrics.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { runHealthChecks } from './monitoring/health.js'
import { maintenancePage, renderPage } from './ssr.js'
import { classifyPath } from '../src/seo/routes.js'

const PW = 'matkhau123'
const UUID = '3f2b9c1e-7a4d-4e5f-9b8a-1c2d3e4f5a6b'

let app, repo, auth, metrics, maintenance, tokens, clock, web

async function signup(email, role) {
  const { user } = await auth.signUp({ email, password: PW })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: PW })
  return { id: user.id, bearer: `Bearer ${s.accessToken}`, refreshToken: s.refreshToken }
}

// Web giả (thay SSR thật): trang HTML + tài nguyên tĩnh
function fakeWeb() {
  const r = express.Router()
  r.get('/assets/app.js', (req, res) => res.type('application/javascript').send('console.log(1)'))
  r.get('/favicon.ico', (req, res) => res.type('image/x-icon').send(Buffer.from([0])))
  r.get(/.*/, (req, res) => res.type('html').send('<!doctype html><p>ok</p>'))
  return r
}

beforeEach(async () => {
  clock = { t: Date.parse('2026-09-28T10:00:30Z') }
  repo = createMemoryRepo()
  auth = createMemoryAuth({ now: () => clock.t, accessTtlMs: 3600_000 })
  metrics = createMetrics({ repo, classify: classifyPath, now: () => clock.t })
  maintenance = createMaintenance({ repo, ttlMs: 0 })
  web = fakeWeb()
  app = createApp({
    repo,
    auth,
    storage: createMemoryStorage(),
    web,
    config: { publicSiteUrl: 'https://moc.test', useSupabase: false },
    metrics,
    maintenance,
  })
  tokens = {
    it: await signup('it@moc.test', 'it'),
    admin: await signup('admin@moc.test', 'admin'),
    customer: await signup('khach@moc.test', 'customer'),
  }
})

const IT_ENDPOINTS = [
  ['get', '/api/it/health'],
  ['get', '/api/it/metrics?range=1h'],
  ['get', '/api/it/errors'],
  ['put', '/api/it/maintenance'],
]

const call = (method, url, bearer) => {
  const r = request(app)[method](url)
  if (bearer) r.set('Authorization', bearer)
  return method === 'put' ? r.send({ enabled: true }) : r
}

const routes = async () => (await metrics.summary('1h')).routes
const labels = async () => (await routes()).map((r) => `${r.method} ${r.route}`)

describe('Phân quyền /api/it/* (D-51)', () => {
  it.each(IT_ENDPOINTS)('%s %s: khách/admin 403; không token, token sai, token hết hạn 401; IT 200', async (method, url) => {
    expect((await call(method, url)).status).toBe(401)
    expect((await call(method, url, 'Bearer sai-token')).status).toBe(401)
    expect((await call(method, url, 'Basic abc')).status).toBe(401)
    expect((await call(method, url, tokens.customer.bearer)).status).toBe(403)
    expect((await call(method, url, tokens.admin.bearer)).status).toBe(403)
    expect((await call(method, url, tokens.it.bearer)).status).toBe(200)
    clock.t += 3600_001
    expect((await call(method, url, tokens.it.bearer)).status).toBe(401)
  })

  it('admin bị từ chối không làm đổi trạng thái bảo trì', async () => {
    await call('put', '/api/it/maintenance', tokens.admin.bearer)
    expect((await maintenance.get()).enabled).toBe(false)
  })

  it('IT bị hạ vai trò giữa chừng → mất quyền /api/it và /api/admin ngay (token cũ)', async () => {
    expect((await call('get', '/api/it/health', tokens.it.bearer)).status).toBe(200)
    await repo.upsertProfile({ id: tokens.it.id, role: 'admin' })
    expect((await call('get', '/api/it/health', tokens.it.bearer)).status).toBe(403)
    expect((await call('get', '/api/admin/products', tokens.it.bearer)).status).toBe(200)
    await repo.upsertProfile({ id: tokens.it.id, role: 'customer' })
    expect((await call('get', '/api/admin/products', tokens.it.bearer)).status).toBe(403)
  })

  it('không tự nâng vai trò it qua register / PATCH /me', async () => {
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: 'hacker@moc.test', password: PW, fullName: 'H', role: 'it' })
    expect(reg.status).toBe(201)
    expect((await repo.getProfile(reg.body.user.id)).role).toBe('customer')
    const s = await auth.signIn({ email: 'hacker@moc.test', password: PW })
    const bearer = `Bearer ${s.accessToken}`
    const patch = await request(app).patch('/api/me').set('Authorization', bearer).send({ role: 'it', fullName: 'H2' })
    expect(patch.status).toBe(200)
    expect(patch.body.profile.role).toBe('customer')
    expect((await call('get', '/api/it/health', bearer)).status).toBe(403)
    // admin cũng không tự lên it
    await request(app).patch('/api/me').set('Authorization', tokens.admin.bearer).send({ role: 'it' })
    expect((await call('get', '/api/it/health', tokens.admin.bearer)).status).toBe(403)
  })

  it('/api/it không có hồ sơ (user tạo ngoài API) → 403', async () => {
    await auth.signUp({ email: 'noprofile@moc.test', password: PW })
    const s = await auth.signIn({ email: 'noprofile@moc.test', password: PW })
    expect((await call('get', '/api/it/health', `Bearer ${s.accessToken}`)).status).toBe(403)
  })
})

describe('Nhãn route trong số liệu (D-52)', () => {
  it('request thành công / 404 theo slug / :code → mẫu Express', async () => {
    await request(app).get('/api/products/den-nguyet')
    await request(app).get('/api/batches/LO-2026-001')
    const l = await labels()
    expect(l).toContain('GET /api/products/:slug')
    expect(l).toContain('GET /api/batches/:code')
    expect(l.join()).not.toMatch(/den-nguyet|LO-2026/)
  })

  it('lỗi ném từ handler admin có :id → nhãn mẫu, 5xx ghi code/message', async () => {
    repo.getProductById = async () => {
      throw new Error('boom')
    }
    const r = await request(app).get(`/api/admin/products/${UUID}`).set('Authorization', tokens.admin.bearer)
    expect(r.status).toBe(500)
    const route = (await routes()).find((x) => x.route === '/api/admin/products/:id')
    expect(route).toMatchObject({ method: 'GET', count: 1, s5xx: 1, errorRate: 1 })
    const [err] = await metrics.recentErrors('1h')
    expect(err).toMatchObject({ route: '/api/admin/products/:id', status: 500, code: 'INTERNAL_ERROR', message: 'boom' })
    expect(JSON.stringify(await labels())).not.toContain(UUID)
  })

  it('admin PATCH/DELETE :id (404 do không tồn tại) → nhãn :id', async () => {
    await request(app).patch(`/api/admin/faq/${UUID}`).set('Authorization', tokens.admin.bearer).send({ sortOrder: 1 })
    await request(app).delete(`/api/admin/batches/${UUID}`).set('Authorization', tokens.admin.bearer)
    await request(app).post(`/api/admin/batches/${UUID}/publish`).set('Authorization', tokens.admin.bearer)
    const l = await labels()
    expect(l).toContain('PATCH /api/admin/faq/:id')
    expect(l).toContain('DELETE /api/admin/batches/:id')
    expect(l).toContain('POST /api/admin/batches/:id/publish')
    expect(l.join()).not.toContain(UUID)
  })

  it('401/403 từ guard → nhãn không chứa id', async () => {
    await request(app).get(`/api/admin/products/${UUID}`)
    await request(app).get(`/api/admin/products/${UUID}`).set('Authorization', tokens.customer.bearer)
    await request(app).get('/api/it/health').set('Authorization', tokens.admin.bearer)
    const rs = await routes()
    expect(JSON.stringify(rs)).not.toContain(UUID)
    const admin = rs.find((r) => r.route.startsWith('/api/admin'))
    expect(admin).toMatchObject({ count: 2, s4xx: 2 })
    expect(rs.find((r) => r.route.startsWith('/api/it'))).toMatchObject({ s4xx: 1 })
  })

  // Lỗi: segment đầu của route lạ lấy nguyên từ URL → nhãn chứa uuid/giá trị tuỳ ý
  // (mỗi URL lạ tạo một dòng api_metrics mới — không giới hạn số nhãn; có thể lộ token nếu ai đó đặt vào path)
  it('404 route lạ → nhãn không chứa giá trị tuỳ ý của URL', async () => {
    await request(app).get(`/api/${UUID}`)
    await request(app).post('/api/sk-bi-mat-123/x').send({})
    const l = (await labels()).join()
    expect(l).not.toContain(UUID)
    expect(l).not.toContain('sk-bi-mat-123')
  })

  it('404 dưới segment đã biết → /api/<seg>/*', async () => {
    await request(app).get('/api/products/a/b/c')
    expect(await labels()).toContain('GET /api/products/*')
  })

  it('trang SSR đếm theo page:<kind>; tài nguyên tĩnh không đếm', async () => {
    await request(app).get('/products/den-nguyet')
    await request(app).get('/en/products/den-vong')
    await request(app).get('/')
    await request(app).get('/lo/LO-1')
    await request(app).get('/it')
    await request(app).get('/assets/app.js')
    await request(app).get('/favicon.ico')
    const rs = await routes()
    const byRoute = Object.fromEntries(rs.map((r) => [r.route, r.count]))
    expect(byRoute['page:product']).toBe(2)
    expect(byRoute['page:home']).toBe(1)
    expect(byRoute['page:batch']).toBe(1)
    expect(byRoute['page:private']).toBe(1)
    expect(JSON.stringify(rs)).not.toMatch(/assets|favicon|den-nguyet|LO-1/)
  })

  it('sitemap.xml / robots.txt đếm theo đường dẫn cố định', async () => {
    await request(app).get('/robots.txt')
    await request(app).get('/sitemap.xml?x=1')
    const l = await labels()
    expect(l).toContain('GET /robots.txt')
    expect(l).toContain('GET /sitemap.xml')
  })

  it('không lưu query string, token, body trong số liệu và lỗi', async () => {
    repo.listFaq = async () => {
      throw new Error('db down')
    }
    await request(app).get('/api/faq?token=qs-bi-mat').set('Authorization', 'Bearer header-bi-mat')
    await request(app).post('/api/auth/login?x=qs-bi-mat').send({ email: 'it@moc.test', password: 'mat-khau-bi-mat' })
    await metrics.flush()
    const dump = JSON.stringify({
      m: await repo.listApiMetrics({ since: '2000-01-01T00:00:00Z' }),
      e: await repo.listApiErrors({ since: '2000-01-01T00:00:00Z' }),
    })
    expect(dump).not.toMatch(/qs-bi-mat|header-bi-mat|mat-khau-bi-mat|matkhau123/)
    expect(dump).toContain('/api/faq')
  })

  it('message lỗi 5xx cắt ≤ 300 ký tự; path cắt ≤ 200', async () => {
    // Từ ngắn nối bằng khoảng trắng: không bị nhầm là token (xem test che dữ liệu bên dưới)
    const long = 'loi '.repeat(400)
    repo.listFaq = async () => {
      throw new Error(long)
    }
    await request(app).get('/api/faq')
    const [e] = await metrics.recentErrors('1h')
    expect(e.message.length).toBe(300)
    metrics.record({ method: 'GET', route: '/api/x', status: 500, ms: 1, path: 'p', message: long })
    expect((await metrics.recentErrors('1h'))[0].message.length).toBe(300)
  })

  // G-28 / NFR-PRV-002: IT xem được nhật ký lỗi nên không được lưu dữ liệu cá nhân
  it('che email, SĐT và chuỗi giống token trong thông điệp lỗi', async () => {
    metrics.record({
      method: 'POST',
      route: '/api/x',
      status: 500,
      ms: 1,
      path: '/api/x',
      message: 'Không gửi được cho an.nguyen@example.com (0912345678), token eyJhbGciOiJIUzI1NiJ9abcdefgh',
    })
    const [e] = await metrics.recentErrors('1h')
    expect(e.message).not.toContain('an.nguyen@example.com')
    expect(e.message).not.toContain('0912345678')
    expect(e.message).not.toContain('eyJhbGciOiJIUzI1NiJ9abcdefgh')
    expect(e.message).toContain('[email]')
    expect(e.message).toContain('[phone]')
    expect(e.message).toContain('[token]')
  })

  it('che token trong đường dẫn trang QR lời chúc và đặt lại mật khẩu', async () => {
    metrics.record({ method: 'GET', route: '/qr/:token', status: 500, ms: 1, path: '/qr/bimat-cua-nguoi-nhan' })
    metrics.record({ method: 'GET', route: '/reset-password', status: 500, ms: 1, path: '/en/reset-password/eyJhbGci' })
    const paths = (await metrics.recentErrors('1h')).map((e) => e.path)
    expect(paths).toContain('/qr/:token')
    expect(paths).toContain('/en/reset-password/:token')
  })

  it('4xx không vào danh sách lỗi', async () => {
    await request(app).get('/api/products/khong-co')
    expect(await metrics.recentErrors('1h')).toEqual([])
  })
})

describe('Tổng hợp số liệu (D-52, D-53)', () => {
  it('range lạ/thiếu → 24h', async () => {
    for (const q of ['', '?range=abc', '?range=__proto__', '?range=toString', '?range=1h&range=7d']) {
      const r = await request(app).get(`/api/it/metrics${q}`).set('Authorization', tokens.it.bearer)
      expect(r.status, q).toBe(200)
      expect(r.body.range, q).toBe('24h')
    }
    const e = await request(app).get('/api/it/errors?range=constructor').set('Authorization', tokens.it.bearer)
    expect(e.status).toBe(200)
  })

  it('dữ liệu cũ hơn range bị loại (cả đã flush và chưa flush, cả lỗi)', async () => {
    repo.listFaq = async () => {
      throw new Error('old')
    }
    await request(app).get('/api/faq')
    await metrics.flush()
    await request(app).get('/api/faq') // chưa flush
    clock.t += 25 * 3600_000
    expect((await metrics.summary('24h')).routes.find((r) => r.route === '/api/faq')).toBeUndefined()
    expect(await metrics.recentErrors('24h')).toEqual([])
    expect((await metrics.summary('7d')).routes.find((r) => r.route === '/api/faq').count).toBe(2)
    expect(await metrics.recentErrors('7d')).toHaveLength(2)
  })

  it('tổng hợp p50/p95/max, tỷ lệ lỗi, không trùng lặp sau flush', async () => {
    const m = createMetrics({ repo, now: () => clock.t })
    for (let i = 0; i < 18; i++) m.record({ method: 'GET', route: '/api/x', status: 200, ms: 20 })
    m.record({ method: 'GET', route: '/api/x', status: 500, ms: 400 })
    m.record({ method: 'GET', route: '/api/x', status: 404, ms: 4000 })
    const s = await m.summary('1h')
    expect(s.routes[0]).toMatchObject({ count: 20, s2xx: 18, s4xx: 1, s5xx: 1, errorRate: 0.05, p50Ms: 50, p95Ms: 500, maxMs: 4000 })
    await m.flush()
    expect((await m.summary('1h')).routes[0].count).toBe(20)
  })

  it('percentile biên: count 0 → null; toàn gt_2500 → max_ms', () => {
    const zero = { count: 0, max_ms: 0, le_50: 0, le_100: 0, le_250: 0, le_500: 0, le_1000: 0, le_2500: 0, gt_2500: 0 }
    expect(percentile(zero, 0.5)).toBeNull()
    const slow = { ...zero, count: 3, gt_2500: 3, max_ms: 9876.4 }
    expect(percentile(slow, 0.5)).toBe(9876)
    expect(percentile(slow, 0.95)).toBe(9876)
  })

  it('summary rỗng: totals count 0, p95 null, errorRate 0', async () => {
    const m = createMetrics({ repo: createMemoryRepo(), now: () => clock.t })
    const s = await m.summary('1h')
    expect(s.totals).toMatchObject({ count: 0, errorRate: 0, p95Ms: null, avgMs: null })
    expect(s.routes).toEqual([])
  })

  it('hai server flush cùng phút → cộng dồn', async () => {
    const a = createMetrics({ repo, now: () => clock.t })
    const b = createMetrics({ repo, now: () => clock.t })
    a.record({ method: 'GET', route: '/api/x', status: 200, ms: 10 })
    b.record({ method: 'GET', route: '/api/x', status: 200, ms: 3000 })
    await a.flush()
    await b.flush()
    const [row] = await repo.listApiMetrics({ since: '2000-01-01T00:00:00Z' })
    expect(row).toMatchObject({ count: 2, max_ms: 3000, le_50: 1, gt_2500: 1 })
  })

  // Hành vi hiện tại: flush lỗi thì bỏ cả lô (số liệu + lỗi 5xx) — ghi lại để biết
  it('flush lỗi: lô bị bỏ, không ném ra ngoài; request sau vẫn được ghi', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const m = createMetrics({ repo, now: () => clock.t })
    m.record({ method: 'GET', route: '/api/x', status: 500, ms: 10, path: '/api/x' })
    const orig = repo.recordApiMetrics
    repo.recordApiMetrics = async () => {
      throw new Error('db down')
    }
    await expect(m.flush()).resolves.toBeUndefined()
    expect(err).toHaveBeenCalled()
    repo.recordApiMetrics = orig
    expect((await m.summary('1h')).routes).toEqual([]) // lô đã mất
    // Ghi lỗi 5xx là bước riêng: vẫn lưu được dù ghi số liệu thất bại
    expect((await m.recentErrors('1h')).map((e) => e.route)).toEqual(['/api/x'])
    m.record({ method: 'GET', route: '/api/x', status: 200, ms: 10 })
    await m.flush()
    expect((await m.summary('1h')).routes[0].count).toBe(1)
    err.mockRestore()
  })

  it('dọn dữ liệu > 30 ngày (tối đa mỗi giờ một lần)', async () => {
    const m = createMetrics({ repo, now: () => clock.t })
    const old = clock.t
    m.record({ method: 'GET', route: '/api/old', status: 500, ms: 1, path: '/api/old' })
    await m.flush() // lần dọn đầu tiên
    clock.t = old + 31 * 86400_000
    m.record({ method: 'GET', route: '/api/new', status: 200, ms: 1 })
    await m.flush()
    const rows = await repo.listApiMetrics({ since: '2000-01-01T00:00:00Z' })
    expect(rows.map((r) => r.route)).toEqual(['/api/new'])
    expect(await repo.listApiErrors({ since: '2000-01-01T00:00:00Z' })).toEqual([])

    const del = vi.spyOn(repo, 'deleteApiMetricsBefore')
    await m.flush()
    expect(del).not.toHaveBeenCalled()
    clock.t += 3600_001
    await m.flush()
    expect(del).toHaveBeenCalledWith(new Date(clock.t - 30 * 86400_000).toISOString())
  })

  it('stop() flush phần còn lại', async () => {
    const m = createMetrics({ repo, now: () => clock.t, flushMs: 10_000_000 })
    m.start()
    m.record({ method: 'GET', route: '/api/x', status: 200, ms: 1 })
    await m.stop()
    expect(await repo.listApiMetrics({ since: '2000-01-01T00:00:00Z' })).toHaveLength(1)
  })

  it('routeLabel: request tĩnh không phải HTML → null', () => {
    const req = { originalUrl: '/assets/a.js?v=1' }
    const res = { get: () => 'application/javascript' }
    expect(routeLabel(req, res, classifyPath)).toBeNull()
  })
})

describe('Sức khoẻ (D-52)', () => {
  const ok = { ping: async () => true }

  it('ping treo → error "timeout" trong khoảng timeout, không treo cả request', async () => {
    const hang = { ping: () => new Promise(() => {}) }
    const t0 = Date.now()
    const h = await runHealthChecks({ repo: hang, auth: ok, storage: hang, config: { useSupabase: true }, env: {}, timeoutMs: 100 })
    const took = Date.now() - t0
    expect(took).toBeLessThan(1000)
    expect(took).toBeGreaterThanOrEqual(90)
    expect(h.status).toBe('degraded')
    const db = h.checks.find((c) => c.name === 'database')
    expect(db).toMatchObject({ status: 'error', message: 'timeout', provider: 'supabase' })
    expect(h.checks.find((c) => c.name === 'auth').status).toBe('ok')
  })

  it('không bao giờ trả giá trị biến môi trường', async () => {
    const env = {
      OPENAI_API_KEY: 'sk-bi-mat',
      PAYOS_CLIENT_ID: 'payos-client-bi-mat',
      PAYOS_API_KEY: 'payos-key-bi-mat',
      PAYOS_CHECKSUM_KEY: 'payos-checksum-bi-mat',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-bi-mat',
      NODE_ENV: 'production',
    }
    const h = await runHealthChecks({ repo: ok, auth: ok, storage: ok, config: { useSupabase: true }, env })
    const json = JSON.stringify(h)
    expect(json).not.toMatch(/bi-mat/)
    expect(h.checks.find((c) => c.name === 'openai')).toEqual({ name: 'openai', status: 'not_integrated', configured: true })
    expect(h.checks.find((c) => c.name === 'payos')).toMatchObject({ status: 'not_configured', configured: true })
    expect(h.status).toBe('ok')
  })

  it('payOS thiếu một biến → configured false', async () => {
    const h = await runHealthChecks({ repo: ok, auth: ok, storage: ok, config: {}, env: { PAYOS_CLIENT_ID: 'a', PAYOS_API_KEY: 'b' } })
    expect(h.checks.find((c) => c.name === 'payos').configured).toBe(false)
  })

  it('message lỗi ping cắt ≤ 200; lỗi không phải Error vẫn xử lý', async () => {
    const bad = { ping: async () => Promise.reject('x'.repeat(500)) }
    const h = await runHealthChecks({ repo: bad, auth: ok, storage: ok, config: {}, env: {} })
    expect(h.checks[0].message.length).toBe(200)
  })

  it('/api/it/health qua HTTP không chứa khoá trong process.env', async () => {
    vi.stubEnv('OPENAI_API_KEY', 'sk-bi-mat-env')
    try {
      const r = await request(app).get('/api/it/health').set('Authorization', tokens.it.bearer)
      expect(r.status).toBe(200)
      expect(JSON.stringify(r.body)).not.toContain('sk-bi-mat-env')
      // 'configured' theo client OpenAI tạo lúc khởi động (app test không có client), không đọc env lúc gọi
      expect(r.body.checks.find((c) => c.name === 'openai')).toMatchObject({ configured: false, status: 'not_configured' })
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

describe('Chế độ bảo trì — API (D-54)', () => {
  const on = () => maintenance.set(true, tokens.it.id)
  const admin = () => tokens.admin.bearer

  it('mọi method ghi bị 503 MAINTENANCE trên các route ghi thông thường', async () => {
    await on()
    const before = { products: (await repo.listProducts()).length, faq: (await repo.listFaq({ publishedOnly: false })).length }
    const cases = [
      ['post', '/api/admin/products', admin()],
      ['patch', `/api/admin/products/${UUID}`, admin()],
      ['delete', `/api/admin/products/${UUID}`, admin()],
      ['post', '/api/admin/faq', admin()],
      ['patch', `/api/admin/faq/${UUID}`, admin()],
      ['delete', `/api/admin/faq/${UUID}`, admin()],
      ['post', '/api/admin/batches', admin()],
      ['post', `/api/admin/batches/${UUID}/publish`, admin()],
      ['post', `/api/admin/batches/${UUID}/video-upload`, admin()],
      ['patch', '/api/me', tokens.customer.bearer],
      ['post', '/api/auth/register'],
      ['post', '/api/auth/forgot-password'],
      ['post', '/api/auth/reset-password'],
      ['put', '/api/products/x'],
      ['post', '/api/khong-co'],
    ]
    for (const [m, url, bearer] of cases) {
      const r = request(app)[m](url)
      if (bearer) r.set('Authorization', bearer)
      const res = await r.send({})
      expect(res.status, `${m} ${url}`).toBe(503)
      expect(res.body.error.code).toBe('MAINTENANCE')
      expect(res.headers['retry-after']).toBe('600')
    }
    // Không có gì bị ghi
    expect({ products: (await repo.listProducts()).length, faq: (await repo.listFaq({ publishedOnly: false })).length }).toEqual(before)
  })

  it('GET/HEAD/OPTIONS vẫn chạy', async () => {
    await on()
    expect((await request(app).get('/api/products')).status).toBe(200)
    expect((await request(app).head('/api/products')).status).toBe(200)
    expect((await request(app).options('/api/products')).status).not.toBe(503)
    expect((await request(app).get('/api/me').set('Authorization', tokens.customer.bearer)).status).toBe(200)
  })

  it('login / refresh / logout vẫn chạy', async () => {
    await on()
    const login = await request(app).post('/api/auth/login').send({ email: 'khach@moc.test', password: PW })
    expect(login.status).toBe(200)
    const cookie = login.headers['set-cookie'].find((c) => c.startsWith('lamvi_rt=')).split(';')[0]
    const ref = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(ref.status).toBe(200)
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${ref.body.accessToken}`)
    expect(out.status).toBe(204)
  })

  it('không lách được bằng query string/đường dẫn tương tự', async () => {
    await on()
    for (const url of ['/api/auth/login-x', '/api/itx', '/api/auth/register?next=/api/it/', '/api/admin/faq?/api/it/']) {
      const r = await request(app).post(url).set('Authorization', admin()).send({})
      expect(r.status, url).toBe(503)
    }
  })

  it('IT tắt được bảo trì khi đang bật (qua HTTP), sau đó ghi bình thường', async () => {
    await request(app).put('/api/it/maintenance').set('Authorization', tokens.it.bearer).send({ enabled: true })
    const off = await request(app).put('/api/it/maintenance').set('Authorization', tokens.it.bearer).send({ enabled: false })
    expect(off.status).toBe(200)
    expect(off.body).toMatchObject({ enabled: false, updatedBy: tokens.it.id })
    const r = await request(app).post('/api/admin/faq').set('Authorization', admin()).send({ question: { vi: 'Q' }, answer: { vi: 'A' } })
    expect(r.status).toBe(201)
  })

  it('IT đăng nhập lại trong lúc bảo trì rồi tắt được', async () => {
    await on()
    const login = await request(app).post('/api/auth/login').send({ email: 'it@moc.test', password: PW })
    const off = await request(app)
      .put('/api/it/maintenance')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ enabled: false })
    expect(off.status).toBe(200)
  })

  it('PUT dữ liệu sai (thiếu, null, số, mảng, JSON hỏng) → 400, không đổi trạng thái', async () => {
    for (const body of [{}, { enabled: null }, { enabled: 1 }, [true]]) {
      const r = await request(app).put('/api/it/maintenance').set('Authorization', tokens.it.bearer).send(body)
      expect(r.status, JSON.stringify(body)).toBe(400)
    }
    const bad = await request(app)
      .put('/api/it/maintenance')
      .set('Authorization', tokens.it.bearer)
      .set('Content-Type', 'application/json')
      .send('{bad')
    expect(bad.status).toBe(400)
    expect((await maintenance.get()).enabled).toBe(false)
  })

  it('health trả kèm trạng thái bảo trì', async () => {
    await on()
    const r = await request(app).get('/api/it/health').set('Authorization', tokens.it.bearer)
    expect(r.body.maintenance).toMatchObject({ enabled: true, updatedBy: tokens.it.id })
  })
})

describe('Chế độ bảo trì — cache & nhiều instance (D-54)', () => {
  it('cache ttl: không đọc lại repo trong ttl', async () => {
    const t = { v: 0 }
    const r = createMemoryRepo()
    const spy = vi.spyOn(r, 'getSetting')
    const m = createMaintenance({ repo: r, ttlMs: 1000, now: () => t.v })
    await m.get()
    await m.get()
    t.v = 999
    await m.get()
    expect(spy).toHaveBeenCalledTimes(1)
    t.v = 1000
    await m.get()
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('hai instance chung repo: instance B thấy thay đổi của A sau ttl', async () => {
    const t = { v: 0 }
    const r = createMemoryRepo()
    const a = createMaintenance({ repo: r, ttlMs: 15_000, now: () => t.v })
    const b = createMaintenance({ repo: r, ttlMs: 15_000, now: () => t.v })
    expect((await b.get()).enabled).toBe(false)
    await a.set(true, 'u1')
    expect((await a.get()).enabled).toBe(true) // A thấy ngay
    t.v = 14_999
    expect((await b.get()).enabled).toBe(false) // B còn cache
    t.v = 15_000
    expect((await b.get()).enabled).toBe(true)
    await b.set(false, 'u2')
    t.v = 30_000
    expect(await a.get()).toMatchObject({ enabled: false, updatedBy: 'u2' })
  })

  it('không đọc được cài đặt lần đầu → không chặn API ghi', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = createMemoryRepo()
    r.getSetting = async () => {
      throw new Error('db down')
    }
    const a = createApp({
      repo: r,
      auth,
      storage: createMemoryStorage(),
      config: { publicSiteUrl: 'https://moc.test' },
      metrics: createMetrics({ repo: r }),
      maintenance: createMaintenance({ repo: r, ttlMs: 0 }),
    })
    const res = await request(a).post('/api/auth/forgot-password').send({ email: 'x@moc.test' })
    expect(res.status).toBe(202)
    err.mockRestore()
  })

  // Ghi lại hành vi hiện tại: đã đọc được "bật" rồi repo lỗi → giữ giá trị cũ (vẫn chặn).
  // D-54 viết "không đọc được cài đặt → không chặn" — xem báo cáo.
  it('đã bật rồi repo lỗi → coi như tắt (D-54 fail-open)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const r = createMemoryRepo()
    const m = createMaintenance({ repo: r, ttlMs: 0 })
    await m.set(true, null)
    r.getSetting = async () => {
      throw new Error('db down')
    }
    expect((await m.get()).enabled).toBe(false)
    err.mockRestore()
  })
})

describe('Chế độ bảo trì — SSR (D-54)', () => {
  const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  let render
  beforeEach(async () => {
    render = (await import('../src/entry-server.jsx')).render
  })
  const page = (url) =>
    renderPage({ repo, config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url.split('?')[0], maintenance })

  it('trang công khai: 503, Retry-After, noindex, trang tĩnh không có script app', async () => {
    await maintenance.set(true, null)
    for (const url of ['/', '/products/den-nguyet', '/lo/LO-1', '/en/products/x', '/zh', '/khong-co', '/products/%E0%A4%A']) {
      const p = await page(url)
      expect(p.status, url).toBe(503)
      expect(p.noindex).toBe(true)
      expect(p.retryAfter).toBe(600)
      expect(p.html).toContain('<meta name="robots" content="noindex" />')
      expect(p.html).not.toMatch(/<script/i)
      expect(p.html).not.toContain('__INITIAL_DATA__')
    }
  })

  it('đúng ngôn ngữ vi/en/zh', async () => {
    await maintenance.set(true, null)
    const vi_ = await page('/')
    expect(vi_.html).toContain('<html lang="vi">')
    expect(vi_.html).toContain('LAMVI đang bảo trì')
    const en = await page('/en/products/a')
    expect(en.html).toContain('<html lang="en">')
    expect(en.html).toContain('LAMVI is under maintenance')
    const zh = await page('/zh/lo/b')
    expect(zh.html).toContain('<html lang="zh-Hans">')
    expect(zh.html).toContain('LAMVI 正在维护')
    expect(maintenancePage('zh')).toContain('<title>LAMVI 正在维护</title>')
  })

  it('trang riêng tư không bị chặn: /login, /en/login, /register, /account, /admin/*, /it', async () => {
    await maintenance.set(true, null)
    for (const url of ['/login', '/en/login', '/zh/register', '/account', '/admin', '/admin/products', '/it']) {
      const p = await page(url)
      expect(p.status, url).toBe(200)
      expect(p.html).not.toContain('LAMVI đang bảo trì')
    }
  })

  it('tắt bảo trì → trang công khai trở lại bình thường', async () => {
    await maintenance.set(true, null)
    expect((await page('/')).status).toBe(503)
    await maintenance.set(false, null)
    expect((await page('/')).status).toBe(200)
  })

  it('maintenance lỗi đọc → trang vẫn render (fail-open)', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const m = createMaintenance({ repo: { getSetting: async () => Promise.reject(new Error('x')) }, ttlMs: 0 })
    const p = await renderPage({ repo, config: { publicSiteUrl: 'https://moc.test' }, template, render, url: '/', pathname: '/', maintenance: m })
    expect(p.status).toBe(200)
    err.mockRestore()
  })
})

describe('Sức khoẻ — thư giao dịch (Resend)', () => {
  const ok = { ping: async () => {} }
  const cfg = { useSupabase: true, mail: { from: 'LAMVI <a@lamvi.com.vn>', resendApiKey: 're_bi-mat' } }
  const run = (mailer, config = cfg) => runHealthChecks({ repo: ok, auth: ok, storage: ok, config, mailer, env: {} })
  const mail = (h) => h.checks.find((c) => c.name === 'mail')

  it('có khoá và nhà cung cấp trả lời → ok, kèm provider, không lộ khoá', async () => {
    const h = await run({ provider: 'resend', ping: async () => ({}) })
    expect(mail(h)).toMatchObject({ status: 'ok', provider: 'resend', configured: true })
    expect(JSON.stringify(h)).not.toMatch(/bi-mat/)
  })

  it('tên miền chưa xác minh → error với mã ngắn, status tổng degraded', async () => {
    const h = await run({ provider: 'resend', ping: async () => { throw new Error('domain_not_verified') } })
    expect(mail(h)).toMatchObject({ status: 'error', message: 'domain_not_verified' })
    expect(h.status).toBe('degraded')
  })

  it('khoá chỉ gửi → ok kèm note', async () => {
    const h = await run({ provider: 'resend', ping: async () => ({ note: 'sending_only' }) })
    expect(mail(h)).toMatchObject({ status: 'ok', note: 'sending_only' })
  })

  it('thiếu MAIL_FROM/khoá hoặc không có mailer → not_configured, không gọi ping', async () => {
    const ping = vi.fn()
    expect(mail(await run(null, { useSupabase: true, mail: {} }))).toMatchObject({ status: 'not_configured', configured: false })
    expect(mail(await run({ provider: 'resend', ping }, { useSupabase: true, mail: { from: 'a@b.vn' } })).status).toBe('not_configured')
    expect(ping).not.toHaveBeenCalled()
  })

  it('nhà cung cấp treo → timeout, không treo dashboard', async () => {
    const h = await runHealthChecks({ repo: ok, auth: ok, storage: ok, config: cfg, env: {}, timeoutMs: 30, mailer: { provider: 'resend', ping: () => new Promise(() => {}) } })
    expect(mail(h)).toMatchObject({ status: 'error', message: 'timeout' })
  })
})
