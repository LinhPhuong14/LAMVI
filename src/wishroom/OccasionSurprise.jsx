import { useState } from 'react'

/**
 * Cảnh E — "bất ngờ theo dịp tặng quà". Chỉ 3 dịp có giao diện ở đợt này (IMPLEMENTED_OCCASIONS
 * trong data.js): birthday, anniversary, justBecause. Luôn nằm trong cùng khối với lá thư (yêu
 * cầu "giữ vật thể bất ngờ trong cùng vùng nhìn với lá thư") — đây là một phần của `LetterReader`,
 * không phải vật thể 3D rời, vì tới lúc này cảnh đã chuyển sang lớp đọc HTML (xem Cảnh D).
 * Thay một hiệu ứng chính cho tái bút chung khi có (quy tắc chung mục 2) — mỗi lời chúc tối đa một
 * hiệu ứng bất ngờ.
 */
export default function OccasionSurprise({ occasion, data, reducedMotion }) {
  if (occasion === 'birthday') return <BirthdaySurprise data={data} reducedMotion={reducedMotion} />
  if (occasion === 'anniversary') return <AnniversarySurprise data={data} reducedMotion={reducedMotion} />
  if (occasion === 'justBecause') return <JustBecauseSurprise data={data} reducedMotion={reducedMotion} />
  return null
}

function BirthdaySurprise({ data, reducedMotion }) {
  const [stage, setStage] = useState('idle') // idle -> blown -> revealed
  const blown = stage !== 'idle'
  const revealed = stage === 'revealed'

  function blowCandle() {
    if (stage !== 'idle') return
    if (reducedMotion) {
      setStage('revealed')
      return
    }
    setStage('blown')
    setTimeout(() => setStage('revealed'), 700)
  }

  return (
    <div className="wishroom-occasion wishroom-occasion-birthday">
      {/* Chỉ phần bánh là trang trí thuần, nhưng nến là nút bấm thật — không đặt aria-hidden ở
          đây, nếu không nút "Thổi nến" bị ẩn khỏi cây hỗ trợ tiếp cận luôn (bọc cả nút bên trong) */}
      <div className="wishroom-cake">
        <div className="wishroom-cake-tier wishroom-cake-tier-2" />
        <div className="wishroom-cake-tier wishroom-cake-tier-1" />
        <button
          type="button"
          className={`wishroom-candle${blown ? ' is-blown' : ''}`}
          onClick={blowCandle}
          aria-label="Thổi nến"
          disabled={blown}
        >
          {!blown && <span className="wishroom-flame" />}
          {blown && !reducedMotion && <span className="wishroom-smoke-ring" />}
        </button>
      </div>
      {!blown && (
        <p className="wishroom-occasion-hint" lang="vi">
          Ước một điều đi.
        </p>
      )}
      {revealed && (
        <div className="wishroom-occasion-note">
          <p>{data.wish}</p>
        </div>
      )}
    </div>
  )
}

function AnniversarySurprise({ data, reducedMotion }) {
  const [pulled, setPulled] = useState(false)
  const [index, setIndex] = useState(0)
  const photos = data.photos
  const hasPhotos = Array.isArray(photos) && photos.length > 0

  if (!hasPhotos) {
    return (
      <div className="wishroom-occasion wishroom-occasion-anniversary">
        <button type="button" className="wishroom-ann-card" onClick={() => setPulled(true)} aria-expanded={pulled}>
          {!pulled ? 'Chạm để xem kỷ niệm' : null}
          {pulled && (
            <span className="wishroom-ann-card-content">
              <strong>{data.date}</strong>
              <span>{data.caption}</span>
            </span>
          )}
        </button>
      </div>
    )
  }

  const current = photos[index]

  return (
    <div className="wishroom-occasion wishroom-occasion-anniversary">
      {!pulled ? (
        <button type="button" className={`wishroom-photo-corner${reducedMotion ? ' no-anim' : ''}`} onClick={() => setPulled(true)}>
          Kéo ảnh ra
        </button>
      ) : (
        <div className="wishroom-photo-frame">
          <img src={current.url} alt={current.label ?? ''} className="wishroom-photo" />
          <p className="wishroom-photo-caption">
            <strong>{current.date}</strong> — {current.caption}
          </p>
          {photos.length > 1 && (
            <button type="button" className="wishroom-photo-next" onClick={() => setIndex((i) => (i + 1) % photos.length)}>
              Xem ảnh {photos[(index + 1) % photos.length].label ?? 'khác'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

function JustBecauseSurprise({ data, reducedMotion }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="wishroom-occasion wishroom-occasion-justbecause">
      {!open ? (
        <button type="button" className={`wishroom-shape-tab wishroom-shape-${data.shape}${reducedMotion ? ' no-anim' : ''}`} onClick={() => setOpen(true)}>
          Nhìn kỹ chụp đèn — có {data.shapeLabel ?? 'một hình nhỏ'}
        </button>
      ) : (
        <div className="wishroom-occasion-note">
          <p>{data.note}</p>
        </div>
      )}
    </div>
  )
}
