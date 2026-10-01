import { Router } from 'express'
import { normalizeLang } from '../i18n.js'
import { requireAuth } from '../middleware/auth.js'

// Checkout + đơn của tôi (FR-CHK-*, FR-ACC-002) + webhook payOS (FR-PAY-001)
export function ordersRouter({ auth, orders, payments }) {
  const r = Router()
  const guard = requireAuth(auth)
  const lang = (req) => normalizeLang(req.query.lang)
  const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

  // FR-CHK-008: bảng giá theo giỏ trên server + coupon + loại người nhận
  r.post('/checkout/quote', guard, async (req, res) => {
    const b = body(req)
    res.json(await orders.quote(req.user.id, { couponCode: typeof b.couponCode === 'string' ? b.couponCode : null, recipientType: b.recipientType }, lang(req)))
  })

  r.post('/orders', guard, async (req, res) => {
    res.status(201).json(await orders.create(req.user.id, body(req), lang(req)))
  })
  r.get('/orders', guard, async (req, res) => {
    res.json(await orders.list(req.user.id, lang(req)))
  })
  r.get('/orders/:id', guard, async (req, res) => {
    res.json(await orders.get(req.user.id, req.params.id, lang(req)))
  })
  r.post('/orders/:id/cancel', guard, async (req, res) => {
    res.json(await orders.cancel(req.user.id, req.params.id, lang(req)))
  })
  r.post('/orders/:id/pay', guard, async (req, res) => {
    res.json(await orders.pay(req.user.id, req.params.id))
  })

  // BR-PAY-001: nguồn sự thật duy nhất để xác nhận đơn payOS
  r.post('/payments/payos/webhook', async (req, res) => {
    res.json(await orders.handleWebhook(req.body))
  })

  // T-25: payOS giả lập (chỉ khi chưa cấu hình PAYOS_*)
  if (payments?.devRouter) r.use(payments.devRouter((b) => orders.handleWebhook(b)))
  return r
}
