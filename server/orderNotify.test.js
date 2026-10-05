// Thông báo đơn hàng qua email (§20, Q-24 → email, T-55, D-41).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'
import { createMemoryMailer } from './mail/mailer.js'
import { createOrderService, PAYMENT_WINDOW_MS } from './orders/service.js'
import { createOrderNotifier } from './orders/notify.js'
import { orderMail } from './mail/templates.js'
import { signData } from './adapters/payos.js'

const CHECKSUM = 'khoa-checksum-thu'
const SITE = 'https://lamvi.test'
const config = { publicSiteUrl: SITE, cronSecret: 'bimat-cron', rateLimit: { enabled: false } }

let app, repo, auth, mailer, clock, customer, admin, payos

const fakePayos = () => ({
  checksumKey: CHECKSUM,
  createPaymentLink: vi.fn(async (p) => ({ checkoutUrl: `https://pay.test/${p.orderCode}`, qrCode: 'QR' })),
  cancelPaymentLink: vi.fn(async () => {}),
})

async function login(email, role = 'customer', extra = {}) {
  const { user } = await auth.signUp({ email, password: 'matkhau123' })
  await repo.upsertProfile({ id: user.id, fullName: 'Nguyễn An', role, email, preferredLocale: 'vi', ...extra })
  const s = await auth.signIn({ email, password: 'matkhau123' })
  return { id: user.id, token: `Bearer ${s.accessToken}` }
}

function build({ mail = mailer, waitMs } = {}) {
  payos = fakePayos()
  const orders = createOrderService({
    repo,
    payos,
    now: () => clock,
    notify: createOrderNotifier({ repo, mailer: mail, siteUrl: SITE, ...(waitMs ? { waitMs } : {}) }),
  })
  return createApp({ repo, auth, storage: createMemoryStorage(), config, payos, orders, mailer: mail })
}

beforeEach(async () => {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  mailer = createMemoryMailer()
  clock = new Date('2026-10-01T03:00:00.000Z')
  app = build()
  customer = await login('khach@lamvi.test')
  admin = await login('admin@lamvi.test', 'admin')
})

const CHECKOUT = {
  orderKind: 'self',
  recipientIsSelf: true,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông',
  province: 'Hà Nội',
  paymentMethod: 'cod',
}
async function place(over = {}, who = customer) {
  await request(app).put('/api/cart/items/den-nguyet').set('Authorization', who.token).send({ quantity: 1 })
  const r = await request(app).post('/api/orders').set('Authorization', who.token).send({ ...CHECKOUT, ...over })
  expect(r.status).toBe(201)
  return r.body.order.code
}
const adminMove = (code, status, extra = {}) =>
  request(app).post(`/api/admin/orders/${code}/status`).set('Authorization', admin.token).send({ status, ...extra })
const subjects = () => mailer.outbox.map((m) => m.subject)

describe('Đơn được xác nhận (§20)', () => {
  it('COD: báo ngay khi tạo đơn, gửi tới email tài khoản, có mã đơn, sản phẩm, tổng tiền, link tới đơn', async () => {
    const code = await place()
    expect(mailer.outbox).toHaveLength(1)
    const m = mailer.outbox[0]
    expect(m.to).toBe('khach@lamvi.test')
    expect(m.subject).toBe(`LAMVI — Đã xác nhận đơn ${code}`)
    expect(m.text).toContain('Đèn Nguyệt × 1')
    expect(m.text).toContain('920.000')
    expect(m.text).toContain(`${SITE}/don-hang/${code}`)
    expect(m.html).toContain(`href="${SITE}/don-hang/${code}"`)
    expect(m.text).toContain('Chào Nguyễn An,')
  })

  it('payOS: tạo đơn chưa báo; trả tiền xong (webhook) mới báo; webhook gửi lại không sinh thư thứ hai (BR-PAY-002)', async () => {
    const code = await place({ paymentMethod: 'payos' })
    expect(mailer.outbox).toHaveLength(0)
    const o = await repo.getOrderByCode(code)
    const data = { orderCode: o.payosOrderCode, amount: o.total, code: '00' }
    const hook = () => request(app).post('/api/payments/payos/webhook').send({ code: '00', desc: 'ok', data, signature: signData(data, CHECKSUM) })
    expect((await hook()).status).toBe(200)
    expect(subjects()).toEqual([`LAMVI — Đã xác nhận đơn ${code}`])
    await hook()
    await hook()
    expect(mailer.outbox).toHaveLength(1)
  })

  it('payOS lệch số tiền (không xác nhận) → không báo "đã xác nhận"', async () => {
    const code = await place({ paymentMethod: 'payos' })
    const o = await repo.getOrderByCode(code)
    const data = { orderCode: o.payosOrderCode, amount: o.total - 1, code: '00' }
    await request(app).post('/api/payments/payos/webhook').send({ code: '00', desc: 'ok', data, signature: signData(data, CHECKSUM) })
    expect(mailer.outbox).toHaveLength(0)
  })

  it('đơn có lời chúc: thư nhắc cách soạn; không chứa token QR hay nội dung lời chúc (BR-QR-001, D-89)', async () => {
    const code = await place({ hasMessage: true, qrLang: 'vi' })
    const o = await repo.getOrderByCode(code)
    await request(app).put(`/api/orders/${code}/message`).set('Authorization', customer.token).send({ text: 'Lời chúc bí mật' })
    const m = mailer.outbox[0]
    expect(m.text).toContain('lời chúc')
    expect(m.text + m.html).not.toContain(o.qrToken)
    expect(m.text + m.html).not.toContain('/qr/')
    expect(m.text + m.html).not.toContain('bí mật')
  })

  it('đơn không có lời chúc: không nhắc soạn lời chúc', async () => {
    await place({ hasMessage: false })
    expect(mailer.outbox[0].text).not.toMatch(/lời chúc/i)
  })
})

describe('Ngôn ngữ thông báo = ngôn ngữ ưa thích của tài khoản (D-41)', () => {
  it.each([
    ['en', 'LAMVI — Order', 'View order', '/en/don-hang/'],
    ['zh', 'LAMVI — 订单', '查看订单', '/zh/don-hang/'],
    ['vi', 'LAMVI — Đã xác nhận đơn', 'Xem đơn hàng', '/don-hang/'],
  ])('%s', async (lang, subj, cta, path) => {
    const who = await login(`${lang}@lamvi.test`, 'customer', { preferredLocale: lang })
    const code = await place({}, who)
    const m = mailer.outbox.at(-1)
    expect(m.subject).toContain(subj)
    expect(m.text).toContain(cta)
    expect(m.text).toContain(`${SITE}${path}${code}`)
  })

  it('tên sản phẩm lấy theo ngôn ngữ, thiếu bản dịch thì dùng tiếng Việt', () => {
    const order = { code: 'LV1', total: 100, items: [{ slug: 'x', name: { vi: 'Đèn Việt', en: 'English lamp' }, quantity: 2, lineTotal: 100 }] }
    expect(orderMail({ kind: 'confirmed', lang: 'en', order, siteUrl: SITE }).text).toContain('English lamp × 2')
    expect(orderMail({ kind: 'confirmed', lang: 'zh', order, siteUrl: SITE }).text).toContain('Đèn Việt × 2')
  })

  it('ngôn ngữ lạ → tiếng Việt', () => {
    expect(orderMail({ kind: 'shipped', lang: 'fr', order: { code: 'LV1', items: [], total: 0 }, siteUrl: SITE }).subject).toBe('LAMVI — Đơn LV1 đã được gửi đi')
  })
})

describe('Đơn đã gửi, huỷ, hoàn tiền, hết hạn thanh toán (§20)', () => {
  it('admin chuyển sang SHIPPED → báo kèm mã vận đơn; các bước khác không báo', async () => {
    const code = await place()
    mailer.outbox.length = 0
    await adminMove(code, 'in_production')
    await adminMove(code, 'packed')
    expect(mailer.outbox).toHaveLength(0)
    await adminMove(code, 'shipped', { trackingCode: 'VN123456789' })
    expect(subjects()).toEqual([`LAMVI — Đơn ${code} đã được gửi đi`])
    expect(mailer.outbox[0].text).toContain('Mã vận đơn: VN123456789')
    await adminMove(code, 'delivered')
    expect(mailer.outbox).toHaveLength(1)
  })

  it('đơn tặng đã gửi: nhắc người nhận quét QR; không kèm token', async () => {
    const code = await place({ hasMessage: true, qrLang: 'en' })
    const o = await repo.getOrderByCode(code)
    mailer.outbox.length = 0
    for (const s of ['in_production', 'packed', 'shipped']) await adminMove(code, s)
    expect(mailer.outbox[0].text).toContain('QR')
    expect(mailer.outbox[0].text + mailer.outbox[0].html).not.toContain(o.qrToken)
  })

  it('chuyển SHIPPED không hợp lệ (409) → không báo', async () => {
    const code = await place()
    mailer.outbox.length = 0
    expect((await adminMove(code, 'shipped')).status).toBe(409)
    expect(mailer.outbox).toHaveLength(0)
  })

  it('khách huỷ đơn COD → báo huỷ; huỷ lần hai không báo lại', async () => {
    const code = await place()
    mailer.outbox.length = 0
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer.token).send({})
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer.token).send({})
    expect(subjects()).toEqual([`LAMVI — Đơn ${code} đã được huỷ`])
    expect(mailer.outbox[0].text).not.toMatch(/hoàn tiền/)
  })

  it('đơn đã trả tiền bị huỷ → báo sẽ hoàn tiền (D-74); admin ghi nhận hoàn → báo đã hoàn', async () => {
    const code = await place({ paymentMethod: 'payos' })
    const o = await repo.getOrderByCode(code)
    const data = { orderCode: o.payosOrderCode, amount: o.total, code: '00' }
    await request(app).post('/api/payments/payos/webhook').send({ code: '00', desc: 'ok', data, signature: signData(data, CHECKSUM) })
    mailer.outbox.length = 0
    await request(app).post(`/api/orders/${code}/cancel`).set('Authorization', customer.token).send({})
    expect(mailer.outbox[0].text).toContain('hoàn tiền')
    await request(app).post(`/api/admin/orders/${code}/refund`).set('Authorization', admin.token).send({ note: 'ck' })
    expect(subjects()).toEqual([`LAMVI — Đơn ${code} đã được huỷ`, `LAMVI — Đã hoàn tiền đơn ${code}`])
  })

  it('admin huỷ đơn → báo huỷ', async () => {
    const code = await place()
    mailer.outbox.length = 0
    await adminMove(code, 'cancelled')
    expect(subjects()).toEqual([`LAMVI — Đơn ${code} đã được huỷ`])
  })

  it('đơn payOS quá hạn: báo đúng một lần dù cron và khách mở đơn cùng lúc', async () => {
    const code = await place({ paymentMethod: 'payos' })
    clock = new Date(clock.getTime() + PAYMENT_WINDOW_MS + 1000)
    const cron = () => request(app).get('/api/internal/expire-orders').set('Authorization', 'Bearer bimat-cron')
    await Promise.all([cron(), cron(), request(app).get(`/api/orders/${code}`).set('Authorization', customer.token)])
    expect(subjects()).toEqual([`LAMVI — Đơn ${code} đã hết hạn thanh toán`])
  })
})

describe('Độ bền: thư lỗi không được làm hỏng thao tác chính', () => {
  const failing = () => ({ provider: 'resend', send: vi.fn(async () => { throw new Error('Authorization: Bearer re_khoa-bi-mat') }), ping: async () => ({}) })

  it('Resend lỗi → đơn vẫn tạo được (201), không lộ khoá ra log hay phản hồi', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bad = failing()
    app = build({ mail: bad })
    customer = await login('khach2@lamvi.test')
    const r = await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer.token).send({ quantity: 1 })
    expect(r.status).toBe(200)
    const created = await request(app).post('/api/orders').set('Authorization', customer.token).send(CHECKOUT)
    expect(created.status).toBe(201)
    expect(bad.send).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(created.body)).not.toContain('bi-mat')
    expect(JSON.stringify(err.mock.calls)).not.toContain('bi-mat')
    err.mockRestore()
  })

  it('Resend treo → không chờ quá hạn, đơn vẫn xong', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    app = build({ mail: { provider: 'resend', send: () => new Promise(() => {}) }, waitMs: 40 })
    customer = await login('khach3@lamvi.test')
    await request(app).put('/api/cart/items/den-nguyet').set('Authorization', customer.token).send({ quantity: 1 })
    const t0 = Date.now()
    const created = await request(app).post('/api/orders').set('Authorization', customer.token).send(CHECKOUT)
    expect(created.status).toBe(201)
    expect(Date.now() - t0).toBeLessThan(2000)
    warn.mockRestore()
  })

  it('chưa cấu hình thư (mailer null) → mọi luồng vẫn chạy, không có thư', async () => {
    app = build({ mail: null })
    customer = await login('khach4@lamvi.test')
    const code = await place({}, customer)
    expect((await adminMove(code, 'in_production')).status).toBe(200)
    expect(mailer.outbox).toHaveLength(0)
  })

  it('hồ sơ chưa có email → bỏ qua, không lỗi', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const noMail = await login('khong-email@lamvi.test')
    await repo.upsertProfile({ id: noMail.id, email: null })
    await place({}, noMail)
    expect(mailer.outbox).toHaveLength(0)
    warn.mockRestore()
  })
})

describe('Mẫu thư', () => {
  const order = {
    code: 'LV2610-AAAAAAA',
    total: 920000,
    trackingCode: '<script>alert(1)</script>',
    hasMessage: false,
    items: [{ slug: 'x', name: { vi: '<img src=x onerror=alert(1)>' }, quantity: 1, lineTotal: 920000 }],
  }

  it('escape HTML trong tên sản phẩm, mã vận đơn, tên người nhận thư', () => {
    const m = orderMail({ kind: 'shipped', lang: 'vi', order, siteUrl: SITE, name: '<b>An</b>' })
    expect(m.html).not.toContain('<script>')
    expect(m.html).not.toContain('<img')
    expect(m.html).not.toContain('<b>An</b>')
    expect(m.html).toContain('&lt;script&gt;')
  })

  it('mọi loại thư có tiêu đề, văn bản và link ở cả ba ngôn ngữ', () => {
    for (const lang of ['vi', 'en', 'zh']) {
      for (const kind of ['confirmed', 'payment_expired', 'shipped', 'cancelled', 'refunded']) {
        const m = orderMail({ kind, lang, order: { ...order, trackingCode: 'T1' }, siteUrl: SITE })
        expect(m.subject, `${lang}/${kind}`).toContain('LV2610-AAAAAAA')
        expect(m.text).toContain(`/don-hang/LV2610-AAAAAAA`)
        expect(m.text).not.toMatch(/\{\w+\}/) // không còn biến chưa thay
      }
    }
  })

  it('loại thư lạ → ném lỗi (lỗi lập trình, không gửi thư rác)', () => {
    expect(() => orderMail({ kind: 'spam', lang: 'vi', order, siteUrl: SITE })).toThrow()
  })
})
