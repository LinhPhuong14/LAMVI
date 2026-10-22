// Trang nào hiện thanh điều hướng đáy trên điện thoại (xem MobileTabBar.jsx)
const HIDE_PREFIX = ['/products/', '/don-hang/', '/lo/']
const HIDE_EXACT = new Set(['/cart', '/checkout'])
export const showsTabBar = (rest) => {
  const clean = rest.replace(/\/+$/, '') || '/'
  return !HIDE_EXACT.has(clean) && !HIDE_PREFIX.some((p) => clean.startsWith(p))
}
