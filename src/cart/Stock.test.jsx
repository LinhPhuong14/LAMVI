// @vitest-environment jsdom
// G-44, D-100: tồn kho trên giao diện
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const lamp = (slug, name, extra = {}) => ({ slug, name, kind: 'single', description: `Mô tả ${name}`, price: 800000, currency: 'VND', tone: 'amber', badge: null, image: null, collection: null, pieceOrder: 0, inStock: true, stockLeft: null, ...extra })
const items = [lamp('den-het', 'Đèn Hết', { inStock: false }), lamp('den-sap', 'Đèn Sắp Hết', { stockLeft: 2 }), lamp('den-du', 'Đèn Đủ')]

const cartBody = (over = {}) => ({
  items: [{ slug: 'den-sap', quantity: 3, available: true, inStock: false, stockLeft: 2, product: { name: 'Đèn Sắp Hết', price: 800000, image: null, tone: 'amber' }, lineTotal: 2400000 }],
  subtotal: 2400000, currency: 'VND', itemCount: 3, hasUnavailable: false, hasShortage: true, maxQuantity: 10, ...over,
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Thẻ sản phẩm', () => {
  it('hết hàng → nút khoá "Tạm hết hàng"; sắp hết → "Chỉ còn 2"; còn hàng → Thêm vào giỏ', async () => {
    mockApi({ 'GET /products': () => ({ body: { items } }), 'GET /collections': () => ({ body: { items: [] } }), 'GET /cart': () => ({ body: { items: [], subtotal: 0, itemCount: 0, maxQuantity: 10 } }) })
    renderAt('/shop')
    const shop = within(await (async () => { await screen.findAllByText('Đèn Hết'); return document.querySelector('.shop') })())
    const cards = shop.getAllByRole('heading', { level: 3 }).map((h) => h.closest('.product-card'))
    const byName = (n) => cards.find((c) => c.textContent.includes(n))
    expect(within(byName('Đèn Hết')).getByRole('button', { name: 'Tạm hết hàng' })).toBeDisabled()
    expect(within(byName('Đèn Sắp Hết')).getByText('Chỉ còn 2')).toBeTruthy()
    expect(within(byName('Đèn Sắp Hết')).getByRole('button', { name: 'Thêm vào giỏ' })).toBeEnabled()
    expect(within(byName('Đèn Đủ')).queryByText(/Chỉ còn/)).toBeNull()
  })
})

describe('Giỏ hàng', () => {
  it('thiếu hàng → cảnh báo, dòng báo "Chỉ còn 2", nút thanh toán khoá', async () => {
    mockApi({ 'GET /products': () => ({ body: { items } }), 'GET /cart': () => ({ body: cartBody() }), 'GET /me': () => ({ body: { profile: { id: 'u1', email: 'an@example.com', fullName: 'An', preferredLocale: 'vi', role: 'customer' } } }), 'GET /may/history': () => ({ body: { items: [] } }) })
    renderAt('/cart')
    expect(await screen.findByText(/Có sản phẩm không đủ hàng/)).toBeTruthy()
    expect(screen.getByText('Chỉ còn 2 — hãy giảm số lượng')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Thanh toán|Đặt hàng|checkout/i })).toBeDisabled()
  })
})
