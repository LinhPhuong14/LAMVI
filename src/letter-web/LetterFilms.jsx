import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { pickFilmSrc } from '../lib/filmSrc.js'
import { letterText } from './i18n.js'

// D-158, D-159: hai video LAMVI (tranh Đông Hồ trên đèn, làng giấy dó làm đèn) trong thẻ nổi
// "Xem tiếp câu chuyện của LAMVI" — hiện 5 giây sau khi thư viết xong, không che hẳn lá thư, đóng được.
// Poster → bấm mới tải video; mỗi lúc một video; chữ theo ngôn ngữ thư (D-157).
// D-160: trên điện thoại/máy tính bảng, bấm video → toàn màn hình nằm ngang.
const FILMS = [
  { key: 'culture', film: CRAFT_FILMS.dongho },
  { key: 'craft', film: CRAFT_FILMS.paper },
]

const isTouch = () => typeof window !== 'undefined' && Boolean(window.matchMedia?.('(pointer: coarse)').matches)

/**
 * Android/iPad: requestFullscreen rồi khoá hướng ngang. iPhone (không có requestFullscreen cho phần tử):
 * trình phát toàn màn hình của iOS (webkitEnterFullscreen) — hướng xoay theo máy, web không khoá được.
 * Phải gọi ngay trong sự kiện bấm (cử chỉ người dùng), nên video được gắn bằng flushSync trước.
 */
function enterLandscape(video) {
  try {
    if (video.requestFullscreen) {
      video
        .requestFullscreen({ navigationUI: 'hide' })
        .then(() => screen.orientation?.lock?.('landscape')?.catch?.(() => {}))
        .catch(() => {})
    } else video.webkitEnterFullscreen?.()
  } catch {
    /* trình duyệt không cho toàn màn hình: vẫn phát trong thẻ */
  }
}

function leaveLandscape() {
  try {
    screen.orientation?.unlock?.()
    if (document.fullscreenElement) document.exitFullscreen?.()?.catch?.(() => {})
  } catch {
    /* bỏ qua */
  }
}

export default function LetterFilms({ T = letterText('vi'), onClose }) {
  const [playing, setPlaying] = useState(null)
  const videoRef = useRef(null)

  // Thoát toàn màn hình (nút của trình duyệt / vuốt) → mở khoá hướng; rời thẻ → thoát toàn màn hình
  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) {
        try {
          screen.orientation?.unlock?.()
        } catch {
          /* bỏ qua */
        }
      }
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      if (document.fullscreenElement) leaveLandscape()
    }
  }, [])

  const play = (key) => {
    if (document.fullscreenElement) leaveLandscape()
    flushSync(() => setPlaying(key))
    const v = videoRef.current
    if (!v) return
    v.play?.()?.catch?.(() => {})
    if (isTouch()) enterLandscape(v)
  }

  return (
    <aside className={`lw-films${playing ? ' is-playing' : ''}`} aria-label={T.films.heading}>
      <div className="lw-films-head">
        <p className="lw-films-heading">{T.films.heading}</p>
        <button type="button" className="lw-films-close" onClick={onClose} aria-label={T.films.close}>
          ×
        </button>
      </div>
      <div className="lw-films-list">
        {FILMS.map(({ key, film }) => {
          const t = T.films[key]
          return (
            <figure key={key} className={`lw-film${playing === key ? ' is-active' : ''}`}>
              {playing === key ? (
                <video
                  ref={videoRef}
                  src={pickFilmSrc(film)}
                  poster={film.poster}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t.title}
                  onEnded={() => document.fullscreenElement && leaveLandscape()}
                />
              ) : (
                <button type="button" className="lw-film-poster" onClick={() => play(key)} style={{ backgroundImage: `url(${film.poster})` }} aria-label={`${T.films.play}: ${t.title}`}>
                  <span className="lw-film-play" aria-hidden="true">
                    ▶
                  </span>
                </button>
              )}
              <figcaption>
                <span>{t.kicker}</span>
                {t.title}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </aside>
  )
}
