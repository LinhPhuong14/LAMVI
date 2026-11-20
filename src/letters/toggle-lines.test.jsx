// @vitest-environment jsdom
// D-164: bật/tắt dòng "Gửi …" đầu thư và khối lời kết + ký tên
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import LetterWeb from '../letter-web/LetterWeb.jsx'
import Envelope from '../letter-web/Envelope.jsx'
import { themeOf } from '../letter-web/themes.js'
import { validateLetterContent } from '../../server/domain/letter.js'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const reduced = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn Quý Thầy Cô.'], template: 'web', recipientName: 'Hội đồng', senderName: 'Tập thể LAMVI', occasionData: null, postscript: null }

function open(letter) {
  reduced()
  const r = render(<LetterWeb letter={letter} />)
  fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
  return r
}

describe('D-164: server', () => {
  it('mặc định hiện cả hai; chỉ false mới tắt', () => {
    const v = validateLetterContent(base).value
    expect([v.showDedication, v.showSignature]).toEqual([true, true])
    const off = validateLetterContent({ ...base, showDedication: false, showSignature: false }).value
    expect([off.showDedication, off.showSignature]).toEqual([false, false])
    for (const x of ['false', 0, null, 'no']) expect(validateLetterContent({ ...base, showDedication: x, showSignature: x }).value.showSignature).toBe(true)
  })
})

describe('D-164: hiển thị', () => {
  it('thư cũ: có "Gửi …" và chữ ký như trước', async () => {
    const { container } = open(base)
    await screen.findByRole('heading', { level: 2, name: 'Gửi Hội đồng,' })
    expect(container.querySelector('.lw-signature').textContent).toContain('Tập thể LAMVI')
  })
  it('tắt "Gửi …": không có tiêu đề, thân thư hiện ngay; chữ ký vẫn còn', async () => {
    const { container } = open({ ...base, showDedication: false })
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(container.querySelector('.lw-dedication')).toBeNull()
    expect(screen.queryByText(/Gửi Hội đồng/)).toBeNull()
    expect(container.querySelector('.lw-content').getAttribute('aria-hidden')).toBe('false')
    expect(container.querySelector('.lw-signature').textContent).toContain('Thương mến,')
  })
  it('tắt lời kết + ký tên: không còn khối chữ ký (kể cả tên doanh nghiệp)', async () => {
    const { container } = open({ ...base, showSignature: false, business: { name: 'Công ty A', logoUrl: null } })
    await screen.findByRole('heading', { level: 2, name: 'Gửi Hội đồng,' })
    await waitFor(() => expect(container.querySelector('.lw-content.is-shown')).toBeTruthy())
    expect(container.querySelector('.lw-signature')).toBeNull()
    expect(screen.queryByText('Tập thể LAMVI')).toBeNull()
  })
  it('phong bì: tắt "Gửi …" thì tờ thư trong phong bì không ghi lời đề tặng', () => {
    const { container } = render(<Envelope theme={themeOf('thankYou')} recipientName="Lan" senderName="" occasionLabel="x" open={false} out={false} showTitle={false} />)
    expect(container.querySelector('.lw-env-sheet-title')).toBeNull()
    expect(container.querySelector('.lw-env-to').textContent).toContain('Lan')
  })
})

describe('D-164: admin', () => {
  it('bỏ hai ô → gửi false; ẩn ô lời kết khi tắt chữ ký; mở lại vẫn giữ', async () => {
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
    const ded = await screen.findByLabelText('Hiện dòng "Gửi …" ở đầu thư')
    const sig = screen.getByLabelText('Hiện lời kết và tên người ký ở cuối thư')
    expect(ded.checked && sig.checked).toBe(true)
    expect(screen.getByLabelText('Lời kết')).toBeTruthy()
    fireEvent.click(ded)
    fireEvent.click(sig)
    expect(screen.queryByLabelText('Lời kết')).toBeNull()
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Cảm ơn.' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content.showDedication).toBe(false)
    expect(calls[0].content.showSignature).toBe(false)
    await waitFor(() => expect(screen.getByLabelText('Hiện dòng "Gửi …" ở đầu thư').checked).toBe(false))
    expect(screen.getByLabelText('Hiện lời kết và tên người ký ở cuối thư').checked).toBe(false)
  })
})
