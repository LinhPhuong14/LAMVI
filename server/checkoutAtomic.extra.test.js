// T-11: independent regressions for D-100; release only inventory actually reserved.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'

let repo, auth, app, orders, customer, admin, clock
const body = { orderKind: 'self', recipientIsSelf: true, recipientName: 'Khách', recipientPhone: '0912345678', addressLine: '12 Hàng Bông', provinceCode: '1', wardCode: '4', paymentMethod: 'cod' }
const product = (slug) => repo.getProductBySlug(slug)
const stock = async (slug, value) => repo.updateProduct((await product(slug)).id, { stock: value })
const add = (slug, quantity) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', customer).send({ quantity })
const cancel = (code) => request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
const place = async (over = {}) => {
  const response = await request(app).post('/api/orders').set('Authorization', customer).send({ ...body, ...over })
  expect(response.status).toBe(201)
  return response.body.order
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  clock = new Date('2026-10-06T00:00:00Z')
  const payos = { createPaymentLink: vi.fn(async () => ({ checkoutUrl: 'https://pay.test/link', paymentLinkId: 'pl', qrCode: 'qr' })), cancelPaymentLink: vi.fn(async () => {}) }
  orders = createOrderService({ repo, payos, now: () => clock })
  app = createApp({ repo, auth, orders, payos, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } } })
  const login = async (email, role) => {
    const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: email, role })
    return `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
  }
  customer = await login('customer@lamvi.test', 'customer')
  admin = await login('admin@lamvi.test', 'admin')
})

describe('D-100 — cancellation uses reservation history, not current tracking mode', () => {
  it.each(['customer', 'admin', 'expiry'])('NULL stock at checkout, switched to 5: %s cancellation must keep 5', async (kind) => {
    await stock('den-nguyet', null)
    await add('den-nguyet', 2)
    const order = await place({ paymentMethod: kind === 'expiry' ? 'payos' : 'cod' })
    await stock('den-nguyet', 5)
    if (kind === 'customer') expect((await cancel(order.code)).status).toBe(200)
    if (kind === 'admin') {
      const result = await request(app).post(`/api/admin/orders/${order.code}/status`).set('Authorization', admin).send({ status: 'cancelled' })
      expect(result.status).toBe(200)
    }
    if (kind === 'expiry') {
      clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1)
      await orders.expirePendingOrders()
      await orders.expirePendingOrders()
    }
    expect((await product('den-nguyet')).stock).toBe(5)
    expect((await repo.getOrderByCode(order.code)).status).toBe('cancelled')
  })

  it('mixed cart restores tracked line while leaving newly tracked line unchanged', async () => {
    await stock('den-nguyet', 5)
    await stock('den-vong', null)
    await add('den-nguyet', 2)
    await add('den-vong', 3)
    const order = await place()
    expect((await product('den-nguyet')).stock).toBe(3)
    await stock('den-vong', 7)
    await cancel(order.code)
    await cancel(order.code)
    expect((await product('den-nguyet')).stock).toBe(5)
    expect((await product('den-vong')).stock).toBe(7)
  })

  it('tracked reservation restores exactly once even when current stock is zero', async () => {
    await stock('den-nguyet', 2)
    await add('den-nguyet', 2)
    const order = await place()
    expect((await product('den-nguyet')).stock).toBe(0)
    await Promise.all([cancel(order.code), cancel(order.code)])
    expect((await product('den-nguyet')).stock).toBe(2)
  })
})

describe('Checkout failure and concurrent coupon use', () => {
  it('failed cancellation write keeps reservation and coupon attached to the active order', async () => {
    await stock('den-nguyet', 5)
    const coupon = await repo.createCoupon({ code: 'ATOMIC', type: 'percent', value: 10, status: 'active', usageLimit: 5, perUserLimit: 1 })
    await add('den-nguyet', 2)
    const order = await place({ couponCode: coupon.code })
    const original = repo.updateOrderIfStatus.bind(repo)
    vi.spyOn(repo, 'updateOrderIfStatus').mockImplementationOnce(async () => { throw new Error('database write failed') })
    expect((await cancel(order.code)).status).toBe(500)
    expect((await repo.getOrderByCode(order.code)).status).toBe('confirmed')
    expect((await product('den-nguyet')).stock).toBe(3)
    expect((await repo.getCouponById(coupon.id)).usedCount).toBe(1)
    repo.updateOrderIfStatus.mockImplementation(original)
    expect((await cancel(order.code)).status).toBe(200)
    expect((await product('den-nguyet')).stock).toBe(5)
    expect((await repo.getCouponById(coupon.id)).usedCount).toBe(0)
  })

  it('two simultaneous checkouts cannot bypass one-use-per-customer coupon', async () => {
    await stock('den-nguyet', 5)
    const coupon = await repo.createCoupon({ code: 'ONCE', type: 'percent', value: 10, status: 'active', usageLimit: 10, perUserLimit: 1 })
    await add('den-nguyet', 1)
    const checkout = () => request(app).post('/api/orders').set('Authorization', customer).send({ ...body, couponCode: coupon.code })
    const results = await Promise.all([checkout(), checkout()])
    expect(results.filter((result) => result.status === 201)).toHaveLength(1)
    expect(results.filter((result) => result.status === 409)).toHaveLength(1)
    expect((await repo.getCouponById(coupon.id)).usedCount).toBe(1)
    expect((await product('den-nguyet')).stock).toBe(4)
  })

  it('product hidden between quote and commit cannot become a new order', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const original = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
      await repo.updateProduct((await product('den-nguyet')).id, { status: 'hidden' })
      return original(...args)
    })
    const result = await request(app).post('/api/orders').set('Authorization', customer).send(body)
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('CART_HAS_UNAVAILABLE')
    expect((await product('den-nguyet')).stock).toBe(5)
  })

  it('price changed between quote and commit requires customer confirmation again', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const original = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
      await repo.updateProduct((await product('den-nguyet')).id, { price: 990_000 })
      return original(...args)
    })
    const result = await request(app).post('/api/orders').set('Authorization', customer).send(body)
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('PRICE_CHANGED')
    expect((await product('den-nguyet')).stock).toBe(5)
  })
})

describe('Reservation provenance and consumed cart', () => {
  it('tracking enabled after quote reserves real stock and restores it on cancellation', async () => {
    await stock('den-nguyet', null)
    await add('den-nguyet', 2)
    const original = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
      await stock('den-nguyet', 5)
      return original(...args)
    })
    const order = await place()
    expect((await product('den-nguyet')).stock).toBe(3)
    await cancel(order.code)
    expect((await product('den-nguyet')).stock).toBe(5)
  })

  it('quantity changed after quote rejects checkout without consuming the new cart', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const original = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
      await add('den-nguyet', 3)
      return original(...args)
    })
    const result = await request(app).post('/api/orders').set('Authorization', customer).send(body)
    expect(result.status).toBe(409)
    expect((await product('den-nguyet')).stock).toBe(5)
    const cart = await request(app).get('/api/cart').set('Authorization', customer)
    expect(cart.body.items[0].quantity).toBe(3)
  })
})

it('stock shortage arising after quote identifies the product requiring correction', async () => {
  await stock('den-nguyet', 5)
  await add('den-nguyet', 2)
  const original = repo.createOrder.bind(repo)
  vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
    await stock('den-nguyet', 1)
    return original(...args)
  })
  const result = await request(app).post('/api/orders').set('Authorization', customer).send(body)
  expect(result.status).toBe(409)
  expect(result.body.error.code).toBe('OUT_OF_STOCK')
  expect(result.body.error.details?.slug).toBe('den-nguyet')
  expect((await product('den-nguyet')).stock).toBe(1)
})

describe('Independent checkout key replay', () => {
  const key = 'd215a9bb-44ca-4b16-bdaa-836a8923beaf'
  it('lost commit response replays existing order without releasing its inventory', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const original = repo.createOrder.bind(repo)
    vi.spyOn(repo, 'createOrder').mockImplementationOnce(async (...args) => {
      await original(...args)
      throw new Error('commit response lost')
    })
    const first = await place({ idempotencyKey: key })
    const retry = await place({ idempotencyKey: key })
    expect(retry.code).toBe(first.code)
    expect((await product('den-nguyet')).stock).toBe(3)
  })
  it('same key cannot silently reuse order with different checkout details', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 1)
    await place({ idempotencyKey: key })
    const result = await request(app).post('/api/orders').set('Authorization', customer).send({ ...body, idempotencyKey: key, recipientName: 'Changed recipient' })
    expect(result.status).toBe(409)
    expect(result.body.error.code).toBe('CHECKOUT_KEY_CONFLICT')
    expect((await product('den-nguyet')).stock).toBe(4)
  })
})

describe('Paid webhook racing cancellation and manual refunds', () => {
  const paid = async (order) => {
    const stored = await repo.getOrderByCode(order.code)
    return orders.applyPayosWebhook({ orderCode: stored.payosOrderCode, amount: stored.total, paid: true, reference: 'same-transaction' })
  }
  it('records the paid-after-cancel flag when cancellation wins the confirmation CAS', async () => {
    await stock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const order = await place({ paymentMethod: 'payos' })
    const original = repo.updateOrderIfStatus.bind(repo)
    vi.spyOn(repo, 'updateOrderIfStatus').mockImplementationOnce(async (id, expected, values, ...rest) => {
      await original(id, 'pending_payment', { status: 'cancelled', paymentStatus: 'cancelled', cancelReason: 'CUSTOMER' })
      return original(id, expected, values, ...rest)
    })
    const result = await paid(order)
    expect(result.handled).toBe(true)
    expect(await repo.getOrderByCode(order.code)).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
    expect((await product('den-nguyet')).stock).toBe(5)
  })
  it('webhook replay preserves refund_pending and refunded financial states', async () => {
    await add('den-nguyet', 1)
    const order = await place({ paymentMethod: 'payos' })
    await paid(order)
    await cancel(order.code)
    await paid(order)
    const pending = await repo.getOrderByCode(order.code)
    expect(pending.paymentStatus).toBe('refund_pending')
    await orders.markRefunded(pending, 'admin', 'Bank transfer complete')
    await paid(order)
    expect((await repo.getOrderByCode(order.code)).paymentStatus).toBe('refunded')
  })
  it('concurrent refund confirmations cannot both report a newly recorded refund', async () => {
    await add('den-nguyet', 1)
    const order = await place({ paymentMethod: 'payos' })
    await paid(order)
    await cancel(order.code)
    const pending = await repo.getOrderByCode(order.code)
    const results = await Promise.allSettled([orders.markRefunded(pending, 'admin', 'Transfer A'), orders.markRefunded(pending, 'admin', 'Transfer B')])
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
    expect(results.find((r) => r.status === 'rejected').reason.code).toBe('REFUND_NOT_PENDING')
  })
})

it('records manual refund of a verified late payment after cancellation without changing order or stock', async () => {
  await stock('den-nguyet', 5)
  await add('den-nguyet', 2)
  const placed = await place({ paymentMethod: 'payos' })
  await cancel(placed.code)
  const cancelled = await repo.getOrderByCode(placed.code)
  const event = { orderCode: cancelled.payosOrderCode, amount: cancelled.total, paid: true, reference: 'late-paid-transaction' }
  await orders.applyPayosWebhook(event)
  const latePaid = await repo.getOrderByCode(placed.code)
  expect(latePaid).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
  expect(await orders.markRefunded(latePaid, 'admin', 'Manual bank transfer completed')).toMatchObject({ status: 'cancelled', paymentStatus: 'refunded' })
  await orders.applyPayosWebhook(event)
  expect((await repo.getOrderByCode(placed.code)).paymentStatus).toBe('refunded')
  expect((await product('den-nguyet')).stock).toBe(5)
})

it('checkout recovery remains owner-only and omits internal key and fingerprint', async () => {
  const key = 'fbb5e716-8f7b-42bf-a3c0-30e5047759a2'
  await add('den-nguyet', 1)
  const placed = await place({ idempotencyKey: key })
  const owner = await request(app).get(`/api/checkout/requests/${key}`).set('Authorization', customer)
  expect(owner.status).toBe(200)
  expect(owner.body.order.code).toBe(placed.code)
  expect(owner.body.order).not.toHaveProperty('checkoutFingerprint')
  expect(owner.body.order).not.toHaveProperty('checkoutIdempotencyKey')
  expect((await request(app).get(`/api/checkout/requests/${key}`).set('Authorization', admin)).status).toBe(404)
  expect((await request(app).get(`/api/checkout/requests/${key}`)).status).toBe(401)
})
