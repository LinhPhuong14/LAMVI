// @vitest-environment jsdom
// Bảo vệ route: tài khoản, checkout, đơn hàng, admin, IT cần đăng nhập; trang đăng nhập chỉ cho khách
import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import AppRoutes from '../routes.jsx'
import AuthProvider from './AuthProvider.jsx'
import { AuthContext } from './context.js'
import { GuestRoute, ProtectedRoute } from './ProtectedRoute.jsx'
import { LocaleContext } from '../i18n/index.js'
import { mockApi } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
const Probe = () => {
  const l = useLocation()
  return <output data-testid="loc">{l.pathname + l.search}</output>
}
const loc = () => decodeURIComponent(screen.getByTestId('loc').textContent)
const base = { 'GET /products': () => ({ body: { items: [] } }), 'GET /faq': () => ({ body: { items: [] } }), 'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@moc.test', role: 'customer', preferredLocale: 'vi', fullName: 'An' } } }) }
const renderApp = (path) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Probe />
        <AppRoutes />
      </AuthProvider>
    </MemoryRouter>,
  )

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('moc.tour.done', '1')
})

describe('ProtectedRoute — chưa đăng nhập', () => {
  it.each([
    ['/account', '/login?next=/account'],
    ['/account?tab=gallery', '/login?next=/account?tab=gallery'],
    ['/checkout', '/login?next=/checkout'],
    ['/don-hang/LV2610-ABC1234', '/login?next=/don-hang/LV2610-ABC1234'],
    ['/admin/products', '/login?next=/admin/products'],
    ['/it', '/login?next=/it'],
    ['/en/account', '/en/login?next=/en/account'],
    ['/zh/checkout', '/zh/login?next=/zh/checkout'],
  ])('%s → %s', async (from, to) => {
    mockApi(base)
    renderApp(from)
    await waitFor(() => expect(loc()).toBe(to))
  })

  it('trang công khai (trang chủ, cửa hàng, giỏ hàng, lời chúc QR, lô đèn) không bị chuyển hướng', async () => {
    mockApi({ ...base, 'GET /qr/x': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    for (const p of ['/', '/shop', '/cart', '/contact', '/privacy', '/lo/DEMO-2026-01', '/qr/' + 'a'.repeat(64)]) {
      const r = renderApp(p)
      await new Promise((ok) => setTimeout(ok, 50))
      expect(loc()).toBe(p)
      r.unmount()
    }
  })

  it('không lộ nội dung trang riêng cho khách trước khi chuyển hướng', async () => {
    mockApi(base)
    renderApp('/account')
    expect(screen.queryByRole('tab', { name: 'Tổng quan' })).toBeNull()
    await waitFor(() => expect(loc()).toContain('/login'))
    expect(screen.queryByRole('tab', { name: 'Tổng quan' })).toBeNull()
  })
})

describe('ProtectedRoute — đã đăng nhập', () => {
  it('có phiên trong localStorage → vào thẳng /account, không đá về đăng nhập', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /may/history': () => ({ body: { items: [] } }), 'GET /orders': () => ({ body: { items: [] } }), 'GET /cart': () => ({ body: { items: [] } }) })
    renderApp('/account')
    await screen.findByRole('tab', { name: 'Tổng quan' })
    expect(loc()).toBe('/account')
  })
})

describe('ProtectedRoute — đơn vị', () => {
  const wrap = (value, ui, initial = '/secret?x=1') =>
    render(
      <LocaleContext.Provider value="vi">
        <AuthContext.Provider value={value}>
          <MemoryRouter initialEntries={[initial]}>
            <Probe />
            <Routes>
              <Route path="/secret" element={ui} />
              <Route path="*" element={<p>đích</p>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </LocaleContext.Provider>,
    )

  it('chưa biết phiên (ready=false) → hiện đang tải, KHÔNG chuyển hướng, không lộ con', () => {
    wrap({ user: null, ready: false }, <ProtectedRoute><p>riêng tư</p></ProtectedRoute>)
    expect(document.querySelector('[aria-busy="true"]')).not.toBeNull()
    expect(screen.queryByText('riêng tư')).toBeNull()
    expect(loc()).toBe('/secret?x=1')
  })
  it('ready + không user → /login?next= kèm query; có user → render con', () => {
    const r = wrap({ user: null, ready: true }, <ProtectedRoute><p>riêng tư</p></ProtectedRoute>)
    expect(loc()).toBe('/login?next=/secret?x=1')
    r.unmount()
    wrap({ user: { id: 'u' }, ready: true }, <ProtectedRoute><p>riêng tư</p></ProtectedRoute>)
    expect(screen.getByText('riêng tư')).toBeInTheDocument()
  })
  it('context cũ không có `ready` vẫn chạy (mặc định đã sẵn sàng)', () => {
    wrap({ user: { id: 'u' } }, <ProtectedRoute><p>riêng tư</p></ProtectedRoute>)
    expect(screen.getByText('riêng tư')).toBeInTheDocument()
  })
  it('đăng xuất khi đang ở trang riêng → chuyển tới đăng nhập', () => {
    const tree = (user) => (
      <LocaleContext.Provider value="vi">
        <AuthContext.Provider value={{ user, ready: true }}>
          <MemoryRouter initialEntries={['/secret']}>
            <Probe />
            <Routes>
              <Route path="/secret" element={<ProtectedRoute><p>riêng tư</p></ProtectedRoute>} />
              <Route path="*" element={<p>đích</p>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </LocaleContext.Provider>
    )
    const r = render(tree({ id: 'u' }))
    expect(screen.getByText('riêng tư')).toBeInTheDocument()
    r.rerender(tree(null))
    expect(screen.queryByText('riêng tư')).toBeNull()
    expect(loc()).toBe('/login?next=/secret')
  })
})

describe('GuestRoute', () => {
  const guest = (user, initial) =>
    render(
      <LocaleContext.Provider value="vi">
        <AuthContext.Provider value={{ user, ready: true }}>
          <MemoryRouter initialEntries={[initial]}>
            <Probe />
            <Routes>
              <Route path="/login" element={<GuestRoute><p>form đăng nhập</p></GuestRoute>} />
              <Route path="*" element={<p>đích</p>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </LocaleContext.Provider>,
    )

  it('khách → thấy form', () => {
    guest(null, '/login')
    expect(screen.getByText('form đăng nhập')).toBeInTheDocument()
  })
  it('đã đăng nhập mở /login → /account; có next nội bộ → next', async () => {
    const a = guest({ id: 'u' }, '/login')
    await waitFor(() => expect(loc()).toBe('/account'))
    a.unmount()
    guest({ id: 'u' }, '/login?next=%2Fcart')
    await waitFor(() => expect(loc()).toBe('/cart'))
  })
  it.each(['//evil.com', 'https://evil.com', '/\\evil.com'])('next=%s bị bỏ qua (chống open redirect) → /account', async (bad) => {
    guest({ id: 'u' }, `/login?next=${encodeURIComponent(bad)}`)
    await waitFor(() => expect(loc()).toBe('/account'))
  })
  it('đăng nhập NGAY trên trang (user xuất hiện sau khi vào) không bị GuestRoute chen ngang', () => {
    const tree = (user) => (
      <LocaleContext.Provider value="vi">
        <AuthContext.Provider value={{ user, ready: true }}>
          <MemoryRouter initialEntries={['/login']}>
            <Probe />
            <Routes>
              <Route path="/login" element={<GuestRoute><p>form đăng nhập</p></GuestRoute>} />
              <Route path="*" element={<p>đích</p>} />
            </Routes>
          </MemoryRouter>
        </AuthContext.Provider>
      </LocaleContext.Provider>
    )
    const r = render(tree(null))
    r.rerender(tree({ id: 'u' }))
    expect(screen.getByText('form đăng nhập')).toBeInTheDocument()
    expect(loc()).toBe('/login')
  })
})
