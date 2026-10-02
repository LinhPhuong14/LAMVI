// Kiểm thử độc lập: endpoint cron /api/internal/expire-orders (Bearer CRON_SECRET).
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

const build = (cronSecret) =>
  createApp({
    repo: createMemoryRepo(),
    auth: createMemoryAuth(),
    storage: createMemoryStorage(),
    config: { publicSiteUrl: 'https://lamvi.test', cronSecret, rateLimit: { enabled: false } },
  })
const URL_ = '/api/internal/expire-orders'

describe('cron expire-orders', () => {
  const app = build('bimat-cron')
  it('thiếu header → 401', async () => {
    expect((await request(app).get(URL_)).status).toBe(401)
  })
  it('sai secret → 401', async () => {
    expect((await request(app).get(URL_).set('Authorization', 'Bearer sai')).status).toBe(401)
    expect((await request(app).get(URL_).set('Authorization', 'bimat-cron')).status).toBe(401)
  })
  it('header dài/ngắn khác secret không gây 500', async () => {
    for (const h of ['x', 'Bearer ' + 'a'.repeat(5000)]) {
      expect((await request(app).get(URL_).set('Authorization', h)).status).toBe(401)
    }
  })
  it('đúng secret → 200 (GET và POST)', async () => {
    const g = await request(app).get(URL_).set('Authorization', 'Bearer bimat-cron')
    expect(g.status).toBe(200)
    expect(g.body).toEqual({ cancelled: 0 })
    expect((await request(app).post(URL_).set('Authorization', 'Bearer bimat-cron')).status).toBe(200)
  })
  it('không cấu hình secret → 404 dù có header', async () => {
    const off = build(undefined)
    expect((await request(off).get(URL_)).status).toBe(404)
    expect((await request(off).get(URL_).set('Authorization', 'Bearer ')).status).toBe(404)
  })
})
