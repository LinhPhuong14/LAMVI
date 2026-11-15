import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { pickFilmSrc } from '../lib/filmSrc.js'
import { INTRO_FILMS } from './films.js'
import '@fontsource/dancing-script/latin-700.css'
import '@fontsource/dancing-script/vietnamese-700.css'
import './letters.css'

/**
 * D-138: phát lần lượt hai video LAMVI; xem hết video cuối mới gọi onDone (vào phòng bật đèn).
 * D-145: mở đầu bằng màn "Cùng xem cách chiếc đèn được làm ra nhé" — bấm "Bắt đầu xem" (cử chỉ người dùng
 * cho phép phát có tiếng + toàn màn hình) → video toàn màn hình tự phát, hết video tự nối sang video sau,
 * hết video cuối thì thoát toàn màn hình rồi gọi onDone. Trình duyệt chặn tự phát → còn nút điều khiển để bấm.
 * Video lỗi không phát được → cho "Tiếp tục" để người nhận không bị kẹt ngoài lá thư.
 * `canSkip`: người nhận đã xem hết ở lần trước. onDone(watchedAll) — watchedAll=false khi đi qua bằng
 * "Tiếp tục" (video lỗi) hoặc "Bỏ qua", để chỉ nhớ "đã xem" khi thật sự xem hết.
 */
export default function IntroFilms({ onDone, canSkip = false }) {
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [started, setStarted] = useState(false)
  const watchedAll = useRef(true)
  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const startBtn = useRef(null)
  // "Xem hết" (D-138): không cho tua vượt quá đoạn đã xem; tua lùi thoải mái
  const maxTime = useRef(0)
  const item = INTRO_FILMS[index]
  // Chọn bản 360p/720p theo màn hình và mạng (T-103). Chỉ render ở trình duyệt (sau khi mở thư).
  const src = useMemo(() => pickFilmSrc(item.film), [item])

  useEffect(() => {
    startBtn.current?.focus({ preventScroll: true })
  }, [])
  // Rời màn video (unmount) khi đang toàn màn hình → thoát toàn màn hình
  useEffect(() => () => leaveFullscreen(), [])

  function finish(all) {
    leaveFullscreen()
    onDone(all)
  }
  function start() {
    setStarted(true)
    // Trong cử chỉ bấm: xin toàn màn hình cho cả khung (giữ nút/gợi ý của mình); không hỗ trợ (iPhone) thì
    // khung vẫn phủ kín màn hình bằng CSS
    try {
      const p = rootRef.current?.requestFullscreen?.({ navigationUI: 'hide' })
      // Android: đã toàn màn hình thì khoá hướng ngang (D-146); iPhone không hỗ trợ — bỏ qua
      p?.then?.(() => screen.orientation?.lock?.('landscape')?.catch?.(() => {}))?.catch?.(() => {})
    } catch {
      /* trình duyệt không cho toàn màn hình */
    }
    playCurrent()
  }
  function playCurrent() {
    const v = videoRef.current
    if (!v || typeof v.play !== 'function') return
    try {
      v.play()?.catch?.(() => {})
    } catch {
      /* jsdom / trình duyệt chặn: người nhận bấm nút phát */
    }
  }
  function next(ended) {
    if (!ended) watchedAll.current = false
    setFailed(false)
    maxTime.current = 0
    if (index + 1 < INTRO_FILMS.length) setIndex(index + 1)
    else finish(watchedAll.current)
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

  const skip = canSkip && !failed && (
    <button type="button" className="lt-btn lt-btn-ghost" onClick={() => finish(false)}>
      Bỏ qua, vào phòng
    </button>
  )

  return (
    <section ref={rootRef} className={`lt-intro${started ? ' is-playing' : ''}`} aria-label="Video mở đầu phong thư">
      <div className="lt-intro-player" inert={!started}>
        <header key={item.key} className="lt-intro-head">
          <p className="lt-intro-step">
            {index + 1}/{INTRO_FILMS.length} · {item.kicker}
          </p>
          <h1 className="lt-intro-title">{item.title}</h1>
        </header>
        {src && (
          <video
            key={item.key}
            ref={videoRef}
            className="lt-intro-video"
            src={src}
            poster={item.film.poster}
            controls
            playsInline
            // Video sau tự phát (đã có cử chỉ bấm "Bắt đầu xem" từ trước)
            autoPlay={started}
            preload={index === 0 ? 'auto' : 'metadata'}
            onEnded={onEnded}
            onTimeUpdate={onTimeUpdate}
            onSeeking={onSeeking}
            onError={() => setFailed(true)}
          />
        )}
        <footer className="lt-intro-foot">
          <p key={item.key} className="lt-intro-hint" aria-live="polite">
            {failed
              ? 'Video chưa phát được trên thiết bị này.'
              : index + 1 < INTRO_FILMS.length
                ? 'Hết video này sẽ tự chuyển sang video tiếp theo.'
                : 'Xem hết video để bước vào căn phòng có lá thư dành cho bạn.'}
          </p>
          <div className="lt-intro-actions">
            {failed && (
              <button type="button" className="lt-btn" onClick={() => next(false)}>
                Tiếp tục
              </button>
            )}
            {started && skip}
          </div>
        </footer>
      </div>

      {!started && (
        <div className="lt-intro-welcome" role="group" aria-labelledby="lt-intro-welcome-title">
          <p className="lt-intro-step">Trước khi mở thư</p>
          <h2 id="lt-intro-welcome-title" className="lt-intro-welcome-title">
            Cùng xem cách chiếc đèn
            <span className="lt-intro-welcome-hand">được làm ra nhé</span>
          </h2>
          <p className="lt-intro-welcome-sub">Hai video ngắn từ làng tranh Đông Hồ và làng giấy dó. Bật âm thanh để trọn vẹn hơn.</p>
          <div className="lt-intro-actions">
            <button ref={startBtn} type="button" className="lt-btn lt-intro-start" onClick={start}>
              <span aria-hidden="true">▶</span> Bắt đầu xem
            </button>
            {skip}
          </div>
        </div>
      )}
    </section>
  )
}

function leaveFullscreen() {
  try {
    if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
  } catch {
    /* bỏ qua */
  }
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
