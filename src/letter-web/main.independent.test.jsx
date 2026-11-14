// @vitest-environment jsdom
// T-11: kiểm thử độc lập D-141 — web 2D là bản chính: mặc định template ở server/admin/người nhận,
// route /phong-thu(/web|/3d), hiệu ứng đọc thư (đốm sáng, sparkle, handwriting reveal), thư viện QR hiện kiểu + đèn.
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import express from 'express'
import request from 'supertest'
import LetterWeb from './LetterWeb.jsx'
import LetterRoomPreview from '../admin/LetterRoomPreview.jsx'
import { S } from '../admin/strings.js'
import { LAMPS } from './themes.js'
import { validateLetterContent, LETTER_TEMPLATES } from '../../server/domain/letter.js'
import { lettersRouter } from '../../server/routes/letters.js'
import { classifyPath } from '../seo/routes.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const confetti = vi.hoisted(() => Object.assign(vi.fn(), { reset: vi.fn(), shapeFromPath: vi.fn(() => 'heart'), shapeFromText: vi.fn(() => 'text') }))
vi.mock('canvas-confetti', () => ({ default: confetti }))
// Phòng thư 3D cần WebGL — thay bằng dấu hiệu để biết nhánh nào được chọn
vi.mock('../letter-room/LetterRoom.jsx', () => ({ default: () => <div data-testid="letter-room-3d" /> }))

const base = { recipientName: 'Linh', senderName: 'An', occasion: 'thankYou', kind: 'text', message: ['Đoạn một.', 'Đoạn hai.'], postscript: null, occasionData: { message: 'Cảm ơn nhé' } }
const ok = { recipientName: 'A', senderName: 'B', occasion: 'birthday', kind: 'text', message: 'x' }
const media = (reduce) => (q) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} })
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const TOKEN = 'B'.repeat(43)
const SLUG = 'abcdefghij'
const toReading = () => {
  for (const ms of [1000, 1900, 1200]) act(() => vi.advanceTimersByTime(ms))
}
const finishTitle = (container) =>
  act(() => {
    const ev = new Event('animationend', { bubbles: true })
    ev.animationName = 'lt-hw-fill'
    container.querySelector('.lt-hw-text').dispatchEvent(ev)
  })
const words = (container) =>
  [...container.querySelectorAll('.lw-word')].map((w) => ({ delay: parseFloat(w.style.animationDelay), dur: parseFloat(w.style.animationDuration) }))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  localStorage.clear()
  window.location.hash = ''
})

describe('Server: template mặc định (D-141)', () => {
  it.each([
    ['thiếu', undefined, 'web'],
    ['null', null, 'web'],
    ['viết hoa ROOM', 'ROOM', 'web'],
    ['chuỗi rỗng', '', 'web'],
    ['có khoảng trắng', ' room', 'web'],
    ['khoá prototype', '__proto__', 'web'],
    ['mảng', ['room'], 'web'],
    ['room', 'room', 'room'],
    ['web', 'web', 'web'],
  ])('%s → %s', (_, template, want) => {
    const input = template === undefined ? ok : { ...ok, template }
    const r = validateLetterContent(input)
    expect(r.value.template).toBe(want)
    expect(r.errors).toEqual({})
  })

  it('web đứng đầu danh sách template', () => {
    expect(LETTER_TEMPLATES[0]).toBe('web')
    expect(LETTER_TEMPLATES).toContain('room')
  })
})

describe('Server: GET /admin/letters có template + lamp', () => {
  const rows = [
    { orderCode: 'LV-1', orderStatus: 'confirmed', status: 'published', slug: SLUG, token: TOKEN, content: { ...ok, template: 'room', lamp: 'lon-dan' } },
    { orderCode: 'LV-2', orderStatus: 'confirmed', status: 'published', slug: 'bbbbbbbbbb', token: TOKEN, content: { ...ok, lamp: 'tu-linh' } },
    { orderCode: 'LV-3', orderStatus: 'confirmed', status: 'draft', slug: 'cccccccccc', token: null, content: null },
  ]
  const app = () => {
    const repo = { listOrderLetters: async () => rows, getProfile: async () => ({ role: 'admin' }) }
    const auth = { getUser: async (t) => (t === 'ok' ? { id: 'u1' } : null) }
    const a = express()
    a.use('/api', lettersRouter({ repo, auth, config: { publicSiteUrl: 'https://lamvi.test', rateLimit: { enabled: false } } }))
    // oxlint-disable-next-line no-unused-vars
    a.use((err, req, res, next) => res.status(err.status ?? 500).json({ error: err.code }))
    return a
  }

  it('đúng tập khoá; thiếu template → web; content null không sập', async () => {
    const r = await request(app()).get('/api/admin/letters').set('Authorization', 'Bearer ok')
    expect(r.status).toBe(200)
    const keys = ['lamp', 'occasion', 'openedAt', 'orderCode', 'orderStatus', 'publishedAt', 'recipientName', 'senderName', 'slug', 'status', 'template', 'updatedAt', 'url']
    for (const i of r.body.items) expect(Object.keys(i).sort()).toEqual(keys)
    expect(r.body.items.map((i) => [i.template, i.lamp])).toEqual([
      ['room', 'lon-dan'],
      ['web', 'tu-linh'],
      ['web', null],
    ])
    expect(r.body.items[0].url).toBe(`https://lamvi.test/thu/${SLUG}#${TOKEN}`)
    expect(r.body.items[2].url).toBeNull()
  })

  it('không có token → 401', async () => {
    expect((await request(app()).get('/api/admin/letters')).status).toBe(401)
  })
})

describe('Người nhận /thu/:slug và xem thử admin: chỉ "room" mở 3D', () => {
  async function openRecipient(item) {
    vi.stubGlobal('matchMedia', media(true))
    localStorage.setItem(`lv.letter.intro.${SLUG}`, '1')
    mockApi({ 'POST /letters/open': () => ({ body: { item } }) })
    window.location.hash = `#${TOKEN}`
    const utils = renderAt(`/thu/${SLUG}?fallback=1`)
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    return utils
  }

  it.each([
    ['thiếu template', undefined, 'web'],
    ['template lạ "ROOM"', 'ROOM', 'web'],
    ['template "web"', 'web', 'web'],
    ['template "room"', 'room', 'room'],
  ])('LetterPage — %s → %s', async (_, template, want) => {
    const { container } = await openRecipient({ ...base, template })
    if (want === 'room') {
      expect(await screen.findByTestId('letter-room-3d')).toBeTruthy()
      expect(container.querySelector('.lw-page')).toBeNull()
    } else {
      await waitFor(() => expect(container.querySelector('.lw-page')).toBeTruthy())
      expect(screen.queryByTestId('letter-room-3d')).toBeNull()
    }
  })

  it.each([
    [undefined, 'web'],
    [null, 'web'],
    ['Room', 'web'],
    ['room', 'room'],
  ])('LetterRoomPreview — template %s → %s', async (template, want) => {
    vi.stubGlobal('matchMedia', media(true))
    render(<LetterRoomPreview letter={{ ...base, template }} onClose={() => {}} />)
    if (want === 'room') expect(await screen.findByTestId('letter-room-3d')).toBeTruthy()
    else await waitFor(() => expect(document.querySelector('.lw-page')).toBeTruthy())
  })
})

describe('Hiệu ứng khi đọc thư: đốm sáng + sparkle', () => {
  it('chỉ xuất hiện ở pha reading, aria-hidden; xem lại từ đầu thì biến mất', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const { container } = render(<LetterWeb letter={base} />)
    expect(container.querySelector('.lw-motes')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    act(() => vi.advanceTimersByTime(1000))
    act(() => vi.advanceTimersByTime(1900))
    expect(container.querySelector('.lw-page').dataset.phase).toBe('unfolding')
    expect(container.querySelector('.lw-motes')).toBeNull()
    expect(container.querySelector('.lw-letter-sparkles')).toBeNull()
    act(() => vi.advanceTimersByTime(1200))
    const motes = container.querySelector('.lw-motes')
    const sparkles = container.querySelector('.lw-letter-sparkles')
    expect(motes.getAttribute('aria-hidden')).toBe('true')
    expect(sparkles.getAttribute('aria-hidden')).toBe('true')
    expect(motes.querySelectorAll('i').length).toBeGreaterThan(0)
    expect(sparkles.querySelectorAll('i').length).toBeGreaterThan(0)
    // sparkle nằm trong tờ thư, đốm sáng nằm ngoài (fixed toàn trang)
    expect(sparkles.closest('.lw-letter')).toBeTruthy()
    expect(motes.closest('.lw-letter')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem lại từ đầu' }))
    expect(container.querySelector('.lw-motes')).toBeNull()
    expect(container.querySelector('.lw-letter-sparkles')).toBeNull()
  })

  it('reduced motion: tới pha reading nhưng không có đốm sáng/sparkle', async () => {
    vi.stubGlobal('matchMedia', media(true))
    const { container } = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await waitFor(() => expect(container.querySelector('.lw-page').dataset.phase).toBe('reading'))
    expect(container.querySelector('.lw-motes')).toBeNull()
    expect(container.querySelector('.lw-letter-sparkles')).toBeNull()
    // reduced: không có nút "Hiện toàn bộ" (đã hiện sẵn)
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
  })

  it('CSS: .lw-motes là fixed, cả hai bị ẩn trong prefers-reduced-motion', () => {
    const css = readFileSync(resolve(process.cwd(), 'src/letter-web/web.css'), 'utf8')
    expect(css).toMatch(/\.lw-motes\s*\{[^}]*position:\s*fixed/)
    const reduce = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
    expect(reduce).toMatch(/\.lw-motes/)
    expect(reduce).toMatch(/\.lw-letter-sparkles/)
  })
})

describe('Handwriting reveal: nhịp theo ký tự, ≤ 7 s', () => {
  async function timingsOf(message) {
    vi.stubGlobal('matchMedia', media(true))
    const r = render(<LetterWeb letter={{ ...base, message }} />)
    fireEvent.click(within(r.container).getByRole('button', { name: 'Bật đèn' }))
    await waitFor(() => expect(r.container.querySelector('.lw-page').dataset.phase).toBe('reading'))
    const t = words(r.container)
    r.unmount()
    return t
  }
  const monotonic = (t) => t.every((x, i) => i === 0 || x.delay >= t[i - 1].delay)

  it('thư ngắn: nhịp 0,055 s/ký tự, chữ dài viết lâu hơn chữ ngắn', async () => {
    const t = await timingsOf(['a xinhxinhxinh b'])
    // "xinhxinhxinh" = 12 ký tự → 0,11 + 13×0,055 = 0,825
    expect(t.map((x) => x.delay)).toEqual([0, 0.11, 0.82])
    expect(t[1].dur).toBeGreaterThan(t[0].dur)
    for (const x of t) {
      expect(x.dur).toBeGreaterThanOrEqual(0.2)
      expect(x.dur).toBeLessThanOrEqual(0.9)
    }
  })

  it('nhiều đoạn: có nhịp ngắt giữa đoạn, độ trễ tăng dần', async () => {
    const t = await timingsOf(['một hai', 'ba'])
    expect(monotonic(t)).toBe(true)
    // "ba" = 0 + (3+1+3+1)×0,055 + 6×0,055 = 0,77
    expect(t[2].delay).toBeCloseTo(0.77, 2)
  })

  it('emoji/ghép ZWJ đếm theo code point, không NaN, đơn điệu', async () => {
    const t = await timingsOf(['🎉🎉 👨‍👩‍👧 chúc'])
    expect(t).toHaveLength(3)
    for (const x of t) expect(Number.isFinite(x.delay) && Number.isFinite(x.dur)).toBe(true)
    expect(monotonic(t)).toBe(true)
    expect(Math.abs(t[1].delay - 3 * 0.055)).toBeLessThan(0.006) // "🎉🎉" = 2 code point + cách
  })

  it('thư rất dài (12 đoạn, ~2300 chữ) và một chữ rất dài: độ trễ ≤ 7 s, đơn điệu', async () => {
    const long = Array.from({ length: 12 }, (_, i) => `Đoạn ${i} ` + 'chữ '.repeat(190).trim())
    const t = await timingsOf(long)
    expect(t.length).toBeGreaterThan(2000)
    expect(monotonic(t)).toBe(true)
    expect(Math.max(...t.map((x) => x.delay))).toBeLessThanOrEqual(7)
    const giant = await timingsOf(['a'.repeat(2000) + ' b'])
    expect(Math.max(...giant.map((x) => x.delay))).toBeLessThanOrEqual(7)
    expect(giant[0].dur).toBeLessThanOrEqual(0.9)
  })

  // BUG (T-11): duration tối thiểu 0,2 s cộng vào độ trễ chữ cuối (~6,99 s) → viết xong ở ~7,19 s.
  // Đã sửa: ngân sách trừ 0,2 s cho nét cuối.
  it('thư dài tối đa theo server (12 × 1200 ký tự): chữ cuối viết XONG (delay + duration) trong 7 s', async () => {
    const t = await timingsOf(Array.from({ length: 12 }, () => 'xy '.repeat(400).trim()))
    expect(Math.max(...t.map((x) => x.delay + x.dur))).toBeLessThanOrEqual(7.01)
  })
})

describe('Nút "Hiện toàn bộ lá thư"', () => {
  it('xuất hiện sau tiêu đề; bấm → mọi đoạn is-complete, nút mất; tự mất sau total + 1 s', () => {
    vi.useFakeTimers()
    vi.stubGlobal('matchMedia', media(false))
    const a = render(<LetterWeb letter={base} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    finishTitle(a.container)
    fireEvent.click(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' }))
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    for (const p of a.container.querySelectorAll('.lw-para')) expect(p.classList.contains('is-complete')).toBe(true)
    a.unmount()

    const b = render(<LetterWeb letter={{ ...base, message: ['x '.repeat(3000).trim()] }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    toReading()
    finishTitle(b.container)
    act(() => vi.advanceTimersByTime(7000))
    expect(screen.getByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeTruthy()
    act(() => vi.advanceTimersByTime(1100))
    expect(screen.queryByRole('button', { name: 'Hiện toàn bộ lá thư' })).toBeNull()
    expect(b.container.querySelector('.lw-para').classList.contains('is-complete')).toBe(true)
  })
})

describe('Route + SEO', () => {
  it.each(['/phong-thu', '/phong-thu/web', '/phong-thu?occasion=birthday&lamp=lon-dan'])('%s → bản web 2D', async (path) => {
    vi.stubGlobal('matchMedia', media(true))
    mockApi({})
    const { container } = renderAt(path)
    await waitFor(() => expect(container.querySelector('.lw-page')).toBeTruthy())
    expect(screen.queryByTestId('letter-room-3d')).toBeNull()
  })

  it('demo nhận ?lamp=: đèn Lợn Đàn', async () => {
    vi.stubGlobal('matchMedia', media(true))
    mockApi({})
    const { container } = renderAt('/phong-thu?occasion=birthday&lamp=lon-dan')
    await waitFor(() => expect(container.querySelector('.lw-lamp img')).toBeTruthy())
    expect(container.querySelector('.lw-lamp img').getAttribute('src')).toBe('/images/lamps/lon-dan-cutout.webp')
  })

  it('/phong-thu/3d → Phòng thư 3D', async () => {
    vi.stubGlobal('matchMedia', media(true))
    mockApi({})
    const { container } = renderAt('/phong-thu/3d')
    expect(await screen.findByTestId('letter-room-3d')).toBeTruthy()
    expect(container.querySelector('.lw-page')).toBeNull()
  })

  it.each(['/phong-thu', '/phong-thu/web', '/phong-thu/3d', '/phong-thu/3d/', '/PHONG-THU/3D', '/en/phong-thu/3d'])('%s là trang riêng tư', (p) => {
    expect(classifyPath(p).kind).toBe('private')
  })
})

describe('Admin: soạn thư + thư viện QR', () => {
  const gallery = (items) => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items } }) })
    return renderAt('/admin/letters')
  }
  const item = (o) => ({ orderCode: 'LV-1', orderStatus: 'confirmed', status: 'published', recipientName: 'Minh', senderName: 'An', occasion: 'birthday', slug: o.orderCode ?? SLUG, publishedAt: null, openedAt: null, updatedAt: null, url: `https://lamvi.test/thu/${SLUG}#${TOKEN}`, ...o })

  it('thư viện: hiện kiểu + đèn; room ẩn đèn; đèn lạ/prototype không hiện, không sập', async () => {
    gallery([
      item({ orderCode: 'LV-1', template: 'web', lamp: 'lon-dan' }),
      item({ orderCode: 'LV-2', template: 'room', lamp: 'lon-dan' }),
      item({ orderCode: 'LV-3', template: 'web', lamp: '__proto__' }),
      item({ orderCode: 'LV-4', template: 'web', lamp: 'constructor' }),
      item({ orderCode: 'LV-5', template: undefined, lamp: null }),
      item({ orderCode: 'LV-6', template: 'web', lamp: 'toString' }),
    ])
    const lis = await waitFor(() => {
      const l = document.querySelectorAll('.letter-gallery > li')
      expect(l).toHaveLength(6)
      return [...l]
    })
    const L = S.letters
    expect(lis[0].textContent).toContain(`${L.experienceShort.web} · ${L.lampPrefix} ${LAMPS['lon-dan']}`)
    expect(lis[1].textContent).toContain(L.experienceShort.room)
    expect(lis[1].textContent).not.toContain(LAMPS['lon-dan'])
    for (const li of lis.slice(2)) {
      expect(li.textContent).toContain(L.experienceShort.web)
      expect(li.textContent).not.toContain(L.lampPrefix + ' ')
    }
  })

  // BUG (T-11): L.experienceShort['__proto__'] trả Object.prototype (truthy) → React ném "Objects are not valid as a React child"
  // → cả trang thư viện rơi vào màn lỗi. Server hiện chỉ trả 'web'/'room' nên chỉ là phòng thủ. Đã sửa bằng Object.hasOwn.
  it('thư viện: template lạ từ API ("__proto__", "constructor") không làm sập trang', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    gallery([item({ orderCode: 'LV-7', template: '__proto__' }), item({ orderCode: 'LV-8', template: 'constructor' })])
    const lis = await waitFor(() => {
      const l = document.querySelectorAll('.letter-gallery > li')
      expect(l).toHaveLength(2)
      return [...l]
    }, { timeout: 1500 })
    err.mockRestore()
    for (const li of lis) expect(li.textContent).toContain(S.letters.experienceShort.web)
  })

  it('soạn thư: mặc định web, web đứng đầu; ảnh đèn + link mẫu theo dịp/đèn; chọn room ẩn khối đèn', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ 'GET /me': me, 'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }) })
    renderAt('/admin/orders/LV-AAA/letter?fallback=1')
    const select = await screen.findByLabelText('Kiểu trải nghiệm')
    expect(select.value).toBe('web')
    expect([...select.options].map((o) => o.value)).toEqual(['web', 'room'])
    const pick = document.querySelector('.letter-lamp-pick')
    const link = within(pick).getByRole('link')
    expect(link.getAttribute('href')).toBe('/phong-thu?occasion=justBecause&lamp=tu-linh')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toContain('noreferrer')
    expect(pick.querySelector('img').getAttribute('src')).toBe('/images/lamps/tu-linh-cutout.webp')
    fireEvent.change(screen.getByLabelText('Đèn trong phong thư'), { target: { value: 'lon-dan' } })
    fireEvent.change(screen.getByLabelText('Dịp'), { target: { value: 'birthday' } })
    expect(link.getAttribute('href')).toBe('/phong-thu?occasion=birthday&lamp=lon-dan')
    expect(pick.querySelector('img').getAttribute('src')).toBe('/images/lamps/lon-dan-cutout.webp')
    fireEvent.change(select, { target: { value: 'room' } })
    expect(document.querySelector('.letter-lamp-pick')).toBeNull()
  })

  it('soạn thư: thư cũ không có template mở ra ở chế độ web', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const content = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['x'], postscript: null, occasionData: null }
    mockApi({ 'GET /me': me, 'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: { status: 'draft', content, url: null } } }) })
    renderAt('/admin/orders/LV-AAA/letter?fallback=1')
    await waitFor(() => expect(screen.getByLabelText('Tên người nhận').value).toBe('Linh'))
    expect(screen.getByLabelText('Kiểu trải nghiệm').value).toBe('web')
  })

  it('không thêm chuỗi tiếng Việt cứng vào các tệp admin vừa sửa', () => {
    const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
    for (const f of ['LetterEditorPage.jsx', 'LettersGalleryPage.jsx', 'LetterRoomPreview.jsx']) {
      const src = readFileSync(resolve(process.cwd(), 'src/admin', f), 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
      expect(src.split('\n').filter((l) => VN.test(l))).toEqual([])
    }
    for (const k of ['experienceShort', 'sampleDemo', 'lampPrefix']) expect(S.letters[k]).toBeTruthy()
  })
})
