// @vitest-environment jsdom
// Thanh điều hướng đáy trên điện thoại (UX) — hiện ở trang công khai, ẩn ở trang có thanh riêng/auth/dashboard
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'
import { showsTabBar } from './tabbarRoutes.js'

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: { items: [], itemCount: 3, subtotal: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
  'GET /site': () => ({ body: { name: 'LAMVI' } }),
}
const bar = () => document.querySelector('nav.tabbar')

beforeEach(() => localStorage.clear())

describe('showsTabBar', () => {
  it.each([['/', true], ['/shop', true], ['/contact', true], ['/collections/x', true], ['/returns', true], ['/products/den-a', false], ['/cart', false], ['/cart/', false], ['/checkout', false], ['/don-hang/LV1', false], ['/lo/ABC', false]])(
    '%s → %s',
    (rest, expected) => expect(showsTabBar(rest)).toBe(expected),
  )
})

describe('MobileTabBar', () => {
  it('trang chủ: 4 mục Trang chủ/Cửa hàng/Giỏ hàng/Tài khoản, mục hiện tại có aria-current, giỏ có số lượng', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'k@lamvi.test' } }))
    mockApi({ ...base, 'GET /me': () => ({ body: { profile: { id: 'u1', email: 'k@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'K' } } }) })
    renderAt('/')
    await waitFor(() => expect(bar()).toBeTruthy())
    const links = [...bar().querySelectorAll('a')]
    expect(links.map((a) => a.getAttribute('href'))).toEqual(['/', '/shop', '/cart', '/account'])
    expect(links[0].getAttribute('aria-current')).toBe('page')
    expect(links.slice(1).every((a) => !a.hasAttribute('aria-current'))).toBe(true)
    expect(bar().textContent).toContain('Trang chủ')
    expect(bar().textContent).toContain('Cửa hàng')
    await waitFor(() => expect(bar().querySelector('.tabbar-badge')?.textContent).toBe('3'))
    // trang có thanh đáy → .page.has-tabbar để chừa chỗ
    expect(document.querySelector('.page.has-tabbar')).toBeTruthy()
  })

  it('theo ngôn ngữ: /en dùng đường dẫn và nhãn tiếng Anh', async () => {
    mockApi(base)
    renderAt('/en/shop')
    await waitFor(() => expect(bar()).toBeTruthy())
    expect([...bar().querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(['/en', '/en/shop', '/en/cart', '/en/account'])
    expect(bar().querySelector('a[aria-current="page"]').getAttribute('href')).toBe('/en/shop')
  })

  it.each(['/cart', '/checkout', '/login', '/products/den-nguyet'])('ẩn ở %s', async (route) => {
    mockApi({ ...base, 'GET /products/den-nguyet': () => ({ body: { item: productsVi.items[0] } }) })
    renderAt(route)
    await screen.findByRole('banner')
    expect(bar()).toBeNull()
    expect(document.querySelector('.page.has-tabbar')).toBeNull()
  })
})
