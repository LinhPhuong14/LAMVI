import { randomUUID } from 'node:crypto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createOrderService } from './orders/service.js'
import { validateCheckout } from './domain/order.js'

const checkout = validateCheckout({ orderKind: 'self', recipientIsSelf: true, recipientName: 'Test', recipientPhone: '0912345678', addressLine: 'Test', provinceCode: '1', wardCode: '4', paymentMethod: 'cod' }).values
let repo, service, notify, payos, product
beforeEach(async () => {
  repo = createMemoryRepo()
  product = (await repo.listProducts())[0]
  await repo.updateProduct(product.id, { stock: 10 })
  notify = vi.fn()
  payos = { createPaymentLink: vi.fn(async () => ({ checkoutUrl: 'https://payment.example.test' })) }
  service = createOrderService({ repo, payos, notify })
  await repo.setCartItem('user-1', product.id, 1)
})
const submit = (over = {}) => service.createOrder({ userId: 'user-1', checkout, siteUrl: 'https://lamvi.test', ...over })
describe('Durable checkout retry key', () => {
  it('replays after the cart has been consumed, without deducting stock or sending a second email', async () => {
    const idempotencyKey = randomUUID()
    const first = await submit({ idempotencyKey })
    const again = await submit({ idempotencyKey })
    expect(again.order.id).toBe(first.order.id)
    expect(again.replayed).toBe(true)
    expect(await repo.getCart('user-1')).toEqual([])
    expect((await repo.getProductById(product.id)).stock).toBe(9)
    expect(notify).toHaveBeenCalledOnce()
  })
  it('recovers a committed RPC whose response was lost without compensation', async () => {
    const commit = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementation(async (...args) => { await commit(...args); throw new Error('lost response') })
    const result = await submit({ idempotencyKey: randomUUID() })
    expect(result.replayed).toBe(true)
    expect((await repo.listOrdersByUser('user-1'))).toHaveLength(1)
    expect((await repo.getProductById(product.id)).stock).toBe(9)
    expect(notify).not.toHaveBeenCalled()
  })
  it('concurrent same-key requests return one order with exactly one side-effect chain', async () => {
    const idempotencyKey = randomUUID()
    const results = await Promise.all([submit({ idempotencyKey }), submit({ idempotencyKey })])
    expect(results[0].order.id).toBe(results[1].order.id)
    expect(await repo.listOrdersByUser('user-1')).toHaveLength(1)
    expect(notify).toHaveBeenCalledOnce()
  })
  it('rejects changed business payload or expected total for a used key even with an empty cart', async () => {
    const idempotencyKey = randomUUID()
    await submit({ idempotencyKey })
    await expect(submit({ idempotencyKey, checkout: { ...checkout, recipientName: 'Different' } })).rejects.toMatchObject({ status: 409, code: 'CHECKOUT_KEY_CONFLICT' })
    await expect(submit({ idempotencyKey, expectedTotal: 1 })).rejects.toMatchObject({ status: 409, code: 'CHECKOUT_KEY_CONFLICT' })
  })
  it('scopes the same key to different users and validates key type', async () => {
    const idempotencyKey = randomUUID()
    const first = await submit({ idempotencyKey })
    await repo.setCartItem('user-2', product.id, 1)
    const second = await submit({ userId: 'user-2', idempotencyKey })
    expect(second.order.id).not.toBe(first.order.id)
    await expect(submit({ idempotencyKey: 'bad' })).rejects.toMatchObject({ status: 400, fields: { idempotencyKey: 'INVALID' } })
  })
  it('does not call payOS again when replaying a pending order', async () => {
    const idempotencyKey = randomUUID()
    const args = { idempotencyKey, checkout: { ...checkout, paymentMethod: 'payos' } }
    const first = await submit(args)
    const again = await submit(args)
    expect(first.payment.checkoutUrl).toBeTruthy()
    expect(again.payment).toBeNull()
    expect(again.order.status).toBe('pending_payment')
    expect(payos.createPaymentLink).toHaveBeenCalledOnce()
  })
  it('replays a pending order while the gateway is unavailable instead of attempting a new payment', async () => {
    const idempotencyKey = randomUUID()
    const args = { idempotencyKey, checkout: { ...checkout, paymentMethod: 'payos' } }
    const first = await submit(args)
    const offline = createOrderService({ repo, payos: null })
    const replay = await offline.createOrder({ userId: 'user-1', ...args })
    expect(replay.order.id).toBe(first.order.id)
    expect(replay.payment).toBeNull()
  })

})
