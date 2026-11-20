// @vitest-environment jsdom
// D-164 — kiểm thử độc lập (T-11): bật/tắt dòng "Gửi …" và khối lời kết + ký tên
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import LetterWeb from '../letter-web/LetterWeb.jsx'
import { validateLetterContent } from '../../server/domain/letter.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const motion = (reduce) => vi.stubGlobal('matchMedia', (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn Quý Thầy Cô đã luôn đồng hành cùng chúng em.'], template: 'web', recipientName: 'Hội đồng', senderName: 'Tập thể LAMVI', occasionData: null, postscript: null }
const video = { ...base, kind: 'video', message: undefined, videoUrl: 'https://cdn.test/v.mp4', posterUrl: null, captionsUrl: null }
const teaser = () => screen.queryByRole('complementary', { name: 'Xem tiếp câu chuyện của LAMVI' })
const turnOn = () => fireEvent.click(screen.getAllByRole('button').find((b) => /Bật đèn|Turn on the lamp|开灯/.test(b.textContent)))
// lighting → rising → unfolding → reading (mỗi pha một hẹn giờ)
const toReading = () => {
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms + 5))
}

describe('D-164 (độc lập): chuyển động đầy đủ, tắt "Gửi …"', () => {
  it('thân thư viết từng chữ khi đã vào pha đọc (không bị "viết xong" sẵn khi người nhận còn ở màn tối)', () => {
    motion(false)
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={{ ...base, showDedication: false }} />)
    // Người nhận đứng ở màn tối một lúc rồi mới bật đèn
    act(() => vi.advanceTimersByTime(10000))
    turnOn()
    toReading()
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(container.querySelector('.lw-content.is-shown')).toBeTruthy()
    // Đang viết: còn nút "Hiện toàn bộ lá thư", đoạn chưa is-complete
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeTruthy()
    expect(container.querySelector('.lw-para.is-complete')).toBeNull()
  })

  it('bật đèn ngay: vẫn còn thời gian viết sau khi vào pha đọc (giống thư có "Gửi …")', () => {
    motion(false)
    vi.useFakeTimers()
    // thư ngắn: hẹn giờ "viết xong" ~1,6 s — không được chạy trước khi tờ thư hiện ra (4,1 s)
    const { container } = render(<LetterWeb letter={{ ...base, message: ['Cảm ơn.'], showDedication: false }} />)
    turnOn()
    toReading()
    expect(container.querySelector('.lw-para.is-complete')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeTruthy()
    act(() => vi.advanceTimersByTime(15000))
    expect(container.querySelector('.lw-para.is-complete')).toBeTruthy()
  })

  it('tờ thư tự cuộn theo chữ (D-155) cả khi tắt "Gửi …"', () => {
    motion(false)
    vi.useFakeTimers()
    const scrollTo = vi.fn()
    Element.prototype.scrollTo = scrollTo
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function () {
      return this.classList?.contains('lw-word') ? { top: 900, bottom: 930, left: 0, right: 10, width: 10, height: 30 } : { top: 0, bottom: 400, left: 0, right: 400, width: 400, height: 400 }
    })
    const long = { ...base, showDedication: false, message: Array.from({ length: 6 }, (_, i) => `Đoạn ${i} ` + 'chữ '.repeat(40)) }
    render(<LetterWeb letter={long} />)
    turnOn()
    toReading()
    act(() => vi.advanceTimersByTime(1500))
    expect(scrollTo).toHaveBeenCalled()
    delete Element.prototype.scrollTo
  })

  it('thẻ mời phim vẫn hiện 5 giây sau khi thư viết xong', () => {
    motion(false)
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, showDedication: false }} />)
    turnOn()
    toReading()
    expect(teaser()).toBeNull()
    const skip = screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })
    if (skip) fireEvent.click(skip)
    act(() => vi.advanceTimersByTime(4900))
    expect(teaser()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(teaser()).toBeTruthy()
  })

  it('thư video + tắt "Gửi …" + tắt chữ ký: nút xem video dùng được ngay, thẻ mời sau 5 giây', () => {
    motion(false)
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={{ ...video, showDedication: false, showSignature: false }} />)
    turnOn()
    toReading()
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(container.querySelector('.lw-signature')).toBeNull()
    const content = container.querySelector('.lw-content')
    expect(content.classList.contains('is-shown')).toBe(true)
    expect(content.hasAttribute('inert')).toBe(false)
    expect(within(content).getByRole('button', { name: /Xem video|Xem/ })).toBeTruthy()
    act(() => vi.advanceTimersByTime(4900))
    expect(teaser()).toBeNull()
    act(() => vi.advanceTimersByTime(200))
    expect(teaser()).toBeTruthy()
  })

  it('"Xem lại từ đầu": lần đọc thứ hai vẫn viết lại từng chữ, không có "Gửi …"', () => {
    motion(false)
    vi.useFakeTimers()
    const { container } = render(<LetterWeb letter={{ ...base, showDedication: false }} />)
    turnOn()
    toReading()
    act(() => vi.advanceTimersByTime(15000))
    expect(container.querySelector('.lw-para.is-complete')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    expect(container.querySelector('.lw-letter')).toBeNull()
    turnOn()
    toReading()
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(container.querySelector('.lw-content.is-shown')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1000))
    expect(container.querySelector('.lw-para.is-complete')).toBeNull()
  })
})

describe('D-164 (độc lập): giảm chuyển động', () => {
  const openReduced = (letter) => {
    motion(true)
    const r = render(<LetterWeb letter={letter} />)
    turnOn()
    return r
  }

  it('tắt cả hai: không tiêu đề, không chữ ký, P.S. và nút bất ngờ vẫn còn', async () => {
    const { container } = openReduced({ ...base, showDedication: false, showSignature: false, postscript: 'Tái bút.', business: { name: 'Công ty A', logoUrl: null } })
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(container.querySelector('.lw-signature')).toBeNull()
    expect(screen.queryByText('Tập thể LAMVI')).toBeNull()
    expect(screen.queryByText(/Thương mến|Trân trọng/)).toBeNull()
    expect(container.querySelector('.lw-ps').textContent).toBe('Tái bút.')
    // tên doanh nghiệp vẫn ở tiêu đề thư (letterhead), chỉ mất ở chữ ký
    expect(container.querySelector('.lw-letterhead').textContent).toContain('Công ty A')
    // tên người nhận vẫn trong aria-label tờ thư
    expect(container.querySelector('.lw-letter').getAttribute('aria-label')).toContain('Hội đồng')
  })

  it('tắt chữ ký + closing formal: không còn "Trân trọng,"', async () => {
    const { container } = openReduced({ ...base, closing: 'formal', showSignature: false })
    await screen.findByRole('heading', { level: 2, name: 'Gửi Hội đồng,' })
    expect(container.querySelector('.lw-signature')).toBeNull()
    expect(screen.queryByText('Trân trọng,')).toBeNull()
  })

  it.each([
    ['en', 'Dear Hội đồng,', 'Best regards,'],
    ['zh', '亲爱的Hội đồng：', '祝好，'],
  ])('lang %s: tắt "Gửi …" ẩn lời đề tặng; tắt chữ ký ẩn lời kết', async (lang, ded, regards) => {
    const a = openReduced({ ...base, lang, showDedication: false })
    await waitFor(() => expect(a.container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(screen.queryByText(ded)).toBeNull()
    expect(a.container.querySelector('.lw-signature span').textContent).toBe(regards)
    cleanup()
    const b = openReduced({ ...base, lang, showSignature: false })
    await screen.findByRole('heading', { level: 2, name: ded })
    expect(b.container.querySelector('.lw-signature')).toBeNull()
    expect(screen.queryByText(regards)).toBeNull()
  })

  it('"Xem lại từ đầu" (giảm chuyển động): vẫn ẩn đúng hai khối sau khi xem lại', async () => {
    const { container } = openReduced({ ...base, showDedication: false, showSignature: false })
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    turnOn()
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(container.querySelector('.lw-signature')).toBeNull()
  })
})

describe('D-164 (độc lập): server', () => {
  it('true tường minh giữ true; chỉ đúng boolean false mới tắt; độc lập giữa hai trường', () => {
    const v = validateLetterContent({ ...base, showDedication: true, showSignature: false }).value
    expect([v.showDedication, v.showSignature]).toEqual([true, false])
    const w = validateLetterContent({ ...base, showDedication: false }).value
    expect([w.showDedication, w.showSignature]).toEqual([false, true])
    for (const x of [undefined, '', 'false', 0, [], {}]) {
      const r = validateLetterContent({ ...base, showDedication: x }).value
      expect(r.showDedication).toBe(true)
    }
  })
})

describe('D-164 (độc lập): admin', () => {
  const login = () => {
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }))
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } }),
    })
  }

  it('xem thử phản ánh hai ô đã tắt', async () => {
    motion(true)
    login()
    renderAt('/admin/letters/new')
    fireEvent.click(await screen.findByLabelText('Hiện dòng "Gửi …" ở đầu thư'))
    fireEvent.click(screen.getByLabelText('Hiện lời kết và tên người ký ở cuối thư'))
    fireEvent.change(screen.getByLabelText('Tên người nhận'), { target: { value: 'Ngọc' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Thân.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }))
    const dlg = await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    fireEvent.click(await within(dlg).findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 }))
    await waitFor(() => expect(dlg.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(dlg.querySelector('.lw-dedication')).toBeNull()
    expect(dlg.querySelector('.lw-signature')).toBeNull()
    expect(within(dlg).queryByText('Minh')).toBeNull()
  })

  it('bật lại ô chữ ký → ô "Lời kết" hiện lại và giữ lựa chọn cũ; đổi mẫu lời chúc giữ trạng thái hai ô', async () => {
    login()
    renderAt('/admin/letters/new')
    fireEvent.change(await screen.findByLabelText('Lời kết'), { target: { value: 'formal' } })
    const sig = screen.getByLabelText('Hiện lời kết và tên người ký ở cuối thư')
    fireEvent.click(sig)
    expect(screen.queryByLabelText('Lời kết')).toBeNull()
    fireEvent.click(sig)
    expect(screen.getByLabelText('Lời kết').value).toBe('formal')
    fireEvent.click(screen.getByLabelText('Hiện dòng "Gửi …" ở đầu thư'))
    fireEvent.click(sig)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('Mẫu lời chúc Phòng thư'), { target: { value: 'encouragement' } })
    expect(screen.getByLabelText('Hiện dòng "Gửi …" ở đầu thư').checked).toBe(false)
    expect(screen.getByLabelText('Hiện lời kết và tên người ký ở cuối thư').checked).toBe(false)
  })
})
