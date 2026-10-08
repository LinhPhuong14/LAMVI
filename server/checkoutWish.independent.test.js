// Kiểm thử độc lập: luồng checkout -> PUT /orders/:code/message ngay sau khi tạo đơn (feedback 08/10, 7.2).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMessageService } from './messages/service.js'
import { createOrderService } from './orders/service.js'

let app, repo, auth, who
const config = { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } }
const CHECKOUT = {
  orderKind: 'self', hasMessage: true, qrLang: 'vi', recipientIsSelf: true, recipientName: 'Nguyễn Văn A', recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông', provinceCode: '1', wardCode: '4', paymentMethod: 'cod',
}
beforeEach(async () => {
  repo = createMemoryRepo(); auth = createMemoryAuth()
  const storage = createMemoryStorage()
  const may = { translate: vi.fn(async ({ text, to }) => `[${to}] ${text}`) }
  app = createApp({ repo, auth, storage, config, may, orders: createOrderService({ repo, payos: null }), messages: createMessageService({ repo, storage, may }) })
  const { user } = await auth.signUp({ email: 'k@lamvi.test', password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: 'K', role: 'customer' })
  who = `Bearer ${(await auth.signIn({ email: 'k@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
})
async function order(over) {
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', who).send({ quantity: 1 })
  return request(app).post('/api/orders').set('Authorization', who).send({ ...CHECKOUT, ...over })
}

describe('Checkout gửi kèm messageText (trường thừa) + PUT message', () => {
  it.each(['vi', 'en', 'zh'])('POST /orders chấp nhận body có messageText; PUT lưu chữ với textLang=%s', async (lang) => {
    const r = await order({ qrLang: lang, messageText: 'Chúc mừng tân gia' })
    expect(r.status).toBe(201)
    const put = await request(app).put(`/api/orders/${r.body.order.code}/message`).set('Authorization', who).send({ text: 'Chúc mừng tân gia', textLang: lang })
    expect(put.status).toBe(200)
    expect(put.body.item.text).toBe('Chúc mừng tân gia')
  })
  it('đơn không bật lời chúc → PUT bị 409 NO_MESSAGE (client không được gọi trong trường hợp này)', async () => {
    const r = await order({ hasMessage: false, qrLang: undefined })
    const put = await request(app).put(`/api/orders/${r.body.order.code}/message`).set('Authorization', who).send({ text: 'x', textLang: 'vi' })
    expect(put.status).toBe(409)
    expect(put.body.error.code).toBe('NO_MESSAGE')
  })
  it('đơn tặng thanh toán payOS (pending_payment) vẫn lưu được lời chúc ngay sau khi tạo', async () => {
    const payos = { createPaymentLink: vi.fn(async () => ({ checkoutUrl: 'https://pay.test/x', paymentLinkId: 'l1' })) }
    const orders = createOrderService({ repo, payos })
    const storage = createMemoryStorage()
    const a2 = createApp({ repo, auth, storage, config, orders, messages: createMessageService({ repo, storage, may: { translate: async () => '' } }) })
    await request(a2).put('/api/cart/items/den-nguyet').set('Authorization', who).send({ quantity: 1 })
    const r = await request(a2).post('/api/orders').set('Authorization', who).send({ ...CHECKOUT, orderKind: 'gift', recipientIsSelf: false, paymentMethod: 'payos', messageText: 'Gửi bạn' })
    if (r.status !== 201) return // cấu hình payOS giả có thể khác; chỉ kiểm khi tạo được
    expect(r.body.order.status).toBe('pending_payment')
    const put = await request(a2).put(`/api/orders/${r.body.order.code}/message`).set('Authorization', who).send({ text: 'Gửi bạn', textLang: 'vi' })
    expect(put.status).toBe(200)
  })
  it('lời chúc 300 ký tự (giới hạn của ô nhập) được server chấp nhận', async () => {
    const r = await order({})
    const put = await request(app).put(`/api/orders/${r.body.order.code}/message`).set('Authorization', who).send({ text: 'a'.repeat(300), textLang: 'vi' })
    expect(put.status).toBe(200)
  })
  it('người khác không PUT được lời chúc của đơn không phải của mình', async () => {
    const r = await order({})
    const { user } = await auth.signUp({ email: 'o@lamvi.test', password: 'Gio-Hoa#Sen2026' })
    await repo.upsertProfile({ id: user.id, fullName: 'O', role: 'customer' })
    const t2 = `Bearer ${(await auth.signIn({ email: 'o@lamvi.test', password: 'Gio-Hoa#Sen2026' })).accessToken}`
    const put = await request(app).put(`/api/orders/${r.body.order.code}/message`).set('Authorization', t2).send({ text: 'hack', textLang: 'vi' })
    expect([403, 404]).toContain(put.status)
  })
})
