import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createSupabaseRepo } from './adapters/supabase/repo.js'

let app, repo, admin, customer
beforeEach(async () => {
  repo = createMemoryRepo(); const auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage() })
  for (const role of ['admin', 'customer']) {
    const { user } = await auth.signUp({ email: `${role}@test.com`, password: 'Strong#Pw2026' })
    await repo.upsertProfile({ id: user.id, role })
    const token = `Bearer ${(await auth.signIn({ email: user.email, password: 'Strong#Pw2026' })).accessToken}`
    if (role === 'admin') admin = token; else customer = token
  }
})
const draft = { slug: 'new-collection', name: { vi: 'Bộ thật', en: 'Real collection' }, storyTitle: { vi: 'Bí mật' }, story: { vi: 'Nội dung đã duyệt' } }
const api = (method, url, body) => request(app)[method](url).set('Authorization', admin).send(body)
describe('collection management D96 D97', () => {
  it('guards all admin routes including reward data', async () => {
    expect((await request(app).get('/api/admin/collections')).status).toBe(401)
    expect((await request(app).get('/api/admin/collections').set('Authorization', customer)).status).toBe(403)
  })
  it('creates draft, translates fields, edits and deletes unused collection', async () => {
    const c = await api('post', '/api/admin/collections', draft)
    expect(c.status).toBe(201); expect(c.body.item.status).toBe('draft')
    expect((await request(app).get('/api/collections')).text).not.toContain('Nội dung đã duyệt')
    const id = c.body.item.id
    expect((await api('patch', `/api/admin/collections/${id}`, { status: 'published', sortOrder: 2 })).status).toBe(200)
    expect((await request(app).get('/api/collections/new-collection')).status).toBe(404) // Empty published does not make broken card
    expect((await api('patch', `/api/admin/collections/${id}`, { slug: 'changed' })).status).toBe(409)
    expect((await api('delete', `/api/admin/collections/${id}`)).status).toBe(204)
    const logs = await repo.listAuditLog({ entity: 'collection', entityId: id })
    expect(JSON.stringify(logs)).not.toContain('Nội dung đã duyệt')
  })
  it('rejects duplicates invalid locales types and non-existent assignments', async () => {
    await api('post', '/api/admin/collections', draft)
    expect((await api('post', '/api/admin/collections', draft)).status).toBe(409)
    for (const bad of [{ slug: '../x' }, { name: { en: 'No Vietnamese' } }, { story: { fr: 'x' } }, { sortOrder: '1' }, { status: 'gone' }]) expect((await api('post', '/api/admin/collections', { ...draft, ...bad })).status).toBe(400)
    expect((await api('post', '/api/admin/products', { slug: 'new-lamp', kind: 'single', price: 1000, name: { vi: 'Đèn' }, collectionSlug: 'does-not-exist' })).status).toBe(400)
  })
  it('published assigned product appears without leaking rewards, attached collection cannot delete', async () => {
    const c = (await api('post', '/api/admin/collections', { ...draft, status: 'published' })).body.item
    const p = await api('post', '/api/admin/products', { slug: 'new-lamp', kind: 'single', price: 1000, status: 'published', name: { vi: 'Đèn' }, collectionSlug: c.slug, pieceOrder: 3 })
    expect(p.status).toBe(201)
    const pub = await request(app).get(`/api/collections/${c.slug}`)
    expect(pub.status).toBe(200); expect(pub.body.item.lamps[0].slug).toBe('new-lamp')
    expect(pub.text).not.toContain('Nội dung đã duyệt')
    expect((await api('delete', `/api/admin/collections/${c.id}`)).status).toBe(409)
    expect((await api('patch', `/api/admin/collections/${c.id}`, { status: 'hidden' })).status).toBe(200)
    expect((await request(app).get(`/api/collections/${c.slug}`)).status).toBe(404)
  })
})

describe('Supabase collection boundary', () => {
  it('maps writes only known columns and returns camel case without dropping rewards', async () => {
    let written
    const row = { id: 'uuid', ...draft, story_title: draft.storyTitle, sort_order: 0, status: 'draft' }
    const client = { from: (table) => { expect(table).toBe('collections'); const b = { insert: (v) => { written = v; return b }, select: () => b, single: async () => ({ data: row }) }; return b } }
    const c = await createSupabaseRepo(client).createCollection({ ...draft, status: 'draft', sortOrder: 0, actorId: 'ignored' })
    expect(written.story_title).toEqual(draft.storyTitle); expect(written.actorId).toBeUndefined(); expect(c.storyTitle).toEqual(draft.storyTitle)
  })
  it('converts delete FK race into known conflict instead of generic 500', async () => {
    const b = { delete: () => b, eq: () => b, select: async () => ({ error: { code: '23503', message: 'products_collection_slug_fkey' } }) }
    await expect(createSupabaseRepo({ from: () => b }).deleteCollection('uuid')).rejects.toMatchObject({ code: 'COLLECTION_IN_USE' })
  })
})
