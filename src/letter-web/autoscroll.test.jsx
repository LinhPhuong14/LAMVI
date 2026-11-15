// @vitest-environment jsdom
// D-155: tờ thư tự cuộn theo dòng chữ đang hiện ra; người nhận tự cuộn thì dừng
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import LetterWeb from './LetterWeb.jsx'

const motion = (reduce) => vi.stubGlobal('matchMedia', (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
const letter = { occasion: 'thankYou', kind: 'text', template: 'web', recipientName: 'Lan', senderName: 'An', occasionData: null, postscript: null, message: Array.from({ length: 6 }, (_, i) => `Đoạn ${i} ` + 'chữ '.repeat(40)) }

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function toWriting() {
  vi.useFakeTimers()
  const scrollTo = vi.fn()
  Element.prototype.scrollTo = scrollTo
  // Chữ nằm dưới đáy khung → cần cuộn
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
    return this.classList?.contains('lw-word') ? { top: 900, bottom: 930, left: 0, right: 10, width: 10, height: 30 } : { top: 0, bottom: 400, left: 0, right: 400, width: 400, height: 400 }
  })
  const utils = render(<LetterWeb letter={letter} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
  // lighting → rising → unfolding → reading: mỗi pha một hẹn giờ riêng
  for (const ms of [1000, 1900, 1200]) await act(async () => vi.advanceTimersByTime(ms + 10))
  // tiêu đề viết tay xong (hạn chót dự phòng)
  for (let i = 0; i < 6; i++) await act(async () => vi.advanceTimersByTime(1000))
  return { ...utils, scrollTo }
}

describe('D-155: tự cuộn theo chữ', () => {
  it('đang viết → tờ thư tự cuộn xuống', async () => {
    motion(false)
    const { scrollTo } = await toWriting()
    await act(async () => vi.advanceTimersByTime(1000))
    expect(scrollTo).toHaveBeenCalled()
    expect(scrollTo.mock.calls.at(-1)[0]).toMatchObject({ behavior: 'smooth' })
  })

  it('người nhận tự cuộn (wheel) → dừng tự cuộn', async () => {
    motion(false)
    const { scrollTo, container } = await toWriting()
    fireEvent.wheel(container.querySelector('.lw-letter'))
    scrollTo.mockClear()
    await act(async () => vi.advanceTimersByTime(2000))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('bấm "Hiện toàn bộ lá thư" → không tự cuộn nữa', async () => {
    motion(false)
    const { scrollTo } = await toWriting()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' }))
    scrollTo.mockClear()
    await act(async () => vi.advanceTimersByTime(2000))
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
