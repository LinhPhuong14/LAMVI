import { describe, expect, it, vi } from 'vitest'
import { DRAG_COMMIT_THRESHOLD, clamp01, computeDragProgress, easeInOutCubic, easeOutCubic, projectAxisToScreen, resolveDragRelease, tween } from './dragProgress.js'

describe('clamp01', () => {
  it('kẹp trong [0,1]', () => {
    expect(clamp01(-0.4)).toBe(0)
    expect(clamp01(1.4)).toBe(1)
    expect(clamp01(0.3)).toBe(0.3)
  })
})

describe('easing', () => {
  it('easeInOutCubic đi từ 0 tới 1, đơn điệu', () => {
    expect(easeInOutCubic(0)).toBe(0)
    expect(easeInOutCubic(1)).toBe(1)
    expect(easeInOutCubic(0.25)).toBeLessThan(easeInOutCubic(0.5))
    expect(easeInOutCubic(0.5)).toBeLessThan(easeInOutCubic(0.75))
  })
  it('easeOutCubic đi từ 0 tới 1', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
  })
})

describe('projectAxisToScreen', () => {
  it('trả vector đơn vị theo hướng chiếu màn hình', () => {
    // worldToScreen giả: trục world Y -> màn hình đi lên (y màn hình giảm)
    const worldToScreen = ({ x, y }) => ({ x: x * 10, y: -y * 10 })
    const axis = projectAxisToScreen(worldToScreen, { x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 })
    expect(axis.x).toBeCloseTo(0)
    expect(axis.y).toBeCloseTo(-1)
  })
})

describe('computeDragProgress', () => {
  const axis = { x: 0, y: -1 } // kéo lên màn hình = tiến độ dương
  it('kéo đúng hướng tăng tiến độ', () => {
    const p = computeDragProgress({ screenAxis: axis, deltaX: 0, deltaY: -50, fullDistancePx: 100 })
    expect(p).toBeCloseTo(0.5)
  })
  it('kéo ngược hướng cho tiến độ 0 (kẹp dưới 0)', () => {
    const p = computeDragProgress({ screenAxis: axis, deltaX: 0, deltaY: 50, fullDistancePx: 100 })
    expect(p).toBe(0)
  })
  it('kéo vượt quá quãng đường kẹp ở 1', () => {
    const p = computeDragProgress({ screenAxis: axis, deltaX: 0, deltaY: -500, fullDistancePx: 100 })
    expect(p).toBe(1)
  })
  it('fullDistancePx không hợp lệ → 0 (không chia cho 0)', () => {
    expect(computeDragProgress({ screenAxis: axis, deltaX: 0, deltaY: -50, fullDistancePx: 0 })).toBe(0)
  })
})

describe('resolveDragRelease', () => {
  it('đúng ngưỡng 40% (§Cảnh C)', () => {
    expect(DRAG_COMMIT_THRESHOLD).toBe(0.4)
    expect(resolveDragRelease(0.39)).toBe('cancel')
    expect(resolveDragRelease(0.4)).toBe('commit')
    expect(resolveDragRelease(0.8)).toBe('commit')
  })
})

describe('tween', () => {
  it('giảm chuyển động → nhảy thẳng tới cuối, không gọi raf', () => {
    const raf = vi.fn()
    const onUpdate = vi.fn()
    const onDone = vi.fn()
    tween({ duration: 500, reducedMotion: true, onUpdate, onDone, raf })
    expect(raf).not.toHaveBeenCalled()
    expect(onUpdate).toHaveBeenCalledWith(1)
    expect(onDone).toHaveBeenCalledOnce()
  })

  it('chạy đủ các khung hình tới khi xong (giả lập thời gian + raf)', () => {
    let time = 0
    const now = () => time
    const queue = []
    const raf = (cb) => {
      queue.push(cb)
      return queue.length
    }
    const caf = vi.fn()
    const onUpdate = vi.fn()
    const onDone = vi.fn()
    tween({ duration: 100, now, raf, caf, onUpdate, onDone })
    expect(onUpdate).not.toHaveBeenCalled() // chưa có khung hình nào chạy, chỉ mới xếp hàng rAF
    time = 0
    queue.shift()() // khung đầu (t=0)
    expect(onUpdate).toHaveBeenCalledWith(0)
    time = 50
    queue.shift()()
    expect(onDone).not.toHaveBeenCalled()
    time = 100
    queue.shift()()
    expect(onDone).toHaveBeenCalledOnce()
    expect(onUpdate).toHaveBeenLastCalledWith(1)
  })

  it('trả hàm hủy — huỷ rAF đang chờ và chặn cả khung hình đã kịp xếp hàng trước đó', () => {
    let time = 0
    const now = () => time
    const queue = []
    const raf = (cb) => {
      queue.push(cb)
      return queue.length
    }
    const caf = vi.fn()
    const onUpdate = vi.fn()
    const cancel = tween({ duration: 100, now, raf, caf, onUpdate })
    const pendingFrame = queue.shift()
    cancel()
    expect(caf).toHaveBeenCalledWith(1)
    time = 50
    pendingFrame() // trình duyệt gọi lại khung đã xếp hàng trước khi cancelAnimationFrame kịp chặn
    expect(onUpdate).not.toHaveBeenCalled() // cờ cancelled chặn, không tính là một khung chạy được
    expect(queue).toHaveLength(0) // không tự xếp khung kế tiếp
  })
})
