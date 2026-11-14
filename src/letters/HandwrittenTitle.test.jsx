// @vitest-environment jsdom
// Tiêu đề phong thư viết tay (stroke write-on), xong mới fade in nội dung chính
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
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
  it('tiêu đề là h2 viết tay giữ nét gạch chân; nội dung ẩn (inert) tới khi tiêu đề viết xong', () => {
    const { container } = render(<LetterReader letter={letter} />)
    expect(screen.getByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
    expect(container.querySelector('.lr-dedication .lt-hw')).toBeTruthy()
    expect(container.querySelector('.lr-dedication > svg:not(.lt-hw) path')).toBeTruthy()
    const content = container.querySelector('.lr-letter-content')
    expect(content.classList.contains('visible')).toBe(false)
    expect(content.getAttribute('aria-hidden')).toBe('true')
    animEnd(container.querySelector('.lt-hw-text'), 'lt-hw-fill')
    expect(content.classList.contains('visible')).toBe(true)
    expect(content.getAttribute('aria-hidden')).toBe('false')
  })

  it('animationend không bắn → nội dung vẫn hiện sau thời gian dự phòng', () => {
    vi.useFakeTimers()
    const { container } = render(<LetterReader letter={letter} />)
    act(() => vi.advanceTimersByTime(2300))
    expect(container.querySelector('.lr-letter-content.visible')).toBeTruthy()
  })

  it('giảm chuyển động: tiêu đề và nội dung hiện ngay', () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), addEventListener() {}, removeEventListener() {} }))
    const { container } = render(<LetterReader letter={letter} />)
    expect(container.querySelector('.lt-hw.is-instant')).toBeTruthy()
    expect(container.querySelector('.lr-letter-content.visible')).toBeTruthy()
  })
})
