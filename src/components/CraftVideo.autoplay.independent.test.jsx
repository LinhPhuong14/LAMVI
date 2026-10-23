// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho tự phát video khi cuộn tới — các ca biên ngoài CraftFilms.test.jsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { MotionConfig } from 'framer-motion'
import { CraftVideo } from './CraftFilms.jsx'
import { CRAFT_FILMS } from '../data/craftFilms.js'

let observers = []
const realIO = window.IntersectionObserver

class FakeIO {
  constructor(cb, opts) {
    this.cb = cb
    this.opts = opts
    this.targets = []
    this.disconnected = false
    observers.push(this)
  }
  observe(t) { this.targets.push(t) }
  disconnect() { this.disconnected = true }
}

// Giả lập HTMLMediaElement: play() đặt paused=false ngay, phát sự kiện play; pause() ngược lại
function fakeMedia(video, { reject } = {}) {
  let paused = true
  Object.defineProperty(video, 'paused', { configurable: true, get: () => paused })
  video.play = vi.fn(() => {
    if (reject) return Promise.reject(new DOMException('blocked', 'NotAllowedError'))
    paused = false
    fireEvent.play(video)
    return Promise.resolve()
  })
  video.pause = vi.fn(() => {
    if (paused) return
    paused = true
    fireEvent.pause(video)
  })
  return video
}

const mount = (ui, opts) => {
  const r = render(ui)
  const videos = [...r.container.querySelectorAll('video')].map((v) => fakeMedia(v, opts))
  const see = (i, ...states) =>
    act(() => observers[i].cb(states.map((isIntersecting) => ({ isIntersecting, target: videos[i] }))))
  return { ...r, videos, see }
}

beforeEach(() => {
  observers = []
  window.IntersectionObserver = FakeIO
})
afterEach(() => {
  window.IntersectionObserver = realIO
})

describe('CraftVideo tự phát — ca biên (kiểm thử độc lập)', () => {
  it('SSR: không gắn autoplay/muted, render được khi không có IntersectionObserver', () => {
    window.IntersectionObserver = undefined
    const html = renderToString(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    expect(html).toContain('preload="none"')
    expect(html).toContain('loop')
    expect(html).not.toMatch(/autoplay/i)
    expect(html).not.toMatch(/\bmuted\b/)
    // client không có IO → không lỗi
    expect(() => render(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)).not.toThrow()
  })

  it('giảm chuyển động → không tạo observer, không tự phát', () => {
    mount(
      <MotionConfig reducedMotion="always">
        <CraftVideo film={CRAFT_FILMS.paper} title="x" />
      </MotionConfig>,
    )
    expect(observers.filter((o) => !o.disconnected)).toHaveLength(0)
  })

  it('unmount → ngắt observer và gỡ listener', () => {
    const { unmount, videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    const io = observers[0]
    expect(io.targets).toEqual([videos[0]])
    see(0, true)
    unmount()
    expect(io.disconnected).toBe(true)
  })

  it('play() bị từ chối (chính sách tự phát) → nuốt lỗi, lần cuộn tới sau thử lại', async () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />, { reject: true })
    see(0, true)
    await Promise.resolve()
    see(0, false)
    see(0, true)
    expect(videos[0].play).toHaveBeenCalledTimes(2)
    expect(videos[0].pause).not.toHaveBeenCalled()
  })

  it('tự dừng khi cuộn đi không bị tính là người xem bấm dừng (nhiều vòng liên tiếp)', () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    for (let i = 0; i < 3; i++) {
      see(0, true)
      see(0, false)
    }
    expect(videos[0].play).toHaveBeenCalledTimes(3)
    expect(videos[0].pause).toHaveBeenCalledTimes(3)
  })

  it('người xem bấm dừng rồi bấm phát lại → lại được tự dừng/tự phát theo cuộn', () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    const v = videos[0]
    see(0, true)
    act(() => v.pause()) // người xem dừng
    see(0, false)
    see(0, true)
    expect(v.play).toHaveBeenCalledTimes(1)
    act(() => { v.play() }) // người xem bấm phát
    see(0, false)
    expect(v.paused).toBe(true)
    see(0, true)
    expect(v.play).toHaveBeenCalledTimes(3)
  })

  it('người xem bấm phát khi video chưa đủ 50% trong màn hình rồi cuộn đi → dừng, quay lại → phát tiếp', () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    const v = videos[0]
    act(() => { v.play() })
    see(0, false)
    expect(v.paused).toBe(true)
    see(0, true)
    expect(v.paused).toBe(false)
  })

  it('hai video cùng trong màn hình → mỗi video có observer riêng, cùng tự phát không tiếng', () => {
    const { videos, see } = mount(
      <>
        <CraftVideo film={CRAFT_FILMS.paper} title="a" />
        <CraftVideo film={CRAFT_FILMS.dongho} title="b" />
      </>,
    )
    expect(observers).toHaveLength(2)
    see(0, true)
    see(1, true)
    expect(videos.every((v) => !v.paused && v.muted)).toBe(true)
    see(0, false)
    expect(videos[0].paused).toBe(true)
    expect(videos[1].paused).toBe(false)
  })

  // BUG đã phát hiện (T-11): đổi it.fails → it sau khi sửa CraftFilms.jsx
  it('người xem đã bật tiếng, cuộn đi rồi quay lại → KHÔNG bị tắt tiếng lại', () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    const v = videos[0]
    see(0, true)
    act(() => {
      v.muted = false
      fireEvent(v, new Event('volumechange'))
    })
    see(0, false)
    see(0, true)
    expect(v.paused).toBe(false)
    expect(v.muted).toBe(false)
  })

  // BUG đã phát hiện (T-11): đổi it.fails → it sau khi sửa CraftFilms.jsx
  it('callback nhận nhiều entry trong một lượt (vào rồi ra) → theo entry mới nhất', () => {
    const { videos, see } = mount(<CraftVideo film={CRAFT_FILMS.paper} title="x" />)
    see(0, true, false) // đã ra khỏi màn hình ở trạng thái cuối
    expect(videos[0].paused).toBe(true)
  })
})
