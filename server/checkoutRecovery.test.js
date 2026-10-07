import { randomUUID } from 'node:crypto'
import { beforeEach, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
let app, owner, outsider, key
beforeEach(async () => {
 const repo = createMemoryRepo()
 const auth = createMemoryAuth()
 async function login(email) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: 'Test' })
  const session = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { id: user.id, token: `Bearer ${session.accessToken}` }
 }
 owner = await login('owner@example.test')
 outsider = await login('other@example.test')
 key = randomUUID()
 await repo.createOrder({ code: 'RECOVERY-1', userId: owner.id, status: 'confirmed', paymentMethod: 'cod', total: 1000, checkoutIdempotencyKey: key, checkoutFingerprint: 'a'.repeat(64), qrToken: 'secret' }, [])
 app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://LAMVI.test', rateLimit: { enabled: false } } })
})
it('returns the committed order for the owner, without exposing internal request or QR secrets', async () => {
 const result = await request(app).get(`/api/checkout/requests/${key}`).set('Authorization', owner.token)
 expect(result.status).toBe(200)
 expect(result.body.order.code).toBe('RECOVERY-1')
 expect(JSON.stringify(result.body)).not.toContain('secret')
 expect(result.body.order).not.toHaveProperty('checkoutFingerprint')
 expect(result.body.order).not.toHaveProperty('checkoutIdempotencyKey')
})
it('does not reveal another user request key and requires authentication', async () => {
 expect((await request(app).get(`/api/checkout/requests/${key}`).set('Authorization', outsider.token)).status).toBe(404)
 expect((await request(app).get(`/api/checkout/requests/${key}`)).status).toBe(401)
 expect((await request(app).get('/api/checkout/requests/not-a-key').set('Authorization', owner.token)).status).toBe(404)
 expect((await request(app).get(`/api/checkout/requests/${randomUUID()}`).set('Authorization', owner.token)).status).toBe(404)
})
