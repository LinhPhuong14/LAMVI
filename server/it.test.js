import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMetrics, percentile } from './monitoring/metrics.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { classifyPath } from '../src/seo/routes.js'

let app, repo, auth, metrics, maintenance, tokens
let clock

async function login(email, role) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  return `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
}

beforeEach(async () => {
  clock = Date.parse('2026-09-28T10:00:30Z')
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  metrics = createMetrics({ repo, classify: classifyPath, now: () => clock })
  maintenance = createMaintenance({ repo, ttlMs: 0 })
  app = createApp({
    repo,
    auth,
    storage: createMemoryStorage(),
    config: { publicSiteUrl: 'https://moc.test', useSupabase: false },
    metrics,
    maintenance,
  })
  tokens = {
    it: await login('it@moc.test', 'it'),
    admin: await login('admin@moc.test', 'admin'),
    customer: await login('khach@moc.test', 'customer'),
  }
})

describe('Phân quyền vai trò IT (D-51)', () => {
  it('/api/it/*: IT được; admin, khách → 403; chưa đăng nhập → 401', async () => {
    expect((await request(app).get('/api/it/health')).status).toBe(401)
    for (const role of ['admin', 'customer']) {
      const res = await request(app).get('/api/it/health').set('Authorization', tokens[role])
      expect(res.status, role).toBe(403)
    }
    expect((await request(app).get('/api/it/health').set('Authorization', tokens.it)).status).toBe(200)
  })

  it('IT có cả quyền admin', async () => {
    expect((await request(app).get('/api/admin/products').set('Authorization', tokens.it)).status).toBe(200)
    const created = await request(app)
      .post('/api/admin/faq')
      .set('Authorization', tokens.it)
      .send({ question: { vi: 'Q?' }, answer: { vi: 'A.' } })
    expect(created.status).toBe(201)
  })
})

describe('Sức khoẻ (D-52)', () => {
  it('trả trạng thái từng tích hợp, không lộ khoá', async () => {
    const res = await request(app).get('/api/it/health').set('Authorization', tokens.it)
    expect(res.body.status).toBe('attention')
    const byName = Object.fromEntries(res.body.checks.map((c) => [c.name, c]))
    expect(byName.database).toMatchObject({ status: 'ok', provider: 'memory' })
    expect(byName.payos).toMatchObject({ status: 'not_configured', configured: false })
    // T-49: chưa có MAIL_FROM/khoá → báo chưa cấu hình (không còn "not_integrated" gắn cứng)
    expect(byName.mail).toMatchObject({ status: 'not_configured', configured: false })
    // D-55: chưa có khoá OpenAI
    expect(byName.openai).toMatchObject({ status: 'not_configured', configured: false })
    expect(res.body.system).toMatchObject({ dataMode: 'memory', node: process.version })
    expect(res.body.maintenance).toMatchObject({ enabled: false })
    expect(JSON.stringify(res.body)).not.toMatch(/key|secret|password/i)
  })

  it('DB lỗi → status degraded, check database = error', async () => {
    repo.ping = async () => {
      throw new Error('connection refused')
    }
    const res = await request(app).get('/api/it/health').set('Authorization', tokens.it)
    expect(res.body.status).toBe('degraded')
    expect(res.body.checks.find((c) => c.name === 'database')).toMatchObject({ status: 'error', message: 'connection refused' })
  })
})

describe('Số liệu API (D-52, D-53)', () => {
  it('gộp theo route pattern (không theo slug), đếm 4xx/5xx, flush vào repo', async () => {
    await request(app).get('/api/products/den-nguyet')
    await request(app).get('/api/products/den-vong')
    await request(app).get('/api/products/khong-co')
    await request(app).get('/api/khong-co-route')

    const before = await request(app).get('/api/it/metrics?range=1h').set('Authorization', tokens.it)
    const route = before.body.routes.find((r) => r.route === '/api/products/:slug')
    expect(route).toMatchObject({ method: 'GET', count: 3, s2xx: 2, s4xx: 1, s5xx: 0 })
    expect(route.p95Ms).not.toBeNull()
    // Đường dẫn lạ gộp chung, không lưu đoạn URL tuỳ ý
    expect(before.body.routes.some((r) => r.route === '/api/*')).toBe(true)

    await metrics.flush()
    const stored = await repo.listApiMetrics({ since: '2026-09-28T00:00:00Z' })
    expect(stored.find((r) => r.route === '/api/products/:slug' && r.status === 200).count).toBe(2)
    // Sau flush vẫn thấy đủ số liệu (từ repo)
    const after = await request(app).get('/api/it/metrics?range=1h').set('Authorization', tokens.it)
    expect(after.body.routes.find((r) => r.route === '/api/products/:slug').count).toBe(3)
  })

  it('lỗi 5xx được ghi vào danh sách lỗi (không có query string)', async () => {
    repo.listFaq = async () => {
      throw new Error('db down')
    }
    await request(app).get('/api/faq?lang=en&token=bi-mat')
    const res = await request(app).get('/api/it/errors?range=1h').set('Authorization', tokens.it)
    expect(res.body.items[0]).toMatchObject({ route: '/api/faq', path: '/api/faq', status: 500, code: 'INTERNAL_ERROR', message: 'db down' })
    expect(JSON.stringify(res.body)).not.toContain('bi-mat')
  })

  it('khoảng thời gian: số liệu cũ hơn range không tính', async () => {
    await request(app).get('/api/products')
    await metrics.flush()
    clock += 2 * 3600_000
    const res = await request(app).get('/api/it/metrics?range=1h').set('Authorization', tokens.it)
    expect(res.body.routes.find((r) => r.route === '/api/products')).toBeUndefined()
    const day = await request(app).get('/api/it/metrics?range=24h').set('Authorization', tokens.it)
    expect(day.body.routes.find((r) => r.route === '/api/products').count).toBe(1)
  })

  it('percentile ước lượng theo histogram', () => {
    const row = { count: 10, max_ms: 3000, le_50: 5, le_100: 4, le_250: 0, le_500: 0, le_1000: 0, le_2500: 0, gt_2500: 1 }
    expect(percentile(row, 0.5)).toBe(50)
    expect(percentile(row, 0.9)).toBe(100)
    expect(percentile(row, 0.95)).toBe(3000)
  })
})

describe('Chế độ bảo trì (D-54)', () => {
  it('chỉ IT bật/tắt được; dữ liệu sai → 400', async () => {
    expect((await request(app).put('/api/it/maintenance').set('Authorization', tokens.admin).send({ enabled: true })).status).toBe(403)
    expect((await request(app).put('/api/it/maintenance').set('Authorization', tokens.it).send({ enabled: 'yes' })).status).toBe(400)
  })

  it('bật: API ghi trả 503 (trừ đăng nhập, /api/it); GET vẫn chạy; tắt: trở lại bình thường', async () => {
    const on = await request(app).put('/api/it/maintenance').set('Authorization', tokens.it).send({ enabled: true })
    expect(on.body).toMatchObject({ enabled: true })

    const write = await request(app).post('/api/admin/faq').set('Authorization', tokens.admin).send({ question: { vi: 'Q' }, answer: { vi: 'A' } })
    expect(write.status).toBe(503)
    expect(write.body.error.code).toBe('MAINTENANCE')
    expect(write.headers['retry-after']).toBe('600')
    expect((await request(app).post('/api/auth/register').send({})).status).toBe(503)

    expect((await request(app).get('/api/products')).status).toBe(200)
    expect((await request(app).post('/api/auth/login').send({ email: 'it@moc.test', password: 'Gio-Hoa#Sen2026' })).status).toBe(200)

    const off = await request(app).put('/api/it/maintenance').set('Authorization', tokens.it).send({ enabled: false })
    expect(off.body.enabled).toBe(false)
    expect((await request(app).post('/api/admin/faq').set('Authorization', tokens.admin).send({ question: { vi: 'Q' }, answer: { vi: 'A' } })).status).toBe(201)
  })

  it('SSR: bật bảo trì → trang công khai 503 + trang bảo trì; /login, /it vẫn render khung', async () => {
    const { renderPage } = await import('./ssr.js')
    const { render } = await import('../src/entry-server.jsx')
    const { readFileSync } = await import('node:fs')
    const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    await maintenance.set(true, null)
    const page = (url) => renderPage({ repo, config: { publicSiteUrl: 'https://moc.test' }, template, render, url, pathname: url, maintenance })
    const home = await page('/en')
    expect(home.status).toBe(503)
    expect(home.html).toContain('LAMVI is under maintenance')
    expect(home.html).not.toContain('/src/main.jsx')
    expect((await page('/login')).status).toBe(200)
    expect((await page('/it')).status).toBe(200)
  })

  it('không đọc được cài đặt → không chặn (fail-open)', async () => {
    const m = createMaintenance({ repo: { getSetting: async () => { throw new Error('x') } }, ttlMs: 0 })
    expect((await m.get()).enabled).toBe(false)
  })
})

describe('Nhật ký bảo trì (G-27)', () => {
  it('mỗi lần bật/tắt ghi một dòng audit_log; IT xem được, admin thì không', async () => {
    const put = (enabled) => request(app).put('/api/it/maintenance').set('Authorization', tokens.it).send({ enabled })
    await put(true)
    await put(false)
    const res = await request(app).get('/api/it/maintenance/log').set('Authorization', tokens.it)
    expect(res.status).toBe(200)
    expect(res.body.items.map((e) => e.action).sort()).toEqual(['disable', 'enable'])
    expect(res.body.items.every((e) => e.entity === 'maintenance' && e.actorRole === 'it')).toBe(true)
    expect((await request(app).get('/api/it/maintenance/log').set('Authorization', tokens.admin)).status).toBe(403)
  })
})

describe('Trạng thái tổng (feedback 08/10, mục 30)', () => {
  it('thành phần bắt buộc chưa cấu hình → attention; lỗi → degraded; đủ → ok', async () => {
    const { overallStatus } = await import('./monitoring/health.js')
    const ok = (name) => ({ name, status: 'ok' })
    expect(overallStatus([ok('database'), ok('auth'), { name: 'payos', status: 'configured' }, ok('mail')])).toBe('ok')
    expect(overallStatus([ok('database'), { name: 'payos', status: 'not_configured' }])).toBe('attention')
    expect(overallStatus([ok('database'), { name: 'mail', status: 'not_configured' }])).toBe('attention')
    expect(overallStatus([{ name: 'openai', status: 'not_configured' }, ok('database')])).toBe('ok')
    expect(overallStatus([{ name: 'database', status: 'error' }, { name: 'payos', status: 'not_configured' }])).toBe('degraded')
  })
})

describe('/api/it/notifications khi hàng đợi chưa bật (feedback 08/10, mục 31)', () => {
  it('trả danh sách rỗng enabled:false thay vì 404', async () => {
    const res = await request(app).get('/api/it/notifications?status=dead').set('Authorization', tokens.it)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ items: [], enabled: false })
  })
})
