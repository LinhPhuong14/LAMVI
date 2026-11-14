// @vitest-environment jsdom
// T-11: kiểm thử độc lập phong thư bản web 2D (D-140) — timer, xem lại giữa chừng, hiệu ứng dừng, Esc, SSR, bàn phím
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import LetterWeb from './LetterWeb.jsx'
import LetterWebRoute from './LetterWebRoute.jsx'
import Envelope from './Envelope.jsx'
import { playOccasion } from './effects.js'
import { OCCASION_THEMES, lampSrc, themeOf } from './themes.js'
import LetterRoomPreview from '../admin/LetterRoomPreview.jsx'
import { validateLetterContent } from '../../server/domain/letter.js'
import { classifyPath } from '../seo/routes.js'

const confetti = vi.hoisted(() => Object.assign(vi.fn(), { reset: vi.fn(), shapeFromPath: vi.fn(() => 'heart'), shapeFromText: vi.fn(() => 'text') }))
vi.mock('canvas-confetti', () => ({ default: confetti }))

const base = { recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Đoạn một.', 'Đoạn hai.'], postscript: null, occasionData: { message: 'Cảm ơn nhé' } }
const media = (reduce) => (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
const animEnd = (el) =>
  act(() => {
    const ev = new Event('animationend', { bubbles: true })
    ev.animationName = 'lt-hw-fill'
    el.dispatchEvent(ev)
  })
const toReading = () => {
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  confetti.mockClear()
  confetti.reset.mockClear()
})

describe('Timer và chuỗi pha', () => {
  it('unmount giữa pha rising không để lại timer', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const { unmount, container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(1000))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('rising')
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })

  it('unmount khi đang viết tiêu đề / chạy chữ không để lại timer', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const a = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    expect(vi.getTimerCount()).toBeGreaterThan(0) // timer dự phòng của tiêu đề
    a.unmount()
    // còn đúng một tác vụ nội bộ của React (≤ 1 ms), không phải timer của tiêu đề/pha
    act(() => vi.advanceTimersByTime(1))
    expect(vi.getTimerCount()).toBe(0)
    const b = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    animEnd(b.container.querySelector('.lt-hw-text'))
    b.unmount()
    act(() => vi.advanceTimersByTime(1))
    expect(vi.getTimerCount()).toBe(0)
  })

  it('"Xem lại từ đầu" giữa pha rising: về phòng tối, timer cũ không đẩy pha tiếp', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(1500))
    expect(container.querySelector('.lw-env')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('dark')
    expect(container.querySelector('.lw-env')).toBeNull()
    act(() => vi.advanceTimersByTime(10000))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('dark')
    expect(vi.getTimerCount()).toBe(0)
    // Bật lại chạy đủ chuỗi từ đầu
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(999))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('lighting')
    act(() => vi.advanceTimersByTime(1))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('rising')
  })

  it('xem lại sau khi đọc: tiêu đề lại chặn thân thư, nút "Hiện toàn bộ" quay lại', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    animEnd(container.querySelector('.lt-hw-text'))
    act(() => vi.advanceTimersByTime(10000))
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    expect(container.querySelector('.lw-content').getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.lw-content').hasAttribute('inert')).toBe(true)
    animEnd(container.querySelector('.lt-hw-text'))
    expect(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeTruthy()
  })

  it('bấm đúp công tắc / đèn không làm nhảy pha', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    const lampBtn = container.querySelector('.lw-lamp')
    fireEvent.click(lampBtn)
    fireEvent.click(lampBtn)
    expect(lampBtn.disabled).toBe(true)
    expect(container.querySelector('.lw-page').dataset.phase).toBe('lighting')
    act(() => vi.advanceTimersByTime(500))
    fireEvent.click(lampBtn)
    act(() => vi.advanceTimersByTime(499))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('lighting')
  })

  it('giảm chuyển động: cả chuỗi pha chạy 0 ms', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(0))
    act(() => vi.advanceTimersByTime(0))
    act(() => vi.advanceTimersByTime(0))
    expect(screen.getByRole('article')).toBeTruthy()
  })
})

describe('Chữ hiện dần', () => {
  it('12 đoạn dài: tổng độ trễ chữ ≤ 4,2 s; thư ngắn bước 0,07 s', () => {
    vi.stubGlobal('matchMedia', media(true))
    const long = Array.from({ length: 12 }, (_, i) => `Đoạn ${i} ` + 'chữ '.repeat(190).trim())
    const { container, unmount } = render(<LetterWeb letter={{ ...base, message: long }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    return waitFor(() => expect(container.querySelector('.lw-word')).toBeTruthy()).then(() => {
      const delays = [...container.querySelectorAll('.lw-word')].map((w) => parseFloat(w.style.animationDelay))
      expect(delays.length).toBeGreaterThan(2000)
      expect(Math.max(...delays)).toBeLessThanOrEqual(4.2)
      expect(container.querySelectorAll('.lw-para')).toHaveLength(12)
      unmount()
      const short = render(<LetterWeb letter={{ ...base, message: ['một hai ba'] }} />)
      fireEvent.click(within(short.container).getByRole('button', { name: 'Bật đèn' }))
      return waitFor(() => expect(short.container.querySelectorAll('.lw-word')).toHaveLength(3)).then(() => {
        const d = [...short.container.querySelectorAll('.lw-word')].map((w) => parseFloat(w.style.animationDelay))
        expect(d).toEqual([0, 0.07, 0.14])
      })
    })
  })

  it('message là chuỗi (thư cũ) tách đoạn theo dòng trống; tên rất dài không vỡ', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const name = 'Nguyễn Thị Phương Linh '.repeat(3).trim()
    const { container } = render(<LetterWeb letter={{ ...base, recipientName: name, message: 'A b.\n\n  \n\nC d.' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(await screen.findByRole('article', { name: `Lời chúc gửi ${name}` })).toBeTruthy()
    expect(container.querySelectorAll('.lw-para')).toHaveLength(2)
  })
})

describe('Điều bất ngờ: hiệu ứng dừng', () => {
  const open = async (letter) => {
    // Mở thư nhanh (giảm chuyển động lúc mount), rồi bật lại chuyển động trước khi mở khung bất ngờ
    // — playOccasion đọc matchMedia ở thời điểm gọi nên confetti vẫn chạy
    vi.stubGlobal('matchMedia', media(true))
    const utils = render(<LetterWeb letter={letter} afterLetter={<button type="button">Phụ</button>} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    const article = await screen.findByRole('article')
    await waitFor(() => expect(article.querySelector('.lw-content.is-shown')).toBeTruthy())
    vi.stubGlobal('matchMedia', media(false))
    fireEvent.click(screen.getByRole('button', { name: new RegExp(themeOf(letter.occasion).surprise) }))
    return utils
  }

  it('đóng khung bất ngờ → confetti.reset, không gọi thêm', async () => {
    await open(base)
    await waitFor(() => expect(confetti).toHaveBeenCalled())
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại lá thư' }))
    expect(confetti.reset).toHaveBeenCalled()
    const n = confetti.mock.calls.length
    await new Promise((r) => setTimeout(r, 500))
    expect(confetti.mock.calls.length).toBe(n)
  }, 10000)

  it('unmount cả lá thư khi khung bất ngờ mở → hiệu ứng dừng', async () => {
    const { unmount } = await open({ ...base, occasion: 'milestone', occasionData: { label: 'Tốt nghiệp' } })
    await waitFor(() => expect(confetti).toHaveBeenCalled())
    unmount()
    expect(confetti.reset).toHaveBeenCalled()
    const n = confetti.mock.calls.length
    await new Promise((r) => setTimeout(r, 500))
    expect(confetti.mock.calls.length).toBe(n)
  }, 10000)

  it('sinh nhật: chưa thổi nến thì chưa có confetti; Esc trước khi thổi không lỗi', async () => {
    await open({ ...base, occasion: 'birthday', occasionData: { message: 'Tuổi mới' } })
    await new Promise((r) => setTimeout(r, 50))
    expect(confetti).not.toHaveBeenCalled()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  }, 10000)

  it('stop() gọi trước khi thư viện tải xong → không bao giờ chạy', async () => {
    vi.stubGlobal('matchMedia', media(false))
    const stop = playOccasion('birthday')
    stop()
    await new Promise((r) => setTimeout(r, 50))
    expect(confetti).not.toHaveBeenCalled()
  })

  it('Esc chỉ đóng khung bất ngờ, không đóng lá thư; Esc lần nữa vô hại', async () => {
    await open(base)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByRole('article')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.getByRole('article')).toBeTruthy()
  }, 10000)

  // Hồi quy: Esc ở khung bất ngờ từng đóng luôn khung xem thử admin (đã sửa, LetterRoomPreview bỏ qua `.lw-surprise`).
  it('admin xem thử web 2D: Esc ở khung bất ngờ chỉ đóng khung bất ngờ', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const onClose = vi.fn()
    render(<LetterRoomPreview letter={{ ...base, template: 'web' }} onClose={onClose} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: /Một lời cảm ơn nữa/ }))
    expect(screen.getByRole('dialog', { name: 'Một lời cảm ơn nữa' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Một lời cảm ơn nữa' })).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('admin xem thử web 2D: Esc ở FilmOverlay chỉ đóng video', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const onClose = vi.fn()
    render(<LetterRoomPreview letter={{ ...base, template: 'web' }} onClose={onClose} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Lịch sử văn hoá' }))
    expect(document.querySelector('.lt-overlay')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.lt-overlay')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('admin xem thử: template khác "web" (thiếu/lạ) mở Phòng thư 3D, không phải bản web', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const { unmount } = render(<LetterRoomPreview letter={{ ...base, template: 'WEB' }} onClose={() => {}} />)
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelector('.lw-page')).toBeNull()
    unmount()
  })
})

describe('Bàn phím và focus', () => {
  it('đèn ảnh ngoài thứ tự Tab; công tắc là button thật, có tên', () => {
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    const lamp = container.querySelector('.lw-lamp')
    expect(lamp.getAttribute('tabindex')).toBe('-1')
    expect(lamp.getAttribute('aria-hidden')).toBe('true')
    const sw = screen.getByRole('button', { name: 'Bật đèn' })
    expect(sw.tabIndex).toBe(0)
    expect(sw.disabled).toBe(false)
  })

  it('vào pha đọc: focus về lá thư', async () => {
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    const article = await screen.findByRole('article')
    await waitFor(() => expect(document.activeElement).toBe(article))
  })

  // Hồi quy a11y: nút "Xem lại từ đầu" biến mất khi bấm → focus phải sang công tắc, không rơi về <body>.
  it('"Xem lại từ đầu" bằng bàn phím: focus chuyển tới công tắc "Bật đèn"', async () => {
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await screen.findByRole('article')
    const again = screen.getByRole('button', { name: 'Xem lại từ đầu' })
    again.focus()
    fireEvent.click(again)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Bật đèn' })), { timeout: 300 })
  })
})

describe('Dữ liệu thư', () => {
  it('đèn lạ / thiếu → Tứ Linh; dịp lạ → theme justBecause', () => {
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={{ ...base, occasion: 'xyz', lamp: '__proto__' }} />)
    expect(container.querySelector('.lw-lamp img').getAttribute('src')).toBe('/images/lamps/tu-linh-cutout.webp')
    expect(screen.getByText('Đèn Tứ Linh')).toBeTruthy()
    expect(lampSrc(undefined)).toBe('/images/lamps/tu-linh-cutout.webp')
  })

  // Hồi quy: khoá kế thừa từ prototype ('constructor'…) không được coi là một dịp (themeOf dùng Object.hasOwn).
  it('themeOf: khoá prototype ("constructor") → theme justBecause', () => {
    expect(themeOf('constructor')).toBe(OCCASION_THEMES.justBecause)
  })

  it('occasionData null, không tái bút → không có nút bất ngờ', async () => {
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterWeb letter={{ ...base, occasionData: null }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    const article = await screen.findByRole('article')
    await waitFor(() => expect(article.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(article.querySelector('.lw-surprise-trigger')).toBeNull()
  })

  it('thư video: không có chữ chạy, không có nút "Hiện toàn bộ"; xem lại tắt video', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const { container } = render(<LetterWeb letter={{ ...base, kind: 'video', message: [], videoUrl: '/v.mp4', posterUrl: '/p.jpg', captionsUrl: '/c.vtt' }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    const article = await screen.findByRole('article')
    await waitFor(() => expect(article.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(container.querySelector('.lw-word')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    fireEvent.click(within(article).getByRole('button', { name: /Xem lời nhắn/ }))
    expect(article.querySelector('video track').getAttribute('src')).toBe('/c.vtt')
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    const again = await screen.findByRole('article')
    expect(again.querySelector('video')).toBeNull()
  })

  it('Envelope: tên người gửi rỗng/khoảng trắng → xi "L"; chữ cái đầu là emoji không vỡ', () => {
    const t = themeOf('birthday')
    const a = render(<Envelope theme={t} recipientName="A" senderName="   " occasionLabel="Sinh nhật" open={false} out={false} />)
    expect(a.container.querySelector('.lw-env-seal').textContent).toBe('L')
    a.unmount()
    const b = render(<Envelope theme={t} recipientName="A" senderName="🌙 Minh" occasionLabel="Sinh nhật" open out />)
    expect(b.container.querySelector('.lw-env-seal').textContent).toBe('🌙')
  })
})

describe('Server validateLetterContent: template + lamp', () => {
  const ok = { recipientName: 'A', senderName: 'B', occasion: 'birthday', kind: 'text', message: 'x' }
  it('thư cũ không có template → room; lamp không phải chuỗi → null; template viết hoa không được nhận', () => {
    expect(validateLetterContent(ok).value).toMatchObject({ template: 'room', lamp: null })
    expect(validateLetterContent({ ...ok, template: 'WEB', lamp: ['tu-linh'] }).value).toMatchObject({ template: 'room', lamp: null })
    expect(validateLetterContent({ ...ok, template: 'web', lamp: { toString: () => 'tu-linh' } }).value).toMatchObject({ template: 'web', lamp: null })
    expect(validateLetterContent({ ...ok, template: 'web', lamp: 'lon-dan' }).errors).toEqual({})
  })
  it('template room vẫn giữ lamp hợp lệ (vô hại, admin tự xoá khi lưu)', () => {
    expect(validateLetterContent({ ...ok, template: 'room', lamp: 'thu-hoach' }).value.lamp).toBe('thu-hoach')
  })
})

describe('SEO + SSR', () => {
  it('/phong-thu/web (mọi biến thể hoa/thường, dấu / cuối, tiền tố ngôn ngữ) là riêng tư', () => {
    for (const p of ['/phong-thu/web', '/PHONG-THU/WEB/', '/Phong-Thu/Web//', '/en/phong-thu/web']) {
      expect(classifyPath(p).kind, p).toBe('private')
    }
    expect(classifyPath('/phong-thu/web/x').kind).toBe('other')
  })

  it('renderToString LetterWebRoute: chỉ khung chờ, không chạm window', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/phong-thu/web?occasion=birthday&lamp=lon-dan']}>
        <LetterWebRoute />
      </MemoryRouter>,
    )
    expect(html).toContain('Đang thắp đèn')
  })

  it('renderToString LetterWeb khi không có window (SSR) không ném lỗi', () => {
    const win = globalThis.window
    let html
    try {
      // eslint-disable-next-line no-global-assign
      delete globalThis.window
      html = renderToString(<LetterWeb letter={{ ...base, lamp: 'thu-hoach' }} />)
    } finally {
      globalThis.window = win
    }
    expect(html).toContain('Bật đèn')
    expect(html).toContain('thu-hoach-cutout.webp')
  })

  it('demo ?occasion=__proto__&lamp=constructor → về sinh nhật + đèn mặc định', async () => {
    vi.stubGlobal('matchMedia', media(true))
    render(
      <MemoryRouter initialEntries={['/phong-thu/web?occasion=__proto__&lamp=constructor']}>
        <LetterWebRoute />
      </MemoryRouter>,
    )
    expect(await screen.findByText('Đèn Tứ Linh')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sinh nhật' }).getAttribute('aria-pressed')).toBe('true')
  })
})
