// Tính giá đơn hàng (§13, BR-PRC-001). Nguồn sự thật duy nhất — server tính, không tin trình duyệt.
//
// D-68 (thay D-03, chốt I-04): giá niêm yết là giá ĐÃ gồm VAT. Mọi số tiền dưới đây là số nguyên
// VND đã gồm VAT; VAT được tách ngược từ tổng đơn (làm tròn một lần ở tổng — Q-09).
//
// D-69 (Q-09): thuế suất 10%, VAT tính trên cả phí vận chuyển.
// D-70 (Q-11): phí ship đồng giá toàn quốc, miễn phí từ một ngưỡng.
// D-71 (C-1…C-3): coupon 3 loại (percent / amount / free_shipping), giảm trước VAT, áp được cho
//   sản phẩm cụ thể. Vì giá niêm yết đã gồm VAT, "giảm trước VAT" = giảm trên số tiền khách thấy
//   rồi mới tách VAT ngược từ tổng còn lại → phần giảm cũng làm giảm cơ sở tính thuế. [ASSUMPTION]

export const DEFAULT_PRICING = Object.freeze({
  vatRate: 0.1,
  shippingFee: 30000,
  freeShippingFrom: 1000000,
})

export const PRICING_SETTING_KEY = 'pricing'

// D-71 — ba loại coupon được phép. Dùng chung với kiểm tra dữ liệu ở admin.
export const COUPON_TYPES = Object.freeze(['percent', 'amount', 'free_shipping'])

const isFiniteNum = (v) => typeof v === 'number' && Number.isFinite(v)

/** Chuẩn hoá cấu hình tính giá đọc từ app_settings; giá trị hỏng → mặc định. */
export function normalizePricingConfig(value) {
  const v = value && typeof value === 'object' ? value : {}
  const vatRate = isFiniteNum(v.vatRate) && v.vatRate >= 0 && v.vatRate < 1 ? v.vatRate : DEFAULT_PRICING.vatRate
  const shippingFee =
    isFiniteNum(v.shippingFee) && v.shippingFee >= 0 ? Math.round(v.shippingFee) : DEFAULT_PRICING.shippingFee
  const freeShippingFrom =
    isFiniteNum(v.freeShippingFrom) && v.freeShippingFrom >= 0
      ? Math.round(v.freeShippingFrom)
      : DEFAULT_PRICING.freeShippingFrom
  return { vatRate, shippingFee, freeShippingFrom }
}

/**
 * Tách VAT ngược từ số tiền đã gồm thuế: vat = total × rate / (1 + rate).
 * Làm tròn nửa lên, một lần duy nhất ở tổng đơn (Q-09).
 */
export function vatFromGross(grossTotal, vatRate) {
  if (grossTotal <= 0 || vatRate <= 0) return 0
  return Math.round((grossTotal * vatRate) / (1 + vatRate))
}

/**
 * Giảm giá của coupon trên tạm tính (đã gồm VAT).
 * @param {object} coupon { type: 'percent'|'amount'|'free_shipping', value, maxDiscount, productIds }
 * @param {Array<{productId: string, lineTotal: number}>} lines
 * @returns {number} số tiền giảm (0 với free_shipping — loại này giảm ở phí ship)
 */
export function couponDiscount(coupon, lines) {
  // Chỉ 3 loại ở D-71. Loại lạ (dữ liệu DB hỏng, coupon cũ) → KHÔNG giảm, không rơi vào
  // nhánh "giảm số tiền" theo mặc định.
  if (!coupon || !COUPON_TYPES.includes(coupon.type) || coupon.type === 'free_shipping') return 0
  // Giá trị hỏng/thiếu → không giảm; nếu không NaN sẽ lan sang total, vatAmount của cả đơn
  if (!isFiniteNum(coupon.value)) return 0
  // C-3: coupon có thể giới hạn vào một số sản phẩm; rỗng/null = toàn đơn
  const scoped = coupon.productIds?.length
    ? lines.filter((l) => coupon.productIds.includes(l.productId))
    : lines
  const base = scoped.reduce((s, l) => s + l.lineTotal, 0)
  if (base <= 0) return 0
  let discount
  if (coupon.type === 'percent') {
    discount = Math.round((base * coupon.value) / 100)
    // C-6: trần giảm cho coupon %
    if (isFiniteNum(coupon.maxDiscount) && coupon.maxDiscount >= 0) discount = Math.min(discount, coupon.maxDiscount)
  } else {
    discount = Math.round(coupon.value)
  }
  return Math.max(0, Math.min(discount, base))
}

/**
 * Bảng giá đầy đủ của một đơn. Mọi số nguyên VND, đã gồm VAT (D-68).
 *
 * @param {object} p
 * @param {Array<{productId: string, unitPrice: number, quantity: number}>} p.items
 * @param {object|null} [p.coupon]
 * @param {object} [p.config] cấu hình đã chuẩn hoá (normalizePricingConfig)
 * @returns {{
 *   lines: Array, subtotal: number, discount: number, shippingFee: number,
 *   total: number, vatAmount: number, netAmount: number, vatRate: number,
 *   freeShipping: boolean, couponCode: string|null
 * }}
 */
export function quoteOrder({ items, coupon = null, config = DEFAULT_PRICING }) {
  const cfg = normalizePricingConfig(config)
  const lines = items.map((i) => ({
    productId: i.productId,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: i.unitPrice * i.quantity,
  }))
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0)
  const discount = couponDiscount(coupon, lines)
  const goodsAfterDiscount = subtotal - discount

  // [ASSUMPTION] Ngưỡng miễn phí ship tính trên tạm tính SAU khi trừ coupon.
  const freeByThreshold = cfg.freeShippingFrom > 0 && goodsAfterDiscount >= cfg.freeShippingFrom
  const freeByCoupon = coupon?.type === 'free_shipping'
  const freeShipping = subtotal > 0 && (freeByThreshold || freeByCoupon)
  const shippingFee = subtotal > 0 && !freeShipping ? cfg.shippingFee : 0

  const total = goodsAfterDiscount + shippingFee
  // Q-09: VAT tính trên cả phí ship → tách ngược từ tổng
  const vatAmount = vatFromGross(total, cfg.vatRate)

  return {
    lines,
    subtotal,
    discount,
    shippingFee,
    total,
    vatAmount,
    netAmount: total - vatAmount,
    vatRate: cfg.vatRate,
    freeShipping,
    couponCode: coupon?.code ?? null,
  }
}
