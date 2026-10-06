// Kiểm thử độc lập (T-11) cho checkout → đơn hàng → thanh toán → coupon.
// Bổ sung cho server/orders.test.js: tập trung vào edge case tiền bạc, tình huống đồng thời,
// quyền/rò rỉ dữ liệu, ma trận trạng thái §16 và tính khớp giữa ràng buộc SQL với logic JS.
// Căn cứ: D-68…D-74, §12…§17, §24 (BR-PRC/CPN/PAY/ORD/SHP), §27, NFR-SEC-002, NFR-AUD-001.
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'
import {
  ORDER_KINDS,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  QR_LANGS,
  adminNextStatuses,
  canAdminMove,
  canCustomerCancel,
  generateOrderCode,
} from './domain/order.js'
import { COUPON_TYPES } from './domain/pricing.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }
const root = new URL('../', import.meta.url)

let app, repo, auth, orders, payos, customer, customerId, admin, clock

// payOS giả: ghi lại lời gọi, không ra mạng
function fakePayos() {
  return {
    checksumKey: 'khoa-checksum-thu',
    createPaymentLink: vi.fn(async (p) => ({ checkoutUrl: `https://pay.test/${p.orderCode}`, paymentLinkId: 'pl1', qrCode: 'QR' })),
    cancelPaymentLink: vi.fn(async () => {}),
    getPaymentLink: vi.fn(),
  }
}

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  payos = fakePayos()
  clock = new Date('2026-10-01T03:00:00.000Z')
  orders = createOrderService({ repo, payos, now: () => clock })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config, payos, orders })
  const c = await login('khach@lamvi.test')
  customer = c.token
  customerId = c.id
  admin = (await login('admin@lamvi.test', 'admin')).token
})

const addToCart = (slug, quantity = 1, token = customer) =>
  request(app).put(`/api/cart/items/${slug}`).set('Authorization', token).send({ quantity })

const CHECKOUT = {
  orderKind: 'self',
  recipientIsSelf: true,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông',
  provinceCode: '1', wardCode: '4',
  paymentMethod: 'cod',
}

const createOrder = (over = {}, token = customer) =>
  request(app).post('/api/orders').set('Authorization', token).send({ ...CHECKOUT, ...over })

const getOrder = (code, token = customer) =>
  request(app).get(`/api/orders/${code}`).set('Authorization', token)

const setStatus = (code, status, extra = {}, token = admin) =>
  request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', token).send({ status, ...extra })

const coupon = (over = {}) =>
  repo.createCoupon({ code: 'TET2026', type: 'percent', value: 10, status: 'active', usedCount: 0, ...over })

const vatOf = (total) => Math.round((total * 0.1) / 1.1)

// ---------------------------------------------------------------------------

describe('Tiền: bảng giá chốt vào đơn (BR-PRC-001, D-68, D-69, D-70)', () => {
  it('giỏ nhiều dòng, số lẻ: tổng = Σ dòng, VAT tách ngược MỘT lần ở tổng đơn', async () => {
    await addToCart('den-nguyet', 3) // 890.000 × 3 = 2.670.000
    await addToCart('den-vong', 2) // 1.050.000 × 2 = 2.100.000
    const r = await createOrder()
    expect(r.status).toBe(201)
    const o = r.body.order
    expect(o).toMatchObject({ subtotal: 4_770_000, discount: 0, shippingFee: 0, total: 4_770_000 })
    // Q-09: một lần làm tròn ở tổng, không cộng dồn VAT từng dòng
    expect(o.vatAmount).toBe(vatOf(4_770_000))
    expect(o.items.reduce((s, i) => s + i.lineTotal, 0)).toBe(o.subtotal)
    // Mọi số tiền là số nguyên VND
    for (const v of [o.subtotal, o.discount, o.shippingFee, o.total, o.vatAmount]) {
      expect(Number.isInteger(v)).toBe(true)
    }
  })

  it('coupon số tiền lớn hơn tạm tính → giảm tối đa bằng tiền hàng, khách vẫn trả phí ship', async () => {
    await coupon({ code: 'QUALON', type: 'amount', value: 5_000_000 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'QUALON' })
    expect(r.body.order).toMatchObject({ subtotal: 890_000, discount: 890_000, shippingFee: 30_000, total: 30_000 })
    expect(r.body.order.total).toBeGreaterThanOrEqual(0)
    expect(r.body.order.vatAmount).toBe(vatOf(30_000))
  })

  it('coupon % 100 không tạo đơn 0đ: phí ship vẫn thu vì tạm tính sau giảm rơi dưới ngưỡng', async () => {
    await coupon({ code: 'FREE100', type: 'percent', value: 100 })
    await addToCart('den-sum-vay', 1) // 1.680.000 → vốn được miễn ship
    const r = await createOrder({ couponCode: 'FREE100' })
    expect(r.body.order).toMatchObject({ discount: 1_680_000, shippingFee: 30_000, total: 30_000 })
  })

  it('D-70: coupon kéo tạm tính xuống dưới 1.000.000đ → mất miễn phí ship', async () => {
    await coupon({ code: 'SATNGUONG', type: 'amount', value: 50_001 })
    await addToCart('den-vong', 1) // 1.050.000 ≥ ngưỡng → vốn miễn ship
    const free = await request(app).post('/api/checkout/quote').set('Authorization', customer).send({})
    expect(free.body).toMatchObject({ shippingFee: 0, freeShipping: true, total: 1_050_000 })
    // 1.050.000 − 50.001 = 999.999 → rơi dưới ngưỡng, phải thu lại phí ship
    const r = await createOrder({ couponCode: 'SATNGUONG' })
    expect(r.body.order).toMatchObject({ discount: 50_001, shippingFee: 30_000, total: 1_029_999 })
  })

  it('coupon free_shipping: miễn ship nhưng không giảm tiền hàng', async () => {
    await coupon({ code: 'SHIP0', type: 'free_shipping', value: 0 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'SHIP0' })
    expect(r.body.order).toMatchObject({ subtotal: 890_000, discount: 0, shippingFee: 0, total: 890_000 })
  })

  it('expectedTotal: khớp → 201; lệch → 409 PRICE_CHANGED kèm bảng giá mới; âm → 400', async () => {
    await addToCart('den-nguyet', 1)
    // Số tiền lệch (nhưng hợp lệ về kiểu) → hiện bảng giá mới, bắt xác nhận lại (D-41)
    const r = await createOrder({ expectedTotal: 0 })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('PRICE_CHANGED')
    expect(r.body.error.details.quote).toMatchObject({ total: 920_000 })
    expect((await repo.listOrders()).length).toBe(0)

    // Số âm là dữ liệu hỏng, không phải "giá lệch"
    expect((await createOrder({ expectedTotal: -1 })).status).toBe(400)
    expect((await createOrder({ expectedTotal: 920_000 })).status).toBe(201)
  })

  it('expectedTotal sai kiểu (float/chuỗi/âm) → 400; không gửi thì bỏ qua chốt giá', async () => {
    // D-41: sai kiểu phải báo lỗi, không được âm thầm bỏ bước xác nhận lại giá
    for (const v of [920_000.5, '920000', -1, {}]) {
      await addToCart('den-nguyet', 1)
      const r = await createOrder({ expectedTotal: v })
      expect(r.status, String(v)).toBe(400)
      expect(r.body.error.fields.expectedTotal).toBe('INVALID')
    }
    // Không gửi (undefined/null) → vẫn tạo đơn, server là nguồn sự thật về giá
    for (const v of [undefined, null]) {
      await addToCart('den-nguyet', 1)
      const r = await createOrder({ expectedTotal: v })
      expect(r.status).toBe(201)
      expect(r.body.order.total).toBe(920_000)
    }
  })

  it('BR-PRC-002: đổi cấu hình phí ship/VAT sau khi đặt không ảnh hưởng đơn đã tạo', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    await repo.setSetting('pricing', { vatRate: 0.08, shippingFee: 99_000, freeShippingFrom: 0 })
    const again = await getOrder(r.body.order.code)
    expect(again.body.item).toMatchObject({ shippingFee: 30_000, total: 920_000, vatRate: 0.1 })
  })
})

describe('Coupon: giữ lượt, trả lượt, tình huống đồng thời (D-71 / C-5, C-8)', () => {
  it('C-5: hai khách đặt cùng lúc với coupon còn 1 lượt → chỉ một đơn dùng được', async () => {
    const b = await login('khachb@lamvi.test')
    await coupon({ code: 'CHOT1', type: 'amount', value: 100_000, usageLimit: 1 })
    await addToCart('den-nguyet', 1)
    await addToCart('den-nguyet', 1, b.token)

    const rs = await Promise.all([createOrder({ couponCode: 'CHOT1' }), createOrder({ couponCode: 'CHOT1' }, b.token)])
    const codes = rs.map((r) => r.status).sort()
    expect(codes).toEqual([201, 409])
    expect(rs.find((r) => r.status === 409).body.error.code).toBe('COUPON_USED_UP')
    expect((await repo.getCouponByCode('CHOT1')).usedCount).toBe(1)
    // Đơn hỏng không được để lại trong DB
    expect((await repo.listOrders()).length).toBe(1)
  })

  it('§27: bấm "Đặt hàng" hai lần → tối đa một đơn được tạo', async () => {
    await addToCart('den-nguyet', 1)
    const rs = await Promise.all([createOrder(), createOrder()])
    expect(rs.filter((r) => r.status === 201).length).toBe(1)
    expect((await repo.listOrders()).length).toBe(1)
  })

  it('C-8: huỷ đơn trả lượt TỔNG của coupon', async () => {
    await coupon({ code: 'TRALUOT', type: 'amount', value: 100_000, usageLimit: 5 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'TRALUOT' })
    expect((await repo.getCouponByCode('TRALUOT')).usedCount).toBe(1)
    await request(app).post(`/api/orders/${r.body.order.code}/cancel`).set('Authorization', customer).send({})
    expect((await repo.getCouponByCode('TRALUOT')).usedCount).toBe(0)
  })

  it('C-8: admin huỷ đơn cũng trả lượt coupon', async () => {
    await coupon({ code: 'ADMHUY', type: 'amount', value: 100_000, usageLimit: 5 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'ADMHUY' })
    expect((await setStatus(r.body.order.code, 'cancelled')).status).toBe(200)
    expect((await repo.getCouponByCode('ADMHUY')).usedCount).toBe(0)
  })

  it('C-8: huỷ đơn phải trả lại cả lượt THEO KHÁCH (per_user_limit), không chỉ lượt tổng', async () => {
    // LỖI ĐANG MỞ — test này cố tình fail để báo cáo.
    // releaseCoupon() giảm used_count nhưng bản ghi coupon_redemptions của đơn đã huỷ vẫn còn,
    // nên countCouponUsesByUser() vẫn đếm 1 → khách huỷ đơn là mất luôn coupon vĩnh viễn,
    // trong khi C-8 (D-71) nói huỷ đơn thì TRẢ LẠI lượt.
    await coupon({ code: 'MOTLAN', type: 'amount', value: 100_000, perUserLimit: 1 })
    await addToCart('den-nguyet', 1)
    const r1 = await createOrder({ couponCode: 'MOTLAN' })
    await request(app).post(`/api/orders/${r1.body.order.code}/cancel`).set('Authorization', customer).send({})
    // Lượt tổng đã được trả…
    expect((await repo.getCouponByCode('MOTLAN')).usedCount).toBe(0)

    // …nhưng lượt của chính khách này thì không
    await addToCart('den-nguyet', 1)
    const r2 = await createOrder({ couponCode: 'MOTLAN' })
    expect({ status: r2.status, code: r2.body.error?.code }).toEqual({ status: 201, code: undefined })
  })

  it('trả lượt hai lần không làm used_count âm', async () => {
    const c = await coupon({ code: 'AMDUONG', type: 'amount', value: 1000, usageLimit: 3 })
    expect(await repo.claimCoupon(c.id)).toBe(1)
    await repo.releaseCoupon(c.id)
    await repo.releaseCoupon(c.id)
    expect((await repo.getCouponByCode('AMDUONG')).usedCount).toBe(0)
  })

  it('admin tắt coupon ngay trước khi giữ lượt → không tạo đơn, không giữ lượt', async () => {
    const c = await coupon({ code: 'TATGIUA', type: 'amount', value: 100_000 })
    const create = repo.createOrder.bind(repo)
    repo.createOrder = async (...args) => {
      await repo.updateCoupon(c.id, { status: 'disabled' })
      return create(...args)
    }
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'TATGIUA' })
    expect(r.status).toBe(409)
    // [RỦI RO] mã lỗi là COUPON_USED_UP dù lý do thật là coupon bị tắt
    expect(r.body.error.code).toBe('COUPON_INACTIVE')
    expect((await repo.listOrders()).length).toBe(0)
    expect((await repo.getCouponById(c.id)).usedCount).toBe(0)
  })

  it('coupon hết hiệu lực đúng thời điểm tạo đơn (ends_at = now) → 409, không tạo đơn', async () => {
    await coupon({ code: 'HETHAN', type: 'amount', value: 100_000, endsAt: clock.toISOString() })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: 'HETHAN' })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('COUPON_EXPIRED')
    expect((await repo.listOrders()).length).toBe(0)
  })

  it('coupon chưa tới hạn dùng (starts_at trong tương lai) → 409 COUPON_NOT_STARTED', async () => {
    await coupon({ code: 'CHUAMO', type: 'amount', value: 100_000, startsAt: '2026-11-01T00:00:00.000Z' })
    await addToCart('den-nguyet', 1)
    expect((await createOrder({ couponCode: 'CHUAMO' })).body.error.code).toBe('COUPON_NOT_STARTED')
  })

  it('BR-CPN-003: đơn chỉ ghi nhận đúng một coupon dù client gửi mảng', async () => {
    await coupon({ code: 'TET2026' })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ couponCode: ['TET2026', 'TET2026'] })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.couponCode).toBe('INVALID')
  })
})

describe('Admin coupon: sửa loại và trần giảm (§14, C-6)', () => {
  const patch = (id, payload) =>
    request(app).patch(`/api/admin/coupons/${id}`).set('Authorization', admin).send(payload)

  it('PATCH đổi type mà không gửi value → 400 value REQUIRED', async () => {
    const c = await coupon({ type: 'percent', value: 10 })
    const r = await patch(c.id, { type: 'amount' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.value).toBe('REQUIRED')
    expect((await repo.getCouponById(c.id))).toMatchObject({ type: 'percent', value: 10 })
  })

  it('PATCH đổi sang free_shipping: dọn trần giảm của loại % (C-6)', async () => {
    const c = await coupon({ type: 'percent', value: 50, maxDiscount: 50_000 })
    expect((await patch(c.id, { type: 'free_shipping' })).status).toBe(200)
    expect(await repo.getCouponById(c.id)).toMatchObject({ type: 'free_shipping', value: 0, maxDiscount: null })
  })

  it('C-6: đặt trần giảm cho coupon không phải % → 400 ONLY_FOR_PERCENT', async () => {
    const c = await coupon({ type: 'amount', value: 100_000 })
    const r = await patch(c.id, { maxDiscount: 10_000 })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.maxDiscount).toBe('ONLY_FOR_PERCENT')
  })

  it('giá trị % ngoài 1..100 bị chặn ở cả POST và PATCH (khớp coupons_percent_range)', async () => {
    for (const value of [0, 101, -5, 10.5]) {
      const r = await request(app)
        .post('/api/admin/coupons')
        .set('Authorization', admin)
        .send({ code: `PCT${Math.abs(value)}`.replace('.', ''), type: 'percent', value })
      expect(r.status).toBe(400)
      expect(r.body.error.fields.value).toBe('INVALID_PERCENT')
    }
  })
})

describe('payOS: cổng lỗi, chưa cấu hình, webhook biên (§15.1, NFR-SEC-002)', () => {
  const payosOrder = async (over = {}) => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos', recipientIsSelf: true, ...over })
    return { res: r, order: await repo.getOrderByCode(r.body.order.code) }
  }

  it('createPaymentLink ném lỗi → đơn vẫn tồn tại ở PENDING_PAYMENT, khách biết lỗi cổng', async () => {
    payos.createPaymentLink = vi.fn(async () => {
      throw new Error('payOS down')
    })
    await coupon({ code: 'GIU', type: 'amount', value: 100_000, usageLimit: 5 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos', couponCode: 'GIU' })
    expect(r.status).toBe(201)
    expect(r.body.payment).toMatchObject({ error: 'PAYMENT_GATEWAY_ERROR' })
    expect(r.body.payment.expiresAt).toBe(new Date(clock.getTime() + PAYMENT_WINDOW_MS).toISOString())
    const saved = await repo.getOrderByCode(r.body.order.code)
    expect(saved.status).toBe('pending_payment')
    // Lượt coupon vẫn được giữ cho đơn này (đơn tồn tại, chưa huỷ)
    expect((await repo.getCouponByCode('GIU')).usedCount).toBe(1)
    // Khách mở lại đơn vẫn xem được, chưa quá hạn thì chưa bị huỷ
    expect((await getOrder(saved.code)).body.item.status).toBe('pending_payment')
  })

  it('chưa cấu hình payOS: chọn payos → 503 và KHÔNG có đơn mồ côi; webhook → 503', async () => {
    const svc = createOrderService({ repo, payos: null, now: () => clock })
    const app2 = createApp({ repo, auth, storage: createMemoryStorage(), config, payos: null, orders: svc })
    await addToCart('den-nguyet', 1)
    const r = await request(app2).post('/api/orders').set('Authorization', customer).send({ ...CHECKOUT, paymentMethod: 'payos' })
    expect(r.status).toBe(503)
    expect(r.body.error.code).toBe('PAYMENT_UNAVAILABLE')
    expect((await repo.listOrders()).length).toBe(0)
    // Giỏ không bị dọn khi đơn không tạo được
    expect((await repo.getCart(customerId)).length).toBe(1)

    const wh = await request(app2).post('/api/payments/payos/webhook').send({ data: { orderCode: 1 }, signature: 'x' })
    expect(wh.status).toBe(503)
  })

  it('webhook PAID về sau hạn: kết quả giống hệt dù cron đã chạy hay chưa (§15.1)', async () => {
    // Trước đây kết quả phụ thuộc việc cron đã chạy chưa (CONFIRMED vs CANCELLED). Nay
    // applyPayosWebhook tự huỷ đơn quá hạn trước khi xử lý → luôn là "trả tiền sau khi đơn huỷ":
    // ghi nhận PAID và gắn cờ cho admin hoàn tiền tay.
    const { order } = await payosOrder()
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 60_000)
    const res = await orders.applyPayosWebhook({ orderCode: order.payosOrderCode, amount: order.total, paid: true, reference: 'r1' })
    expect(res.handled).toBe(true)
    const after = await repo.getOrderByCode(order.code)
    expect(after).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
  })

  it('webhook PAID sau khi cron đã huỷ đơn → ghi nhận PAID + cờ hoàn tiền tay', async () => {
    const { order } = await payosOrder()
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 60_000)
    expect((await orders.expirePendingOrders()).length).toBe(1)
    const res = await orders.applyPayosWebhook({ orderCode: order.payosOrderCode, amount: order.total, paid: true, reference: 'r1' })
    expect(res).toMatchObject({ handled: true, reason: 'PAID_AFTER_CANCEL' })
    const after = await repo.getOrderByCode(order.code)
    expect(after).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
  })

  it('webhook số tiền lệch rồi webhook đúng số tiền → đơn xác nhận và cờ AMOUNT_MISMATCH được gỡ', async () => {
    const { order } = await payosOrder()
    await orders.applyPayosWebhook({ orderCode: order.payosOrderCode, amount: 1, paid: true, reference: 'r1' })
    expect((await repo.getOrderByCode(order.code)).paymentFlag).toBe('AMOUNT_MISMATCH')
    await orders.applyPayosWebhook({ orderCode: order.payosOrderCode, amount: order.total, paid: true, reference: 'r2' })
    const after = await repo.getOrderByCode(order.code)
    expect(after).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', paymentFlag: null })
  })

  it('webhook báo chưa trả (code ≠ 00) → không đổi gì', async () => {
    const { order } = await payosOrder()
    const res = await orders.applyPayosWebhook({ orderCode: order.payosOrderCode, amount: order.total, paid: false })
    expect(res).toMatchObject({ handled: false, reason: 'NOT_PAID' })
    expect((await repo.getOrderByCode(order.code)).status).toBe('pending_payment')
  })

  it('cancelPaymentLink lỗi không làm hỏng việc huỷ đơn của khách', async () => {
    payos.cancelPaymentLink = vi.fn(async () => {
      throw new Error('payOS down')
    })
    const { order } = await payosOrder()
    const r = await request(app).post(`/api/orders/${order.code}/cancel`).set('Authorization', customer).send({})
    expect(r.status).toBe(200)
    expect(r.body.item.status).toBe('cancelled')
  })

  it('huỷ đơn PENDING_PAYMENT luôn huỷ link payOS, dù admin hay khách huỷ', async () => {
    // Link còn sống tới 15 phút: không huỷ thì khách vẫn trả được vào đơn đã huỷ
    const { order } = await payosOrder()
    await setStatus(order.code, 'cancelled')
    expect(payos.cancelPaymentLink).toHaveBeenCalledWith(order.payosOrderCode, expect.any(String))

    const { order: o2 } = await payosOrder()
    await request(app).post(`/api/orders/${o2.code}/cancel`).set('Authorization', customer).send({})
    expect(payos.cancelPaymentLink).toHaveBeenCalledWith(o2.payosOrderCode, expect.any(String))
  })

  it('link thanh toán gửi payOS: mô tả ≤ 25 ký tự, hạn 15 phút, số tiền = tổng đơn (D-73)', async () => {
    const { order } = await payosOrder()
    const sent = payos.createPaymentLink.mock.calls[0][0]
    expect(sent.description.length).toBeLessThanOrEqual(25)
    expect(sent.amount).toBe(order.total)
    expect(sent.expiredAt - clock.getTime()).toBe(PAYMENT_WINDOW_MS)
    expect(sent.returnUrl.startsWith(config.publicSiteUrl)).toBe(true)
  })

  it('danh sách đơn và trang chi tiết nói cùng một trạng thái khi đơn quá hạn', async () => {
    const { order } = await payosOrder()
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1000)
    const list = await request(app).get('/api/orders').set('Authorization', customer)
    expect(list.body.items[0].status).toBe('cancelled')
    expect((await getOrder(order.code)).body.item.status).toBe('cancelled')
  })
})

describe('Đồng thời: huỷ đơn, webhook, admin (§27)', () => {
  const payosOrder = async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos' })
    return repo.getOrderByCode(r.body.order.code)
  }

  it('hai webhook PAID song song → chỉ một lần chuyển trạng thái, một dòng nhật ký', async () => {
    const o = await payosOrder()
    const rs = await Promise.all([
      orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'r1' }),
      orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'r2' }),
    ])
    expect(rs.filter((x) => x.handled && !x.idempotent && !x.reason).length).toBe(1)
    const log = await repo.listAuditLog({ entity: 'order', entityId: o.id })
    expect(log.filter((e) => e.action === 'status').length).toBe(1)
    expect((await repo.getOrderByCode(o.code)).status).toBe('confirmed')
  })

  it('khách huỷ đúng lúc webhook PAID → đơn huỷ và tiền vào diện chờ hoàn (D-74)', async () => {
    const o = await payosOrder()
    const [cancelRes] = await Promise.all([
      request(app).post(`/api/orders/${o.code}/cancel`).set('Authorization', customer).send({}),
      orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'r1' }),
    ])
    expect(cancelRes.status).toBe(200)
    const after = await repo.getOrderByCode(o.code)
    expect(after.status).toBe('cancelled')
    // Tiền đã nhận thì không được để paymentStatus = cancelled
    expect(['paid', 'refund_pending']).toContain(after.paymentStatus)
  })

  it('admin đổi trạng thái hai lần song song → một 200, một 409', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const rs = await Promise.all([
      setStatus(r.body.order.code, 'in_production'),
      setStatus(r.body.order.code, 'in_production'),
    ])
    expect(rs.map((x) => x.status).sort()).toEqual([200, 409])
    expect(rs.find((x) => x.status === 409).body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('D-74: ghi nhận hoàn tiền hai lần → lần hai 409, chỉ một dòng nhật ký hoàn tiền', async () => {
    const o = await payosOrder()
    await orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'r1' })
    await request(app).post(`/api/orders/${o.code}/cancel`).set('Authorization', customer).send({})
    const refund = () => request(app).post(`/api/admin/orders/${o.code}/refund`).set('Authorization', admin).send({ note: 'CK tay' })
    const rs = await Promise.all([refund(), refund()])
    expect(rs.map((x) => x.status).sort()).toEqual([200, 409])
    const log = await repo.listAuditLog({ entity: 'order', entityId: o.id })
    expect(log.filter((e) => e.action === 'refund').length).toBe(1)
  })
})

describe('Quyền và rò rỉ dữ liệu (BR-ACC-001, AC-004 US-004)', () => {
  let other, otherOrder

  beforeEach(async () => {
    other = await login('khachkhac@lamvi.test')
    await addToCart('den-nguyet', 1, other.token)
    const r = await createOrder({ recipientName: 'Người khác', recipientPhone: '0987654321' }, other.token)
    otherOrder = r.body.order
  })

  it('khách A không xem/huỷ được đơn của khách B → 404, đơn B không đổi', async () => {
    expect((await getOrder(otherOrder.code)).status).toBe(404)
    const cancel = await request(app).post(`/api/orders/${otherOrder.code}/cancel`).set('Authorization', customer).send({})
    expect(cancel.status).toBe(404)
    expect((await repo.getOrderByCode(otherOrder.code)).status).toBe('confirmed')
  })

  it('khách không gọi được API admin về đơn và coupon', async () => {
    for (const call of [
      request(app).get('/api/admin/orders').set('Authorization', customer),
      request(app).get(`/api/admin/orders/${otherOrder.code}`).set('Authorization', customer),
      setStatus(otherOrder.code, 'in_production', {}, customer),
      request(app).post(`/api/admin/orders/${otherOrder.code}/refund`).set('Authorization', customer).send({}),
      request(app).get('/api/admin/coupons').set('Authorization', customer),
    ]) {
      const r = await call
      expect([401, 403]).toContain(r.status)
    }
  })

  it('không đăng nhập → 401 ở mọi endpoint đơn hàng, không lộ thông tin người nhận', async () => {
    for (const call of [
      request(app).get('/api/orders'),
      request(app).get(`/api/orders/${otherOrder.code}`),
      request(app).post(`/api/orders/${otherOrder.code}/cancel`).send({}),
      request(app).post('/api/checkout/quote').send({}),
      request(app).post('/api/orders').send(CHECKOUT),
    ]) {
      const r = await call
      expect(r.status).toBe(401)
      expect(JSON.stringify(r.body)).not.toContain('0987654321')
    }
  })

  it('response đơn hàng chỉ có đúng danh sách trường cho phép (không lộ trường nội bộ)', async () => {
    await addToCart('den-nguyet', 1)
    const created = await createOrder({ paymentMethod: 'payos', couponCode: undefined })
    const allowed = [
      'code', 'status', 'orderKind', 'hasMessage', 'qrLang', 'recipientIsSelf', 'recipientName',
      'recipientPhone', 'addressLine', 'ward', 'district', 'province', 'provinceCode', 'wardCode', 'note', 'paymentMethod',
      'paymentStatus', 'paymentExpiresAt', 'subtotal', 'discount', 'shippingFee', 'total',
      'vatAmount', 'vatRate', 'couponCode', 'trackingCode', 'cancelledAt', 'createdAt',
      'currency', 'items',
    ].sort()
    const detail = await getOrder(created.body.order.code)
    const list = await request(app).get('/api/orders').set('Authorization', customer)
    for (const o of [created.body.order, detail.body.item, ...list.body.items]) {
      expect(Object.keys(o).sort()).toEqual(allowed)
      expect(Object.keys(o.items[0]).sort()).toEqual(['lineTotal', 'name', 'quantity', 'slug', 'unitPrice'])
    }
    // Trường nội bộ chỉ có trong DB
    const row = await repo.getOrderByCode(created.body.order.code)
    expect(row.payosOrderCode).toEqual(expect.any(Number))
    expect(row.userId).toBe(customerId)
  })

  it('đơn của người khác qua /api/admin/orders/:code chỉ admin đọc được, kèm cờ nội bộ', async () => {
    const r = await request(app).get(`/api/admin/orders/${otherOrder.code}`).set('Authorization', admin)
    expect(r.status).toBe(200)
    expect(r.body.item).toMatchObject({ code: otherOrder.code, paymentFlag: null })
    expect(Array.isArray(r.body.audit)).toBe(true)
  })

  it('mã đơn không tồn tại → 404 chung, không phân biệt với đơn người khác', async () => {
    const a = await getOrder('LV2610-KHONGCO')
    const b = await getOrder(otherOrder.code)
    expect(a.status).toBe(404)
    expect(b.status).toBe(404)
    expect(a.body).toEqual(b.body)
  })
})

describe('Vòng đời đơn §16: toàn bộ cặp chuyển trạng thái', () => {
  // Bảng §16 — nguồn đối chiếu độc lập với ADMIN_TRANSITIONS trong code
  const SPEC = {
    pending_payment: ['cancelled'],
    confirmed: ['in_production', 'cancelled'],
    in_production: ['packed', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    shipped: ['delivered', 'delivery_failed'],
    delivered: [],
    delivery_failed: [],
    cancelled: [],
  }

  it('admin chỉ đi được đúng các bước §16, mọi cặp còn lại bị cấm', () => {
    for (const from of ORDER_STATUSES) {
      expect(adminNextStatuses(from).slice().sort()).toEqual(SPEC[from].slice().sort())
      for (const to of ORDER_STATUSES) {
        expect(canAdminMove(from, to)).toBe(SPEC[from].includes(to))
      }
    }
    expect(canAdminMove('confirmed', 'khong-co-that')).toBe(false)
    expect(canAdminMove('khong-co-that', 'cancelled')).toBe(false)
  })

  it('BR-ORD-001 / D-06: khách huỷ được trước SHIPPED, từ SHIPPED trở đi thì không', () => {
    for (const s of ORDER_STATUSES) {
      const before = ['pending_payment', 'confirmed', 'in_production', 'packed'].includes(s)
      expect(canCustomerCancel(s)).toBe(before)
    }
  })

  it('API: mọi bước bị cấm trả 409 và không đổi trạng thái đơn', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const o = await repo.getOrderByCode(r.body.order.code)
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES.filter((s) => !SPEC[from].includes(s))) {
        await repo.updateOrder(o.id, { status: from })
        const res = await setStatus(o.code, to)
        expect(res.status).toBe(409)
        expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION')
        expect((await repo.getOrderByCode(o.code)).status).toBe(from)
      }
    }
  })

  it('API: khách huỷ ở delivery_failed / delivered / cancelled', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const o = await repo.getOrderByCode(r.body.order.code)
    const cancel = () => request(app).post(`/api/orders/${o.code}/cancel`).set('Authorization', customer).send({})

    for (const s of ['shipped', 'delivered', 'delivery_failed']) {
      await repo.updateOrder(o.id, { status: s })
      const res = await cancel()
      expect(res.status).toBe(409)
      expect(res.body.error.code).toBe('ORDER_NOT_CANCELLABLE')
    }
    // Đơn đã huỷ: huỷ lại là thao tác vô hại (idempotent)
    await repo.updateOrder(o.id, { status: 'cancelled' })
    expect((await cancel()).status).toBe(200)
  })

  it('trạng thái lạ từ client → 400, không phải 409', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const res = await setStatus(r.body.order.code, 'REFUNDED')
    expect(res.status).toBe(400)
    expect(res.body.error.fields.status).toBe('INVALID')
  })

  it('mã vận đơn chỉ nhận chuỗi, cắt 64 ký tự, gửi chuỗi rỗng thì xoá', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const code = r.body.order.code
    await setStatus(code, 'in_production')
    await setStatus(code, 'packed')
    const shipped = await setStatus(code, 'shipped', { trackingCode: 'X'.repeat(100) })
    expect(shipped.body.item.trackingCode.length).toBe(64)
    const done = await setStatus(code, 'delivered', { trackingCode: '' })
    expect(done.body.item.trackingCode).toBe(null)
  })
})

describe('Mã đơn hiển thị (generateOrderCode)', () => {
  const ALPHABET = '23456789ACDEFGHJKLMNPQRTUVWXY'

  it('định dạng LV<yy><mm>-<7 ký tự>, chỉ dùng bảng chữ cái không gây nhầm', () => {
    const code = generateOrderCode(new Date('2026-10-01T03:00:00.000Z'))
    expect(code).toMatch(new RegExp(`^LV2610-[${ALPHABET}]{7}$`))
    // Bỏ các ký tự hay đọc nhầm qua điện thoại: 0/O, 1/I, 8/B, 5/S, 2/Z
    for (const ch of '01OIBSZ') expect(ALPHABET).not.toContain(ch)
  })

  it('20.000 mã liên tiếp gần như không trùng; trùng thì uniqueOrderCode thử lại', () => {
    // Không khẳng định "tuyệt đối không trùng": với 17 tỉ tổ hợp, 20.000 mã vẫn còn ~1% khả năng
    // trùng (nghịch lý ngày sinh) → khẳng định như vậy sẽ làm test chập chờn. Điều thật sự quan
    // trọng là tỉ lệ trùng cực thấp, và createOrder có vòng thử lại (kiểm ở test riêng bên dưới).
    const seen = new Set()
    for (let i = 0; i < 20_000; i += 1) seen.add(generateOrderCode(clock))
    expect(seen.size).toBeGreaterThan(19_990)
  })

  it('các ký tự trong mã phân bố đều (không lệch do lấy dư byte)', () => {
    const counts = new Map()
    for (let i = 0; i < 4000; i += 1) {
      for (const ch of generateOrderCode(clock).slice(7)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
    }
    expect(counts.size).toBe(ALPHABET.length)
    const values = [...counts.values()]
    const expected = (4000 * 7) / ALPHABET.length
    // Lệch modulo trực tiếp làm 24/29 ký tự đầu ra nhiều hơn ~33%; ngưỡng 20% đủ để bắt lỗi đó
    // mà không chập chờn vì nhiễu ngẫu nhiên.
    expect(Math.max(...values)).toBeLessThan(expected * 1.2)
    expect(Math.min(...values)).toBeGreaterThan(expected * 0.8)
  })

  it('đủ không gian mã: ≥ 10 tỉ tổ hợp mỗi tháng (một shop 10k đơn/tháng gần như không trùng)', () => {
    expect(ALPHABET.length ** 7).toBeGreaterThan(10_000_000_000)
    expect(new Set(ALPHABET).size).toBe(ALPHABET.length)
  })

  it('mã trùng → thử lại; hết 5 lần → 500, không tạo đơn hỏng', async () => {
    const real = repo.getOrderByCode
    let calls = 0
    repo.getOrderByCode = async (code) => {
      calls += 1
      return { id: 'gia', code }
    }
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    repo.getOrderByCode = real
    expect(r.status).toBe(500)
    expect(calls).toBe(5)
    expect((await repo.listOrders()).length).toBe(0)
  })
})

describe('Migration 20260930000008_orders.sql khớp logic JS', () => {
  const sql = readFileSync(new URL('supabase/migrations/20260930000008_orders.sql', root), 'utf8')
  const list = (re) => sql.match(re)[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''))

  it('danh sách giá trị trong CHECK khớp hằng số domain', () => {
    expect(list(/status text not null check \(status in \(([\s\S]*?)\)\)/)).toEqual([...ORDER_STATUSES])
    expect(list(/payment_method text not null check \(payment_method in \((.*?)\)\)/)).toEqual([...PAYMENT_METHODS])
    expect(list(/order_kind text not null check \(order_kind in \((.*?)\)\)/)).toEqual([...ORDER_KINDS])
    expect(list(/qr_lang text check \(qr_lang in \((.*?)\)\)/)).toEqual([...QR_LANGS])
    expect(list(/type text not null check \(type in \((.*?)\)\)/)).toEqual([...COUPON_TYPES])
  })

  it('trạng thái thanh toán trong SQL phủ hết giá trị code ghi vào DB', () => {
    const inSql = list(/payment_status text not null default 'pending' check \(payment_status in \(([\s\S]*?)\)\)/)
    const svc = readFileSync(new URL('server/orders/service.js', root), 'utf8')
    for (const v of ['pending', 'paid', 'expired', 'cancelled', 'refund_pending', 'refunded']) {
      expect(inSql).toContain(v)
      expect(svc.includes(`'${v}'`)).toBe(true)
    }
  })

  it('BR-PAY-004: orders_cod_self_only khớp validateCheckout (COD + giao người khác bị chặn)', async () => {
    expect(sql).toContain("constraint orders_cod_self_only check (payment_method <> 'cod' or recipient_is_self)")
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'cod', recipientIsSelf: false, orderKind: 'gift', qrLang: 'vi' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.paymentMethod).toBe('COD_NOT_ALLOWED_FOR_GIFT')
  })

  it('FR-CHK-005: orders_qr_lang_only_with_message khớp validateCheckout (không lời chúc → qrLang null)', async () => {
    expect(sql).toContain('constraint orders_qr_lang_only_with_message check (has_message or qr_lang is null)')
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ orderKind: 'self', hasMessage: false, qrLang: 'zh' })
    expect(r.status).toBe(201)
    expect(r.body.order).toMatchObject({ hasMessage: false, qrLang: null })
  })

  it('§16: orders_cod_not_pending khớp code (đơn COD vào thẳng CONFIRMED)', async () => {
    expect(sql).toContain("constraint orders_cod_not_pending check (payment_method <> 'cod' or status <> 'pending_payment')")
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'cod' })
    expect(r.body.order).toMatchObject({ status: 'confirmed', paymentMethod: 'cod', paymentExpiresAt: null })
  })

  it('coupons_percent_range / coupons_amount_positive khớp validateCoupon', () => {
    expect(sql).toContain("constraint coupons_percent_range check (type <> 'percent' or value between 1 and 100)")
    expect(sql).toContain("constraint coupons_amount_positive check (type <> 'amount' or value > 0)")
    expect(sql).toContain('constraint coupons_period check (starts_at is null or ends_at is null or starts_at < ends_at)')
  })

  it('BR-CPN-003: coupon_redemptions.order_id là UNIQUE (mỗi đơn tối đa 1 coupon)', () => {
    expect(sql).toMatch(/order_id uuid not null unique references public\.orders \(id\)/)
    expect(sql).toContain('create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id)')
  })

  it('claim_coupon / release_coupon trong SQL cùng ngữ nghĩa với adapter bộ nhớ', async () => {
    // SQL: chỉ tăng khi active và còn lượt; trả NULL khi hết
    expect(sql).toMatch(/update public\.coupons[\s\S]*?set used_count = used_count \+ 1[\s\S]*?and status = 'active'[\s\S]*?and \(usage_limit is null or used_count < usage_limit\)/)
    expect(sql).toContain('set used_count = greatest(used_count - 1, 0)')

    const c = await coupon({ code: 'NGUYENTU', type: 'amount', value: 1000, usageLimit: 1 })
    expect(await repo.claimCoupon(c.id)).toBe(1)
    expect(await repo.claimCoupon(c.id)).toBe(null) // hết lượt
    await repo.updateCoupon(c.id, { usageLimit: 5, status: 'disabled' })
    expect(await repo.claimCoupon(c.id)).toBe(null) // coupon bị tắt
  })

  it('T-05: mọi bảng mới đều bật RLS và không có policy công khai', () => {
    for (const t of ['coupons', 'orders', 'order_items', 'coupon_redemptions', 'audit_log']) {
      expect(sql).toContain(`alter table public.${t} enable row level security`)
    }
    expect(sql).not.toMatch(/create policy/)
  })

  it('tiền trong DB là số nguyên không âm; số lượng dòng hàng 1..10', () => {
    for (const col of ['subtotal', 'discount', 'shipping_fee', 'total', 'vat_amount']) {
      expect(sql).toMatch(new RegExp(`${col} integer not null[^,]*check \\(${col} >= 0\\)`))
    }
    expect(sql).toContain('quantity integer not null check (quantity between 1 and 10)')
  })

  it('NFR-AUD-001: nhật ký ghi ai/khi nào/giá trị cũ-mới cho đơn, coupon, hoàn tiền', async () => {
    expect(sql).toMatch(/create table public\.audit_log[\s\S]*?actor_id[\s\S]*?actor_role[\s\S]*?old_value jsonb,\s*new_value jsonb/)
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    const o = await repo.getOrderByCode(r.body.order.code)
    await setStatus(o.code, 'in_production')
    const log = await repo.listAuditLog({ entity: 'order', entityId: o.id })
    expect(log.map((e) => e.action).sort()).toEqual(['create', 'status'])
    for (const e of log) expect(e.at).toEqual(expect.any(String))
    expect(log.find((e) => e.action === 'status')).toMatchObject({
      actorRole: 'admin',
      oldValue: { status: 'confirmed' },
      newValue: { status: 'in_production' },
    })
  })
})

// ---------------------------------------------------------------------------
// Kiểm thử độc lập (T-11) — lấy lại liên kết thanh toán (FR-PAY-001)
// ---------------------------------------------------------------------------
describe('POST /orders/:code/payment — biên và quyền', () => {
  const pay = (code, token = customer) =>
    request(app).post(`/api/orders/${encodeURIComponent(code)}/payment`).set('Authorization', token).send({})

  async function payosOrder() {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos' })
    expect(r.status).toBe(201)
    return r.body.order.code
  }

  it('mã đơn không tồn tại / dị dạng → 404, không phải 500', async () => {
    for (const code of ['KHONG-CO', 'LV2610-ZZZZZZZ', 'a'.repeat(300), '../../etc/passwd', '%%%']) {
      const r = await pay(code)
      expect([404, 400], code).toContain(r.status)
      expect(r.status, code).not.toBe(500)
    }
  })

  it('chưa đăng nhập → 401, không tiết lộ đơn có tồn tại hay không', async () => {
    const code = await payosOrder()
    const r = await request(app).post(`/api/orders/${code}/payment`).send({})
    expect(r.status).toBe(401)
  })

  it('đơn đã huỷ → 409 ORDER_NOT_PAYABLE, không gọi cổng', async () => {
    const code = await payosOrder()
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    payos.createPaymentLink.mockClear()
    const r = await pay(code)
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('ORDER_NOT_PAYABLE')
    expect(payos.createPaymentLink).not.toHaveBeenCalled()
  })

  it('đơn đã thanh toán (CONFIRMED) → 409, không tạo link mới', async () => {
    const code = await payosOrder()
    const o = await repo.getOrderByCode(code)
    await orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'FT1' })
    payos.createPaymentLink.mockClear()
    const r = await pay(code)
    expect(r.status).toBe(409)
    expect(payos.createPaymentLink).not.toHaveBeenCalled()
  })

  it('đơn đang sản xuất (COD đã xác nhận) → 409', async () => {
    await addToCart('den-nguyet', 1)
    const cod = (await createOrder()).body.order.code
    await setStatus(cod, 'in_production')
    expect((await pay(cod)).status).toBe(409)
  })

  it('chưa cấu hình cổng payOS → 503, không 500', async () => {
    const noGateway = createApp({
      repo,
      auth,
      storage: createMemoryStorage(),
      config,
      orders: createOrderService({ repo, now: () => clock }),
    })
    // Đơn payOS tạo ở app có cổng, rồi gọi lại link ở app không có cổng (giống khi mất khoá payOS)
    const code = await payosOrder()
    const r = await request(noGateway).post(`/api/orders/${code}/payment`).set('Authorization', customer).send({})
    expect(r.status).toBe(503)
    expect(r.body.error.code).toBe('PAYMENT_UNAVAILABLE')
  })

  it('lấy lại link nhiều lần: giữ nguyên payosOrderCode và hạn thanh toán (không gia hạn)', async () => {
    const code = await payosOrder()
    const before = await repo.getOrderByCode(code)
    payos.createPaymentLink.mockClear()
    for (let i = 0; i < 3; i += 1) expect((await pay(code)).status).toBe(200)
    const after = await repo.getOrderByCode(code)
    expect(after.payosOrderCode).toBe(before.payosOrderCode)
    expect(after.paymentExpiresAt).toBe(before.paymentExpiresAt)
    // Mọi lần gọi đều dùng cùng orderCode và cùng expiredAt
    const args = payos.createPaymentLink.mock.calls.map(([p]) => p)
    expect(new Set(args.map((p) => p.orderCode)).size).toBe(1)
    expect(new Set(args.map((p) => p.expiredAt)).size).toBe(1)
    expect(args[0].amount).toBe(before.total)
  })

  it('đơn của người khác → 404 và KHÔNG tạo link thanh toán', async () => {
    const code = await payosOrder()
    const other = await login('nguoikhac@lamvi.test')
    payos.createPaymentLink.mockClear()
    expect((await pay(code, other.token)).status).toBe(404)
    expect(payos.createPaymentLink).not.toHaveBeenCalled()
  })

  it('admin cũng không lấy được link của đơn khách (endpoint chỉ dành cho chủ đơn)', async () => {
    const code = await payosOrder()
    expect((await pay(code, admin)).status).toBe(404)
  })

  it('không ghi thêm nhật ký kiểm toán cho mỗi lần lấy lại link', async () => {
    const code = await payosOrder()
    const o = await repo.getOrderByCode(code)
    const before = (await repo.listAuditLog({ entity: 'order', entityId: o.id })).length
    await pay(code)
    await pay(code)
    expect((await repo.listAuditLog({ entity: 'order', entityId: o.id })).length).toBe(before)
  })
})
