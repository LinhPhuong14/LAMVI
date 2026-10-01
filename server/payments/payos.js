import { createHmac, timingSafeEqual } from 'node:crypto'

// payOS (D-35, §15.1). Chi tiết API theo tài liệu payOS — tech lead xác nhận khi có tài khoản thật (G-33).
// Interface chung với fakePayos.js:
//   createPaymentLink({ orderCode, amount, description, items, returnUrl, cancelUrl, expiredAt })
//     → { checkoutUrl, paymentLinkId }
//   getPayment(orderCode) → { status: 'PENDING'|'PAID'|'CANCELLED'|'EXPIRED', amountPaid, reference } | null
//   cancelPaymentLink(orderCode)
//   verifyWebhook(body) → data đã xác minh chữ ký | null

export const hmac = (key, s) => createHmac('sha256', key).update(s).digest('hex')

// Chữ ký webhook: các khoá của data sắp xếp a→z, nối `k=v&…`; null/undefined → chuỗi rỗng
export function signData(data, key) {
  const s = Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k]
      const str = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v)
      return `${k}=${str}`
    })
    .join('&')
  return hmac(key, s)
}

export function safeEqualHex(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

export function verifyWebhookBody(body, checksumKey) {
  if (!body || typeof body !== 'object' || !body.data || typeof body.data !== 'object') return null
  return safeEqualHex(signData(body.data, checksumKey), body.signature) ? body.data : null
}

export function createPayos({ clientId, apiKey, checksumKey, baseUrl = 'https://api-merchant.payos.vn', fetchImpl = fetch, timeoutMs = 15_000 }) {
  async function call(method, path, body) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { 'content-type': 'application/json', 'x-client-id': clientId, 'x-api-key': apiKey },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(timeoutMs),
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || json?.code !== '00') {
      const err = new Error(`payOS ${method} ${path}: ${res.status} ${json?.code ?? ''} ${json?.desc ?? ''}`)
      err.payosCode = json?.code
      throw err
    }
    return json.data
  }

  return {
    name: 'payos',
    async createPaymentLink({ orderCode, amount, description, items, returnUrl, cancelUrl, expiredAt }) {
      const signature = hmac(checksumKey, `amount=${amount}&cancelUrl=${cancelUrl}&description=${description}&orderCode=${orderCode}&returnUrl=${returnUrl}`)
      const data = await call('POST', '/v2/payment-requests', { orderCode, amount, description, items, returnUrl, cancelUrl, expiredAt, signature })
      return { checkoutUrl: data.checkoutUrl, paymentLinkId: data.paymentLinkId }
    },
    async getPayment(orderCode) {
      const data = await call('GET', `/v2/payment-requests/${orderCode}`)
      if (!data) return null
      const tx = (data.transactions ?? []).at(-1)
      return { status: data.status, amountPaid: data.amountPaid ?? 0, reference: tx?.reference ?? null }
    },
    async cancelPaymentLink(orderCode) {
      await call('POST', `/v2/payment-requests/${orderCode}/cancel`, { cancellationReason: 'Huỷ đơn' })
    },
    verifyWebhook: (body) => verifyWebhookBody(body, checksumKey),
  }
}
