// @vitest-environment jsdom
// D-145 (màn "Cùng xem cách chiếc đèn được làm ra nhé" + video tự phát nối tiếp) và D-146 (yêu cầu xoay ngang)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import IntroFilms from './IntroFilms.jsx'
import RotateGate from './RotateGate.jsx'

const video = () => document.querySelector('video.lt-intro-video')
const setSize = (w, h) => {
  Object.defineProperty(window, 'innerWidth', { value: w, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: h, configurable: true })
}
const touch = (coarse) => vi.stubGlobal('matchMedia', (q) => ({ matches: coarse && q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  setSize(1024, 768)
})

describe('D-145: màn chào trước video', () => {
  it('hiện lời mời xem cách làm đèn, video đầu đã nạp sẵn phía dưới nhưng chưa tự phát', () => {
    render(<IntroFilms onDone={() => {}} />)
    expect(screen.getByRole('heading', { level: 2, name: /Cùng xem cách chiếc đèn\s*được làm ra nhé/ })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    expect(video().autoplay).toBe(false)
    expect(video().getAttribute('preload')).toBe('auto')
    expect(document.querySelector('.lt-intro-player').hasAttribute('inert')).toBe(true)
  })

  it('bấm "Bắt đầu xem": xin toàn màn hình, phát video; video sau tự phát; hết video cuối thì gọi onDone', () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    const fs = vi.fn(() => Promise.resolve())
    HTMLElement.prototype.requestFullscreen = fs
    const onDone = vi.fn()
    render(<IntroFilms onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    expect(fs).toHaveBeenCalledTimes(1)
    expect(play).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.lt-intro').classList.contains('is-playing')).toBe(true)
    expect(screen.queryByRole('button', { name: /Bắt đầu xem/ })).toBeNull()
    fireEvent.ended(video())
    expect(video().getAttribute('src')).toMatch(/lang-giay-do/)
    expect(video().autoplay).toBe(true)
    expect(screen.getByText(/bước vào căn phòng/)).toBeTruthy()
    fireEvent.ended(video())
    expect(onDone).toHaveBeenCalledWith(true)
    delete HTMLElement.prototype.requestFullscreen
  })

  it('trình duyệt không có Fullscreen API / chặn phát → vẫn vào chế độ phát, không ném lỗi', () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.reject(new Error('NotAllowedError')))
    render(<IntroFilms onDone={() => {}} />)
    expect(() => fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))).not.toThrow()
    expect(document.querySelector('.lt-intro.is-playing')).toBeTruthy()
  })

  it('đã xem lần trước: "Bỏ qua" có ngay ở màn chào (một nút duy nhất)', () => {
    const onDone = vi.fn()
    render(<IntroFilms canSkip onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(onDone).toHaveBeenCalledWith(false)
  })
})

describe('D-146: xoay ngang điện thoại', () => {
  it('điện thoại cầm dọc → che nội dung + lời nhắc; xoay ngang → mở khoá, giữ nguyên nội dung', () => {
    touch(true)
    setSize(390, 844)
    render(
      <RotateGate>
        <button type="button">Bên trong</button>
      </RotateGate>,
    )
    expect(screen.getByRole('dialog', { name: /Xoay ngang điện thoại/ })).toBeTruthy()
    const box = document.querySelector('.lt-rotate-content')
    expect(box.hasAttribute('inert')).toBe(true)
    expect(box.getAttribute('aria-hidden')).toBe('true')
    act(() => {
      setSize(844, 390)
      window.dispatchEvent(new Event('resize'))
    })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(box.hasAttribute('inert')).toBe(false)
    expect(screen.getByRole('button', { name: 'Bên trong' })).toBe(box.querySelector('button'))
  })

  it('quay lại dọc giữa chừng → tạm dừng video đang phát', () => {
    touch(true)
    setSize(844, 390)
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
    render(
      <RotateGate>
        <video />
      </RotateGate>,
    )
    expect(pause).not.toHaveBeenCalled()
    act(() => {
      setSize(390, 844)
      window.dispatchEvent(new Event('orientationchange'))
    })
    expect(pause).toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('máy tính (chuột) cửa sổ hẹp → không chặn', () => {
    touch(false)
    setSize(390, 844)
    render(
      <RotateGate>
        <p>ok</p>
      </RotateGate>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
