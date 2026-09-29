// Cổng thanh toán payOS (FR-PAY-001, §15.1, D-35). Chữ ký HMAC-SHA256 bằng checksum key.
//
// NFR-SEC-002: webhook PHẢI được xác minh chữ ký trước khi xử lý. Chữ ký payOS được tính trên
// chuỗi `key=value` của đối tượng `data`, các khoá sắp xếp theo bảng chữ cái, nối bằng '&'.
import { createHmac, timingSafeEqual } from 'node:crypto'

const API_BASE = 'https://api-merchant.payos.vn'

/** Chuỗi ký của một object: khoá sắp xếp a→z, nối `k=v` bằng '&'. Giá trị rỗng → chuỗi rỗng. */
export function signaturePayload(data) {
  return Object.keys(data)
    .sort()
    .map((k) => {
      const v = data[k]
      const s = v === null || v === undefined ? '' : Array.isArray(v) || typeof v === 'object' ? JSON.stringify(v) : String(v)
      return `${k}=${s}`
    })
    .join('&')
}

export const signData = (data, checksumKey) =>
  createHmac('sha256', checksumKey).update(signaturePayload(data), 'utf8').digest('hex')

/** So sánh chữ ký theo thời gian hằng định (không để lộ vị trí ký tự sai). */
export function verifySignature(data, signature, checksumKey) {
  if (typeof signature !== 'string' || !signature) return false
  const expected = signData(data, checksumKey)
  const a = Buffer.from(expected, 'utf8')
  const b = Buffer.from(signature, 'utf8')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Kiểm tra và bóc tách webhook payOS.
 * Chỉ trả dữ liệu khi chữ ký hợp lệ; mọi trường hợp khác trả { ok: false, reason }.
 */
export function parseWebhook(body, checksumKey) {
  if (!body || typeof body !== 'object') return { ok: false, reason: 'INVALID_BODY' }
  const { data, signature } = body
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { ok: false, reason: 'INVALID_BODY' }
  if (!verifySignature(data, signature, checksumKey)) return { ok: false, reason: 'INVALID_SIGNATURE' }

  const orderCode = Number(data.orderCode)
  if (!Number.isSafeInteger(orderCode) || orderCode <= 0) return { ok: false, reason: 'INVALID_ORDER_CODE' }
  const amount = Number(data.amount)
  if (!Number.isFinite(amount)) return { ok: false, reason: 'INVALID_AMOUNT' }

  return {
    ok: true,
    orderCode,
    amount,
    // '00' = thành công theo tài liệu payOS
    paid: String(data.code ?? body.code) === '00',
    reference: typeof data.reference === 'string' ? data.reference : null,
    transactionDateTime: typeof data.transactionDateTime === 'string' ? data.transactionDateTime : null,
  }
}

/**
 * Adapter gọi API payOS. Không có đủ khoá → trả null để server chạy được ở dev (T-04):
 * khi đó checkout chỉ cho phép COD.
 */
export function createPayosClient({ clientId, apiKey, checksumKey, fetchImpl = fetch, baseUrl = API_BASE }) {
  if (!clientId || !apiKey || !checksumKey) return null

  async function call(path, { method = 'GET', body } = {}) {
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: { 'x-client-id': clientId, 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!res.ok || !json) {
      throw Object.assign(new Error(`payOS ${path} ${res.status}`), { code: 'PAYMENT_GATEWAY_ERROR' })
    }
    if (json.code !== '00') {
      throw Object.assign(new Error(`payOS ${path}: ${json.desc}`), { code: 'PAYMENT_GATEWAY_ERROR', desc: json.desc })
    }
    return json.data
  }

  return {
    checksumKey,

    /**
     * Tạo link thanh toán. Chữ ký của yêu cầu tính trên đúng 5 trường theo tài liệu payOS
     * (amount, cancelUrl, description, orderCode, returnUrl).
     */
    async createPaymentLink({ orderCode, amount, description, returnUrl, cancelUrl, expiredAt, items }) {
      const signed = { amount, cancelUrl, description, orderCode, returnUrl }
      const data = await call('/v2/payment-requests', {
        method: 'POST',
        body: {
          ...signed,
          items,
          // payOS nhận thời điểm hết hạn dạng Unix giây
          expiredAt: expiredAt ? Math.floor(expiredAt / 1000) : undefined,
          signature: signData(signed, checksumKey),
        },
      })
      return { checkoutUrl: data.checkoutUrl, paymentLinkId: data.paymentLinkId, qrCode: data.qrCode }
    },

    /** Chủ động hỏi trạng thái khi webhook về chậm (§15.1, D-41). */
    async getPaymentLink(orderCode) {
      const data = await call(`/v2/payment-requests/${orderCode}`)
      return { status: data.status, amountPaid: data.amountPaid, transactions: data.transactions ?? [] }
    },

    async cancelPaymentLink(orderCode, reason) {
      await call(`/v2/payment-requests/${orderCode}/cancel`, {
        method: 'POST',
        body: { cancellationReason: reason ?? 'Đơn đã huỷ' },
      })
    },
  }
}
