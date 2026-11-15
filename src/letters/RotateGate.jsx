import { useEffect, useRef, useSyncExternalStore } from 'react'
import '@fontsource/dancing-script/latin-700.css'
import '@fontsource/dancing-script/vietnamese-700.css'
import './letters.css'

// Điện thoại/máy tính bảng (màn cảm ứng) đang cầm dọc → cần xoay ngang. Máy tính (chuột) không bị chặn.
const needsRotate = () => {
  if (typeof window === 'undefined') return false
  const touch = Boolean(window.matchMedia?.('(pointer: coarse)').matches)
  return touch && window.innerHeight > window.innerWidth
}
function subscribe(listener) {
  window.addEventListener('resize', listener)
  window.addEventListener('orientationchange', listener)
  return () => {
    window.removeEventListener('resize', listener)
    window.removeEventListener('orientationchange', listener)
  }
}

/**
 * D-146: trang phong thư luôn yêu cầu xoay ngang điện thoại trước khi bắt đầu (và mỗi khi quay lại dọc).
 * Nội dung vẫn được giữ (không mất vị trí video/pha), chỉ bị khoá + che; video đang phát thì tạm dừng
 * và thoát toàn màn hình (lớp toàn màn hình sẽ che mất lời nhắc).
 */
export default function RotateGate({ children }) {
  const rotate = useSyncExternalStore(subscribe, needsRotate, () => false)
  const boxRef = useRef(null)

  useEffect(() => {
    if (!rotate) return
    boxRef.current?.querySelectorAll('video').forEach((v) => {
      try {
        v.pause()
      } catch {
        /* jsdom */
      }
    })
    try {
      if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
    } catch {
      /* bỏ qua */
    }
  }, [rotate])

  return (
    <>
      <div ref={boxRef} className="lt-rotate-content" inert={rotate} aria-hidden={rotate || undefined}>
        {children}
      </div>
      {rotate && (
        <section className="lt-rotate" role="dialog" aria-modal="true" aria-labelledby="lt-rotate-title">
          <svg className="lt-rotate-icon" viewBox="0 0 120 100" width="120" height="100" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <rect x="42" y="15" width="35" height="68" rx="5" />
            <path d="M55 22h9M56 75h8M29 49C15 31 27 12 42 9M33 8l10 1-3 10M91 49c14 18 2 37-13 40M87 90l-10-1 3-10" />
          </svg>
          <p className="lt-intro-step">Phong thư LAMVI</p>
          <h1 id="lt-rotate-title" className="lt-rotate-title">
            Xoay ngang điện thoại
            <span className="lt-rotate-hand">để bắt đầu nhé</span>
          </h1>
          <p className="lt-rotate-sub">Trải nghiệm được làm cho màn hình nằm ngang. Nếu màn hình không xoay, hãy tắt khoá xoay màn hình.</p>
        </section>
      )}
    </>
  )
}
