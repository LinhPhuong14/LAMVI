// @vitest-environment jsdom
// Feedback 08/10: 7.5 (thanh Đặt hàng mobile, ẩn Mây ở cart/checkout), 9 (thanh mua cố định trang sản phẩm)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }
const profile = { id: 'u1', email: 'khach@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'A' }
const den = { slug: 'den-a', kind: 'single', name: 'Đèn A', description: 'Mô tả', badge: null, tone: 'amber', price: 890000, currency: 'VND', image: null }
const emptyCart = { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const quote = {
  items: [{ slug: 'den-a', name: 'Đèn A', image: null, unitPrice: 890000, quantity: 1, lineTotal: 890000 }],
  subtotal: 890000, discount: 0, shippingFee: 30000, freeShipping: false, total: 920000, vatAmount: 83636, vatRate: 0.1,
  currency: 'VND', couponCode: null, couponError: null, hasUnavailable: false, freeShippingFrom: 1000000,
}
const api = () =>
  mockApi({
    'GET /me': () => ({ body: { profile } }),
    'GET /cart': () => ({ body: emptyCart }),
    'GET /products': () => ({ body: { items: [den] } }),
    'GET /products/den-a': () => ({ body: { item: den } }),
    'GET /faq': () => ({ body: { items: [] } }),
    'GET /shipping-policy': () => ({ body: { fee: 30000, freeFrom: 1000000 } }),
    'POST /cart/quote': () => ({ body: emptyCart }),
    'POST /checkout/quote': () => ({ body: quote }),
    'GET /geo/provinces': () => ({ body: { items: [] } }),
    'GET /may/history': () => ({ body: { items: [] } }),
  })

let observers = []
beforeEach(() => {
  localStorage.setItem('moc.tour.done', '1')
  observers = []
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb) { this.cb = cb; observers.push(this) }
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => vi.unstubAllGlobals())

describe('Thanh mua cố định trang sản phẩm', () => {
  it('ẩn khi nút chính còn thấy, hiện khi nút chính ra khỏi màn hình', async () => {
    api()
    renderAt('/products/den-a')
    await screen.findByRole('heading', { level: 1, name: 'Đèn A' })
    expect(document.querySelector('.sticky-buy')).toBeNull()
    act(() => observers.forEach((o) => o.cb([{ isIntersecting: false, boundingClientRect: { top: 100 } }])))
    await waitFor(() => expect(document.querySelector('.sticky-buy')).not.toBeNull())
    expect(document.querySelector('.sticky-buy').textContent).toContain('Đèn A')
    act(() => observers.forEach((o) => o.cb([{ isIntersecting: true, boundingClientRect: { top: 100 } }])))
    await waitFor(() => expect(document.querySelector('.sticky-buy')).toBeNull())
  })
})

describe('Nút Mây nổi', () => {
  it('ẩn ở /cart và /checkout, vẫn có ở trang khác', async () => {
    api()
    const a = renderAt('/products/den-a')
    await screen.findByRole('button', { name: 'Trò chuyện với Mây' })
    a.unmount()
    localStorage.setItem('moc.session', JSON.stringify(session))
    const c = renderAt('/cart')
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByRole('button', { name: 'Trò chuyện với Mây' })).toBeNull()
    c.unmount()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    expect(screen.queryByRole('button', { name: 'Trò chuyện với Mây' })).toBeNull()
  })
})

describe('Thanh Đặt hàng cố định trên mobile', () => {
  it('có tổng tiền và nút đặt hàng (ẩn khỏi trình đọc màn hình, dùng form id)', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    const bar = document.querySelector('.checkout-bar')
    expect(bar).not.toBeNull()
    expect(bar.getAttribute('aria-hidden')).toBe('true')
    expect(bar.textContent).toContain('920.000')
    expect(bar.querySelector('button').getAttribute('form')).toBe('checkout-form')
    expect(document.getElementById('checkout-form')).not.toBeNull()
  })
})
