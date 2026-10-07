// T-11: independent lifecycle and lease-loss regressions; no network calls.
import { describe, expect, it, vi } from 'vitest'
import { createNotificationOutboxRepo } from './outboxRepo.js'
import { createNotificationWorker } from './outbox.js'
const date = new Date('2026-10-07T10:00:00Z')
const job = (id, over = {}) => ({ id, order_id: id, event: 'confirmed', snapshot: { code: id, total: 1000 }, attempts: 1, lease_token: `lease-${id}`, ...over })
const repo = { getOrderById: async () => ({ userId: 'u', items: [] }), getProfile: async () => ({ email: 'new@example.test', preferredLocale: 'vi', fullName: 'Changed profile' }) }
const worker = (outbox, mailer, source = repo) => createNotificationWorker({ outbox, mailer, repo: source, siteUrl: 'https://lamvi.test', now: () => date })
describe('independent notification lease lifecycle', () => {
  it('losing lease before first provider call prevents any delivery', async () => {
    const outbox = { claim: async () => [job('one')], settle: vi.fn(async () => []) }
    const mailer = { send: vi.fn() }
    expect(await worker(outbox, mailer)()).toMatchObject({ claimed: 1, sent: 0, failed: 1 })
    expect(mailer.send).not.toHaveBeenCalled()
    expect(outbox.settle.mock.calls[0][1]).toHaveProperty('delivery_payload.idempotencyKey', 'LAMVI-order-one')
  })
  it('DB failure after provider acceptance still awaits remaining sibling acknowledgement', async () => {
    let release, resolved = false
    const jobs = ['one', 'two'].map((id) => job(id, { delivery_payload: { to: `${id}@example.test`, idempotencyKey: id } }))
    const outbox = { claim: async () => jobs, settle: async (j) => { if (j.id === 'one') throw new Error('DB secret'); return [{ id: j.id }] } }
    const mailer = { send: async ({ to }) => { if (to.startsWith('two')) await new Promise((r) => { release = r }); return { id: 'accepted' } } }
    const result = worker(outbox, mailer)().then((value) => { resolved = true; return value })
    await vi.waitFor(() => expect(release).toBeTypeOf('function'))
    expect(resolved).toBe(false)
    release()
    expect(await result).toMatchObject({ claimed: 2, sent: 1, failed: 1 })
  })
  it('uses byte-for-byte frozen payload on retry despite recipient/profile changes', async () => {
    const payload = { to: 'original@example.test', subject: 'Original', text: 'Original text', html: '<p>Original</p>', idempotencyKey: 'stable-original' }
    const outbox = { claim: async () => [job('one', { delivery_payload: payload, delivery_started_at: date.toISOString(), attempts: 2 })], settle: async () => [{ id: 'one' }] }
    const mailer = { send: vi.fn(async () => ({ id: 'accepted' })) }
    expect(await worker(outbox, mailer)()).toMatchObject({ sent: 1 })
    expect(mailer.send).toHaveBeenCalledExactlyOnceWith(payload)
  })
  it('dead-letters expired idempotency window without provider call and erases persisted payload', async () => {
    const outbox = { claim: async () => [job('one', { delivery_payload: { to: 'old@example.test' }, delivery_started_at: '2026-10-06T11:00:00Z' })], settle: vi.fn(async () => [{ id: 'one' }]) }
    const mailer = { send: vi.fn() }
    expect(await worker(outbox, mailer)()).toMatchObject({ sent: 0, failed: 1 })
    expect(mailer.send).not.toHaveBeenCalled()
    expect(outbox.settle).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ status: 'dead', last_error: 'RETRY_EXHAUSTED', delivery_payload: null }))
  })
  it('each claimed job is counted exactly once across sent, fenced, and DB-error outcomes', async () => {
    const outbox = { claim: async () => ['good', 'fenced', 'db'].map((id) => job(id, { delivery_payload: { to: `${id}@example.test` } })), settle: async (j) => { if (j.id === 'db') throw new Error('down'); return j.id === 'fenced' ? [] : [{ id: j.id }] } }
    const result = await worker(outbox, { send: async () => ({ id: 'accepted' }) })()
    expect(result).toMatchObject({ claimed: 3, sent: 1, failed: 2 })
    expect(result.sent + result.failed).toBe(result.claimed)
  })
})

it('purge DB failure without mailer rejects observably and never claims jobs', async () => {
  const outbox = { claim: vi.fn(), purgeExpiredPayloads: vi.fn(async () => { throw new Error('synthetic DB outage') }) }
  await expect(worker(outbox, null)()).rejects.toThrow('synthetic DB outage')
  expect(outbox.claim).not.toHaveBeenCalled()
})

it('expiry maintenance skips unattempted/recent payloads and rechecks a changed timestamp after read', async () => {
  const cutoff = '2026-10-06T11:00:00.000Z'
  const old = '2026-10-05T11:00:00.000Z', recent = date.toISOString()
  const rows = Array.from({ length: 101 }, (_, n) => ({ id: `old-${n}`, delivery_started_at: old, delivery_payload: { synthetic: true }, status: 'dead', attempts: 3 }))
  rows.push({ id: 'fresh', delivery_started_at: recent, delivery_payload: { synthetic: true } }, { id: 'unattempted', delivery_started_at: null, delivery_payload: { synthetic: true } })
  let queries = 0, selected = 0
  const client = { from: () => {
    if (++queries === 2) rows[0].delivery_started_at = recent // race: payload refreshed after read
    let chosen = [...rows], patch
    const b = {
      not: (key, _op, value) => { chosen = chosen.filter((r) => r[key] !== value); return b },
      lte: (key, value) => { chosen = chosen.filter((r) => r[key] != null && r[key] <= value); return b },
      order: () => b,
      limit: async (n) => { chosen = chosen.slice(0, n); selected = chosen.length; return { data: chosen.map(({ id }) => ({ id })), error: null } },
      in: (key, ids) => { chosen = chosen.filter((r) => ids.includes(r[key])); return b },
      update: (v) => { patch = v; return b },
      select: () => { if (!patch) return b; for (const row of chosen) Object.assign(row, patch); return Promise.resolve({ data: chosen.map(({ id }) => ({ id })), error: null }) },
    }
    return b
  } }
  expect(await createNotificationOutboxRepo(client).purgeExpiredPayloads(cutoff)).toBe(99)
  expect(selected).toBe(100)
  for (const id of ['old-0', 'old-100', 'fresh', 'unattempted']) expect(rows.find((r) => r.id === id).delivery_payload).not.toBeNull()
  expect(rows[1]).toMatchObject({ delivery_payload: null, status: 'dead', attempts: 3 })
})
