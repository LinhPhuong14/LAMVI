import { describe, it, expect } from 'vitest'
import { createReturnsService, RETURN_BUCKET } from './returns/service.js'
import { createMemoryReturnsRepo } from './returns/repository.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

// D-109: video đổi trả xoá 90 ngày sau khi xử lý xong (resolved: resolvedAt; rejected: decidedAt)
const DAY = 86400000
const now = Date.parse('2026-10-20T00:00:00Z')
const ago = (d) => new Date(now - d * DAY).toISOString()

async function setup() {
  const returnsRepo = createMemoryReturnsRepo()
  const storage = createMemoryStorage()
  const service = createReturnsService({ repo: { getOrderById: async () => ({ code: 'LM1' }) }, returnsRepo, storage, maxBytes: 1e6, now: () => now })
  const add = async (status, extra) => {
    const r = await returnsRepo.create({ orderId: 'o', userId: 'u', status, videoPath: `u/o/${status}-${Math.random()}`, createdAt: ago(200), items: [], ...extra })
    storage.objects.set(`${RETURN_BUCKET}/${r.videoPath}`, { bytes: Buffer.from('x'), contentType: 'video/mp4' })
    return r
  }
  return { returnsRepo, storage, service, add }
}
const has = (x, r) => x.storage.objects.has(`${RETURN_BUCKET}/${r.videoPath}`)

describe('xoá video đổi trả quá hạn lưu (D-109)', () => {
  it('xoá resolved/rejected quá 90 ngày, giữ yêu cầu và đánh dấu đã xoá', async () => {
    const x = await setup()
    const resolved = await x.add('resolved', { resolvedAt: ago(91) })
    const rejected = await x.add('rejected', { decidedAt: ago(120) })
    expect(await x.service.purgeExpiredVideos()).toBe(2)
    expect(has(x, resolved)).toBe(false)
    expect(has(x, rejected)).toBe(false)
    const row = await x.returnsRepo.get(resolved.id)
    expect(row.videoPurgedAt).toBe(new Date(now).toISOString())
    expect(row.status).toBe('resolved')
  })
  it('giữ video chưa đủ 90 ngày, đang chờ duyệt/đã duyệt chưa xử lý, hoặc đang tải lên', async () => {
    const x = await setup()
    const rows = [
      await x.add('resolved', { resolvedAt: ago(89) }),
      await x.add('rejected', { decidedAt: ago(10) }),
      await x.add('requested', { submittedAt: ago(300) }),
      await x.add('approved', { decidedAt: ago(300) }),
      await x.add('uploading'),
    ]
    expect(await x.service.purgeExpiredVideos()).toBe(0)
    for (const r of rows) expect(has(x, r)).toBe(true)
  })
  it('đúng mốc 90 ngày thì xoá; chạy lại không xoá lần hai', async () => {
    const x = await setup()
    const r = await x.add('resolved', { resolvedAt: ago(90) })
    expect(await x.service.purgeExpiredVideos()).toBe(1)
    expect(has(x, r)).toBe(false)
    expect(await x.service.purgeExpiredVideos()).toBe(0)
  })
  it('lỗi xoá một tệp không chặn tệp khác và không đánh dấu tệp lỗi (lần sau thử lại)', async () => {
    const x = await setup()
    const bad = await x.add('resolved', { resolvedAt: ago(100) })
    const good = await x.add('resolved', { resolvedAt: ago(100) })
    const remove = x.storage.removeObject
    x.storage.removeObject = async (p, b) => {
      if (p === bad.videoPath) throw new Error('boom')
      return remove(p, b)
    }
    expect(await x.service.purgeExpiredVideos()).toBe(1)
    expect((await x.returnsRepo.get(bad.id)).videoPurgedAt ?? null).toBeNull()
    expect(has(x, good)).toBe(false)
    x.storage.removeObject = remove
    expect(await x.service.purgeExpiredVideos()).toBe(1)
  })
  it('admin xem video đã xoá nhận 410; view báo videoPurged', async () => {
    const x = await setup()
    const r = await x.add('resolved', { resolvedAt: ago(100), submittedAt: ago(101) })
    await x.service.purgeExpiredVideos()
    await expect(x.service.adminVideo(r.id)).rejects.toMatchObject({ status: 410, code: 'RETURN_VIDEO_PURGED' })
    const list = await x.service.adminList({ status: 'resolved' })
    expect(list.items[0].videoPurged).toBe(true)
  })
})
