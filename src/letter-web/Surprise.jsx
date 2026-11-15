import { useEffect, useRef, useState } from 'react'
import { playOccasion } from './effects.js'

/** Minh hoạ gốc, hai cỡ WebP; nến tương tác là lớp riêng trên bánh. */
function OccasionArtwork({ theme, children }) {
  return (
    <div className="lw-occasion-art">
      <img
        src={`${theme.artwork}-960.webp`}
        srcSet={`${theme.artwork}-480.webp 480w, ${theme.artwork}-960.webp 960w`}
        sizes="(max-width: 480px) calc(100vw - 80px), 456px"
        alt={theme.artworkAlt}
        width={960}
        height={640}
        decoding="async"
      />
      {children}
    </div>
  )
}

/** Bánh minh hoạ giấy dó và nến có thể thổi tắt. */
function Cake({ theme, blown, onBlow }) {
  return (
    <div className={`lw-cake${blown ? ' is-blown' : ''}`}>
      <OccasionArtwork theme={theme}>
        <div className="lw-cake-candles" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className="lw-candle">
              <i className="lw-flame" />
              <i className="lw-smoke" />
            </span>
          ))}
        </div>
      </OccasionArtwork>
      {!blown && (
        <button type="button" className="lw-btn lw-btn-primary" onClick={onBlow}>
          Ước một điều rồi thổi nến
        </button>
      )}
    </div>
  )
}

/**
 * Điều bất ngờ theo dịp (D-140): khung giữa màn hình + hiệu ứng canvas-confetti của dịp.
 * Sinh nhật phải thổi nến mới hiện lời chúc; dịp khác hiện ngay. Esc / nút đóng quay lại lá thư.
 */
export default function Surprise({ letter, theme, onClose }) {
  const d = letter.occasionData ?? {}
  const birthday = letter.occasion === 'birthday'
  const [blown, setBlown] = useState(!birthday)
  const cardRef = useRef(null)

  useEffect(() => {
    // Focus vào nút đầu tiên của khung (thổi nến với sinh nhật, ngược lại là nút quay lại)
    cardRef.current?.querySelector('button')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  // Hiệu ứng chạy khi lời chúc hiện; đóng khung thì dừng
  useEffect(() => (blown ? playOccasion(letter.occasion, { icon: d.icon }) : undefined), [blown, letter.occasion, d.icon])

  return (
    <div className="lw-surprise" role="dialog" aria-modal="true" aria-label={theme.surprise}>
      <div ref={cardRef} className={`lw-surprise-card lw-surprise-${letter.occasion}`}>
        <p className="lw-kicker">{theme.label}</p>
        {!birthday && <OccasionArtwork theme={theme} />}
        {birthday && (
          <Cake
            theme={theme}
            blown={blown}
            onBlow={() => {
              setBlown(true)
              // Nút thổi nến biến mất → focus sang nút quay lại
              requestAnimationFrame(() => cardRef.current?.querySelector('.lw-surprise-back')?.focus())
            }}
          />
        )}
        {letter.occasion === 'justBecause' && d.icon && (
          <div className="lw-surprise-icon" aria-hidden="true">
            {d.icon}
          </div>
        )}
        {letter.occasion === 'anniversary' && (
          <>
            {d.photos?.length > 0 && (
              <div className="lw-photos">
                {d.photos.map((src, i) => (
                  <img key={src} src={src} alt={`Kỷ niệm ${i + 1}`} />
                ))}
              </div>
            )}
            {d.date && <strong className="lw-surprise-big">{d.date}</strong>}
          </>
        )}
        {letter.occasion === 'milestone' && d.label && <strong className="lw-surprise-big lw-badge">{d.label}</strong>}
        {letter.occasion === 'longDistance' && d.places?.length > 0 && (
          <p className="lw-places">
            {d.places.map((p, i) => (
              <span key={p}>
                {i > 0 && (
                  <svg className="lw-plane" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" />
                  </svg>
                )}
                {p}
              </span>
            ))}
          </p>
        )}
        {blown && (
          <div className="lw-surprise-text" role="status">
            <p>{d.message || 'Một chút thương, dành riêng cho bạn.'}</p>
            {letter.postscript && <p className="lw-ps">{letter.postscript}</p>}
          </div>
        )}
        <button type="button" className="lw-btn lw-surprise-back" onClick={onClose}>
          Quay lại lá thư
        </button>
      </div>
    </div>
  )
}
