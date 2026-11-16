import { useEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { pickFilmSrc } from '../lib/filmSrc.js'
import { localePath } from '../i18n/core.js'
import { OUTRO_FILMS } from './outroFilms.js'
import { lampSrc } from './themes.js'
import { letterText } from './i18n.js'

const isTouch = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)

// Android/iPad: cả khung outro toàn màn hình (giữ thanh điều khiển của mình) rồi khoá hướng ngang.
// iPhone không có requestFullscreen cho phần tử: khung đã phủ kín màn hình bằng CSS, người xem tự xoay ngang.
function enterFullscreen(el) {
  try {
    el
      ?.requestFullscreen?.({ navigationUI: 'hide' })
      ?.then?.(() => screen.orientation?.lock?.('landscape')?.catch?.(() => {}))
      ?.catch?.(() => {})
  } catch {
    /* không cho toàn màn hình: khung vẫn phủ kín cửa sổ */
  }
}
function leaveFullscreen() {
  // Hai lệnh tách riêng: unlock() lỗi (trình duyệt không hỗ trợ) không được chặn việc thoát toàn màn hình
  try {
    screen.orientation?.unlock?.()
  } catch {
    /* bỏ qua */
  }
  try {
    if (typeof document !== 'undefined' && document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
  } catch {
    /* bỏ qua */
  }
}

const SoundIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 9v6h4l5 4V5L8 9H4z" />
    <path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" />
  </svg>
)
const RotateIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="7" width="18" height="10" rx="2" fill="none" />
    <path d="M7 4.5A9 9 0 0 1 17 4.5M17 4.5l-2.2-1.4M17 4.5l-1 2.3" fill="none" />
  </svg>
)

/**
 * D-161: outro "Câu chuyện của LAMVI" — màn lời dẫn (hai phần phim, gợi ý bật tiếng/xoay ngang) →
 * hai phim phát liền nhau trong khung tối toàn màn hình (thanh tiến độ hai đoạn, "Phần tiếp theo", đóng) →
 * màn kết (đèn sáng, quay lại lá thư / xem lại / đọc thêm). Chữ theo ngôn ngữ thư (D-157).
 * Phim phát trên CÙNG một thẻ <video> (đổi src) để iPhone cho phát tiếp phần 2 mà không cần bấm lại.
 *
 * @param {{ T?: object, lang?: string, lamp?: string, onClose: () => void }} p
 */
export default function LetterOutro({ T = letterText('vi'), lang = 'vi', lamp, onClose }) {
  const t = T.films
  const [step, setStep] = useState('lead')
  const [index, setIndex] = useState(0)
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState(0)
  const rootRef = useRef(null)
  const videoRef = useRef(null)
  const primaryRef = useRef(null)
  const item = OUTRO_FILMS[index]
  const src = useMemo(() => pickFilmSrc(item.film), [item])
  const total = OUTRO_FILMS.length

  const play = () => {
    const v = videoRef.current
    if (!v || typeof v.play !== 'function') return
    try {
      v.play()?.catch?.(() => {})
    } catch {
      /* trình duyệt chặn tự phát: còn nút điều khiển của video */
    }
  }
  const close = () => {
    leaveFullscreen()
    onClose()
  }
  const start = () => {
    setIndex(0)
    setFailed(false)
    setProgress(0)
    // Gắn <video> ngay trong cử chỉ bấm để play() + toàn màn hình được trình duyệt cho phép
    flushSync(() => setStep('play'))
    if (isTouch()) enterFullscreen(rootRef.current)
    play()
  }
  const next = () => {
    if (index + 1 < total) {
      setFailed(false)
      setProgress(0)
      setIndex(index + 1)
    } else {
      leaveFullscreen()
      setStep('end')
    }
  }

  // Sang phần sau: src đổi trên cùng thẻ video → phát tiếp
  useEffect(() => {
    if (step === 'play' && index > 0) play()
  }, [index, step])
  useEffect(() => {
    primaryRef.current?.focus({ preventScroll: true })
  }, [step])
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && close()
    const onFs = () => {
      if (!document.fullscreenElement) {
        try {
          screen.orientation?.unlock?.()
        } catch {
          /* bỏ qua */
        }
      }
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onFs)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onFs)
      leaveFullscreen()
    }
  }, []) // oxlint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={rootRef} className={`lw-outro is-${step}`} role="dialog" aria-modal="true" aria-labelledby={`lw-outro-${step}`}>
      {step !== 'play' && <div className="lw-outro-bg" style={{ backgroundImage: `url(${OUTRO_FILMS[step === 'end' ? 1 : 0].film.poster})` }} aria-hidden="true" />}
      {step === 'lead' && (
        <div className="lw-outro-lead">
          <div className="lw-outro-copy">
            <p className="lw-outro-kicker">{t.leadKicker}</p>
            <h2 id="lw-outro-lead" className="lw-outro-title">
              {t.leadTitle}
            </h2>
            <p className="lw-outro-text">{t.leadText}</p>
          </div>
          <div className="lw-outro-side">
            <ol className="lw-outro-chapters">
              {OUTRO_FILMS.map(({ key, film }, i) => (
                <li key={key}>
                  <img src={film.poster} alt="" decoding="async" />
                  <div>
                    <span>{t.part(i + 1, total)}</span>
                    <strong>{t[key].title}</strong>
                    <small>{t[key].desc}</small>
                  </div>
                </li>
              ))}
            </ol>
            <ul className="lw-outro-hints">
              <li>
                <SoundIcon />
                {t.soundHint}
              </li>
              <li className="lw-outro-touch">
                <RotateIcon />
                {t.rotateHint}
              </li>
            </ul>
            <div className="lw-outro-actions">
              <button ref={primaryRef} type="button" className="lw-btn lw-btn-primary" onClick={start}>
                <span aria-hidden="true">▶</span> {t.start}
              </button>
              <button type="button" className="lw-btn lw-outro-ghost" onClick={close}>
                {t.later}
              </button>
            </div>
          </div>
        </div>
      )}

      {step === 'play' && (
        <div className="lw-outro-player">
          <h2 id="lw-outro-play" className="lw-sr-only">
            {t[item.key].title}
          </h2>
          <video
            ref={videoRef}
            className="lw-outro-video"
            src={src}
            poster={item.film.poster}
            controls
            playsInline
            preload="auto"
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration > 0) setProgress(Math.min(1, v.currentTime / v.duration))
            }}
            onEnded={next}
            onError={() => setFailed(true)}
          />
          <div className="lw-outro-bar">
            <div className="lw-outro-progress" aria-hidden="true">
              {OUTRO_FILMS.map(({ key }, i) => (
                <i key={key}>
                  <b style={{ transform: `scaleX(${i < index ? 1 : i === index ? progress : 0})` }} />
                </i>
              ))}
            </div>
            <div className="lw-outro-bar-row">
              <p className="lw-outro-now">
                <span>{t.part(index + 1, total)}</span> {t[item.key].title}
              </p>
              <button ref={primaryRef} type="button" className="lw-outro-chip" onClick={next}>
                {index + 1 < total ? t.next : t.finish} <span aria-hidden="true">›</span>
              </button>
              <button type="button" className="lw-outro-x" onClick={close} aria-label={t.close}>
                ×
              </button>
            </div>
          </div>
          <p className="lw-outro-rotate" aria-hidden="true">
            <RotateIcon />
            {t.rotateHint}
          </p>
          {failed && (
            <div className="lw-outro-failed" role="alert">
              <p>{t.failed}</p>
              <button type="button" className="lw-btn lw-btn-primary" onClick={next}>
                {index + 1 < total ? t.next : t.finish}
              </button>
            </div>
          )}
        </div>
      )}

      {step === 'end' && (
        <div className="lw-outro-end">
          <div className="lw-outro-end-lamp" aria-hidden="true">
            <i />
            <img src={lampSrc(lamp)} alt="" decoding="async" />
          </div>
          <div className="lw-outro-copy">
            <p className="lw-outro-kicker">{t.endKicker}</p>
            <h2 id="lw-outro-end" className="lw-outro-title">
              {t.endTitle}
            </h2>
            <p className="lw-outro-text">{t.endText}</p>
            <div className="lw-outro-actions">
              <button ref={primaryRef} type="button" className="lw-btn lw-btn-primary" onClick={close}>
                {t.backToLetter}
              </button>
              <button type="button" className="lw-btn lw-outro-ghost" onClick={start}>
                {t.replay}
              </button>
            </div>
            <a className="lw-outro-more" href={localePath(lang, '/welcome')} target="_blank" rel="noopener">
              {t.more} ↗
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
