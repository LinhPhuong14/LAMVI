// @vitest-environment jsdom
// Admin/IT đăng nhập xong vào thẳng /admin, không vào dashboard khách (D-48, D-51).
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { landingPath } from './landing.js'

const session = { accessToken: 'tok-1', expiresAt: 9999999999, user: { id: 'u1', email: 'a@lamvi.test' } }
const profile = (role) => () => ({ body: { profile: { id: 'u1', email: 'a@lamvi.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const base = (role, extra = {}) => ({
  'GET /products': () => ({ body: { items: [] } }),
  'POST /auth/login': () => ({ body: session }),
  'GET /me': profile(role),
  'GET /admin/orders': () => ({ body: { items: [] } }),
  'GET /admin/analytics/realtime': () => ({ body: { configured: false } }),
  'GET /orders': () => ({ body: { items: [] } }),
  'GET /may/history': () => ({ body: { items: [] } }),
  ...extra,
})

async function signIn() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@lamvi.test' } })
  fireEvent.change(screen.getByLabelText('Mật khẩu'), { target: { value: 'Gio-Hoa#Sen2026' } })
  fireEvent.click(screen.getAllByRole('button', { name: 'Đăng nhập' }).find((b) => b.type === 'submit'))
}

beforeEach(() => {
  localStorage.clear()
  window.history.replaceState(null, '', '/')
})

describe('Trang đích sau khi đăng nhập', () => {
  it.each(['admin', 'it'])('%s → /admin (khu quản trị), không vào /account', async (role) => {
    mockApi(base(role))
    renderAt('/login')
    await signIn()
    expect(await screen.findByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeInTheDocument()
    expect(screen.queryByText(/Tài khoản của tôi/)).toBeNull()
  })

  it('khách hàng → /account như cũ', async () => {
    const fetchMock = mockApi(base('customer', { 'GET /may/history': () => ({ body: { items: [] } }) }))
    renderAt('/login')
    await signIn()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/orders'))).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeNull()
  })

  it('admin có ?next (vd đang đi tới giỏ hàng) → tôn trọng next, không ép /admin', async () => {
    const fetchMock = mockApi(base('admin', { 'GET /cart': () => ({ body: { items: [], total: 0 } }) }))
    renderAt('/login?next=%2Fcart')
    await signIn()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/cart'))).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeNull()
  })

  it('trang đăng nhập bản en: admin vẫn vào /admin (admin không có tiền tố ngôn ngữ — D-48)', async () => {
    mockApi(base('admin'))
    renderAt('/en/login')
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'a@lamvi.test' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'Gio-Hoa#Sen2026' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Sign in' }).find((b) => b.type === 'submit'))
    expect(await screen.findByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeInTheDocument()
  })

  it('/me lỗi (mạng, 500) → không chặn đăng nhập, về /account', async () => {
    const fetchMock = mockApi(base('admin', { 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }))
    renderAt('/login')
    await signIn()
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/orders'))).toBe(true))
    expect(localStorage.getItem('moc.session')).toBeTruthy()
  })

  it('đăng nhập sai → ở lại trang, không gọi /me', async () => {
    const fetchMock = mockApi(base('admin', { 'POST /auth/login': () => ({ status: 401, body: { error: { code: 'INVALID_CREDENTIALS' } } }) }))
    renderAt('/login')
    await signIn()
    expect(await screen.findByRole('alert')).toHaveTextContent('Email hoặc mật khẩu không đúng')
    expect(fetchMock.mock.calls.some(([u]) => String(u) === '/api/me')).toBe(false)
  })
})

describe('Google callback', () => {
  const callback = (role, search = '', extra = {}) => {
    window.history.replaceState(null, '', `/auth/callback${search}`)
    const fetchMock = mockApi(base(role, { 'POST /auth/refresh': () => ({ body: session }), ...extra }))
    renderAt(`/auth/callback${search}`)
    return fetchMock
  }

  it('admin vào thẳng /admin', async () => {
    callback('admin')
    expect(await screen.findByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeInTheDocument()
  })

  it('khách hàng → /account (không vào admin)', async () => {
    const fetchMock = callback('customer')
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/orders'))).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeNull()
  })

  it('admin có ?next → theo next', async () => {
    const fetchMock = callback('admin', '?next=%2Fcart', { 'GET /cart': () => ({ body: { items: [], total: 0 } }) })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/cart'))).toBe(true))
    expect(screen.queryByRole('heading', { name: 'Đơn hàng', level: 1 })).toBeNull()
  })

  it('next ngoài site (open redirect) bị bỏ → dùng trang mặc định an toàn của vai trò', async () => {
    const fetchMock = callback('customer', '?next=https%3A%2F%2Fevil.test')
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/orders'))).toBe(true))
  })
})

describe('landingPath', () => {
  it('admin/it → /admin; customer, vai trò lạ, thiếu profile, lỗi → fallback', async () => {
    for (const [role, want] of [['admin', '/admin'], ['it', '/admin'], ['customer', '/account'], ['root', '/account'], [undefined, '/account']]) {
      mockApi({ 'GET /me': () => ({ body: { profile: role ? { role } : {} } }) })
      expect(await landingPath('t', '/account'), String(role)).toBe(want)
    }
    mockApi({ 'GET /me': () => ({ status: 401, body: {} }) })
    expect(await landingPath('t', '/en/account')).toBe('/en/account')
    mockApi({})
    expect(await landingPath('t', '/account')).toBe('/account')
  })

  it('gửi đúng token trong header', async () => {
    const f = mockApi({ 'GET /me': () => ({ body: { profile: { role: 'admin' } } }) })
    await landingPath('tok-xyz', '/account')
    expect(f.mock.calls[0][1].headers.Authorization).toBe('Bearer tok-xyz')
  })
})
