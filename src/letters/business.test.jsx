// @vitest-environment jsdom
// D-154: thư doanh nghiệp có logo gửi tặng khách hàng
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
  vi.unstubAllGlobals()
  localStorage.clear()
})
const base = { occasion: 'thankYou', kind: 'text', message: ['Cảm ơn quý khách.'], template: 'web', recipientName: 'Chị Lan', senderName: '', occasionData: null, postscript: null }
const LOGO = 'https://cdn.example.com/logo.png'

describe('D-154: server', () => {
  it('nhận tên + logo; bỏ trống cả hai → null; không gửi → null', () => {
    expect(validateLetterContent({ ...base, business: { name: ' An Phát ', logoUrl: LOGO } })).toMatchObject({ errors: {}, value: { business: { name: 'An Phát', logoUrl: LOGO } } })
    expect(validateLetterContent({ ...base, business: { name: '', logoUrl: '' } }).value.business).toBeNull()
    expect(validateLetterContent(base).value.business).toBeNull()
    expect(validateLetterContent({ ...base, business: { logoUrl: '/uploads/a.webp' } }).value.business).toEqual({ name: null, logoUrl: '/uploads/a.webp' })
  })
  it('logo javascript:/http:/data: hoặc sai kiểu → lỗi; tên quá dài → lỗi; business không phải object → lỗi', () => {
    for (const bad of ['javascript:alert(1)', 'http://x.test/a.png', 'data:image/png;base64,AAA', '//evil.test/a.png']) {
      const r = validateLetterContent({ ...base, business: { logoUrl: bad } })
      expect(r.errors['business.logoUrl'], bad).toBe('INVALID')
      expect(r.value.business).toBeNull()
    }
    expect(validateLetterContent({ ...base, business: { logoUrl: 42 } }).errors['business.logoUrl']).toBe('INVALID')
    expect(validateLetterContent({ ...base, business: { name: 'x'.repeat(61) } }).errors['business.name']).toBe('TOO_LONG')
    expect(validateLetterContent({ ...base, business: 'An Phát' }).errors.business).toBe('INVALID')
  })
})

describe('D-154: hiển thị', () => {
  it('đầu trang LAMVI × logo; tờ thư có logo; chữ ký là tên doanh nghiệp khi không có tên người gửi', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={{ ...base, business: { name: 'An Phát', logoUrl: LOGO } }} />)
    expect(container.querySelector('.lw-cobrand img').getAttribute('src')).toBe(LOGO)
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await screen.findByRole('heading', { level: 2, name: 'Gửi Chị Lan,' })
    expect(container.querySelector('.lw-letterhead img').getAttribute('alt')).toBe('An Phát')
    expect(container.querySelector('.lw-signature strong').textContent).toBe('An Phát')
  })
  it('có tên người gửi → ký tên người gửi, tên doanh nghiệp bên dưới; không logo → chữ tên ở đầu trang', async () => {
    reduced()
    const { container } = render(<LetterWeb letter={{ ...base, senderName: 'Minh', business: { name: 'An Phát', logoUrl: null } }} />)
    expect(container.querySelector('.lw-cobrand b').textContent).toBe('An Phát')
    fireEvent.click(screen.getByRole('button', { name: 'Bật đèn' }))
    await screen.findByRole('heading', { level: 2 })
    expect(container.querySelector('.lw-signature strong').textContent).toBe('Minh')
    expect(container.querySelector('.lw-signature-org').textContent).toBe('An Phát')
    expect(container.querySelector('.lw-letterhead span').textContent).toBe('An Phát')
  })
  it('thư thường không có gì của doanh nghiệp', () => {
    reduced()
    const { container } = render(<LetterWeb letter={base} />)
    expect(container.querySelector('.lw-cobrand, .lw-letterhead')).toBeNull()
  })
  it('phong bì: logo trên con dấu niêm phong, tên doanh nghiệp trên mặt phong bì', () => {
    const { container } = render(<Envelope theme={themeOf('thankYou')} recipientName="Lan" senderName="" business={{ name: 'An Phát', logoUrl: LOGO }} occasionLabel="Cảm ơn" open={false} out={false} />)
    expect(container.querySelector('.lw-env-seal.has-logo img').getAttribute('src')).toBe(LOGO)
    expect(container.querySelector('.lw-env-from').textContent).toBe('An Phát')
  })
})

describe('D-154: admin', () => {
  const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
  const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
  it('bật "Thư gửi từ doanh nghiệp", nhập tên + đường dẫn logo → lưu gửi business; tắt → business null', async () => {
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
    fireEvent.change(await screen.findByLabelText('Nội dung thư'), { target: { value: 'Cảm ơn.' } })
    expect(screen.queryByLabelText('Tên doanh nghiệp')).toBeNull()
    fireEvent.click(screen.getByLabelText('Thư gửi từ doanh nghiệp tặng khách hàng'))
    fireEvent.change(screen.getByLabelText('Tên doanh nghiệp'), { target: { value: 'An Phát' } })
    fireEvent.change(screen.getByLabelText('Hoặc dán đường dẫn logo'), { target: { value: LOGO } })
    expect(screen.getByAltText('Logo doanh nghiệp').getAttribute('src')).toBe(LOGO)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].business).toEqual({ name: 'An Phát', logoUrl: LOGO })
    expect(validateLetterContent(calls[0]).errors).toEqual({})
    fireEvent.click(screen.getByLabelText('Thư gửi từ doanh nghiệp tặng khách hàng'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1].business).toBeNull()
  })
})
