// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho D-138: hai video LAMVI mở đầu phong thư, căn phòng bật đèn, nút xem lại
// cuối thư. Bổ sung cho src/admin/Letters.test.jsx và src/letters/letters.independent.test.jsx.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import IntroFilms from './IntroFilms.jsx'
import LetterExtras from './LetterExtras.jsx'
import { INTRO_FILMS, filmByKey, introSeen, markIntroSeen } from './films.js'
import { pickFilmSrc } from '../lib/filmSrc.js'

const TOKEN = 'A'.repeat(43)
const SLUG = 'abcdefghij'
const FLAG = `lv.letter.intro.${SLUG}`
const content = { template: 'room', recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }
const T1 = 'Tranh Đông Hồ trên đèn giấy dó'
const T2 = 'Từ làng giấy dó đến chiếc đèn'

const video = () => document.querySelector('video.lt-intro-video')
const lamp = () => screen.queryByRole('button', { name: 'Chạm để bật đèn' })
const openLetterApi = () => {
  const f = mockApi({ 'POST /letters/open': () => ({ body: { item: content } }) })
  window.location.hash = `#${TOKEN}`
  return f
}
const realMatchMedia = window.matchMedia

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  window.location.hash = ''
  window.matchMedia = realMatchMedia
  localStorage.clear()
})

describe('D-138: hai video mở đầu — phải xem hết mới vào phòng', () => {
  it('thứ tự: giới thiệu đèn (Đông Hồ) → cách làm đèn (giấy dó), đúng nguồn video', async () => {
    expect(INTRO_FILMS.map((f) => f.key)).toEqual(['culture', 'craft'])
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText(T1)).toBeTruthy()
    expect(screen.getByText(/1\/2/)).toBeTruthy()
    expect(video().getAttribute('src')).toMatch(/tranh-dong-ho-720\.mp4$/)
    fireEvent.ended(video())
    expect(await screen.findByText(T2)).toBeTruthy()
    expect(screen.getByText(/2\/2/)).toBeTruthy()
    expect(video().getAttribute('src')).toMatch(/lang-giay-do-720\.mp4$/)
  })

  it('pause / timeupdate / seeking / play ở cả hai video không mở được phòng', async () => {
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    const noise = (v) => {
      fireEvent.play(v)
      fireEvent.pause(v)
      fireEvent.seeking(v)
      fireEvent.seeked(v)
      fireEvent.timeUpdate(v)
      fireEvent.loadedMetadata(v)
      fireEvent.canPlayThrough(v)
    }
    noise(video())
    expect(screen.getByText(T1)).toBeTruthy()
    expect(lamp()).toBeNull()
    fireEvent.ended(video())
    await screen.findByText(T2)
    noise(video())
    expect(screen.getByText(T2)).toBeTruthy()
    expect(lamp()).toBeNull()
    expect(screen.queryByText('Đoạn một.')).toBeNull()
    // chưa xem hết → chưa nhớ cờ
    expect(localStorage.getItem(FLAG)).toBeNull()
  })

  it('chỉ kết thúc video đầu → vẫn ở video 2, không có nút bỏ qua / tiếp tục', async () => {
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    fireEvent.ended(video())
    await screen.findByText(T2)
    expect(lamp()).toBeNull()
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
    expect(screen.getByText(/bước vào căn phòng/)).toBeTruthy()
  })

  it('token sai định dạng / API 404 → không bao giờ hiện video', async () => {
    mockApi({})
    window.location.hash = '#ngan'
    const { unmount } = renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(document.querySelector('video')).toBeNull()
    unmount()

    mockApi({ 'POST /letters/open': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    window.location.hash = `#${TOKEN}`
    renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(document.querySelector('video')).toBeNull()
    expect(screen.queryByText(T1)).toBeNull()
  })

  it('đang tải → chưa hiện video', async () => {
    let release
    mockApi({ 'POST /letters/open': () => new Promise((r) => (release = () => r({ body: { item: content } }))) })
    window.location.hash = `#${TOKEN}`
    renderAt(`/thu/${SLUG}`)
    expect(await screen.findByText('Đang mở phong thư…')).toBeTruthy()
    expect(document.querySelector('video')).toBeNull()
    await act(async () => release())
    expect(await screen.findByText(T1)).toBeTruthy()
  })
})

describe('Nút "Bỏ qua" và cờ đã xem (localStorage)', () => {
  it('cờ của thư khác không cho bỏ qua thư này', async () => {
    localStorage.setItem('lv.letter.intro.zzzzzzzzzz', '1')
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
  })

  it('cờ giá trị lạ (không phải "1") → coi như chưa xem', () => {
    localStorage.setItem(FLAG, 'true')
    expect(introSeen(SLUG)).toBe(false)
  })

  it('có cờ: nút bỏ qua có ở cả video 2', async () => {
    localStorage.setItem(FLAG, '1')
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    fireEvent.ended(video())
    await screen.findByText(T2)
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(await screen.findByRole('button', { name: 'Chạm để bật đèn' })).toBeTruthy()
  })

  it('localStorage.getItem/setItem ném lỗi → vẫn xem video và vào được phòng, không có nút bỏ qua', async () => {
    const get = Storage.prototype.getItem
    const set = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) {
      if (String(k).startsWith('lv.letter')) throw new DOMException('denied', 'SecurityError')
      return get.call(this, k)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (String(k).startsWith('lv.letter')) throw new DOMException('quota', 'QuotaExceededError')
      return set.call(this, k, v)
    })
    expect(() => markIntroSeen(SLUG)).not.toThrow()
    expect(introSeen(SLUG)).toBe(false)
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
    fireEvent.ended(video())
    await screen.findByText(T2)
    fireEvent.ended(video())
    expect(await screen.findByRole('button', { name: 'Chạm để bật đèn' })).toBeTruthy()
  })

  it('bỏ qua bằng nút (đã có cờ) vẫn giữ cờ', async () => {
    localStorage.setItem(FLAG, '1')
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    await screen.findByRole('button', { name: 'Chạm để bật đèn' })
    expect(localStorage.getItem(FLAG)).toBe('1')
  })
})

describe('Video lỗi → "Tiếp tục"', () => {
  it('lỗi ở cả hai video: Tiếp tục → video 2 → Tiếp tục → phòng; nút Tiếp tục mất khi sang video mới', async () => {
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
    fireEvent.error(video())
    expect(screen.getByText('Video chưa phát được trên thiết bị này.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await screen.findByText(T2)
    expect(screen.queryByRole('button', { name: 'Tiếp tục' })).toBeNull()
    expect(lamp()).toBeNull()
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByRole('button', { name: 'Chạm để bật đèn' })).toBeTruthy()
  })

  it('video lỗi khi đã có cờ: ẩn "Bỏ qua", chỉ còn "Tiếp tục"', () => {
    render(<IntroFilms canSkip onDone={() => {}} />)
    expect(screen.getByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeTruthy()
    fireEvent.error(video())
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Tiếp tục' })).toBeTruthy()
  })

  it('IntroFilms: onDone chỉ gọi đúng một lần, sau khi kết thúc video cuối', () => {
    const onDone = vi.fn()
    render(<IntroFilms onDone={onDone} />)
    fireEvent.ended(video())
    expect(onDone).not.toHaveBeenCalled()
    fireEvent.ended(video())
    expect(onDone).toHaveBeenCalledTimes(1)
  })

  // §21.10: cờ "đã xem hết" chỉ đặt khi người nhận xem hết hai video. Hiện tại LetterPage gọi
  // markIntroSeen trong onDone cho mọi lối ra (kể cả "Tiếp tục" khi video lỗi) → lần sau có nút bỏ qua
  // dù chưa từng xem video nào. Test này giữ đỏ để báo lệch spec.
  it('qua cả hai video bằng "Tiếp tục" (video lỗi) → KHÔNG đặt cờ đã xem', async () => {
    openLetterApi()
    renderAt(`/thu/${SLUG}`)
    await screen.findByText(T1)
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await screen.findByText(T2)
    fireEvent.error(video())
    fireEvent.click(screen.getByRole('button', { name: 'Tiếp tục' }))
    await screen.findByRole('button', { name: 'Chạm để bật đèn' })
    expect(localStorage.getItem(FLAG)).toBeNull()
  })
})

describe('Chọn bản video nhẹ/đầy đủ (T-103)', () => {
  const mm = (narrow) => (q) => ({ matches: narrow && q.includes('max-width'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })

  it('màn hẹp → bản 360p; màn rộng → bản 720p', () => {
    window.matchMedia = mm(true)
    render(<IntroFilms onDone={() => {}} />)
    expect(video().getAttribute('src')).toBe('/videos/tranh-dong-ho-360.mp4')
    expect(video().getAttribute('poster')).toBe('/videos/tranh-dong-ho-poster.webp')
  })

  it('màn rộng → 720p; tiết kiệm dữ liệu → 360p dù màn rộng', () => {
    window.matchMedia = mm(false)
    expect(pickFilmSrc(filmByKey('craft').film)).toBe('/videos/lang-giay-do-720.mp4')
    vi.stubGlobal('navigator', { ...navigator, connection: { saveData: true } })
    expect(pickFilmSrc(filmByKey('craft').film)).toBe('/videos/lang-giay-do-360.mp4')
  })

  it('overlay xem lại cũng chọn bản nhẹ khi màn hẹp', () => {
    window.matchMedia = mm(true)
    render(<LetterExtras />)
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại cách làm đèn' }))
    expect(screen.getByRole('dialog').querySelector('video').getAttribute('src')).toBe('/videos/lang-giay-do-360.mp4')
  })
})

describe('Khung xem lại cuối thư (LetterExtras)', () => {
  it('mở: focus vào nút đóng; Esc đóng; nút × đóng', () => {
    render(<LetterExtras />)
    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử văn hoá' }))
    const dlg = screen.getByRole('dialog', { name: T1 })
    expect(dlg.getAttribute('aria-modal')).toBe('true')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng video' }))
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại cách làm đèn' }))
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Đóng video' }))
    fireEvent.click(screen.getByRole('button', { name: 'Đóng video' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hai nút trỏ đúng video; chỉ "Lịch sử văn hoá" có link /welcome (tab mới, noopener)', () => {
    render(<LetterExtras />)
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại cách làm đèn' }))
    let dlg = screen.getByRole('dialog', { name: T2 })
    expect(dlg.querySelector('video').getAttribute('src')).toMatch(/lang-giay-do/)
    expect(dlg.querySelector('a')).toBeNull()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử văn hoá' }))
    dlg = screen.getByRole('dialog', { name: T1 })
    expect(dlg.querySelector('video').getAttribute('src')).toMatch(/tranh-dong-ho/)
    const a = screen.getByRole('link', { name: /truyện kể/ })
    expect(a.getAttribute('href')).toBe('/welcome')
    expect(a.getAttribute('target')).toBe('_blank')
    expect(a.getAttribute('rel')).toMatch(/noopener/)
  })

  it('đóng rồi không còn lắng nghe Esc (gỡ listener)', () => {
    const rm = vi.spyOn(window, 'removeEventListener')
    render(<LetterExtras />)
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại cách làm đèn' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(rm.mock.calls.some(([t]) => t === 'keydown')).toBe(true)
  })
})
