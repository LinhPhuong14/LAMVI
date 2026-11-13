import { useCallback, useReducer } from 'react'

// 6 trạng thái của trải nghiệm "Phòng thư LAMVI" (yêu cầu §4). Thứ tự cũng là thứ tự hợp lệ duy
// nhất để đi tới (trừ postscriptOpen là nhánh tuỳ chọn ở cuối).
export const STATES = ['roomDark', 'roomLit', 'envelopeFocus', 'letterReady', 'letterOpen', 'postscriptOpen']

// Cạnh hợp lệ của máy trạng thái. Không có cạnh lùi — thả tay kéo hụt không đổi trạng thái (vẫn
// envelopeFocus), không phải một transition.
const EDGES = {
  roomDark: ['roomLit'],
  roomLit: ['envelopeFocus'],
  envelopeFocus: ['letterReady'],
  letterReady: ['letterOpen'],
  letterOpen: ['postscriptOpen'],
  postscriptOpen: [],
}

export function canTransition(from, to) {
  return EDGES[from]?.includes(to) ?? false
}

function reducer(state, action) {
  switch (action.type) {
    case 'TRANSITION': {
      // Đang bận (hoạt ảnh chuyển cảnh dở) → bỏ qua chạm liên tiếp (yêu cầu §Cảnh C, mục 5.3)
      if (state.busy) return state
      if (!canTransition(state.phase, action.to)) return state
      return { phase: action.to, busy: true }
    }
    case 'SETTLE':
      return { ...state, busy: false }
    // Dùng cho bước chuyển nối tiếp bên trong engine (letterReady → letterOpen) khi callback được
    // lưu lại từ một render cũ (đóng gói trong onDone của tween) — không thể dựa vào closure
    // `state.busy/phase` của `request` lúc đó vì có thể đã lệch với state thật (xem advance()).
    // Luôn an toàn: dispatch() của useReducer luôn áp reducer lên state MỚI NHẤT bất kể closure.
    case 'ADVANCE':
      return canTransition(state.phase, action.to) ? { phase: action.to, busy: false } : { ...state, busy: false }
    case 'RESET':
      return { phase: 'roomDark', busy: false }
    default:
      return state
  }
}

/**
 * Máy trạng thái của trải nghiệm. `busy=true` trong lúc một hoạt ảnh chuyển cảnh đang chạy — nơi
 * gọi (WishRoomPage/Fallback2D) phải gọi `settle()` khi hoạt ảnh/tween kết thúc để mở lại thao tác.
 */
export function useWishRoomMachine() {
  const [state, dispatch] = useReducer(reducer, { phase: 'roomDark', busy: false })

  // Kiểm tra điều kiện trước khi dispatch (đồng bộ, đọc state của lần render này) để trả về ngay
  // true/false cho nơi gọi (ví dụ huỷ hoạt ảnh nếu bị chặn) — đủ cho một hook không tranh chấp đa luồng.
  const request = useCallback(
    (to) => {
      if (state.busy || !canTransition(state.phase, to)) return false
      dispatch({ type: 'TRANSITION', to })
      return true
    },
    [state.busy, state.phase],
  )

  const settle = useCallback(() => dispatch({ type: 'SETTLE' }), [])
  const reset = useCallback(() => dispatch({ type: 'RESET' }), [])
  // An toàn khi gọi từ callback lưu lại (onDone của tween) dù render đã trôi qua — xem ADVANCE ở trên
  const advance = useCallback((to) => dispatch({ type: 'ADVANCE', to }), [])

  return { phase: state.phase, busy: state.busy, request, settle, reset, advance }
}
