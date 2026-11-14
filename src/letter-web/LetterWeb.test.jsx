// @vitest-environment jsdom
// D-140: phong thư bản web 2D — bật đèn, phong bì trồi lên, thư mở, điều bất ngờ theo dịp, chọn kiểu ở admin
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterWeb from './LetterWeb.jsx'
import { EFFECTS, playOccasion } from './effects.js'
import { OCCASION_THEMES, lampSrc } from './themes.js'
import { validateLetterContent } from '../../server/domain/letter.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const confetti = vi.hoisted(() => Object.assign(vi.fn(), { reset: vi.fn(), shapeFromPath: vi.fn(() => 'heart'), shapeFromText: vi.fn(() => 'text') }))
vi.mock('canvas-confetti', () => ({ default: confetti }))

const base = { recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Đoạn một.', 'Đoạn hai dài hơn.'], postscript: null, occasionData: { message: 'Cảm ơn nhé' } }
const media = (reduce) => (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
const animEnd = (el) =>
  act(() => {
    const ev = new Event('animationend', { bubbles: true })
    ev.animationName = 'lt-hw-fill'
    el.dispatchEvent(ev)
  })

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  confetti.mockClear()
})

describe('LetterWeb — luồng bật đèn → phong bì → thư', () => {
  beforeEach(() => vi.useFakeTimers())

  it('chỉ có công tắc "Bật đèn"; bấm → đèn sáng → phong bì trồi lên → thư mở', () => {
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={{ ...base, lamp: 'lon-dan' }} />)
    expect(container.querySelector('.lw-lamp img').getAttribute('src')).toBe('/images/lamps/lon-dan-cutout.webp')
    expect(screen.getByText('Đèn Lợn Đàn')).toBeTruthy()
    expect(container.querySelector('.lw-env')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(container.querySelector('.lw-page').classList.contains('is-lit')).toBe(true)
    expect(screen.queryByRole('button', { name: 'Bật đèn' })).toBeNull()
    act(() => vi.advanceTimersByTime(1000))
    // Phong bì vintage: tem Đông Hồ theo dịp, xi khắc chữ cái đầu người gửi, "Gửi <tên>"
    const env = container.querySelector('.lw-env')
    expect(env).toBeTruthy()
    expect(env.querySelector('.lw-env-stamp img').getAttribute('src')).toBe(OCCASION_THEMES.thankYou.stamp)
    expect(env.querySelector('.lw-env-seal').textContent).toBe('A')
    expect(env.getAttribute('aria-hidden')).toBe('true')
    act(() => vi.advanceTimersByTime(1900))
    expect(container.querySelector('.lw-env.is-open')).toBeTruthy()
    act(() => vi.advanceTimersByTime(1200))
    expect(container.querySelector('.lw-env')).toBeNull()
    const article = screen.getByRole('article', { name: 'Lời chúc gửi Linh' })
    expect(within(article).getByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
  })

  it('thân thư ẩn tới khi tiêu đề viết tay xong, rồi hiện từng chữ; "Hiện toàn bộ" bỏ hiệu ứng', () => {
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
    const content = container.querySelector('.lw-content')
    expect(content.getAttribute('aria-hidden')).toBe('true')
    animEnd(container.querySelector('.lt-hw-text'))
    expect(content.classList.contains('is-shown')).toBe(true)
    // Đọc được nguyên đoạn (sr-only) dù chữ đang hiện dần
    expect(screen.getByText('Đoạn hai dài hơn.')).toBeTruthy()
    const delays = [...container.querySelectorAll('.lw-word')].map((w) => parseFloat(w.style.animationDelay))
    expect(delays.every((d, i) => i === 0 || d > delays[i - 1])).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' }))
    expect(container.querySelectorAll('.lw-para.is-complete')).toHaveLength(2)
  })

  it('giảm chuyển động: vào thẳng lá thư, tiêu đề và nội dung hiện ngay, không chạy confetti', async () => {
    vi.useRealTimers()
    vi.stubGlobal('matchMedia', media(true))
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await screen.findByRole('article')
    expect(container.querySelector('.lt-hw.is-instant')).toBeTruthy()
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Một lời cảm ơn nữa/ }))
    expect(screen.getByRole('dialog').textContent).toContain('Cảm ơn nhé')
    await new Promise((r) => setTimeout(r, 20))
    expect(confetti).not.toHaveBeenCalled()
  })

  it('"Xem lại từ đầu" về phòng tối; "Đóng xem trước" gọi onExit', () => {
    vi.stubGlobal('matchMedia', media(true))
    const onExit = vi.fn()
    render(<LetterWeb letter={base} preview onExit={onExit} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(10))
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    expect(screen.getByRole('button', { name: 'Bật đèn' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem trước' }))
    expect(onExit).toHaveBeenCalledTimes(1)
  })
})

describe('Điều bất ngờ theo dịp', () => {
  const openLetter = (letter) => {
    vi.stubGlobal('matchMedia', media(true))
    const utils = render(<LetterWeb letter={letter} afterLetter={<button type="button">Xem lại cách làm đèn</button>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    return utils
  }
  // Lá thư + nội dung đã hiện (giảm chuyển động: tiêu đề hiện ngay)
  const readLetter = async () => {
    const article = await screen.findByRole('article')
    await waitFor(() => expect(article.querySelector('.lw-content.is-shown')).toBeTruthy())
    return article
  }

  it('sinh nhật: phải thổi nến mới hiện lời chúc; Esc đóng, focus về nút mở', async () => {
    openLetter({ ...base, occasion: 'birthday', occasionData: { message: 'Tuổi mới rực rỡ' }, postscript: 'P.S. Ăn bánh nhé' })
    await readLetter()
    // Tái bút hiện ngay dưới chữ ký, nút xem lại cuối thư
    expect(screen.getByText('P.S. Ăn bánh nhé')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xem lại cách làm đèn' })).toBeTruthy()
    const trigger = screen.getByRole('button', { name: /Mở tấm thiệp sinh nhật/ })
    fireEvent.click(trigger)
    const dlg = screen.getByRole('dialog', { name: 'Mở tấm thiệp sinh nhật' })
    expect(within(dlg).queryByText('Tuổi mới rực rỡ')).toBeNull()
    const blow = within(dlg).getByRole('button', { name: 'Ước một điều rồi thổi nến' })
    expect(document.activeElement).toBe(blow)
    fireEvent.click(blow)
    expect(within(dlg).getByText('Tuổi mới rực rỡ')).toBeTruthy()
    expect(within(dlg).getByText('P.S. Ăn bánh nhé')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })

  it('kỷ niệm (ngày + ảnh), cột mốc, gửi từ xa, tặng bất chợt hiện đúng nội dung', async () => {
    const cases = [
      [{ occasion: 'anniversary', occasionData: { date: '14.02.2020', photos: ['/images/a.jpg'] } }, ['14.02.2020'], 'Kỷ niệm 1'],
      [{ occasion: 'milestone', occasionData: { label: 'Đã tốt nghiệp' } }, ['Đã tốt nghiệp']],
      [{ occasion: 'longDistance', occasionData: { places: ['Hà Nội', 'Huế'] } }, ['Hà Nội', 'Huế']],
      [{ occasion: 'justBecause', occasionData: { icon: '🌙', message: 'Vì nhớ' } }, ['🌙', 'Vì nhớ']],
    ]
    for (const [patch, texts, img] of cases) {
      const { unmount } = openLetter({ ...base, ...patch })
      await readLetter()
      fireEvent.click(screen.getByRole('button', { name: new RegExp(OCCASION_THEMES[patch.occasion].surprise) }))
      const dlg = screen.getByRole('dialog')
      for (const t of texts) expect(within(dlg).getByText(t)).toBeTruthy()
      if (img) expect(within(dlg).getByRole('img', { name: img }).getAttribute('src')).toBe('/images/a.jpg')
      unmount()
    }
  })

  it('không có nội dung bất ngờ (server trả photos: [] và tái bút null) → không có nút bất ngờ', async () => {
    const { value } = validateLetterContent({ ...base, occasion: 'anniversary', occasionData: {} })
    expect(value.occasionData).toEqual({ photos: [] })
    openLetter(value)
    await readLetter()
    expect(document.querySelector('.lw-surprise-trigger')).toBeNull()
  })

  it('tên/nội dung có HTML hiển thị như chữ thường', async () => {
    openLetter({ ...base, recipientName: '<img src=x onerror=alert(1)>', message: ['<b>đậm</b>'] })
    const article = await readLetter()
    expect(article.querySelector('img[src="x"]')).toBeNull()
    expect(article.querySelector('b')).toBeNull()
    expect(screen.getAllByText('<b>đậm</b>').length).toBeGreaterThan(0)
  })

  it('thư video: bấm "Xem lời nhắn" mới phát; poster/phụ đề null không tạo thuộc tính rỗng', async () => {
    openLetter({ ...base, kind: 'video', message: [], videoUrl: '/videos/a.mp4', posterUrl: null, captionsUrl: null })
    const article = await readLetter()
    fireEvent.click(within(article).getByRole('button', { name: /Xem lời nhắn/ }))
    const v = article.querySelector('video')
    expect(v.getAttribute('src')).toBe('/videos/a.mp4')
    expect(v.hasAttribute('poster')).toBe(false)
    expect(v.querySelector('track')).toBeNull()
  })
})

describe('Hiệu ứng canvas-confetti', () => {
  it('mỗi dịp có hiệu ứng riêng và dừng được (huỷ vòng lặp + reset)', async () => {
    vi.stubGlobal('matchMedia', media(false))
    vi.useFakeTimers()
    for (const occasion of Object.keys(OCCASION_THEMES)) {
      expect(typeof EFFECTS[occasion]).toBe('function')
      confetti.mockClear()
      confetti.reset.mockClear()
      const stop = playOccasion(occasion, { icon: '🌙' })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400)
      })
      expect(confetti, occasion).toHaveBeenCalled()
      stop()
      expect(confetti.reset).toHaveBeenCalled()
      const calls = confetti.mock.calls.length
      await act(async () => {
        await vi.advanceTimersByTimeAsync(4000)
      })
      expect(confetti.mock.calls.length, `${occasion} dừng hẳn`).toBe(calls)
    }
    expect(confetti.shapeFromText).toHaveBeenCalledWith(expect.objectContaining({ text: '🌙' }))
  })

  it('giảm chuyển động hoặc dịp lạ → không gọi thư viện', async () => {
    vi.stubGlobal('matchMedia', media(true))
    playOccasion('birthday')()
    vi.stubGlobal('matchMedia', media(false))
    playOccasion('khong-co')()
    await new Promise((r) => setTimeout(r, 10))
    expect(confetti).not.toHaveBeenCalled()
  })

  it('ảnh đèn lạ → về đèn mặc định', () => {
    expect(lampSrc('../../etc')).toBe('/images/lamps/tu-linh-cutout.webp')
  })
})

describe('Server: kiểu trải nghiệm + đèn (D-140)', () => {
  it('template chỉ room/web (mặc định room), lamp chỉ 5 mẫu đèn', () => {
    const ok = { recipientName: 'A', senderName: 'B', occasion: 'birthday', kind: 'text', message: 'x' }
    expect(validateLetterContent(ok).value).toMatchObject({ template: 'room', lamp: null })
    expect(validateLetterContent({ ...ok, template: 'web', lamp: 'thu-hoach' }).value).toMatchObject({ template: 'web', lamp: 'thu-hoach' })
    expect(validateLetterContent({ ...ok, template: '<x>', lamp: '../x' }).value).toMatchObject({ template: 'room', lamp: null })
  })
})

describe('Trang người nhận + admin chọn kiểu web 2D', () => {
  const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
  const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
  afterEach(() => {
    window.location.hash = ''
    localStorage.clear()
  })

  it('/thu/<slug>: thư template "web" → sau hai video là bản web 2D (không phải Phòng thư 3D)', async () => {
    vi.stubGlobal('matchMedia', media(true))
    localStorage.setItem('lv.letter.intro.abcdefghij', '1')
    mockApi({ 'POST /letters/open': () => ({ body: { item: { ...base, template: 'web', lamp: 'thu-hoach' } } }) })
    window.location.hash = '#' + 'A'.repeat(43)
    renderAt('/thu/abcdefghij')
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(await screen.findByText('Đèn Thu Hoạch', {}, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Chạm để bật đèn' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(await screen.findByRole('button', { name: 'Lịch sử văn hoá' })).toBeTruthy()
  })

  it('admin: chọn "Web 2D" + đèn → lưu gửi template/lamp; xem thử mở bản web 2D', async () => {
    vi.stubGlobal('matchMedia', media(true))
    localStorage.setItem('moc.session', JSON.stringify(session))
    const calls = []
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }),
      'PUT /admin/orders/LV-AAA/letter': (_u, init) => {
        calls.push(JSON.parse(init.body).content)
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
    })
    renderAt('/admin/orders/LV-AAA/letter')
    fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Ngọc' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Thân.' } })
    expect(screen.queryByLabelText('Đèn trong phong thư')).toBeNull()
    fireEvent.change(screen.getByLabelText('Kiểu trải nghiệm'), { target: { value: 'web' } })
    fireEvent.change(screen.getByLabelText('Đèn trong phong thư'), { target: { value: 'lon-dan' } })
    // Đổi mẫu lời chúc giữ nguyên kiểu + đèn đã chọn
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    fireEvent.change(screen.getByLabelText('Mẫu lời chúc Phòng thư'), { target: { value: 'encouragement' } })
    expect(screen.getByLabelText('Kiểu trải nghiệm').value).toBe('web')
    expect(screen.getByLabelText('Đèn trong phong thư').value).toBe('lon-dan')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0]).toMatchObject({ template: 'web', lamp: 'lon-dan', occasion: 'encouragement' })
    expect(validateLetterContent(calls[0]).errors).toEqual({})
    fireEvent.click(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }))
    const dlg = await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    expect(await within(dlg).findByText('Đèn Lợn Đàn', {}, { timeout: 5000 })).toBeTruthy()
    fireEvent.click(within(dlg).getByRole('button', { name: 'Đóng xem trước' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Demo /phong-thu/web', () => {
  it('đổi dịp và đèn bằng menu lời chúc mẫu', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const { default: LetterWebRoute } = await import('./LetterWebRoute.jsx')
    render(
      <MemoryRouter initialEntries={['/phong-thu/web?occasion=milestone']}>
        <LetterWebRoute />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Đèn Tứ Linh')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Thu Hoạch' }))
    expect(await screen.findByText('Đèn Thu Hoạch')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Cột mốc' }).getAttribute('aria-pressed')).toBe('true')
  })
})
