import { describe, expect, it, vi } from 'vitest'
import { createSupabaseRepo } from './repo.js'

describe('Supabase checkout replay mapping', () => {
  it('passes key/fingerprint to the unchanged atomic RPC and preserves replay metadata', async () => {
    const rpc = vi.fn(async () => ({ data: { id: 'order-1', user_id: 'user-1', code: 'LV-1', checkout_idempotency_key: 'key', checkout_fingerprint: 'fingerprint', checkout_replayed: true, order_items: [] } }))
    const repo = createSupabaseRepo({ rpc })
    const result = await repo.createOrder({ code: 'LV-1', userId: 'user-1', checkoutIdempotencyKey: 'key', checkoutFingerprint: 'fingerprint' }, [])
    expect(rpc.mock.calls[0][0]).toBe('create_checkout_order')
    expect(rpc.mock.calls[0][1].p_order).toMatchObject({ user_id: 'user-1', checkout_idempotency_key: 'key', checkout_fingerprint: 'fingerprint' })
    expect(result).toMatchObject({ checkoutIdempotencyKey: 'key', checkoutFingerprint: 'fingerprint', checkoutReplayed: true })
  })
  it('filters the replay lookup by both user and key', async () => {
    const eq = vi.fn()
    const chain = { select: () => chain, eq: (...args) => { eq(...args); return chain }, maybeSingle: async () => ({ data: null }) }
    const repo = createSupabaseRepo({ from: () => chain })
    expect(await repo.getOrderByCheckoutKey('user-1', 'key')).toBeNull()
    expect(eq.mock.calls).toEqual([['user_id', 'user-1'], ['checkout_idempotency_key', 'key']])
  })
  it('maps database fingerprint conflicts to a business error', async () => {
    const repo = createSupabaseRepo({ rpc: async () => ({ error: { code: 'P0001', message: 'CHECKOUT_KEY_CONFLICT' } }) })
    await expect(repo.createOrder({}, [])).rejects.toMatchObject({ code: 'CHECKOUT_KEY_CONFLICT' })
  })
})
