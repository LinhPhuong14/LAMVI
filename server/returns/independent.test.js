import { expect, it, vi } from 'vitest'
import { createReturnsService } from './service.js'
import { createMemoryReturnsRepo } from './repository.js'
const instant = Date.parse('2026-10-07T10:00:00Z')
function fixture() {
  const order = {
    id: 'o1',
    code: 'LV1',
    userId: 'u1',
    status: 'delivered',
    deliveredAt: new Date(instant - 86400000).toISOString(),
    items: [{ slug: 'lamp', quantity: 1 }],
  }
  const repo = {
    getOrderByCode: async () => order,
    getOrderById: async () => order,
  }
  const returnsRepo = createMemoryReturnsRepo()
  const storage = {
    createUpload: vi.fn(async () => ({
      uploadUrl: 'https://storage.test/upload',
    })),
    statObject: vi.fn(async () => ({ size: 10, contentType: 'video/mp4' })),
    signedUrl: vi.fn(),
  }
  const service = createReturnsService({
    repo,
    returnsRepo,
    storage,
    maxBytes: 100,
    now: () => instant,
  })
  return { service, returnsRepo, storage }
}
const input = {
  reason: 'wrong_item',
  description: 'Wrong lamp arrived',
  continuousVideo: true,
  items: [{ slug: 'lamp', quantity: 1 }],
}
it('parallel valid requests cannot claim the same purchased unit twice', async () => {
  const f = fixture()
  const a = await f.service.upload('LV1', 'u1', {
    size: 10,
    contentType: 'video/mp4',
  })
  const b = await f.service.upload('LV1', 'u1', {
    size: 10,
    contentType: 'video/mp4',
  })
  const results = await Promise.allSettled([f.service.submit(a.id, 'u1', input), f.service.submit(b.id, 'u1', input)])
  expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
  expect(results.find((r) => r.status === 'rejected').reason.code).toBe('RETURN_QUANTITY_EXCEEDED')
})
it('another customer cannot inspect or submit an uploaded request', async () => {
  const f = fixture()
  const a = await f.service.upload('LV1', 'u1', {
    size: 10,
    contentType: 'video/mp4',
  })
  await expect(f.service.submit(a.id, 'u2', input)).rejects.toMatchObject({
    status: 404,
  })
  expect(f.storage.statObject).not.toHaveBeenCalled()
})
it('declared video metadata never substitutes for actual object metadata', async () => {
  const f = fixture()
  const a = await f.service.upload('LV1', 'u1', {
    size: 10,
    contentType: 'video/mp4',
  })
  f.storage.statObject.mockResolvedValue({
    size: 11,
    contentType: 'video/mp4',
  })
  await expect(f.service.submit(a.id, 'u1', input)).rejects.toMatchObject({
    code: 'RETURN_VIDEO_NOT_UPLOADED',
  })
  expect((await f.returnsRepo.get(a.id)).status).toBe('uploading')
})
it('customer response excludes private object paths and staff identity', async () => {
  const f = fixture()
  const a = await f.service.upload('LV1', 'u1', {
    size: 10,
    contentType: 'video/mp4',
  })
  await f.service.submit(a.id, 'u1', input)
  await f.service.decide(a.id, 'staff-private', {
    status: 'approved',
    note: 'Reviewed video',
  })
  const result = await f.service.ownerList('LV1', 'u1')
  expect(result.items[0]).not.toHaveProperty('videoPath')
  expect(result.items[0]).not.toHaveProperty('decidedBy')
})

it('resolved replacement remains claimed and replay cannot change the recorded outcome', async () => {
  const f = fixture()
  const a = await f.service.upload('LV1', 'u1', { size: 10, contentType: 'video/mp4' })
  await f.service.submit(a.id, 'u1', input)
  await f.service.decide(a.id, 'staff', { status: 'approved', note: 'Verified' })
  await f.service.resolve(a.id, 'staff', { resolution: 'replacement', note: 'Replacement dispatched' })
  await expect(f.service.resolve(a.id, 'staff', { resolution: 'refund', note: 'Changed outcome' })).rejects.toMatchObject({ code: 'RETURN_RESOLUTION_CONFLICT' })
  const b = await f.service.upload('LV1', 'u1', { size: 10, contentType: 'video/mp4' })
  await expect(f.service.submit(b.id, 'u1', input)).rejects.toMatchObject({ code: 'RETURN_QUANTITY_EXCEEDED' })
  expect((await f.returnsRepo.get(a.id)).resolution).toBe('replacement')
})
