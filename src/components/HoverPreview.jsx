import { useCallback, useState } from 'react'
import { createPortal } from 'react-dom'

// Khung xem trước phóng to khi rê chuột hoặc focus (D-124). Gắn `bind` vào phần tử gốc, đặt `node` ở cuối JSX.
// Dựng bằng portal + vị trí fixed để không bị cắt bởi vùng cuộn/carousel; chỉ hiện ở thiết bị có chuột (hover: hover).
const W = 300

export function usePreview({ src, srcSet, title, subtitle }) {
  const [at, setAt] = useState(null)

  const show = useCallback((e) => {
    if (typeof window === 'undefined' || !window.matchMedia?.('(hover: hover)').matches) return
    const r = e.currentTarget.getBoundingClientRect()
    // Đặt bên cạnh phần tử (phải nếu đủ chỗ, không thì trái), căn giữa theo chiều dọc và giữ trong màn hình
    const room = window.innerWidth - r.right
    const left = room >= W + 28 ? r.right + 16 : Math.max(12, r.left - W - 16)
    const top = Math.max(12, Math.min(r.top + r.height / 2 - 200, window.innerHeight - 430))
    setAt({ left, top })
  }, [])
  const hide = useCallback(() => setAt(null), [])

  const node =
    at && typeof document !== 'undefined'
      ? createPortal(
          <div className="hover-preview" style={{ left: at.left, top: at.top, width: W }} role="tooltip">
            <img src={src} srcSet={srcSet} sizes={`${W}px`} alt="" />
            {title && <strong>{title}</strong>}
            {subtitle && <span>{subtitle}</span>}
          </div>,
          document.body,
        )
      : null

  return { bind: { onMouseEnter: show, onMouseLeave: hide, onFocus: show, onBlur: hide }, node }
}
