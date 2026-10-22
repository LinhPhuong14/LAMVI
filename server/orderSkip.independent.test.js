// Kiểm thử độc lập D-114: admin nhảy cóc trạng thái, thu tiền COD.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createOrderService } from './orders/service.js'
import { createMessageService } from './messages/service.js'
import { adminNextStatuses } from './domain/order.js'

const config = { publicSiteUrl: 'https://lamvi.test', cronSecret: 'x', rateLimit: { enabled: false } }
const GIFT = {
  orderKind: 'gift', hasMessage: true, qrLang: 'en', recipientIsSelf: false,
  recipientName: 'Trần B', recipientPhone: '0912345678', addressLine: '1 Hàng Bông',
  provinceCode: '1', wardCode: '4', paymentMethod: 'cod',
}
let repo, auth, storage, notify, app, clock, customer, admin, orders

async function login(email, role = 'customer') {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role })
  const s = await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })
  return { token: `Bearer ${s.accessToken}`, id: user.id }
}
beforeEach(async () => {
  repo = createMemoryRepo(); auth = createMemoryAuth(); storage = createMemoryStorage()
  notify = vi.fn(async () => true)
  clock = new Date('2026-10-01T03:00:00.000Z')
  orders = createOrderService({ repo, payos: null, notify, now: () => clock })
  const messages = createMessageService({ repo, storage, now: () => clock })
  app = createApp({ repo, auth, storage, config, payos: null, orders, messages })
  customer = await login('c@lamvi.test')
  admin = await login('a@lamvi.test', 'admin')
})
async function mk(over = {}, patch = {}) {
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer.token).send({ quantity: 1 })
  const r = await request(app).post('/api/orders').set('Authorization', customer.token).send({ ...GIFT, ...over })
  expect(r.status).toBe(201)
  const o = await repo.getOrderByCode(r.body.order.code)
  if (Object.keys(patch).length) await repo.updateOrder(o.id, patch)
  return o
}
const setStatus = (code, status, extra = {}) =>
  request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin.token).send({ status, ...extra })
const collect = (code, token = admin.token, body = {}) => {
  const q = request(app).post(`/api/admin/orders/${code}/cod-collected`)
  return (token ? q.set('Authorization', token) : q).send(body)
}
const audits = async (o, action) => (await repo.listAuditLog({ entity: 'order', entityId: o.id })).filter((e) => e.action === action)

describe('(1) nhảy cóc trạng thái', () => {
  it('bảng chuyển đúng D-114', () => {
    expect(adminNextStatuses('confirmed')).toEqual(['in_production', 'packed', 'shipped', 'delivered', 'cancelled'])
    expect(adminNextStatuses('delivery_failed')).toEqual(['shipped', 'delivered'])
    expect(adminNextStatuses('delivered')).toEqual([])
    expect(adminNextStatuses('shipped')).not.toContain('cancelled')
  })
  it('confirmed→shipped: lưu trackingCode, chỉ 1 thư shipped', async () => {
    const o = await mk()
    const r = await setStatus(o.code, 'shipped', { trackingCode: 'VN123' })
    expect(r.status).toBe(200)
    expect((await repo.getOrderByCode(o.code))).toMatchObject({ status: 'shipped', trackingCode: 'VN123' })
    expect((await repo.getOrderByCode(o.code)).deliveredAt ?? null).toBeNull()
    expect(notify.mock.calls.filter((c) => c[0] === 'shipped')).toHaveLength(1)
    expect(notify.mock.calls.filter((c) => c[0] === 'shipped')[0][1].trackingCode).toBe('VN123')
  })
  it('confirmed→delivered: deliveredAt set, không thư shipped, COD → paid', async () => {
    const o = await mk()
    notify.mockClear()
    const r = await setStatus(o.code, 'delivered')
    expect(r.status).toBe(200)
    const after = await repo.getOrderByCode(o.code)
    expect(after).toMatchObject({ status: 'delivered', deliveredAt: clock.toISOString(), paymentStatus: 'paid' })
    expect(notify).not.toHaveBeenCalled()
  })
  it('đơn không còn nhảy lùi / từ delivered / pending_payment', async () => {
    const o = await mk({}, { status: 'packed' })
    expect((await setStatus(o.code, 'in_production')).status).toBe(409)
    expect((await setStatus(o.code, 'confirmed')).status).toBe(409)
    await setStatus(o.code, 'delivered')
    expect((await setStatus(o.code, 'shipped')).status).toBe(409)
    const p = await mk({}, { status: 'pending_payment' })
    expect((await setStatus(p.code, 'delivered')).status).toBe(409)
  })
  it('lời chúc sửa trước khi nhảy confirmed→delivered: khoá toàn bộ, QR mở, nội dung giữ nguyên', async () => {
    const o = await mk()
    const put = (t) => request(app).put(`/api/orders/${o.code}/message`).set('Authorization', customer.token).send({ text: t, textLang: 'en' })
    expect((await put('Hello v1')).status).toBe(200)
    expect((await request(app).get(`/api/qr/${o.qrToken}`)).body.item?.state ?? 'preparing').not.toBe('greeting')
    await setStatus(o.code, 'delivered')
    expect((await put('too late')).status).toBe(409)
    const up = await request(app).post(`/api/orders/${o.code}/message/media-upload`).set('Authorization', customer.token).send({ kind: 'voice', contentType: 'audio/mpeg', size: 10 })
    expect(up.status).toBe(409)
    const view = await request(app).get(`/api/qr/${o.qrToken}`)
    expect(view.status).toBe(200)
    expect(view.body.item.state).toBe('greeting')
    expect((await request(app).post(`/api/qr/${o.qrToken}/confirm`)).status).toBeLessThan(300)
    expect(JSON.stringify((await request(app).get(`/api/qr/${o.qrToken}`)).body)).toContain('Hello v1')
    const owner = await request(app).get(`/api/orders/${o.code}/message`).set('Authorization', customer.token)
    expect(owner.body.item).toMatchObject({ canEditText: false, canEditMedia: false, state: 'ACTIVE' })
  })
  it('nhảy confirmed→packed: chữ khoá, media chưa khoá nhưng shipped khoá hết', async () => {
    const o = await mk()
    await setStatus(o.code, 'packed')
    const m = await request(app).get(`/api/orders/${o.code}/message`).set('Authorization', customer.token)
    expect(m.body.item).toMatchObject({ canEditText: false, canEditMedia: true })
    await setStatus(o.code, 'shipped')
    const m2 = await request(app).get(`/api/orders/${o.code}/message`).set('Authorization', customer.token)
    expect(m2.body.item).toMatchObject({ canEditText: false, canEditMedia: false })
  })
  it('D-75: nhảy tới delivered → media chưa xác nhận bị dọn sau 90 ngày kể từ deliveredAt', async () => {
    const o = await mk()
    await repo.upsertGiftMessage(o.id, { text: 'hi', textLang: 'en', voicePath: 'u/o/a.mp3', voiceType: 'audio/mpeg' })
    const svc = createMessageService({ repo, storage, now: () => clock })
    await setStatus(o.code, 'delivered')
    clock = new Date(clock.getTime() + 89 * 86400000)
    expect(await svc.purgeExpiredMedia()).toBe(0)
    clock = new Date(clock.getTime() + 2 * 86400000)
    expect(await svc.purgeExpiredMedia()).toBe(1)
    expect((await repo.getGiftMessage(o.id)).mediaDeletedAt).toBeTruthy()
  })
  it('đơn nhảy cóc tới delivered mở được yêu cầu trả hàng trong 7 ngày (deliveredAt)', async () => {
    const o = await mk()
    await setStatus(o.code, 'delivered')
    const after = await repo.getOrderByCode(o.code)
    expect(Date.parse(after.deliveredAt)).toBe(clock.getTime())
  })
})

describe('(2) thanh toán', () => {
  it('payOS đã paid → delivered giữ paymentStatus paid; payOS pending (hiếm) không bị đổi', async () => {
    const o = await mk({}, { paymentMethod: 'payos', paymentStatus: 'paid' })
    await setStatus(o.code, 'delivered')
    expect((await repo.getOrderByCode(o.code)).paymentStatus).toBe('paid')
    const p = await mk({}, { paymentMethod: 'payos', paymentStatus: 'pending' })
    await setStatus(p.code, 'delivered')
    expect((await repo.getOrderByCode(p.code)).paymentStatus).toBe('pending')
  })
  it('huỷ đơn COD pending → cancelled, hoàn kho & coupon', async () => {
    const pr = await repo.getProductBySlug('den-nguyet'); await repo.updateProduct(pr.id, { stock: 5 })
    await repo.createCoupon({ code: 'G10', type: 'percent', value: 10, status: 'active', usedCount: 0 })
    const o = await mk({ couponCode: 'G10' })
    expect((await repo.getProductBySlug('den-nguyet')).stock).toBe(4)
    const r = await setStatus(o.code, 'cancelled')
    expect(r.status).toBe(200)
    expect((await repo.getOrderByCode(o.code)).paymentStatus).toBe('cancelled')
    expect((await repo.getProductBySlug('den-nguyet')).stock).toBe(5)
    expect((await repo.getCouponByCode('G10')).usedCount).toBe(0)
  })
  it('delivery_failed→delivered với COD → paid; delivery_failed→shipped giữ pending', async () => {
    const a = await mk({}, { status: 'delivery_failed' })
    expect((await setStatus(a.code, 'delivered')).status).toBe(200)
    expect((await repo.getOrderByCode(a.code)).paymentStatus).toBe('paid')
    const b = await mk({}, { status: 'delivery_failed' })
    expect((await setStatus(b.code, 'shipped', { trackingCode: 'T2' })).status).toBe(200)
    expect((await repo.getOrderByCode(b.code))).toMatchObject({ status: 'shipped', paymentStatus: 'pending', trackingCode: 'T2' })
  })
  it('thu tiền rồi mới delivered: không ghi đè, không lỗi', async () => {
    const o = await mk({}, { status: 'shipped' })
    expect((await collect(o.code)).status).toBe(200)
    expect((await setStatus(o.code, 'delivered')).status).toBe(200)
    expect((await repo.getOrderByCode(o.code)).paymentStatus).toBe('paid')
  })
})

describe('(3) đồng thời', () => {
  it('2 cod-collected song song → 1×200, 1×409, audit đúng 1', async () => {
    const o = await mk({}, { status: 'shipped' })
    const rs = await Promise.all([collect(o.code, admin.token, { note: 'a' }), collect(o.code, admin.token, { note: 'b' })])
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409])
    expect(rs.find((r) => r.status === 409).body.error?.code ?? rs.find((r) => r.status === 409).body.code).toBe('COD_NOT_COLLECTABLE')
    expect(await audits(o, 'cod_collected')).toHaveLength(1)
  })
  it('cod-collected lần 2 tuần tự → 409', async () => {
    const o = await mk({}, { status: 'delivered' })
    expect((await collect(o.code)).status).toBe(200)
    expect((await collect(o.code)).status).toBe(409)
  })
  it('không thu được: payOS, confirmed, cancelled, delivered đã paid', async () => {
    const a = await mk({}, { status: 'shipped', paymentMethod: 'payos' })
    const b = await mk({}, { status: 'confirmed' })
    const c = await mk({}, { status: 'cancelled', paymentStatus: 'cancelled' })
    const d = await mk({}, { status: 'delivery_failed' })
    for (const o of [a, b, c, d]) expect((await collect(o.code)).status).toBe(409)
    expect((await collect('LV0000-NOPE')).status).toBe(404)
  })
  it('setStatus song song cùng đơn (shipped→delivered ×2): chỉ 1 thành công, audit 1', async () => {
    const o = await mk({}, { status: 'shipped' })
    const rs = await Promise.all([setStatus(o.code, 'delivered'), setStatus(o.code, 'delivered')])
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await audits(o, 'status')).length).toBe(1)
  })
  it('đua: cancel vs shipped trên confirmed — chỉ một thắng, kho không hoàn nếu shipped thắng', async () => {
    const o = await mk()
    const rs = await Promise.all([setStatus(o.code, 'cancelled'), setStatus(o.code, 'shipped')])
    expect(rs.map((r) => r.status).sort()).toEqual([200, 409])
  })
  it('đua: cod-collected vs shipped→delivered → cuối cùng paid, không lỗi 500', async () => {
    const o = await mk({}, { status: 'shipped' })
    const rs = await Promise.all([collect(o.code), setStatus(o.code, 'delivered')])
    for (const r of rs) expect([200, 409]).toContain(r.status)
    expect((await repo.getOrderByCode(o.code)).paymentStatus).toBe('paid')
  })
  it('repo.updateOrderIfStatus: expectedPaymentStatus chặn khi lệch', async () => {
    const o = await mk({}, { status: 'shipped' })
    expect(await repo.updateOrderIfStatus(o.id, 'shipped', { paymentStatus: 'paid' }, 'paid')).toBeNull()
    expect((await repo.updateOrderIfStatus(o.id, 'shipped', { paymentStatus: 'paid' }, 'pending')).paymentStatus).toBe('paid')
  })
})

describe('(4) phân quyền cod-collected', () => {
  it('khách 403, ẩn danh 401, không đổi dữ liệu', async () => {
    const o = await mk({}, { status: 'shipped' })
    expect((await collect(o.code, customer.token)).status).toBe(403)
    expect((await collect(o.code, null)).status).toBe(401)
    expect((await repo.getOrderByCode(o.code)).paymentStatus).toBe('pending')
    expect(await audits(o, 'cod_collected')).toHaveLength(0)
  })
  it('ghi chú dài bị cắt 300 ký tự; note không phải chuỗi → null', async () => {
    const o = await mk({}, { status: 'shipped' })
    await collect(o.code, admin.token, { note: 'x'.repeat(500) })
    expect((await audits(o, 'cod_collected'))[0].newValue.note).toHaveLength(300)
    const p = await mk({}, { status: 'shipped' })
    await collect(p.code, admin.token, { note: { a: 1 } })
    expect((await audits(p, 'cod_collected'))[0].newValue.note).toBeNull()
  })
})

describe('(6) Mây', () => {
  it('orderForMay trả paymentStatus paid cho COD đã giao (không lỗi)', async () => {
    const o = await mk()
    await setStatus(o.code, 'delivered')
    const after = await repo.getOrderByCode(o.code)
    expect(after.paymentStatus).toBe('paid')
  })
})
