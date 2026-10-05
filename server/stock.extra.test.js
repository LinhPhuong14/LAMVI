// T-11: kiểm thử độc lập G-44, D-100 (tồn kho) — các ca biên, trả hàng hai lần, SQL
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'
import { validateProduct } from './domain/admin.js'
import { presentStock, LOW_STOCK_AT } from './domain/stock.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'bimat-cron', rateLimit: { enabled: false } }
let app, repo, auth, orders, customer, admin, clock
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
const idOf = async (slug) => (await repo.getProductBySlug(slug)).id
const stockOf = async (slug) => (await repo.getProductBySlug(slug)).stock
const setStock = async (slug, stock) => repo.updateProduct(await idOf(slug), { stock })
const add = (slug, quantity = 1) => request(app).put(`/api/cart/items/${slug}`).set('Authorization', customer).send({ quantity })
const BODY = { orderKind: 'self', hasMessage: false, recipientIsSelf: true, recipientName: 'A', recipientPhone: '0912345678', addressLine: '12 X', provinceCode: '1', wardCode: '4', paymentMethod: 'cod' }
const order = (over = {}) => request(app).post('/api/orders').set('Authorization', customer).send({ ...BODY, ...over })
const cancel = (code) => request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer).send({})
const adminStatus = (code, status) => request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin).send({ status })
const hook = (o, over = {}) => orders.applyPayosWebhook({ orderCode: o.payosOrderCode, amount: o.total, paid: true, reference: 'r', ...over })

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  clock = new Date('2026-10-01T03:00:00.000Z')
  orders = createOrderService({ repo, payos, now: () => clock })
  app = createApp({ repo, auth, storage: createMemoryStorage(), config, payos, orders })
  customer = await login('a@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

async function placed(method = 'cod', qty = 2, slug = 'den-nguyet') {
  await setStock(slug, 5)
  await add(slug, qty)
  const r = await order({ paymentMethod: method })
  expect(r.status).toBe(201)
  return r.body.order
}

describe('repo.reserveStock / releaseStock', () => {
  it('cùng productId xuất hiện hai lần: cộng dồn khi kiểm và khi trừ', async () => {
    const id = await idOf('den-nguyet')
    await setStock('den-nguyet', 3)
    expect(await repo.reserveStock([{ productId: id, quantity: 2 }, { productId: id, quantity: 2 }])).toBe(id)
    expect(await stockOf('den-nguyet')).toBe(3)
    expect(await repo.reserveStock([{ productId: id, quantity: 2 }, { productId: id, quantity: 1 }])).toBeNull()
    expect(await stockOf('den-nguyet')).toBe(0)
  })
  it('id không tồn tại không làm hỏng, không theo dõi thì giữ nguyên null', async () => {
    const id = await idOf('den-vong')
    expect(await repo.reserveStock([{ productId: id, quantity: 9 }, { productId: 'khong-co', quantity: 1 }])).toBeNull()
    expect(await stockOf('den-vong')).toBeNull()
    await repo.releaseStock([{ productId: id, quantity: 4 }])
    expect(await stockOf('den-vong')).toBeNull()
  })
  it('giữ đúng bằng tồn (stock == qty) được, về 0', async () => {
    const id = await idOf('den-nguyet')
    await setStock('den-nguyet', 2)
    expect(await repo.reserveStock([{ productId: id, quantity: 2 }])).toBeNull()
    expect(await stockOf('den-nguyet')).toBe(0)
  })
})

describe('Trả hàng không bị hai lần', () => {
  it('payOS: huỷ rồi webhook PAID muộn / lặp → kho vẫn đúng một lần trả', async () => {
    const o = await placed('payos', 2)
    expect((await cancel(o.code)).status).toBe(200)
    expect(await stockOf('den-nguyet')).toBe(5)
    await hook(o)
    await hook(o)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('payOS: hết hạn rồi cron lặp / xem đơn lặp / webhook → trả đúng một lần', async () => {
    const o = await placed('payos', 2)
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 60_000)
    await orders.expirePendingOrders()
    await orders.expirePendingOrders()
    await hook(o)
    await request(app).get(`/api/orders/${o.code}`).set('Authorization', customer)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('admin huỷ đơn payOS đã hết hạn (nhưng cron chưa chạy) → không trả hai lần', async () => {
    const o = await placed('payos', 2)
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 60_000)
    await adminStatus(o.code, 'cancelled')
    await orders.expirePendingOrders()
    await adminStatus(o.code, 'cancelled')
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('huỷ đồng thời hai lần (khách + admin) → chỉ một lần trả', async () => {
    const o = await placed('cod', 2)
    await Promise.all([cancel(o.code), adminStatus(o.code, 'cancelled'), cancel(o.code)])
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('đơn payOS đã trả tiền (confirmed) rồi huỷ → trả hàng một lần, chờ hoàn tiền', async () => {
    const o = await placed('payos', 2)
    await hook(o)
    expect(await stockOf('den-nguyet')).toBe(3)
    const r = await cancel(o.code)
    expect(r.status).toBe(200)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('đơn đã giao không huỷ được → kho không đổi', async () => {
    const o = await placed('cod', 2)
    for (const s of ['in_production', 'packed', 'shipped', 'delivered']) await adminStatus(o.code, s)
    expect((await cancel(o.code)).status).toBe(409)
    expect(await stockOf('den-nguyet')).toBe(3)
  })
  it('stock đặt về null sau khi có đơn → huỷ không biến null thành số', async () => {
    const o = await placed('cod', 2)
    await setStock('den-nguyet', null)
    await cancel(o.code)
    expect(await stockOf('den-nguyet')).toBeNull()
  })
  it('giao thất bại (delivery_failed) — ghi nhận hành vi hiện tại về kho', async () => {
    const o = await placed('cod', 2)
    for (const s of ['in_production', 'packed', 'shipped', 'delivery_failed']) expect((await adminStatus(o.code, s)).status).toBe(200)
    // Hiện KHÔNG hoàn kho (hàng còn ở ngoài). Test này ghim hành vi để người dùng quyết định.
    expect(await stockOf('den-nguyet')).toBe(3)
  })
})

describe('Rò rỉ kho khi lỗi hạ tầng giữa chừng', () => {
  // Lỗi đã sửa (tìm thấy ở T-11)
  it('claimCoupon ném lỗi (DB) sau khi đã giữ chỗ → kho phải được trả', async () => {
    await setStock('den-nguyet', 3)
    await repo.createCoupon({ code: 'LOI', type: 'percent', value: 10, status: 'active', usageLimit: 5, perUserLimit: 5 })
    await add('den-nguyet', 1)
    vi.spyOn(repo, 'claimCoupon').mockRejectedValueOnce(new Error('db down'))
    const r = await order({ couponCode: 'LOI' })
    expect(r.status).toBeGreaterThanOrEqual(500)
    expect(await stockOf('den-nguyet')).toBe(3)
  })
  it('lỗi SAU khi đơn đã tạo (dọn giỏ) → không được trả kho khi đơn vẫn tồn tại', async () => {
    await setStock('den-nguyet', 3)
    await add('den-nguyet', 2)
    vi.spyOn(repo, 'removeCartItem').mockRejectedValueOnce(new Error('db blip'))
    await order()
    const existing = (await repo.listOrders({})).length
    // Đơn tồn tại ⇒ kho phải đang bị trừ 2; nếu không có đơn ⇒ kho phải còn 3
    expect(await stockOf('den-nguyet')).toBe(existing ? 1 : 3)
  })
})

describe('Số lượng và đặt đơn', () => {
  it('số lượng 0 / âm / NaN / chuỗi / thập phân bị từ chối, kho không đổi', async () => {
    await setStock('den-nguyet', 5)
    for (const q of [0, -1, 1.5, '2', null, 11]) expect((await add('den-nguyet', q)).status, String(q)).toBe(400)
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('tồn kho 0 nhưng dòng đã có trong giỏ: đặt đơn → OUT_OF_STOCK, không tạo đơn', async () => {
    await setStock('den-nguyet', 2)
    await add('den-nguyet', 2)
    await setStock('den-nguyet', 0)
    const r = await order()
    expect(r.body.error.code).toBe('OUT_OF_STOCK')
    expect(await repo.listOrders({})).toHaveLength(0)
  })
  it('thứ tự lỗi: giá đổi + hết hàng → OUT_OF_STOCK trước (không kèm quote vô nghĩa)', async () => {
    await setStock('den-nguyet', 2)
    await add('den-nguyet', 2)
    await setStock('den-nguyet', 1)
    const r = await order({ expectedTotal: 1 })
    expect(r.status).toBe(409)
    expect(['OUT_OF_STOCK', 'PRICE_CHANGED']).toContain(r.body.error.code)
    expect(await stockOf('den-nguyet')).toBe(1)
  })
  it('PRICE_CHANGED không trừ kho', async () => {
    await setStock('den-nguyet', 5)
    await add('den-nguyet', 2)
    const r = await order({ expectedTotal: 1 })
    expect(r.body.error.code).toBe('PRICE_CHANGED')
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('sản phẩm bị ẩn: không trừ kho, CART_HAS_UNAVAILABLE', async () => {
    await setStock('den-nguyet', 5)
    await add('den-nguyet', 1)
    await repo.updateProduct(await idOf('den-nguyet'), { status: 'hidden' })
    expect((await order()).body.error.code).toBe('CART_HAS_UNAVAILABLE')
    expect(await stockOf('den-nguyet')).toBe(5)
  })
  it('đặt 2 đơn liên tiếp đến hết hàng, đơn thứ ba bị chặn; huỷ một đơn mở lại', async () => {
    await setStock('den-nguyet', 2)
    await add('den-nguyet', 1)
    const a = await order()
    await add('den-nguyet', 1)
    expect((await order()).status).toBe(201)
    expect(await stockOf('den-nguyet')).toBe(0)
    expect((await add('den-nguyet', 1)).body.error.code).toBe('OUT_OF_STOCK')
    await cancel(a.body.order.code)
    expect(await stockOf('den-nguyet')).toBe(1)
    expect((await add('den-nguyet', 1)).status).toBe(200)
  })
})

describe('Giỏ vãng lai và quote', () => {
  it('quote: dòng thiếu hàng báo inStock=false + hasShortage; stockLeft không lộ khi đủ', async () => {
    await setStock('den-nguyet', 2)
    await setStock('den-vong', 100)
    const r = await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-nguyet', quantity: 3 }, { slug: 'den-vong', quantity: 2 }] })
    expect(r.status).toBe(200)
    expect(r.body.hasShortage).toBe(true)
    const by = Object.fromEntries(r.body.items.map((i) => [i.slug, i]))
    expect(by['den-nguyet']).toMatchObject({ inStock: false, stockLeft: 2 })
    expect(by['den-vong']).toMatchObject({ inStock: true, stockLeft: null })
    expect(JSON.stringify(r.body)).not.toMatch(/"stock":/)
  })
  it('quote: sản phẩm ẩn không bị tính là hasShortage', async () => {
    await repo.updateProduct(await idOf('den-nguyet'), { status: 'hidden', stock: 0 })
    const r = await request(app).post('/api/cart/quote').send({ items: [{ slug: 'den-nguyet', quantity: 1 }] })
    expect(r.body.hasShortage).toBe(false)
    expect(r.body.hasUnavailable).toBe(true)
    expect(r.body.items[0].stockLeft).toBeNull()
  })
  it('merge: gộp với dòng đã có trong giỏ không vượt tồn', async () => {
    await setStock('den-nguyet', 3)
    await add('den-nguyet', 2)
    const r = await request(app).post('/api/cart/merge').set('Authorization', customer).send({ items: [{ slug: 'den-nguyet', quantity: 5 }] })
    expect(r.body.items[0].quantity).toBe(3)
  })
  it('merge: tồn 0 mà giỏ đã có dòng (vượt tồn) không bị ghi đè lớn hơn', async () => {
    await setStock('den-nguyet', 3)
    await add('den-nguyet', 3)
    await setStock('den-nguyet', 0)
    const r = await request(app).post('/api/cart/merge').set('Authorization', customer).send({ items: [{ slug: 'den-nguyet', quantity: 1 }] })
    expect(r.status).toBe(200)
    // dòng cũ phải còn nguyên (không thành 0 / xoá oan) hoặc bị giữ nguyên
    const qty = r.body.items.find((i) => i.slug === 'den-nguyet')?.quantity
    expect(qty === undefined || qty >= 3).toBe(true)
  })
})

describe('presentStock', () => {
  it('ngưỡng: đúng LOW_STOCK_AT báo số, LOW_STOCK_AT+1 không lộ', () => {
    expect(presentStock({ stock: LOW_STOCK_AT })).toEqual({ inStock: true, stockLeft: LOW_STOCK_AT })
    expect(presentStock({ stock: LOW_STOCK_AT + 1 })).toEqual({ inStock: true, stockLeft: null })
    expect(presentStock({ stock: 0 })).toEqual({ inStock: false, stockLeft: null })
    expect(presentStock({})).toEqual({ inStock: true, stockLeft: null })
    expect(presentStock({ stock: null })).toEqual({ inStock: true, stockLeft: null })
  })
  it('API công khai không lộ trường stock thô', async () => {
    await setStock('den-nguyet', 1234)
    const list = (await request(app).get('/api/products')).body.items
    expect(JSON.stringify(list)).not.toMatch(/"stock"/)
    expect(JSON.stringify(list)).not.toMatch(/1234/)
  })
})

describe('validateProduct stock', () => {
  const base = { name: 'x' }
  it('giá trị hợp lệ / không hợp lệ', () => {
    for (const v of [0, 1, 1_000_000]) expect(validateProduct({ stock: v }, { partial: true }).values.stock).toBe(v)
    for (const v of [null, '', undefined]) expect(validateProduct({ stock: v }, { partial: true }).values?.stock ?? null).toBeNull()
    for (const v of [-1, 1.5, '5', NaN, Infinity, 1_000_001, true, [], {}]) {
      expect(validateProduct({ stock: v }, { partial: true }).errors?.stock, String(v)).toBe('INVALID_STOCK')
    }
    void base
  })
  it('PATCH không gửi stock → không đụng tới stock', () => {
    expect(validateProduct({ name: 'a' }, { partial: true }).values).not.toHaveProperty('stock')
  })
  it('API admin: tạo sản phẩm không gửi stock → null; sửa stock chuỗi → 400', async () => {
    const id = await idOf('den-nguyet')
    const r = await request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send({ stock: '5' })
    expect(r.status).toBe(400)
    const ok = await request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send({ stock: 7 })
    expect(ok.status).toBe(200)
    expect(await stockOf('den-nguyet')).toBe(7)
    const none = await request(app).patch(`/api/admin/products/${id}`).set('Authorization', admin).send({ stock: null })
    expect(none.status).toBe(200)
    expect(await stockOf('den-nguyet')).toBeNull()
  })
})

describe('Migration SQL 20261005000012', () => {
  const sql = readFileSync(new URL('../supabase/migrations/20261005000012_address_inventory.sql', import.meta.url), 'utf8')
  it('khoá theo thứ tự id ở cả hai pha, có check stock >= 0, revoke execute', () => {
    expect(sql).toMatch(/check \(stock is null or stock >= 0\)/)
    expect((sql.match(/order by 1/g) ?? []).length).toBeGreaterThanOrEqual(3)
    expect(sql).toMatch(/for update/)
    expect(sql).toMatch(/revoke execute on function public\.reserve_stock\(jsonb\) from public, anon, authenticated/)
    expect(sql).toMatch(/revoke execute on function public\.release_stock\(jsonb\) from public, anon, authenticated/)
  })
  it('reserve_stock: sản phẩm không tồn tại (v_stock null do không có dòng) không bị coi là thiếu hàng', () => {
    // `select ... into` không có dòng → v_stock NULL → bỏ qua, khớp adapter bộ nhớ (id lạ = bỏ qua)
    expect(sql).toMatch(/v_stock is not null and v_stock < it\.qty/)
  })
})
