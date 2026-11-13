import { useState } from 'react'
import { OCCASION_LABELS, SURPRISE_CUE, paragraphsOf } from './occasions.js'
import './letters.css'

/**
 * D-134: lá thư 2D (phong bì → thư → điều bất ngờ). Dùng cho trang người nhận và khung xem trước
 * trong admin. Nhận đúng hình dạng `letter` của Phòng thư (src/letter-room/data.js) để sau này
 * thay bằng cảnh 3D mà không đổi dữ liệu.
 *
 * @param {object} p
 * @param {object} p.letter
 * @param {boolean} [p.preview] khung xem trước admin: mở sẵn thư, không chiếm cả màn hình
 */
export default function LetterPaper({ letter, preview = false }) {
  const [opened, setOpened] = useState(preview)
  const [surprise, setSurprise] = useState(false)
  if (!letter) return null
  const paragraphs = paragraphsOf(letter.message)
  const od = letter.occasionData ?? null
  const hasSurprise = Boolean(od && (od.message || od.label || od.date || od.places?.length || od.photos?.length))

  return (
    <div className={`lt-stage${preview ? ' lt-preview' : ''}`}>
      {!opened ? (
        <button type="button" className="lt-envelope" onClick={() => setOpened(true)} aria-label={`Mở thư gửi ${letter.recipientName}`}>
          <span className="lt-envelope-flap" aria-hidden="true" />
          <span className="lt-envelope-to">Gửi {letter.recipientName}</span>
          <span className="lt-envelope-seal" aria-hidden="true">LAMVI</span>
          <span className="lt-envelope-cue">Chạm để mở thư</span>
        </button>
      ) : (
        <article className="lt-paper" aria-label={`Thư từ ${letter.senderName}`}>
          <p className="lt-occasion">{OCCASION_LABELS[letter.occasion] ?? ''}</p>
          <h1 className="lt-greeting">Gửi {letter.recipientName},</h1>
          {letter.kind === 'video' && letter.videoUrl ? (
            <video className="lt-video" controls playsInline preload="metadata" src={letter.videoUrl} poster={letter.posterUrl || undefined}>
              {letter.captionsUrl && <track kind="captions" src={letter.captionsUrl} srcLang="vi" label="Tiếng Việt" default />}
            </video>
          ) : null}
          {paragraphs.map((p, i) => (
            <p key={i} className="lt-body">
              {p}
            </p>
          ))}
          <p className="lt-sign">— {letter.senderName}</p>
          {letter.postscript && <p className="lt-ps">P.S. {letter.postscript}</p>}
          {hasSurprise &&
            (surprise ? (
              <aside className={`lt-surprise lt-surprise-${letter.occasion}`} aria-live="polite">
                {od.icon && <span className="lt-surprise-icon" aria-hidden="true">{od.icon}</span>}
                {od.label && <strong className="lt-surprise-label">{od.label}</strong>}
                {od.date && <time className="lt-surprise-date">{od.date}</time>}
                {od.places?.length > 0 && <p className="lt-surprise-places">{od.places.join(' · ')}</p>}
                {od.photos?.length > 0 && (
                  <div className="lt-surprise-photos">
                    {od.photos.map((src) => (
                      <img key={src} src={src} alt="Ảnh kỷ niệm" loading="lazy" />
                    ))}
                  </div>
                )}
                {od.message && <p>{od.message}</p>}
              </aside>
            ) : (
              <button type="button" className="lt-surprise-cue" onClick={() => setSurprise(true)}>
                {SURPRISE_CUE[letter.occasion] ?? 'Mở điều bất ngờ'}
              </button>
            ))}
        </article>
      )}
    </div>
  )
}
