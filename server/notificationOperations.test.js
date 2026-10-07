import { describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'

function build(extra = {}) {
  return createApp({ repo: createMemoryRepo(), auth: createMemoryAuth(), config: { publicSiteUrl: 'https://lamvi.test', cronSecret: 'cron', rateLimit: { enabled: false } }, ...extra })
}
describe('notification scheduler authorization', () => {
  const run = vi.fn(async () => ({ claimed: 0, sent: 0, saturated: false }))
  const app = build({ notifications: run })
  it('requires configured worker and cron bearer', async () => {
    expect((await request(build()).get('/api/internal/notifications').set('Authorization', 'Bearer cron')).status).toBe(404)
    expect((await request(app).get('/api/internal/notifications')).status).toBe(401)
    expect((await request(app).get('/api/internal/notifications').set('Authorization', 'Bearer wrong')).status).toBe(401)
    expect(run).not.toHaveBeenCalled()
  })
  it('runs only authenticated GET/POST in same function', async () => {
    expect((await request(app).get('/api/internal/notifications').set('Authorization', 'Bearer cron')).status).toBe(200)
    expect((await request(app).post('/api/internal/notifications').set('Authorization', 'Bearer cron')).status).toBe(200)
    expect((await request(app).put('/api/internal/notifications').set('Authorization', 'Bearer cron')).status).toBe(405)
  })
})
