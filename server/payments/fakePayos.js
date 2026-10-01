import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { signData, verifyWebhookBody } from './payos.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// payOS giả lập cho dev/test khi chưa có PAYOS_* (T-25). Trang /api/dev/payos/:orderCode bấm "Thanh toán"
// sẽ gửi webhook có chữ ký hợp lệ vào chính server — đi qua đúng luồng xử lý webhook thật.
export function createFakePayos({ publicSiteUrl = 'http://localhost:5173', checksumKey = 'dev-checksum-key', now = () => Date.now() } = {}) {
  const links = new Map() // orderCode → { amount, status, returnUrl, cancelUrl, expiredAt, reference }

  const webhookBody = (orderCode, amount, reference) => {
    const data = {
      orderCode,
      amount,
      description: `MOC ${orderCode}`,
      accountNumber: '0000000000',
      reference,
      transactionDateTime: new Date(now()).toISOString(),
      currency: 'VND',
      paymentLinkId: `fake-${orderCode}`,
      code: '00',
      desc: 'success',
    }
    return { code: '00', desc: 'success', success: true, data, signature: signData(data, checksumKey) }
  }

  const fake = {
    name: 'fake',
    links,
    checksumKey,
    async createPaymentLink({ orderCode, amount, returnUrl, cancelUrl, expiredAt }) {
      links.set(orderCode, { amount, status: 'PENDING', returnUrl, cancelUrl, expiredAt, reference: null })
      return { checkoutUrl: `${publicSiteUrl}/api/dev/payos/${orderCode}`, paymentLinkId: `fake-${orderCode}` }
    },
    async getPayment(orderCode) {
      const l = links.get(orderCode)
      if (!l) return null
      if (l.status === 'PENDING' && l.expiredAt * 1000 <= now()) l.status = 'EXPIRED'
      return { status: l.status, amountPaid: l.status === 'PAID' ? l.paidAmount ?? l.amount : 0, reference: l.reference }
    },
    async cancelPaymentLink(orderCode) {
      const l = links.get(orderCode)
      if (l && l.status === 'PENDING') l.status = 'CANCELLED'
    },
    verifyWebhook: (body) => verifyWebhookBody(body, checksumKey),
    // Giả lập khách trả tiền (test dùng trực tiếp); amount khác để thử AMOUNT_MISMATCH
    pay(orderCode, amount) {
      const l = links.get(orderCode)
      if (!l) return null
      l.status = 'PAID'
      l.paidAmount = amount ?? l.amount
      l.reference = `FT${randomBytes(6).toString('hex').toUpperCase()}`
      return webhookBody(orderCode, l.paidAmount, l.reference)
    },
    // Router dev: trang thanh toán giả. onWebhook = service.handleWebhook
    devRouter(onWebhook) {
      const r = Router()
      r.get('/dev/payos/:orderCode', (req, res) => {
        const code = Number(req.params.orderCode)
        const l = links.get(code)
        if (!l) return res.status(404).type('text').send('Không có link thanh toán')
        res.type('html').send(`<!doctype html><meta charset="utf-8"><title>payOS (giả lập)</title>
<body style="font-family:sans-serif;max-width:420px;margin:40px auto">
<h1>payOS giả lập</h1><p>Đơn <b>${code}</b> — ${esc(l.amount.toLocaleString('vi-VN'))} ₫ — trạng thái ${esc(l.status)}</p>
<form method="post" action="/api/dev/payos/${code}/pay"><button>Thanh toán</button></form>
<form method="post" action="/api/dev/payos/${code}/cancel" style="margin-top:8px"><button>Huỷ</button></form></body>`)
      })
      r.post('/dev/payos/:orderCode/pay', async (req, res) => {
        const code = Number(req.params.orderCode)
        const l = links.get(code)
        if (!l || l.status !== 'PENDING') return res.status(409).type('text').send('Link không còn hiệu lực')
        await onWebhook(fake.pay(code))
        res.redirect(303, l.returnUrl)
      })
      r.post('/dev/payos/:orderCode/cancel', async (req, res) => {
        const l = links.get(Number(req.params.orderCode))
        if (!l) return res.status(404).end()
        res.redirect(303, l.cancelUrl)
      })
      return r
    },
  }
  return fake
}
