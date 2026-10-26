// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { LocaleContext } from '../i18n/index.js'
import viMsg from '../i18n/messages/vi.js'
import Carousel from './Carousel.jsx'

const realIO = window.IntersectionObserver
const scrollBy = vi.fn()
const scrollTo = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  scrollBy.mockClear()
  scrollTo.mockClear()
  // Luôn "đang trong màn hình"
  window.IntersectionObserver = class {
    constructor(cb) {
      this.cb = cb
    }
    observe() {
      this.cb([{ isIntersecting: true }])
    }
    disconnect() {}
  }
})
afterEach(() => {
  vi.useRealTimers()
  window.IntersectionObserver = realIO
})

function setup(props = {}, items = 4) {
  const utils = render(
    <LocaleContext.Provider value="vi">
      <Carousel label="Dải thử" {...props}>
        <div data-testid="track">
          {Array.from({ length: items }, (_, i) => (
            <div key={i}>thẻ {i}</div>
          ))}
        </div>
      </Carousel>
    </LocaleContext.Provider>,
  )
  const track = screen.getByTestId('track')
  track.scrollBy = scrollBy
  track.scrollTo = scrollTo
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 300 })
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1200 })
  return { ...utils, track, region: screen.getByRole('region') }
}

describe('Carousel', () => {
  it('region có nhãn; thêm is-carousel vào phần tử con đầu tiên; nút trước/sau theo i18n; một chấm cho mỗi thẻ', () => {
    const { track, region, container } = setup()
    expect(region).toHaveAttribute('aria-roledescription', 'carousel')
    expect(region).toHaveAttribute('aria-label', 'Dải thử')
    expect(track).toHaveClass('is-carousel')
    expect(screen.getByRole('button', { name: viMsg.carousel.prev })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: viMsg.carousel.next })).toBeInTheDocument()
    expect(container.querySelectorAll('.carousel-dots span')).toHaveLength(4)
    expect(container.querySelector('.carousel-dots span.is-on')).not.toBeNull()
  })

  it('chỉ một thẻ → không hiện nút/chấm', () => {
    setup({}, 1)
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('nút sau gọi scrollBy theo dương, nút trước theo âm', () => {
    setup()
    const track = screen.getByTestId('track')
    track.scrollLeft = 300 // giữa dải
    fireEvent.click(screen.getByRole('button', { name: viMsg.carousel.next }))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    expect(scrollBy.mock.calls[0][0].left).toBeGreaterThanOrEqual(0)
    fireEvent.click(screen.getByRole('button', { name: viMsg.carousel.prev }))
    expect(scrollBy).toHaveBeenCalledTimes(2)
    expect(scrollBy.mock.calls[1][0].left).toBeLessThanOrEqual(0)
  })

  it('nút sau ở cuối dải → quay về đầu; nút trước ở đầu dải → nhảy tới cuối', () => {
    const { track } = setup()
    track.scrollLeft = 900 // 900 + 300 >= 1200 - 4
    fireEvent.click(screen.getByRole('button', { name: viMsg.carousel.next }))
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: 'smooth' })
    track.scrollLeft = 0
    fireEvent.click(screen.getByRole('button', { name: viMsg.carousel.prev }))
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 1200, behavior: 'smooth' })
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('tự chạy mỗi interval ms', () => {
    setup({ interval: 1000 })
    const track = screen.getByTestId('track')
    track.scrollLeft = 300
    act(() => vi.advanceTimersByTime(999))
    expect(scrollBy).not.toHaveBeenCalled()
    act(() => vi.advanceTimersByTime(1))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    act(() => vi.advanceTimersByTime(2000))
    expect(scrollBy).toHaveBeenCalledTimes(3)
  })

  it('dừng khi rê chuột / focus, chạy lại khi rời', () => {
    const { region } = setup({ interval: 1000 })
    screen.getByTestId('track').scrollLeft = 300
    fireEvent.mouseEnter(region)
    act(() => vi.advanceTimersByTime(3000))
    expect(scrollBy).not.toHaveBeenCalled()
    fireEvent.mouseLeave(region)
    act(() => vi.advanceTimersByTime(1000))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    fireEvent.focus(region)
    act(() => vi.advanceTimersByTime(3000))
    expect(scrollBy).toHaveBeenCalledTimes(1)
    fireEvent.blur(region)
    act(() => vi.advanceTimersByTime(1000))
    expect(scrollBy).toHaveBeenCalledTimes(2)
  })

  it('không tự chạy khi ngoài màn hình hoặc tab ẩn', () => {
    window.IntersectionObserver = class {
      constructor(cb) {
        this.cb = cb
      }
      observe() {
        this.cb([{ isIntersecting: false }])
      }
      disconnect() {}
    }
    setup({ interval: 1000 })
    act(() => vi.advanceTimersByTime(5000))
    expect(scrollBy).not.toHaveBeenCalled()
  })

  it('gỡ component → bỏ is-carousel và dừng timer', () => {
    const { track, unmount } = setup({ interval: 1000 })
    unmount()
    expect(track).not.toHaveClass('is-carousel')
    act(() => vi.advanceTimersByTime(5000))
    expect(scrollBy).not.toHaveBeenCalled()
  })
})
