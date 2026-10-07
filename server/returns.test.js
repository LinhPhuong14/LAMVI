import { describe, it, expect } from 'vitest'
import { createReturnsService, returnEligible, RETURN_BUCKET } from './returns/service.js'
import { createMemoryReturnsRepo } from './returns/repository.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
const now = Date.parse('2026-10-07T00:00:00Z')
function setup(maxBytes = 1000000) {
  const order = {
    id: 'order',
    code: 'LM1',
    userId: 'buyer',
    status: 'delivered',
    deliveredAt: new Date(now - 86400000).toISOString(),
    items: [{ slug: 'lamp', quantity: 2 }],
  }
  const repo = {
      getOrderByCode: async () => order,
      getOrderById: async () => order,
    },
    returnsRepo = createMemoryReturnsRepo(),
    storage = createMemoryStorage()
  return {
    repo,
    order,
    returnsRepo,
    storage,
    service: createReturnsService({
      repo,
      returnsRepo,
      storage,
      maxBytes,
      now: () => now,
    }),
  }
}
async function upload(x) {
  const u = await x.service.upload('LM1', 'buyer', {
    contentType: 'video/mp4',
    size: 3,
  })
  const r = await x.returnsRepo.get(u.id)
  x.storage.objects.set(`${RETURN_BUCKET}/${r.videoPath}`, {
    bytes: Buffer.from('abc'),
    contentType: 'video/mp4',
  })
  return u.id
}
const body = {
  continuousVideo: true,
  reason: 'shipping_damage',
  description: 'Lamp broken',
  items: [{ slug: 'lamp', quantity: 1 }],
}
describe('return policy and private review', () => {
  it('uses delivered time, includes precise seven day boundary and excludes future delivery', () => {
    expect(
      returnEligible(
        {
          status: 'delivered',
          deliveredAt: new Date(now - 7 * 86400000).toISOString(),
        },
        now,
      ),
    ).toBe(true)
    expect(
      returnEligible(
        {
          status: 'delivered',
          deliveredAt: new Date(now - 7 * 86400000 - 1).toISOString(),
        },
        now,
      ),
    ).toBe(false)
    expect(returnEligible({ status: 'delivered', deliveredAt: new Date(now + 1).toISOString() }, now)).toBe(false)
  })
  it('gates unknown upload business limits', async () => {
    const x = setup(0)
    await expect(x.service.upload('LM1', 'buyer', {})).rejects.toMatchObject({
      code: 'RETURNS_NOT_CONFIGURED',
    })
    expect((await x.service.ownerList('LM1', 'buyer')).eligible).toBe(false)
  })
  it('hides other owners and requires real uploaded video', async () => {
    const x = setup()
    await expect(x.service.ownerList('LM1', 'other')).rejects.toMatchObject({
      status: 404,
    })
    const u = await x.service.upload('LM1', 'buyer', {
      contentType: 'video/mp4',
      size: 3,
    })
    await expect(x.service.submit(u.id, 'buyer', body)).rejects.toMatchObject({
      code: 'RETURN_VIDEO_NOT_UPLOADED',
    })
    await expect(x.service.submit(u.id, 'other', body)).rejects.toMatchObject({
      status: 404,
    })
  })
  it('requires continuous acknowledgment and permitted reasons', async () => {
    const x = setup(),
      id = await upload(x)
    await expect(x.service.submit(id, 'buyer', { ...body, continuousVideo: false })).rejects.toMatchObject({
      code: 'INVALID_RETURN_REQUEST',
    })
    await expect(x.service.submit(id, 'buyer', { ...body, reason: 'changed_mind' })).rejects.toMatchObject({
      code: 'INVALID_RETURN_REQUEST',
    })
  })
  it('submitted request appears to owner and admin without private storage path', async () => {
    const x = setup(),
      id = await upload(x)
    const r = await x.service.submit(id, 'buyer', body)
    expect(r.status).toBe('requested')
    expect(r.videoPath).toBeUndefined()
    expect((await x.service.adminList()).items).toHaveLength(1)
    expect((await x.service.ownerList('LM1', 'buyer')).items).toHaveLength(1)
  })
  it('atomic submit prevents overlapping concurrent claim above bought quantity', async () => {
    const x = setup(),
      a = await upload(x),
      b = await upload(x)
    const results = await Promise.allSettled([
      x.service.submit(a, 'buyer', {
        ...body,
        items: [{ slug: 'lamp', quantity: 2 }],
      }),
      x.service.submit(b, 'buyer', {
        ...body,
        items: [{ slug: 'lamp', quantity: 2 }],
      }),
    ])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((r) => r.status === 'rejected')[0].reason.code).toBe('RETURN_QUANTITY_EXCEEDED')
  })
  it('admin rejection requires note and is compare-and-set', async () => {
    const x = setup(),
      id = await upload(x)
    await x.service.submit(id, 'buyer', body)
    await expect(x.service.decide(id, 'admin', { status: 'rejected', note: '' })).rejects.toMatchObject({
      code: 'INVALID_RETURN_DECISION',
    })
    expect(
      (
        await x.service.decide(id, 'admin', {
          status: 'rejected',
          note: 'Missing continuous footage',
        })
      ).status,
    ).toBe('rejected')
    await expect(x.service.decide(id, 'admin', { status: 'approved', note: 'Accepted' })).rejects.toMatchObject({
      code: 'RETURN_DECISION_CONFLICT',
    })
  })
  it('rejects late submissions despite previously issued upload', async () => {
    const x = setup(),
      id = await upload(x)
    x.order.deliveredAt = new Date(now - 8 * 86400000).toISOString()
    await expect(x.service.submit(id, 'buyer', body)).rejects.toMatchObject({
      code: 'RETURN_WINDOW_CLOSED',
    })
  })
})

describe('manual resolution and keyset support queue', () => {
  it('records manual outcome without financial actions, prevents replay and preserves claimed quantity', async () => {
    const x = setup(),
      id = await upload(x)
    await x.service.submit(id, 'buyer', { ...body, items: [{ slug: 'lamp', quantity: 2 }] })
    await expect(
      x.service.resolve(id, 'admin', { resolution: 'refund', note: 'Manually refunded' }),
    ).rejects.toMatchObject({ code: 'RETURN_RESOLUTION_CONFLICT' })
    await x.service.decide(id, 'admin', { status: 'approved', note: 'Evidence verified' })
    await expect(x.service.resolve(id, 'admin', { resolution: 'refund', note: '' })).rejects.toMatchObject({
      code: 'INVALID_RETURN_RESOLUTION',
    })
    const done = await x.service.resolve(id, 'admin', {
      resolution: 'refund',
      note: 'Manually refunded via original channel',
    })
    expect(done).toMatchObject({ status: 'resolved', resolution: 'refund' })
    expect((await x.returnsRepo.get(id)).resolvedBy).toBe('admin')
    expect((await x.service.ownerList('LM1', 'buyer')).items[0].resolutionNote).toContain('original channel')
    await expect(x.service.resolve(id, 'admin', { resolution: 'refund', note: 'Again' })).rejects.toMatchObject({
      code: 'RETURN_RESOLUTION_CONFLICT',
    })
    const second = await upload(x)
    await expect(x.service.submit(second, 'buyer', body)).rejects.toMatchObject({ code: 'RETURN_QUANTITY_EXCEEDED' })
  })
  it('reaches more than50 tied timestamp pending claims using opaque stable cursor', async () => {
    const x = setup()
    for (let i = 0; i < 65; i++)
      await x.returnsRepo.create({
        orderId: 'order',
        status: 'requested',
        items: [],
        createdAt: new Date(now).toISOString(),
      })
    const first = await x.service.adminList()
    expect(first.items).toHaveLength(50)
    expect(first.items[0].orderCode).toBe('LM1')
    expect(first.items[0].orderId).toBeUndefined()
    const second = await x.service.adminList({ cursor: first.nextCursor })
    expect(second.items).toHaveLength(15)
    expect(second.nextCursor).toBeNull()
    expect(new Set([...first.items, ...second.items].map((r) => r.id)).size).toBe(65)
  })
  it('filters approved/resolved/rejected and rejects tampered cursor', async () => {
    const x = setup()
    for (const status of ['approved', 'resolved', 'rejected'])
      await x.returnsRepo.create({ orderId: 'order', status, items: [], createdAt: new Date(now).toISOString() })
    expect((await x.service.adminList({ status: 'approved' })).items[0].status).toBe('approved')
    expect((await x.service.adminList({ status: 'resolved' })).items[0].status).toBe('resolved')
    await expect(x.service.adminList({ cursor: 'garbage' })).rejects.toMatchObject({ code: 'INVALID_RETURN_CURSOR' })
    await expect(x.service.adminList({ status: 'uploading' })).rejects.toMatchObject({ code: 'INVALID_RETURN_FILTER' })
  })
})

describe('return QA malformed payloads and response-loss retries', () => {
  it('rejects null and array item entries with400 instead of throwing TypeError', async () => {
    const x = setup(),
      id = await upload(x)
    for (const items of [[null], [[]]])
      await expect(x.service.submit(id, 'buyer', { ...body, items })).rejects.toMatchObject({
        status: 400,
        code: 'INVALID_RETURN_ITEMS',
      })
  })
  it('malformed request identifiers never reach UUID database queries', async () => {
    const x = setup()
    await expect(x.service.submit('not-a-uuid', 'buyer', body)).rejects.toMatchObject({ status: 404 })
    await expect(x.service.adminVideo('not-a-uuid')).rejects.toMatchObject({ status: 404 })
    await expect(x.service.decide('bad', 'admin', { status: 'approved', note: 'Accepted' })).rejects.toMatchObject({
      status: 404,
    })
    await expect(x.service.resolve('bad', 'admin', { resolution: 'refund', note: 'Recorded' })).rejects.toMatchObject({
      status: 404,
    })
  })
  it('same-payload retry returns existing request and prevents altered-payload replacement', async () => {
    const x = setup(),
      id = await upload(x)
    const first = await x.service.submit(id, 'buyer', body)
    expect(await x.service.submit(id, 'buyer', body)).toEqual(first)
    expect((await x.service.ownerList('LM1', 'buyer')).items).toHaveLength(1)
    await expect(x.service.submit(id, 'buyer', { ...body, description: 'Different claim' })).rejects.toMatchObject({
      code: 'RETURN_ALREADY_SUBMITTED',
    })
    await x.service.decide(id, 'admin', { status: 'approved', note: 'Accepted' })
    expect((await x.service.submit(id, 'buyer', body)).status).toBe('approved')
  })
  it('parallel retry of same request is idempotent without reserving twice', async () => {
    const x = setup(),
      id = await upload(x)
    const r = await Promise.all([x.service.submit(id, 'buyer', body), x.service.submit(id, 'buyer', body)])
    expect(r[0].id).toBe(r[1].id)
    expect((await x.service.ownerList('LM1', 'buyer')).items).toHaveLength(1)
  })
})
it('concurrent replay recovers a committed claim when stale uploading snapshot crosses deadline', async () => {
  const x = setup(),
    id = await upload(x)
  x.repo.getOrderById = async () => {
    await x.returnsRepo.change(id, 'uploading', {
      status: 'requested',
      reason: body.reason,
      description: body.description,
      items: body.items,
      submittedAt: new Date(now).toISOString(),
    })
    x.order.deliveredAt = new Date(now - 8 * 86400000).toISOString()
    return x.order
  }
  expect((await x.service.submit(id, 'buyer', body)).status).toBe('requested')
})
it('RPC deadline error after concurrent identical commit returns durable claim, not new reservation', async () => {
  const x = setup(),
    id = await upload(x)
  x.returnsRepo.submit = async () => {
    await x.returnsRepo.change(id, 'uploading', {
      status: 'requested',
      reason: body.reason,
      description: body.description,
      items: body.items,
      submittedAt: new Date(now).toISOString(),
    })
    throw Object.assign(Error('boundary raced'), { code: 'RETURN_WINDOW_CLOSED' })
  }
  expect((await x.service.submit(id, 'buyer', body)).status).toBe('requested')
  expect((await x.service.ownerList('LM1', 'buyer')).items).toHaveLength(1)
})
it('exact admin decision and resolution retries return one durable outcome and do not duplicate audit', async () => {
  const x = setup(),
    id = await upload(x)
  const audit = []
  x.repo.appendAuditLog = async (entries) => audit.push(...entries)
  await x.service.submit(id, 'buyer', body)
  const decision = { status: 'approved', note: 'Evidence verified' }
  const first = await x.service.decide(id, 'admin', decision)
  expect(await x.service.decide(id, 'admin', decision)).toEqual(first)
  const outcome = { resolution: 'replacement', note: 'Replacement delivered manually' }
  const done = await x.service.resolve(id, 'admin', outcome)
  expect(await x.service.resolve(id, 'admin', outcome)).toEqual(done)
  expect(audit).toHaveLength(2)
  await expect(x.service.resolve(id, 'otheradmin', outcome)).rejects.toMatchObject({
    code: 'RETURN_RESOLUTION_CONFLICT',
  })
  await expect(x.service.resolve(id, 'admin', { ...outcome, note: 'Changed history' })).rejects.toMatchObject({
    code: 'RETURN_RESOLUTION_CONFLICT',
  })
})
