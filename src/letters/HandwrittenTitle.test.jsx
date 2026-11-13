// @vitest-environment jsdom
// Tiêu đề phong thư viết tay (stroke write-on), xong mới fade in nội dung chính
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import HandwrittenTitle from './HandwrittenTitle.jsx'
import LetterPaper from './LetterPaper.jsx'

const letter = { recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }
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

describe('LetterPaper — nội dung fade in sau tiêu đề', () => {
  it('nội dung chính ẩn (chưa is-shown) tới khi tiêu đề viết xong', async () => {
    render(<LetterPaper letter={letter} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mở thư gửi Linh' }, { timeout: 2000 }))
    const content = document.querySelector('.lt-content')
    expect(content.classList.contains('is-shown')).toBe(false)
    animEnd(document.querySelector('.lt-hw-text'), 'lt-hw-fill')
    expect(content.classList.contains('is-shown')).toBe(true)
  })

  it('xem trước admin: tiêu đề hiện ngay, nội dung hiện ngay', () => {
    render(<LetterPaper letter={letter} preview />)
    expect(document.querySelector('.lt-hw.is-instant')).toBeTruthy()
    expect(document.querySelector('.lt-content.is-shown')).toBeTruthy()
  })
})
