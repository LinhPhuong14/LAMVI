import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { computeDragProgress, resolveDragRelease } from './dragProgress.js'

// Ngưỡng di chuyển (px) để phân biệt "chạm" (mở thư ngay) với "kéo" (theo tiến độ) khi nhấn xuống
// đúng mép giấy — spec cho phép cả hai (§Cảnh C).
const TAP_VS_DRAG_PX = 6

/**
 * Bọc canvas + engine Three.js (sceneEngine.js, nạp động để không vào bundle chính khi dùng lối
 * 2D). Không tự quyết định chuyển trạng thái — chỉ raycast và báo lên qua props, máy trạng thái ở
 * WishRoomPage.jsx quyết định có chấp nhận hay không (đang `busy` thì bỏ qua — xem yêu cầu §5.3).
 */
const WishRoomScene = forwardRef(function WishRoomScene({ wish, reducedMotion, phase, busy, onHit, onDragProgress, onDragEnd }, ref) {
  const canvasRef = useRef(null)
  const engineRef = useRef(null)
  const dragRef = useRef(null) // { pointerId, startX, startY, axis, fullPx, moved, active }
  const phaseRef = useRef(phase)
  const busyRef = useRef(busy)
  phaseRef.current = phase
  busyRef.current = busy

  useEffect(() => {
    let disposed = false
    import('./sceneEngine.js').then(({ createWishRoomEngine }) => {
      if (disposed) return
      const canvas = canvasRef.current
      const rect = canvas.getBoundingClientRect()
      canvas.width = Math.max(1, Math.round(rect.width * Math.min(window.devicePixelRatio || 1, 2)))
      canvas.height = Math.max(1, Math.round(rect.height * Math.min(window.devicePixelRatio || 1, 2)))
      const occasionShape = wish.occasion === 'justBecause' ? wish.occasionData?.shape : null
      const engine = createWishRoomEngine(canvas, { recipientName: wish.recipientName, reducedMotion, occasionShape })
      engine.resize(canvas.width, canvas.height)
      engineRef.current = engine
    })
    return () => {
      disposed = true
      engineRef.current?.dispose()
      engineRef.current = null
    }
    // wish/reducedMotion chỉ dùng lúc khởi tạo cảnh của trang này — trang luôn mount lại khi mẫu đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const onResize = () => {
      const engine = engineRef.current
      if (!engine) return
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      engine.resize(Math.max(1, Math.round(rect.width * dpr)), Math.max(1, Math.round(rect.height * dpr)))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  function toNdc(evt) {
    const rect = canvasRef.current.getBoundingClientRect()
    const x = ((evt.clientX - rect.left) / rect.width) * 2 - 1
    const y = -(((evt.clientY - rect.top) / rect.height) * 2 - 1)
    return { x, y }
  }

  function handlePointerDown(evt) {
    const engine = engineRef.current
    if (!engine) return
    const { x, y } = toNdc(evt)
    const tag = engine.hitTest(x, y)
    if (!tag) return
    if (tag === 'letterEdge' && phaseRef.current === 'envelopeFocus' && !busyRef.current) {
      engine.cancelAnimation()
      const axis = engine.getDragAxisScreen()
      const fullPx = engine.getSlideDistancePx()
      dragRef.current = { pointerId: evt.pointerId, startX: evt.clientX, startY: evt.clientY, axis, fullPx, moved: false }
      canvasRef.current.setPointerCapture(evt.pointerId)
      evt.preventDefault()
      return
    }
    onHit?.(tag)
  }

  function handlePointerMove(evt) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== evt.pointerId) return
    const deltaX = evt.clientX - drag.startX
    const deltaY = evt.clientY - drag.startY
    if (Math.hypot(deltaX, deltaY) > TAP_VS_DRAG_PX) drag.moved = true
    const progress = computeDragProgress({ screenAxis: drag.axis, deltaX, deltaY, fullDistancePx: drag.fullPx })
    engineRef.current?.setLetterProgress(progress)
    onDragProgress?.(progress)
  }

  function handlePointerUp(evt) {
    const drag = dragRef.current
    if (!drag || drag.pointerId !== evt.pointerId) return
    dragRef.current = null
    canvasRef.current.releasePointerCapture?.(evt.pointerId)
    if (!drag.moved) {
      // Chạm mép giấy mà không kéo → coi như mở hẳn (spec: "chạm vào mép giấy... để mở thư")
      onDragEnd?.('commit')
      return
    }
    const deltaX = evt.clientX - drag.startX
    const deltaY = evt.clientY - drag.startY
    const progress = computeDragProgress({ screenAxis: drag.axis, deltaX, deltaY, fullDistancePx: drag.fullPx })
    onDragEnd?.(resolveDragRelease(progress))
  }

  useImperativeHandle(
    ref,
    () => ({
      lightUp: (onDone) => engineRef.current?.animateLightUp(onDone),
      focusEnvelope: (onDone) => engineRef.current?.animateFocusEnvelope(onDone),
      commitLetterOut: (onDone) => engineRef.current?.animateLetterTo(1, onDone),
      snapLetterBack: (onDone) => engineRef.current?.animateLetterTo(0, onDone),
      openPostscript: (onDone) => engineRef.current?.animatePostscript(onDone),
      getLetterRect: () => engineRef.current?.getLetterScreenRect() ?? null,
      getLampPoint: () => engineRef.current?.getLampScreenPoint() ?? null,
      getEnvelopePoint: () => engineRef.current?.getEnvelopeScreenPoint() ?? null,
    }),
    [],
  )

  return (
    <canvas
      ref={canvasRef}
      className="wishroom-canvas"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      aria-hidden="true"
    />
  )
})

export default WishRoomScene
