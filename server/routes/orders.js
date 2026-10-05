import { createHash, timingSafeEqual } from 'node:crypto'
import { Router } from 'express'
import { HttpError, notFound } from '../errors.js'
import { normalizeLang } from '../i18n.js'
import { requireAuth } from '../middleware/auth.js'
import { validateCheckout } from '../domain/order.js'
import { parseWebhook } from '../adapters/payos.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { DEFAULT_HASH_SALT } from '../config.js'

// So sánh bí mật không lộ độ dài/thời gian (băm về cùng độ dài rồi timingSafeEqual)
const sha = (v) => createHash('sha256').update(v).digest()
const safeEqual = (a, b) => timingSafeEqual(sha(a), sha(b))

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

// Đơn hiển thị cho khách — không trả trường nội bộ (payosOrderCode, paymentFlag, userId)
function presentOrder(o, { lang = 'vi' } = {}) {
  const pick = (v) => (v && typeof v === 'object' ? (v[lang] ?? v.vi ?? null) : (v ?? null))
  return {
    code: o.code,
    status: o.status,
    orderKind: o.orderKind,
    hasMessage: o.hasMessage,
    qrLang: o.qrLang,
    recipientIsSelf: o.recipientIsSelf,
    recipientName: o.recipientName,
    recipientPhone: o.recipientPhone,
    addressLine: o.addressLine,
    ward: o.ward,
    district: o.district,
    province: o.province,
    provinceCode: o.provinceCode ?? null,
    wardCode: o.wardCode ?? null,
    note: o.note,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    paymentExpiresAt: o.paymentExpiresAt,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    total: o.total,
    vatAmount: o.vatAmount,
    vatRate: o.vatRate,
    couponCode: o.couponCode,
    trackingCode: o.trackingCode,
    cancelledAt: o.cancelledAt,
    createdAt: o.createdAt,
    currency: 'VND',
    items: (o.items ?? []).map((i) => ({
      slug: i.slug,
      name: pick(i.name),
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
  }
}

/**
 * Checkout, đơn hàng của tôi (FR-CHK-*, FR-ORD-001, FR-ACC-002) và webhook payOS (FR-PAY-001).
 * Webhook KHÔNG yêu cầu đăng nhập — bảo vệ bằng chữ ký (NFR-SEC-002).
 */
export function ordersRouter({ repo, auth, orders, config, payos = null, messages = null }) {
  const r = Router()
  const guard = requireAuth(auth)
  const lang = (req) => normalizeLang(req.query.lang)
  // G-20: chặn tạo đơn và xin link thanh toán hàng loạt (giữ lượt coupon, tạo link payOS rác).
  // Đặt SAU `guard`: nếu đặt trước thì request không có token (đều 401) vẫn tiêu hạn mức của cả
  // IP, và khách hợp lệ dùng chung IP (NAT nhà mạng, văn phòng) sẽ bị chặn oan.
  const limitOn = (name) =>
    rateLimit({
      repo,
      salt: config.mayHashSalt ?? DEFAULT_HASH_SALT,
      name,
      max: config.rateLimit?.order?.max ?? 20,
      windowSec: config.rateLimit?.order?.windowSec ?? 3600,
      // Đã qua `guard` nên đếm theo người dùng, không theo IP
      keys: (req) => [`u:${req.user.id}`],
      enabled: config.rateLimit?.enabled !== false,
    })
  const orderLimit = limitOn('order')
  const paymentLinkLimit = limitOn('payment-link')
  const mediaLimit = limitOn('gift-media')

  // FR-CHK-008: bảng giá của giỏ, kèm coupon nếu có (FR-CHK-006)
  r.post('/checkout/quote', guard, async (req, res) => {
    const { view } = await orders.quoteCart(req.user.id, { couponCode: body(req).couponCode, lang: lang(req) })
    res.json(view)
  })

  // FR-CHK-001: chỉ khách đã đăng nhập (D-36, BR-ACC-001)
  r.post('/orders', guard, orderLimit, async (req, res) => {
    const b = body(req)
    const { errors, values } = validateCheckout(b)
    if (Object.keys(errors).length) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
    }
    // COD chỉ khi không có cổng thanh toán? Không — COD luôn có. payOS cần cấu hình cổng.
    if (values.paymentMethod === 'payos' && !payos) {
      throw new HttpError(503, 'PAYMENT_UNAVAILABLE', 'Thanh toán trực tuyến chưa sẵn sàng')
    }
    // D-41: client gửi expectedTotal sai kiểu → báo lỗi thay vì âm thầm bỏ bước chốt giá.
    // Không gửi (undefined/null) là hợp lệ: server vẫn là nguồn sự thật về giá.
    const expectedTotal = b.expectedTotal ?? undefined
    if (expectedTotal !== undefined && !(Number.isInteger(expectedTotal) && expectedTotal >= 0)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { expectedTotal: 'INVALID' })
    }
    const { order, payment } = await orders.createOrder({
      userId: req.user.id,
      checkout: values,
      expectedTotal,
      lang: lang(req),
      siteUrl: config.publicSiteUrl,
    })
    res.status(201).json({ order: presentOrder(order, { lang: lang(req) }), payment })
  })

  // FR-ACC-002: đơn của tôi
  r.get('/orders', guard, async (req, res) => {
    const list = await repo.listOrdersByUser(req.user.id)
    // BR-PAY-003: danh sách và trang chi tiết phải nói cùng một trạng thái, kể cả khi cron chưa chạy
    const items = await Promise.all(list.map((o) => orders.expireIfDue(o)))
    res.json({ items: items.map((o) => presentOrder(o, { lang: lang(req) })) })
  })

  r.get('/orders/:code', guard, async (req, res) => {
    const found = await repo.getOrderByCode(req.params.code)
    // Không phải đơn của mình → 404 (không xác nhận mã đơn có tồn tại hay không)
    if (!found || found.userId !== req.user.id) throw notFound()
    // BR-PAY-003: hết hạn thanh toán thì huỷ ngay khi khách mở đơn, không chờ cron
    const order = await orders.expireIfDue(found)
    res.json({ item: presentOrder(order, { lang: lang(req) }) })
  })

  // FR-MSG-001, FR-ACC-003, US-003: soạn/sửa lời chúc của đơn mình. Không phải đơn của mình → 404.
  if (messages) {
    const mine = async (req) => {
      const order = await repo.getOrderByCode(req.params.code)
      if (!order || order.userId !== req.user.id) throw notFound()
      return order
    }
    r.get('/orders/:code/message', guard, async (req, res) => {
      res.json({ item: await messages.ownerView(await mine(req)) })
    })
    r.put('/orders/:code/message', guard, async (req, res) => {
      res.json({ item: await messages.saveText(await mine(req), body(req)) })
    })
    r.post('/orders/:code/message/media-upload', guard, mediaLimit, async (req, res) => {
      res.status(201).json(await messages.createMediaUpload(await mine(req), body(req)))
    })
    r.post('/orders/:code/message/media', guard, async (req, res) => {
      res.json({ item: await messages.attachMedia(await mine(req), body(req)) })
    })
    r.delete('/orders/:code/message/media/:kind', guard, async (req, res) => {
      res.json({ item: await messages.removeMedia(await mine(req), req.params.kind) })
    })
  }

  // FR-PAY-001: lấy lại liên kết thanh toán (lần tạo đơn gặp lỗi cổng, hoặc khách quay lại sau)
  r.post('/orders/:code/payment', guard, paymentLinkLimit, async (req, res) => {
    const order = await repo.getOrderByCode(req.params.code)
    if (!order || order.userId !== req.user.id) throw notFound()
    res.json({ payment: await orders.paymentLinkFor(order, { siteUrl: config.publicSiteUrl }) })
  })

  // FR-ORD-001 / BR-ORD-001
  r.post('/orders/:code/cancel', guard, async (req, res) => {
    const order = await repo.getOrderByCode(req.params.code)
    if (!order || order.userId !== req.user.id) throw notFound()
    const updated = await orders.cancelByCustomer(order, req.user.id, body(req).reason)
    res.json({ item: presentOrder(updated, { lang: lang(req) }) })
  })

  /**
   * BR-PAY-003: quét đơn payOS quá hạn. Trên serverless không có tiến trình nền, nên việc này do
   * lịch chạy ngoài gọi vào (Vercel Cron). Bảo vệ bằng CRON_SECRET; thiếu secret → tắt endpoint.
   */
  // Vercel Cron gọi bằng GET và tự gắn `Authorization: Bearer $CRON_SECRET`; nhận cả POST để
  // gọi tay được lúc vận hành.
  r.all('/internal/expire-orders', async (req, res) => {
    if (req.method !== 'GET' && req.method !== 'POST') throw new HttpError(405, 'METHOD_NOT_ALLOWED', 'Không hỗ trợ')
    const secret = config.cronSecret
    if (!secret) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy')
    const given = req.get('authorization')
    if (!safeEqual(given ?? '', `Bearer ${secret}`)) throw new HttpError(401, 'UNAUTHORIZED', 'Chưa xác thực')
    const cancelled = await orders.expirePendingOrders()
    // D-26, D-75: dùng chung lịch cron này để xoá media lời chúc quá hạn (Hobby chỉ có 1 cron/ngày)
    const mediaPurged = messages ? await messages.purgeExpiredMedia() : 0
    res.json({ cancelled: cancelled.length, mediaPurged })
  })

  // FR-PAY-001: webhook payOS. NFR-SEC-002 — xác minh chữ ký trước khi xử lý.
  // Luôn trả 200 khi chữ ký hợp lệ để payOS không gửi lại vô hạn với case đã xử lý.
  r.post('/payments/payos/webhook', async (req, res) => {
    if (!payos) throw new HttpError(503, 'PAYMENT_UNAVAILABLE', 'Chưa cấu hình cổng thanh toán')
    const parsed = parseWebhook(req.body, payos.checksumKey)
    if (!parsed.ok) {
      // Chữ ký sai → 401, không tiết lộ thêm
      const status = parsed.reason === 'INVALID_SIGNATURE' ? 401 : 400
      throw new HttpError(status, parsed.reason, 'Webhook không hợp lệ')
    }
    const result = await orders.applyPayosWebhook(parsed)
    res.json({ received: true, handled: result.handled })
  })

  return r
}

export { presentOrder }
