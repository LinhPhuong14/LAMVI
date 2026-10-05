// G-44, D-100: tồn kho. `stock` null = không theo dõi (luôn đặt được); số nguyên >= 0 = còn bấy nhiêu.
// Ngưỡng hiển thị "chỉ còn n" cho khách — không lộ số tồn lớn hơn ngưỡng `[ASSUMPTION]`.
export const LOW_STOCK_AT = 5

export const isTracked = (p) => p.stock !== null && p.stock !== undefined
export const hasStock = (p, qty = 1) => !isTracked(p) || p.stock >= qty

export function presentStock(p) {
  const tracked = isTracked(p)
  return {
    inStock: !tracked || p.stock > 0,
    // Chỉ báo số còn lại khi sắp hết
    stockLeft: tracked && p.stock > 0 && p.stock <= LOW_STOCK_AT ? p.stock : null,
  }
}
