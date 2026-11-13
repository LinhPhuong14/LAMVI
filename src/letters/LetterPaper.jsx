import { useEffect, useState } from 'react'
import { OCCASION_LABELS, SURPRISE_CUE, paragraphsOf } from './occasions.js'
import HandwrittenTitle from './HandwrittenTitle.jsx'
import './letters.css'

/**
 * D-134: lá thư 2D (phong bì → thư → điều bất ngờ). Dùng cho trang người nhận và khung xem trước
 * trong admin. Nhận đúng hình dạng `letter` của Phòng thư (src/letter-room/data.js) để sau này
 * thay bằng cảnh 3D mà không đổi dữ liệu.
 *
 * @param {object} p
 * @param {object} p.letter
 * @param {boolean} [p.preview] khung xem trước admin: mở sẵn thư, không chiếm cả màn hình
 * @param {import('react').ReactNode} [p.afterLetter] nội dung dưới cùng lá thư (nút xem lại video — D-138)
 */
export default function LetterPaper({ letter, preview = false, afterLetter = null }) {
  // D-138: căn phòng tối → chạm bật đèn → phong bì → thư. Xem trước admin vào thẳng thư.
  const [lit, setLit] = useState(preview)
  const [envelope, setEnvelope] = useState(preview)
  const [opened, setOpened] = useState(preview)
  const [surprise, setSurprise] = useState(false)
  // Tiêu đề viết tay xong → nội dung chính fade in
  const [titleDone, setTitleDone] = useState(preview)
  useEffect(() => {
    if (!lit || envelope) return
    // Để ánh đèn sáng dần rồi mới đặt phong bì lên bàn
    const id = setTimeout(() => setEnvelope(true), 900)
    return () => clearTimeout(id)
  }, [lit, envelope])
  if (!letter) return null
  const paragraphs = paragraphsOf(letter.message)
  const od = letter.occasionData ?? null
  const hasSurprise = Boolean(od && (od.message || od.label || od.date || od.places?.length || od.photos?.length))

  return (
    <div className={`lt-stage${preview ? ' lt-preview' : ''}`}>
      {!envelope ? (
        <div className={`lt-room${lit ? ' is-lit' : ''}`}>
          <button type="button" className="lt-lamp" onClick={() => setLit(true)} disabled={lit} aria-label="Bật đèn">
            <span className="lt-lamp-glow" aria-hidden="true" />
            <span className="lt-lamp-shade" aria-hidden="true" />
            <span className="lt-lamp-base" aria-hidden="true" />
          </button>
          <p className="lt-room-hint" aria-live="polite">
            {lit ? 'Đèn đã sáng. Có một lá thư đang chờ bạn…' : 'Căn phòng còn tối. Chạm vào chiếc đèn để bật.'}
          </p>
        </div>
      ) : !opened ? (
        <button type="button" className="lt-envelope" onClick={() => setOpened(true)} aria-label={`Mở thư gửi ${letter.recipientName}`}>
          <span className="lt-envelope-flap" aria-hidden="true" />
          <span className="lt-envelope-to">Gửi {letter.recipientName}</span>
          <span className="lt-envelope-seal" aria-hidden="true">LAMVI</span>
          <span className="lt-envelope-cue">Chạm để mở thư</span>
        </button>
      ) : (
        <article className="lt-paper" aria-label={`Thư từ ${letter.senderName}`}>
          <p className="lt-occasion">{OCCASION_LABELS[letter.occasion] ?? ''}</p>
          <HandwrittenTitle text={`Gửi ${letter.recipientName},`} instant={preview} onDone={() => setTitleDone(true)} />
          <div className={`lt-content${titleDone ? ' is-shown' : ''}`}>
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
            {afterLetter}
          </div>
        </article>
      )}
    </div>
  )
}
