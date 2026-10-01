import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createFakePayos } from './payments/fakePayos.js'
import { createOrderService } from './orders/service.js'
import { priceOrder, DEFAULT_SHOP } from './orders/pricing.js'

let app, repo, auth, payments, orders, clock, buyer, admin

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  return `Bearer ${(await auth.signIn({ email, password: 'matkhau123' })).accessToken}`
}

beforeEach(async () => {
  clock = Date.parse('2026-10-01T03:00:00Z')
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  payments = createFakePayos({ publicSiteUrl: 'https://moc.test', now: () => clock })
  orders = createOrderService({ repo, payments, publicSiteUrl: 'https://moc.test', now: () => clock })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' }, payments, orders })
  buyer = await login('an@moc.test')
  admin = await login('admin@moc.test', 'admin')
})

const addToCart = (slug, quantity, t = buyer) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', t).send({ quantity }).expect(200)
const quote = (body = {}, t = buyer) => request(app).post('/api/checkout/quote').set('Authorization', t).send(body)
const recipient = { name: 'Nguyễn An', phone: '0912 345 678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' }
let keyN = 0
const checkout = (over = {}, t = buyer) =>
  request(app)
    .post('/api/orders')
    .set('Authorization', t)
    .send({ orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'cod', clientKey: `key-${Date.now()}-${keyN++}`, ...over })
async function placeOrder(over = {}, t = buyer) {
  const q = await quote({ couponCode: over.couponCode, recipientType: over.recipientType ?? 'self' }, t)
  return checkout({ expectedTotal: q.body.pricing.total, ...over }, t)
}
const adminAct = (id, action, body = {}) => request(app).post(`/api/admin/orders/${id}/actions/${action}`).set('Authorization', admin).send(body)
const coupon = (body) => request(app).post('/api/admin/coupons').set('Authorization', admin).send(body)

describe('Tính giá (§13, D-62, D-63, D-65…D-67)', () => {
  const lines = [
    { productId: 'a', unitPrice: 890000, quantity: 1 },
    { productId: 'b', unitPrice: 1050000, quantity: 1 },
  ]
  it('VAT 10% trên (tạm tính − giảm giá), không tính trên ship; ship đồng giá dưới mức miễn phí', () => {
    const p = priceOrder({ lines: [lines[0]], shop: DEFAULT_SHOP })
    expect(p).toMatchObject({ subtotal: 890000, discount: 0, shippingFee: 30000, vat: 89000, total: 890000 + 30000 + 89000 })
  })
  it('tạm tính ≥ 1.500.000 → miễn phí ship', () => {
    expect(priceOrder({ lines, shop: DEFAULT_SHOP }).shippingFee).toBe(0)
  })
  it('coupon %: có trần; chỉ trên dòng thuộc phạm vi; VAT tính sau giảm', () => {
    const c = { type: 'percent', value: 50, maxDiscount: 300000, productIds: ['a'] }
    const p = priceOrder({ lines, coupon: c, shop: DEFAULT_SHOP })
    expect(p.discount).toBe(300000)
    expect(p.vat).toBe(Math.round((1940000 - 300000) * 0.1))
    expect(p.total).toBe(1940000 - 300000 + 0 + p.vat)
  })
  it('coupon số tiền không vượt tiền hàng áp dụng; coupon miễn ship đưa ship về 0', () => {
    expect(priceOrder({ lines: [lines[0]], coupon: { type: 'amount', value: 5_000_000, productIds: null }, shop: DEFAULT_SHOP }).discount).toBe(890000)
    const fs = priceOrder({ lines: [lines[0]], coupon: { type: 'free_shipping', value: 0, productIds: null }, shop: DEFAULT_SHOP })
    expect(fs).toMatchObject({ discount: 0, shippingFeeBeforeDiscount: 30000, shippingFee: 0, vat: 89000 })
  })
})

describe('Bảng giá checkout (FR-CHK-008)', () => {
  it('cần đăng nhập (BR-ACC-001)', async () => {
    expect((await request(app).post('/api/checkout/quote').send({})).status).toBe(401)
    expect((await request(app).post('/api/orders').send({})).status).toBe(401)
  })
  it('tính từ giỏ trên server; COD bị chặn khi người nhận là người khác (BR-PAY-004) hoặc vượt mức (D-71)', async () => {
    await addToCart('den-nguyet', 2)
    const res = await quote({ recipientType: 'self' })
    expect(res.body.pricing).toMatchObject({ subtotal: 1780000, shippingFee: 0, vat: 178000, total: 1958000 })
    expect(res.body.cod).toEqual({ allowed: true, reason: null })
    expect((await quote({ recipientType: 'other' })).body.cod).toEqual({ allowed: false, reason: 'COD_RECIPIENT_OTHER' })
    await request(app).put('/api/admin/shop').set('Authorization', admin).send({ shippingFee: 25000, freeShippingFrom: null, codMaxTotal: 1_000_000 }).expect(200)
    const q2 = await quote({ recipientType: 'self' })
    expect(q2.body.pricing.shippingFee).toBe(25000)
    expect(q2.body.cod.reason).toBe('COD_OVER_LIMIT')
  })
  it('coupon sai/hết hạn/chưa đủ mức → báo lý do, giá không giảm', async () => {
    await addToCart('den-nguyet', 1)
    await coupon({ code: 'giam10', type: 'percent', value: 10, minOrder: 1_000_000 }).expect(201)
    await coupon({ code: 'HETHAN', type: 'amount', value: 50000, endsAt: '2026-09-30T00:00:00Z' }).expect(201)
    expect((await quote({ couponCode: 'khongco' })).body.couponError).toEqual({ code: 'COUPON_INVALID' })
    expect((await quote({ couponCode: 'HETHAN' })).body.couponError).toEqual({ code: 'COUPON_EXPIRED' })
    const r = await quote({ couponCode: 'GIAM10' })
    expect(r.body.couponError).toEqual({ code: 'COUPON_MIN_ORDER', minOrder: 1_000_000 })
    expect(r.body.pricing.discount).toBe(0)
    await addToCart('den-nguyet', 2)
    const ok = await quote({ couponCode: ' giam10 ' })
    expect(ok.body.coupon).toMatchObject({ code: 'GIAM10', type: 'percent', value: 10 })
    expect(ok.body.pricing.discount).toBe(178000)
  })
})

describe('Tạo đơn COD (§12, §15.2)', () => {
  it('COD → CONFIRMED ngay, chốt giá, xoá giỏ; gửi lại cùng clientKey không tạo đơn thứ hai', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote()
    const body = { orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'cod', clientKey: 'abc12345-xyz', expectedTotal: q.body.pricing.total }
    const res = await request(app).post('/api/orders?lang=en').set('Authorization', buyer).send(body)
    expect(res.status).toBe(201)
    expect(res.body.checkoutUrl).toBeNull()
    expect(res.body.order).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'COD_PENDING', total: 1009000, hasMessage: false, qrLang: null, canCancel: true })
    expect(res.body.order.recipient.phone).toBe('0912345678')
    expect(res.body.order.items).toEqual([{ slug: 'den-nguyet', name: 'Nguyet Lantern', unitPrice: 890000, quantity: 1, lineTotal: 890000 }])
    expect((await request(app).get('/api/cart').set('Authorization', buyer)).body.items).toEqual([])
    const again = await request(app).post('/api/orders').set('Authorization', buyer).send(body)
    expect(again.body.order.id).toBe(res.body.order.id)
    expect((await request(app).get('/api/orders').set('Authorization', buyer)).body.items).toHaveLength(1)
    // BR-PRC-002: đổi giá sau khi tạo đơn không ảnh hưởng đơn
    const p = await repo.getProductBySlug('den-nguyet')
    await repo.updateProduct(p.id, { priceExclVat: 1 })
    expect((await request(app).get(`/api/orders/${res.body.order.id}`).set('Authorization', buyer)).body.order.total).toBe(1009000)
  })
  it('đơn Tặng luôn có lời chúc và cần ngôn ngữ QR (BR-MSG-002, D-41)', async () => {
    await addToCart('den-nguyet', 1)
    const bad = await placeOrder({ orderType: 'gift', recipientType: 'other', paymentMethod: 'payos' })
    expect(bad.body.error.fields).toEqual({ qrLang: 'REQUIRED' })
    const ok = await placeOrder({ orderType: 'gift', qrLang: 'zh', recipientType: 'other', paymentMethod: 'payos' })
    expect(ok.body.order).toMatchObject({ hasMessage: true, qrLang: 'zh' })
    await addToCart('den-vong', 1)
    const self = await placeOrder({ orderType: 'self', addMessage: true, qrLang: 'en' })
    expect(self.body.order).toMatchObject({ hasMessage: true, qrLang: 'en' })
  })
  it('lỗi: giỏ trống, giá đổi, COD giao người khác, người nhận sai, sản phẩm ẩn', async () => {
    expect((await checkout({ expectedTotal: 0 })).body.error.code).toBe('CART_EMPTY')
    await addToCart('den-nguyet', 1)
    expect((await checkout({ expectedTotal: 1 })).body.error.code).toBe('PRICE_CHANGED')
    const other = await placeOrder({ recipientType: 'other', paymentMethod: 'cod' })
    expect(other.body.error.code).toBe('COD_RECIPIENT_OTHER')
    const v = await placeOrder({ recipient: { ...recipient, phone: '12345', street: '' } })
    expect(v.body.error.fields).toEqual({ 'recipient.phone': 'INVALID_PHONE', 'recipient.street': 'REQUIRED' })
    await addToCart('den-vong', 1)
    const p = await repo.getProductBySlug('den-vong')
    await repo.updateProduct(p.id, { status: 'hidden' })
    expect((await placeOrder()).body.error.code).toBe('CART_HAS_UNAVAILABLE')
  })
})

describe('payOS (§15.1, US-002)', () => {
  async function payosOrder(over = {}) {
    await addToCart('den-nguyet', 1)
    const res = await placeOrder({ paymentMethod: 'payos', ...over })
    expect(res.status).toBe(201)
    return res.body
  }
  const webhook = (body) => request(app).post('/api/payments/payos/webhook').send(body)

  it('tạo link 15 phút; webhook hợp lệ → CONFIRMED đúng một lần (AC-001, AC-003)', async () => {
    const { order, checkoutUrl } = await payosOrder()
    expect(order).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', canPay: true })
    expect(checkoutUrl).toBe(`https://moc.test/api/dev/payos/${order.code}`)
    expect(Date.parse(order.paymentExpiresAt) - clock).toBe(15 * 60 * 1000)
    expect(payments.links.get(order.code).returnUrl).toBe(`https://moc.test/account/orders/${order.id}?payment=return`)
    // AC-002: trước webhook vẫn chờ
    expect((await request(app).get(`/api/orders/${order.id}`).set('Authorization', buyer)).body.order.status).toBe('PENDING_PAYMENT')
    const body = payments.pay(order.code)
    await webhook(body).expect(200)
    const after = (await repo.getOrderById(order.id))
    expect(after).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID', paidAmount: order.total })
    await repo.updateOrder(order.id, { status: 'IN_PRODUCTION' })
    await webhook(body).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('IN_PRODUCTION')
  })
  it('chữ ký sai → 400, không đổi đơn', async () => {
    const { order } = await payosOrder()
    const body = payments.pay(order.code)
    body.data.amount = 1
    expect((await webhook(body)).status).toBe(400)
    expect((await webhook({})).status).toBe(400)
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
  })
  it('số tiền lệch → không xác nhận, huỷ + chờ hoàn tiền + cờ AMOUNT_MISMATCH', async () => {
    const { order } = await payosOrder()
    await webhook(payments.pay(order.code, order.total - 1000)).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['AMOUNT_MISMATCH'] })
  })
  it('quá 15 phút → CANCELLED (EXPIRED); tiền về sau đó → cờ PAID_AFTER_CANCEL (BR-PAY-003, D-41)', async () => {
    const { order } = await payosOrder()
    clock += 15 * 60 * 1000
    expect(await orders.sweepExpired()).toEqual({ checked: 1, cancelled: 1 })
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'EXPIRED', cancelReason: 'payment_expired' })
    expect(payments.links.get(order.code).status).toBe('EXPIRED')
    payments.links.get(order.code).status = 'PENDING'
    await webhook(payments.pay(order.code)).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['PAID_AFTER_CANCEL'] })
  })
  it('webhook chậm: xem đơn khi đã hết hạn nhưng payOS báo đã trả → xác nhận (§15.1)', async () => {
    const { order } = await payosOrder()
    payments.pay(order.code) // webhook bị lạc
    clock += 16 * 60 * 1000
    const res = await request(app).get(`/api/orders/${order.id}`).set('Authorization', buyer)
    expect(res.body.order).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID' })
  })
  it('payOS lỗi khi tạo link → 502, đơn bị huỷ, giỏ còn nguyên', async () => {
    payments.createPaymentLink = async () => {
      throw new Error('down')
    }
    await addToCart('den-nguyet', 1)
    const res = await placeOrder({ paymentMethod: 'payos' })
    expect(res.status).toBe(502)
    expect(res.body.error.code).toBe('PAYMENT_UNAVAILABLE')
    expect((await repo.listOrders())[0]).toMatchObject({ status: 'CANCELLED', cancelReason: 'payment_error' })
    expect((await request(app).get('/api/cart').set('Authorization', buyer)).body.items).toHaveLength(1)
  })
  it('không cấu hình payOS (production) → chỉ COD', async () => {
    const o2 = createOrderService({ repo, payments: null })
    const app2 = createApp({ repo, auth, storage: createMemoryStorage(), payments: null, orders: o2 })
    await addToCart('den-nguyet', 1)
    const q = await request(app2).post('/api/checkout/quote').set('Authorization', buyer).send({})
    expect(q.body.payosAvailable).toBe(false)
    const res = await request(app2).post('/api/orders').set('Authorization', buyer).send({ orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'payos', clientKey: 'nopayos-1', expectedTotal: q.body.pricing.total })
    expect(res.body.error.code).toBe('PAYOS_UNAVAILABLE')
    expect((await request(app2).post('/api/payments/payos/webhook').send({})).status).toBe(404)
  })
})

describe('Coupon: lượt dùng (D-68)', () => {
  it('giới hạn tổng và mỗi người; huỷ đơn trả lượt', async () => {
    await coupon({ code: 'MOT-LUOT', type: 'amount', value: 100000, usageLimit: 1 }).expect(201)
    await addToCart('den-nguyet', 1)
    const first = await placeOrder({ couponCode: 'MOT-LUOT' })
    expect(first.body.order).toMatchObject({ couponCode: 'MOT-LUOT', discount: 100000 })
    const other = await login('binh@moc.test')
    await addToCart('den-nguyet', 1, other)
    expect((await quote({ couponCode: 'MOT-LUOT' }, other)).body.couponError.code).toBe('COUPON_USED_UP')
    await request(app).post(`/api/orders/${first.body.order.id}/cancel`).set('Authorization', buyer).expect(200)
    expect((await quote({ couponCode: 'MOT-LUOT' }, other)).body.couponError).toBeNull()
  })
  it('mỗi người 1 lần; coupon theo sản phẩm không áp được cho giỏ khác', async () => {
    const vong = await repo.getProductBySlug('den-vong')
    await coupon({ code: 'VONG', type: 'percent', value: 10, perUserLimit: 1, productIds: [vong.id] }).expect(201)
    await addToCart('den-nguyet', 1)
    expect((await quote({ couponCode: 'VONG' })).body.couponError.code).toBe('COUPON_NOT_APPLICABLE')
    await addToCart('den-vong', 1)
    const o = await placeOrder({ couponCode: 'VONG' })
    expect(o.body.order.discount).toBe(105000)
    await addToCart('den-vong', 1)
    expect((await quote({ couponCode: 'VONG' })).body.couponError.code).toBe('COUPON_USER_LIMIT')
  })
  it('coupon bị tắt giữa chừng → tạo đơn báo lỗi coupon (BR-CPN-002)', async () => {
    const c = await coupon({ code: 'TAT', type: 'amount', value: 1000 })
    await addToCart('den-nguyet', 1)
    const q = await quote({ couponCode: 'TAT' })
    await request(app).patch(`/api/admin/coupons/${c.body.item.id}`).set('Authorization', admin).send({ status: 'inactive' }).expect(200)
    const res = await checkout({ couponCode: 'TAT', expectedTotal: q.body.pricing.total })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('COUPON_INVALID')
  })
})

describe('Đơn của tôi (FR-ACC-002, BR-ORD-001)', () => {
  it('chỉ xem được đơn của mình; huỷ trước SHIPPED; sau đó không huỷ được', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder()).body
    const other = await login('binh@moc.test')
    expect((await request(app).get(`/api/orders/${order.id}`).set('Authorization', other)).status).toBe(404)
    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', other)).status).toBe(404)
    const list = await request(app).get('/api/orders').set('Authorization', buyer)
    expect(list.body.items[0]).toMatchObject({ code: order.code, status: 'CONFIRMED', itemCount: 1, firstItemName: 'Đèn Nguyệt' })
    await repo.updateOrder(order.id, { status: 'SHIPPED', trackingCode: 'GHN123' })
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', buyer)
    expect(res.body.error.code).toBe('ORDER_NOT_CANCELLABLE')
    expect((await request(app).get(`/api/orders/${order.id}`).set('Authorization', buyer)).body.order.trackingCode).toBe('GHN123')
  })
  it('huỷ đơn payOS đã trả → chờ hoàn tiền (D-70)', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder({ paymentMethod: 'payos' })).body
    await request(app).post('/api/payments/payos/webhook').send(payments.pay(order.code)).expect(200)
    const res = await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', buyer)
    expect(res.body.order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', cancelReason: 'customer' })
  })
})

describe('Admin đơn hàng (FR-ORD-002)', () => {
  async function confirmedOrder() {
    await addToCart('den-nguyet', 1)
    return (await placeOrder()).body.order
  }
  it('khách → 403', async () => {
    expect((await request(app).get('/api/admin/orders').set('Authorization', buyer)).status).toBe(403)
    expect((await request(app).get('/api/admin/coupons').set('Authorization', buyer)).status).toBe(403)
    expect((await request(app).put('/api/admin/shop').set('Authorization', buyer).send({})).status).toBe(403)
  })
  it('vòng đời: sản xuất (công đoạn 1–4) → đóng gói → gửi (cần lô đã xuất bản + vận đơn) → giao; thu COD', async () => {
    const o = await confirmedOrder()
    expect((await adminAct(o.id, 'pack')).body.error.code).toBe('INVALID_TRANSITION')
    expect((await adminAct(o.id, 'start_production')).body.item).toMatchObject({ status: 'IN_PRODUCTION', productionStage: 1 })
    expect((await adminAct(o.id, 'set_stage', { stage: 5 })).status).toBe(400)
    expect((await adminAct(o.id, 'set_stage', { stage: 3 })).body.item.productionStage).toBe(3)
    await adminAct(o.id, 'pack').expect(200)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-123' })).body.error.code).toBe('BATCH_NOT_PUBLISHED')
    const detail = (await request(app).get(`/api/admin/orders/${o.id}`).set('Authorization', admin)).body.item
    const [published, draft] = [...(await repo.listBatches())].sort((a) => (a.status === 'video_published' ? -1 : 1))
    const setBatch = (batchId) => request(app).put(`/api/admin/orders/${o.id}/items/${detail.items[0].id}/batch`).set('Authorization', admin).send({ batchId })
    await setBatch(draft.id).expect(200)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-123' })).body.error.code).toBe('BATCH_NOT_PUBLISHED')
    expect((await setBatch(published.id)).body.item.items[0].batch).toMatchObject({ code: published.code, published: true })
    expect((await adminAct(o.id, 'ship', { trackingCode: '' })).status).toBe(400)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-123' })).body.item).toMatchObject({ status: 'SHIPPED', trackingCode: 'GHN-123' })
    expect((await setBatch(null)).body.error.code).toBe('INVALID_TRANSITION')
    expect((await adminAct(o.id, 'cancel')).body.error.code).toBe('INVALID_TRANSITION')
    await adminAct(o.id, 'deliver').expect(200)
    expect((await adminAct(o.id, 'cod_collected')).body.item).toMatchObject({ paymentStatus: 'COD_COLLECTED' })
    expect((await request(app).delete(`/api/admin/batches/${draft.id}`).set('Authorization', admin)).status).toBe(204)
  })
  it('hoàn tiền thủ công: cần số tiền ≤ đã trả và ghi chú', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder({ paymentMethod: 'payos' })).body
    await request(app).post('/api/payments/payos/webhook').send(payments.pay(order.code)).expect(200)
    await adminAct(order.id, 'cancel').expect(200)
    const list = await request(app).get('/api/admin/orders?flagged=1').set('Authorization', admin)
    expect(list.body.items.map((i) => i.id)).toEqual([order.id])
    expect((await adminAct(order.id, 'refund', { amount: order.total + 1, note: 'x' })).status).toBe(400)
    expect((await adminAct(order.id, 'refund', { amount: order.total })).body.error.fields).toEqual({ note: 'REQUIRED' })
    const ok = await adminAct(order.id, 'refund', { amount: order.total, note: 'CK Vietcombank 01/10' })
    expect(ok.body.item).toMatchObject({ paymentStatus: 'REFUNDED', refundedAmount: order.total })
    expect((await request(app).get(`/api/orders/${order.id}`).set('Authorization', buyer)).body.order.refundedAmount).toBe(order.total)
  })
})

describe('Admin coupon & cấu hình', () => {
  it('kiểm tra dữ liệu; trùng mã → 409; coupon đã dùng không xoá được', async () => {
    expect((await coupon({ code: 'A', type: 'percent', value: 150 })).body.error.fields).toEqual({ value: 'INVALID_PERCENT' })
    expect((await coupon({ code: 'B', type: 'amount', value: 1000, maxDiscount: 5 })).body.error.fields).toEqual({ maxDiscount: 'ONLY_FOR_PERCENT' })
    expect((await coupon({ code: 'c d', type: 'amount', value: 1 })).body.error.fields).toEqual({ code: 'INVALID_COUPON_CODE' })
    expect((await coupon({ code: 'E', type: 'amount', value: 1, startsAt: '2026-10-02', endsAt: '2026-10-01' })).body.error.fields).toEqual({ endsAt: 'BEFORE_START' })
    const ok = await coupon({ code: 'ship0', type: 'free_shipping' })
    expect(ok.body.item).toMatchObject({ code: 'SHIP0', status: 'active', used: 0 })
    expect((await coupon({ code: 'SHIP0', type: 'free_shipping' })).status).toBe(409)
    await addToCart('den-nguyet', 1)
    const o = await placeOrder({ couponCode: 'SHIP0' })
    expect(o.body.order.shippingFee).toBe(0)
    const list = await request(app).get('/api/admin/coupons').set('Authorization', admin)
    expect(list.body.items[0].used).toBe(1)
    expect((await request(app).delete(`/api/admin/coupons/${ok.body.item.id}`).set('Authorization', admin)).body.error.code).toBe('COUPON_IN_USE')
  })
  it('cấu hình phí ship: kiểm tra số', async () => {
    expect((await request(app).put('/api/admin/shop').set('Authorization', admin).send({ shippingFee: -1 })).status).toBe(400)
    const res = await request(app).get('/api/admin/shop').set('Authorization', admin)
    expect(res.body.config).toEqual({ shippingFee: 30000, freeShippingFrom: 1500000, codMaxTotal: 5000000 })
  })
})

describe('Nhật ký thay đổi (NFR-AUD-001)', () => {
  it('ghi ai/khi nào/cũ→mới cho đơn: tạo, thanh toán, chuyển trạng thái, gán lô, huỷ, hoàn tiền', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder({ paymentMethod: 'payos' })).body
    await request(app).post('/api/payments/payos/webhook').send(payments.pay(order.code)).expect(200)
    await adminAct(order.id, 'start_production').expect(200)
    const detail = (await request(app).get(`/api/admin/orders/${order.id}`).set('Authorization', admin)).body
    const batch = (await repo.listBatches())[0]
    await request(app).put(`/api/admin/orders/${order.id}/items/${detail.item.items[0].id}/batch`).set('Authorization', admin).send({ batchId: batch.id }).expect(200)
    await adminAct(order.id, 'cancel').expect(200)
    await adminAct(order.id, 'refund', { amount: order.total, note: 'CK' }).expect(200)
    const { history } = (await request(app).get(`/api/admin/orders/${order.id}`).set('Authorization', admin)).body
    const rows = [...history].reverse().map((h) => [h.action, h.actorRole, h.oldValue, h.newValue])
    expect(rows[0]).toEqual(['create', 'customer', null, { status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', total: order.total, couponCode: null }])
    expect(rows[1].slice(0, 2)).toEqual(['payment_confirmed', 'system'])
    expect(rows[1][3]).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'PAID', paidAmount: order.total })
    expect(rows[2]).toEqual(['start_production', 'admin', { status: 'CONFIRMED', productionStage: null }, { status: 'IN_PRODUCTION', productionStage: 1 }])
    expect(rows[3]).toEqual(['assign_batch', 'admin', { itemId: detail.item.items[0].id, batchId: null }, { itemId: detail.item.items[0].id, batchId: batch.id }])
    expect(rows[4][0]).toBe('cancel')
    expect(rows[4][3]).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', cancelReason: 'admin' })
    expect(rows[5]).toEqual(['refund', 'admin', { paymentStatus: 'REFUND_PENDING', refundedAmount: null, refundNote: null }, { paymentStatus: 'REFUNDED', refundedAmount: order.total, refundNote: 'CK' }])
    expect(history.every((h) => h.at && (h.actorRole === 'system' || h.actorId))).toBe(true)
  })
  it('coupon và cấu hình phí: tạo / sửa (chỉ trường đổi) / xoá', async () => {
    const c = (await coupon({ code: 'LOG', type: 'amount', value: 1000 })).body.item
    await request(app).patch(`/api/admin/coupons/${c.id}`).set('Authorization', admin).send({ value: 2000, status: 'active' }).expect(200)
    await request(app).delete(`/api/admin/coupons/${c.id}`).set('Authorization', admin).expect(204)
    const h = (await request(app).get(`/api/admin/coupons/${c.id}/history`).set('Authorization', admin)).body.items
    expect(h.map((x) => x.action)).toEqual(['delete', 'update', 'create'])
    expect(h[1]).toMatchObject({ actorRole: 'admin', oldValue: { value: 1000 }, newValue: { value: 2000 } })
    await request(app).put('/api/admin/shop').set('Authorization', admin).send({ shippingFee: 25000, freeShippingFrom: 1500000, codMaxTotal: null }).expect(200)
    const shop = await repo.listAudit({ entity: 'shop', entityId: 'shop' })
    expect(shop[0]).toMatchObject({ action: 'update', oldValue: { shippingFee: 30000, codMaxTotal: 5000000 }, newValue: { shippingFee: 25000, codMaxTotal: null } })
  })
  it('lỗi ghi nhật ký không làm hỏng thao tác', async () => {
    repo.appendAudit = async () => {
      throw new Error('db down')
    }
    await addToCart('den-nguyet', 1)
    const res = await placeOrder()
    expect(res.status).toBe(201)
  })
})
