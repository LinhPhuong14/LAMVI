// @vitest-environment jsdom
// D-157: chọn ngôn ngữ phong thư (tiếng Việt / tiếng Anh / tiếng Trung) khi tạo thư
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import LetterWeb from '../letter-web/LetterWeb.jsx'
import Envelope from '../letter-web/Envelope.jsx'
import { themeOf } from '../letter-web/themes.js'
import { letterText, localizeTheme } from '../letter-web/i18n.js'
import { validateLetterContent } from '../../server/domain/letter.js'

const reduced = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
const base = { occasion: 'birthday', kind: 'text', message: ['Hello.'], template: 'web', recipientName: 'Lan', senderName: 'Minh', occasionData: { message: 'Wish!' }, postscript: null }

describe('D-157: server', () => {
  it('nhận vi/en/zh; thiếu hoặc lạ → vi', () => {
    for (const lang of ['vi', 'en', 'zh']) expect(validateLetterContent({ ...base, lang }).value.lang).toBe(lang)
    for (const lang of [undefined, 'fr', '__proto__', 42, 'EN']) expect(validateLetterContent({ ...base, lang }).value.lang).toBe('vi')
  })
})

describe('D-157: hiển thị', () => {
  it('tiếng Anh: lời mời, nút bật đèn, lời đề tặng, chữ ký, nút bất ngờ, lang của trang', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={{ ...base, lang: 'en' }} />)
    expect(container.querySelector('main').getAttribute('lang')).toBe('en')
    expect(screen.getByText('Let’s light up your lamp')).toBeTruthy()
    expect(screen.getByText('Tứ Linh lamp')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Turn on the lamp' }))
    await screen.findByRole('heading', { level: 2, name: 'Dear Lan,' })
    expect(container.querySelector('.lw-signature span').textContent).toBe('Best regards,')
    await screen.findByRole('button', { name: /Open the birthday card/ })
    fireEvent.click(screen.getByRole('button', { name: /Open the birthday card/ }))
    expect(screen.getByRole('dialog', { name: 'Open the birthday card' }).textContent).toContain('Birthday')
    expect(screen.getByRole('button', { name: 'Make a wish, then blow out the candles' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back to the letter' })).toBeTruthy()
  })
  it('tiếng Trung: chữ giao diện tiếng Trung, lang zh-Hans; bỏ trống tên → 亲爱的你：', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={{ ...base, lang: 'zh', recipientName: '', senderName: '' }} />)
    expect(container.querySelector('main').getAttribute('lang')).toBe('zh-Hans')
    fireEvent.click(screen.getByRole('button', { name: '开灯' }))
    await screen.findByRole('heading', { level: 2, name: '亲爱的你：' })
    expect(container.querySelector('.lw-signature span').textContent).toBe('祝好，')
    await screen.findByRole('button', { name: /打开生日贺卡/ })
  })
  it('thư cũ không có lang → tiếng Việt như trước', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={base} />)
    expect(container.querySelector('main').getAttribute('lang')).toBe('vi')
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await screen.findByRole('heading', { level: 2, name: 'Gửi Lan,' })
    expect(container.querySelector('.lw-signature span').textContent).toBe('Thương mến,')
  })
  it('phong bì theo ngôn ngữ (người nhận, dấu bưu điện)', () => {
    const theme = localizeTheme(themeOf('thankYou'), 'thankYou', 'en')
    const { container } = render(<Envelope T={letterText('en')} theme={theme} recipientName="" senderName="" occasionLabel={theme.label} open={false} out={false} />)
    expect(container.querySelector('.lw-env-to').textContent).toBe('To you')
    expect(container.querySelector('.lw-env-sheet-title').textContent).toBe('Dear friend,')
    expect(container.querySelector('textPath').textContent).toContain('THANK YOU · DÓ PAPER')
  })
  it('đủ bộ chữ cho mọi dịp ở cả ba ngôn ngữ; dịp lạ dùng theme mặc định', () => {
    const keys = Object.keys(letterText('vi')).filter((k) => k !== 'occasions').sort()
    for (const lang of ['en', 'zh']) {
      expect(Object.keys(letterText(lang)).filter((k) => k !== 'occasions').sort()).toEqual(keys)
      for (const o of ['birthday', 'anniversary', 'thankYou', 'milestone', 'encouragement', 'longDistance', 'justBecause']) {
        const t = localizeTheme(themeOf(o), o, lang)
        expect(t.label).not.toBe(themeOf(o).label)
        expect(t.surprise && t.artworkAlt).toBeTruthy()
      }
    }
    expect(localizeTheme(themeOf('__proto__'), '__proto__', 'en').label).toBe(themeOf('justBecause').label)
    expect(letterText('fr')).toBe(letterText('vi'))
  })
})

describe('D-157: admin', () => {
  it('chọn ngôn ngữ khi tạo thư → gửi lang; mở lại thư giữ đúng ngôn ngữ', async () => {
    const ID = '11111111-2222-4333-8444-555555555555'
    const calls = []
    let stored = null
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } }),
      'POST /admin/letters': (_u, init) => {
        const b = JSON.parse(init.body)
        calls.push(b)
        stored = { id: ID, orderId: null, label: b.label, status: 'draft', content: b.content, url: null }
        return { status: 201, body: { item: stored } }
      },
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: stored } }),
    })
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }))
    renderAt('/admin/letters/new')
    const select = await screen.findByLabelText('Ngôn ngữ phong thư')
    expect(select.value).toBe('vi')
    fireEvent.change(select, { target: { value: 'zh' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: '谢谢你。' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content.lang).toBe('zh')
    await waitFor(() => expect(screen.getByLabelText('Ngôn ngữ phong thư').value).toBe('zh'))
  })
})
