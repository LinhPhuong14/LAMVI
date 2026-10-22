// @vitest-environment jsdom
// Kiểm thử độc lập D-113: checkout chỉ COD khi payOS tắt.
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'k@lamvi.test' } }
const profile = { id: 'u1', email: 'k@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'A', phone: '0912345678' }
const quote = {
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', image: null, unitPrice: 890_000, quantity: 1, lineTotal: 890_000 }],
  subtotal: 890_000, discount: 0, shippingFee: 30_000, freeShipping: false, total: 920_000, vatAmount: 83_636, vatRate: 0.1,
  currency: 'VND', couponCode: null, couponError: null, hasUnavailable: false, freeShippingFrom: 1_000_000,
}
function api(payosEnabled) {
  return mockApi({
    'GET /me': () => ({ body: { profile } }),
    'GET /cart': () => ({ body: { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 } }),
    'GET /products': () => ({ body: { items: [] } }),
    'GET /site': () => ({ body: { name: 'LAMVI', payosEnabled } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'POST /checkout/quote': () => ({ body: quote }),
    'GET /geo/provinces': () => ({ body: { items: [{ code: '1', name: 'Hà Nội' }] } }),
    'GET /geo/provinces/1/wards': () => ({ body: { items: [{ code: '4', name: 'Ba Đình' }] } }),
    'POST /orders': () => ({ status: 201, body: { order: { code: 'LV2610-AAAAAAA' }, payment: null } }),
  })
}
beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

describe.each([
  ['/checkout', /Đặt hàng/],
  ['/en/checkout', /Place order/],
  ['/zh/checkout', null],
])('%s khi payosEnabled=false', (path, submitName) => {
  it('không có chữ payOS trong form, chỉ một radio thanh toán (COD) được chọn', async () => {
    api(false)
    renderAt(path)
    await waitFor(() => expect(document.querySelectorAll('.checkout-form input[name="paymentMethod"]').length).toBeGreaterThan(0))
    await waitFor(() => expect(document.querySelector('.checkout-form button[type="submit"]')).toBeTruthy())
    if (submitName) expect(document.querySelector('.checkout-form button[type="submit"]').textContent).toMatch(submitName)
    const radios = [...document.querySelectorAll('input[name="paymentMethod"]')]
    expect(radios).toHaveLength(1)
    expect(radios[0].value).toBe('cod')
    expect(radios[0].checked).toBe(true)
    expect(radios[0].disabled).toBe(false)
    expect(document.querySelector('.checkout-form').textContent).not.toMatch(/payos/i)
    expect(document.body.textContent).not.toMatch(/payos/i)
    // gói quà cho người khác: vẫn không cảnh báo, không khoá
    const gift = document.querySelectorAll('input[name="recipientIsSelf"]')
    if (gift.length) fireEvent.click(gift[gift.length - 1])
    expect(document.querySelector('input[name="paymentMethod"]').disabled).toBe(false)
    expect(document.body.textContent).not.toMatch(/payos/i)
  })
})

describe('body gửi lên', () => {
  const fillAndSubmit = async () => {
    await screen.findByRole('radio', { name: /^Thanh toán khi nhận hàng/i })
    fireEvent.change(screen.getByLabelText('Họ tên người nhận'), { target: { value: 'Trần B' } })
    fireEvent.change(screen.getByLabelText('Số điện thoại'), { target: { value: '0912345678' } })
    fireEvent.change(screen.getByLabelText(/Địa chỉ/), { target: { value: '1 Hàng Bông' } })
    fireEvent.submit(document.querySelector('.checkout-form'))
  }
  const sent = (f) => {
    const c = f.mock.calls.find(([u, i]) => String(u).startsWith('/api/orders') && i?.method === 'POST')
    return c && JSON.parse(c[1].body)
  }

  it('payOS tắt + giao người khác → paymentMethod "cod"', async () => {
    const f = api(false)
    renderAt('/checkout')
    await screen.findByRole('radio', { name: /^Thanh toán khi nhận hàng/i })
    fireEvent.click(screen.getByRole('button', { name: 'Giao cho người khác' }))
    await fillAndSubmit()
    await waitFor(() => expect(sent(f)).toBeTruthy())
    expect(sent(f)).toMatchObject({ paymentMethod: 'cod', recipientIsSelf: false })
  })

  it('payOS bật + giao người khác → tự chuyển payos; COD bị khoá', async () => {
    const f = api(true)
    renderAt('/checkout')
    await screen.findByRole('radio', { name: /payOS/i })
    fireEvent.click(screen.getByRole('button', { name: 'Giao cho người khác' }))
    expect(screen.getByRole('radio', { name: /^Thanh toán khi nhận hàng/i })).toBeDisabled()
    expect(screen.getByRole('radio', { name: /payOS/i })).toBeChecked()
    await fillAndSubmit()
    await waitFor(() => expect(sent(f)).toBeTruthy())
    expect(sent(f).paymentMethod).toBe('payos')
  })
})
