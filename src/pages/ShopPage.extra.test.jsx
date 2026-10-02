// @vitest-environment jsdom
// Kiểm thử độc lập trang Cửa hàng /shop (T-50, D-86)
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import enMsg from '../i18n/messages/en.js'
import zhMsg from '../i18n/messages/zh.js'

const MSG = { vi: viMsg, en: enMsg, zh: zhMsg }
const PREFIX = { vi: '', en: '/en', zh: '/zh' }

const mk = (slug, name, kind, price) => ({ slug, kind, name, description: `d ${name}`, badge: null, tone: 'amber', price, currency: 'VND' })
const items = [
  mk('b-set', 'Bravo Set', 'set', 2000000),
  mk('a-single', 'Alpha Single', 'single', 900000),
  mk('c-set', 'Charlie Set', 'set', 1500000),
  mk('d-single', 'Delta Single', 'single', 500000),
]
const only = (kind) => ({ items: items.filter((i) => i.kind === kind) })
const base = (body = { items }) => ({ 'GET /products': () => ({ body }), 'GET /faq': () => ({ body: { items: [] } }) })
const names = () => [...document.querySelectorAll('.product-card h3')].map((h) => h.textContent)
const count = () => document.querySelector('.shop-count')
const filterBtns = () => [...document.querySelectorAll('.shop-filters button')]
const btn = (name) => filterBtns().find((b) => b.textContent === name)

beforeEach(() => localStorage.setItem('moc.tour.done', '1'))
afterEach(() => {
  window.scrollY = 0
})

describe('ShopPage — lọc, sắp xếp, đếm', () => {
  it('lọc Bộ đèn chỉ còn set, cập nhật số đếm + aria-pressed; về Tất cả khôi phục', async () => {
    mockApi(base())
    renderAt('/shop')
    await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
    expect(names()).toHaveLength(4)
    expect(count().textContent).toBe('4 sản phẩm')
    expect(btn('Tất cả')).toHaveAttribute('aria-pressed', 'true')
    expect(btn('Bộ đèn')).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(btn('Bộ đèn'))
    await waitFor(() => expect(names()).toEqual(['Bravo Set', 'Charlie Set']))
    expect(count().textContent).toBe('2 sản phẩm')
    expect(btn('Bộ đèn')).toHaveAttribute('aria-pressed', 'true')
    expect(btn('Tất cả')).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(btn('Đèn lẻ'))
    await waitFor(() => expect(names()).toEqual(['Alpha Single', 'Delta Single']))

    fireEvent.click(btn('Tất cả'))
    await waitFor(() => expect(names()).toHaveLength(4))
    expect(count().textContent).toBe('4 sản phẩm')
    expect(btn('Tất cả')).toHaveAttribute('aria-pressed', 'true')
  })

  it('loại vắng mặt trong dữ liệu thì không có nút lọc', async () => {
    mockApi(base(only('single')))
    renderAt('/shop')
    await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
    expect(filterBtns().map((b) => b.textContent)).toEqual(['Tất cả', 'Đèn lẻ'])
    expect(btn('Bộ đèn')).toBeUndefined()
  })

  it('sắp xếp giá tăng/giảm/tên đúng thứ tự; featured giữ thứ tự gốc', async () => {
    mockApi(base())
    renderAt('/shop')
    await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
    const select = document.querySelector('.shop-sort select')
    expect(names()).toEqual(['Bravo Set', 'Alpha Single', 'Charlie Set', 'Delta Single'])
    fireEvent.change(select, { target: { value: 'priceAsc' } })
    await waitFor(() => expect(names()).toEqual(['Delta Single', 'Alpha Single', 'Charlie Set', 'Bravo Set']))
    fireEvent.change(select, { target: { value: 'priceDesc' } })
    await waitFor(() => expect(names()).toEqual(['Bravo Set', 'Charlie Set', 'Alpha Single', 'Delta Single']))
    fireEvent.change(select, { target: { value: 'name' } })
    await waitFor(() => expect(names()).toEqual(['Alpha Single', 'Bravo Set', 'Charlie Set', 'Delta Single']))
    // sắp xếp kết hợp lọc
    fireEvent.click(btn('Bộ đèn'))
    fireEvent.change(select, { target: { value: 'priceAsc' } })
    await waitFor(() => expect(names()).toEqual(['Charlie Set', 'Bravo Set']))
    fireEvent.change(select, { target: { value: 'featured' } })
    await waitFor(() => expect(names()).toEqual(['Bravo Set', 'Charlie Set']))
  })

  it('danh sách rỗng → products.empty, số đếm 0, chỉ nút Tất cả', async () => {
    mockApi(base({ items: [] }))
    renderAt('/shop')
    expect(await screen.findByText(viMsg.products.empty)).toBeInTheDocument()
    expect(names()).toEqual([])
    expect(count().textContent).toBe('0 sản phẩm')
    expect(filterBtns()).toHaveLength(1)
  })

  it('lọc tới loại không còn kết quả không xảy ra; API lỗi → role=alert', async () => {
    mockApi({ ...base(), 'GET /products': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/shop')
    expect(await screen.findByRole('alert')).toHaveTextContent(viMsg.products.error)
    expect(count()).toBeNull()
    expect(names()).toEqual([])
  })

  it('thêm vào giỏ từ thẻ ở /shop → tooltip hiện trên navbar', async () => {
    mockApi({
      ...base(),
      'POST /cart/quote': (u, init) => {
        const lines = JSON.parse(init.body).items
        const its = lines.map(({ slug, quantity }) => {
          const p = items.find((i) => i.slug === slug)
          return { slug, quantity, available: true, product: { name: p.name, tone: 'amber', price: p.price, image: null }, lineTotal: p.price * quantity }
        })
        return { body: { items: its, subtotal: its.reduce((s, i) => s + i.lineTotal, 0), itemCount: its.reduce((s, i) => s + i.quantity, 0), hasUnavailable: false, maxQuantity: 10, currency: 'VND' } }
      },
    })
    renderAt('/shop')
    const card = (await screen.findByText('Alpha Single', { selector: '.product-card a' })).closest('.product-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Thêm vào giỏ' }))
    const header = document.querySelector('header.nav')
    await waitFor(() => expect(header.querySelector('.cart-bubble')).not.toBeNull())
    expect(header.querySelector('.cart-bubble')).toHaveTextContent('Alpha Single')
  })
})

describe.each(['vi', 'en', 'zh'])('liên kết và nhãn (%s)', (lang) => {
  const p = PREFIX[lang]
  it('/shop: link sản phẩm, navbar, bộ lọc có tiền tố ngôn ngữ; hash faq ở chân trang', async () => {
    mockApi(base())
    renderAt(`${p}/shop`)
    await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
    expect(document.querySelector('.product-card h3 a').getAttribute('href')).toBe(`${p}/products/b-set`)
    const nav = document.querySelector('header.nav')
    expect(nav.querySelector('a.nav-cta').getAttribute('href')).toBe(`${p}/shop`)
    const shopLink = [...nav.querySelectorAll('.nav-links a')].find((a) => a.textContent === MSG[lang].nav.shop)
    expect(shopLink.getAttribute('href')).toBe(`${p}/shop`)
    expect(nav.querySelector('.nav-links a[href$="#products"]')).toBeNull()
    expect(document.querySelector('.shop-foot a').getAttribute('href')).toBe(lang === 'vi' ? '/#faq' : `${p}#faq`)
    expect(btn(MSG[lang].shop.filters.set)).toBeTruthy()
    expect(count().textContent).toBe(MSG[lang].shop.count.replace('{n}', '4'))
    expect(document.querySelector('h1').textContent).toBe(MSG[lang].shop.title)
  })

  it('trang chủ: "Xem thêm" và nút hero explore → /shop; không còn #products', async () => {
    mockApi(base())
    renderAt(p || '/')
    await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
    expect(document.querySelector('.products-more a').getAttribute('href')).toBe(`${p}/shop`)
    expect(document.querySelector('.products-more a').textContent).toContain(MSG[lang].products.viewAll)
    const explore = [...document.querySelectorAll('a.btn-primary')].find((a) => a.textContent.includes(MSG[lang].hero.explore))
    expect(explore.getAttribute('href')).toBe(`${p}/shop`)
  })

  it('trang sản phẩm: back-link → /shop', async () => {
    mockApi({ ...base(), 'GET /products/a-single': () => ({ body: { item: items[1] } }) })
    renderAt(`${p}/products/a-single`)
    await screen.findByRole('heading', { level: 1, name: 'Alpha Single' })
    expect(document.querySelector('a.back-link').getAttribute('href')).toBe(`${p}/shop`)
  })

  it('giỏ trống: CTA và liên kết tiếp tục → /shop', async () => {
    mockApi({ ...base(), 'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10, currency: 'VND' } }) })
    renderAt(`${p}/cart`)
    await waitFor(() => expect(document.querySelector('.cart-empty a.btn-primary')).not.toBeNull())
    expect(document.querySelector('.cart-empty a.btn-primary').getAttribute('href')).toBe(`${p}/shop`)
  })
})

describe('Navbar cuộn (D-86)', () => {
  it('is-scrolled bật khi scrollY>12, tắt khi về đầu; không bao giờ is-hidden (kể cả ở /shop)', async () => {
    Object.defineProperty(document, 'scrollingElement', { value: document.documentElement, configurable: true })
    try {
      mockApi(base())
      renderAt('/shop')
      await screen.findAllByText('Alpha Single', { selector: '.product-card a' })
      const header = document.querySelector('header.nav')
      const scrollTo = async (y) => {
        window.scrollY = y
        window.pageYOffset = y
        document.documentElement.scrollTop = y
        await act(async () => {
          window.dispatchEvent(new Event('scroll'))
          await new Promise((r) => setTimeout(r, 50))
        })
      }
      expect(header).not.toHaveClass('is-scrolled')
      await scrollTo(5)
      expect(header).not.toHaveClass('is-scrolled')
      await scrollTo(200)
      await waitFor(() => expect(header).toHaveClass('is-scrolled'))
      expect(header).not.toHaveClass('is-hidden')
      await scrollTo(900)
      await scrollTo(300)
      expect(header).not.toHaveClass('is-hidden')
      expect(header).toHaveClass('is-scrolled')
      await scrollTo(0)
      await waitFor(() => expect(header).not.toHaveClass('is-scrolled'))
      expect(header).not.toHaveClass('is-hidden')
    } finally {
      delete document.scrollingElement
    }
  })
})
