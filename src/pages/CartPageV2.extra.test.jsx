// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
const cartOf = (hide = false) => ({
  items: [
    { slug: 'den-nguyet', quantity: 2, available: true, product: { name: 'Đèn Nguyệt', tone: 'amber', price: 890000, image: null }, lineTotal: 1780000 },
    ...(hide ? [{ slug: 'den-sum-vay', quantity: 1, available: false, product: { name: 'Đèn Sum Vầy', tone: 'dawn', price: null, image: null }, lineTotal: null }] : []),
  ],
  subtotal: 1780000, itemCount: 2, hasUnavailable: hide, maxQuantity: 10, currency: 'VND',
})
const base = { 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) }
beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe('CartPage v2', () => {
  it('trống → empty state + CTA về #products', async () => {
    mockApi({ ...base, 'POST /cart/quote': () => ({ body: { ...cartOf(), items: [], subtotal: 0, itemCount: 0 } }) })
    renderAt('/cart')
    expect(await screen.findByText('Giỏ hàng đang trống.')).toBeInTheDocument()
    const cta = document.querySelector('.cart-empty a.btn-primary')
    expect(cta.getAttribute('href')).toBe('/#products')
    expect(document.querySelector('.cart-steps')).toBeNull()
  })

  it('3 bước, bước đầu aria-current; tổng khớp; đổi số lượng + xoá gọi API; đăng nhập → /checkout', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const calls = []
    mockApi({
      ...base,
      'GET /cart': () => ({ body: cartOf() }),
      'PUT /cart/items/den-nguyet': (u, init) => (calls.push(['PUT', JSON.parse(init.body)]), { body: cartOf() }),
      'DELETE /cart/items/den-nguyet': () => (calls.push(['DELETE']), { body: { ...cartOf(), items: [], subtotal: 0, itemCount: 0 } }),
      'GET /checkout/config': () => ({ body: {} }),
    })
    renderAt('/cart')
    await screen.findByText('Đèn Nguyệt', { selector: 'strong' })
    const steps = document.querySelectorAll('.cart-steps li')
    expect(steps).toHaveLength(3)
    expect(steps[0]).toHaveAttribute('aria-current', 'step')
    expect(steps[1]).not.toHaveAttribute('aria-current')
    const summary = document.querySelector('.cart-summary')
    expect(within(summary).getByText(/1\.780\.000/)).toBeInTheDocument()
    const line = screen.getByText('Đèn Nguyệt', { selector: 'strong' }).closest('li')
    fireEvent.click(within(line).getByRole('button', { name: 'Tăng số lượng' }))
    await waitFor(() => expect(calls).toContainEqual(['PUT', { quantity: 3 }]))
    fireEvent.click(within(line).getByRole('button', { name: 'Xoá' }))
    await waitFor(() => expect(calls).toContainEqual(['DELETE']))
  })

  it('đã đăng nhập bấm Thanh toán → /checkout', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /cart': () => ({ body: cartOf() }) })
    renderAt('/cart')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }))
    await waitFor(() => expect(document.querySelector('.cart-summary')).toBeNull())
  })

  it('khách bấm Thanh toán → /login?next=/cart', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }]))
    mockApi({ ...base, 'POST /cart/quote': () => ({ body: cartOf() }) })
    renderAt('/cart')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }))
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('có món không còn bán → cảnh báo', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({ ...base, 'GET /cart': () => ({ body: cartOf(true) }) })
    renderAt('/cart')
    expect(await screen.findByText(/Giỏ có sản phẩm không còn bán/)).toBeInTheDocument()
    expect(screen.getByText('Sản phẩm này hiện không còn bán — vui lòng xoá khỏi giỏ.')).toBeInTheDocument()
  })
})
