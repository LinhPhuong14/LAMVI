import { useRef, useState } from 'react'
import InkGreeting from './InkGreeting.jsx'
import OccasionSurprise from './OccasionSurprise.jsx'
import { IMPLEMENTED_OCCASIONS } from './data.js'

/**
 * Cảnh D (đọc thư) + Cảnh E (bất ngờ theo dịp) / tái bút — lớp HTML thay cho lá thư 3D, căn theo
 * `rect` (bounding box màn hình của lá thư, từ `WishRoomScene.getLetterRect()`). Dùng chung cho
 * thư chữ và thư video (§4 dữ liệu).
 */
export default function LetterReader({ wish, rect, reducedMotion, postscriptOpen, onRequestPostscript }) {
  const [bodyShown, setBodyShown] = useState(reducedMotion)
  const [videoPlaying, setVideoPlaying] = useState(false)
  // Giảm chuyển động → nội dung hiện ngay (NFR-A11Y-001); video vẫn cần người bấm mới phát nên tái
  // bút của mẫu video chỉ mở khi `onEnded` (không phụ thuộc reducedMotion)
  const [canShowPostscript, setCanShowPostscript] = useState(reducedMotion && wish.kind === 'text')
  const videoRef = useRef(null)

  const style = rect
    ? { left: rect.left, top: rect.top, width: Math.max(rect.width, 220) }
    : undefined

  function handleInkDone() {
    setBodyShown(true)
    if (wish.kind === 'text') setCanShowPostscript(true)
  }

  function handleVideoEnded() {
    setCanShowPostscript(true)
  }

  // Cảnh E có hiệu ứng riêng thay cho P.S. chung (quy tắc chung mục 2: tối đa một hiệu ứng bất ngờ)
  const hasOccasionSurprise = IMPLEMENTED_OCCASIONS.includes(wish.occasion) && Boolean(wish.occasionData)
  const hasPostscript = !hasOccasionSurprise && Boolean(wish.postscript)
  // Điểm chạm bất ngờ: thư chữ → sau chữ ký (bodyShown); video → khi đã bấm xem, không bắt xem hết
  // mới cho mở (yêu cầu "nếu người nhận dừng xem giữa chừng, vẫn cho họ mở bất ngờ bên dưới trình
  // phát" — [ASSUMPTION] hiểu "video kết thúc" là mốc thường gặp, không phải điều kiện bắt buộc)
  const surpriseReady = wish.kind === 'text' ? bodyShown : videoPlaying

  return (
    <div className="wishroom-letter" style={style} role="group" aria-label={`Lời chúc gửi ${wish.recipientName}`}>
      <InkGreeting recipientName={wish.recipientName} reducedMotion={reducedMotion} onDone={handleInkDone} />

      {bodyShown && wish.kind === 'text' && (
        <div className="wishroom-letter-body">
          <p className="wishroom-letter-text">{wish.message}</p>
          <p className="wishroom-letter-sign">— {wish.senderName}</p>
        </div>
      )}

      {bodyShown && wish.kind === 'video' && (
        <div className="wishroom-letter-body wishroom-letter-video">
          {!videoPlaying ? (
            <button
              type="button"
              className="wishroom-video-cover"
              style={wish.posterUrl ? { backgroundImage: `url(${wish.posterUrl})` } : undefined}
              onClick={() => setVideoPlaying(true)}
            >
              <span className="wishroom-video-play" aria-hidden="true">
                ▶
              </span>
              <span>Xem lời nhắn</span>
            </button>
          ) : (
            // eslint-disable-next-line jsx-a11y/media-has-caption -- phụ đề tuỳ chọn, chỉ có khi wish.captionsUrl
            <video
              ref={videoRef}
              className="wishroom-video"
              src={wish.videoUrl}
              poster={wish.posterUrl}
              controls
              playsInline
              autoPlay
              onEnded={handleVideoEnded}
            >
              {wish.captionsUrl && <track kind="captions" src={wish.captionsUrl} srcLang="vi" label="Tiếng Việt" default />}
            </video>
          )}
          <p className="wishroom-letter-sign">— {wish.senderName}</p>
        </div>
      )}

      {hasOccasionSurprise && surpriseReady && <OccasionSurprise occasion={wish.occasion} data={wish.occasionData} reducedMotion={reducedMotion} />}

      {hasPostscript && canShowPostscript && !postscriptOpen && (
        <button type="button" className="wishroom-ps-tab" onClick={onRequestPostscript}>
          P.S.
        </button>
      )}

      {hasPostscript && postscriptOpen && (
        <div className="wishroom-postscript" role="note">
          <span className="wishroom-ps-label">P.S.</span>
          <p>{wish.postscript}</p>
        </div>
      )}
    </div>
  )
}
