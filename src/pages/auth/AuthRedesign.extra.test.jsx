// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'
import Field from '../../components/Field.jsx'
import { LocaleContext } from '../../i18n/index.js'
import vi_ from '../../i18n/messages/vi.js'
import en_ from '../../i18n/messages/en.js'
import zh_ from '../../i18n/messages/zh.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }
const calls = (m, part) => m.mock.calls.filter(([u]) => String(u).includes(part))
const toggles = () => document.querySelectorAll('.field-pw-toggle')

beforeEach(() => {
  localStorage.clear()
  window.location.hash = ''
})

describe('thanh chuyển .auth-tabs', () => {
  it.each([
    ['/login', 'Chọn đăng nhập hoặc tạo tài khoản', 'Đăng nhập', 'Tạo tài khoản', '/login', '/register'],
    ['/register', 'Chọn đăng nhập hoặc tạo tài khoản', 'Tạo tài khoản', 'Đăng nhập', '/login', '/register'],
    ['/en/login', 'Choose sign in or create account', 'Sign in', 'Create an account', '/en/login', '/en/register'],
    ['/en/register', 'Choose sign in or create account', 'Create an account', 'Sign in', '/en/login', '/en/register'],
    ['/zh/login', '选择登录或创建账户', '登录', '创建账户', '/zh/login', '/zh/register'],
    ['/zh/register', '选择登录或创建账户', '创建账户', '登录', '/zh/login', '/zh/register'],
  ])('%s: aria-label, aria-current đúng tab, href có tiền tố ngôn ngữ', async (url, label, activeName, otherName, loginHref, regHref) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1 })
    const nav = screen.getByRole('navigation', { name: label })
    expect(nav).toHaveClass('auth-tabs')
    const links = within(nav).getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links.map((a) => a.getAttribute('href'))).toEqual([loginHref, regHref])
    const current = links.filter((a) => a.getAttribute('aria-current') === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent(activeName)
    const other = within(nav).getByRole('link', { name: otherName })
    expect(other.hasAttribute('aria-current')).toBe(false)
  })

  it.each([
    ['/en/login?next=%2Fen%2Fproducts%2Fden-nguyet%3Fa%3D1', '/en/login', '/en/register'],
    ['/zh/register?next=%2Fzh%2Fcart', '/zh/login', '/zh/register'],
    ['/login?next=%2Fproducts', '/login', '/register'],
  ])('%s giữ ?next= đã mã hoá ở cả hai link', async (url, l, r) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1 })
    const next = new URL(url, 'http://x').searchParams.get('next')
    const enc = `?next=${encodeURIComponent(next)}`
    const hrefs = within(document.querySelector('nav.auth-tabs')).getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([l + enc, r + enc])
  })

  it.each(['/forgot-password', '/reset-password', '/en/forgot-password', '/zh/reset-password'])('%s không có tabs', async (url) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelector('.auth-tabs')).toBeNull()
    expect(screen.queryByRole('navigation', { name: /Chọn đăng nhập|Choose sign in|选择登录/ })).toBeNull()
  })
})

describe('tiêu đề trang', () => {
  it.each(['/login', '/register', '/forgot-password', '/reset-password', '/en/login', '/zh/register'])('%s có đúng một h1 và hero không phải heading', async (url) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelectorAll('h1')).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    const title = document.querySelector('.auth-aside-title')
    expect(title).not.toBeNull()
    expect(title.tagName).not.toMatch(/^H[1-6]$/)
    expect(title.closest('h1,h2,h3,h4,h5,h6')).toBeNull()
    expect(title.querySelector('h1,h2,h3,h4,h5,h6')).toBeNull()
  })
})

describe('nút hiện/ẩn mật khẩu', () => {
  it.each([
    ['/login', 'Mật khẩu', 'Hiện', 'Ẩn'],
    ['/en/login', 'Password', 'Show', 'Hide'],
    ['/zh/login', '密码', '显示', '隐藏'],
  ])('%s: đổi type, aria-pressed, nhãn và giữ giá trị', async (url, label, show, hide) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1 })
    const input = screen.getByLabelText(label)
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.change(input, { target: { value: 'bi-mat-123' } })
    const btn = screen.getByRole('button', { name: show })
    expect(btn).toHaveClass('field-pw-toggle')
    expect(btn).toHaveAttribute('type', 'button')
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    const shown = screen.getByLabelText(label)
    expect(shown).toHaveAttribute('type', 'text')
    expect(shown).toHaveValue('bi-mat-123')
    const btn2 = screen.getByRole('button', { name: hide })
    expect(btn2).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(btn2)
    expect(screen.getByLabelText(label)).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText(label)).toHaveValue('bi-mat-123')
    expect(screen.getByRole('button', { name: show })).toHaveAttribute('aria-pressed', 'false')
  })

  it('bấm nút không submit form; ô email không có nút', async () => {
    const fetchMock = mockApi(base)
    renderAt('/login')
    await screen.findByRole('heading', { level: 1 })
    expect(toggles()).toHaveLength(1)
    expect(screen.getByLabelText('Email').closest('.field').querySelector('.field-pw-toggle')).toBeNull()
    expect(screen.getByLabelText('Mật khẩu').closest('.field').querySelector('.field-pw-toggle')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Hiện' }))
    expect(calls(fetchMock, '/auth/login')).toHaveLength(0)
  })

  it('register: chỉ ô mật khẩu có nút, họ tên/email/điện thoại/ngôn ngữ thì không', async () => {
    mockApi(base)
    renderAt('/en/register')
    await screen.findByRole('heading', { level: 1 })
    expect(toggles()).toHaveLength(1)
    for (const l of ['Full name', 'Email', 'Phone number (optional)']) {
      expect(screen.getByLabelText(l).closest('.field').querySelector('.field-pw-toggle')).toBeNull()
    }
    expect(screen.getByLabelText('Password').closest('.field').querySelector('.field-pw-toggle')).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Phone number (optional)')).toHaveAttribute('type', 'tel')
  })

  it('reset-password có nút ở ô mật khẩu mới', async () => {
    window.location.hash = '#t=tok'
    mockApi(base)
    renderAt('/en/reset-password')
    await screen.findByRole('heading', { level: 1 })
    // Ô mật khẩu mới và ô nhập lại (D-91), mỗi ô một nút
    expect(toggles()).toHaveLength(2)
    const input = screen.getByLabelText('New password')
    expect(input).toHaveAttribute('type', 'password')
    fireEvent.click(screen.getAllByRole('button', { name: 'Show' })[0])
    expect(screen.getByLabelText('New password')).toHaveAttribute('type', 'text')
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('type', 'password')
  })
})

describe('Field không có toggle', () => {
  it('ô password thường không có .field-pw-toggle và không bọc .field-pw', async () => {
    const { container } = render(
      <LocaleContext.Provider value="vi">
        <Field label="Mật khẩu cũ" type="password" defaultValue="x" />
        <Field label="Ghi chú" as="textarea" />
        <Field label="Chọn" as="select">
          <option value="a">A</option>
        </Field>
      </LocaleContext.Provider>,
    )
    expect(container.querySelector('.field-pw-toggle')).toBeNull()
    expect(container.querySelector('.field-pw')).toBeNull()
    expect(screen.getByLabelText('Mật khẩu cũ')).toHaveAttribute('type', 'password')
    expect(screen.getByLabelText('Chọn')).toContainElement(screen.getByRole('option', { name: 'A' }))
  })

  it('toggle: lỗi và hint vẫn hiển thị, aria-invalid được giữ', async () => {
    render(
      <LocaleContext.Provider value="en">
        <Field label="Pw" toggle error="WEAK_PASSWORD" value="" onChange={() => {}} />
      </LocaleContext.Provider>,
    )
    expect(screen.getByLabelText('Pw')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Pw').getAttribute('aria-describedby')).toBeTruthy()
  })
})

describe('i18n khoá mới', () => {
  it.each([
    ['vi', vi_],
    ['en', en_],
    ['zh', zh_],
  ])('%s định nghĩa 6 khoá auth.*', async (_n, m) => {
    for (const k of ['heroLine1', 'heroLine2', 'heroLead', 'show', 'hide', 'tabsLabel']) {
      expect(typeof m.auth[k], k).toBe('string')
      expect(m.auth[k].trim().length, k).toBeGreaterThan(0)
    }
    expect(m.auth.show).not.toBe(m.auth.hide)
  })
})

describe('footer', () => {
  it('/login: footer có link quên mật khẩu, không có link đăng ký ngoài tabs', async () => {
    mockApi(base)
    renderAt('/login')
    await screen.findByRole('heading', { level: 1 })
    const footer = document.querySelector('.auth-footer')
    expect(within(footer).getAllByRole('link')).toHaveLength(1)
    expect(within(footer).getByRole('link', { name: 'Quên mật khẩu?' })).toHaveAttribute('href', '/forgot-password')
    const regLinks = within(document.querySelector('.auth-stage')).getAllByRole('link').filter((a) => a.getAttribute('href')?.startsWith('/register'))
    expect(regLinks).toHaveLength(1)
    expect(document.querySelector('nav.auth-tabs').contains(regLinks[0])).toBe(true)
  })

  it('/register: không có footer', async () => {
    mockApi(base)
    renderAt('/register')
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelector('.auth-footer')).toBeNull()
  })

  it('/register khi needsConfirmation: không tabs, footer có link đăng nhập', async () => {
    mockApi({ ...base, 'POST /auth/register': () => ({ status: 201, body: { user: session.user, needsConfirmation: true } }) })
    renderAt('/en/register')
    await screen.findByRole('heading', { level: 1 })
    fireEvent.change(screen.getByLabelText('Full name'), { target: { value: 'An' } })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Gio-Hoa#Sen2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Create account' }))
    expect(await screen.findByRole('status')).toBeInTheDocument()
    expect(document.querySelector('.auth-tabs')).toBeNull()
    expect(within(document.querySelector('.auth-footer')).getByRole('link')).toHaveAttribute('href', '/en/login')
    expect(document.querySelectorAll('h1')).toHaveLength(1)
  })
})

describe('đăng nhập khi đang hiện mật khẩu', () => {
  it('gửi đúng thông tin rồi vào tài khoản', async () => {
    const fetchMock = mockApi({
      ...base,
      'POST /auth/login': () => ({ body: session }),
      'GET /me': () => ({ body: { profile } }),
    })
    renderAt('/en/login')
    await screen.findByRole('heading', { level: 1 })
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'an@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Gio-Hoa#Sen2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show' }))
    expect(screen.getByLabelText('Password')).toHaveAttribute('type', 'text')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(JSON.parse(calls(fetchMock, '/auth/login')[0][1].body)).toEqual({ email: 'an@example.com', password: 'Gio-Hoa#Sen2026' })
  })
})
