// Coupon (FR-CPN-001/002, §14, D-71). Kiểm tra tính hợp lệ — không đụng DB, để test được thuần hàm.
import { COUPON_TYPES } from './pricing.js'

export { COUPON_TYPES }

export const COUPON_CODE_RE = /^[A-Z0-9]{3,32}$/

/** Chuẩn hoá mã khách nhập: bỏ khoảng trắng, về chữ HOA (so khớp không phân biệt hoa/thường). */
export const normalizeCouponCode = (code) => (typeof code === 'string' ? code.trim().toUpperCase() : '')

/**
 * Lý do coupon không dùng được, hoặc null nếu hợp lệ. §14 "Quy tắc hợp lệ tối thiểu".
 *
 * @param {object} coupon bản ghi coupon
 * @param {object} ctx
 * @param {number} ctx.subtotal tạm tính của đơn (đã gồm VAT — D-68)
 * @param {number} ctx.userUses số lần khách này đã dùng coupon
 * @param {Date}   [ctx.now]
 * @param {string[]} [ctx.productIds] id sản phẩm trong giỏ (C-3)
 */
export function couponRejectReason(coupon, { subtotal, userUses = 0, now = new Date(), productIds = [] }) {
  if (!coupon) return 'COUPON_NOT_FOUND'
  if (coupon.status !== 'active') return 'COUPON_INACTIVE'
  if (!COUPON_TYPES.includes(coupon.type)) return 'COUPON_INACTIVE'
  const t = now.getTime()
  if (coupon.startsAt && t < Date.parse(coupon.startsAt)) return 'COUPON_NOT_STARTED'
  // ends_at là mốc hết hiệu lực (không bao gồm): starts_at ≤ now < ends_at
  if (coupon.endsAt && t >= Date.parse(coupon.endsAt)) return 'COUPON_EXPIRED'
  if (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) return 'COUPON_USED_UP'
  if (coupon.perUserLimit != null && userUses >= coupon.perUserLimit) return 'COUPON_USER_LIMIT'
  if (coupon.minOrder != null && subtotal < coupon.minOrder) return 'COUPON_MIN_ORDER'
  // C-3: coupon giới hạn sản phẩm mà giỏ không có sản phẩm nào thuộc phạm vi
  if (coupon.productIds?.length && !productIds.some((id) => coupon.productIds.includes(id))) {
    return 'COUPON_NOT_APPLICABLE'
  }
  return null
}

/** Dạng coupon truyền vào quoteOrder() — chỉ các trường ảnh hưởng số tiền. */
export function toPricingCoupon(coupon) {
  if (!coupon) return null
  return {
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    maxDiscount: coupon.maxDiscount,
    productIds: coupon.productIds,
  }
}
