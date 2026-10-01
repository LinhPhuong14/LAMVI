// Kiểm thử độc lập (T-11): checkout / đơn hàng / coupon / payOS — phần server.
// Đặc tả: docs/ba-spec.md §11–§17, §24 (BR-PRC/CPN/PAY/ORD/SHP), §25 US-001/US-002; quyết định D-62…D-72.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createFakePayos } from './payments/fakePayos.js'
import { signData } from './payments/payos.js'
import { createOrderService } from './orders/service.js'
import { DEFAULT_SHOP, codAllowed, loadShopConfig, priceOrder } from './orders/pricing.js'
import { couponProblem, validateCoupon } from './orders/coupons.js'

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
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

const recipient = { name: 'Nguyễn An', phone: '0912 345 678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' }
let keyN = 0
const newKey = () => `xkey-${Date.now()}-${keyN++}`
const addToCart = (slug, quantity, t = buyer) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', t).send({ quantity }).expect(200)
const quote = (body = {}, t = buyer) => request(app).post('/api/checkout/quote').set('Authorization', t).send(body)
const checkout = (over = {}, t = buyer) =>
  request(app)
    .post('/api/orders')
    .set('Authorization', t)
    .send({ orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'cod', clientKey: newKey(), ...over })
async function placeOrder(over = {}, t = buyer) {
  const q = await quote({ couponCode: over.couponCode, recipientType: over.recipientType ?? 'self' }, t)
  return checkout({ expectedTotal: q.body.pricing.total, ...over }, t)
}
const adminAct = (id, action, body = {}) => request(app).post(`/api/admin/orders/${id}/actions/${action}`).set('Authorization', admin).send(body)
const coupon = (body) => request(app).post('/api/admin/coupons').set('Authorization', admin).send(body)
const webhook = (body) => request(app).post('/api/payments/payos/webhook').send(body)
const getOrder = (id, t = buyer) => request(app).get(`/api/orders/${id}`).set('Authorization', t)
const setPrice = async (slug, priceExclVat) => repo.updateProduct((await repo.getProductBySlug(slug)).id, { priceExclVat })

async function payosOrder(over = {}, slug = 'den-nguyet') {
  await addToCart(slug, 1)
  const res = await placeOrder({ paymentMethod: 'payos', ...over })
  expect(res.status).toBe(201)
  return res.body.order
}
// Webhook ký đúng với dữ liệu tuỳ ý
function signed(data, top = { code: '00', desc: 'success', success: true }) {
  return { ...top, data, signature: signData(data, payments.checksumKey) }
}

// ---------------------------------------------------------------------------
describe('Tính giá — biên & làm tròn (§13, D-62, D-63, D-65…D-67)', () => {
  const L = (productId, unitPrice, quantity = 1) => ({ productId, unitPrice, quantity })

  it('VAT làm tròn half-up một lần trên (tạm tính − giảm giá); không tính trên phí ship', () => {
    const p = priceOrder({ lines: [L('a', 890005)], shop: DEFAULT_SHOP })
    expect(p.vat).toBe(89001) // 89000.5 → 89001
    expect(p.total).toBe(890005 + 30000 + 89001)
    const q = priceOrder({ lines: [L('a', 890004)], shop: DEFAULT_SHOP })
    expect(q.vat).toBe(89000) // 89000.4 → 89000
  })

  it('coupon % làm tròn tới đồng; VAT tính trên phần sau giảm', () => {
    const p = priceOrder({ lines: [L('a', 890005)], coupon: { type: 'percent', value: 15, productIds: null }, shop: DEFAULT_SHOP })
    expect(p.discount).toBe(133501) // 133500.75
    expect(p.vat).toBe(Math.round((890005 - 133501) * 0.1))
    expect(Number.isInteger(p.total)).toBe(true)
  })

  it('ngưỡng miễn ship: đúng bằng 1.500.000 → miễn; thiếu 1đ → 30.000', () => {
    expect(priceOrder({ lines: [L('a', 1_500_000)], shop: DEFAULT_SHOP }).shippingFee).toBe(0)
    expect(priceOrder({ lines: [L('a', 1_499_999)], shop: DEFAULT_SHOP }).shippingFee).toBe(30000)
    expect(priceOrder({ lines: [L('a', 500_000, 3)], shop: DEFAULT_SHOP }).shippingFee).toBe(0)
  })

  it('freeShippingFrom = null → không bao giờ miễn ship (trừ coupon miễn ship)', () => {
    const shop = { ...DEFAULT_SHOP, freeShippingFrom: null }
    expect(priceOrder({ lines: [L('a', 9_000_000)], shop }).shippingFee).toBe(30000)
    expect(priceOrder({ lines: [L('a', 9_000_000)], coupon: { type: 'free_shipping', value: 0, productIds: null }, shop }).shippingFee).toBe(0)
  })

  it('giảm giá không trừ vào phí ship: coupon số tiền lớn hơn tiền hàng → tổng = ship', () => {
    const p = priceOrder({ lines: [L('a', 100_000)], coupon: { type: 'amount', value: 500_000, productIds: null }, shop: DEFAULT_SHOP })
    expect(p).toMatchObject({ discount: 100_000, vat: 0, shippingFee: 30000, total: 30000 })
  })

  it('coupon 100% → tiền hàng 0, VAT 0, vẫn trả ship', () => {
    const p = priceOrder({ lines: [L('a', 890000)], coupon: { type: 'percent', value: 100, productIds: null }, shop: DEFAULT_SHOP })
    expect(p).toMatchObject({ discount: 890000, vat: 0, total: 30000 })
  })

  it('coupon số tiền theo sản phẩm chỉ giảm tối đa bằng tiền các dòng áp dụng', () => {
    const lines = [L('a', 100_000, 2), L('b', 1_000_000)]
    const p = priceOrder({ lines, coupon: { type: 'amount', value: 500_000, productIds: ['a'] }, shop: DEFAULT_SHOP })
    expect(p.discount).toBe(200_000)
  })

  it('miễn ship tính theo tạm tính TRƯỚC giảm giá [ASSUMPTION — chưa ghi trong spec]', () => {
    const p = priceOrder({ lines: [L('a', 1_600_000)], coupon: { type: 'amount', value: 200_000, productIds: null }, shop: DEFAULT_SHOP })
    expect(p.shippingFee).toBe(0)
  })

  it('COD: tổng đúng bằng mức tối đa được phép; vượt 1đ bị chặn; mức null = không giới hạn (D-71)', () => {
    expect(codAllowed({ recipientType: 'self', total: 5_000_000, shop: DEFAULT_SHOP }).allowed).toBe(true)
    expect(codAllowed({ recipientType: 'self', total: 5_000_001, shop: DEFAULT_SHOP }).reason).toBe('COD_OVER_LIMIT')
    expect(codAllowed({ recipientType: 'self', total: 1e9, shop: { ...DEFAULT_SHOP, codMaxTotal: null } }).allowed).toBe(true)
    expect(codAllowed({ recipientType: 'other', total: 1, shop: DEFAULT_SHOP }).reason).toBe('COD_RECIPIENT_OTHER')
  })

  it('cấu hình lưu hỏng (chuỗi, số âm, số lẻ) → rơi về mặc định', async () => {
    await repo.setSetting('shop', { shippingFee: '1000', freeShippingFrom: -5, codMaxTotal: 1.5 }, null)
    expect(await loadShopConfig(repo)).toEqual(DEFAULT_SHOP)
  })
})

// ---------------------------------------------------------------------------
describe('Coupon — hiệu lực & biên (§14, BR-CPN-001/002)', () => {
  const lines = [{ productId: 'a', unitPrice: 1_000_000, quantity: 1 }]
  const base = { status: 'active', type: 'amount', value: 1000, productIds: null }
  const uses = { total: 0, byUser: 0 }

  it('startsAt ≤ now < endsAt: đúng mốc bắt đầu là hợp lệ; đúng mốc kết thúc là hết hạn', () => {
    const c = { ...base, startsAt: '2026-10-01T03:00:00.000Z', endsAt: '2026-10-02T03:00:00.000Z' }
    expect(couponProblem(c, { now: '2026-10-01T02:59:59.999Z', lines, subtotal: 1e6, uses })).toEqual({ code: 'COUPON_NOT_STARTED' })
    expect(couponProblem(c, { now: '2026-10-01T03:00:00.000Z', lines, subtotal: 1e6, uses })).toBeNull()
    expect(couponProblem(c, { now: '2026-10-02T02:59:59.999Z', lines, subtotal: 1e6, uses })).toBeNull()
    expect(couponProblem(c, { now: '2026-10-02T03:00:00.000Z', lines, subtotal: 1e6, uses })).toEqual({ code: 'COUPON_EXPIRED' })
  })

  it('minOrder: tạm tính đúng bằng mức là hợp lệ', () => {
    const c = { ...base, minOrder: 1_000_000 }
    expect(couponProblem(c, { now: 'x', lines, subtotal: 1_000_000, uses })).toBeNull()
    expect(couponProblem(c, { now: 'x', lines, subtotal: 999_999, uses })).toMatchObject({ code: 'COUPON_MIN_ORDER' })
  })

  it('giới hạn lượt: used == limit → hết; used = limit − 1 → còn', () => {
    const c = { ...base, usageLimit: 3, perUserLimit: 2 }
    expect(couponProblem(c, { now: 'x', lines, subtotal: 1e6, uses: { total: 2, byUser: 1 } })).toBeNull()
    expect(couponProblem(c, { now: 'x', lines, subtotal: 1e6, uses: { total: 3, byUser: 0 } })).toEqual({ code: 'COUPON_USED_UP' })
    expect(couponProblem(c, { now: 'x', lines, subtotal: 1e6, uses: { total: 2, byUser: 2 } })).toEqual({ code: 'COUPON_USER_LIMIT' })
  })

  it('qua HTTP: coupon bắt đầu đúng thời điểm hiện tại dùng được; chưa tới giờ → tạo đơn bị chặn', async () => {
    await coupon({ code: 'DUNG-GIO', type: 'amount', value: 10000, startsAt: new Date(clock).toISOString() }).expect(201)
    await coupon({ code: 'CHUA-TOI', type: 'amount', value: 10000, startsAt: new Date(clock + 1000).toISOString() }).expect(201)
    await addToCart('den-nguyet', 1)
    expect((await quote({ couponCode: 'dung-gio' })).body.couponError).toBeNull()
    const q = await quote({})
    const res = await checkout({ couponCode: 'CHUA-TOI', expectedTotal: q.body.pricing.total })
    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('COUPON_NOT_STARTED')
  })

  it('mã: chữ thường + khoảng trắng/tab đầu cuối được chuẩn hoá; khoảng trắng giữa, mã rất dài, kiểu sai → không vỡ', async () => {
    await coupon({ code: 'GIAM-10', type: 'percent', value: 10 }).expect(201)
    await addToCart('den-nguyet', 1)
    expect((await quote({ couponCode: '\t giam-10 \n' })).body.coupon).toMatchObject({ code: 'GIAM-10' })
    expect((await quote({ couponCode: 'GIAM 10' })).body.couponError).toEqual({ code: 'COUPON_INVALID' })
    const long = 'A'.repeat(10_000)
    const ql = await quote({ couponCode: long })
    expect(ql.status).toBe(200)
    expect(ql.body.couponError).toEqual({ code: 'COUPON_INVALID' })
    expect((await quote({ couponCode: { $ne: null } })).body.couponError).toBeNull()
    const base0 = (await quote({})).body.pricing.total
    expect((await checkout({ couponCode: long, expectedTotal: base0 })).body.error.code).toBe('COUPON_INVALID')
    const bad = await checkout({ couponCode: ['GIAM-10'], expectedTotal: base0 })
    expect(bad.status).toBe(400)
    expect(bad.body.error.fields).toEqual({ couponCode: 'INVALID' })
    // couponCode rỗng/khoảng trắng = không dùng coupon
    expect((await checkout({ couponCode: '   ', expectedTotal: base0 })).status).toBe(201)
  })

  it('coupon đang tắt trả cùng lỗi với mã không tồn tại (không dò được mã)', async () => {
    await coupon({ code: 'TAT', type: 'amount', value: 1000, status: 'inactive' }).expect(201)
    await addToCart('den-nguyet', 1)
    expect((await quote({ couponCode: 'TAT' })).body.couponError).toEqual((await quote({ couponCode: 'KHONG-CO' })).body.couponError)
  })

  it('quote chỉ trả thông tin coupon cho khách (không lộ giới hạn lượt / ghi chú / danh sách sản phẩm)', async () => {
    await coupon({ code: 'BI-MAT', type: 'percent', value: 10, usageLimit: 5, perUserLimit: 1, note: 'chỉ cho KOL', minOrder: 1 }).expect(201)
    await addToCart('den-nguyet', 1)
    const c = (await quote({ couponCode: 'BI-MAT' })).body.coupon
    expect(Object.keys(c).sort()).toEqual(['code', 'maxDiscount', 'scoped', 'type', 'value'])
  })

  it('coupon miễn ship theo sản phẩm: giỏ không có sản phẩm đó → không áp; có → ship = 0 (D-65, D-67)', async () => {
    const vong = await repo.getProductBySlug('den-vong')
    await coupon({ code: 'SHIP-VONG', type: 'free_shipping', productIds: [vong.id.toUpperCase()] }).expect(201)
    await addToCart('den-nguyet', 1)
    expect((await quote({ couponCode: 'SHIP-VONG' })).body.couponError).toEqual({ code: 'COUPON_NOT_APPLICABLE' })
    await setPrice('den-vong', 100_000)
    await addToCart('den-vong', 1)
    const q = await quote({ couponCode: 'SHIP-VONG' })
    expect(q.body.couponError).toBeNull()
    expect(q.body.pricing).toMatchObject({ subtotal: 990_000, discount: 0, shippingFeeBeforeDiscount: 30000, shippingFee: 0, vat: 99_000, total: 1_089_000 })
  })

  it('coupon miễn ship khi đơn đã được miễn ship: không giảm gì thêm, vẫn tính lượt', async () => {
    await coupon({ code: 'FS', type: 'free_shipping', usageLimit: 1 }).expect(201)
    await addToCart('den-sum-vay', 1)
    const o = await placeOrder({ couponCode: 'FS' })
    expect(o.body.order).toMatchObject({ couponCode: 'FS', shippingFee: 0, discount: 0 })
  })

  it('đơn payOS hết hạn → lượt coupon được trả (US-002 AC-004, D-69)', async () => {
    await coupon({ code: 'MOT', type: 'amount', value: 50000, usageLimit: 1 }).expect(201)
    const order = await payosOrder({ couponCode: 'MOT' })
    const other = await login('binh@moc.test')
    await addToCart('den-nguyet', 1, other)
    expect((await quote({ couponCode: 'MOT' }, other)).body.couponError).toEqual({ code: 'COUPON_USED_UP' })
    clock += 15 * 60 * 1000
    await orders.sweepExpired()
    expect((await repo.getOrderById(order.id)).status).toBe('CANCELLED')
    expect((await quote({ couponCode: 'MOT' }, other)).body.couponError).toBeNull()
  })

  it('tạo đơn đồng thời vượt usageLimit: chỉ một đơn thành công, đơn kia 409 COUPON_USED_UP', async () => {
    await coupon({ code: 'DUA', type: 'amount', value: 50000, usageLimit: 1 }).expect(201)
    const other = await login('binh@moc.test')
    await addToCart('den-nguyet', 1)
    await addToCart('den-nguyet', 1, other)
    const qa = await quote({ couponCode: 'DUA' })
    const qb = await quote({ couponCode: 'DUA' }, other)
    const [a, b] = await Promise.all([
      checkout({ couponCode: 'DUA', expectedTotal: qa.body.pricing.total }),
      checkout({ couponCode: 'DUA', expectedTotal: qb.body.pricing.total }, other),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect([a, b].find((r) => r.status === 409).body.error.code).toBe('COUPON_USED_UP')
    expect((await repo.listOrders()).filter((o) => o.couponCode === 'DUA')).toHaveLength(1)
  })

  it('cùng một user đặt đồng thời 2 đơn (khác clientKey) với coupon perUserLimit=1 → chỉ 1 đơn', async () => {
    await coupon({ code: 'MOI-NGUOI', type: 'amount', value: 50000, perUserLimit: 1 }).expect(201)
    await addToCart('den-nguyet', 1)
    const q = await quote({ couponCode: 'MOI-NGUOI' })
    const [a, b] = await Promise.all([
      checkout({ couponCode: 'MOI-NGUOI', expectedTotal: q.body.pricing.total }),
      checkout({ couponCode: 'MOI-NGUOI', expectedTotal: q.body.pricing.total }),
    ])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    // Request thứ hai có thể tới sau khi giỏ đã bị xoá (CART_EMPTY) — điều quan trọng là chỉ một đơn dùng coupon
    expect(['COUPON_USER_LIMIT', 'CART_EMPTY']).toContain([a, b].find((r) => r.status === 409).body.error.code)
    expect((await repo.listOrders()).filter((o) => o.couponCode === 'MOI-NGUOI')).toHaveLength(1)
  })

  it('service: 2 lời gọi tạo đơn xen kẽ của cùng user, perUserLimit=1 → kiểm tra lại ở repo chặn đơn thứ hai', async () => {
    await coupon({ code: 'XEN', type: 'amount', value: 50000, perUserLimit: 1 }).expect(201)
    await addToCart('den-nguyet', 1)
    const q = await quote({ couponCode: 'XEN' })
    const userId = (await auth.getUser(buyer.slice(7))).id
    const body = (k) => ({ orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'cod', clientKey: k, couponCode: 'XEN', expectedTotal: q.body.pricing.total })
    const rs = await Promise.allSettled([orders.create(userId, body('xen-key-0001'), 'vi'), orders.create(userId, body('xen-key-0002'), 'vi')])
    expect(rs.map((r) => r.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(rs.find((r) => r.status === 'rejected').reason.code).toBe('COUPON_USER_LIMIT')
    expect((await repo.listOrders()).filter((o) => o.couponCode === 'XEN')).toHaveLength(1)
  })

  it('admin: mã 31 ký tự, productIds không phải UUID, rỗng → lỗi; đổi percent→amount mà còn trần → lỗi', async () => {
    expect((await coupon({ code: 'A'.repeat(31), type: 'amount', value: 1 })).body.error.fields).toEqual({ code: 'INVALID_COUPON_CODE' })
    expect((await coupon({ code: 'A'.repeat(30), type: 'amount', value: 1 })).status).toBe(201)
    expect((await coupon({ code: 'P1', type: 'amount', value: 1, productIds: ['abc'] })).body.error.fields).toEqual({ productIds: 'INVALID' })
    expect((await coupon({ code: 'P2', type: 'amount', value: 1, productIds: [] })).body.error.fields).toEqual({ productIds: 'INVALID' })
    expect((await coupon({ code: 'P3', type: 'amount', value: 1.5 })).body.error.fields).toEqual({ value: 'INVALID' })
    const pc = await coupon({ code: 'PC', type: 'percent', value: 10, maxDiscount: 100000 })
    const patch = await request(app).patch(`/api/admin/coupons/${pc.body.item.id}`).set('Authorization', admin).send({ type: 'amount', value: 5000 })
    expect(patch.body.error.fields).toEqual({ maxDiscount: 'ONLY_FOR_PERCENT' })
    expect((await request(app).patch('/api/admin/coupons/khong-co').set('Authorization', admin).send({ status: 'inactive' })).status).toBe(404)
  })

  it('validateCoupon: ngày không hợp lệ, usageLimit 0, note quá dài', () => {
    const { errors } = validateCoupon({ code: 'X', type: 'amount', value: 1, startsAt: 'hôm qua', usageLimit: 0, note: 'x'.repeat(301) })
    expect(errors).toEqual({ startsAt: 'INVALID_DATE', usageLimit: 'INVALID', note: 'TOO_LONG' })
  })

  it('admin: số lượt "used" giảm khi đơn bị huỷ (D-68)', async () => {
    const c = await coupon({ code: 'DEM', type: 'amount', value: 1000 })
    await addToCart('den-nguyet', 1)
    const o = await placeOrder({ couponCode: 'DEM' })
    const used = async () => (await request(app).get('/api/admin/coupons').set('Authorization', admin)).body.items.find((x) => x.id === c.body.item.id).used
    expect(await used()).toBe(1)
    await request(app).post(`/api/orders/${o.body.order.id}/cancel`).set('Authorization', buyer).expect(200)
    expect(await used()).toBe(0)
  })
})

// ---------------------------------------------------------------------------
describe('Checkout — kiểm tra dữ liệu (§12, §17, BR-SHP-001)', () => {
  beforeEach(async () => {
    await addToCart('den-nguyet', 1)
  })

  it('SĐT VN: +84 / 84 / dấu chấm, gạch được chuẩn hoá; đầu số sai, thiếu số → INVALID_PHONE', async () => {
    for (const [phone, ok] of [
      ['+84 912 345 678', '0912345678'],
      ['84912345678', '0912345678'],
      ['091.234.5678', '0912345678'],
      ['0312-345-678', '0312345678'],
    ]) {
      const r = await placeOrder({ recipient: { ...recipient, phone } })
      expect(r.status, phone).toBe(201)
      expect(r.body.order.recipient.phone).toBe(ok)
      await addToCart('den-nguyet', 1)
    }
    for (const phone of ['0212345678', '091234567', '09123456789', '+1 912 345 678', 912345678, 'abc']) {
      const r = await placeOrder({ recipient: { ...recipient, phone } })
      expect(r.status, String(phone)).toBe(400)
      expect(r.body.error.fields['recipient.phone']).toBe('INVALID_PHONE')
    }
  })

  it('độ dài: tên 100 ký tự được, 101 → TOO_LONG; đường 201 → TOO_LONG; chỉ khoảng trắng → REQUIRED', async () => {
    const r1 = await placeOrder({ recipient: { ...recipient, name: 'a'.repeat(100) } })
    expect(r1.status).toBe(201)
    await addToCart('den-nguyet', 1)
    const r2 = await placeOrder({ recipient: { ...recipient, name: 'a'.repeat(101), street: 'b'.repeat(201), ward: '   ', district: 123 } })
    expect(r2.body.error.fields).toEqual({ 'recipient.name': 'TOO_LONG', 'recipient.street': 'TOO_LONG', 'recipient.ward': 'REQUIRED', 'recipient.district': 'REQUIRED' })
  })

  it('khoảng trắng thừa trong địa chỉ được gộp; trường lạ trong recipient bị bỏ', async () => {
    const r = await placeOrder({ recipient: { ...recipient, name: '  Nguyễn   An ', extra: '<script>', isAdmin: true } })
    expect(r.body.order.recipient).toEqual({ name: 'Nguyễn An', phone: '0912345678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' })
  })

  it('recipient là mảng / null / chuỗi → báo thiếu từng trường, không 500', async () => {
    for (const rec of [[], null, 'abc']) {
      const r = await placeOrder({ recipient: rec })
      expect(r.status).toBe(400)
      expect(Object.keys(r.body.error.fields).sort()).toEqual(
        ['recipient.district', 'recipient.name', 'recipient.phone', 'recipient.province', 'recipient.street', 'recipient.ward'].sort(),
      )
    }
  })

  it('qrLang bị bỏ qua khi đơn không có lời chúc; addMessage không phải boolean → INVALID; qrLang lạ → INVALID', async () => {
    const r = await placeOrder({ orderType: 'self', qrLang: 'en' })
    expect(r.body.order).toMatchObject({ hasMessage: false, qrLang: null })
    await addToCart('den-nguyet', 1)
    expect((await placeOrder({ addMessage: 'true', qrLang: 'en' })).body.error.fields).toEqual({ addMessage: 'INVALID' })
    expect((await placeOrder({ addMessage: true, qrLang: 'fr' })).body.error.fields).toEqual({ qrLang: 'INVALID' })
    expect((await placeOrder({ orderType: 'gift', addMessage: false, qrLang: 'vi', recipientType: 'other', paymentMethod: 'payos' })).body.order).toMatchObject({
      hasMessage: true,
      qrLang: 'vi',
    })
  })

  it('clientKey / expectedTotal / enum sai kiểu → 400 theo trường', async () => {
    const r = await checkout({ clientKey: 'ngan', expectedTotal: '1009000', orderType: 'GIFT', recipientType: 1, paymentMethod: 'bank' })
    expect(r.status).toBe(400)
    expect(r.body.error.fields).toMatchObject({ clientKey: 'INVALID', expectedTotal: 'INVALID', orderType: 'INVALID', recipientType: 'INVALID', paymentMethod: 'INVALID' })
    expect((await checkout({ clientKey: 'abc12345;drop', expectedTotal: 1 })).body.error.fields).toMatchObject({ clientKey: 'INVALID' })
    expect((await checkout({ expectedTotal: 1009000.5 })).body.error.fields).toEqual({ expectedTotal: 'INVALID' })
    expect((await checkout({ expectedTotal: -1 })).body.error.fields).toEqual({ expectedTotal: 'INVALID' })
  })

  it('body là mảng / không phải JSON → 400, không 500', async () => {
    const a = await request(app).post('/api/orders').set('Authorization', buyer).send([1, 2])
    expect(a.status).toBe(400)
    const b = await request(app).post('/api/orders').set('Authorization', buyer).set('Content-Type', 'application/json').send('{bad json')
    expect(b.status).toBe(400)
  })

  it('trường do server quyết định (status, total, giá, userId, paymentStatus, discount) gửi từ trình duyệt bị bỏ qua', async () => {
    const q = await quote({ recipientType: 'other' })
    const r = await checkout({
      orderType: 'gift',
      qrLang: 'vi',
      recipientType: 'other',
      paymentMethod: 'payos',
      expectedTotal: q.body.pricing.total,
      status: 'CONFIRMED',
      paymentStatus: 'PAID',
      total: 1,
      subtotal: 1,
      discount: 999999,
      userId: 'someone-else',
      couponId: 'x',
      flags: ['X'],
    })
    expect(r.status).toBe(201)
    expect(r.body.order).toMatchObject({ status: 'PENDING_PAYMENT', paymentStatus: 'PENDING', total: q.body.pricing.total, discount: 0 })
    const saved = await repo.getOrderById(r.body.order.id)
    expect(saved.flags).toEqual([])
    expect(saved.couponId).toBeNull()
    expect(saved.userId).not.toBe('someone-else')
  })

  it('__proto__ / constructor trong body không làm ô nhiễm prototype và không đổi kết quả', async () => {
    const q = await quote({})
    const raw = JSON.stringify({ orderType: 'self', recipientType: 'self', paymentMethod: 'cod', clientKey: newKey(), expectedTotal: q.body.pricing.total }).replace(
      /^\{/,
      '{"__proto__":{"polluted":"yes","status":"SHIPPED","orderType":"gift"},"constructor":{"prototype":{"polluted2":1}},"recipient":{"__proto__":{"name":"X"},"name":"Nguyễn An","phone":"0912345678","province":"HN","district":"HK","ward":"HT","street":"1"},',
    )
    const r = await request(app).post('/api/orders').set('Authorization', buyer).set('Content-Type', 'application/json').send(raw)
    expect(r.status).toBe(201)
    expect(r.body.order).toMatchObject({ status: 'CONFIRMED', orderType: 'self' })
    expect(r.body.order.recipient.name).toBe('Nguyễn An')
    expect({}.polluted).toBeUndefined()
    expect({}.polluted2).toBeUndefined()
    expect(Object.prototype.status).toBeUndefined()
  })

  it('__proto__ trong body thiếu trường bắt buộc không lấp được trường đó', async () => {
    const q = await quote({})
    const raw = `{"__proto__":{"orderType":"self","recipientType":"self"},"recipient":${JSON.stringify(recipient)},"paymentMethod":"cod","clientKey":"${newKey()}","expectedTotal":${q.body.pricing.total}}`
    const r = await request(app).post('/api/orders').set('Authorization', buyer).set('Content-Type', 'application/json').send(raw)
    expect(r.status).toBe(400)
    expect(r.body.error.fields).toMatchObject({ orderType: 'REQUIRED', recipientType: 'REQUIRED' })
  })
})

// ---------------------------------------------------------------------------
describe('Tạo đơn — idempotent & đồng thời', () => {
  it('gửi đồng thời 2 request cùng clientKey → chỉ 1 đơn, cùng id', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    const body = { orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'cod', clientKey: 'same-key-123', expectedTotal: q.body.pricing.total }
    const [a, b] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', buyer).send(body),
      request(app).post('/api/orders').set('Authorization', buyer).send(body),
    ])
    expect(a.status).toBe(201)
    expect(b.status).toBe(201)
    expect(a.body.order.id).toBe(b.body.order.id)
    expect(await repo.listOrders()).toHaveLength(1)
  })

  it('payOS: 2 request đồng thời cùng clientKey → cả hai đều nhận được checkoutUrl', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    const body = { orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'payos', clientKey: 'same-key-456', expectedTotal: q.body.pricing.total }
    const [a, b] = await Promise.all([
      request(app).post('/api/orders').set('Authorization', buyer).send(body),
      request(app).post('/api/orders').set('Authorization', buyer).send(body),
    ])
    expect(a.body.order.id).toBe(b.body.order.id)
    expect(await repo.listOrders()).toHaveLength(1)
    // Request thua cuộc trả đơn PENDING_PAYMENT nhưng chưa có link → khách không bấm thanh toán được
    expect(a.body.checkoutUrl).toBeTruthy()
    expect(b.body.checkoutUrl).toBeTruthy()
  })

  it('service: 2 lời gọi payOS xen kẽ cùng clientKey → lời gọi thua vẫn phải có checkoutUrl', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    const userId = (await auth.getUser(buyer.slice(7))).id
    const body = { orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'payos', clientKey: 'same-key-789', expectedTotal: q.body.pricing.total }
    const [a, b] = await Promise.all([orders.create(userId, body, 'vi'), orders.create(userId, body, 'vi')])
    expect(a.order.id).toBe(b.order.id)
    expect(a.checkoutUrl).toBeTruthy()
    expect(b.checkoutUrl).toBeTruthy()
  })

  it('clientKey là riêng từng user: user B dùng cùng key với user A vẫn tạo đơn của B', async () => {
    const other = await login('binh@moc.test')
    await addToCart('den-nguyet', 1)
    await addToCart('den-vong', 1, other)
    const a = await placeOrder({ clientKey: 'shared-key-1' })
    const b = await placeOrder({ clientKey: 'shared-key-1' }, other)
    expect(b.status).toBe(201)
    expect(b.body.order.id).not.toBe(a.body.order.id)
    expect(b.body.order.items[0].slug).toBe('den-vong')
  })

  it('đơn chỉ xoá các dòng đã mua khỏi giỏ; giỏ có hàng ẩn → chặn, không tạo đơn nửa vời', async () => {
    await addToCart('den-nguyet', 2)
    await addToCart('den-vong', 1)
    const p = await repo.getProductBySlug('den-vong')
    await repo.updateProduct(p.id, { status: 'hidden' })
    expect((await placeOrder()).body.error.code).toBe('CART_HAS_UNAVAILABLE')
    expect(await repo.listOrders()).toHaveLength(0)
    const q = await quote({})
    expect(q.body.hasUnavailable).toBe(true)
  })

  it('returnUrl/cancelUrl theo ngôn ngữ (zh → /zh/...)', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    const r = await request(app)
      .post('/api/orders?lang=zh')
      .set('Authorization', buyer)
      .send({ orderType: 'self', recipientType: 'self', recipient, paymentMethod: 'payos', clientKey: newKey(), expectedTotal: q.body.pricing.total })
    expect(payments.links.get(r.body.order.code).cancelUrl).toBe(`https://moc.test/zh/account/orders/${r.body.order.id}?payment=cancel`)
  })
})

// ---------------------------------------------------------------------------
describe('Dữ liệu trả cho khách không lộ trường nội bộ (FR-ACC-002)', () => {
  const FORBIDDEN = ['userId', 'clientKey', 'flags', 'refundNote', 'paymentRef', 'paymentLinkId', 'couponId', 'paidAmount', 'checkoutUrl', 'codCollectedAt', 'refundedAt']

  it('chi tiết, danh sách, tạo, huỷ — không chứa trường nội bộ, kể cả sau khi lệch tiền + hoàn tiền', async () => {
    const order = await payosOrder()
    const created = (await getOrder(order.id)).body.order
    for (const k of FORBIDDEN) expect(created, k).not.toHaveProperty(k)
    await webhook(payments.pay(order.code, order.total - 1)).expect(200) // AMOUNT_MISMATCH
    await adminAct(order.id, 'refund', { amount: order.total - 1, note: 'CK nội bộ — số TK 0123' }).expect(200)
    const detail = (await getOrder(order.id)).body.order
    for (const k of FORBIDDEN) expect(detail, k).not.toHaveProperty(k)
    expect(JSON.stringify(detail)).not.toContain('CK nội bộ')
    expect(JSON.stringify(detail)).not.toContain('AMOUNT_MISMATCH')
    const list = (await request(app).get('/api/orders').set('Authorization', buyer)).body.items
    for (const k of FORBIDDEN) expect(list[0], k).not.toHaveProperty(k)
    expect(list[0]).not.toHaveProperty('recipient')
  })

  it('đơn COD: trả về checkoutUrl null; paymentExpiresAt null', async () => {
    await addToCart('den-nguyet', 1)
    const r = await placeOrder()
    expect(r.body.checkoutUrl).toBeNull()
    expect(r.body.order.paymentExpiresAt).toBeNull()
  })

  it('trackingCode chỉ hiện khi đã gửi; cancelReason chỉ khi đã huỷ', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder()).body
    await repo.updateOrder(order.id, { trackingCode: 'GHN-SOM' })
    expect((await getOrder(order.id)).body.order.trackingCode).toBeNull()
    expect((await getOrder(order.id)).body.order.cancelReason).toBeNull()
  })
})

// ---------------------------------------------------------------------------
describe('Webhook payOS (BR-PAY-001/002, §15.1)', () => {
  it('thiếu data / data null / data là chuỗi / thiếu chữ ký / body là mảng → 400, không đổi đơn', async () => {
    const order = await payosOrder()
    const good = payments.pay(order.code)
    for (const b of [{ ...good, data: undefined }, { ...good, data: null }, { ...good, data: 'x' }, { ...good, signature: undefined }, { ...good, signature: 'ab' }, [good]]) {
      expect((await webhook(b)).status).toBe(400)
    }
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
  })

  it('chữ ký đúng nhưng ký bằng key khác → 400', async () => {
    const order = await payosOrder()
    const body = payments.pay(order.code)
    body.signature = signData(body.data, 'khoa-khac')
    expect((await webhook(body)).status).toBe(400)
  })

  it("code != '00' (ở ngoài hoặc trong data) → 200 nhưng không xác nhận đơn", async () => {
    const order = await payosOrder()
    const body = payments.pay(order.code)
    await webhook({ ...body, code: '01' }).expect(200)
    const d = { ...body.data, code: '01', reference: 'R-01' }
    await webhook(signed(d)).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
    // Sau đó webhook thành công thật vẫn xác nhận được
    await webhook(body).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('CONFIRMED')
  })

  it('orderCode lạ / không phải số / quá lớn → 200 (webhook thử của payOS), không ghi gì', async () => {
    const order = await payosOrder()
    for (const orderCode of [999999999, 'abc', 1e300, -1, null]) {
      const d = { orderCode, amount: order.total, reference: `R-${String(orderCode)}`, code: '00' }
      await webhook(signed(d)).expect(200)
    }
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
  })

  it('orderCode dạng chuỗi số vẫn khớp đơn', async () => {
    const order = await payosOrder()
    await webhook(signed({ orderCode: String(order.code), amount: order.total, reference: 'R-STR', code: '00' })).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('CONFIRMED')
  })

  it('amount không phải số nguyên (chuỗi, số lẻ) → bỏ qua, đơn vẫn chờ; webhook đúng sau đó vẫn xác nhận được', async () => {
    const order = await payosOrder()
    await webhook(signed({ orderCode: order.code, amount: String(order.total), reference: 'R-A', code: '00' })).expect(200)
    await webhook(signed({ orderCode: order.code, amount: order.total + 0.5, reference: 'R-B', code: '00' })).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
    await webhook(signed({ orderCode: order.code, amount: order.total, reference: 'R-A', code: '00' })).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('CONFIRMED')
  })

  it('trùng reference: lần hai không đổi gì kể cả khi đơn đã bị huỷ giữa chừng (BR-PAY-002, AC-003)', async () => {
    const order = await payosOrder()
    const body = payments.pay(order.code)
    await webhook(body).expect(200)
    await adminAct(order.id, 'cancel').expect(200)
    const before = await repo.getOrderById(order.id)
    await webhook(body).expect(200)
    expect(await repo.getOrderById(order.id)).toEqual(before)
  })

  it('webhook đến sau khi khách huỷ đơn PENDING → ghi nhận tiền, cờ PAID_AFTER_CANCEL, chờ hoàn tiền (D-41)', async () => {
    const order = await payosOrder()
    payments.getPayment = async () => ({ status: 'PENDING', amountPaid: 0, reference: null })
    const c = await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', buyer)
    expect(c.body.order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'CANCELLED', cancelReason: 'customer', canPay: false })
    payments.links.get(order.code).status = 'PENDING'
    await webhook(payments.pay(order.code)).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['PAID_AFTER_CANCEL'], paidAmount: order.total })
    const flagged = await request(app).get('/api/admin/orders?flagged=1').set('Authorization', admin)
    expect(flagged.body.items.map((i) => i.id)).toEqual([order.id])
  })

  it('lỗi ghi DB khi xử lý webhook → 500 và payOS gửi lại được (không bị coi là trùng)', async () => {
    const order = await payosOrder()
    const body = payments.pay(order.code)
    const real = repo.updateOrder
    repo.updateOrder = async () => {
      throw new Error('db down')
    }
    expect((await webhook(body)).status).toBe(500)
    repo.updateOrder = real
    await webhook(body).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('CONFIRMED')
  })

  it('webhook trả tiền cho đơn COD (orderCode trùng mã COD) → không đổi đơn COD', async () => {
    await addToCart('den-nguyet', 1)
    const { order } = (await placeOrder()).body
    await webhook(signed({ orderCode: order.code, amount: order.total, reference: 'R-COD', code: '00' })).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CONFIRMED', paymentStatus: 'COD_PENDING' })
  })

  it('trả thừa tiền → cũng coi là lệch, không xác nhận (BR-PAY-001)', async () => {
    const order = await payosOrder()
    await webhook(payments.pay(order.code, order.total + 1000)).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['AMOUNT_MISMATCH'], paidAmount: order.total + 1000 })
  })
})

// ---------------------------------------------------------------------------
describe('Đối soát / hết hạn (§15.1, BR-PAY-003, D-69)', () => {
  it('payOS lỗi mạng khi xem đơn còn hạn → vẫn 200, đơn giữ PENDING', async () => {
    const order = await payosOrder()
    payments.getPayment = async () => {
      throw new Error('ECONNRESET')
    }
    const r = await getOrder(order.id)
    expect(r.status).toBe(200)
    expect(r.body.order.status).toBe('PENDING_PAYMENT')
  })

  it('payOS lỗi mạng + đơn đã quá hạn → huỷ EXPIRED; tiền về sau vẫn được gắn cờ', async () => {
    const order = await payosOrder()
    const realGet = payments.getPayment
    payments.getPayment = async () => {
      throw new Error('timeout')
    }
    clock += 15 * 60 * 1000
    expect(await orders.sweepExpired()).toEqual({ checked: 1, cancelled: 1 })
    payments.getPayment = realGet
    payments.links.get(order.code).status = 'PENDING'
    await webhook(payments.pay(order.code)).expect(200)
    expect(await repo.getOrderById(order.id)).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['PAID_AFTER_CANCEL'] })
  })

  it('hỏi payOS có giới hạn tần suất (không gọi lại trong 10 giây khi xem đơn)', async () => {
    const order = await payosOrder()
    const spy = vi.spyOn(payments, 'getPayment')
    await getOrder(order.id)
    await getOrder(order.id)
    await request(app).get('/api/orders').set('Authorization', buyer)
    expect(spy).toHaveBeenCalledTimes(1)
    clock += 10_000
    await getOrder(order.id)
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sweep: chỉ đơn payOS quá hạn; trước hạn 1ms không huỷ; đơn COD không động tới', async () => {
    await addToCart('den-nguyet', 1)
    const cod = (await placeOrder()).body.order
    const order = await payosOrder({}, 'den-vong')
    clock += 15 * 60 * 1000 - 1
    expect(await orders.sweepExpired()).toEqual({ checked: 0, cancelled: 0 })
    clock += 1
    expect(await orders.sweepExpired()).toEqual({ checked: 1, cancelled: 1 })
    expect((await repo.getOrderById(cod.id)).status).toBe('CONFIRMED')
    expect((await repo.getOrderById(order.id)).cancelledAt).toBe(new Date(clock).toISOString())
  })

  it('sweep: một đơn lỗi không chặn các đơn khác', async () => {
    const a = await payosOrder()
    const b = await payosOrder({}, 'den-vong')
    clock += 16 * 60 * 1000
    const real = repo.updateOrder
    repo.updateOrder = async (id, ...rest) => {
      if (id === a.id) throw new Error('boom')
      return real(id, ...rest)
    }
    const r = await orders.sweepExpired()
    repo.updateOrder = real
    expect(r).toEqual({ checked: 2, cancelled: 1 })
    expect((await repo.getOrderById(b.id)).status).toBe('CANCELLED')
  })

  it('khách huỷ đơn PENDING đúng lúc tiền vừa về (webhook chưa tới) → xác nhận rồi chuyển chờ hoàn tiền, không mất tiền', async () => {
    const order = await payosOrder()
    const body = payments.pay(order.code) // tiền đã về payOS, webhook đang trên đường
    const r = await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', buyer)
    expect(r.body.order).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' })
    const saved = await repo.getOrderById(order.id)
    expect(saved.paidAmount).toBe(order.total)
    await webhook(body).expect(200) // webhook tới muộn — trùng reference
    expect(await repo.getOrderById(order.id)).toEqual(saved)
  })

  it('pay: còn hạn → trả link; COD / đã huỷ / quá hạn → 409; đơn người khác → 404', async () => {
    const order = await payosOrder()
    expect((await request(app).post(`/api/orders/${order.id}/pay`).set('Authorization', buyer)).body.checkoutUrl).toContain(`/api/dev/payos/${order.code}`)
    const other = await login('binh@moc.test')
    expect((await request(app).post(`/api/orders/${order.id}/pay`).set('Authorization', other)).status).toBe(404)
    clock += 15 * 60 * 1000
    const r = await request(app).post(`/api/orders/${order.id}/pay`).set('Authorization', buyer)
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('ORDER_NOT_PAYABLE')
    expect((await repo.getOrderById(order.id)).paymentStatus).toBe('EXPIRED')
    await addToCart('den-nguyet', 1)
    const cod = (await placeOrder()).body.order
    expect((await request(app).post(`/api/orders/${cod.id}/pay`).set('Authorization', buyer)).body.error.code).toBe('ORDER_NOT_PAYABLE')
  })

  it('không cấu hình payOS: đơn PENDING cũ quá hạn vẫn được huỷ khi xem', async () => {
    const order = await payosOrder()
    const o2 = createOrderService({ repo, payments: null, now: () => clock })
    clock += 15 * 60 * 1000
    expect((await o2.get((await repo.getOrderById(order.id)).userId, order.id, 'vi')).order.status).toBe('CANCELLED')
  })
})

// ---------------------------------------------------------------------------
describe('Quyền truy cập đơn (BR-ACC-001, FR-ACC-002)', () => {
  it('user B không xem / huỷ / pay đơn của A; danh sách của B không có đơn của A', async () => {
    const order = await payosOrder()
    const other = await login('binh@moc.test')
    expect((await getOrder(order.id, other)).status).toBe(404)
    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', other)).status).toBe(404)
    expect((await request(app).post(`/api/orders/${order.id}/pay`).set('Authorization', other)).status).toBe(404)
    expect((await request(app).get('/api/orders').set('Authorization', other)).body.items).toEqual([])
    expect((await repo.getOrderById(order.id)).status).toBe('PENDING_PAYMENT')
  })

  it('id lạ / rất dài / mã đơn số → 404 (không tra theo code)', async () => {
    const order = await payosOrder()
    expect((await getOrder('khong-co')).status).toBe(404)
    expect((await getOrder('a'.repeat(5000))).status).toBe(404)
    expect((await getOrder(String(order.code))).status).toBe(404)
  })

  it('chưa đăng nhập → 401 cho mọi endpoint đơn; webhook không cần đăng nhập', async () => {
    for (const [m, p] of [
      ['get', '/api/orders'],
      ['get', '/api/orders/x'],
      ['post', '/api/orders/x/cancel'],
      ['post', '/api/orders/x/pay'],
    ]) {
      expect((await request(app)[m](p)).status, p).toBe(401)
    }
  })

  it('khách thường không gọi được API admin đơn/coupon/cấu hình', async () => {
    const order = await payosOrder()
    expect((await request(app).post(`/api/admin/orders/${order.id}/actions/cancel`).set('Authorization', buyer)).status).toBe(403)
    expect((await request(app).post('/api/admin/coupons').set('Authorization', buyer).send({ code: 'X', type: 'free_shipping' })).status).toBe(403)
    expect((await request(app).get(`/api/admin/orders/${order.id}`)).status).toBe(401)
  })
})

// ---------------------------------------------------------------------------
describe('Admin — chuyển trạng thái, gửi hàng, hoàn tiền (FR-ORD-002, BR-ORD-002, D-70)', () => {
  async function codOrder() {
    await addToCart('den-nguyet', 1)
    return (await placeOrder()).body.order
  }
  const publishedBatch = async () => (await repo.listBatches()).find((b) => b.status === 'video_published')
  const draftBatch = async () => (await repo.listBatches()).find((b) => b.status !== 'video_published')
  const setBatch = async (order, batchId) => {
    const detail = (await request(app).get(`/api/admin/orders/${order.id}`).set('Authorization', admin)).body.item
    return request(app).put(`/api/admin/orders/${order.id}/items/${detail.items[0].id}/batch`).set('Authorization', admin).send({ batchId })
  }

  it('chuyển sai thứ tự → INVALID_TRANSITION, đơn không đổi', async () => {
    const o = await codOrder()
    for (const a of ['pack', 'ship', 'deliver', 'delivery_failed', 'set_stage', 'set_tracking']) {
      const r = await adminAct(o.id, a, { stage: 2, trackingCode: 'GHN-1' })
      expect(r.status, a).toBe(409)
      expect(r.body.error.code, a).toBe('INVALID_TRANSITION')
    }
    await adminAct(o.id, 'start_production').expect(200)
    expect((await adminAct(o.id, 'start_production')).body.error.code).toBe('INVALID_TRANSITION')
    expect((await adminAct(o.id, 'deliver')).body.error.code).toBe('INVALID_TRANSITION')
    expect((await repo.getOrderById(o.id)).status).toBe('IN_PRODUCTION')
  })

  it('đơn payOS chưa trả: không bắt đầu sản xuất được', async () => {
    const order = await payosOrder()
    expect((await adminAct(order.id, 'start_production')).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('thao tác lạ → 400; đơn không tồn tại → 404; stage chuỗi → 400', async () => {
    const o = await codOrder()
    expect((await adminAct(o.id, 'hack')).status).toBe(400)
    expect((await adminAct('khong-co', 'cancel')).status).toBe(404)
    await adminAct(o.id, 'start_production').expect(200)
    expect((await adminAct(o.id, 'set_stage', { stage: '2' })).status).toBe(400)
    expect((await adminAct(o.id, 'set_stage', { stage: 0 })).status).toBe(400)
  })

  it('ship khi lô chưa xuất bản / lô "đã xuất bản" nhưng thiếu video / chưa gán lô → BATCH_NOT_PUBLISHED', async () => {
    const o = await codOrder()
    await adminAct(o.id, 'start_production').expect(200)
    await adminAct(o.id, 'pack').expect(200)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-1' })).body.error.code).toBe('BATCH_NOT_PUBLISHED')
    const draft = await draftBatch()
    await (await setBatch(o, draft.id)).ok
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-1' })).body.error.code).toBe('BATCH_NOT_PUBLISHED')
    const pub = await publishedBatch()
    await repo.updateBatch(pub.id, { videoUrl: null })
    await setBatch(o, pub.id)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN-1' })).body.error.code).toBe('BATCH_NOT_PUBLISHED')
    expect((await repo.getOrderById(o.id)).status).toBe('PACKED')
  })

  it('mã vận đơn: ký tự lạ / quá dài → 400; khoảng trắng đầu cuối được cắt', async () => {
    const o = await codOrder()
    await adminAct(o.id, 'start_production').expect(200)
    await adminAct(o.id, 'pack').expect(200)
    await setBatch(o, (await publishedBatch()).id)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'GHN 1' })).status).toBe(400)
    expect((await adminAct(o.id, 'ship', { trackingCode: '<b>x</b>' })).status).toBe(400)
    expect((await adminAct(o.id, 'ship', { trackingCode: 'A'.repeat(41) })).status).toBe(400)
    expect((await adminAct(o.id, 'ship', { trackingCode: 123456 })).status).toBe(400)
    expect((await adminAct(o.id, 'ship', { trackingCode: '  GHN-99  ' })).body.item.trackingCode).toBe('GHN-99')
    await adminAct(o.id, 'delivery_failed').expect(200)
    expect((await adminAct(o.id, 'set_tracking', { trackingCode: 'GHN-100' })).body.item).toMatchObject({ status: 'DELIVERY_FAILED', trackingCode: 'GHN-100' })
    expect((await getOrder(o.id)).body.order.trackingCode).toBe('GHN-100')
  })

  it('gán lô: lô không tồn tại → 400; dòng hàng lạ → 404; batchId kiểu số → 400; xoá lô đã gán → 409 BATCH_IN_USE', async () => {
    const o = await codOrder()
    expect((await setBatch(o, 'khong-co')).status).toBe(400)
    expect((await setBatch(o, 123)).status).toBe(400)
    const draft = await draftBatch()
    expect((await request(app).put(`/api/admin/orders/${o.id}/items/khong-co/batch`).set('Authorization', admin).send({ batchId: draft.id })).status).toBe(404)
    await setBatch(o, draft.id)
    const del = await request(app).delete(`/api/admin/batches/${draft.id}`).set('Authorization', admin)
    expect(del.status).toBe(409)
    expect(del.body.error.code).toBe('BATCH_IN_USE')
    expect(await repo.getBatchById(draft.id)).not.toBeNull()
  })

  it('gán lô cho đơn đã huỷ / chờ thanh toán → INVALID_TRANSITION', async () => {
    const order = await payosOrder()
    expect((await setBatch(order, (await draftBatch()).id)).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('thu COD: đơn payOS → lỗi; COD đang CONFIRMED → lỗi; thu hai lần → lỗi', async () => {
    const p = await payosOrder({}, 'den-vong')
    await webhook(payments.pay(p.code)).expect(200)
    expect((await adminAct(p.id, 'cod_collected')).body.error.code).toBe('INVALID_TRANSITION')
    const o = await codOrder()
    expect((await adminAct(o.id, 'cod_collected')).body.error.code).toBe('INVALID_TRANSITION')
    await repo.updateOrder(o.id, { status: 'DELIVERED' })
    await adminAct(o.id, 'cod_collected').expect(200)
    expect((await adminAct(o.id, 'cod_collected')).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('admin huỷ đơn COD PACKED → CANCELLED, paymentStatus CANCELLED (không chờ hoàn tiền)', async () => {
    const o = await codOrder()
    await adminAct(o.id, 'start_production').expect(200)
    await adminAct(o.id, 'pack').expect(200)
    expect((await adminAct(o.id, 'cancel')).body.item).toMatchObject({ status: 'CANCELLED', paymentStatus: 'CANCELLED', cancelReason: 'admin' })
    expect((await adminAct(o.id, 'refund', { amount: 1, note: 'x' })).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('hoàn tiền: số tiền không nguyên / 0 / chuỗi → 400; vượt số đã trả (lệch tiền) → 400; ghi chú 501 ký tự → TOO_LONG; hoàn hai lần → 409', async () => {
    const order = await payosOrder()
    await webhook(payments.pay(order.code, order.total - 5000)).expect(200)
    const paid = order.total - 5000
    for (const amount of [0, -1, 1.5, String(paid), null]) {
      expect((await adminAct(order.id, 'refund', { amount, note: 'x' })).status, String(amount)).toBe(400)
    }
    expect((await adminAct(order.id, 'refund', { amount: order.total, note: 'x' })).status).toBe(400)
    expect((await adminAct(order.id, 'refund', { amount: paid, note: 'x'.repeat(501) })).body.error.fields).toEqual({ note: 'TOO_LONG' })
    expect((await adminAct(order.id, 'refund', { amount: paid, note: '   ' })).body.error.fields).toEqual({ note: 'REQUIRED' })
    await adminAct(order.id, 'refund', { amount: paid, note: 'CK 01/10' }).expect(200)
    expect((await adminAct(order.id, 'refund', { amount: paid, note: 'CK lần 2' })).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('hoàn tiền đơn chưa trả / đang chờ thanh toán → INVALID_TRANSITION', async () => {
    const order = await payosOrder()
    expect((await adminAct(order.id, 'refund', { amount: 1, note: 'x' })).body.error.code).toBe('INVALID_TRANSITION')
  })

  it('admin huỷ đơn PENDING mà payOS đã nhận tiền → đối soát trước, chuyển chờ hoàn tiền', async () => {
    const order = await payosOrder()
    payments.pay(order.code)
    expect((await adminAct(order.id, 'cancel')).body.item).toMatchObject({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', paidAmount: order.total })
  })

  it('danh sách admin: status lạ → 400; lọc theo status', async () => {
    await codOrder()
    expect((await request(app).get('/api/admin/orders?status=HACK').set('Authorization', admin)).status).toBe(400)
    const r = await request(app).get('/api/admin/orders?status=CONFIRMED').set('Authorization', admin)
    expect(r.body.items).toHaveLength(1)
    expect(r.body.items[0]).toMatchObject({ itemCount: 1 })
    expect(r.body.items[0]).not.toHaveProperty('items')
  })
})

// ---------------------------------------------------------------------------
describe('Cấu hình cửa hàng (D-63, D-71)', () => {
  const put = (body) => request(app).put('/api/admin/shop').set('Authorization', admin).send(body)
  it('ship 0đ hợp lệ; ngưỡng 0 / số lẻ / chuỗi → 400; null = tắt', async () => {
    expect((await put({ shippingFee: 1.5 })).status).toBe(400)
    expect((await put({ shippingFee: '30000' })).status).toBe(400)
    expect((await put({ shippingFee: 30000, freeShippingFrom: 0, codMaxTotal: null })).body.error.fields).toEqual({ freeShippingFrom: 'INVALID' })
    expect((await put({ shippingFee: 30000, freeShippingFrom: null, codMaxTotal: -1 })).body.error.fields).toEqual({ codMaxTotal: 'INVALID' })
    // Thiếu trường → không âm thầm tắt mức miễn ship / trần COD
    expect((await put({ shippingFee: 30000 })).body.error.fields).toEqual({ freeShippingFrom: 'REQUIRED', codMaxTotal: 'REQUIRED' })
    expect((await put({ shippingFee: 0, freeShippingFrom: null, codMaxTotal: null })).body.config).toEqual({ shippingFee: 0, freeShippingFrom: null, codMaxTotal: null })
  })
  it('đổi phí ship giữa lúc checkout → tạo đơn báo PRICE_CHANGED (D-41)', async () => {
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    await put({ shippingFee: 40000, freeShippingFrom: 1_500_000, codMaxTotal: 5_000_000 }).expect(200)
    expect((await checkout({ expectedTotal: q.body.pricing.total })).body.error.code).toBe('PRICE_CHANGED')
  })
  it('COD vượt mức qua HTTP → 409 COD_OVER_LIMIT; payOS vẫn được', async () => {
    await put({ shippingFee: 30000, freeShippingFrom: 1_500_000, codMaxTotal: 1_000_000 }).expect(200)
    await addToCart('den-vong', 1)
    const r = await placeOrder({ paymentMethod: 'cod' })
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('COD_OVER_LIMIT')
    expect((await placeOrder({ paymentMethod: 'payos' })).status).toBe(201)
  })
})

// ---------------------------------------------------------------------------
describe('Bảo trì (D-54)', () => {
  it('chặn tạo đơn / huỷ đơn (503) nhưng vẫn nhận webhook payOS và cho xem đơn', async () => {
    const order = await payosOrder()
    await addToCart('den-nguyet', 1)
    const q = await quote({})
    await app.locals.maintenance.set(true, 'it')
    const r = await checkout({ expectedTotal: q.body.pricing.total })
    expect(r.status).toBe(503)
    expect(r.body.error.code).toBe('MAINTENANCE')
    expect((await request(app).post(`/api/orders/${order.id}/cancel`).set('Authorization', buyer)).status).toBe(503)
    await webhook(payments.pay(order.code)).expect(200)
    expect((await repo.getOrderById(order.id)).status).toBe('CONFIRMED')
    expect((await getOrder(order.id)).status).toBe(200)
    // Biến thể đường dẫn (dấu / cuối, query) vẫn là webhook
    expect((await request(app).post('/api/payments/payos/webhook/?x=1').send({})).status).toBe(400)
  })
})
