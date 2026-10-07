import { describe, expect, it, vi } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMessageService } from './messages/service.js'

const stamp = new Date('2026-10-07T00:00:00Z')
const setup = async (count, expired = true) => {
  const orders = Array.from({ length: count }, (_, i) => ({ id: `order-${i}`, code: `ORDER-${i}`, status: 'delivered', deliveredAt: expired ? '2026-01-01' : '2026-10-06' }))
  const repo = createMemoryRepo({ orders })
  for (let i = 0; i < count; i++) await repo.upsertGiftMessage(orders[i].id, { voicePath: `private-${i}` })
  return { repo, orders }
}
describe('gift media eligible keyset cleanup at scale', () => {
  it('finds expired rows after more than1000 unexpired media rows and keeps unapproved deadlines intact', async () => {
    const { repo } = await setup(1001, false)
    await repo.createOrder({ id: 'late-expired', code: 'LATE-EXPIRED', status: 'delivered', deliveredAt: '2026-01-01' }, [])
    await repo.upsertGiftMessage('late-expired', { voicePath: 'expired-object' })
    await repo.createOrder({ id: 'cancelled-no-deadline', code: 'CANCELLED-NO-DEADLINE', status: 'cancelled', deliveredAt: null }, [])
    await repo.upsertGiftMessage('cancelled-no-deadline', { voicePath: 'unapproved-orphan' })
    const storage = { removeObject: vi.fn(async () => {}) }
    const service = createMessageService({ repo, storage, now: () => stamp })
    expect(await service.purgeExpiredMedia()).toBe(1)
    expect(storage.removeObject).toHaveBeenCalledWith('expired-object', 'gift-media')
    expect((await repo.getGiftMessage('cancelled-no-deadline')).voicePath).toBe('unapproved-orphan')
  })
  it('bounds each run to10, advances through persistent failed records and wraps to retry them', async () => {
    const { repo } = await setup(25)
    const removeObject = vi.fn(async () => { throw new Error('permanent failure with synthetic@example.invalid') })
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = createMessageService({ repo, storage: { removeObject }, now: () => stamp })
    await service.purgeExpiredMedia()
    expect(removeObject).toHaveBeenCalledTimes(10)
    await service.purgeExpiredMedia()
    expect(removeObject).toHaveBeenCalledTimes(20)
    await service.purgeExpiredMedia()
    expect(removeObject).toHaveBeenCalledTimes(25)
    expect(new Set(removeObject.mock.calls.map(([path]) => path)).size).toBe(25)
    await service.purgeExpiredMedia()
    expect(removeObject).toHaveBeenCalledTimes(35)
    expect(log.mock.calls.flat().join(' ')).not.toContain('synthetic@example.invalid')
    log.mockRestore()
  })
  it('bounds stalled storage work to5 in flight and times out without falsely marking deleted', async () => {
    const { repo, orders } = await setup(10)
    const removeObject = vi.fn(async () => new Promise(() => {}))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const service = createMessageService({ repo, storage: { removeObject }, now: () => stamp, cleanupTimeoutMs: 10 })
    expect(await service.purgeExpiredMedia()).toBe(0)
    expect(removeObject).toHaveBeenCalledTimes(5)
    expect((await repo.getGiftMessage(orders[0].id)).mediaDeletedAt).toBeNull()
    expect((await repo.getSetting('gift_media_cleanup_cursor')).value.after).toBeTruthy()
    log.mockRestore()
  })
})
