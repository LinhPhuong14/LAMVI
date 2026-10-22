// Trang nào hiện thanh điều hướng đáy trên điện thoại (xem MobileTabBar.jsx).
// Danh sách cho phép (không phải danh sách loại trừ): trang 404 và mọi trang lạ không có thanh này.
// Các trang có thanh riêng ở đáy (chi tiết sản phẩm, giỏ, thanh toán, đơn hàng, lô), trang auth và dashboard cũng không có.
const SHOW_EXACT = new Set(['/', '/shop', '/contact', '/returns', '/privacy', '/terms', '/shipping', '/payment'])
const SHOW_PREFIX = ['/collections/']
export const showsTabBar = (rest) => {
  const clean = rest.replace(/\/+$/, '') || '/'
  return SHOW_EXACT.has(clean) || SHOW_PREFIX.some((p) => clean.startsWith(p))
}
