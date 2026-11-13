import { useState } from 'react'
import { useWishRoomMachine } from './useWishRoomMachine.js'
import LetterReader from './LetterReader.jsx'

const INSTRUCTION = {
  roomDark: 'Chạm để bật đèn',
  roomLit: 'Chạm vào phong bì để mở thư',
  envelopeFocus: 'Chạm để kéo thư ra',
}

/**
 * Lối 2D khi WebGL không khởi tạo được (yêu cầu §4). Cùng máy trạng thái và cùng `LetterReader`
 * với bản 3D. Không có canvas/engine để "bận" trong lúc chờ nên settle ngay — không có animation
 * nào đang chạy ở lối này để disable nút chờ cho xong, khác với bản 3D (camera/ánh sáng thật sự
 * cần thời gian tween). Chuyển cảnh mượt bằng CSS transition trên nền theo class `wishroom-2d-*`.
 */
export default function Fallback2D({ wish, reducedMotion }) {
  const machine = useWishRoomMachine()
  const [postscriptOpen, setPostscriptOpen] = useState(false)

  function activate() {
    if (machine.busy) return
    if (machine.phase === 'roomDark') {
      machine.request('roomLit')
      machine.settle()
    } else if (machine.phase === 'roomLit') {
      machine.request('envelopeFocus')
      machine.settle()
    } else if (machine.phase === 'envelopeFocus') {
      machine.request('letterReady')
      machine.advance('letterOpen')
    }
  }

  function requestPostscript() {
    if (machine.phase !== 'letterOpen' || machine.busy) return
    machine.request('postscriptOpen')
    machine.settle()
    setPostscriptOpen(true)
  }

  const showLetter = machine.phase === 'letterOpen' || machine.phase === 'postscriptOpen'
  const instruction = INSTRUCTION[machine.phase]

  return (
    <div className={`wishroom-2d wishroom-2d-${machine.phase}`}>
      <p className="wishroom-instruction" role="status" aria-live="polite">
        {instruction}
      </p>
      {!showLetter && (
        <button type="button" className="wishroom-2d-action" onClick={activate} disabled={machine.busy}>
          <span className={`wishroom-2d-icon wishroom-2d-icon-${machine.phase === 'roomDark' ? 'lamp' : 'envelope'}`} aria-hidden="true" />
          {instruction}
        </button>
      )}
      {showLetter && (
        <LetterReader wish={wish} rect={null} reducedMotion={reducedMotion} postscriptOpen={postscriptOpen} onRequestPostscript={requestPostscript} />
      )}
    </div>
  )
}
