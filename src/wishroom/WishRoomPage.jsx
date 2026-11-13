import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
// Font riêng của trang này (lazy route): Spectral cho thân thư, Itim cho chữ viết tay (có đủ dấu
// tiếng Việt — Caveat/Instrument Sans không có bộ "vietnamese", xem decisions.md T-104).
// Be Vietnam Pro (hướng dẫn/giao diện) đã nạp sẵn ở main.jsx.
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/600.css'
import '@fontsource/spectral/400-italic.css'
import '@fontsource/itim/400.css'
import { useWishRoomMachine } from './useWishRoomMachine.js'
import { getSampleWish } from './data.js'
import WishRoomScene from './WishRoomScene.jsx'
import LetterReader from './LetterReader.jsx'
import Fallback2D from './Fallback2D.jsx'
import Seo from '../seo/Seo.jsx'
import './wishroom.css'

function detectWebGL() {
  try {
    const canvas = document.createElement('canvas')
    return Boolean(canvas.getContext('webgl2') || canvas.getContext('webgl'))
  } catch {
    return false
  }
}

// Cùng cách làm với useFinePointer (src/lib/motion.js): useSyncExternalStore đọc thẳng matchMedia,
// không cần setState trong effect (và không lệch hydrate — mặc định false ở lần render đầu/SSR).
const REDUCE_QUERY = '(prefers-reduced-motion: reduce)'
const reduceMq = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(REDUCE_QUERY) : null)
const subscribeReduce = (cb) => {
  const mq = reduceMq()
  mq?.addEventListener?.('change', cb)
  return () => mq?.removeEventListener?.('change', cb)
}
function usePrefersReducedMotion() {
  return useSyncExternalStore(subscribeReduce, () => reduceMq()?.matches ?? false, () => false)
}

const INSTRUCTION = {
  roomDark: 'Chạm để bật đèn',
  roomLit: 'Chạm vào phong bì để mở thư',
  envelopeFocus: 'Kéo mép giấy lên',
}

/**
 * Trang prototype "Phòng thư LAMVI" (nhận lời chúc) — dữ liệu mẫu cục bộ, xem `./data.js`.
 * `?mau=video` xem mẫu thư video, mặc định (hoặc `?mau=chu`) xem mẫu thư chữ.
 */
export default function WishRoomPage() {
  const [params] = useSearchParams()
  const wish = useMemo(() => getSampleWish(params.get('mau')), [params])
  const reducedMotion = usePrefersReducedMotion()
  // Đọc trực tiếp lúc khởi tạo state (không phải effect): detectWebGL() chỉ đọc khả năng trình
  // duyệt, không có tác dụng phụ cần đồng bộ hoá — tránh một lượt render thừa (null → true/false).
  const [webglOk] = useState(detectWebGL)

  const head = <Seo title="Phòng thư LAMVI" noindex />

  if (!webglOk)
    return (
      <>
        {head}
        <Fallback2D wish={wish} reducedMotion={reducedMotion} />
      </>
    )
  return (
    <>
      {head}
      <WishRoom3D wish={wish} reducedMotion={reducedMotion} />
    </>
  )
}

function WishRoom3D({ wish, reducedMotion }) {
  const machine = useWishRoomMachine()
  const sceneRef = useRef(null)
  const [letterRect, setLetterRect] = useState(null)
  const [postscriptOpen, setPostscriptOpen] = useState(false)
  const [lampPoint, setLampPoint] = useState(null)
  const [envelopePoint, setEnvelopePoint] = useState(null)

  // Vị trí nút "Chạm để bật đèn" (gần đèn, khung rộng cố định) — đồng bộ với engine Three.js (hệ
  // ngoài), nạp động và sẵn sàng không cùng lúc với lần render đầu nên phải polling bằng rAF.
  // oxlint-disable-next-line react/set-state-in-effect
  useEffect(() => {
    let raf = 0
    let tries = 0
    const tryRead = () => {
      const p = sceneRef.current?.getLampPoint?.()
      if (p) {
        setLampPoint(p)
        return
      }
      if (tries++ < 60) raf = requestAnimationFrame(tryRead)
    }
    raf = requestAnimationFrame(tryRead)
    return () => cancelAnimationFrame(raf)
  }, [])

  function refreshLetterRect() {
    const rect = sceneRef.current?.getLetterRect?.()
    if (rect) setLetterRect(rect)
  }

  useEffect(() => {
    if (machine.phase !== 'letterOpen' && machine.phase !== 'postscriptOpen') return undefined
    const onResize = () => refreshLetterRect()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [machine.phase])

  function handleLightTap() {
    if (machine.phase !== 'roomDark' || machine.busy) return
    machine.request('roomLit')
    sceneRef.current?.lightUp(() => machine.settle())
  }

  function handleEnvelopeTap() {
    if (machine.phase !== 'roomLit' || machine.busy) return
    machine.request('envelopeFocus')
    sceneRef.current?.focusEnvelope(() => {
      machine.settle()
      setEnvelopePoint(sceneRef.current?.getEnvelopePoint?.() ?? null)
    })
  }

  function openLetter() {
    if (machine.phase !== 'envelopeFocus' || machine.busy) return
    machine.request('letterReady')
    sceneRef.current?.commitLetterOut(() => {
      machine.advance('letterOpen')
      refreshLetterRect()
    })
  }

  function cancelDrag() {
    sceneRef.current?.snapLetterBack()
  }

  // Tái bút chỉ mở qua tab HTML của LetterReader (onRequestPostscript) — tới lúc đó lớp đọc đã phủ
  // lên canvas nên không cần raycast nhận tag 'postscript' ở đây.
  function handleHit(tag) {
    if (tag === 'light') handleLightTap()
    else if (tag === 'envelope') handleEnvelopeTap()
  }

  function handleDragEnd(result) {
    if (result === 'commit') openLetter()
    else cancelDrag()
  }

  function handlePostscriptTap() {
    if (machine.phase !== 'letterOpen' || machine.busy || !wish.postscript) return
    machine.request('postscriptOpen')
    sceneRef.current?.openPostscript(() => machine.settle())
    setPostscriptOpen(true)
  }

  const instruction = INSTRUCTION[machine.phase]
  const showReader = machine.phase === 'letterOpen' || machine.phase === 'postscriptOpen'

  return (
    <div className="wishroom-page">
      <WishRoomScene ref={sceneRef} wish={wish} reducedMotion={reducedMotion} phase={machine.phase} busy={machine.busy} onHit={handleHit} onDragEnd={handleDragEnd} />

      <p className="wishroom-sr-instruction" role="status" aria-live="polite">
        {instruction ?? ''}
      </p>

      {machine.phase === 'roomDark' && lampPoint && (
        <button type="button" className="wishroom-guide" style={{ left: lampPoint.x, top: lampPoint.y }} onClick={handleLightTap}>
          {instruction}
        </button>
      )}

      {machine.phase === 'roomLit' && (
        <button type="button" className="wishroom-guide wishroom-guide-center-low" onClick={handleEnvelopeTap}>
          {instruction}
        </button>
      )}

      {machine.phase === 'envelopeFocus' && (
        <button
          type="button"
          className="wishroom-guide"
          style={envelopePoint ? { left: envelopePoint.x, top: envelopePoint.y - 36 } : undefined}
          onClick={openLetter}
        >
          {instruction}
        </button>
      )}

      {showReader && (
        <LetterReader wish={wish} rect={letterRect} reducedMotion={reducedMotion} postscriptOpen={postscriptOpen} onRequestPostscript={handlePostscriptTap} />
      )}
    </div>
  )
}
