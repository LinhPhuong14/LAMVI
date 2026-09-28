import { describe, it, expect } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { demoBatches } from './data/seed.js'

// Feature 4 — GET /api/batches/:code (FR-QR-006, D-40, D-43, [ASSUMPTION] video_published + videoUrl)

const makeApp = (data) => createApp({ repo: createMemoryRepo(data) })
const PUBLIC_KEYS = ['code', 'producedOn', 'story', 'title', 'videoUrl']

const expect404Json = (res) => {
  expect(res.status).toBe(404)
  expect(res.headers['content-type']).toMatch(/application\/json/)
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } })
}

describe('GET /api/batches/:code — mã lô bất thường', () => {
  const cases = {
    unicode: encodeURIComponent('LÔ-ĐÈN-九月'),
    emoji: encodeURIComponent('🏮'),
    'khoảng trắng': encodeURIComponent('DEMO 2026 01'),
    'khoảng trắng hai đầu': encodeURIComponent(' DEMO-2026-01 '),
    'rất dài (5000 ký tự)': 'A'.repeat(5000),
    'dấu chấm': '..',
    'SQL-ish': encodeURIComponent("' OR 1=1 --"),
    'null byte': '%00',
    'chữ thường của mã có thật': 'demo-2026-01',
  }
  for (const [name, code] of Object.entries(cases)) {
    it(`${name} → 404 JSON, không 500`, async () => {
      const res = await request(makeApp()).get(`/api/batches/${code}`)
      expect404Json(res)
    })
  }

  it('ký tự % lỗi mã hoá (%E0%A4%A) → 4xx JSON đúng dạng lỗi, không 500', async () => {
    const res = await request(makeApp()).get('/api/batches/%E0%A4%A')
    expect([400, 404]).toContain(res.status)
    expect(res.headers['content-type']).toMatch(/application\/json/)
    expect(Object.keys(res.body)).toEqual(['error'])
    expect(typeof res.body.error.code).toBe('string')
    expect(JSON.stringify(res.body)).not.toMatch(/URIError|stack|at /)
  })

  it('lô công khai có mã unicode được tra đúng', async () => {
    const b = { ...demoBatches[0], code: 'LÔ-9' }
    const res = await request(makeApp({ batches: [b] })).get(`/api/batches/${encodeURIComponent('LÔ-9')}`)
    expect(res.status).toBe(200)
    expect(res.body.item.code).toBe('LÔ-9')
  })
})

describe('GET /api/batches/:code — nội dung trả về', () => {
  it('chỉ trả trường công khai ở cả 3 ngôn ngữ, không lộ id/status/trường lạ', async () => {
    const b = { ...demoBatches[0], internalNote: 'bí mật', createdBy: 'admin@x', storagePath: 's3://raw' }
    const app = makeApp({ batches: [b] })
    for (const lang of ['vi', 'en', 'zh', 'fr']) {
      const res = await request(app).get(`/api/batches/DEMO-2026-01?lang=${lang}`)
      expect(res.status).toBe(200)
      expect(Object.keys(res.body)).toEqual(['item'])
      expect(Object.keys(res.body.item).sort()).toEqual(PUBLIC_KEYS)
      expect(JSON.stringify(res.body)).not.toMatch(/bí mật|admin@x|s3:\/\/raw|video_published|33333333/)
    }
  })

  it('title/story trả chuỗi theo ngôn ngữ', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026-01?lang=en')
    expect(res.body.item.title).toBe('September 2026 batch')
    expect(typeof res.body.item.story).toBe('string')
  })

  it('D-40: thiếu bản dịch zh → tiếng Việt', async () => {
    const b = { ...demoBatches[0], title: { vi: 'Lô A', en: 'Batch A' }, story: { vi: 'Chuyện' } }
    const res = await request(makeApp({ batches: [b] })).get('/api/batches/DEMO-2026-01?lang=zh')
    expect(res.body.item.title).toBe('Lô A')
    expect(res.body.item.story).toBe('Chuyện')
  })

  it('lang không hợp lệ → mặc định tiếng Việt, không lỗi', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026-01?lang=xx')
    expect(res.status).toBe(200)
    expect(res.body.item.title).toBe('Lô đèn tháng 9/2026')
  })

  it('lang lặp (?lang=en&lang=zh) → không 500', async () => {
    const res = await request(makeApp()).get('/api/batches/DEMO-2026-01?lang=en&lang=zh')
    expect(res.status).toBe(200)
  })

  it('D-10: lô sản xuất lâu năm (vd 2020) vẫn công khai', async () => {
    const b = { ...demoBatches[0], producedOn: '2020-01-01' }
    const res = await request(makeApp({ batches: [b] })).get('/api/batches/DEMO-2026-01')
    expect(res.status).toBe(200)
    expect(res.body.item.producedOn).toBe('2020-01-01')
  })

  it('producedOn null/title null → vẫn 200, trả null', async () => {
    const b = { ...demoBatches[0], producedOn: null, title: null, story: null }
    const res = await request(makeApp({ batches: [b] })).get('/api/batches/DEMO-2026-01')
    expect(res.status).toBe(200)
    expect(res.body.item).toMatchObject({ producedOn: null, title: null, story: null })
  })

  it('POST/DELETE vào /api/batches/:code không được xử lý như GET', async () => {
    const app = makeApp()
    for (const m of ['post', 'put', 'delete']) {
      const res = await request(app)[m]('/api/batches/DEMO-2026-01')
      expect(res.status).toBeGreaterThanOrEqual(400)
      expect(res.status).toBeLessThan(500)
    }
  })
})
