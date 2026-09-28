// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }

const type = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

describe('Tài khoản (FR-ACC-001)', () => {
  it('chưa đăng nhập vào /account → chuyển tới đăng nhập, đăng nhập xong quay lại', async () => {
    mockApi({
      ...base,
      'POST /auth/login': () => ({ body: session }),
      'GET /me': (url, init) => (init.headers.Authorization === 'Bearer a1' ? { body: { profile } } : { status: 401, body: {} }),
    })
    renderAt('/en/account')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    type('Email', 'an@example.com')
    type('Password', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))
    expect(await screen.findByRole('heading', { name: 'My account' })).toBeInTheDocument()
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('a1')
  })

  it('sai mật khẩu → thông báo lỗi', async () => {
    mockApi({ ...base, 'POST /auth/login': () => ({ status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } }) })
    renderAt('/login')
    type('Email', 'an@example.com')
    type('Mật khẩu', 'sai')
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng.')
  })

  it('đăng ký: lỗi theo trường hiển thị cạnh trường', async () => {
    mockApi({
      ...base,
      'POST /auth/register': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', fields: { phone: 'INVALID_PHONE' } } },
      }),
    })
    renderAt('/register')
    fireEvent.click(screen.getByRole('button', { name: 'Tạo tài khoản' }))
    expect(await screen.findByText('Số điện thoại Việt Nam không hợp lệ.')).toBeInTheDocument()
  })

  it('đăng ký cần xác nhận email → hiện hướng dẫn', async () => {
    const fetchMock = mockApi({ ...base, 'POST /auth/register': () => ({ status: 201, body: { needsConfirmation: true } }) })
    renderAt('/zh/register')
    type('邮箱', 'an@example.com')
    fireEvent.click(screen.getByRole('button', { name: '创建账户' }))
    expect(await screen.findByRole('status')).toHaveTextContent('账户已创建')
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/auth/register'))
    expect(String(call[0])).toContain('lang=zh')
    expect(JSON.parse(call[1].body).preferredLocale).toBe('zh')
  })

  it('token hết hạn → tự refresh rồi gọi lại', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ ...session, accessToken: 'het-han' }))
    mockApi({
      ...base,
      'POST /auth/refresh': () => ({ body: session }),
      'GET /me': (url, init) => (init.headers.Authorization === 'Bearer a1' ? { body: { profile } } : { status: 401, body: {} }),
    })
    renderAt('/account')
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
  })

  it('refresh thất bại → xoá phiên, về trang đăng nhập', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /me': () => ({ status: 401, body: {} }), 'POST /auth/refresh': () => ({ status: 401, body: {} }) })
    renderAt('/account')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(localStorage.getItem('moc.session')).toBeNull()
  })

  it('đăng xuất xoá phiên và gọi API', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const fetchMock = mockApi({ ...base, 'GET /me': () => ({ body: { profile } }), 'POST /auth/logout': () => ({ status: 204 }) })
    renderAt('/account')
    fireEvent.click(await screen.findByRole('button', { name: 'Đăng xuất' }))
    await waitFor(() => expect(localStorage.getItem('moc.session')).toBeNull())
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/logout'))).toBe(true)
  })

  it('next ngoài site bị bỏ qua (chống open redirect)', async () => {
    mockApi({ ...base, 'POST /auth/login': () => ({ body: session }), 'GET /me': () => ({ body: { profile } }) })
    renderAt('/login?next=//evil.com')
    type('Email', 'an@example.com')
    type('Mật khẩu', 'matkhau123')
    fireEvent.click(screen.getByRole('button', { name: 'Đăng nhập' }))
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
  })

  it('trang tài khoản đặt noindex (BR-SEO-001)', async () => {
    mockApi(base)
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })
})

describe('Đặt lại mật khẩu', () => {
  it('không có token khôi phục → báo link không hợp lệ', async () => {
    mockApi(base)
    renderAt('/reset-password')
    expect(await screen.findByRole('alert')).toHaveTextContent('không hợp lệ')
  })

  it('có token recovery trong hash → đổi mật khẩu bằng token đó', async () => {
    window.history.replaceState(null, '', '/reset-password#access_token=rec1&type=recovery')
    const fetchMock = mockApi({ ...base, 'POST /auth/reset-password': () => ({ status: 204 }) })
    renderAt('/reset-password')
    type('Mật khẩu mới', 'matkhaumoi1')
    fireEvent.click(screen.getByRole('button', { name: 'Lưu mật khẩu mới' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Đã đổi mật khẩu')
    const call = fetchMock.mock.calls.find(([u]) => String(u).includes('/auth/reset-password'))
    expect(call[1].headers.Authorization).toBe('Bearer rec1')
    expect(window.location.hash).toBe('')
  })
})
