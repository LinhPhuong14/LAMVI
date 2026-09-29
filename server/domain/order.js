// Đơn hàng (§12, §16, FR-CHK-*, FR-ORD-*). Thuần hàm — không đụng DB.
import { randomBytes } from 'node:crypto'

// §16. Đơn COD bỏ qua pending_payment.
export const ORDER_STATUSES = Object.freeze([
  'pending_payment',
  'confirmed',
  'in_production',
  'packed',
  'shipped',
  'delivered',
  'delivery_failed',
  'cancelled',
])

export const PAYMENT_METHODS = Object.freeze(['payos', 'cod'])
export const ORDER_KINDS = Object.freeze(['gift', 'self'])
export const QR_LANGS = Object.freeze(['vi', 'en', 'zh'])

// Chuyển trạng thái admin được phép làm (§16). Khách chỉ được huỷ (BR-ORD-001).
const ADMIN_TRANSITIONS = {
  pending_payment: ['cancelled'],
  confirmed: ['in_production', 'cancelled'],
  in_production: ['packed', 'cancelled'],
  packed: ['shipped', 'cancelled'],
  shipped: ['delivered', 'delivery_failed'],
  delivered: [],
  delivery_failed: [],
  cancelled: [],
}

export const adminNextStatuses = (status) => ADMIN_TRANSITIONS[status] ?? []
export const canAdminMove = (from, to) => adminNextStatuses(from).includes(to)

// BR-ORD-001 / D-06: người mua huỷ được khi đơn còn trước SHIPPED
const CUSTOMER_CANCELLABLE = new Set(['pending_payment', 'confirmed', 'in_production', 'packed'])
export const canCustomerCancel = (status) => CUSTOMER_CANCELLABLE.has(status)

// BR-MSG-008 (D-41): phần chữ khoá khi đã PACKED. BR-MSG-001 (D-13): toàn bộ khoá khi đã SHIPPED.
const AFTER_PACKED = new Set(['packed', 'shipped', 'delivered', 'delivery_failed'])
const AFTER_SHIPPED = new Set(['shipped', 'delivered', 'delivery_failed'])
export const isMessageTextLocked = (status) => AFTER_PACKED.has(status)
export const isMessageLocked = (status) => AFTER_SHIPPED.has(status)

// Mã đơn hiển thị: dễ đọc qua điện thoại, không đoán được đơn kế tiếp.
// Bỏ các ký tự dễ nhầm (0/O, 1/I) — khách hay đọc mã cho tổng đài.
const CODE_ALPHABET = '23456789ACDEFGHJKLMNPQRTUVWXY'
// 7 ký tự × 29 = ~17 tỉ tổ hợp mỗi tháng. Với 6 ký tự (594 triệu), một shop 10k đơn/tháng đã có
// vài phần trăm khả năng trùng mỗi tháng — uniqueOrderCode vẫn thử lại được nhưng tốn truy vấn.
const CODE_LENGTH = 7

export function generateOrderCode(now = new Date(), random = randomBytes) {
  const y = String(now.getUTCFullYear()).slice(2)
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `LV${y}${m}-${randomChars(CODE_LENGTH, random)}`
}

/**
 * Chuỗi ngẫu nhiên từ CODE_ALPHABET, phân bố đều.
 * Dùng `b % 29` trực tiếp sẽ lệch (256 không chia hết cho 29 → 24 ký tự đầu hay ra hơn), làm giảm
 * độ khó đoán của mã. Ở đây loại bỏ các byte rơi vào phần dư rồi lấy thêm byte khác.
 */
function randomChars(length, random) {
  const n = CODE_ALPHABET.length
  const limit = 256 - (256 % n)
  let out = ''
  while (out.length < length) {
    for (const b of random(length * 2)) {
      if (b >= limit) continue
      out += CODE_ALPHABET[b % n]
      if (out.length === length) break
    }
  }
  return out
}

/**
 * Mã đơn gửi payOS: bắt buộc là số nguyên dương, duy nhất theo từng cửa hàng.
 * Dùng mili-giây kể từ 2026-01-01 + 3 chữ số ngẫu nhiên → vừa khớp số nguyên an toàn của JS.
 */
const PAYOS_EPOCH = Date.UTC(2026, 0, 1)
export function generatePayosOrderCode(now = new Date(), random = randomBytes) {
  const ms = Math.max(0, now.getTime() - PAYOS_EPOCH)
  const suffix = random(2).readUInt16BE(0) % 1000
  return ms * 1000 + suffix
}

const VN_PHONE_RE = /^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/
export const normalizePhone = (v) => (typeof v === 'string' ? v.replace(/[\s.-]/g, '') : '')
export const isVnPhone = (v) => VN_PHONE_RE.test(normalizePhone(v))

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Kiểm tra dữ liệu checkout (§12). Trả { errors, values } — errors là map trường → mã lỗi.
 * Không kiểm giỏ hàng/coupon ở đây (cần DB); xem server/orders/service.js.
 */
export function validateCheckout(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const errors = {}
  const values = {}

  // FR-CHK-002
  if (!ORDER_KINDS.includes(b.orderKind)) errors.orderKind = 'INVALID'
  else values.orderKind = b.orderKind

  // FR-CHK-003 / BR-MSG-002: đơn tặng luôn có lời chúc; đơn tự mua chỉ khi khách tích ô
  if (typeof b.hasMessage !== 'boolean' && b.hasMessage !== undefined) errors.hasMessage = 'INVALID'
  values.hasMessage = values.orderKind === 'gift' ? true : Boolean(b.hasMessage)

  // FR-CHK-005 (D-24): chỉ hỏi ngôn ngữ trang QR khi đơn có lời chúc
  if (values.hasMessage) {
    if (!QR_LANGS.includes(b.qrLang)) errors.qrLang = 'INVALID'
    else values.qrLang = b.qrLang
  } else {
    values.qrLang = null
  }

  // FR-CHK-004 / BR-SHP-001
  if (typeof b.recipientIsSelf !== 'boolean') errors.recipientIsSelf = 'INVALID'
  else values.recipientIsSelf = b.recipientIsSelf

  values.recipientName = str(b.recipientName, 120)
  if (!values.recipientName) errors.recipientName = 'REQUIRED'

  values.recipientPhone = normalizePhone(b.recipientPhone)
  if (!values.recipientPhone) errors.recipientPhone = 'REQUIRED'
  else if (!isVnPhone(values.recipientPhone)) errors.recipientPhone = 'INVALID_PHONE'

  values.addressLine = str(b.addressLine, 200)
  if (!values.addressLine) errors.addressLine = 'REQUIRED'

  // BR-SHP-002: chỉ giao trong Việt Nam → tỉnh/thành bắt buộc, không có trường quốc gia
  values.province = str(b.province, 80)
  if (!values.province) errors.province = 'REQUIRED'
  values.district = str(b.district, 80) || null
  values.ward = str(b.ward, 80) || null
  values.note = str(b.note, 500) || null

  // FR-CHK-007
  if (!PAYMENT_METHODS.includes(b.paymentMethod)) errors.paymentMethod = 'INVALID'
  else values.paymentMethod = b.paymentMethod

  // BR-PAY-004: COD chỉ cho đơn giao cho chính người mua
  if (values.paymentMethod === 'cod' && values.recipientIsSelf === false) {
    errors.paymentMethod = 'COD_NOT_ALLOWED_FOR_GIFT'
  }

  // FR-CHK-006 (tuỳ chọn)
  if (b.couponCode !== undefined && b.couponCode !== null && b.couponCode !== '') {
    if (typeof b.couponCode !== 'string' || b.couponCode.length > 32) errors.couponCode = 'INVALID'
    else values.couponCode = b.couponCode
  }

  return { errors, values }
}
