// @vitest-environment jsdom
// Feedback 08/10 mục 30: payOS chưa có khoá → vô hiệu lựa chọn kèm lý do, không để khách gặp lỗi ở bước cuối
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }
const profile = { id: 'u1', email: 'khach@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'A' }
const quote = {
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', image: null, unitPrice: 890_000, quantity: 1, lineTotal: 890_000 }],
  subtotal: 890_000, discount: 0, shippingFee: 30_000, freeShipping: false, total: 920_000, vatAmount: 83_636, vatRate: 0.1,
  currency: 'VND', couponCode: null, couponError: null, hasUnavailable: false, freeShippingFrom: 1_000_000,
}

function api(payosEnabled) {
  mockApi({
    'GET /me': () => ({ body: { profile } }),
    'GET /cart': () => ({ body: { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 } }),
    'GET /products': () => ({ body: { items: [] } }),
    'GET /site': () => ({ body: { name: 'LAMVI', payosEnabled } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'POST /checkout/quote': () => ({ body: quote }),
    'GET /geo/provinces': () => ({ body: { items: [] } }),
  })
}

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

describe('Checkout khi payOS chưa cấu hình', () => {
  it('khoá lựa chọn payOS, COD vẫn dùng được', async () => {
    api(false)
    renderAt('/checkout')
    const payos = await screen.findByRole('radio', { name: /payOS/i })
    await screen.findByText(/chưa nhận thanh toán online/)
    expect(payos).toBeDisabled()
    expect(screen.getByRole('radio', { name: /^Thanh toán khi nhận hàng/i })).not.toBeDisabled()
  })

  it('đơn giao người khác (bắt buộc payOS) → báo rõ và khoá nút Đặt hàng', async () => {
    api(false)
    renderAt('/checkout')
    await screen.findByText(/chưa nhận thanh toán online/)
    fireEvent.click(screen.getByRole('button', { name: 'Giao cho người khác' }))
    expect(await screen.findByText(/bắt buộc thanh toán online/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt hàng' })).toBeDisabled()
  })

  it('payOS bật → lựa chọn dùng được', async () => {
    api(true)
    renderAt('/checkout')
    const payos = await screen.findByRole('radio', { name: /payOS/i })
    expect(payos).not.toBeDisabled()
  })
})

describe('Tự điền người nhận từ hồ sơ (feedback 08/10, 7.4)', () => {
  it('Giao cho tôi: điền tên + SĐT từ hồ sơ', async () => {
    mockApi({
      'GET /me': () => ({ body: { profile: { ...profile, fullName: 'Nguyễn An', phone: '0912345678' } } }),
      'GET /cart': () => ({ body: { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 } }),
      'GET /products': () => ({ body: { items: [] } }),
      'GET /site': () => ({ body: { name: 'LAMVI', payosEnabled: true } }),
      'GET /may/history': () => ({ body: { items: [] } }),
      'POST /checkout/quote': () => ({ body: quote }),
      'GET /geo/provinces': () => ({ body: { items: [] } }),
    })
    renderAt('/checkout')
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0912345678')).toBeInTheDocument()
  })
})
