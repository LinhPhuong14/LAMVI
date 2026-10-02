// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const session = { accessToken: 'g1', refreshToken: 'gr1', expiresAt: 9999999999, user: { id: 'u9', email: 'gg@example.com' } }
const profile = { id: 'u9', email: 'gg@example.com', fullName: 'Google User', phone: null, preferredLocale: 'vi', role: 'customer' }
const googleLink = () => document.querySelector('a.btn-google')

beforeEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('GoogleButton', () => {
  it('ẩn khi providers.google=false', async () => {
    const fetchMock = mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: false } }) })
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/auth/providers'))).toBe(true))
    expect(googleLink()).toBeNull()
  })

  it('ẩn khi /auth/providers lỗi', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ status: 500, body: {} }) })
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    expect(googleLink()).toBeNull()
  })

  it('hiện khi google=true, href có lang (không next nếu không có)', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: true } }) })
    renderAt('/en/login')
    await waitFor(() => expect(googleLink()).not.toBeNull())
    const href = googleLink().getAttribute('href')
    expect(href.startsWith('/api/auth/google/start?')).toBe(true)
    const q = new URL(href, 'http://x').searchParams
    expect(q.get('lang')).toBe('en')
    expect(q.has('next')).toBe(false)
  })

  it('href kèm next khi trang có ?next=', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: true } }) })
    renderAt('/zh/login?next=/zh/account%3Ftab%3Dprofile')
    await waitFor(() => expect(googleLink()).not.toBeNull())
    const q = new URL(googleLink().getAttribute('href'), 'http://x').searchParams
    expect(q.get('lang')).toBe('zh')
    expect(q.get('next')).toBe('/zh/account?tab=profile')
  })

  it('cũng hiện ở trang đăng ký', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: true } }) })
    renderAt('/register')
    await waitFor(() => expect(googleLink()).not.toBeNull())
  })
})

describe('LoginPage ?error=', () => {
  it('hiện thông báo GOOGLE_FAILED', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: false } }) })
    renderAt('/login?error=GOOGLE_FAILED')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
  })

  it('không có ?error → không có alert', async () => {
    mockApi({ ...base, 'GET /auth/providers': () => ({ body: { google: false } }) })
    renderAt('/login')
    await screen.findByRole('heading', { name: 'Đăng nhập' })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('AuthCallbackPage (T-49: cookie phiên do server đặt, không token trên URL)', () => {
  const refreshOk = () => ({ body: session })

  it('đổi cookie lấy access token, lưu phiên (không refreshToken), vào trang next', async () => {
    window.history.replaceState(null, '', '/auth/callback?next=%2Faccount')
    const fetchMock = mockApi({ ...base, 'POST /auth/refresh': refreshOk, 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback?next=%2Faccount')
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('moc.session'))
    expect(saved.accessToken).toBe('g1')
    expect(saved).not.toHaveProperty('refreshToken')
    expect(fetchMock.mock.calls.filter(([u]) => String(u).includes('/auth/refresh'))).toHaveLength(1)
  })

  it('next ngoài site bị bỏ qua → vào /account', async () => {
    window.history.replaceState(null, '', '/auth/callback?next=%2F%2Fevil.com')
    mockApi({ ...base, 'POST /auth/refresh': refreshOk, 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback?next=%2F%2Fevil.com')
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
  })

  it('không có cookie phiên (refresh 401) → báo lỗi, không lưu phiên, có link về đăng nhập', async () => {
    window.history.replaceState(null, '', '/auth/callback')
    mockApi({ ...base, 'POST /auth/refresh': () => ({ status: 401, body: { error: { code: 'UNAUTHORIZED' } } }) })
    renderAt('/auth/callback')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
    expect(localStorage.getItem('moc.session')).toBeNull()
    fireEvent.click(within(screen.getByRole('main')).getByRole('link', { name: /đăng nhập/i }))
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })
})
