// Tính giá đơn (§13, BR-PRC-001). Mọi số là số nguyên VND (T-09).

// D-62: VAT 10%, không tính trên phí ship; tính trên (tạm tính − giảm giá), làm tròn một lần ở tổng đơn [ASSUMPTION]
export const VAT_RATE = 0.1

// Cấu hình cửa hàng lưu ở app_settings key 'shop' (admin sửa)
export const SHOP_SETTING_KEY = 'shop'
export const DEFAULT_SHOP = {
  // D-63: phí ship đồng giá, miễn phí khi tạm tính ≥ mức (null = không miễn phí)
  shippingFee: 30_000,
  freeShippingFrom: 1_500_000,
  // D-71: tổng đơn vượt mức thì không cho COD (null = không giới hạn)
  codMaxTotal: 5_000_000,
}

const isMoney = (v, { min = 0 } = {}) => Number.isInteger(v) && v >= min && v <= 1_000_000_000

export async function loadShopConfig(repo) {
  const saved = (await repo.getSetting(SHOP_SETTING_KEY))?.value ?? {}
  const c = { ...DEFAULT_SHOP }
  if (isMoney(saved.shippingFee)) c.shippingFee = saved.shippingFee
  for (const k of ['freeShippingFrom', 'codMaxTotal']) {
    if (saved[k] === null || isMoney(saved[k])) c[k] = saved[k]
  }
  return c
}

export function validateShopConfig(body) {
  const errors = {}
  const values = {}
  if (!isMoney(body?.shippingFee)) errors.shippingFee = 'INVALID'
  else values.shippingFee = body.shippingFee
  for (const k of ['freeShippingFrom', 'codMaxTotal']) {
    const v = body?.[k]
    // Thiếu trường → lỗi (tránh vô tình tắt mức miễn ship / trần COD); null = tắt có chủ đích
    if (v === undefined) errors[k] = 'REQUIRED'
    else if (v === null || v === '') values[k] = null
    else if (!isMoney(v, { min: 1 })) errors[k] = 'INVALID'
    else values[k] = v
  }
  return { errors, values }
}

// Số tiền được giảm của coupon trên các dòng áp dụng (D-65, D-67). Không tính phần phí ship.
function couponDiscount(coupon, eligibleSubtotal) {
  if (coupon.type === 'percent') {
    let d = Math.round((eligibleSubtotal * coupon.value) / 100)
    if (coupon.maxDiscount) d = Math.min(d, coupon.maxDiscount)
    return Math.min(d, eligibleSubtotal)
  }
  if (coupon.type === 'amount') return Math.min(coupon.value, eligibleSubtotal)
  return 0
}

// Dòng thuộc phạm vi coupon (null = toàn đơn)
export function eligibleSubtotal(coupon, lines) {
  return lines
    .filter((l) => !coupon.productIds || coupon.productIds.includes(l.productId))
    .reduce((s, l) => s + l.unitPrice * l.quantity, 0)
}

/**
 * lines: [{ productId, unitPrice, quantity }] — chỉ dòng còn bán
 * coupon: coupon đã kiểm tra hợp lệ (hoặc null)
 */
export function priceOrder({ lines, coupon = null, shop }) {
  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
  const baseShipping = shop.freeShippingFrom !== null && subtotal >= shop.freeShippingFrom ? 0 : shop.shippingFee
  const eligible = coupon ? eligibleSubtotal(coupon, lines) : 0
  const discount = coupon ? couponDiscount(coupon, eligible) : 0
  // D-65: coupon miễn phí ship đưa phí ship về 0
  const shippingFee = coupon?.type === 'free_shipping' ? 0 : baseShipping
  const vat = Math.round((subtotal - discount) * VAT_RATE)
  return {
    subtotal,
    discount,
    shippingFeeBeforeDiscount: baseShipping,
    shippingFee,
    vat,
    vatRate: VAT_RATE,
    total: subtotal - discount + shippingFee + vat,
    currency: 'VND',
  }
}

// D-71, BR-PAY-004: COD chỉ khi người nhận là bản thân và tổng không vượt mức
export function codAllowed({ recipientType, total, shop }) {
  if (recipientType !== 'self') return { allowed: false, reason: 'COD_RECIPIENT_OTHER' }
  if (shop.codMaxTotal !== null && total > shop.codMaxTotal) return { allowed: false, reason: 'COD_OVER_LIMIT' }
  return { allowed: true, reason: null }
}
