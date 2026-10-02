import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMaintenance } from './monitoring/maintenance.js'

let app, repo, auth, token

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  const maintenance = createMaintenance({ repo, ttlMs: 0 })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' }, maintenance })
  const { user } = await auth.signUp({ email: 'an@moc.test', password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: 'An' })
  token = `Bearer ${(await auth.signIn({ email: 'an@moc.test', password: 'matkhau123' })).accessToken}`
})

describe('Giỏ trả ảnh sản phẩm (D-83)', () => {
  it('có ảnh → product.image {url, alt}; không ảnh → null; quote cho khách cũng có', async () => {
    const p = await repo.getProductBySlug('den-nguyet')
    await repo.updateProduct(p.id, { imageUrl: 'https://cdn.moc.test/a.jpg', imageAlt: { vi: 'Đèn', en: 'Lantern' } })
    await request(app).put('/api/cart/items/den-nguyet').set('Authorization', token).send({ quantity: 1 }).expect(200)
    const res = await request(app).put('/api/cart/items/den-vong').set('Authorization', token).send({ quantity: 1 })
    const by = Object.fromEntries(res.body.items.map((i) => [i.slug, i.product.image]))
    expect(by['den-nguyet']).toEqual({ url: 'https://cdn.moc.test/a.jpg', alt: 'Đèn' })
    expect(by['den-vong']).toBeNull()
    const q = await request(app).post('/api/cart/quote?lang=en').send({ items: [{ slug: 'den-nguyet', quantity: 1 }] })
    expect(q.body.items[0].product.image).toEqual({ url: 'https://cdn.moc.test/a.jpg', alt: 'Lantern' })
  })

  it('quote của khách với sản phẩm bị ẩn → image null (không lộ ảnh)', async () => {
    const p = await repo.getProductBySlug('den-nguyet')
    await repo.updateProduct(p.id, { imageUrl: 'https://cdn.moc.test/a.jpg', status: 'hidden' })
    const res = await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-nguyet', quantity: 1 }] })
    expect(res.body.items[0].available).toBe(false)
    expect(res.body.items[0].product.image).toBeNull()
  })
})
