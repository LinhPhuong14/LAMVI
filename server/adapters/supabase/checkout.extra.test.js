import { describe, expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import request from 'supertest'
import { createSupabaseRepo } from './repo.js'
import { createMemoryRepo } from '../memory/repo.js'
import { createApp } from '../../app.js'
import { RepoError } from '../repoErrors.js'

const order = { code: 'LV-ATOMIC', userId: 'u1', status: 'confirmed', orderKind: 'self',
  hasMessage: false, qrLang: null, recipientIsSelf: true, recipientName: 'Test', recipientPhone: '0912345678',
  addressLine: 'Test', province: 'Test', paymentMethod: 'cod', paymentStatus: 'pending',
  subtotal: 1000, discount: 100, shippingFee: 0, total: 900, vatAmount: 82, vatRate: 0.1,
  couponId: 'c1', couponCode: 'TEST', qrToken: 'a'.repeat(64) }
const items = [{ productId: 'p1', slug: 'test', name: { vi: 'Test' }, quantity: 1, unitPrice: 1000, lineTotal: 1000 }]

describe('Supabase atomic checkout RPC contract', () => {
  it('uses one RPC, sends trusted snapshots and maps the committed item ledger', async () => {
    const calls = []
    const client = createClient('https://supabase.test', 'test-service-key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(init.body) })
        return new Response(JSON.stringify({ id: 'o1', code: order.code, user_id: 'u1', vat_rate: 0.1,
          order_items: [{ id: 'i1', product_id: 'p1', quantity: 1, stock_reserved: 1 }] }), {
          status: 200, headers: { 'content-type': 'application/json' },
        })
      } },
    })
    const result = await createSupabaseRepo(client).createOrder(order, items, {
      couponId: 'c1', coupon: { id: 'c1', code: 'TEST', type: 'amount', value: 100, perUserLimit: 1 },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0].url).toContain('/rest/v1/rpc/create_checkout_order')
    expect(calls[0].body.p_coupon).toEqual({ id: 'c1', code: 'TEST', type: 'amount', value: 100, per_user_limit: 1 })
    expect(calls[0].body.p_order).toMatchObject({ user_id: 'u1', coupon_id: 'c1', qr_token: order.qrToken })
    expect(calls[0].body.p_items[0]).toMatchObject({ product_id: 'p1', quantity: 1, unit_price: 1000 })
    expect(result.items[0]).toMatchObject({ productId: 'p1', stockReserved: 1 })
  })

  it('maps stock contention to a business error including the affected slug', async () => {
    const repo = createSupabaseRepo({ rpc: vi.fn(async () => ({ data: null,
      error: { code: 'P0001', message: 'OUT_OF_STOCK', details: 'test-lamp' } })) })
    await expect(repo.createOrder(order, items, null)).rejects.toMatchObject({ code: 'OUT_OF_STOCK', field: 'test-lamp' })
  })

  it('does not compensate a timeout/transport failure or make extra writes', async () => {
    const error = { code: 'NETWORK', message: 'response lost after commit' }
    const client = { rpc: vi.fn(async () => ({ data: null, error })) }
    await expect(createSupabaseRepo(client).createOrder(order, items, null)).rejects.toBe(error)
    expect(client.rpc).toHaveBeenCalledTimes(1)
  })

  it.each(['cancelled', 'confirmed'])('conditional %s update opts into atomic release only for cancellation', async (status) => {
    const fetch = vi.fn(async () => new Response(JSON.stringify([{ id: 'o1', status, vat_rate: 0.1 }]), {
      status: 200, headers: { 'content-type': 'application/json' },
    }))
    const client = createClient('https://supabase.test', 'test-service-key', {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch },
    })
    await createSupabaseRepo(client).updateOrderIfStatus('o1', 'pending_payment', { status })
    const [url, init] = fetch.mock.calls[0]
    expect(String(url)).toContain('status=eq.pending_payment')
    expect(JSON.parse(init.body)).toEqual(status === 'cancelled' ? { status, atomic_cancellation: true } : { status })
  })
})

describe('Collections deployment errors', () => {
  const schemaClient = (error) => ({ from: () => {
    const query = { select: () => query, order: () => query, in: () => query,
      then: (resolve) => Promise.resolve({ data: null, error }).then(resolve) }
    return query
  } })
  it.each(['PGRST205', '42P01', 'PGRST204', '42703'])('recognizes missing schema (%s)', async (code) => {
    await expect(createSupabaseRepo(schemaClient({ code })).listCollections()).rejects.toMatchObject({ code: 'CATALOG_NOT_READY' })
  })
  it('preserves permission/connectivity failures instead of pretending the catalog is empty', async () => {
    const error = { code: '42501', message: 'permission denied' }
    await expect(createSupabaseRepo(schemaClient(error)).listCollections()).rejects.toBe(error)
  })
  it('returns 503 for schema readiness while product browsing remains available', async () => {
    const repo = createMemoryRepo()
    vi.spyOn(repo, 'listCollections').mockRejectedValue(new RepoError('CATALOG_NOT_READY'))
    const app = createApp({ repo })
    const result = await request(app).get('/api/collections')
    expect(result.status).toBe(503)
    expect(result.body.error.code).toBe('CATALOG_NOT_READY')
    expect(JSON.stringify(result.body)).not.toMatch(/migration|PGRST|Supabase|011/)
    const products = await request(app).get('/api/products')
    expect(products.status).toBe(200)
    expect(products.body.items.length).toBeGreaterThan(0)
  })
})
