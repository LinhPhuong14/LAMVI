import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pickFilmSrc } from '../lib/filmSrc.js'
import { INTRO_FILMS } from './films.js'
import './letters.css'

/**
 * D-138: phát lần lượt hai video LAMVI; xem hết video cuối mới gọi onDone (vào phòng bật đèn).
 * Video lỗi không phát được → cho "Tiếp tục" để người nhận không bị kẹt ngoài lá thư.
 * `canSkip`: người nhận đã xem hết ở lần trước. onDone(watchedAll) — watchedAll=false khi đi qua bằng
 * "Tiếp tục" (video lỗi) hoặc "Bỏ qua", để chỉ nhớ "đã xem" khi thật sự xem hết.
 */
export default function IntroFilms({ onDone, canSkip = false }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const watchedAll = useRef(true)
  // "Xem hết" (D-138): không cho tua vượt quá đoạn đã xem; tua lùi thoải mái
  const maxTime = useRef(0)
  const item = INTRO_FILMS[index]
  // Chọn bản 360p/720p theo màn hình và mạng (T-103). Chỉ render ở trình duyệt (sau khi mở thư).
  const src = useMemo(() => pickFilmSrc(item.film), [item])

  function next(ended) {
    if (!ended) watchedAll.current = false
    setFailed(false)
    maxTime.current = 0
    if (index + 1 < INTRO_FILMS.length) setIndex(index + 1)
    else onDone(watchedAll.current)
  }
  function onTimeUpdate(e) {
    const v = e.currentTarget
    if (!v.seeking && v.currentTime > maxTime.current) maxTime.current = v.currentTime
  }
  function onSeeking(e) {
    const v = e.currentTarget
    if (v.currentTime > maxTime.current + 1) v.currentTime = maxTime.current
  }
  function onEnded(e) {
    const v = e.currentTarget
    // Kết thúc nhờ tua tới cuối (không qua timeupdate) → chưa tính là xem hết
    if (Number.isFinite(v.duration) && v.duration > 0 && maxTime.current < v.duration - 2) {
      v.currentTime = maxTime.current
      return
    }
    next(true)
  }

  return (
    <section className="lt-intro" aria-label="Video mở đầu phong thư">
      <p className="lt-intro-step">
        {index + 1}/{INTRO_FILMS.length} · {item.kicker}
      </p>
      <h1 className="lt-intro-title">{item.title}</h1>
      {src && (
        <video
          key={item.key}
          className="lt-intro-video"
          src={src}
          poster={item.film.poster}
          controls
          playsInline
          preload="metadata"
          onEnded={onEnded}
          onTimeUpdate={onTimeUpdate}
          onSeeking={onSeeking}
          onError={() => setFailed(true)}
        />
      )}
      <p className="lt-intro-hint" aria-live="polite">
        {failed
          ? 'Video chưa phát được trên thiết bị này.'
          : index + 1 < INTRO_FILMS.length
            ? 'Xem hết video để tiếp tục.'
            : 'Xem hết video để bước vào căn phòng có lá thư dành cho bạn.'}
      </p>
      <div className="lt-intro-actions">
        {failed && (
          <button type="button" className="lt-btn" onClick={() => next(false)}>
            Tiếp tục
          </button>
        )}
        {canSkip && !failed && (
          <button type="button" className="lt-btn lt-btn-ghost" onClick={() => onDone(false)}>
            Bỏ qua, vào phòng
          </button>
        )}
      </div>
    </section>
  )
}

/**
 * Xem lại một video (cuối thư): cách làm đèn / lịch sử văn hoá.
 * Gắn vào <body> (portal): tờ thư trong Phòng thư có transform/filter nên `position: fixed` bên trong sẽ bị kẹt theo tờ giấy.
 */
export function FilmOverlay({ item, onClose, children }) {
  const src = useMemo(() => pickFilmSrc(item.film), [item])
  const closeRef = useRef(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [item, onClose])
  return createPortal(
    <div className="lt-overlay" role="dialog" aria-modal="true" aria-label={item.title}>
      <div className="lt-overlay-box">
        <button ref={closeRef} type="button" className="lt-overlay-close" onClick={onClose} aria-label="Đóng video">
          ×
        </button>
        <p className="lt-intro-step">{item.kicker}</p>
        <h2 className="lt-intro-title">{item.title}</h2>
        {src && <video className="lt-intro-video" src={src} poster={item.film.poster} controls playsInline autoPlay />}
        {children}
      </div>
    </div>,
    document.body,
  )
}
