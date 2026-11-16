// @vitest-environment jsdom
// D-158: hai video LAMVI ở cuối lá thư, sau khi đọc xong
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

describe('D-158: video cuối thư', () => {
  it('chưa viết xong thì chưa có video; viết xong → hai thẻ video; bấm thẻ mới tải video, mỗi lúc một video', async () => {
    mm(false)
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
    expect(container.querySelector('.lw-films')).toBeNull()
    // tiêu đề viết tay xong (hẹn giờ dự phòng) → thân thư → hết thời gian viết
    act(() => vi.advanceTimersByTime(6000))
    act(() => vi.advanceTimersByTime(10000))
    expect(container.querySelectorAll('.lw-film')).toHaveLength(2)
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Tranh Đông Hồ trên đèn giấy dó' }))
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video').getAttribute('src')).toMatch(/^\/videos\/tranh-dong-ho-(720|360)\.mp4$/)
    fireEvent.click(screen.getByRole('button', { name: 'Xem video: Từ làng giấy dó đến chiếc đèn' }))
    expect(container.querySelectorAll('video')).toHaveLength(1)
    expect(container.querySelector('video').getAttribute('src')).toMatch(/lang-giay-do/)
  })
  it('bấm "Hiện toàn bộ" hoặc giảm chuyển động → hiện ngay; chữ theo ngôn ngữ thư', async () => {
    mm(true)
    render(<LetterWeb letter={{ ...base, lang: 'en' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the lamp' }))
    expect(await screen.findByText('The story behind your lamp')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Play video: From the dó-paper village to your lamp' })).toBeTruthy()
  })
})
