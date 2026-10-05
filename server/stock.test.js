// G-44, D-100 (chốt Q-07): tồn kho theo số lượng, trừ khi đặt đơn, trả lại khi huỷ / hết hạn
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }
let app, repo, auth, orders, customer, other, admin, clock

const payos = {
  checksumKey: 'k',
  createPaymentLink: vi.fn(async (p) => ({ checkoutUrl: `https://pay.test/${p.orderCode}`, paymentLinkId: 'pl', qrCode: 'QR' })),
  cancelPaymentLink: vi.fn(async () => {}),
  getPaymentLink: vi.fn(),
}

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  return `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}`
}
const stockOf = async (slug) => (await repo.getProductBySlug(slug)).stock
const setStock = async (slug, stock) => repo.updateProduct((await repo.getProductBySlug(slug)).id, { stock })
const add = (slug, quantity = 1, token = customer) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', token).send({ quantity })
const BODY = { orderKind: 'self', hasMessage: false, recipientIsSelf: true, recipientName: 'A', recipientPhone: '0912345678', addressLine: '12 X', provinceCode: '1', wardCode: '4', paymentMethod: 'cod' }
const order = (over = {}, token = customer) => request(app).post('/api/orders').set('Authorization', token).send({ ...BODY, ...over })

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  clock = new Date('2026-10-01T03:00:00.000Z')
  orders = createOrderService({ repo, payos, now: () => clock })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config, payos, orders })
  customer = await login('a@lamvi.test')
  other = await login('b@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

describe('Hiển thị tồn kho', () => {
  it('không theo dõi (null) → luôn còn hàng, không lộ số', async () => {
    const p = (await request(app).get('/api/products/den-nguyet')).body.item
    expect(p).toMatchObject({ inStock: true, stockLeft: null })
    expect(JSON.stringify(p)).not.toMatch(/"stock"/)
  })
  it('sắp hết (≤5) báo số còn; còn nhiều chỉ báo còn hàng; 0 → tạm hết hàng', async () => {
    await setStock('den-nguyet', 3)
    await setStock('den-vong', 50)
    await setStock('den-tinh', 0)
    const list = (await request(app).get('/api/products')).body.items
    const by = Object.fromEntries(list.map((p) => [p.slug, p]))
    expect(by['den-nguyet']).toMatchObject({ inStock: true, stockLeft: 3 })
    expect(by['den-vong']).toMatchObject({ inStock: true, stockLeft: null })
    expect(by['den-tinh']).toMatchObject({ inStock: false, stockLeft: null })
  })
})

describe('Giỏ hàng', () => {
  it('không thêm vượt tồn; hết hàng không thêm được; giảm số lượng luôn được', async () => {
    await setStock('den-nguyet', 2)
    expect((await add('den-nguyet', 2)).status).toBe(200)
    const over = await add('den-nguyet', 3)
    expect(over.status).toBe(409)
    expect(over.body.error.code).toBe('OUT_OF_STOCK')
    expect(over.body.error.details).toEqual({ stockLeft: 2 })
    await setStock('den-vong', 0)
    expect((await add('den-vong', 1)).body.error.code).toBe('OUT_OF_STOCK')
    await setStock('den-nguyet', 1) // kho giảm sau khi đã bỏ vào giỏ
    const cart = (await request(app).get('/api/cart').set('Authorization', customer)).body
    expect(cart.hasShortage).toBe(true)
    expect(cart.items[0]).toMatchObject({ slug: 'den-nguyet', inStock: false, stockLeft: 1 })
    expect((await add('den-nguyet', 1)).status).toBe(200)
  })
  it('gộp giỏ trình duyệt bị chặn ở tồn kho, bỏ dòng hết hàng', async () => {
    await setStock('den-nguyet', 2)
    await setStock('den-vong', 0)
    const r = await request(app).post('/api/cart/merge').set('Authorization', customer).send({ items: [{ slug: 'den-nguyet', quantity: 5 }, { slug: 'den-vong', quantity: 1 }] })
    expect(r.status).toBe(200)
    expect(r.body.items.map((i) => [i.slug, i.quantity])).toEqual([['den-nguyet', 2]])
  })
})

describe('Trừ kho khi đặt đơn', () => {
  it('đặt đơn trừ đúng số lượng; không theo dõi thì không đổi', async () => {
    await setStock('den-nguyet', 5)
    await add('den-nguyet', 2)
    await add('den-vong', 1)
    expect((await order()).status).toBe(201)
    expect(await stockOf('den-nguyet')).toBe(3)
    expect(await stockOf('den-vong')).toBeNull()
  })

  it('thiếu hàng → 409 OUT_OF_STOCK, không tạo đơn, không trừ kho, giỏ và coupon còn nguyên', async () => {
    await setStock('den-nguyet', 1)
    await add('den-nguyet', 1)
    await add('den-vong', 1)
    await setStock('den-nguyet', 0) // người khác mua mất
    const r = await order()
    expect(r.status).toBe(409)
    expect(r.body.error.code).toBe('OUT_OF_STOCK')
    expect(r.body.error.details).toEqual({ slug: 'den-nguyet' })
    expect(await repo.listOrders({})).toHaveLength(0)
    expect((await request(app).get('/api/cart').set('Authorization', customer)).body.items).toHaveLength(2)
  })

  it('nhiều dòng: một dòng thiếu thì dòng còn lại cũng không bị trừ', async () => {
    await setStock('den-nguyet', 5)
    await setStock('den-vong', 1)
    await add('den-nguyet', 2)
    await add('den-vong', 1)
    await setStock('den-vong', 0)
    expect((await order()).status).toBe(409)
    expect(await stockOf('den-nguyet')).toBe(5)
  })

  it('hai khách tranh nhau món cuối cùng: chỉ một đơn thành công', async () => {
    await setStock('den-nguyet', 1)
    await add('den-nguyet', 1, customer)
    await add('den-nguyet', 1, other)
    const [a, b] = await Promise.all([order({}, customer), order({}, other)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect(await stockOf('den-nguyet')).toBe(0)
  })

  it('tạo đơn lỗi sau khi giữ chỗ (coupon hết lượt) → trả hàng', async () => {
    await setStock('den-nguyet', 3)
    await repo.createCoupon({ code: 'HET', type: 'percent', value: 10, status: 'active', usageLimit: 1, perUserLimit: 5 })
    const c = await repo.getCouponByCode('HET')
    await repo.claimCoupon(c.id) // hết lượt
    await add('den-nguyet', 1)
    const r = await order({ couponCode: 'HET' })
    expect(r.status).toBe(409)
    expect(await stockOf('den-nguyet')).toBe(3)
  })

  it('bộ (set) có tồn kho riêng, độc lập với đèn lẻ', async () => {
    await setStock('den-sum-vay', 1)
    await setStock('den-nguyet', 10)
    await add('den-sum-vay', 1)
    expect((await order()).status).toBe(201)
    expect(await stockOf('den-sum-vay')).toBe(0)
    expect(await stockOf('den-nguyet')).toBe(10)
  })
})

describe('Trả hàng về kho', () => {
  async function placed(paymentMethod = 'cod', qty = 2) {
    await setStock('den-nguyet', 5)
    await add('den-nguyet', qty)
    const r = await order({ paymentMethod })
    expect(r.status).toBe(201)
    expect(await stockOf('den-nguyet')).toBe(5 - qty)
    return r.body.order.code
  }
  it('khách huỷ đơn → trả hàng đúng một lần (huỷ lại không cộng thêm)', async () => {
    const code = await placed()
    expect((await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})).status).toBe(200)
    expect(await stockOf('den-nguyet')).toBe(5)
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('admin huỷ đơn → trả hàng', async () => {
    const code = await placed()
    const r = await request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin).send({ status: 'cancelled' })
    expect(r.status).toBe(200)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('đơn payOS quá hạn thanh toán → trả hàng khi cron quét', async () => {
    await placed('payos')
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 60_000)
    const r = await request(app).get('/api/internal/expire-orders').set('Authorization', 'Bearer bimat-cron')
    expect(r.body.cancelled).toBe(1)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('đơn không theo dõi tồn kho: huỷ không tạo tồn kho', async () => {
    await add('den-vong', 2)
    const code = (await order()).body.order.code
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
    expect(await stockOf('den-vong')).toBeNull()
  })
})

describe('Admin chỉnh tồn kho', () => {
  const patch = (id, body) => request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send(body)
  it('đặt số lượng, về null (không theo dõi), từ chối giá trị sai; ghi nhật ký', async () => {
    const p = await repo.getProductBySlug('den-nguyet')
    expect((await patch(p.id, { stock: 7 })).body.item.stock).toBe(7)
    expect((await patch(p.id, { stock: 0 })).body.item.stock).toBe(0)
    for (const bad of [-1, 1.5, 'abc', 2_000_000, {}]) expect((await patch(p.id, { stock: bad })).status, String(bad)).toBe(400)
    expect((await patch(p.id, { stock: null })).body.item.stock).toBeNull()
    const log = await repo.listAuditLog({ entity: 'product', entityId: p.id })
    expect(log.filter((l) => l.newValue && 'stock' in l.newValue).map((l) => l.newValue.stock).sort()).toEqual([0, 7, null].sort())
  })
  it('khách thường không chỉnh được', async () => {
    const p = await repo.getProductBySlug('den-nguyet')
    expect((await request(app).patch(`/api/admin/products/${p.id}`).set('Authorization', customer).send({ stock: 99 })).status).toBe(403)
  })
})
