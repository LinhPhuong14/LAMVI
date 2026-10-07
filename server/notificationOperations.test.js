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

describe('notification operations role enforcement', () => {
  const id = '11111111-1111-4111-8111-111111111111'
  async function roleApp(role, retryable = true) {
    const repo = createMemoryRepo()
    await repo.upsertProfile({ id: 'operator', role, email: 'operator@test.invalid' })
    const outbox = { list: vi.fn(async () => []), retry: vi.fn(async () => retryable) }
    const auth = { getUser: async (token) => token === 'valid' ? { id: 'operator' } : null }
    return { app: build({ repo, auth, notificationOutbox: outbox }), outbox }
  }
  it('rejects anonymous, customer and admin retries before accessing the outbox', async () => {
    for (const role of ['customer', 'admin']) {
      const { app, outbox } = await roleApp(role)
      expect((await request(app).post(`/api/it/notifications/${id}/retry`)).status).toBe(401)
      expect((await request(app).post(`/api/it/notifications/${id}/retry`).set('Authorization', 'Bearer valid')).status).toBe(403)
      expect(outbox.retry).not.toHaveBeenCalled()
      expect((await request(app).get('/api/it/notifications').set('Authorization', 'Bearer valid')).status).toBe(403)
      expect(outbox.list).not.toHaveBeenCalled()
    }
  })
  it('passes authenticated IT identity to audited RPC and rejects expired retry', async () => {
    const { app, outbox } = await roleApp('it')
    expect((await request(app).post(`/api/it/notifications/${id}/retry`).set('Authorization', 'Bearer valid')).status).toBe(200)
    expect(outbox.retry).toHaveBeenCalledWith(id, 'operator')
    const denied = await roleApp('it', false)
    expect((await request(denied.app).post(`/api/it/notifications/${id}/retry`).set('Authorization', 'Bearer valid')).status).toBe(409)
  })
  it('rejects invalid statuses and identifiers without querying the DB', async () => {
    const { app, outbox } = await roleApp('it')
    expect((await request(app).get('/api/it/notifications?status=arbitrary').set('Authorization', 'Bearer valid')).status).toBe(400)
    expect((await request(app).post('/api/it/notifications/not-a-uuid/retry').set('Authorization', 'Bearer valid')).status).toBe(400)
    expect(outbox.list).not.toHaveBeenCalled(); expect(outbox.retry).not.toHaveBeenCalled()
  })
})
