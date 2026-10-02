// @vitest-environment jsdom
// Kiểm thử độc lập trang chi tiết sản phẩm v2 (T-53, D-87)
import fs from 'node:fs'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const MSG = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '', en: '/en', zh: '/zh' }
const LANGS = ['vi', 'en', 'zh']
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }

const mk = (slug, name, kind, extra = {}) => ({
  slug, kind, name, description: `Mô tả ${name}`, badge: null, tone: 'amber', price: 890000, currency: 'VND', image: null, ...extra,
})
const single = mk('den-a', 'Alpha Single', 'single', { tone: 'dawn' })
const set = mk('bo-b', 'Bravo Set', 'set', { badge: 'Mới', tone: 'jade', price: 1680000 })
const other = mk('den-c', 'Charlie Single', 'single')
const all = [single, set, other]

const present = (lines) => {
  const items = lines.map(({ slug, quantity }) => {
    const p = all.find((x) => x.slug === slug)
    return { slug, quantity, available: true, product: { name: p.name, tone: p.tone, price: p.price, image: null }, lineTotal: p.price * quantity }
  })
  return { items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0), itemCount: items.reduce((s, i) => s + i.quantity, 0), hasUnavailable: false, maxQuantity: 10, currency: 'VND' }
}
const handlers = (products = all, extra = {}) => ({
  'GET /products': () => ({ body: { items: products } }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /products/den-a': () => ({ body: { item: single } }),
  'GET /products/bo-b': () => ({ body: { item: set } }),
  'GET /products/den-c': () => ({ body: { item: other } }),
  'POST /cart/quote': (u, init) => ({ body: present(JSON.parse(init.body).items) }),
  ...extra,
})
const buy = () => document.querySelector('.pdp-buy')
const ld = () => [...document.head.querySelectorAll('script[type="application/ld+json"]')].map((s) => JSON.parse(s.textContent))

beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe.each(LANGS)('ProductPage v2 [%s]', (lang) => {
  const m = MSG[lang]
  const pre = PREFIX[lang]
  const at = (slug) => `${pre}/products/${slug}`

  it('bố cục: back-link, pdp-art, pdp-buy (eyebrow, h1, giá + VAT, mô tả, note, perks)', async () => {
    mockApi(handlers())
    renderAt(at('den-a'))
    expect(await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })).toBeInTheDocument()
    const back = document.querySelector('a.back-link')
    expect(back).toHaveAttribute('href', `${pre}/shop`)
    expect(back.textContent).toBe(m.products.backToCollection)
    expect(document.querySelector('.pdp-grid .pdp-art')).not.toBeNull()
    const b = within(buy())
    expect(buy().querySelector('.eyebrow').textContent).toContain(m.shop.filters.single)
    expect(buy().querySelector('.product-price').textContent).toMatch(/890\.000/)
    expect(buy().querySelector('.price-note').textContent).toBe(m.price.inclVat)
    expect(buy().querySelector('.pdp-desc').textContent).toBe('Mô tả Alpha Single')
    expect(b.getByRole('button', { name: m.cart.add })).toBeInTheDocument()
    expect(buy().querySelector('.qty')).not.toBeNull()
    expect(buy().querySelector('.pdp-note').textContent).toBe(m.pdp.checkoutNote)
    expect([...buy().querySelectorAll('.pdp-perks li')].map((l) => l.textContent)).toEqual(m.shop.perks)
  })

  it('nhãn loại: set dùng products.setBadge, single dùng shop.filters.single', async () => {
    mockApi(handlers())
    renderAt(at('bo-b'))
    await screen.findByRole('heading', { level: 1, name: 'Bravo Set' })
    expect(buy().querySelector('.eyebrow').textContent).toContain(m.products.setBadge)
    expect(buy().querySelector('.eyebrow').textContent).not.toContain(m.shop.filters.single)
  })

  it('tone class + con dấu badge chỉ khi có badge', async () => {
    mockApi(handlers())
    const { unmount } = renderAt(at('bo-b'))
    await screen.findByRole('heading', { level: 1, name: 'Bravo Set' })
    const art = document.querySelector('.pdp-art')
    expect(art.classList.contains('tone-jade')).toBe(true)
    expect(art.querySelector('.product-badge').textContent).toBe('Mới')
    unmount()
    mockApi(handlers())
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    expect(document.querySelector('.pdp-art').classList.contains('tone-dawn')).toBe(true)
    expect(document.querySelector('.pdp-art .product-badge')).toBeNull()
  })

  it('số lượng 3 rồi thêm → PUT quantity 3 (nút trong .pdp-buy)', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const puts = []
    mockApi(handlers(all, {
      'GET /cart': () => ({ body: present([]) }),
      'PUT /cart/items/den-a': (u, init) => {
        puts.push(JSON.parse(init.body))
        return { body: present([{ slug: 'den-a', quantity: JSON.parse(init.body).quantity }]) }
      },
    }))
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    fireEvent.change(within(buy()).getByRole('spinbutton'), { target: { value: '3' } })
    fireEvent.click(within(buy()).getByRole('button', { name: m.cart.add }))
    await waitFor(() => expect(puts).toEqual([{ quantity: 3 }]))
  })

  it('thêm vào giỏ từ nút chính → tooltip .cart-bubble trong header có tên sản phẩm', async () => {
    mockApi(handlers())
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    fireEvent.click(within(buy()).getByRole('button', { name: m.cart.add }))
    await waitFor(() => expect(document.querySelector('header.nav .cart-bubble')).not.toBeNull())
    expect(document.querySelector('header.nav .cart-bubble').textContent).toContain('“Alpha Single”')
  })

  it('Related: loại sản phẩm hiện tại, link giữ tiền tố ngôn ngữ, Xem tất cả → /shop', async () => {
    mockApi(handlers())
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    const rel = await waitFor(() => {
      const el = document.querySelector('.pdp-related')
      expect(el).not.toBeNull()
      return el
    })
    expect(rel.getAttribute('aria-labelledby')).toBe('pdp-related-title')
    expect(rel.querySelector('#pdp-related-title').textContent).toBe(m.pdp.related)
    const names = [...rel.querySelectorAll('.product-card h3')].map((h) => h.textContent)
    expect(names).toEqual(['Bravo Set', 'Charlie Single'])
    const hrefs = [...rel.querySelectorAll('.product-card a')].map((a) => a.getAttribute('href')).filter((h) => h.includes('/products/'))
    expect(hrefs.length).toBeGreaterThan(0)
    hrefs.forEach((h) => expect(h.startsWith(`${pre}/products/`)).toBe(true))
    expect(hrefs.some((h) => h.endsWith('/den-a'))).toBe(false)
    const all_ = within(rel).getByRole('link', { name: new RegExp(`^${m.pdp.viewAll}`) })
    expect(all_).toHaveAttribute('href', `${pre}/shop`)
  })

  it('catalog chỉ có 1 sản phẩm → không có khối Related', async () => {
    mockApi(handlers([single]))
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    await new Promise((r) => setTimeout(r, 50))
    expect(document.querySelector('.pdp-related')).toBeNull()
    expect(document.getElementById('pdp-related-title')).toBeNull()
  })

  it('404: tiêu đề không tìm thấy + back-link, không có Related/pdp-buy', async () => {
    mockApi(handlers(all, { 'GET /products/nope': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) }))
    renderAt(at('nope'))
    expect(await screen.findByRole('heading', { level: 1, name: m.products.notFound })).toBeInTheDocument()
    expect(document.querySelector('a.back-link')).toHaveAttribute('href', `${pre}/shop`)
    expect(document.querySelector('.pdp-related')).toBeNull()
    expect(buy()).toBeNull()
  })

  it('lỗi API 500: hiện thông báo lỗi, không phải not-found', async () => {
    mockApi(handlers(all, { 'GET /products/den-a': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }))
    renderAt(at('den-a'))
    expect(await screen.findByRole('heading', { level: 1, name: m.products.error })).toBeInTheDocument()
    expect(screen.queryByText(m.products.notFound)).toBeNull()
    expect(document.querySelector('.pdp-related')).toBeNull()
  })

  it('đang tải: hiện chữ loading, chưa có pdp-grid', async () => {
    mockApi(handlers(all, { 'GET /products/den-a': () => new Promise(() => {}) }))
    renderAt(at('den-a'))
    expect(await screen.findByText(m.products.loading)).toBeInTheDocument()
    expect(document.querySelector('.pdp-grid')).toBeNull()
  })

  it('JSON-LD: Product + BreadcrumbList 3 cấp, Cửa hàng → /shop (có tiền tố ngôn ngữ)', async () => {
    mockApi(handlers())
    renderAt(at('den-a'))
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    await waitFor(() => expect(ld().some((j) => j['@type'] === 'BreadcrumbList')).toBe(true))
    const docs = ld()
    expect(docs.some((j) => j['@type'] === 'Product')).toBe(true)
    const bc = docs.find((j) => j['@type'] === 'BreadcrumbList')
    expect(bc.itemListElement).toHaveLength(3)
    expect(bc.itemListElement.map((i) => i.position)).toEqual([1, 2, 3])
    expect(bc.itemListElement.map((i) => i.name)).toEqual([m.nav.home, m.nav.shop, 'Alpha Single'])
    expect(new URL(bc.itemListElement[1].item).pathname).toBe(`${pre}/shop`)
    expect(new URL(bc.itemListElement[2].item).pathname).toBe(`${pre}/products/den-a`)
  })
})

describe('CSS T-53', () => {
  const dir = path.resolve(__dirname, '../styles')
  const css = fs.readdirSync(dir).filter((f) => f.endsWith('.css')).map((f) => [f, fs.readFileSync(path.join(dir, f), 'utf8')])
  it('đã gỡ product-detail-grid/art/desc', () => {
    for (const [f, text] of css) {
      for (const cls of ['product-detail-grid', 'product-detail-art', 'product-detail-desc']) {
        expect(text.includes(cls), `${f} còn ${cls}`).toBe(false)
      }
    }
  })
  it('pages.css định nghĩa .pdp-grid và .pdp-buy', () => {
    const pages = css.find(([f]) => f === 'pages.css')[1]
    expect(pages).toMatch(/\.pdp-grid\s*[{,]/)
    expect(pages).toMatch(/\.pdp-buy\s*[{,]/)
  })
})
