// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho ProtectedRoute/GuestRoute: open redirect, vòng lặp, race, luồng admin/IT
import { beforeEach, describe, expect, it } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useLocation } from 'react-router-dom'
import AppRoutes from '../routes.jsx'
import AuthProvider from './AuthProvider.jsx'
import { safeNext } from './context.js'
import { mockApi } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
let navCount = 0
const Probe = () => {
  const l = useLocation()
  navCount++
  return <output data-testid="loc">{l.pathname + l.search}</output>
}
const loc = () => screen.getByTestId('loc').textContent
const profile = (role = 'customer') => ({ id: 'u1', email: 'an@moc.test', role, preferredLocale: 'vi', fullName: 'An' })
const base = (role) => ({
  'GET /products': () => ({ body: { items: [] } }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /me': () => ({ body: { profile: profile(role) } }),
  'GET /may/history': () => ({ body: { items: [] } }),
  'GET /orders': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: { items: [] } }),
})
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
  navCount = 0
})

describe('safeNext — chống open redirect', () => {
  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)', 'evil.com', '', null, undefined, '/a\nb', '/\t/evil.com'])(
    'chặn %j',
    (v) => expect(safeNext(v, '/account')).toBe('/account'),
  )
  it.each(['/account', '/en/account?tab=gallery', '/admin/orders', '/%2f%2fevil.com'])('cho phép %j', (v) => expect(safeNext(v, '/x')).toBe(v))
})

describe('GuestRoute — đã có phiên', () => {
  it('/login không next → /account', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    renderApp('/login')
    await waitFor(() => expect(loc()).toBe('/account'))
  })
  it.each(['//evil.com', '/\\evil.com', 'https://evil.com', 'javascript:alert(1)'])('next=%s → /account (không rời site)', async (n) => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    renderApp('/login?next=' + encodeURIComponent(n))
    await waitFor(() => expect(loc()).toBe('/account'))
  })
  it('next hợp lệ được tôn trọng, giữ tiền tố ngôn ngữ', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    renderApp('/en/login?next=' + encodeURIComponent('/en/account?tab=orders'))
    await waitFor(() => expect(loc()).toBe('/en/account?tab=orders'))
  })
  it('/en/register, /forgot-password có phiên → /en/account, /account', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    let r = renderApp('/en/register')
    await waitFor(() => expect(loc()).toBe('/en/account'))
    r.unmount()
    r = renderApp('/forgot-password')
    await waitFor(() => expect(loc()).toBe('/account'))
  })
  it('KHÔNG vòng lặp khi next trỏ lại chính trang khách (next=/login)', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    renderApp('/login?next=' + encodeURIComponent('/login'))
    await new Promise((ok) => setTimeout(ok, 300))
    expect(navCount).toBeLessThan(40)
    expect(loc()).not.toMatch(/^\/(login|register|forgot-password)/)
  })
  it('/reset-password và /auth/callback không bị chặn dù có phiên', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    for (const p of ['/reset-password', '/auth/callback']) {
      const r = renderApp(p)
      await new Promise((ok) => setTimeout(ok, 50))
      expect(loc()).toBe(p)
      r.unmount()
    }
  })
})

describe('Race / luồng đăng nhập', () => {
  it('vào thẳng /admin/orders khi có phiên admin: không bị đá về login', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base('admin'), 'GET /admin/orders': () => ({ body: { items: [] } }) })
    renderApp('/admin/orders')
    await new Promise((ok) => setTimeout(ok, 100))
    expect(loc()).toBe('/admin/orders')
  })
  it('vào /checkout khi có phiên: ở lại, không qua /login', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi(base())
    const seen = []
    const Spy = () => {
      seen.push(useLocation().pathname)
      return null
    }
    render(
      <MemoryRouter initialEntries={['/checkout']}>
        <AuthProvider>
          <Spy />
          <AppRoutes />
        </AuthProvider>
      </MemoryRouter>,
    )
    await new Promise((ok) => setTimeout(ok, 100))
    expect(seen.every((p) => p === '/checkout')).toBe(true)
  })
  it('khách đăng nhập ngay trên /login không bị GuestRoute chen ngang trước khi form điều hướng', async () => {
    mockApi({
      ...base('admin'),
      'POST /auth/login': () => ({ body: { session } }),
      'GET /admin/orders': () => ({ body: { items: [] } }),
    })
    renderApp('/login')
    await screen.findByRole('button', { name: /Đăng nhập/ })
    expect(loc()).toBe('/login')
    // chỉ kiểm không tự rời /login khi chưa có phiên
    await new Promise((ok) => setTimeout(ok, 50))
    expect(loc()).toBe('/login')
  })
  it('đăng xuất ở trang riêng → rời trang riêng (về trang chủ), không kẹt', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base(), 'POST /auth/logout': () => ({ body: {} }) })
    renderApp('/account')
    await screen.findByRole('tab', { name: 'Tổng quan' })
    localStorage.removeItem('moc.session')
    const btn = screen.queryAllByRole('button', { name: /Đăng xuất/ })[0]
    if (btn) await act(async () => btn.click())
    await waitFor(() => expect(loc()).not.toMatch(/^\/account/))
  })
})
