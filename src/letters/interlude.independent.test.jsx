// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho D-144: màn giới thiệu LAMVI giữa hai video mở đầu và trải nghiệm thư
// (/thu/:slug), lời mời "Hãy cùng thắp sáng chiếc đèn của bạn" ở pha tối của LetterWeb, màu tiêu đề video.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import Interlude from './Interlude.jsx'
import LetterWeb from '../letter-web/LetterWeb.jsx'

// Phòng thư 3D cần WebGL — thay bằng dấu hiệu để biết nhánh nào được chọn
vi.mock('../letter-room/LetterRoom.jsx', () => ({ default: () => <div data-testid="letter-room-3d" /> }))
vi.mock('canvas-confetti', () => ({ default: Object.assign(vi.fn(), { reset: vi.fn(), shapeFromPath: vi.fn(), shapeFromText: vi.fn() }) }))

const TOKEN = 'C'.repeat(43)
const SLUG = 'abcdefghij'
const FLAG = `lv.letter.intro.${SLUG}`
const base = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }
const T1 = 'Tranh Đông Hồ trên đèn giấy dó'
const T2 = 'Từ làng giấy dó đến chiếc đèn'
const INVITE = 'Hãy cùng thắp sáng chiếc đèn của bạn'
const media = (reduce) => (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })

const video = () => document.querySelector('video.lt-intro-video')
const goBtn = () => screen.queryByRole('button', { name: 'Bước vào' })
const interlude = () => document.querySelector('section.lt-interlude')
const experience = () =>
  document.querySelector('.lw-page') || screen.queryByTestId('letter-room-3d') || screen.queryByRole('button', { name: 'Bật đèn' }) || screen.queryByRole('button', { name: 'Chạm để bật đèn' })

function openLetter(item = base, { seen = false } = {}) {
  if (seen) localStorage.setItem(FLAG, '1')
  mockApi({ 'POST /letters/open': () => ({ body: { item } }) })
  window.location.hash = `#${TOKEN}`
  return renderAt(`/thu/${SLUG}`)
}
async function watchBoth() {
  await screen.findByText(T1)
  expect(interlude()).toBeNull()
  fireEvent.ended(video())
  await screen.findByText(T2)
  expect(interlude()).toBeNull()
  fireEvent.ended(video())
  await screen.findByRole('button', { name: 'Bước vào' })
}

afterEach(() => {
  cleanup()
  // gỡ spy trên setTimeout giả trước khi trả lại đồng hồ thật
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  window.location.hash = ''
})

describe('D-144: thứ tự video → màn giới thiệu → trải nghiệm thư', () => {
  it('chỉ hiện màn giới thiệu sau khi video cuối kết thúc; không có đèn/công tắc trước đó', async () => {
    openLetter()
    await screen.findByText(T1)
    expect(experience()).toBeNull()
    expect(goBtn()).toBeNull()
    fireEvent.ended(video())
    await screen.findByText(T2)
    expect(experience()).toBeNull()
    expect(goBtn()).toBeNull()
    fireEvent.ended(video())
    expect(await screen.findByRole('button', { name: 'Bước vào' })).toBeTruthy()
    // màn giới thiệu thay hẳn video, chưa có đèn
    expect(video()).toBeNull()
    expect(screen.queryByText(T2)).toBeNull()
    expect(experience()).toBeNull()
    expect(screen.queryByText('Đoạn một.')).toBeNull()
    fireEvent.click(goBtn())
    await waitFor(() => expect(document.querySelector('.lw-page')).toBeTruthy())
    expect(interlude()).toBeNull()
    expect(screen.getByRole('button', { name: 'Bật đèn' })).toBeTruthy()
  })

  it('"Bỏ qua, vào phòng" (đã có cờ) → màn giới thiệu, không vào thẳng phòng', async () => {
    openLetter(base, { seen: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(await screen.findByRole('button', { name: 'Bước vào' })).toBeTruthy()
    expect(experience()).toBeNull()
    expect(video()).toBeNull()
  })

  it('"Tiếp tục" khi video lỗi: lỗi video 1 → video 2 (chưa có màn giới thiệu); lỗi video 2 → màn giới thiệu', async () => {
    openLetter()
    await screen.findByText(T1)
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await screen.findByText(T2)
    expect(goBtn()).toBeNull()
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByRole('button', { name: 'Bước vào' })).toBeTruthy()
    expect(experience()).toBeNull()
  })

  it('màn giới thiệu không tự chuyển sau khi chữ chạy xong (người nhận tự bấm)', async () => {
    openLetter(base, { seen: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    await screen.findByRole('button', { name: 'Bước vào' })
    await new Promise((r) => setTimeout(r, 2800))
    await waitFor(() => expect(goBtn().className).toContain('is-ready'))
    expect(interlude()).toBeTruthy()
    expect(experience()).toBeNull()
  })
})

describe('Nội dung màn giới thiệu', () => {
  it('logo, h1 ba dòng, phụ đề, nút; section gắn nhãn bằng h1', () => {
    render(<Interlude onDone={() => {}} />)
    const logo = screen.getByRole('img', { name: 'LAMVI' })
    expect(logo.getAttribute('src')).toBe('/images/brand/logotype.svg')
    const h1s = screen.getAllByRole('heading', { level: 1 })
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent.replace(/\s+/g, ' ')).toContain('LAMVI đem đến cho bạn')
    expect([...h1s[0].querySelectorAll('span')].map((s) => s.textContent)).toEqual(['LAMVI đem đến cho bạn', 'chiếc đèn giấy dó', 'với trải nghiệm độc nhất'])
    expect(h1s[0].querySelector('.lt-interlude-hand').textContent).toBe('chiếc đèn giấy dó')
    expect(screen.getByText(/bức tranh Đông Hồ trên giấy dó/)).toBeTruthy()
    const sec = interlude()
    expect(sec.getAttribute('aria-labelledby')).toBe(h1s[0].id)
    expect(screen.getByRole('region', { name: /LAMVI đem đến cho bạn/ })).toBe(sec)
    expect(goBtn().getAttribute('type')).toBe('button')
  })

  it('trên trang /thu: chỉ một h1 (không trùng tiêu đề video)', async () => {
    openLetter(base, { seen: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    await screen.findByRole('button', { name: 'Bước vào' })
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(document.querySelector('.lt-intro-title')).toBeNull()
  })
})

describe('Nút "Bước vào" và focus (fake timers)', () => {
  it('bấm được ngay trước khi hiện rõ, và sau khi hiện rõ', () => {
    vi.useFakeTimers()
    const a = vi.fn()
    const { unmount } = render(<Interlude onDone={a} />)
    expect(goBtn().className).not.toContain('is-ready')
    expect(goBtn().disabled).toBe(false)
    fireEvent.click(goBtn())
    expect(a).toHaveBeenCalledTimes(1)
    unmount()

    const b = vi.fn()
    render(<Interlude onDone={b} />)
    act(() => vi.advanceTimersByTime(2600))
    expect(goBtn().className).toContain('is-ready')
    fireEvent.click(goBtn())
    expect(b).toHaveBeenCalledTimes(1)
  })

  it('focus: vào section ngay, chuyển sang nút sau ~2,6 s (không sớm hơn)', () => {
    vi.useFakeTimers()
    render(<Interlude onDone={() => {}} />)
    expect(document.activeElement).toBe(interlude())
    expect(interlude().getAttribute('tabindex')).toBe('-1')
    act(() => vi.advanceTimersByTime(2500))
    expect(document.activeElement).toBe(interlude())
    expect(goBtn().className).not.toContain('is-ready')
    act(() => vi.advanceTimersByTime(100))
    expect(document.activeElement).toBe(goBtn())
  })

  it('gỡ bộ hẹn giờ khi unmount sớm (bấm trước khi chữ chạy xong)', () => {
    vi.useFakeTimers()
    const set = vi.spyOn(globalThis, 'setTimeout')
    const clear = vi.spyOn(globalThis, 'clearTimeout')
    const { unmount } = render(<Interlude onDone={() => {}} />)
    const i = set.mock.calls.findIndex(([, ms]) => ms === 2600)
    expect(i).toBeGreaterThanOrEqual(0)
    const id = set.mock.results[i].value
    unmount()
    expect(clear.mock.calls.some(([x]) => x === id)).toBe(true)
  })

  it('giảm chuyển động: nút hiện ngay (is-ready), class is-instant, không hẹn giờ; focus ở section', () => {
    vi.stubGlobal('matchMedia', media(true))
    vi.useFakeTimers()
    const set = vi.spyOn(globalThis, 'setTimeout')
    render(<Interlude onDone={() => {}} />)
    expect(interlude().className).toContain('is-instant')
    expect(goBtn().className).toContain('is-ready')
    expect(set.mock.calls.some(([, ms]) => ms === 2600)).toBe(false)
    act(() => vi.advanceTimersByTime(3000))
    expect(document.activeElement).toBe(interlude())
  })

  it('không có matchMedia → không lỗi, chạy như bình thường', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(() => render(<Interlude onDone={() => {}} />)).not.toThrow()
    expect(goBtn().className).not.toContain('is-ready')
  })

  it('CSS giảm chuyển động: .lt-interlude.is-instant tắt animation/hiện chữ ngay', () => {
    const css = readFileSync(resolve(__dirname, 'letters.css'), 'utf8')
    expect(css).toMatch(/\.lt-interlude\.is-instant/)
    expect(css).toMatch(/prefers-reduced-motion[\s\S]*lt-interlude/)
  })
})

describe('Cờ đã xem (localStorage) không đổi', () => {
  it('xem hết hai video → đặt cờ ngay khi sang màn giới thiệu (chưa cần bấm "Bước vào")', async () => {
    openLetter()
    await watchBoth()
    expect(localStorage.getItem(FLAG)).toBe('1')
  })

  it('bỏ qua / "Tiếp tục" không đặt cờ; bấm "Bước vào" không đổi cờ', async () => {
    const { unmount } = openLetter()
    await screen.findByText(T1)
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await screen.findByText(T2)
    fireEvent.ended(video())
    fireEvent.click(await screen.findByRole('button', { name: 'Bước vào' }))
    await waitFor(() => expect(document.querySelector('.lw-page')).toBeTruthy())
    expect(localStorage.getItem(FLAG)).toBeNull()
    unmount()

    localStorage.setItem(FLAG, '1')
    openLetter()
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Bước vào' }))
    expect(localStorage.getItem(FLAG)).toBe('1')
  })
})

describe('Sau màn giới thiệu: template room / web', () => {
  it.each([
    ['room', 'room'],
    ['web', 'web'],
    [undefined, 'web'],
    ['ROOM', 'web'],
  ])('template %s → %s', async (template, want) => {
    openLetter({ ...base, template }, { seen: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    await screen.findByRole('button', { name: 'Bước vào' })
    expect(screen.queryByTestId('letter-room-3d')).toBeNull()
    expect(document.querySelector('.lw-page')).toBeNull()
    fireEvent.click(goBtn())
    if (want === 'room') {
      expect(await screen.findByTestId('letter-room-3d')).toBeTruthy()
      expect(document.querySelector('.lw-page')).toBeNull()
    } else {
      await waitFor(() => expect(document.querySelector('.lw-page')).toBeTruthy())
      expect(screen.queryByTestId('letter-room-3d')).toBeNull()
    }
    expect(interlude()).toBeNull()
  })
})

describe('Lỗi / không tìm thấy: không bao giờ hiện màn giới thiệu', () => {
  it('token sai định dạng', async () => {
    mockApi({})
    window.location.hash = '#ngan'
    renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(interlude()).toBeNull()
    expect(goBtn()).toBeNull()
  })

  it.each([404, 500])('API %s', async (status) => {
    mockApi({ 'POST /letters/open': () => ({ status, body: { error: { code: status === 404 ? 'NOT_FOUND' : 'INTERNAL_ERROR' } } }) })
    window.location.hash = `#${TOKEN}`
    renderAt(`/thu/${SLUG}`)
    await waitFor(() => expect(document.querySelector('main')?.textContent.length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByText('Đang mở phong thư…')).toBeNull())
    expect(interlude()).toBeNull()
    expect(goBtn()).toBeNull()
    expect(video()).toBeNull()
  })

  it('phản hồi không có item → lỗi, không màn giới thiệu', async () => {
    mockApi({ 'POST /letters/open': () => ({ body: {} }) })
    window.location.hash = `#${TOKEN}`
    renderAt(`/thu/${SLUG}`)
    await waitFor(() => expect(screen.queryByText('Đang mở phong thư…')).toBeNull())
    expect(interlude()).toBeNull()
    expect(video()).toBeNull()
  })

  it('đang tải → không màn giới thiệu', async () => {
    mockApi({ 'POST /letters/open': () => new Promise(() => {}) })
    window.location.hash = `#${TOKEN}`
    renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText('Đang mở phong thư…')).toBeTruthy()
    expect(interlude()).toBeNull()
  })
})

describe('LetterWeb: lời mời bật đèn chỉ ở pha tối', () => {
  const invite = () => document.querySelector('.lw-invite')

  it('component: có lời mời (aria-hidden) + trạng thái sr mới; bật đèn → mất', () => {
    vi.stubGlobal('matchMedia', media(false))
    vi.useFakeTimers()
    render(<LetterWeb letter={{ ...base, template: 'web' }} />)
    expect(invite()).toBeTruthy()
    expect(invite().textContent).toBe(INVITE)
    expect(invite().getAttribute('aria-hidden')).toBe('true')
    expect(screen.getByRole('status').textContent).toMatch(/Hãy cùng thắp sáng chiếc đèn của bạn/)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(invite()).toBeNull()
    for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
    expect(invite()).toBeNull()
  })

  it('giảm chuyển động: vẫn có lời mời ở pha tối, mất sau khi bật', () => {
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterWeb letter={{ ...base, template: 'web' }} />)
    expect(invite()).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(invite()).toBeNull()
  })

  it('/thu: chỉ có lời mời sau "Bước vào" (không có ở màn giới thiệu), mất khi bật đèn', async () => {
    vi.stubGlobal('matchMedia', media(true))
    openLetter({ ...base, template: 'web' }, { seen: true })
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    await screen.findByRole('button', { name: 'Bước vào' })
    expect(screen.queryByText(INVITE)).toBeNull()
    fireEvent.click(goBtn())
    await waitFor(() => expect(invite()).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(invite()).toBeNull()
  })

  it('/phong-thu demo: có lời mời ở pha tối, mất khi bật đèn; không có màn giới thiệu', async () => {
    vi.stubGlobal('matchMedia', media(true))
    mockApi({})
    renderAt('/phong-thu')
    await waitFor(() => expect(invite()).toBeTruthy())
    expect(interlude()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    expect(invite()).toBeNull()
  })
})

describe('CSS', () => {
  const lettersCss = readFileSync(resolve(__dirname, 'letters.css'), 'utf8')
  const rule = (css, sel) => {
    const m = css.match(new RegExp(`(^|\\})\\s*${sel.replace(/\./g, '\\.')}\\s*\\{([^}]*)\\}`, 'm'))
    return m ? m[2] : ''
  }
  const lum = (hex) => {
    const n = parseInt(hex.slice(1), 16)
    return (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255
  }

  it('.lt-intro-title đặt màu sáng (không ăn màu h1 nâu của trang)', () => {
    const body = rule(lettersCss, '.lt-intro-title')
    const m = body.match(/(?:^|;|\s)color:\s*(#[0-9a-f]{6})/i)
    expect(m, body).toBeTruthy()
    expect(lum(m[1])).toBeGreaterThan(0.75)
    expect(body).toMatch(/font-style:\s*italic/)
  })

  it('.lt-interlude-title kế thừa màu kem của section (không ăn màu h1 nâu)', () => {
    expect(rule(lettersCss, '.lt-interlude-title')).toMatch(/color:\s*inherit/)
    const sec = rule(lettersCss, '.lt-interlude').match(/(?:^|;|\s)color:\s*(#[0-9a-f]{6})/i)
    expect(lum(sec[1])).toBeGreaterThan(0.75)
  })

  it('.lw-invite dùng Dancing Script; Dancing Script có bộ ký tự tiếng Việt', () => {
    const webCss = readFileSync(resolve(__dirname, '../letter-web/web.css'), 'utf8')
    expect(rule(webCss, '.lw-invite')).toMatch(/Dancing Script/)
    const src = readFileSync(resolve(__dirname, 'Interlude.jsx'), 'utf8')
    expect(src).toMatch(/dancing-script\/vietnamese/)
  })
})
