// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const PRICES = { 'den-nguyet': 890000, 'den-sum-vay': 1680000 }
const NAMES = { 'den-nguyet': 'Đèn Nguyệt', 'den-sum-vay': 'Đèn Sum Vầy' }
function present(lines) {
  const items = lines.map(({ slug, quantity }) => ({
    slug, quantity, available: true,
    product: { name: NAMES[slug], tone: 'amber', price: PRICES[slug], image: null },
    lineTotal: PRICES[slug] * quantity,
  }))
  return { items, subtotal: items.reduce((s, i) => s + i.lineTotal, 0), itemCount: items.reduce((s, i) => s + i.quantity, 0), hasUnavailable: false, maxQuantity: 10, currency: 'VND' }
}
const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'POST /cart/quote': (url, init) => ({ body: present(JSON.parse(init.body).items) }),
}
const header = () => document.querySelector('header.nav')
const bubble = () => within(header()).queryByRole('status')
const cardOf = async (name) => (await screen.findByText(name, { selector: '.product-card a' })).closest('.product-card')
const addTo = async (name) => fireEvent.click(within(await cardOf(name)).getByRole('button', { name: 'Thêm vào giỏ' }))

beforeEach(() => localStorage.setItem('moc.tour.done', '1'))
afterEach(() => vi.useRealTimers())

describe('CartBubble — tooltip dưới nút Giỏ hàng (D-83)', () => {
  it('hiện tên món, số món, tạm tính; huy hiệu aria-hidden, link có aria-label; thẻ không còn link /cart', async () => {
    mockApi(base)
    renderAt('/')
    await addTo('Đèn Nguyệt')
    await waitFor(() => expect(bubble()).not.toBeNull())
    expect(bubble().textContent).toContain('“Đèn Nguyệt”')
    expect(bubble().textContent).toMatch(/Giỏ có 1 món/)
    expect(bubble().textContent).toMatch(/890\.000/)
    const link = within(header()).getByRole('link', { name: 'Giỏ hàng (1)' })
    const badge = link.querySelector('.nav-cart-badge')
    expect(badge.textContent).toBe('1')
    expect(badge).toHaveAttribute('aria-hidden', 'true')
    expect(header().className).not.toContain('is-hidden')
    const card = await cardOf('Đèn Nguyệt')
    expect(card.querySelector('a[href="/cart"]')).toBeNull()
  })

  it('thêm món thứ hai → vẫn một tooltip, nội dung cập nhật', async () => {
    mockApi(base)
    renderAt('/')
    await addTo('Đèn Nguyệt')
    await waitFor(() => expect(bubble()).not.toBeNull())
    await addTo('Đèn Sum Vầy')
    await waitFor(() => expect(bubble().textContent).toContain('“Đèn Sum Vầy”'))
    expect(screen.getAllByRole('status').filter((n) => n.classList.contains('cart-bubble'))).toHaveLength(1)
    expect(bubble().textContent).toMatch(/Giỏ có 2 món/)
    expect(bubble().textContent).toMatch(/2\.570\.000/)
  })

  it('"Xem giỏ hàng" → /cart và đóng; trên /en có tiền tố ngôn ngữ', async () => {
    mockApi(base)
    renderAt('/en')
    fireEvent.click(within(await cardOf('Nguyet Lantern').catch(() => cardOf('Đèn Nguyệt'))).getByRole('button', { name: /Add to cart/ }))
    await waitFor(() => expect(bubble()).not.toBeNull())
    const link = within(bubble()).getByRole('link')
    expect(link).toHaveAttribute('href', '/en/cart')
    fireEvent.click(link)
    await waitFor(() => expect(bubble()).toBeNull())
  })

  it.each([
    ['nút đóng', () => fireEvent.click(within(header()).getByRole('button', { name: 'Đóng thông báo' }))],
    ['Xem thêm đèn', () => fireEvent.click(within(header()).getByRole('button', { name: 'Xem thêm đèn' }))],
    ['Escape', () => fireEvent.keyDown(window, { key: 'Escape' })],
  ])('%s đóng tooltip', async (_n, act1) => {
    mockApi(base)
    renderAt('/')
    await addTo('Đèn Nguyệt')
    await waitFor(() => expect(bubble()).not.toBeNull())
    act1()
    await waitFor(() => expect(bubble()).toBeNull())
  })

  it('"Xem giỏ hàng" trong tooltip dẫn tới trang giỏ (vi)', async () => {
    mockApi(base)
    renderAt('/')
    await addTo('Đèn Nguyệt')
    await waitFor(() => expect(bubble()).not.toBeNull())
    fireEvent.click(within(bubble()).getByRole('link', { name: 'Xem giỏ hàng' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Giỏ hàng' })).toBeInTheDocument()
  })

  it('tự đóng sau ~6s; rê chuột thì dừng đếm', async () => {
    mockApi(base)
    renderAt('/')
    await addTo('Đèn Nguyệt')
    await waitFor(() => expect(bubble()).not.toBeNull())
    vi.useFakeTimers({ shouldAdvanceTime: false })
    // timer đã đặt bằng setTimeout thật → đặt lại bằng cách rê chuột ra/vào để effect chạy lại dưới fake timers
    fireEvent.mouseEnter(bubble())
    fireEvent.mouseLeave(bubble())
    await act(() => vi.advanceTimersByTimeAsync(5500))
    expect(bubble()).not.toBeNull()
    fireEvent.mouseEnter(bubble())
    await act(() => vi.advanceTimersByTimeAsync(20000))
    expect(bubble()).not.toBeNull()
    fireEvent.mouseLeave(bubble())
    await act(() => vi.advanceTimersByTimeAsync(6100))
    expect(bubble()).toBeNull()
  })

  it('thêm lỗi (PUT 409) → không tooltip, báo lỗi tại thẻ', async () => {
    localStorage.setItem('moc.session', JSON.stringify({ accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }))
    mockApi({
      ...base,
      'GET /cart': () => ({ body: present([]) }),
      'PUT /cart/items/den-nguyet': () => ({ status: 409, body: { error: { code: 'PRODUCT_UNAVAILABLE' } } }),
    })
    renderAt('/')
    await addTo('Đèn Nguyệt')
    const card = await cardOf('Đèn Nguyệt')
    expect(await within(card).findByText('Sản phẩm này hiện không còn bán.')).toBeInTheDocument()
    expect(bubble()).toBeNull()
  })
})
