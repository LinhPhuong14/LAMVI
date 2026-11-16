// @vitest-environment jsdom
// D-163: ô chọn lời kết — Thương mến (mặc định) hoặc Trân trọng
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LetterWeb from '../letter-web/LetterWeb.jsx'
import { validateLetterContent } from '../../server/domain/letter.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const reduced = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn Quý Thầy Cô.'], template: 'web', recipientName: 'Quý Thầy Cô trong Hội đồng', senderName: 'Tập thể LAMVI', occasionData: null, postscript: null }

async function signature(letter) {
  reduced()
  const { container } = render(<LetterWeb letter={letter} />)
  fireEvent.click(screen.getAllByRole('button').find((b) => /Bật đèn|Turn on the lamp|开灯/.test(b.textContent)))
  await screen.findByRole('heading', { level: 2 })
  const text = container.querySelector('.lw-signature span').textContent
  cleanup()
  return text
}

describe('D-163: lời kết', () => {
  it('server: warm/formal; thiếu hoặc lạ → warm', () => {
    expect(validateLetterContent({ ...base, closing: 'formal' }).value.closing).toBe('formal')
    for (const closing of [undefined, 'warm', 'FORMAL', '__proto__', 1, ['formal']]) expect(validateLetterContent({ ...base, closing }).value.closing).toBe('warm')
  })
  it('thư hiện lời kết theo lựa chọn và ngôn ngữ; thư cũ giữ "Thương mến,"', async () => {
    expect(await signature(base)).toBe('Thương mến,')
    expect(await signature({ ...base, closing: 'formal' })).toBe('Trân trọng,')
    expect(await signature({ ...base, closing: 'formal', lang: 'en' })).toBe('Sincerely,')
    expect(await signature({ ...base, closing: 'warm', lang: 'en' })).toBe('Best regards,')
    expect(await signature({ ...base, closing: 'formal', lang: 'zh' })).toBe('此致敬礼，')
  })
  it('admin: chọn "Trân trọng" → gửi closing formal, mở lại vẫn giữ', async () => {
    const ID = '11111111-2222-4333-8444-555555555555'
    const calls = []
    let stored = null
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }))
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
    renderAt('/admin/letters/new')
    const select = await screen.findByLabelText('Lời kết')
    expect(select.value).toBe('warm')
    fireEvent.change(select, { target: { value: 'formal' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Cảm ơn Quý Thầy Cô.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content.closing).toBe('formal')
    await waitFor(() => expect(screen.getByLabelText('Lời kết').value).toBe('formal'))
  })
})
