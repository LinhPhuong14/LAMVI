// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho D-138: trang /thu/:slug dựng Phòng thư 3D (LetterRoom) sau hai video mở đầu,
// tiêu đề viết tay trong LetterReader, FilmOverlay qua portal, admin "Mẫu lời chúc Phòng thư" + "Xem thử trong Phòng thư".
// Dữ liệu thư dựng đúng hình dạng server/domain/letter.js validateLetterContent trả về.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import LetterReader from '../letter-room/LetterReader.jsx'
import { validateLetter, demos, occasions } from '../letter-room/data.js'
import { validateLetterContent, OCCASIONS } from '../../server/domain/letter.js'

const TOKEN = 'B'.repeat(43)
const SLUG = 'abcdefghij'
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const realMatchMedia = window.matchMedia

// Dữ liệu người nhận = đúng output của server (presentLetterForRecipient = content đã chuẩn hoá)
const serverLetter = (input) => {
  const { value, errors } = validateLetterContent({ template: 'room', ...input }) // D-141: các test này kiểm Phòng thư 3D
  expect(errors).toEqual({})
  return value
}

function stubReduced(reduce = true) {
  window.matchMedia = vi.fn((q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  vi.stubGlobal('matchMedia', window.matchMedia)
}

async function openRecipient(item, { skipIntro = true } = {}) {
  stubReduced()
  if (skipIntro) localStorage.setItem(`lv.letter.intro.${SLUG}`, '1')
  const f = mockApi({ 'POST /letters/open': () => ({ body: { item } }) })
  window.location.hash = `#${TOKEN}`
  const utils = renderAt(`/thu/${SLUG}?fallback=1`)
  if (skipIntro) fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
  return { f, ...utils }
}

async function walkToLetter() {
  fireEvent.click(await screen.findByRole('button', { name: 'Chạm để bật đèn' }, { timeout: 5000 }))
  fireEvent.click(await screen.findByRole('button', { name: 'Chạm vào phong bì để mở thư' }, { timeout: 3000 }))
  fireEvent.click(await screen.findByRole('button', { name: 'Kéo mép giấy lên' }, { timeout: 3000 }), { detail: 0 })
  return screen.findByRole('article', {}, { timeout: 3000 })
}

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1280 })
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 720 })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.matchMedia = realMatchMedia
  window.location.hash = ''
  localStorage.clear()
  document.body.style.overflow = ''
})

describe('Trang /thu/:slug → video mở đầu → Phòng thư', () => {
  it('xem hết hai video (ended) → vào phòng, đọc được thư, đánh dấu đã xem', async () => {
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: 'Đoạn một.\n\nĐoạn hai.' })
    await openRecipient(letter, { skipIntro: false })
    for (let i = 0; i < 2; i++) {
      await screen.findByText(`${i + 1}/2`, { exact: false })
      fireEvent.ended(document.querySelector('video.lt-intro-video'))
    }
    const article = await walkToLetter()
    expect(within(article).getByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
    expect(within(article).getByText('Đoạn một.')).toBeTruthy()
    expect(within(article).getByText('Đoạn hai.')).toBeTruthy()
    expect(within(article).getByText('An', { selector: 'strong' })).toBeTruthy()
    // Giảm chuyển động → nội dung hiện ngay, không inert
    const body = article.querySelector('.lr-letter-content')
    expect(body.getAttribute('aria-hidden')).toBe('false')
    expect(body.hasAttribute('inert')).toBe(false)
    // LetterExtras cuối thư; demo picker không hiện cho người nhận
    expect(within(article).getByRole('button', { name: 'Xem lại cách làm đèn' })).toBeTruthy()
    expect(screen.queryByText('Lời chúc mẫu')).toBeNull()
    expect(localStorage.getItem(`lv.letter.intro.${SLUG}`)).toBe('1')
  })

  it('server trả occasionData null, postscript null → không nút bất ngờ, không sập', async () => {
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Cảm ơn.'] })
    expect(letter.occasionData).toBeNull()
    expect(letter.postscript).toBeNull()
    await openRecipient(letter)
    const article = await walkToLetter()
    expect(within(article).getByText('Cảm ơn.')).toBeTruthy()
    expect(within(article).queryByRole('button', { name: /Lật góc thư/ })).toBeNull()
  })

  it('thư video từ server (message [], posterUrl/captionsUrl null) → nút xem, video không track/poster', async () => {
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'video', videoUrl: 'https://cdn.lamvi.test/v.mp4' })
    expect(letter).toMatchObject({ message: [], posterUrl: null, captionsUrl: null })
    await openRecipient(letter)
    const article = await walkToLetter()
    const play = within(article).getByRole('button', { name: /Xem lời nhắn/ })
    expect(play.style.backgroundImage).toBe('')
    fireEvent.click(play)
    const v = article.querySelector('video')
    expect(v.getAttribute('src')).toBe('https://cdn.lamvi.test/v.mp4')
    expect(v.hasAttribute('poster')).toBe(false)
    expect(v.querySelector('track')).toBeNull()
    fireEvent.error(v)
    expect(within(article).getByRole('status').textContent).toMatch(/Video chưa tải được/)
  })

  it('tên chứa HTML hiển thị dạng chữ (không XSS)', async () => {
    const evil = '<img src=x onerror=alert(1)>'
    const letter = serverLetter({ recipientName: evil, senderName: '<b>An</b>', occasion: 'justBecause', kind: 'text', message: ['<script>alert(1)</script>'] })
    await openRecipient(letter)
    const article = await walkToLetter()
    expect(article.querySelector('img, script, b')).toBeNull()
    expect(document.querySelector('img[src="x"]')).toBeNull()
    expect(within(article).getByRole('heading', { level: 2 }).textContent).toContain(evil)
    expect(within(article).getByText('<b>An</b>', { selector: 'strong' })).toBeTruthy()
  })

  const surprise = {
    birthday: ['Mở tấm thiệp nhỏ', 'Chạm để tắt nến'],
    anniversary: ['Mở kỷ niệm của chúng mình', 'Mở điều nhỏ dành cho bạn'],
    justBecause: ['Có một điều nhỏ nữa', 'Chạm vào hình trên đèn'],
    thankYou: ['Lật góc thư', 'Mở điều nhỏ dành cho bạn'],
    milestone: ['Đóng dấu cột mốc', 'Mở điều nhỏ dành cho bạn'],
    encouragement: ['Mở khi cần', 'Mở điều nhỏ dành cho bạn'],
    longDistance: ['Mở hai ô cửa', 'Mở điều nhỏ dành cho bạn'],
  }
  it.each(OCCASIONS)('dịp %s: dữ liệu server → bất ngờ → ghi chú cuối đúng nội dung', async (occasion) => {
    expect(Object.keys(occasions)).toContain(occasion)
    const od = { message: `Bất ngờ ${occasion}`, date: '13.11', photos: [], label: 'Tốt nghiệp', places: ['Hà Nội', 'Huế'], icon: '☾' }
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion, kind: 'text', message: ['Thân.'], occasionData: od })
    await openRecipient(letter)
    const article = await walkToLetter()
    fireEvent.click(within(article).getByRole('button', { name: new RegExp(surprise[occasion][0]) }))
    fireEvent.click(await screen.findByRole('button', { name: surprise[occasion][1] }, { timeout: 3000 }))
    const note = await screen.findByText(`Bất ngờ ${occasion}`, {}, { timeout: 3000 })
    const box = note.closest('.lr-final-note')
    if (occasion === 'anniversary') {
      expect(box.querySelector('img')).toBeNull()
      expect(within(box).getByText('13.11')).toBeTruthy()
    }
    if (occasion === 'milestone') expect(within(box).getByText('Tốt nghiệp')).toBeTruthy()
    if (occasion === 'longDistance') expect(within(box).getByText('Hà Nội • Huế')).toBeTruthy()
  })

  it('tái bút vẫn tới được người nhận khi có lời nhắn bất ngờ (spec §21.9 cảnh D)', async () => {
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Thân.'], postscript: 'P.S. nhớ uống nước', occasionData: { message: 'Cảm ơn nhé' } })
    await openRecipient(letter)
    const article = await walkToLetter()
    // Hiện ngay dưới chữ ký khi đọc thư…
    expect(within(article).getByText('P.S. nhớ uống nước')).toBeTruthy()
    fireEvent.click(within(article).getByRole('button', { name: /Lật góc thư/ }))
    fireEvent.click(await screen.findByRole('button', { name: 'Mở điều nhỏ dành cho bạn' }, { timeout: 3000 }))
    await screen.findByText('Cảm ơn nhé', {}, { timeout: 3000 })
    // …và vẫn còn ở ghi chú cuối cùng cạnh lời nhắn bất ngờ
    expect(screen.queryByText('P.S. nhớ uống nước')).not.toBeNull()
  })

  it('xem lại video cuối thư: overlay gắn vào body, Esc đóng, focus về nút', async () => {
    const letter = serverLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Thân.'] })
    await openRecipient(letter)
    const article = await walkToLetter()
    const btn = within(article).getByRole('button', { name: 'Lịch sử văn hoá' })
    fireEvent.click(btn)
    const dlg = screen.getByRole('dialog')
    expect(dlg.parentElement).toBe(document.body)
    expect(document.activeElement).toBe(within(dlg).getByRole('button', { name: 'Đóng video' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(btn))
  })
})

describe('LetterReader: tiêu đề viết tay giữ nội dung đến khi viết xong', () => {
  const letter = validateLetter({ recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Thân.'], occasionData: null })
  beforeEach(() => stubReduced(false))

  it('ẩn (inert + aria-hidden) tới animationend "lt-hw-fill"; animation khác không mở', () => {
    vi.useFakeTimers()
    const { container } = render(<LetterReader letter={letter} />)
    const body = container.querySelector('.lr-letter-content')
    expect(body.getAttribute('aria-hidden')).toBe('true')
    expect(body.hasAttribute('inert')).toBe(true)
    const text = container.querySelector('.lt-hw-text')
    act(() => text.dispatchEvent(Object.assign(new Event('animationend'), { animationName: 'lt-hw-stroke' })))
    expect(body.getAttribute('aria-hidden')).toBe('true')
    act(() => text.dispatchEvent(Object.assign(new Event('animationend'), { animationName: 'lt-hw-fill' })))
    expect(body.getAttribute('aria-hidden')).toBe('false')
    expect(body.hasAttribute('inert')).toBe(false)
    expect(body.className).toContain('visible')
  })

  it('không có animationend → tự hiện sau duration + 0,8 s (không kẹt mãi)', () => {
    vi.useFakeTimers()
    const { container } = render(<LetterReader letter={letter} />)
    const body = container.querySelector('.lr-letter-content')
    // "Gửi Linh," = 9 ký tự → duration 1,4 s → hạn chót 2,2 s
    act(() => vi.advanceTimersByTime(2100))
    expect(body.getAttribute('aria-hidden')).toBe('true')
    act(() => vi.advanceTimersByTime(200))
    expect(body.getAttribute('aria-hidden')).toBe('false')
  })

  it('tên rất dài → hạn chót tối đa 4,8 s', () => {
    vi.useFakeTimers()
    const { container } = render(<LetterReader letter={{ ...letter, recipientName: 'N'.repeat(60) }} />)
    act(() => vi.advanceTimersByTime(4850))
    expect(container.querySelector('.lr-letter-content').getAttribute('aria-hidden')).toBe('false')
  })
})

describe('Admin: mẫu lời chúc Phòng thư + xem thử', () => {
  const path = '/admin/orders/LV-AAA/letter'
  beforeEach(() => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    stubReduced()
  })
  const mount = async (item = null) => {
    mockApi({ 'GET /me': me, [`GET ${path}`]: () => ({ body: { item } }) })
    renderAt(`${path}?fallback=1`)
    return screen.findByLabelText('Tên người nhận')
  }
  const pick = (o) => fireEvent.change(screen.getByLabelText('Mẫu lời chúc Phòng thư'), { target: { value: o } })

  it.each(OCCASIONS)('mẫu %s điền đúng form, ép loại chữ, xem thử bật', async (occasion) => {
    fireEvent.change(await mount(), { target: { value: 'Ngọc' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Loại thư'), { target: { value: 'video' } })
    pick(occasion)
    const demo = demos[occasion]
    expect(screen.getByLabelText('Dịp').value).toBe(occasion)
    expect(screen.getByLabelText('Loại thư').value).toBe('text')
    expect(screen.getByLabelText('Tên người nhận').value).toBe('Ngọc')
    expect(screen.getByLabelText('Tên người gửi').value).toBe('Minh')
    expect(screen.getByLabelText('Nội dung thư').value).toBe(demo.message.join('\n\n'))
    const fs = screen.getByRole('group', { name: /bất ngờ/i })
    const values = [...fs.querySelectorAll('input, textarea')].map((e) => e.value)
    expect(values).toContain(demo.occasionData.message)
    if (occasion === 'anniversary') expect(values).toContain('13.11.2026')
    if (occasion === 'longDistance') expect(values).toContain('Hà Nội\nSài Gòn')
    if (occasion === 'justBecause') expect(values).toContain('☾')
    if (occasion === 'milestone') expect(values).toContain('Đã tốt nghiệp')
    expect(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }).disabled).toBe(false)
  })

  it('mẫu → lưu: nội dung gửi server hợp lệ theo validateLetterContent', async () => {
    const sent = []
    mockApi({
      'GET /me': me,
      [`GET ${path}`]: () => ({ body: { item: null } }),
      [`PUT ${path}`]: (_u, init) => {
        sent.push(JSON.parse(init.body).content)
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
    })
    renderAt(path)
    for (const occasion of OCCASIONS) {
      fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Ngọc' } })
      fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      pick(occasion)
      fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
      await waitFor(() => expect(sent.length).toBe(OCCASIONS.indexOf(occasion) + 1))
      expect(validateLetterContent(sent.at(-1)).errors).toEqual({})
    }
  })

  it('Esc trong video cuối thư chỉ đóng video; Esc lần hai đóng xem thử, trả overflow body', async () => {
    document.body.style.overflow = 'scroll'
    const content = { template: 'room', recipientName: 'Ngọc', senderName: 'Minh', occasion: 'birthday', kind: 'text', message: ['Thân.'], postscript: null, occasionData: null }
    await mount({ status: 'draft', content, url: null })
    const open = screen.getByRole('button', { name: 'Xem thử trong Phòng thư' })
    fireEvent.click(open)
    expect(document.body.style.overflow).toBe('hidden')
    const article = await walkToLetter()
    fireEvent.click(within(article).getByRole('button', { name: 'Xem lại cách làm đèn' }))
    expect(document.querySelector('.lt-overlay')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(document.querySelector('.lt-overlay')).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Xem thử trong Phòng thư' })).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.style.overflow).toBe('scroll')
  })

  const draft = { status: 'draft', content: { template: 'room', recipientName: 'Ngọc', senderName: 'Minh', occasion: 'birthday', kind: 'text', message: ['Thân.'], postscript: null, occasionData: null }, url: null }
  it('mở xem thử → focus chuyển vào trong dialog ngay', async () => {
    await mount(draft)
    const open = screen.getByRole('button', { name: 'Xem thử trong Phòng thư' })
    open.focus()
    fireEvent.click(open)
    const dlg = await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    await waitFor(() => expect(dlg.contains(document.activeElement)).toBe(true), { timeout: 1000 })
  })

  it('đóng xem thử bằng nút × → focus trở về nút "Xem thử"', async () => {
    await mount(draft)
    const open = screen.getByRole('button', { name: 'Xem thử trong Phòng thư' })
    open.focus()
    fireEvent.click(open)
    const dlg = await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    // Đi tới lá thư: LetterReader tự focus <article> trong dialog
    const article = await walkToLetter()
    await waitFor(() => expect(document.activeElement).toBe(article))
    fireEvent.click(within(dlg).getByRole('button', { name: 'Đóng xem thử' }))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' })), { timeout: 1000 })
  })

  it('xem thử thư video: poster/phụ đề rỗng → null, không sập', async () => {
    const content = { template: 'room', recipientName: 'Ngọc', senderName: 'Minh', occasion: 'longDistance', kind: 'video', videoUrl: '/v.mp4', posterUrl: null, captionsUrl: null, message: [], postscript: null, occasionData: { places: ['A', 'B'] } }
    await mount({ status: 'draft', content, url: null })
    fireEvent.click(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }))
    const article = await walkToLetter()
    fireEvent.click(within(article).getByRole('button', { name: /Xem lời nhắn/ }))
    expect(article.querySelector('video').hasAttribute('poster')).toBe(false)
  })

  it('URL video sai → nút xem thử khoá kèm lý do', async () => {
    fireEvent.change(await mount(), { target: { value: 'Ngọc' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Loại thư'), { target: { value: 'video' } })
    fireEvent.change(screen.getByLabelText(/Đường dẫn video|Video/), { target: { value: 'javascript:alert(1)' } })
    expect(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }).disabled).toBe(true)
    expect(screen.getByText('Thiếu đường dẫn video hợp lệ')).toBeTruthy()
  })

  it('tên chỉ có khoảng trắng → không cho xem thử (server sẽ báo REQUIRED)', async () => {
    fireEvent.change(await mount(), { target: { value: '   ' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Thân.' } })
    expect(validateLetterContent({ recipientName: '   ', senderName: 'Minh', occasion: 'justBecause', kind: 'text', message: 'Thân.' }).errors.recipientName).toBe('REQUIRED')
    expect(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }).disabled).toBe(true)
  })
})
