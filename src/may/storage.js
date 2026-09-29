// localStorage/sessionStorage có thể bị chặn (chế độ riêng tư) → không làm vỡ Mây
const safe = (fn, fallback) => {
  try {
    return fn()
  } catch {
    return fallback
  }
}

export function getSessionId() {
  return safe(() => {
    let id = localStorage.getItem('moc.may.session')
    if (!id) {
      id = globalThis.crypto?.randomUUID?.() ?? `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
      localStorage.setItem('moc.may.session', id)
    }
    return id
  }, `s-${Date.now().toString(36)}-anon`)
}

// BR-AI-007, US-010 AC-002: nhớ đã xem/đóng tour
export const tourDone = () => safe(() => localStorage.getItem('moc.tour.done') === '1', true)
export const markTourDone = () => safe(() => localStorage.setItem('moc.tour.done', '1'))

// Lịch sử của khách vãng lai chỉ giữ trong tab (không lưu server — BR-AI-008)
export const loadGuestChat = () => safe(() => JSON.parse(sessionStorage.getItem('moc.may.chat') ?? '[]'), [])
export const saveGuestChat = (m) => safe(() => sessionStorage.setItem('moc.may.chat', JSON.stringify(m.slice(-30))))
