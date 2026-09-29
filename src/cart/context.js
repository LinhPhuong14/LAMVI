import { createContext, useContext } from 'react'

export const CartContext = createContext(null)

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart phải nằm trong CartProvider')
  return ctx
}

export const MAX_QTY = 10 // D-60 (server kiểm lại)
const KEY = 'moc.cart'

// D-59: giỏ khách vãng lai lưu trình duyệt — chỉ slug + số lượng, giá luôn lấy từ server
export function loadLocalCart() {
  try {
    const items = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    return Array.isArray(items)
      ? items.filter((i) => typeof i?.slug === 'string' && Number.isInteger(i.quantity) && i.quantity > 0)
      : []
  } catch {
    return []
  }
}

export function saveLocalCart(items) {
  try {
    if (items.length) localStorage.setItem(KEY, JSON.stringify(items))
    else localStorage.removeItem(KEY)
  } catch {
    // bỏ qua (chế độ riêng tư)
  }
}
