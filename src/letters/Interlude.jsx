import { useEffect, useRef, useState } from 'react'
import '@fontsource/dancing-script/latin-700.css'
import '@fontsource/dancing-script/vietnamese-700.css'
import { WORDMARK_SRC } from '../components/Wordmark.jsx'
import './letters.css'

const reducedMotion = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

/**
 * D-143: màn chuyển giữa hai video mở đầu và căn phòng bật đèn — "LAMVI đem đến cho bạn chiếc đèn giấy dó
 * với trải nghiệm độc nhất". Chữ hiện dần (Cormorant Garamond nghiêng + "chiếc đèn giấy dó" viết tay Dancing Script),
 * nút đi tiếp hiện rõ sau khi chữ chạy xong (bấm được ngay từ đầu, cho người đã quen); người nhận tự bấm,
 * không tự chuyển. Giảm chuyển động: hiện ngay.
 *
 * @param {{ onDone: () => void }} p
 */
export default function Interlude({ onDone }) {
  const [reduced] = useState(reducedMotion)
  const [ready, setReady] = useState(reduced)
  const btn = useRef(null)
  const root = useRef(null)

  useEffect(() => {
    root.current?.focus({ preventScroll: true })
    if (reduced) return
    const t = setTimeout(() => setReady(true), 2600)
    return () => clearTimeout(t)
  }, [reduced])
  useEffect(() => {
    // Chỉ chuyển focus khi người dùng chưa tự Tab đi chỗ khác (focus vẫn ở khung màn này)
    if (ready && !reduced && document.activeElement === root.current) btn.current?.focus({ preventScroll: true })
  }, [ready, reduced])

  return (
    <section ref={root} className={`lt-interlude${reduced ? ' is-instant' : ''}`} tabIndex={-1} aria-labelledby="lt-interlude-title">
      <div className="lt-interlude-glow" aria-hidden="true" />
      <img className="lt-interlude-logo" src={WORDMARK_SRC} alt="LAMVI" width="181" height="50" />
      <h1 id="lt-interlude-title" className="lt-interlude-title">
        <span className="lt-interlude-line">LAMVI đem đến cho bạn</span>
        <span className="lt-interlude-hand">chiếc đèn giấy dó</span>
        <span className="lt-interlude-line lt-interlude-line-2">với trải nghiệm độc nhất</span>
      </h1>
      <p className="lt-interlude-sub">Mỗi chiếc đèn là một bức tranh Đông Hồ trên giấy dó, làm thủ công — và một lá thư chỉ dành cho bạn.</p>
      <button ref={btn} type="button" className={`lt-btn lt-interlude-go${ready ? ' is-ready' : ''}`} onClick={onDone}>
        Bước vào
      </button>
    </section>
  )
}
