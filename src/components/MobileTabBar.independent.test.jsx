// @vitest-environment jsdom
// Kiểm thử độc lập (T-11): thanh điều hướng đáy — a11y, ẩn theo route, SSR, CSS tĩnh, test cũ không phụ thuộc link đơn
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'
import { showsTabBar } from './tabbarRoutes.js'

const cart = (n) => ({ items: [], itemCount: n, subtotal: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 })
const base = (n = 0) => ({
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: cart(n) }),
  'GET /site': () => ({ body: { name: 'LAMVI' } }),
})
const bars = () => document.querySelectorAll('nav.tabbar')
const bar = () => bars()[0]
const root = process.cwd() + '/'
const css = readFileSync(join(root, 'src/styles/pages.css'), 'utf8')

beforeEach(() => localStorage.clear())

describe('a11y', () => {
  it('nav có nhãn, khác nhãn chuyển ngôn ngữ; liên kết có tên; aria-current chỉ ở mục hiện tại', async () => {
    mockApi(base())
    renderAt('/shop')
    await waitFor(() => expect(bar()).toBeTruthy())
    const label = bar().getAttribute('aria-label')
    expect(label).toBeTruthy()
    const others = [...document.querySelectorAll('nav')].filter((n) => n !== bar()).map((n) => n.getAttribute('aria-label'))
    expect(others).not.toContain(label) // nhãn phải phân biệt được giữa các landmark nav
    const links = [...bar().querySelectorAll('a')]
    for (const a of links) expect(a.textContent.trim().length).toBeGreaterThan(0)
    expect(bar().querySelectorAll('[aria-current]').length).toBe(1)
    expect(bar().querySelector('[aria-current]').getAttribute('href')).toBe('/shop')
  })

  it('badge giỏ: tên truy cập có số một lần, nhãn hiển thị aria-hidden', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'k@lamvi.test' } }))
    mockApi({ ...base(3), 'GET /me': () => ({ body: { profile: { id: 'u1', email: 'k@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'K' } } }) })
    renderAt('/')
    await waitFor(() => expect(bar().querySelector('.tabbar-badge')?.textContent).toBe('3'))
    const a = bar().querySelector('a[href="/cart"]')
    expect(a.getAttribute('aria-label')).toBe('Giỏ hàng (3)')
    expect(a.querySelector('.tabbar-icon').getAttribute('aria-hidden')).toBe('true')
    expect(a.querySelector('.tabbar-label').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByRole('link', { name: 'Giỏ hàng (3)' }).length).toBe(2) // header + tab bar
  })

  it('không badge: không aria-label thừa, nhãn không aria-hidden', async () => {
    mockApi(base(0))
    renderAt('/')
    await waitFor(() => expect(bar()).toBeTruthy())
    const a = bar().querySelector('a[href="/cart"]')
    expect(a.hasAttribute('aria-label')).toBe(false)
    expect(a.querySelector('.tabbar-label').hasAttribute('aria-hidden')).toBe(false)
    expect(a.querySelector('.tabbar-badge')).toBeNull()
  })

  it('/collections/* → mục Cửa hàng active', async () => {
    mockApi({ ...base(), 'GET /collections/den': () => ({ body: { item: { slug: 'den', name: 'Đèn', description: 'x', tone: 'amber', lamps: [], set: null } } }) })
    renderAt('/collections/den')
    await waitFor(() => expect(bar()).toBeTruthy())
    expect(bar().querySelector('[aria-current="page"]').getAttribute('href')).toBe('/shop')
  })

  it.each([
    ['/', ['/', '/shop', '/cart', '/account'], 'Trang chủ'],
    ['/en', ['/en', '/en/shop', '/en/cart', '/en/account'], 'Home'],
    ['/zh', ['/zh', '/zh/shop', '/zh/cart', '/zh/account'], null],
  ])('href theo ngôn ngữ %s', async (p, hrefs, home) => {
    mockApi(base())
    renderAt(p)
    await waitFor(() => expect(bar()).toBeTruthy())
    expect([...bar().querySelectorAll('a')].map((a) => a.getAttribute('href'))).toEqual(hrefs)
    expect(bar().querySelector('a').getAttribute('aria-current')).toBe('page')
    if (home) expect(bar().textContent).toContain(home)
    expect(bar().textContent).not.toMatch(/nav\.|cart\.nav/)
  })
})

describe('ẩn theo route', () => {
  it.each(['/cart', '/en/cart', '/zh/checkout', '/en/products/den-nguyet', '/en/login', '/login', '/register', '/account', '/en/account', '/khong-co-trang-nay', '/en/khong-co', '/admin', '/it'])(
    'không có thanh đáy ở %s',
    async (route) => {
      mockApi({ ...base(), 'GET /products/den-nguyet': () => ({ body: { item: productsVi.items[0] } }) })
      renderAt(route)
      await new Promise((r) => setTimeout(r, 150))
      expect(bars().length, route).toBe(0)
      expect(document.querySelector('.has-tabbar'), route).toBeNull()
    },
  )
  it.each(['/don-hang/LV1/', '/lo/X', '/cart/', '/checkout/'])('showsTabBar(%s) false', (p) => expect(showsTabBar(p)).toBe(false))
})

describe('SSR', () => {
  it('MobileTabBar.jsx không dùng API trình duyệt khi render', () => {
    const src = readFileSync(join(root, 'src/components/MobileTabBar.jsx'), 'utf8')
    expect(src).not.toMatch(/\b(window|document|localStorage|navigator|useEffect|useState)\b/)
  })
})

describe('CSS tĩnh', () => {
  const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
  it('.tabbar display:none ngoài media ≤640px', () => {
    const c = stripComments(css)
    const m = c.match(/(^|\n)\.tabbar\s*\{([^}]*)\}/)
    expect(m[2]).toMatch(/display:\s*none/)
    const i = c.indexOf('@media (max-width: 640px) {', c.indexOf('\n.tabbar {'))
    expect(c.slice(i, i + 400)).toMatch(/\.tabbar\s*\{[^}]*display:\s*grid/)
  })
  it('.tabbar không backdrop-filter; mọi khối position:fixed của tabbar đặc', () => {
    const block = stripComments(css).match(/\n\s*\.tabbar\s*\{[^}]*position:\s*fixed[^}]*\}/)[0]
    expect(block).not.toMatch(/backdrop-filter/)
    expect(block).toMatch(/background:\s*var\(--cream\)/)
  })
  it('z-index: tabbar 45 < sticky-buy 50 < consent/modal 60; .has-tabbar có padding-bottom', () => {
    const z = (sel) => Number(stripComments(css).match(new RegExp(`${sel.replace('.', '\\.')}\\s*\\{[^}]*z-index:\\s*(\\d+)`))?.[1])
    expect(z('.tabbar')).toBe(45)
    expect(z('.consent-banner')).toBeGreaterThan(45)
    expect(z('.mobile-menu-backdrop')).toBeGreaterThan(45)
    expect(css).toMatch(/\.page\.has-tabbar\s*\{[^}]*padding-bottom/)
    expect(css).toMatch(/\.page\.has-tabbar \.consent-banner\s*\{[^}]*bottom/)
  })
})

describe('test cũ không phụ thuộc link đơn "Giỏ hàng"/"Tài khoản"', () => {
  const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : /\.test\.jsx$/.test(f) ? [p] : [] })
  it('mọi getByRole("link", {name: Giỏ hàng|Tài khoản}) (số ít) đã được scope', () => {
    const bad = []
    for (const f of walk(join(root, 'src'))) {
      if (f.includes('independent') || f.includes('AccountDashboard')) continue  // /account không có thanh đáy
      readFileSync(f, 'utf8').split('\n').forEach((l, i) => {
        if (!l.includes('within(') && /getByRole\('link',\s*\{\s*name:\s*\/?'?\^?(Giỏ hàng|Tài khoản|Cart|Account)/.test(l)) bad.push(`${f}:${i + 1}: ${l.trim()}`)
      })
    }
    expect(bad).toEqual([])
  })
})
