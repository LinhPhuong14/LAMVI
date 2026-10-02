import { createContext, useContext } from 'react'

export const AuthContext = createContext(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider')
  return ctx
}

const KEY = 'moc.session'

// T-10: phiên lưu localStorage; lỗi truy cập storage (chế độ riêng tư) coi như không có phiên
export function loadSession() {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSession(session) {
  try {
    if (session) localStorage.setItem(KEY, JSON.stringify(session))
    else localStorage.removeItem(KEY)
  } catch {
    // bỏ qua
  }
}

// Chỉ cho phép quay lại đường dẫn nội bộ (chống open redirect)
export function safeNext(next, fallback) {
  return typeof next === 'string' && /^\/(?![/\\])[^\t\r\n]*$/.test(next) ? next : fallback
}
