// Kiểm tra dữ liệu coupon từ form admin (§14, D-71). Thuần hàm.
import { COUPON_CODE_RE, COUPON_TYPES, normalizeCouponCode } from './coupon.js'

const isInt = (v, min, max) => Number.isInteger(v) && v >= min && v <= max
const isIsoDate = (v) => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/** Trường tuỳ chọn dạng số nguyên: bỏ qua nếu undefined, cho phép null để xoá. */
function optionalInt(body, key, errors, values, min, max) {
  if (!Object.hasOwn(body, key)) return
  const v = body[key]
  if (v === null || v === '') {
    values[key] = null
    return
  }
  if (!isInt(v, min, max)) errors[key] = 'INVALID'
  else values[key] = v
}

function optionalDate(body, key, errors, values) {
  if (!Object.hasOwn(body, key)) return
  const v = body[key]
  if (v === null || v === '') {
    values[key] = null
    return
  }
  if (!isIsoDate(v)) errors[key] = 'INVALID'
  else values[key] = new Date(v).toISOString()
}

/**
 * @param {object} [opts]
 * @param {boolean} [opts.partial] PATCH — chỉ kiểm các trường có mặt
 * @param {string}  [opts.currentType] loại của coupon đang sửa; cần để kiểm `value` khi PATCH
 *   chỉ gửi `value` mà không gửi lại `type`
 */
export function validateCoupon(body, { partial = false, currentType } = {}) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const errors = {}
  const values = {}

  if (Object.hasOwn(b, 'code') || !partial) {
    const code = normalizeCouponCode(b.code)
    if (!code) errors.code = 'REQUIRED'
    else if (!COUPON_CODE_RE.test(code)) errors.code = 'INVALID_CODE'
    else values.code = code
  }

  const type = Object.hasOwn(b, 'type') ? b.type : undefined
  if (type !== undefined) {
    if (!COUPON_TYPES.includes(type)) errors.type = 'INVALID'
    else values.type = type
  } else if (!partial) {
    errors.type = 'REQUIRED'
  }

  // Giới hạn của `value` phụ thuộc `type`; PATCH chỉ gửi value thì lấy type hiện có của coupon
  const effectiveType = values.type ?? (partial ? currentType : undefined)
  if (Object.hasOwn(b, 'value') || (!partial && effectiveType)) {
    const v = b.value
    if (effectiveType === 'percent') {
      if (!isInt(v, 1, 100)) errors.value = 'INVALID_PERCENT'
      else values.value = v
    } else if (effectiveType === 'amount') {
      if (!isInt(v, 1, 1_000_000_000)) errors.value = 'INVALID_AMOUNT'
      else values.value = v
    } else if (effectiveType === 'free_shipping') {
      values.value = 0
    } else if (v !== undefined && !errors.type) {
      // Sửa value mà không biết loại → không có luật để kiểm
      errors.type = 'REQUIRED'
    }
  }
  // Đổi type mà không gửi lại value → giá trị cũ có thể không còn hợp lệ với loại mới
  if (values.type && values.type !== 'free_shipping' && !Object.hasOwn(b, 'value') && partial && values.type !== currentType) {
    errors.value = 'REQUIRED'
  }
  // C-6: trần giảm chỉ dành cho coupon %. Đổi sang loại khác thì xoá luôn, không để lại dữ liệu
  // vô nghĩa trong DB.
  if (values.type && values.type !== 'percent' && !Object.hasOwn(b, 'maxDiscount')) {
    values.maxDiscount = null
  }
  // free_shipping không có giá trị giảm — kể cả khi PATCH chỉ đổi type
  if (values.type === 'free_shipping') values.value = 0

  optionalInt(b, 'maxDiscount', errors, values, 1, 1_000_000_000)
  optionalInt(b, 'minOrder', errors, values, 0, 1_000_000_000)
  optionalInt(b, 'usageLimit', errors, values, 1, 1_000_000)
  optionalInt(b, 'perUserLimit', errors, values, 1, 1_000)
  optionalDate(b, 'startsAt', errors, values)
  optionalDate(b, 'endsAt', errors, values)

  // C-6: trần giảm chỉ có nghĩa với coupon %
  if (values.maxDiscount != null && effectiveType !== 'percent') {
    errors.maxDiscount = 'ONLY_FOR_PERCENT'
  }

  if (Object.hasOwn(b, 'productIds')) {
    const v = b.productIds
    if (v === null || (Array.isArray(v) && v.length === 0)) values.productIds = null
    else if (!Array.isArray(v) || v.length > 50 || v.some((x) => typeof x !== 'string' || !x)) {
      errors.productIds = 'INVALID'
    } else values.productIds = v
  }

  if (Object.hasOwn(b, 'status')) {
    if (b.status !== 'active' && b.status !== 'disabled') errors.status = 'INVALID'
    else values.status = b.status
  }

  if (values.startsAt && values.endsAt && Date.parse(values.startsAt) >= Date.parse(values.endsAt)) {
    errors.endsAt = 'END_BEFORE_START'
  }

  return { errors, values }
}
