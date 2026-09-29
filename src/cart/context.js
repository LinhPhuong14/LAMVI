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
// Gộp dòng trùng, tối đa MAX_QTY mỗi dòng và MAX_LINES dòng (khớp giới hạn server)
export const MAX_LINES = 50

export function loadLocalCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    const merged = new Map()
    for (const i of raw) {
      if (typeof i?.slug !== 'string' || !Number.isInteger(i.quantity) || i.quantity < 1) continue
      if (!merged.has(i.slug) && merged.size >= MAX_LINES) continue
      merged.set(i.slug, Math.min(MAX_QTY, (merged.get(i.slug) ?? 0) + i.quantity))
    }
    return [...merged].map(([slug, quantity]) => ({ slug, quantity }))
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
