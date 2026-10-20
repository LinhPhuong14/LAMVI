import { describe, it, expect, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMemoryReturnsRepo, createSupabaseReturnsRepo } from './returns/repository.js'
import { createReturnsService, RETURN_BUCKET } from './returns/service.js'

const DAY = 86400000
const ago = (d, base = Date.now()) => new Date(base - d * DAY).toISOString()
const H = { Authorization: 'Bearer s3cret' }

function build() {
  const returnsRepo = createMemoryReturnsRepo()
  const storage = createMemoryStorage()
  const app = createApp({
    repo: createMemoryRepo(),
    auth: createMemoryAuth(),
    storage,
    returnsRepo,
    config: { publicSiteUrl: 'https://lamvi.test', cronSecret: 's3cret', rateLimit: { enabled: false } },
  })
  const add = async (status, extra) => {
    const r = await returnsRepo.create({ orderId: 'o', userId: 'u', status, videoPath: `u/o/${Math.random()}`, createdAt: ago(300), items: [], ...extra })
    storage.objects.set(`${RETURN_BUCKET}/${r.videoPath}`, { bytes: Buffer.from('x'), contentType: 'video/mp4' })
    return r
  }
  const has = (r) => storage.objects.has(`${RETURN_BUCKET}/${r.videoPath}`)
  return { app, returnsRepo, storage, add, has }
}

describe('cron endpoints purge return videos (independent)', () => {
  for (const [url, extra] of [['/api/internal/expire-orders', { cancelled: 0 }]]) {
    it(`${url}: auth required, count returned, unresolved kept`, async () => {
      const x = build()
      expect((await request(x.app).get(url)).status).toBe(401)
      expect((await request(x.app).get(url).set('Authorization', 'Bearer nope')).status).toBe(401)
      const a = await x.add('resolved', { resolvedAt: ago(100) })
      const b = await x.add('rejected', { decidedAt: ago(95) })
      const keepApproved = await x.add('approved', { decidedAt: ago(400) })
      const keepNew = await x.add('resolved', { resolvedAt: ago(10) })
      // unauthenticated call must not purge
      expect(x.has(a)).toBe(true)
      const res = await request(x.app).post(url).set(H)
      expect(res.status).toBe(200)
      expect(res.body).toMatchObject({ ...extra, mediaPurged: 0, returnVideosPurged: 2 })
      expect([x.has(a), x.has(b), x.has(keepApproved), x.has(keepNew)]).toEqual([false, false, true, true])
      expect((await x.returnsRepo.get(a.id)).videoPurgedAt).toBeTruthy()
      // second run: no re-purge
      const again = await request(x.app).get(url).set(H)
      expect(again.body.returnVideosPurged).toBe(0)
    })
  }
  it('without returnsRepo the cron still works and reports 0', async () => {
    const app = createApp({
      repo: createMemoryRepo(), auth: createMemoryAuth(), storage: createMemoryStorage(),
      config: { publicSiteUrl: 'https://lamvi.test', cronSecret: 's3cret', rateLimit: { enabled: false } },
    })
    const res = await request(app).get('/api/internal/expire-orders').set(H)
    expect(res.body.returnVideosPurged).toBe(0)
  })
})

describe('service edge cases (independent)', () => {
  const mk = (now) => {
    const returnsRepo = createMemoryReturnsRepo()
    const storage = createMemoryStorage()
    const service = createReturnsService({ repo: {}, returnsRepo, storage, maxBytes: 0, now: () => now })
    return { returnsRepo, storage, service }
  }
  const NOW = Date.parse('2026-10-20T12:00:00.000Z')
  it('exactly 90 days purged, 1ms short is not', async () => {
    const { returnsRepo, service, storage } = mk(NOW)
    const edge = await returnsRepo.create({ status: 'resolved', resolvedAt: new Date(NOW - 90 * DAY).toISOString(), videoPath: 'e', createdAt: ago(200, NOW) })
    const short = await returnsRepo.create({ status: 'rejected', decidedAt: new Date(NOW - 90 * DAY + 1).toISOString(), videoPath: 's', createdAt: ago(200, NOW) })
    storage.objects.set(`${RETURN_BUCKET}/e`, { bytes: Buffer.from('x') })
    storage.objects.set(`${RETURN_BUCKET}/s`, { bytes: Buffer.from('x') })
    expect(await service.purgeExpiredVideos()).toBe(1)
    expect((await returnsRepo.get(edge.id)).videoPurgedAt).toBeTruthy()
    expect((await returnsRepo.get(short.id)).videoPurgedAt ?? null).toBeNull()
    expect(storage.objects.has(`${RETURN_BUCKET}/s`)).toBe(true)
  })
  it('purged request is never removed again (removeObject not called)', async () => {
    const { returnsRepo, service, storage } = mk(NOW)
    await returnsRepo.create({ status: 'resolved', resolvedAt: ago(200, NOW), videoPurgedAt: ago(5, NOW), videoPath: 'p', createdAt: ago(300, NOW) })
    const spy = vi.spyOn(storage, 'removeObject')
    expect(await service.purgeExpiredVideos()).toBe(0)
    expect(spy).not.toHaveBeenCalled()
  })
  it('markPurged on an already purged row returns null (race-safe)', async () => {
    const { returnsRepo } = mk(NOW)
    const r = await returnsRepo.create({ status: 'resolved', resolvedAt: ago(200, NOW), videoPath: 'p', createdAt: ago(300, NOW) })
    expect(await returnsRepo.markPurged(r.id, 'a')).toBeTruthy()
    expect(await returnsRepo.markPurged(r.id, 'b')).toBeNull()
  })
  it('approved with resolvedAt/decidedAt very old is never listed', async () => {
    const { returnsRepo } = mk(NOW)
    await returnsRepo.create({ status: 'approved', decidedAt: ago(999, NOW), resolvedAt: ago(999, NOW), videoPath: 'a', createdAt: ago(1000, NOW) })
    expect(await returnsRepo.listPurgeable({ cutoff: new Date(NOW).toISOString() })).toEqual([])
  })
})

describe('Supabase listPurgeable query shape (independent)', () => {
  function mockAdmin(rows = []) {
    const calls = []
    const q = new Proxy({}, {
      get(_, name) {
        if (name === 'then') return (res) => res({ data: rows, error: null })
        return (...args) => { calls.push([name, args]); return q }
      },
    })
    return { admin: { from: (t) => { calls.push(['from', [t]]); return q } }, calls }
  }
  it('uses valid PostgREST or() with inclusive lte and null guard', async () => {
    const { admin, calls } = mockAdmin([{ id: 'x', video_purged_at: null }])
    const cutoff = '2026-07-22T12:00:00.000Z'
    const out = await createSupabaseReturnsRepo(admin).listPurgeable({ cutoff, limit: 500 })
    expect(out).toHaveLength(1)
    const get = (n) => calls.find(([k]) => k === n)?.[1]
    expect(get('from')).toEqual(['return_requests'])
    expect(get('is')).toEqual(['video_purged_at', null])
    const or = get('or')[0]
    expect(or).toBe(`and(status.eq.resolved,resolved_at.lte.${cutoff}),and(status.eq.rejected,decided_at.lte.${cutoff})`)
    // balanced parens, no whitespace, only <= (never lt.)
    expect((or.match(/\(/g) ?? []).length).toBe((or.match(/\)/g) ?? []).length)
    expect(or).not.toMatch(/\s|\.lt\./)
    expect(get('limit')).toEqual([100])
  })
  it('markPurged guards on video_purged_at is null', async () => {
    const { admin, calls } = mockAdmin({ id: 'x' })
    await createSupabaseReturnsRepo(admin).markPurged('x', 'T').catch(() => {})
    expect(calls.find(([k]) => k === 'update')[1]).toEqual([{ video_purged_at: 'T' }])
    expect(calls.find(([k]) => k === 'is')[1]).toEqual(['video_purged_at', null])
  })
})
