// @vitest-environment jsdom
// D-158, D-159: thư viết xong → đợi 5 giây → thẻ nổi "Xem tiếp câu chuyện của LAMVI" với hai video
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LetterWeb from './LetterWeb.jsx'

const mm = (reduce) => vi.stubGlobal('matchMedia', (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn bạn rất nhiều.'], template: 'web', recipientName: 'Lan', senderName: 'An', occasionData: null, postscript: null }
const card = () => screen.queryByRole('complementary', { name: 'Xem tiếp câu chuyện của LAMVI' })

function openLetter() {
  fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
}

describe('D-159: thẻ video LAMVI', () => {
  it('không nằm cuối thư; chỉ hiện 5 giây sau khi thư viết xong; bấm thẻ mới tải video, mỗi lúc một video', () => {
    mm(false)
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(6000)) // tiêu đề viết tay xong (hẹn giờ dự phòng)
    expect(card()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' }))
    act(() => vi.advanceTimersByTime(4900))
    expect(card()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(card()).toBeTruthy()
    expect(container.querySelector('.lw-letter .lw-films')).toBeNull()
    expect(container.querySelectorAll('.lw-film')).toHaveLength(2)
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Tranh Đông Hồ trên đèn giấy dó' }))
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video').getAttribute('src')).toMatch(/^\/videos\/tranh-dong-ho-(720|360)\.mp4$/)
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Từ làng giấy dó đến chiếc đèn' }))
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video').getAttribute('src')).toMatch(/lang-giay-do/)
  })
  it('đóng thẻ → không hiện lại; "Xem lại từ đầu" → hiện lại sau khi đọc xong lần nữa', () => {
    mm(true)
    vi.useFakeTimers()
    render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(card()).toBeNull()
    act(() => vi.advanceTimersByTime(20000))
    expect(card()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    expect(card()).toBeTruthy()
  })
  it('chữ theo ngôn ngữ thư', () => {
    mm(true)
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, lang: 'en' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the lamp' }))
    for (const ms of [1000, 1900, 1200, 5000]) act(() => vi.advanceTimersByTime(ms))
    expect(screen.getByRole('complementary', { name: 'Continue the LAMVI story' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Play video: From the dó-paper village to your lamp' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy()
  })
})

describe('D-160: video toàn màn hình nằm ngang trên điện thoại', () => {
  const setup = (coarse) => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') || (coarse && q.includes('coarse')), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    const lock = vi.fn(() => Promise.resolve())
    const unlock = vi.fn()
    vi.stubGlobal('screen', { orientation: { lock, unlock } })
    const fs = vi.fn(function () {
      return Promise.resolve()
    })
    const play = vi.fn(() => Promise.resolve())
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(play)
    HTMLElement.prototype.requestFullscreen = fs
    vi.useFakeTimers()
    render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    return { lock, unlock, fs, play }
  }
  afterEach(() => {
    delete HTMLElement.prototype.requestFullscreen
    vi.restoreAllMocks()
  })
  it('điện thoại: bấm video → phát, toàn màn hình ngay trên thẻ video, khoá hướng ngang', async () => {
    const { lock, fs, play } = setup(true)
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Tranh Đông Hồ trên đèn giấy dó' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect(fs).toHaveBeenCalledTimes(1)
    expect(fs.mock.contexts[0].tagName).toBe('VIDEO')
    await act(async () => {})
    expect(lock).toHaveBeenCalledWith('landscape')
  })
  it('máy tính (chuột): phát trong thẻ, không ép toàn màn hình', () => {
    const { lock, fs, play } = setup(false)
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Tranh Đông Hồ trên đèn giấy dó' }))
    expect(play).toHaveBeenCalledTimes(1)
    expect(fs).not.toHaveBeenCalled()
    expect(lock).not.toHaveBeenCalled()
  })
  it('iPhone (không có requestFullscreen): dùng trình phát toàn màn hình của iOS', () => {
    const { fs } = setup(true)
    delete HTMLElement.prototype.requestFullscreen
    const ios = vi.fn()
    HTMLVideoElement.prototype.webkitEnterFullscreen = ios
    try {
      fireEvent.click(screen.getByRole('button', { name: 'Xem video: Từ làng giấy dó đến chiếc đèn' }))
      expect(ios).toHaveBeenCalledTimes(1)
      expect(fs).not.toHaveBeenCalled()
    } finally {
      delete HTMLVideoElement.prototype.webkitEnterFullscreen
    }
  })
})

