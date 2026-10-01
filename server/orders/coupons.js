import { eligibleSubtotal } from './pricing.js'

// Coupon (§14, D-65…D-68). Admin quản lý; khách nhập mã ở checkout (FR-CHK-006).

export const COUPON_TYPES = ['percent', 'amount', 'free_shipping']
export const COUPON_STATUSES = ['active', 'inactive']
const CODE_RE = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Mã coupon không phân biệt hoa thường khi khách nhập [ASSUMPTION]
export function normalizeCouponCode(v) {
  return typeof v === 'string' ? v.trim().toUpperCase() : ''
}

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const optInt = (v, min, max) => (v === null || v === undefined || v === '' ? { value: null } : isInt(v, min, max) ? { value: v } : { error: 'INVALID' })
const optDate = (v) => {
  if (v === null || v === undefined || v === '') return { value: null }
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) return { error: 'INVALID_DATE' }
  return { value: new Date(v).toISOString() }
}

export function validateCoupon(body, { partial = false } = {}) {
  const errors = {}
  const values = {}
  const has = (k) => !partial || body[k] !== undefined
  if (has('code')) {
    const code = normalizeCouponCode(body.code)
    if (!code) errors.code = 'REQUIRED'
    else if (code.length > 30 || !CODE_RE.test(code)) errors.code = 'INVALID_COUPON_CODE'
    else values.code = code
  }
  if (has('status')) {
    if (body.status === undefined && !partial) values.status = 'active'
    else if (!COUPON_STATUSES.includes(body.status)) errors.status = 'INVALID'
    else values.status = body.status
  }
  if (has('type')) {
    if (!COUPON_TYPES.includes(body.type)) errors.type = body.type === undefined ? 'REQUIRED' : 'INVALID'
    else values.type = body.type
  }
  for (const [k, r] of [
    ['maxDiscount', optInt(body.maxDiscount, 1, 1_000_000_000)],
    ['minOrder', optInt(body.minOrder, 0, 1_000_000_000)],
    ['usageLimit', optInt(body.usageLimit, 1, 1_000_000)],
    ['perUserLimit', optInt(body.perUserLimit, 1, 1_000_000)],
    ['startsAt', optDate(body.startsAt)],
    ['endsAt', optDate(body.endsAt)],
  ]) {
    if (!has(k)) continue
    if (r.error) errors[k] = r.error
    else values[k] = r.value
  }
  if (has('value')) {
    if (body.value === undefined || body.value === null) values.value = 0
    else if (!isInt(body.value, 0, 1_000_000_000)) errors.value = 'INVALID'
    else values.value = body.value
  }
  if (has('productIds')) {
    const v = body.productIds
    if (v === null || v === undefined) values.productIds = null
    else if (!Array.isArray(v) || !v.length || v.length > 100 || !v.every((id) => typeof id === 'string' && UUID_RE.test(id))) {
      errors.productIds = 'INVALID'
    } else values.productIds = [...new Set(v.map((id) => id.toLowerCase()))]
  }
  if (has('note')) {
    const n = typeof body.note === 'string' ? body.note.trim() : body.note
    if (n === null || n === undefined || n === '') values.note = null
    else if (typeof n !== 'string' || n.length > 300) errors.note = 'TOO_LONG'
    else values.note = n
  }
  return { errors, values }
}

// Kiểm tra chéo sau khi gộp với bản đang lưu (PATCH)
export function crossCheckCoupon(c) {
  const errors = {}
  if (c.type === 'percent' && !isInt(c.value, 1, 100)) errors.value = 'INVALID_PERCENT'
  if (c.type === 'amount' && !isInt(c.value, 1, 1_000_000_000)) errors.value = 'INVALID'
  if (c.type !== 'percent' && c.maxDiscount) errors.maxDiscount = 'ONLY_FOR_PERCENT'
  if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) errors.endsAt = 'BEFORE_START'
  return errors
}

/**
 * Lý do coupon không dùng được cho đơn (null = hợp lệ). §14, BR-CPN-001.
 * uses: { total, byUser } — số đơn chưa huỷ đã dùng coupon (D-68: huỷ đơn trả lượt)
 */
export function couponProblem(coupon, { now, lines, subtotal, uses }) {
  // Mã không tồn tại và mã đang tắt trả cùng lỗi (không dò được mã) [ASSUMPTION]
  if (!coupon || coupon.status !== 'active') return { code: 'COUPON_INVALID' }
  if (coupon.startsAt && now < coupon.startsAt) return { code: 'COUPON_NOT_STARTED' }
  if (coupon.endsAt && now >= coupon.endsAt) return { code: 'COUPON_EXPIRED' }
  if (coupon.usageLimit !== null && coupon.usageLimit !== undefined && uses.total >= coupon.usageLimit) return { code: 'COUPON_USED_UP' }
  if (coupon.perUserLimit !== null && coupon.perUserLimit !== undefined && uses.byUser >= coupon.perUserLimit) return { code: 'COUPON_USER_LIMIT' }
  // Mức tối thiểu so với tạm tính cả đơn [ASSUMPTION]
  if (coupon.minOrder && subtotal < coupon.minOrder) return { code: 'COUPON_MIN_ORDER', minOrder: coupon.minOrder }
  if (coupon.productIds && eligibleSubtotal(coupon, lines) === 0) return { code: 'COUPON_NOT_APPLICABLE' }
  return null
}

// Thông tin coupon trả cho khách (không lộ giới hạn lượt, ghi chú nội bộ)
export function presentCouponForCustomer(c) {
  return { code: c.code, type: c.type, value: c.value, maxDiscount: c.maxDiscount ?? null, scoped: Boolean(c.productIds) }
}
