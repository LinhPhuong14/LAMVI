import { describe, expect, it, vi } from 'vitest'
import { createNotificationWorker } from './outbox.js'
import { createNotificationOutboxRepo } from './outboxRepo.js'
import { createMailer } from './mailer.js'

const date = new Date('2026-10-07T10:00:00Z')
const job = { id: 'job-1', order_id: 'order-1', event: 'confirmed', snapshot: { code: 'LV000001', total: 1000 }, attempts: 1, created_at: date.toISOString(), lease_token: 'lease-1' }
function fixture(overrides = {}) {
  const outbox = { claim: vi.fn(async () => [{ ...job, ...overrides }]), settle: vi.fn(async () => [{ id: job.id }]) }
  const repo = { getOrderById: async () => ({ userId: 'user', items: [] }), getProfile: async () => ({ email: 'test@example.test', preferredLocale: 'en' }) }
  const mailer = { send: vi.fn(async () => ({ id: 'provider-1' })) }
  return { outbox, repo, mailer, run: () => createNotificationWorker({ outbox, repo, mailer, siteUrl: 'https://lamvi.test', now: () => date })() }
}
describe('durable notification worker', () => {
  it('awaits acceptance and settles with lease fencing and stable provider key', async () => {
    const f = fixture(); expect(await f.run()).toMatchObject({ sent: 1 })
    expect(f.mailer.send.mock.calls[0][0].idempotencyKey).toBe('LAMVI-order-job-1')
    expect(f.outbox.settle).toHaveBeenCalledWith(expect.objectContaining({ lease_token: 'lease-1' }), expect.objectContaining({ status: 'sent', provider_message_id: 'provider-1' }))
  })
  it('ack loss leaves durable retry, redacts error and preserves idempotency', async () => {
    const f = fixture(); f.mailer.send.mockRejectedValue(new Error('secret-token'))
    await f.run(); await f.run()
    expect(f.outbox.settle.mock.calls.find(([,v]) => v.status)[1]).toMatchObject({ status: 'pending', last_error: 'DELIVERY_UNCERTAIN', next_attempt_at: '2026-10-07T10:00:30.000Z' })
    expect(JSON.stringify(f.outbox.settle.mock.calls)).not.toContain('secret-token')
    expect(f.mailer.send.mock.calls.map(([m]) => m.idempotencyKey)).toEqual(['LAMVI-order-job-1', 'LAMVI-order-job-1'])
  })
  it('caps attempts and stops on permanent provider errors', async () => {
    const f = fixture({ attempts: 6 }); f.mailer.send.mockRejectedValue(new Error('fail')); await f.run()
    expect(f.outbox.settle.mock.calls.find(([,v]) => v.status)[1].status).toBe('dead')
    const g = fixture(); g.mailer.send.mockRejectedValue(Object.assign(new Error(), { status: 401 })); await g.run()
    expect(g.outbox.settle.mock.calls.find(([,v]) => v.status)[1].last_error).toBe('PROVIDER_REJECTED')
  })
  it('missing configuration does not consume pending jobs', async () => {
    const f = fixture(); await createNotificationWorker({ ...f, mailer: null })()
    expect(f.outbox.claim).not.toHaveBeenCalled()
  })
  it('missing recipient is operator-visible dead job without delivery', async () => {
    const f = fixture(); f.repo.getProfile = async () => null; await f.run()
    expect(f.mailer.send).not.toHaveBeenCalled(); expect(f.outbox.settle.mock.calls.find(([,v]) => v.status)[1].last_error).toBe('RECIPIENT_MISSING')
  })
  it('settle query fences stale workers by status and lease token', async () => {
    const q = { update: vi.fn(), eq: vi.fn(), select: vi.fn(async () => ({ data: [], error: null })) }
    q.update.mockReturnValue(q); q.eq.mockReturnValue(q)
    await createNotificationOutboxRepo({ from: () => q }).settle(job, { status: 'sent' })
    expect(q.eq.mock.calls).toEqual([['id','job-1'],['lease_token','lease-1'],['status','leased']])
  })
  it('Resend receives idempotency header and returns provider acceptance id', async () => {
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'accepted' }) }))
    const mailer = createMailer({ from: 'hello@example.test', resendApiKey: 'key' }, fetch)
    expect(await mailer.send({ to: 'x@example.test', subject: 'x', idempotencyKey: 'stable' })).toEqual({ id: 'accepted' })
    expect(fetch.mock.calls[0][1].headers['Idempotency-Key']).toBe('stable')
  })
})

it('awaits sibling deliveries even if one job cannot persist its failure', async () => {
  let finish
  let settled = false
  const first = { ...job, id: 'one', delivery_payload: { to: 'one@test.invalid' } }
  const second = { ...job, id: 'two', delivery_payload: { to: 'two@test.invalid' } }
  const outbox = { claim: async () => [first, second], settle: async (current) => {
    if (current.id === 'one') throw new Error('database unavailable')
    return [{ id: current.id }]
  } }
  const repo = { getOrderById: async () => ({ userId: 'u', items: [] }), getProfile: async () => ({ email: 'x@test.invalid' }) }
  const mailer = { send: async ({ to }) => {
    if (to.startsWith('one')) throw new Error('timeout')
    await new Promise((resolve) => { finish = resolve })
    return { id: 'accepted' }
  } }
  const run = createNotificationWorker({ outbox, repo, mailer, siteUrl: 'https://lamvi.test' })().then((value) => { settled = true; return value })
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(settled).toBe(false)
  finish()
  expect(await run).toMatchObject({ sent: 1, failed: 1 })
})

it('does not report durable sent state when a reclaimed lease fences completion', async () => {
  const f = fixture({ delivery_payload: { to: 'x@test.invalid', idempotencyKey: 'frozen' } })
  f.outbox.settle.mockResolvedValue([])
  expect(await f.run()).toMatchObject({ sent: 0, failed: 1 })
})

it('missing mailer purges only expired retry payloads without claiming or sending', async () => {
  const f = fixture()
  f.outbox.purgeExpiredPayloads = vi.fn(async () => 4)
  const run = createNotificationWorker({ ...f, mailer: null, now: () => date })
  expect(await run()).toEqual({ claimed: 0, sent: 0, deferred: true, purged: 4 })
  expect(f.outbox.purgeExpiredPayloads).toHaveBeenCalledWith('2026-10-06T11:00:00.000Z')
  expect(f.outbox.claim).not.toHaveBeenCalled(); expect(f.mailer.send).not.toHaveBeenCalled()
})

it('expired-payload maintenance limits selection to100 and rechecks cutoff on update', async () => {
  const cutoff = '2026-10-06T11:00:00.000Z'
  const reads = { select: vi.fn(), not: vi.fn(), lte: vi.fn(), order: vi.fn(), limit: vi.fn(async () => ({ data: [{ id: 'old' }], error: null })) }
  for (const method of ['select', 'not', 'lte', 'order']) reads[method].mockReturnValue(reads)
  const writes = { update: vi.fn(), in: vi.fn(), not: vi.fn(), lte: vi.fn(), select: vi.fn(async () => ({ data: [{ id: 'old' }], error: null })) }
  for (const method of ['update', 'in', 'not', 'lte']) writes[method].mockReturnValue(writes)
  const from = vi.fn().mockReturnValueOnce(reads).mockReturnValueOnce(writes)
  expect(await createNotificationOutboxRepo({ from }).purgeExpiredPayloads(cutoff)).toBe(1)
  expect(reads.limit).toHaveBeenCalledWith(100)
  expect(writes.in).toHaveBeenCalledWith('id', ['old'])
  expect(writes.lte).toHaveBeenCalledWith('delivery_started_at', cutoff)
  expect(writes.update).toHaveBeenCalledWith({ delivery_payload: null })
})
