// Kiểm thử độc lập D-113: checkout chỉ COD, đơn tặng (recipient != buyer) được dùng COD khi payOS tắt.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { createMessageService } from './messages/service.js'
import { validateCheckout } from './domain/order.js'
import { orderMail } from './mail/templates.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'x', rateLimit: { enabled: false } }
const GIFT = {
  orderKind: 'gift', hasMessage: true, qrLang: 'en', recipientIsSelf: false,
  recipientName: 'Trần B', recipientPhone: '0912345678', addressLine: '1 Hàng Bông',
  provinceCode: '1', wardCode: '4', paymentMethod: 'cod',
}
const SELF = { ...GIFT, orderKind: 'self', hasMessage: false, qrLang: undefined, recipientIsSelf: true }

let repo, auth, storage, notify, customer

function build({ payos }) {
  repo = createMemoryRepo(); auth = createMemoryAuth(); storage = createMemoryStorage()
  notify = vi.fn(async () => true)
  const orders = createOrderService({ repo, payos, notify })
  return createApp({ repo, auth, storage, config, payos, orders, messages: createMessageService({ repo, storage }) })
}
async function login(app, email) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role: 'customer' })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}
const cart = (app, slug = 'den-nguyet', quantity = 1) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', customer.token).send({ quantity })
const post = (app, body) => request(app).post('/api/orders').set('Authorization', customer.token).send(body)
const stock = async (s) => (await repo.getProductBySlug(s)).stock

describe('D-113 payos=null: COD đơn tặng', () => {
  let app
  beforeEach(async () => { app = build({ payos: null }); customer = await login(app, 'a@lamvi.test') })

  it('201, confirmed, payment null, không payosOrderCode, báo xác nhận', async () => {
    await cart(app)
    const r = await post(app, GIFT)
    expect(r.status).toBe(201)
    expect(r.body.payment).toBeNull()
    expect(r.body.order).toMatchObject({ status: 'confirmed', paymentMethod: 'cod', recipientIsSelf: false, hasMessage: true })
    const o = await repo.getOrderByCode(r.body.order.code)
    expect(o.payosOrderCode).toBeNull()
    expect(o.paymentExpiresAt).toBeNull()
    expect(notify).toHaveBeenCalledWith('confirmed', expect.objectContaining({ code: o.code }))
  })

  it('tồn kho, coupon, giỏ xử lý giống đơn COD tự mua', async () => {
    const result = {}
    for (const [name, body] of [['self', SELF], ['gift', GIFT]]) {
      app = build({ payos: null }); customer = await login(app, `${name}@lamvi.test`)
      await repo.setStock?.call
      const p = await repo.getProductBySlug('den-nguyet')
      await repo.updateProduct(p.id, { stock: 5 })
      await repo.createCoupon({ code: 'GIAM10', type: 'percent', value: 10, status: 'active', usedCount: 0 })
      await cart(app, 'den-nguyet', 2)
      const r = await post(app, { ...body, couponCode: 'giam10' })
      expect(r.status).toBe(201)
      const cartAfter = await request(app).get('/api/cart').set('Authorization', customer.token)
      const coupon = await repo.getCouponByCode('GIAM10')
      result[name] = { status: r.body.order.status, total: r.body.order.total, discount: r.body.order.discount,
        stock: await stock('den-nguyet'), used: coupon.usedCount, cart: cartAfter.body.items.length }
    }
    expect(result.gift).toEqual(result.self)
    expect(result.gift).toMatchObject({ status: 'confirmed', stock: 3, used: 1, cart: 0 })
  })

  it('idempotency key replay trả cùng đơn, không trừ kho hai lần', async () => {
    const p = await repo.getProductBySlug('den-nguyet'); await repo.updateProduct(p.id, { stock: 5 })
    await cart(app)
    const key = '11111111-1111-4111-8111-111111111111'
    const a = await post(app, { ...GIFT, idempotencyKey: key })
    const b = await post(app, { ...GIFT, idempotencyKey: key })
    expect(a.status).toBe(201)
    expect(b.body.order.code).toBe(a.body.order.code)
    expect(await stock('den-nguyet')).toBe(4)
  })

  it('luồng lời chúc: PUT message, sửa lại, khoá khi packed, QR mở khi shipped', async () => {
    await cart(app)
    const code = (await post(app, GIFT)).body.order.code
    const put = (t) => request(app).put(`/api/orders/${code}/message`).set('Authorization', customer.token).send({ text: t, textLang: 'en' })
    const g = await request(app).get(`/api/orders/${code}/message`).set('Authorization', customer.token)
    expect(g.body.item).toMatchObject({ allowed: true, canEditText: true, canEditMedia: true })
    const r = await put('Happy birthday')
    expect(r.status).toBe(200)
    expect(r.body.item).toMatchObject({ text: 'Happy birthday', state: 'DRAFT' })
    expect((await put('v2')).body.item.text).toBe('v2')
    const o = await repo.getOrderByCode(code)
    const up = await request(app).post(`/api/orders/${code}/message/media-upload`).set('Authorization', customer.token).send({ kind: 'voice', contentType: 'audio/mpeg', size: 10 })
    expect(up.status).toBe(201)
    const qr = (await repo.getOrderByCode(code)).qrToken
    const prep = await request(app).get(`/api/qr/${qr}`); expect(prep.status).toBe(200); expect(JSON.stringify(prep.body)).toContain("preparing")
    await repo.updateOrder(o.id, { status: 'packed' })
    expect((await put('late')).status).toBe(409)
    await repo.updateOrder(o.id, { status: 'shipped' })
    const view = await request(app).get(`/api/qr/${qr}`)
    expect(view.status).toBe(200)
    expect(view.body.item.state).toBe('greeting')
    expect((await request(app).post(`/api/qr/${qr}/confirm`)).status).toBeLessThan(300)
    expect(JSON.stringify((await request(app).get(`/api/qr/${qr}`)).body)).toContain('v2')
  })

  it('đơn COD tặng huỷ được: hoàn kho, paymentStatus cancelled (không refund_pending)', async () => {
    const p = await repo.getProductBySlug('den-nguyet'); await repo.updateProduct(p.id, { stock: 5 })
    await cart(app)
    const code = (await post(app, GIFT)).body.order.code
    const r = await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer.token).send({ reason: 'x' })
    expect(r.status).toBe(200)
    expect(await stock('den-nguyet')).toBe(5)
    expect((await repo.getOrderByCode(code)).paymentStatus).toBe('cancelled')
  })

  it('payos method khi payos=null → 503, không đơn mồ côi, giỏ/kho/coupon nguyên', async () => {
    const p = await repo.getProductBySlug('den-nguyet'); await repo.updateProduct(p.id, { stock: 5 })
    await repo.createCoupon({ code: 'GIAM10', type: 'percent', value: 10, status: 'active', usedCount: 0 })
    await cart(app)
    for (const body of [SELF, GIFT]) {
      const r = await post(app, { ...body, paymentMethod: 'payos', couponCode: 'GIAM10' })
      expect(r.status).toBe(503)
      expect(r.body.error.code).toBe('PAYMENT_UNAVAILABLE')
    }
    expect((await repo.listOrdersByUser(customer.id)).length).toBe(0)
    expect(await stock('den-nguyet')).toBe(5)
    expect((await repo.getCouponByCode('GIAM10')).usedCount).toBe(0)
    expect((await request(app).get('/api/cart').set('Authorization', customer.token)).body.items).toHaveLength(1)
  })

  it('email xác nhận không nhắc thanh toán online cho đơn COD tặng (3 ngôn ngữ)', () => {
    for (const lang of ['vi', 'en', 'zh']) {
      const mail = orderMail({ kind: 'confirmed', lang, siteUrl: 'https://x', name: 'A',
        order: { code: 'LV1', hasMessage: true, paymentMethod: 'cod', paymentStatus: 'pending', recipientIsSelf: false, items: [], total: 1000, subtotal: 1000, shippingFee: 0, discount: 0 } })
      expect(`${mail.subject}${mail.text}`).not.toMatch(/payOS|thanh toán trực|online payment|在线支付/i)
    }
  })
})

describe('payos có: BR-PAY-004 giữ nguyên', () => {
  it('COD + gift → 400 COD_NOT_ALLOWED_FOR_GIFT, không tạo đơn; payos + gift → 201 pending_payment', async () => {
    const payos = { checksumKey: 'k', createPaymentLink: vi.fn(async (p) => ({ checkoutUrl: `https://pay/${p.orderCode}`, qrCode: 'Q' })), cancelPaymentLink: vi.fn() }
    const app = build({ payos }); customer = await login(app, 'b@lamvi.test')
    await cart(app)
    const r = await post(app, GIFT)
    expect(r.status).toBe(400)
    expect(r.body.error.fields.paymentMethod).toBe('COD_NOT_ALLOWED_FOR_GIFT')
    expect((await repo.listOrdersByUser(customer.id)).length).toBe(0)
    const ok = await post(app, { ...GIFT, paymentMethod: 'payos' })
    expect(ok.status).toBe(201)
    expect(ok.body.order.status).toBe('pending_payment')
    expect(ok.body.payment.checkoutUrl).toMatch(/pay/)
    // COD tự mua vẫn được
    await cart(app)
    expect((await post(app, SELF)).status).toBe(201)
  })

  it('validateCheckout: mặc định onlinePayment=true chặn; false cho qua; payos gift luôn hợp lệ', () => {
    expect(validateCheckout(GIFT).errors.paymentMethod).toBe('COD_NOT_ALLOWED_FOR_GIFT')
    expect(validateCheckout(GIFT, {}).errors.paymentMethod).toBe('COD_NOT_ALLOWED_FOR_GIFT')
    expect(validateCheckout(GIFT, { onlinePayment: false }).errors.paymentMethod).toBeUndefined()
    expect(validateCheckout({ ...GIFT, paymentMethod: 'bitcoin' }, { onlinePayment: false }).errors.paymentMethod).toBe('INVALID')
  })
})
