import { LOCALES, pick } from '../i18n.js'
import { normalizeVnPhone } from '../domain/account.js'

// Đơn hàng (§12, §16). Trạng thái theo §16 (D-41).
export const ORDER_STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED']
// BR-ORD-001, D-06: hủy được trước SHIPPED
export const CANCELLABLE = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED']
export const PAYMENT_METHODS = ['payos', 'cod']
export const ORDER_TYPES = ['gift', 'self']
export const RECIPIENT_TYPES = ['self', 'other']
// C-11: 4 công đoạn
export const STAGES = [1, 2, 3, 4]
// D-69 (Q-15): hạn link thanh toán payOS
export const PAYMENT_TTL_MS = 15 * 60 * 1000

const text = (v, max, { required = true } = {}) => {
  const t = typeof v === 'string' ? v.trim().replace(/\s+/g, ' ') : ''
  if (!t) return required ? { error: 'REQUIRED' } : { value: null }
  if (t.length > max) return { error: 'TOO_LONG' }
  return { value: t }
}

// §17: địa chỉ VN theo tỉnh/quận/phường — nhập tự do, chưa có danh mục hành chính [ASSUMPTION]
export function validateRecipient(r) {
  const errors = {}
  const values = {}
  const src = r && typeof r === 'object' && !Array.isArray(r) ? r : {}
  for (const [k, max] of [['name', 100], ['province', 100], ['district', 100], ['ward', 100], ['street', 200]]) {
    const x = text(src[k], max)
    if (x.error) errors[k] = x.error
    else values[k] = x.value
  }
  if (src.phone === undefined || src.phone === null || src.phone === '') errors.phone = 'REQUIRED'
  else {
    const p = normalizeVnPhone(src.phone)
    if (!p) errors.phone = 'INVALID_PHONE'
    else values.phone = p
  }
  return { errors, values }
}

const KEY_RE = /^[A-Za-z0-9-]{8,64}$/

export function validateCheckout(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const errors = {}
  const values = {}
  if (!ORDER_TYPES.includes(b.orderType)) errors.orderType = b.orderType === undefined ? 'REQUIRED' : 'INVALID'
  else values.orderType = b.orderType
  if (b.addMessage !== undefined && typeof b.addMessage !== 'boolean') errors.addMessage = 'INVALID'
  // FR-CHK-003, BR-MSG-002: đơn Tặng luôn có lời chúc; đơn Tự mua chỉ khi tích "Thêm lời chúc"
  values.hasMessage = values.orderType === 'gift' || b.addMessage === true
  // D-41: ngôn ngữ trang QR chỉ khi đơn có lời chúc
  if (values.hasMessage) {
    if (!LOCALES.includes(b.qrLang)) errors.qrLang = b.qrLang === undefined ? 'REQUIRED' : 'INVALID'
    else values.qrLang = b.qrLang
  } else values.qrLang = null
  if (!RECIPIENT_TYPES.includes(b.recipientType)) errors.recipientType = b.recipientType === undefined ? 'REQUIRED' : 'INVALID'
  else values.recipientType = b.recipientType
  const rec = validateRecipient(b.recipient)
  for (const [k, v] of Object.entries(rec.errors)) errors[`recipient.${k}`] = v
  values.recipient = rec.values
  if (!PAYMENT_METHODS.includes(b.paymentMethod)) errors.paymentMethod = b.paymentMethod === undefined ? 'REQUIRED' : 'INVALID'
  else values.paymentMethod = b.paymentMethod
  if (b.couponCode !== undefined && b.couponCode !== null && typeof b.couponCode !== 'string') errors.couponCode = 'INVALID'
  else values.couponCode = typeof b.couponCode === 'string' && b.couponCode.trim() ? b.couponCode : null
  if (typeof b.clientKey !== 'string' || !KEY_RE.test(b.clientKey)) errors.clientKey = 'INVALID'
  else values.clientKey = b.clientKey
  // D-41: tổng khách đã thấy; khác tổng tính lại → báo giá mới, yêu cầu xác nhận lại
  if (!Number.isInteger(b.expectedTotal) || b.expectedTotal < 0) errors.expectedTotal = 'INVALID'
  else values.expectedTotal = b.expectedTotal
  return { errors, values }
}

export const canCustomerCancel = (o) => CANCELLABLE.includes(o.status)

// Đơn cho người mua (FR-ACC-002). Không trả cờ nội bộ, ghi chú hoàn tiền.
export function presentOrder(o, lang) {
  return {
    id: o.id,
    code: o.code,
    status: o.status,
    productionStage: o.productionStage ?? null,
    orderType: o.orderType,
    hasMessage: o.hasMessage,
    qrLang: o.qrLang,
    recipientType: o.recipientType,
    recipient: o.recipient,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    couponCode: o.couponCode,
    subtotal: o.subtotal,
    discount: o.discount,
    shippingFee: o.shippingFee,
    vat: o.vat,
    total: o.total,
    currency: 'VND',
    paymentExpiresAt: o.status === 'PENDING_PAYMENT' ? o.paymentExpiresAt : null,
    trackingCode: o.status === 'SHIPPED' || o.status === 'DELIVERED' || o.status === 'DELIVERY_FAILED' ? o.trackingCode : null,
    cancelReason: o.status === 'CANCELLED' ? o.cancelReason : null,
    refundedAmount: o.paymentStatus === 'REFUNDED' ? o.refundedAmount : null,
    canCancel: canCustomerCancel(o),
    canPay: o.status === 'PENDING_PAYMENT' && Boolean(o.checkoutUrl),
    createdAt: o.createdAt,
    items: (o.items ?? []).map((i) => ({
      slug: i.productSlug,
      name: pick(i.productName, lang),
      unitPrice: i.unitPrice,
      quantity: i.quantity,
      lineTotal: i.lineTotal,
    })),
  }
}

export function presentOrderSummary(o, lang) {
  const full = presentOrder(o, lang)
  return {
    id: full.id,
    code: full.code,
    status: full.status,
    productionStage: full.productionStage,
    paymentMethod: full.paymentMethod,
    paymentStatus: full.paymentStatus,
    total: full.total,
    itemCount: full.items.reduce((s, i) => s + i.quantity, 0),
    firstItemName: full.items[0]?.name ?? null,
    createdAt: full.createdAt,
  }
}
