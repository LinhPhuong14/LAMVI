// @vitest-environment jsdom
// Tiêu đề phong thư viết tay (stroke write-on), xong mới fade in nội dung chính
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import HandwrittenTitle from './HandwrittenTitle.jsx'
import LetterReader from '../letter-room/LetterReader.jsx'

const letter = { recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: {} }
// jsdom không có AnimationEvent → tự dựng sự kiện kèm animationName
const animEnd = (el, name) =>
  act(() => {
    const ev = new Event('animationend', { bubbles: true })
    ev.animationName = name
    el.dispatchEvent(ev)
  })
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('HandwrittenTitle', () => {
  it('là tiêu đề có tên đọc được (SVG role=img + aria-label), nét chạy theo mask', () => {
    render(<HandwrittenTitle text="Gửi Linh," />)
    expect(screen.getByRole('heading', { name: 'Gửi Linh,' })).toBeTruthy()
    const text = document.querySelector('.lt-hw-text')
    expect(text.getAttribute('mask')).toBe('url(#lt-hw-mask)')
    expect(document.querySelector('.lt-hw').style.getPropertyValue('--hw-dur')).toMatch(/s$/)
  })

  it('gọi onDone một lần khi hiệu ứng tô mực kết thúc (bỏ qua animation khác)', () => {
    const onDone = vi.fn()
    render(<HandwrittenTitle text="Gửi Linh," onDone={onDone} />)
    const text = document.querySelector('.lt-hw-text')
    animEnd(text, 'lt-hw-stroke')
    expect(onDone).not.toHaveBeenCalled()
    animEnd(text, 'lt-hw-fill')
    animEnd(text, 'lt-hw-fill')
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('animationend không bắn → hết thời gian dự phòng vẫn gọi onDone', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    render(<HandwrittenTitle text="Gửi Linh," onDone={onDone} />)
    act(() => vi.advanceTimersByTime(5000))
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  it('giảm chuyển động hoặc instant → hiện ngay, gọi onDone ngay, không mask', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const onDone = vi.fn()
    render(<HandwrittenTitle text="Gửi Linh," onDone={onDone} />)
    expect(onDone).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.lt-hw.is-instant')).toBeTruthy()
    expect(document.querySelector('.lt-hw-text').getAttribute('mask')).toBeNull()
  })
})

describe('Phòng thư (LetterReader) — nội dung hiện sau tiêu đề viết tay', () => {
  const advanceTitle = async ms => {
    for (let remaining = ms; remaining > 0; remaining -= 80)
      await act(async () => { await vi.advanceTimersByTimeAsync(Math.min(80, remaining)) })
  }

  it('tiêu đề h2 dùng font cho tên tiếng Việt, giữ body inert đến khi docking thật sự kết thúc', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    try {
      const { container } = render(<LetterReader letter={letter} />)
      const title = screen.getByRole('heading', { level: 2, name: 'Gửi Linh,' })
      expect(title.querySelector('svg')).toBeNull()
      expect(title.querySelector('.lr-title-dynamic')).toHaveTextContent('Gửi Linh,')
      expect(title.querySelector('.lr-title-dynamic')).toHaveAttribute('aria-hidden', 'true')
      const content = container.querySelector('.lr-letter-content')
      expect(content).toHaveAttribute('inert')
      expect(content).toHaveAttribute('aria-hidden', 'true')
      class CSSTransition { constructor() { this.playState = 'running' } }
      const transition = new CSSTransition()
      title.getAnimations = () => [transition]
      fireEvent.transitionEnd(title, { propertyName: 'transform' })
      expect(content).toHaveAttribute('inert')
      await advanceTitle(5600)
      expect(title).toHaveClass('is-docked')
      expect(content).toHaveAttribute('inert')
      transition.playState = 'finished'
      fireEvent.transitionEnd(title, { propertyName: 'transform' })
      expect(content).toHaveClass('visible')
      expect(content).not.toHaveAttribute('inert')
      expect(content).toHaveAttribute('aria-hidden', 'false')
    } finally { clock.mockRestore() }
  })

  it('không có transition đang chạy → body mở ở mốc 5600ms, không mở sớm', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
    const clock = vi.spyOn(performance, 'now').mockImplementation(() => Date.now())
    try {
      const { container } = render(<LetterReader letter={letter} />)
      const content = container.querySelector('.lr-letter-content')
      await advanceTitle(5520)
      expect(content).toHaveAttribute('aria-hidden', 'true')
      await advanceTitle(80)
      expect(content).toHaveClass('visible')
      expect(content).toHaveAttribute('aria-hidden', 'false')
      expect(content).not.toHaveAttribute('inert')
    } finally { clock.mockRestore() }
  })

  it('giảm chuyển động: tiêu đề font dock và nội dung hiện ngay', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const { container } = render(<LetterReader letter={letter} />)
    const title = screen.getByRole('heading', { level: 2, name: 'Gửi Linh,' })
    expect(title.querySelector('svg')).toBeNull()
    expect(title.querySelector('.lr-title-dynamic')).toHaveTextContent('Gửi Linh,')
    expect(title).toHaveClass('is-docked')
    expect(container.querySelector('.lr-letter-content')).toHaveClass('visible')
    expect(container.querySelector('.lr-letter-content')).toHaveAttribute('aria-hidden', 'false')
    expect(container.querySelector('.lr-letter-content')).not.toHaveAttribute('inert')
  })
})
