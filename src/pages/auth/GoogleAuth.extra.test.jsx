// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../../test/renderApp.jsx'
import { productsVi } from '../../test/fixtures.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
}
const session = { accessToken: 'g1', refreshToken: 'gr1', expiresAt: 9999999999, user: { id: 'u9', email: 'gg@example.com' } }
const profile = { id: 'u9', email: 'gg@example.com', fullName: 'Google User', phone: null, preferredLocale: 'vi', role: 'customer' }
const b64url = (obj) => btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
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

describe('AuthCallbackPage', () => {
  it('fragment #s= hợp lệ → lưu phiên, xoá hash, vào /account', async () => {
    window.history.replaceState(null, '', '/auth/callback#s=' + b64url({ session, next: '/account' }))
    mockApi({ ...base, 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback')
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('moc.session')).accessToken).toBe('g1')
    expect(window.location.hash).toBe('')
  })

  it('next ngoài site bị bỏ qua → vào /account', async () => {
    window.history.replaceState(null, '', '/auth/callback#s=' + b64url({ session, next: '//evil.com' }))
    mockApi({ ...base, 'GET /me': () => ({ body: { profile } }) })
    renderAt('/auth/callback')
    expect(await screen.findByRole('heading', { name: 'Tài khoản của tôi' })).toBeInTheDocument()
  })

  it.each([
    ['không có hash', ''],
    ['hash không có s', '#x=1'],
    ['s không phải base64', '#s=!!!'],
    ['s không phải JSON', '#s=' + btoa('hello')],
    ['thiếu accessToken', '#s=' + b64url({ session: { user: {} }, next: '/account' })],
    ['thiếu session', '#s=' + b64url({ next: '/account' })],
  ])('fragment không hợp lệ (%s) → báo lỗi, không lưu phiên', async (_n, hash) => {
    window.history.replaceState(null, '', '/auth/callback' + hash)
    mockApi(base)
    renderAt('/auth/callback')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không đăng nhập được bằng Google')
    expect(localStorage.getItem('moc.session')).toBeNull()
    fireEvent.click(screen.getByRole('link', { name: /đăng nhập/i }))
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('Nút đăng xuất ở header', () => {
  it('chưa đăng nhập → không có .nav-logout', async () => {
    mockApi(base)
    renderAt('/')
    await screen.findAllByRole('link')
    expect(document.querySelector('.nav-logout')).toBeNull()
  })

  it('đã đăng nhập → hiện, bấm gọi /auth/logout và xoá phiên', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const fetchMock = mockApi({ ...base, 'POST /auth/logout': () => ({ status: 204 }) })
    renderAt('/')
    const btn = await waitFor(() => {
      const el = document.querySelector('.nav-logout')
      expect(el).not.toBeNull()
      return el
    })
    fireEvent.click(btn)
    await waitFor(() => expect(localStorage.getItem('moc.session')).toBeNull())
    expect(fetchMock.mock.calls.some(([u, i]) => String(u).includes('/auth/logout') && i.headers.Authorization === 'Bearer g1')).toBe(true)
    await waitFor(() => expect(document.querySelector('.nav-logout')).toBeNull())
  })
})
