// Toán học thuần cho tương tác "kéo lá thư" và easing camera — không phụ thuộc DOM/WebGL nên test
// được trực tiếp (xem dragProgress.test.js). Dùng chung bởi sceneEngine.js (chạy thật) và test.

/** Ngưỡng thả tay: dưới 40% quãng đường thì thư trượt về vị trí ban đầu (spec §Cảnh C). */
export const DRAG_COMMIT_THRESHOLD = 0.4

export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v
}

export function easeInOutCubic(t) {
  const c = clamp01(t)
  return c < 0.5 ? 4 * c * c * c : 1 - (-2 * c + 2) ** 3 / 2
}

export function easeOutCubic(t) {
  const c = clamp01(t)
  return 1 - (1 - c) ** 3
}

/**
 * Chiếu một hướng trong không gian 3D (trục rút giấy, theo local-up của phong bì) lên màn hình bằng
 * camera orthographic hiện tại, trả về vector đơn vị 2D (toạ độ màn hình: x phải, y xuống).
 * `camera` cần có `.worldToScreen(worldPoint) -> {x,y}` (sceneEngine bọc `Vector3.project`).
 */
export function projectAxisToScreen(worldToScreen, originWorld, axisWorld) {
  const tipWorld = { x: originWorld.x + axisWorld.x, y: originWorld.y + axisWorld.y, z: originWorld.z + axisWorld.z }
  const o = worldToScreen(originWorld)
  const t = worldToScreen(tipWorld)
  const dx = t.x - o.x
  const dy = t.y - o.y
  const len = Math.hypot(dx, dy) || 1
  return { x: dx / len, y: dy / len }
}

/**
 * Tiến độ kéo (0..1): chiếu vector kéo (delta con trỏ trên màn hình, tính từ lúc nhấn xuống) lên
 * trục rút giấy đã chiếu ra màn hình (`screenAxis`, đơn vị). `fullDistancePx` là quãng đường (px màn
 * hình) tương ứng với thư trượt ra hết — calibrate theo kích thước phong bì lúc camera đã focus.
 */
export function computeDragProgress({ screenAxis, deltaX, deltaY, fullDistancePx }) {
  if (!fullDistancePx || fullDistancePx <= 0) return 0
  const along = deltaX * screenAxis.x + deltaY * screenAxis.y
  return clamp01(along / fullDistancePx)
}

/** Thả tay ở tiến độ này thì thư tiếp tục trượt ra ('commit') hay lùi về vị trí đầu ('cancel'). */
export function resolveDragRelease(progress) {
  return progress >= DRAG_COMMIT_THRESHOLD ? 'commit' : 'cancel'
}

/**
 * Tween rAF dùng chung cho mọi hoạt ảnh có thời lượng (đèn sáng, camera, thư trượt). Giảm chuyển
 * động → nhảy thẳng tới giá trị cuối, không chạy rAF (NFR-A11Y-001).
 * `onUpdate(t)` nhận tiến độ đã qua easing (0..1). Trả về hàm hủy tween giữa chừng.
 */
export function tween({ duration, ease = easeInOutCubic, onUpdate, onDone, reducedMotion = false, now = () => performance.now(), raf = (cb) => requestAnimationFrame(cb), caf = (id) => cancelAnimationFrame(id) }) {
  if (reducedMotion || duration <= 0) {
    onUpdate(1)
    onDone?.()
    return () => {}
  }
  const start = now()
  let rafId = 0
  let cancelled = false
  const step = () => {
    if (cancelled) return
    const elapsed = now() - start
    const raw = clamp01(elapsed / duration)
    onUpdate(ease(raw))
    if (raw >= 1) {
      onDone?.()
      return
    }
    rafId = raf(step)
  }
  rafId = raf(step)
  return () => {
    cancelled = true
    caf(rafId)
  }
}
