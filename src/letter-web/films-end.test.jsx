// @vitest-environment jsdom
// D-159, D-161: thư viết xong → 5 giây → thẻ mời "Xem tiếp câu chuyện của LAMVI" → outro:
// màn lời dẫn → hai phim liền nhau (toàn màn hình ngang trên điện thoại) → màn kết
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import LetterWeb from './LetterWeb.jsx'

const mm = ({ reduce = true, coarse = false } = {}) =>
  vi.stubGlobal('matchMedia', (q) => ({ matches: (reduce && q.includes('reduce')) || (coarse && q.includes('coarse')), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  delete HTMLElement.prototype.requestFullscreen
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn bạn rất nhiều.'], template: 'web', recipientName: 'Lan', senderName: 'An', occasionData: null, postscript: null, lamp: 'thu-hoach' }
const teaser = () => screen.queryByRole('complementary', { name: 'Xem tiếp câu chuyện của LAMVI' })

function openLetter() {
  fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
}
function toOutro() {
  vi.useFakeTimers()
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
  const utils = render(<LetterWeb letter={base} />)
  openLetter()
  act(() => vi.advanceTimersByTime(5000))
  fireEvent.click(screen.getByRole('button', { name: /Xem câu chuyện/ }))
  return { ...utils, play }
}

describe('D-159: thẻ mời', () => {
  it('chỉ hiện 5 giây sau khi thư viết xong; không nằm trong tờ thư; chưa tải video', () => {
    mm({ reduce: false })
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(6000))
    expect(teaser()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' }))
    act(() => vi.advanceTimersByTime(4900))
    expect(teaser()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(teaser()).toBeTruthy()
    expect(container.querySelector('.lw-letter .lw-films')).toBeNull()
    expect(container.querySelector('video')).toBeNull()
  })
  it('đóng thẻ → không hiện lại; "Xem lại từ đầu" → hiện lại sau khi đọc xong lần nữa', () => {
    mm()
    vi.useFakeTimers()
    render(<LetterWeb letter={base} />)
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    act(() => vi.advanceTimersByTime(20000))
    expect(teaser()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    openLetter()
    act(() => vi.advanceTimersByTime(5000))
    expect(teaser()).toBeTruthy()
  })
})

describe('D-161: outro câu chuyện LAMVI', () => {
  it('màn lời dẫn: tiêu đề, hai phần phim, gợi ý; chưa có video; "Để sau" quay lại lá thư', () => {
    mm()
    const { container } = toOutro()
    const dlg = screen.getByRole('dialog', { name: 'Chiếc đèn của bạn bắt đầu từ một làng nghề' })
    expect(dlg.textContent).toContain('Phần 1/2')
    expect(dlg.textContent).toContain('Tranh Đông Hồ trên đèn giấy dó')
    expect(dlg.textContent).toContain('Từ làng giấy dó đến chiếc đèn')
    expect(dlg.textContent).toContain('Phim có tiếng')
    expect(container.querySelector('video')).toBeNull()
    expect(teaser()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Để sau' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(teaser()).toBeNull()
  })
  it('bắt đầu → phim 1 phát; hết phim 1 tự sang phim 2 trên cùng thẻ video; hết phim 2 → màn kết với đèn của thư', () => {
    mm()
    const { container, play } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    const v = container.querySelector('video')
    expect(v.getAttribute('src')).toMatch(/^\/videos\/tranh-dong-ho-(720|360)\.mp4$/)
    expect(play).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('dialog', { name: 'Tranh Đông Hồ trên đèn giấy dó' })).toBeTruthy()
    fireEvent.ended(v)
    const v2 = container.querySelector('video')
    expect(v2).toBe(v)
    expect(v2.getAttribute('src')).toMatch(/lang-giay-do/)
    expect(play).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('button', { name: /Kết thúc/ })).toBeTruthy()
    fireEvent.ended(v2)
    expect(screen.getByRole('dialog', { name: 'Ánh sáng ấy giờ là của bạn' })).toBeTruthy()
    expect(container.querySelector('.lw-outro-end-lamp img').getAttribute('src')).toBe('/images/lamps/thu-hoach-cutout.webp')
    expect(screen.getByRole('link', { name: /Đọc thêm/ }).getAttribute('href')).toBe('/welcome')
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại' }))
    expect(container.querySelector('video').getAttribute('src')).toMatch(/tranh-dong-ho/)
    fireEvent.click(screen.getByRole('button', { name: /Phần tiếp theo/ }))
    fireEvent.click(screen.getByRole('button', { name: /Kết thúc/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại lá thư' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('phim lỗi → báo lỗi + nút sang phần sau; Esc đóng outro', () => {
    mm()
    const { container } = toOutro()
    fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
    fireEvent.error(container.querySelector('video'))
    expect(screen.getByRole('alert').textContent).toContain('Không phát được phim này.')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
  it('điện thoại: bắt đầu xem → cả khung outro toàn màn hình + khoá ngang; máy tính thì không', async () => {
    for (const coarse of [true, false]) {
      mm({ coarse })
      const lock = vi.fn(() => Promise.resolve())
      vi.stubGlobal('screen', { orientation: { lock, unlock: vi.fn() } })
      const fs = vi.fn(() => Promise.resolve())
      HTMLElement.prototype.requestFullscreen = fs
      toOutro()
      fireEvent.click(screen.getByRole('button', { name: /Bắt đầu xem/ }))
      await act(async () => {})
      if (coarse) {
        expect(fs).toHaveBeenCalledTimes(1)
        expect(fs.mock.contexts[0].classList.contains('lw-outro')).toBe(true)
        expect(lock).toHaveBeenCalledWith('landscape')
      } else {
        expect(fs).not.toHaveBeenCalled()
        expect(lock).not.toHaveBeenCalled()
      }
      cleanup()
      vi.useRealTimers()
    }
  })
  it('chữ theo ngôn ngữ thư; link đọc thêm theo ngôn ngữ', () => {
    mm()
    vi.useFakeTimers()
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve())
    render(<LetterWeb letter={{ ...base, lang: 'en' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the lamp' }))
    for (const ms of [1000, 1900, 1200, 5000]) act(() => vi.advanceTimersByTime(ms))
    expect(screen.getByRole('complementary', { name: 'Continue the LAMVI story' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Watch the story/ }))
    expect(screen.getByRole('dialog', { name: 'Your lamp began in a craft village' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Start watching/ }))
    fireEvent.click(screen.getByRole('button', { name: /Next part/ }))
    fireEvent.click(screen.getByRole('button', { name: /Finish/ }))
    expect(screen.getByRole('link', { name: /Read more/ }).getAttribute('href')).toBe('/en/welcome')
  })
})
