import { lazy, Suspense, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import LetterExtras from '../letters/LetterExtras.jsx'
import { S } from './strings.js'

const L = S.letters
// Phòng thư 3D (letter-room) — chỉ tải three.js khi admin bấm xem thử
const LetterRoom = lazy(() => import('../letter-room/LetterRoom.jsx'))
const LetterWeb = lazy(() => import('../letter-web/LetterWeb.jsx'))

/**
 * Xem thử phong thư đúng kiểu trải nghiệm người nhận sẽ thấy — Phòng thư 3D hoặc web 2D (D-140), bỏ hai video mở đầu.
 * Toàn màn hình, gắn vào <body>; Esc / nút × / nút ↻ của phòng đều đóng.
 */
export default function LetterRoomPreview({ letter, onClose }) {
  const closeRef = useRef(null)
  // Mở: đưa focus vào trong dialog (aria-modal)
  useEffect(() => closeRef.current?.focus(), [])
  useEffect(() => {
    // Esc trong khung video cuối thư / điều bất ngờ (web 2D) chỉ đóng khung đó
    const onKey = (e) => e.key === 'Escape' && !document.querySelector('.lt-overlay, .lw-surprise') && onClose()
    window.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
    }
  }, [onClose])
  return createPortal(
    <div className="letter-room-preview" role="dialog" aria-modal="true" aria-label={L.roomPreview}>
      <button ref={closeRef} type="button" className="letter-room-preview-close" onClick={onClose} aria-label={L.closePreview}>
        ×
      </button>
      <Suspense fallback={<p role="status">…</p>}>
        {letter.template === 'web' ? (
          <LetterWeb letter={letter} preview onExit={onClose} afterLetter={<LetterExtras />} />
        ) : (
          <LetterRoom letter={letter} preview onExit={onClose} afterLetter={<LetterExtras />} />
        )}
      </Suspense>
    </div>,
    document.body,
  )
}
