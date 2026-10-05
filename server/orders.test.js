// Checkout, đơn hàng, thanh toán (FR-CHK-001…008, FR-ORD-001/002, FR-PAY-001/002, §12, §15, §16).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'
import { signData } from './adapters/payos.js'
import { products } from './data/seed.js'

const CHECKSUM = 'khoa-checksum-thu'
const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }

let app, repo, auth, orders, payos, customer, customerId, admin, adminId, clock

// payOS giả: ghi lại lời gọi, không ra mạng
function fakePayos() {
  return {
    checksumKey: CHECKSUM,
    links: [],
    cancelled: [],
    createPaymentLink: vi.fn(async (p) => {
      payos.links.push(p)
      return { checkoutUrl: `https://pay.test/${p.orderCode}`, paymentLinkId: 'pl1', qrCode: 'QR' }
    }),
    cancelPaymentLink: vi.fn(async (code, reason) => {
      payos.cancelled.push({ code, reason })
    }),
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
  app = createApp({
    repo,
    auth,
    storage: createMemoryStorage(),
    config,
    payos,
    orders,
  })
  const c = await login('khach@lamvi.test')
  customer = c.token
  customerId = c.id
  const a = await login('admin@lamvi.test', 'admin')
  admin = a.token
  adminId = a.id
})

const addToCart = (slug, quantity = 1, token = customer) =>
  request(app).put(`/api/cart/items/${slug}`).set('Authorization', token).send({ quantity })

const CHECKOUT = {
  orderKind: 'self',
  recipientIsSelf: true,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông',
  province: 'Hà Nội',
  district: 'Hoàn Kiếm',
  paymentMethod: 'cod',
}

const createOrder = (over = {}, token = customer) =>
  request(app).post('/api/orders').set('Authorization', token).send({ ...CHECKOUT, ...over })

describe('Bảng giá checkout (FR-CHK-008, BR-PRC-001)', () => {
  it('tính từ giỏ: tạm tính, phí ship, VAT tách ngược từ tổng', async () => {
    await addToCart('den-nguyet', 1)
    const r = await request(app).post('/api/checkout/quote').set('Authorization', customer).send({})
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({
      subtotal: 890_000,
      discount: 0,
      shippingFee: 30_000,
      total: 920_000,
      currency: 'VND',
      freeShipping: false,
    })
    expect(r.body.vatAmount).toBe(Math.round((920_000 * 0.1) / 1.1))
    expect(r.body.items[0]).toMatchObject({ slug: 'den-nguyet', quantity: 1, lineTotal: 890_000 })
  })

  it('D-70: tạm tính ≥ 1.000.000đ → miễn phí ship', async () => {
    await addToCart('den-sum-vay', 1)
    const r = await request(app).post('/api/checkout/quote').set('Authorization', customer).send({})
    expect(r.body).toMatchObject({ subtotal: 1_680_000, shippingFee: 0, freeShipping: true, total: 1_680_000 })
  })

  it('chưa đăng nhập → 401 (FR-CHK-001, D-36)', async () => {
    expect((await request(app).post('/api/checkout/quote').send({})).status).toBe(401)
  })

  it('giỏ rỗng → tổng 0, không thu phí ship', async () => {
    const r = await request(app).post('/api/checkout/quote').set('Authorization', customer).send({})
    expect(r.body).toMatchObject({ subtotal: 0, shippingFee: 0, total: 0, items: [] })
  })
})

describe('Coupon ở checkout (FR-CHK-006, §14)', () => {
  const makeCoupon = (over = {}) =>
    repo.createCoupon({ code: 'TET2026', type: 'percent', value: 10, status: 'active', usedCount: 0, ...over })

  it('mã hợp lệ → giảm giá, mã trả về dạng chữ HOA', async () => {
    await makeCoupon()
    await addToCart('den-nguyet', 1)
    const r = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', customer)
      .send({ couponCode: ' tet2026 ' })
    expect(r.body).toMatchObject({ discount: 89_000, couponCode: 'TET2026', couponError: null })
    expect(r.body.total).toBe(890_000 - 89_000 + 30_000)
  })

  it('mã sai → nêu lý do, KHÔNG giảm, vẫn trả bảng giá để trang hiện được', async () => {
    await addToCart('den-nguyet', 1)
    const r = await request(app).post('/api/checkout/quote').set('Authorization', customer).send({ couponCode: 'SAI' })
    expect(r.status).toBe(200)
    expect(r.body).toMatchObject({ couponError: 'COUPON_NOT_FOUND', discount: 0, couponCode: null })
  })

  it.each([
    ['COUPON_INACTIVE', { status: 'disabled' }],
    ['COUPON_NOT_STARTED', { startsAt: '2026-12-01T00:00:00.000Z' }],
    ['COUPON_EXPIRED', { endsAt: '2026-01-01T00:00:00.000Z' }],
    ['COUPON_USED_UP', { usageLimit: 3, usedCount: 3 }],
    ['COUPON_MIN_ORDER', { minOrder: 5_000_000 }],
  ])('lý do %s', async (reason, over) => {
    await makeCoupon(over)
    await addToCart('den-nguyet', 1)
    const r = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', customer)
      .send({ couponCode: 'TET2026' })
    expect(r.body.couponError).toBe(reason)
  })

  it('C-5: hết lượt của riêng khách này (per_user_limit)', async () => {
    const c = await makeCoupon({ perUserLimit: 1 })
    await addToCart('den-nguyet', 1)
    await createOrder({ couponCode: 'TET2026' })
    await addToCart('den-nguyet', 1)
    const r = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', customer)
      .send({ couponCode: 'TET2026' })
    expect(r.body.couponError).toBe('COUPON_USER_LIMIT')
    expect((await repo.getCouponById(c.id)).usedCount).toBe(1)
  })

  it('C-3: coupon giới hạn sản phẩm khác → không áp được', async () => {
    await makeCoupon({ productIds: [products[1].id] })
    await addToCart('den-nguyet', 1)
    const r = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', customer)
      .send({ couponCode: 'TET2026' })
    expect(r.body.couponError).toBe('COUPON_NOT_APPLICABLE')
  })

  it('free_shipping: miễn phí ship, không giảm tiền hàng', async () => {
    await makeCoupon({ code: 'FREESHIP', type: 'free_shipping', value: 0 })
    await addToCart('den-nguyet', 1)
    const r = await request(app)
      .post('/api/checkout/quote')
      .set('Authorization', customer)
      .send({ couponCode: 'FREESHIP' })
    expect(r.body).toMatchObject({ discount: 0, shippingFee: 0, total: 890_000 })
  })
})

describe('Tạo đơn COD (FR-PAY-002, §15.2)', () => {
  it('đơn COD vào thẳng CONFIRMED, giỏ được dọn, giá chốt vào đơn', async () => {
    await addToCart('den-nguyet', 2)
    const r = await createOrder()
    expect(r.status).toBe(201)
    expect(r.body.order).toMatchObject({
      status: 'confirmed',
      paymentMethod: 'cod',
      paymentStatus: 'pending',
      subtotal: 1_780_000,
      shippingFee: 0,
      total: 1_780_000,
    })
    expect(r.body.order.code).toMatch(/^LV\d{4}-[A-Z0-9]{7}$/)
    expect(r.body.order.items[0]).toMatchObject({ slug: 'den-nguyet', quantity: 2, unitPrice: 890_000 })
    expect(r.body.payment).toBeNull()
    const cart = await request(app).get('/api/cart').set('Authorization', customer)
    expect(cart.body.items).toEqual([])
  })

  it('BR-PRC-002: đổi giá sản phẩm sau khi đặt không ảnh hưởng đơn', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder()
    await request(app)
      .patch(`/api/admin/products/${products[0].id}`)
      .set('Authorization', admin)
      .send({ price: 2_000_000 })
    const after = await request(app).get(`/api/orders/${r.body.order.code}`).set('Authorization', customer)
    expect(after.body.item.items[0].unitPrice).toBe(890_000)
    expect(after.body.item.total).toBe(920_000)
  })

  it('BR-PAY-004: đơn giao người khác không được chọn COD', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ orderKind: 'gift', recipientIsSelf: false, qrLang: 'vi' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.paymentMethod).toBe('COD_NOT_ALLOWED_FOR_GIFT')
  })

  it('giỏ rỗng → 409', async () => {
    const r = await createOrder()
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('CART_EMPTY')
  })

  it('giỏ có sản phẩm đã ẩn → 409, không tạo đơn (D-39)', async () => {
    await addToCart('den-nguyet', 1)
    await request(app)
      .patch(`/api/admin/products/${products[0].id}`)
      .set('Authorization', admin)
      .send({ status: 'hidden' })
    const r = await createOrder()
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('CART_HAS_UNAVAILABLE')
  })

  it('§12: tổng khách xác nhận khác tổng server tính → 409 kèm bảng giá mới', async () => {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ expectedTotal: 1 })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('PRICE_CHANGED')
    expect(r.body.error.details.quote.total).toBe(920_000)
  })

  it('tổng khách xác nhận khớp → tạo đơn bình thường', async () => {
    await addToCart('den-nguyet', 1)
    expect((await createOrder({ expectedTotal: 920_000 })).status).toBe(201)
  })
})

describe('Kiểm tra dữ liệu checkout (§12)', () => {
  beforeEach(() => addToCart('den-nguyet', 1))

  it.each([
    ['recipientPhone', { recipientPhone: '123' }, 'INVALID_PHONE'],
    ['recipientName', { recipientName: '   ' }, 'REQUIRED'],
    ['addressLine', { addressLine: '' }, 'REQUIRED'],
    ['province', { province: '' }, 'REQUIRED'],
    ['paymentMethod', { paymentMethod: 'momo' }, 'INVALID'],
    ['orderKind', { orderKind: 'khac' }, 'INVALID'],
  ])('%s sai → 400 theo trường', async (field, over, code) => {
    const r = await createOrder(over)
    expect(r.status).toBe(400)
    expect(r.body.error.fields[field]).toBe(code)
  })

  it('FR-CHK-005: đơn có lời chúc phải chọn ngôn ngữ trang QR', async () => {
    const r = await createOrder({ orderKind: 'gift', recipientIsSelf: false, paymentMethod: 'payos' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields.qrLang).toBe('INVALID')
  })

  it('BR-MSG-002: đơn tự mua không tích "Thêm lời chúc" → hasMessage false, không cần qrLang', async () => {
    const r = await createOrder()
    expect(r.body.order).toMatchObject({ hasMessage: false, qrLang: null })
  })

  it('đơn tặng luôn có lời chúc, kể cả khi client gửi hasMessage=false', async () => {
    const r = await createOrder({
      orderKind: 'gift',
      recipientIsSelf: false,
      hasMessage: false,
      qrLang: 'en',
      paymentMethod: 'payos',
    })
    expect(r.body.order).toMatchObject({ hasMessage: true, qrLang: 'en' })
  })

  it('số điện thoại có khoảng trắng/gạch được chuẩn hoá', async () => {
    const r = await createOrder({ recipientPhone: '09 1234-5678' })
    expect(r.body.order.recipientPhone).toBe('0912345678')
  })
})

describe('Thanh toán payOS (FR-PAY-001, §15.1)', () => {
  const webhook = (data, key = CHECKSUM) =>
    request(app)
      .post('/api/payments/payos/webhook')
      .send({ code: '00', desc: 'success', data, signature: signData(data, key) })

  async function payosOrder(over = {}) {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos', ...over })
    const stored = await repo.getOrderByCode(r.body.order.code)
    return { res: r, order: stored }
  }

  it('tạo đơn payOS: PENDING_PAYMENT + link thanh toán + hạn 15 phút (D-73)', async () => {
    const { res, order } = await payosOrder()
    expect(res.body.order).toMatchObject({ status: 'pending_payment', paymentStatus: 'pending' })
    expect(res.body.payment.checkoutUrl).toContain('https://pay.test/')
    expect(Date.parse(order.paymentExpiresAt) - clock.getTime()).toBe(PAYMENT_WINDOW_MS)
    expect(payos.links[0]).toMatchObject({ amount: 920_000, orderCode: order.payosOrderCode })
    // payOS giới hạn mô tả 25 ký tự
    expect(payos.links[0].description.length).toBeLessThanOrEqual(25)
  })

  it('BR-PAY-001: webhook PAID hợp lệ → đơn CONFIRMED', async () => {
    const { order } = await payosOrder()
    const r = await webhook({ orderCode: order.payosOrderCode, amount: 920_000, code: '00', reference: 'FT123' })
    expect(r.status).toBe(200)
    const after = await repo.getOrderById(order.id)
    expect(after).toMatchObject({ status: 'confirmed', paymentStatus: 'paid', paymentExpiresAt: null })
  })

  it('NFR-SEC-002: chữ ký sai → 401, đơn không đổi', async () => {
    const { order } = await payosOrder()
    const r = await webhook({ orderCode: order.payosOrderCode, amount: 920_000, code: '00' }, 'khoa-sai')
    expect(r.status).toBe(401)
    expect((await repo.getOrderById(order.id)).status).toBe('pending_payment')
  })

  it('BR-PAY-002: webhook trùng → lần hai không đổi gì', async () => {
    const { order } = await payosOrder()
    const data = { orderCode: order.payosOrderCode, amount: 920_000, code: '00', reference: 'FT1' }
    await webhook(data)
    const first = await repo.getOrderById(order.id)
    const second = await webhook(data)
    expect(second.status).toBe(200)
    expect(await repo.getOrderById(order.id)).toEqual(first)
  })

  it('§15.1: số tiền lệch → không xác nhận đơn, gắn cờ cho admin', async () => {
    const { order } = await payosOrder()
    await webhook({ orderCode: order.payosOrderCode, amount: 100_000, code: '00' })
    const after = await repo.getOrderById(order.id)
    expect(after).toMatchObject({ status: 'pending_payment', paymentFlag: 'AMOUNT_MISMATCH' })
  })

  it('§15.1: trả tiền sau khi đơn đã huỷ → ghi nhận PAID, gắn cờ hoàn tiền tay', async () => {
    const { res, order } = await payosOrder()
    await request(app).post(`/api/orders/${res.body.order.code}/cancel`).set('Authorization', customer).send({})
    await webhook({ orderCode: order.payosOrderCode, amount: 920_000, code: '00' })
    const after = await repo.getOrderById(order.id)
    expect(after).toMatchObject({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
  })

  it('webhook cho mã đơn không tồn tại → 200 nhưng không xử lý', async () => {
    const r = await webhook({ orderCode: 999_999_999, amount: 1000, code: '00' })
    expect(r.status).toBe(200)
    expect(r.body.handled).toBe(false)
  })

  it('BR-PAY-003: quá hạn → CANCELLED, trả lượt coupon, huỷ link payOS', async () => {
    const c = await repo.createCoupon({ code: 'TET2026', type: 'percent', value: 10, status: 'active', usedCount: 0 })
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos', couponCode: 'TET2026' })
    expect((await repo.getCouponById(c.id)).usedCount).toBe(1)

    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1000)
    const view = await request(app).get(`/api/orders/${r.body.order.code}`).set('Authorization', customer)
    expect(view.body.item).toMatchObject({ status: 'cancelled', paymentStatus: 'expired' })
    expect((await repo.getCouponById(c.id)).usedCount).toBe(0)
    expect(payos.cancelled).toHaveLength(1)
  })

  it('endpoint cron quét đơn quá hạn: cần đúng secret', async () => {
    await addToCart('den-nguyet', 1)
    await createOrder({ paymentMethod: 'payos' })
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1000)

    expect((await request(app).post('/api/internal/expire-orders')).status).toBe(401)
    expect(
      (await request(app).post('/api/internal/expire-orders').set('Authorization', 'Bearer sai')).status,
    ).toBe(401)
    // Vercel Cron gọi bằng GET
    const ok = await request(app).get('/api/internal/expire-orders').set('Authorization', 'Bearer bimat-cron')
    expect(ok.status).toBe(200)
    expect(ok.body.cancelled).toBe(1)
  })
})

describe('Đơn của tôi & huỷ đơn (FR-ACC-002, FR-ORD-001)', () => {
  it('chỉ thấy đơn của mình; đơn người khác → 404', async () => {
    await addToCart('den-nguyet', 1)
    const mine = await createOrder()
    const other = await login('khac@lamvi.test')
    const list = await request(app).get('/api/orders').set('Authorization', other.token)
    expect(list.body.items).toEqual([])
    const detail = await request(app).get(`/api/orders/${mine.body.order.code}`).set('Authorization', other.token)
    expect(detail.status).toBe(404)
  })

  it('BR-ORD-001: huỷ được trước SHIPPED, sau SHIPPED thì không', async () => {
    await addToCart('den-nguyet', 1)
    const { body } = await createOrder()
    const code = body.order.code

    const cancelled = await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    expect(cancelled.status).toBe(200)
    expect(cancelled.body.item.status).toBe('cancelled')

    // Đơn khác, đẩy tới SHIPPED rồi thử huỷ
    await addToCart('den-nguyet', 1)
    const second = (await createOrder()).body.order.code
    for (const status of ['in_production', 'packed', 'shipped']) {
      const r = await request(app)
        .post(`/api/admin/orders/${second}/status`)
        .set('Authorization', admin)
        .send({ status })
      expect(r.status, status).toBe(200)
    }
    const late = await request(app).post(`/api/orders/${second}/cancel`).set('Authorization', customer).send({})
    expect(late.status).toBe(409)
    expect(late.body.error.code).toBe('ORDER_NOT_CANCELLABLE')
  })

  it('huỷ đơn đã thanh toán → chờ hoàn tiền (D-74)', async () => {
    await addToCart('den-nguyet', 1)
    const { body } = await createOrder({ paymentMethod: 'payos' })
    const stored = await repo.getOrderByCode(body.order.code)
    await request(app)
      .post('/api/payments/payos/webhook')
      .send({
        code: '00',
        data: { orderCode: stored.payosOrderCode, amount: 920_000, code: '00' },
        signature: signData({ orderCode: stored.payosOrderCode, amount: 920_000, code: '00' }, CHECKSUM),
      })
    const r = await request(app).post(`/api/orders/${body.order.code}/cancel`).set('Authorization', customer).send({})
    expect(r.body.item).toMatchObject({ status: 'cancelled', paymentStatus: 'refund_pending' })
  })

  it('huỷ hai lần → lần hai vẫn 200, không đổi gì', async () => {
    await addToCart('den-nguyet', 1)
    const code = (await createOrder()).body.order.code
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    const again = await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    expect(again.status).toBe(200)
  })

  it('không lộ trường nội bộ (userId, payosOrderCode, paymentFlag)', async () => {
    await addToCart('den-nguyet', 1)
    const { body } = await createOrder({ paymentMethod: 'payos' })
    for (const k of ['userId', 'payosOrderCode', 'paymentFlag', 'couponId', 'id']) {
      expect(body.order, k).not.toHaveProperty(k)
    }
  })
})

describe('Admin — đơn hàng (FR-ORD-002, §16)', () => {
  let code

  beforeEach(async () => {
    await addToCart('den-nguyet', 1)
    code = (await createOrder()).body.order.code
  })

  it('khách không gọi được API admin', async () => {
    expect((await request(app).get('/api/admin/orders').set('Authorization', customer)).status).toBe(403)
  })

  it('đi đúng luồng §16 và gợi ý trạng thái kế tiếp', async () => {
    const list = await request(app).get('/api/admin/orders').set('Authorization', admin)
    expect(list.body.items[0].nextStatuses).toEqual(['in_production', 'cancelled'])

    for (const [status, next] of [
      ['in_production', ['packed', 'cancelled']],
      ['packed', ['shipped', 'cancelled']],
      ['shipped', ['delivered', 'delivery_failed']],
      ['delivered', []],
    ]) {
      const r = await request(app)
        .post(`/api/admin/orders/${code}/status`)
        .set('Authorization', admin)
        .send({ status })
      expect(r.status, status).toBe(200)
      expect(r.body.item.nextStatuses).toEqual(next)
    }
  })

  it('bước nhảy không hợp lệ → 409', async () => {
    const r = await request(app)
      .post(`/api/admin/orders/${code}/status`)
      .set('Authorization', admin)
      .send({ status: 'delivered' })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('INVALID_STATUS_TRANSITION')
  })

  it('mã vận đơn nhập tay lưu cùng lúc chuyển SHIPPED (§17)', async () => {
    await request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin).send({ status: 'in_production' })
    await request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin).send({ status: 'packed' })
    const r = await request(app)
      .post(`/api/admin/orders/${code}/status`)
      .set('Authorization', admin)
      .send({ status: 'shipped', trackingCode: 'GHN123456' })
    expect(r.body.item.trackingCode).toBe('GHN123456')
  })

  it('NFR-AUD-001: mọi lần đổi trạng thái được ghi nhật ký kèm ai và giá trị cũ/mới', async () => {
    await request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin).send({ status: 'in_production' })
    const r = await request(app).get(`/api/admin/orders/${code}`).set('Authorization', admin)
    const statusLog = r.body.audit.find((e) => e.action === 'status')
    expect(statusLog).toMatchObject({
      actorId: adminId,
      actorRole: 'admin',
      oldValue: { status: 'confirmed' },
    })
    expect(statusLog.newValue.status).toBe('in_production')
    expect(r.body.audit.some((e) => e.action === 'create' && e.actorId === customerId)).toBe(true)
  })

  it('D-74: hoàn tiền thủ công chỉ ghi nhận được khi đơn đang chờ hoàn', async () => {
    const early = await request(app).post(`/api/admin/orders/${code}/refund`).set('Authorization', admin).send({})
    expect(early.status).toBe(409)
    expect(early.body.error.code).toBe('REFUND_NOT_PENDING')
  })
})

describe('Admin — coupon (FR-CPN-001, §14)', () => {
  const create = (b) => request(app).post('/api/admin/coupons').set('Authorization', admin).send(b)

  it('tạo coupon %: mã về chữ HOA', async () => {
    const r = await create({ code: 'tet2026', type: 'percent', value: 15, maxDiscount: 200_000 })
    expect(r.status).toBe(201)
    expect(r.body.item).toMatchObject({ code: 'TET2026', type: 'percent', value: 15, usedCount: 0, status: 'active' })
  })

  it.each([
    [{ code: 'A', type: 'percent', value: 10 }, 'code', 'INVALID_CODE'],
    [{ code: 'TET2026', type: 'percent', value: 0 }, 'value', 'INVALID_PERCENT'],
    [{ code: 'TET2026', type: 'percent', value: 101 }, 'value', 'INVALID_PERCENT'],
    [{ code: 'TET2026', type: 'amount', value: 0 }, 'value', 'INVALID_AMOUNT'],
    [{ code: 'TET2026', type: 'khac', value: 1 }, 'type', 'INVALID'],
    [{ code: 'TET2026', type: 'amount', value: 1000, maxDiscount: 500 }, 'maxDiscount', 'ONLY_FOR_PERCENT'],
    [
      { code: 'TET2026', type: 'percent', value: 10, startsAt: '2026-12-01', endsAt: '2026-11-01' },
      'endsAt',
      'END_BEFORE_START',
    ],
  ])('dữ liệu sai → 400 theo trường', async (b, field, code) => {
    const r = await create(b)
    expect(r.status).toBe(400)
    expect(r.body.error.fields[field]).toBe(code)
  })

  it('trùng mã → 409', async () => {
    await create({ code: 'TET2026', type: 'percent', value: 10 })
    const r = await create({ code: 'tet2026', type: 'amount', value: 50_000 })
    expect(r.status).toBe(409)
  })

  it('coupon đã dùng thì không xoá được, chỉ tắt', async () => {
    const c = await create({ code: 'TET2026', type: 'percent', value: 10 })
    await addToCart('den-nguyet', 1)
    await createOrder({ couponCode: 'TET2026' })
    const del = await request(app).delete(`/api/admin/coupons/${c.body.item.id}`).set('Authorization', admin)
    expect(del.status).toBe(409)
    expect(del.body.error.code).toBe('COUPON_IN_USE')

    const off = await request(app)
      .patch(`/api/admin/coupons/${c.body.item.id}`)
      .set('Authorization', admin)
      .send({ status: 'disabled' })
    expect(off.body.item.status).toBe('disabled')
  })

  it('NFR-AUD-001: sửa coupon được ghi nhật ký', async () => {
    const c = await create({ code: 'TET2026', type: 'percent', value: 10 })
    await request(app)
      .patch(`/api/admin/coupons/${c.body.item.id}`)
      .set('Authorization', admin)
      .send({ value: 20 })
    const log = await repo.listAuditLog({ entity: 'coupon', entityId: c.body.item.id })
    expect(log.some((e) => e.action === 'update' && e.newValue.value === 20)).toBe(true)
  })

  it('khách không gọi được', async () => {
    expect((await request(app).get('/api/admin/coupons').set('Authorization', customer)).status).toBe(403)
  })
})

describe('Lấy lại liên kết thanh toán (FR-PAY-001)', () => {
  async function pendingOrder() {
    await addToCart('den-nguyet', 1)
    const r = await createOrder({ paymentMethod: 'payos' })
    return r.body.order.code
  }

  it('đơn đang chờ thanh toán → trả link mới', async () => {
    const code = await pendingOrder()
    const r = await request(app).post(`/api/orders/${code}/payment`).set('Authorization', customer).send({})
    expect(r.status).toBe(200)
    expect(r.body.payment.checkoutUrl).toContain('https://pay.test/')
    // Gọi lại lần nữa vẫn được (khách đóng tab payOS rồi quay lại)
    expect((await request(app).post(`/api/orders/${code}/payment`).set('Authorization', customer).send({})).status).toBe(200)
  })

  it('lần tạo đơn gặp lỗi cổng → đơn vẫn tồn tại và lấy lại được link sau đó', async () => {
    payos.createPaymentLink.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'PAYMENT_GATEWAY_ERROR' }))
    await addToCart('den-nguyet', 1)
    const created = await createOrder({ paymentMethod: 'payos' })
    expect(created.status).toBe(201)
    expect(created.body.payment).toMatchObject({ error: 'PAYMENT_GATEWAY_ERROR' })

    const retry = await request(app)
      .post(`/api/orders/${created.body.order.code}/payment`)
      .set('Authorization', customer)
      .send({})
    expect(retry.status).toBe(200)
    expect(retry.body.payment.checkoutUrl).toBeTruthy()
  })

  it('cổng vẫn lỗi → 502, không trả link rỗng', async () => {
    const code = await pendingOrder()
    payos.createPaymentLink.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'PAYMENT_GATEWAY_ERROR' }))
    const r = await request(app).post(`/api/orders/${code}/payment`).set('Authorization', customer).send({})
    expect(r.status).toBe(502)
    expect(r.body.error.code).toBe('PAYMENT_GATEWAY_ERROR')
  })

  it('đơn COD hoặc đã thanh toán → 409', async () => {
    await addToCart('den-nguyet', 1)
    const cod = (await createOrder()).body.order.code
    const r = await request(app).post(`/api/orders/${cod}/payment`).set('Authorization', customer).send({})
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('ORDER_NOT_PAYABLE')
  })

  it('đơn quá hạn → huỷ đơn và 409, không sinh link mới', async () => {
    const code = await pendingOrder()
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1000)
    const r = await request(app).post(`/api/orders/${code}/payment`).set('Authorization', customer).send({})
    expect(r.status).toBe(409)
    expect((await repo.getOrderByCode(code)).status).toBe('cancelled')
  })

  it('đơn của người khác → 404', async () => {
    const code = await pendingOrder()
    const other = await login('khac2@lamvi.test')
    expect((await request(app).post(`/api/orders/${code}/payment`).set('Authorization', other.token).send({})).status).toBe(404)
  })
})
