// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
const emptyCart = { items: [], subtotalExclVat: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10, currency: 'VND' }

// Bảng giá giả theo cùng công thức server (D-62, D-63)
function quoteBody({ couponCode, recipientType }, over = {}) {
  const subtotal = 890000
  const discount = couponCode === 'GIAM10' ? 89000 : 0
  const vat = Math.round((subtotal - discount) * 0.1)
  return {
    items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', tone: 'amber', unitPrice: 890000, quantity: 1, lineTotal: 890000 }],
    hasUnavailable: false,
    pricing: { subtotal, discount, shippingFeeBeforeDiscount: 30000, shippingFee: 30000, vat, vatRate: 0.1, total: subtotal - discount + 30000 + vat, currency: 'VND' },
    coupon: discount ? { code: 'GIAM10', type: 'percent', value: 10 } : null,
    couponError: couponCode && !discount ? { code: 'COUPON_INVALID' } : null,
    cod: recipientType === 'other' ? { allowed: false, reason: 'COD_RECIPIENT_OTHER' } : { allowed: true, reason: null },
    payosAvailable: true,
    shop: { shippingFee: 30000, freeShippingFrom: 1500000 },
    ...over,
  }
}

const order = (over = {}) => ({
  id: 'o1',
  code: 100001,
  status: 'CONFIRMED',
  productionStage: null,
  orderType: 'self',
  hasMessage: false,
  qrLang: null,
  recipientType: 'self',
  recipient: { name: 'Nguyễn An', phone: '0912345678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' },
  paymentMethod: 'cod',
  paymentStatus: 'COD_PENDING',
  couponCode: null,
  subtotal: 890000,
  discount: 0,
  shippingFee: 30000,
  vat: 89000,
  total: 1009000,
  paymentExpiresAt: null,
  trackingCode: null,
  cancelReason: null,
  refundedAmount: null,
  canCancel: true,
  canPay: false,
  createdAt: '2026-10-01T03:00:00.000Z',
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', unitPrice: 890000, quantity: 1, lineTotal: 890000 }],
  ...over,
})

function handlers(extra = {}) {
  const log = []
  const h = {
    'GET /products': () => ({ body: productsVi }),
    'GET /faq': () => ({ body: { items: [] } }),
    'GET /cart': () => ({ body: emptyCart }),
    'GET /me': () => ({ body: { profile: { fullName: 'Nguyễn An', phone: '0912345678', preferredLocale: 'vi', email: 'an@moc.test' } } }),
    'POST /checkout/quote': (url, init) => {
      const b = JSON.parse(init.body)
      log.push({ key: 'quote', body: b })
      return { body: quoteBody(b) }
    },
    'POST /orders': (url, init) => {
      const b = JSON.parse(init.body)
      log.push({ key: 'order', body: b })
      return { status: 201, body: { order: order(), checkoutUrl: b.paymentMethod === 'payos' ? 'https://pay.test/1' : null } }
    },
    'GET /orders/o1': () => ({ body: { order: order() } }),
    ...extra,
  }
  return { h, log }
}

async function fillRecipient() {
  for (const [label, value] of [
    ['Tỉnh / Thành phố', 'Hà Nội'],
    ['Quận / Huyện', 'Hoàn Kiếm'],
    ['Phường / Xã', 'Hàng Trống'],
    ['Số nhà, đường', '1 Lý Thái Tổ'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

beforeEach(() => {
  localStorage.setItem('moc.tour.done', '1')
  localStorage.setItem('moc.session', JSON.stringify(session))
})
afterEach(() => vi.unstubAllGlobals())

describe('Checkout (§12, FR-CHK-001…008)', () => {
  it('chưa đăng nhập → chuyển tới đăng nhập với next=/checkout (FR-CHK-001)', async () => {
    localStorage.removeItem('moc.session')
    mockApi(handlers().h)
    renderAt('/en/checkout')
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create|register|sign up/i }).getAttribute('href')).toContain('next=%2Fen%2Fcheckout')
  })

  it('bảng giá từ server: tạm tính, ship, VAT 10%, tổng; điền sẵn tên/SĐT; noindex', async () => {
    mockApi(handlers().h)
    renderAt('/checkout')
    const summary = (await screen.findByRole('heading', { name: 'Đơn hàng' })).closest('aside')
    expect(within(summary).getByText('VAT 10%').nextSibling.textContent).toMatch(/89\.000/)
    expect(within(summary).getByText('Tổng thanh toán').nextSibling.textContent).toMatch(/1\.009\.000/)
    expect(within(summary).getByText('Miễn phí vận chuyển cho đơn có tạm tính từ 1.500.000 ₫.')).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Họ và tên người nhận')).toHaveValue('Nguyễn An'))
    expect(screen.getByLabelText('Số điện thoại người nhận')).toHaveValue('0912345678')
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('đơn Tặng: có ngôn ngữ trang lời chúc; Tự mua chỉ khi tích "Thêm lời chúc" (BR-MSG-002)', async () => {
    mockApi(handlers().h)
    renderAt('/checkout')
    expect(await screen.findByLabelText('Ngôn ngữ trang lời chúc')).toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Mua cho mình/))
    expect(screen.queryByLabelText('Ngôn ngữ trang lời chúc')).toBeNull()
    fireEvent.click(screen.getByLabelText('Thêm lời chúc'))
    expect(screen.getByLabelText('Ngôn ngữ trang lời chúc')).toBeInTheDocument()
  })

  it('giao cho người khác → COD bị khoá, tự chọn payOS (BR-PAY-004)', async () => {
    const { h, log } = handlers()
    mockApi(h)
    renderAt('/checkout')
    const cod = await screen.findByLabelText(/Thanh toán khi nhận hàng/)
    fireEvent.click(cod)
    expect(cod).toBeChecked()
    fireEvent.click(screen.getByLabelText('Người khác'))
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled())
    expect(screen.getByLabelText(/Chuyển khoản/)).toBeChecked()
    expect(screen.getByText('Không áp dụng COD khi giao cho người khác.')).toBeInTheDocument()
    expect(log.at(-1).body).toEqual({ couponCode: null, recipientType: 'other' })
  })

  it('áp mã giảm giá: hợp lệ → hiện giảm; sai → báo lỗi', async () => {
    mockApi(handlers().h)
    renderAt('/checkout')
    fireEvent.change(await screen.findByLabelText('Mã giảm giá'), { target: { value: 'SAI' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Mã giảm giá không hợp lệ.')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Mã giảm giá'), { target: { value: 'GIAM10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Đã áp dụng mã GIAM10.')).toBeInTheDocument()
    expect(screen.getByText('Giảm giá').nextSibling.textContent).toMatch(/89\.000/)
  })

  it('đặt COD → gửi đủ dữ liệu + tổng đã thấy → sang trang đơn', async () => {
    const { h, log } = handlers()
    mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Mua cho mình/))
    fireEvent.click(screen.getByLabelText(/Thanh toán khi nhận hàng/))
    await waitFor(() => expect(screen.getByLabelText('Họ và tên người nhận')).toHaveValue('Nguyễn An'))
    await fillRecipient()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    expect(await screen.findByRole('heading', { name: 'Đơn #100001' })).toBeInTheDocument()
    const sent = log.find((l) => l.key === 'order').body
    expect(sent).toMatchObject({ orderType: 'self', addMessage: false, recipientType: 'self', paymentMethod: 'cod', couponCode: null, expectedTotal: 1009000 })
    expect(sent.recipient).toEqual({ name: 'Nguyễn An', phone: '0912345678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' })
    expect(sent.clientKey).toMatch(/^[A-Za-z0-9-]{8,64}$/)
    expect(screen.getByText('Đặt hàng thành công. Cảm ơn bạn!')).toBeInTheDocument()
  })

  it('payOS → chuyển sang link thanh toán', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    mockApi(handlers().h)
    renderAt('/checkout')
    await waitFor(() => expect(screen.getByLabelText('Họ và tên người nhận')).toHaveValue('Nguyễn An'))
    await fillRecipient()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://pay.test/1'))
  })

  it('giá đổi (PRICE_CHANGED) → báo, tải lại bảng giá; lỗi trường hiện tại ô', async () => {
    let calls = 0
    const { h } = handlers({
      'POST /orders': () => {
        calls += 1
        return calls === 1
          ? { status: 409, body: { error: { code: 'PRICE_CHANGED' } } }
          : { status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { 'recipient.phone': 'INVALID_PHONE' } } } }
      },
    })
    const f = mockApi(h)
    renderAt('/checkout')
    await waitFor(() => expect(screen.getByLabelText('Họ và tên người nhận')).toHaveValue('Nguyễn An'))
    const quotesBefore = f.mock.calls.filter(([u]) => String(u).includes('/checkout/quote')).length
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    expect(await screen.findByText(/Giá hoặc mã giảm giá vừa thay đổi/)).toBeInTheDocument()
    await waitFor(() => expect(f.mock.calls.filter(([u]) => String(u).includes('/checkout/quote')).length).toBe(quotesBefore + 1))
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    expect(await screen.findByText('Số điện thoại Việt Nam không hợp lệ.')).toBeInTheDocument()
  })

  it('giỏ trống → nút quay lại giỏ', async () => {
    mockApi(handlers({ 'POST /checkout/quote': () => ({ body: quoteBody({}, { items: [] }) }) }).h)
    renderAt('/checkout')
    expect(await screen.findByRole('link', { name: 'Quay lại giỏ hàng' })).toHaveAttribute('href', '/cart')
  })
})

describe('Đơn của tôi (FR-ACC-002)', () => {
  it('trang tài khoản liệt kê đơn', async () => {
    mockApi(
      handlers({
        'GET /orders': () => ({
          body: { items: [{ id: 'o1', code: 100001, status: 'IN_PRODUCTION', productionStage: 2, total: 1009000, itemCount: 1, firstItemName: 'Đèn Nguyệt', createdAt: '2026-10-01T03:00:00.000Z' }] },
        }),
        'GET /may/history': () => ({ body: { items: [] } }),
      }).h,
    )
    renderAt('/account')
    const link = await screen.findByRole('link', { name: /#100001/ })
    expect(link).toHaveAttribute('href', '/account/orders/o1')
    expect(screen.getByText('Đang làm đèn')).toBeInTheDocument()
  })

  it('đang làm: hiện công đoạn; huỷ đơn có xác nhận', async () => {
    vi.stubGlobal('confirm', () => true)
    const { h } = handlers({
      'GET /orders/o1': () => ({ body: { order: order({ status: 'IN_PRODUCTION', productionStage: 2 }) } }),
      'POST /orders/o1/cancel': () => ({ body: { order: order({ status: 'CANCELLED', cancelReason: 'customer', canCancel: false, paymentStatus: 'CANCELLED' }) } }),
    })
    mockApi(h)
    renderAt('/account/orders/o1')
    await screen.findByRole('heading', { name: 'Đơn #100001' })
    expect(document.querySelectorAll('.order-stages li.is-done')).toHaveLength(2)
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ đơn' }))
    expect(await screen.findByText('Bạn đã huỷ đơn này.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Huỷ đơn' })).toBeNull()
  })

  it('quay về từ payOS khi chưa có webhook → "Đang chờ xác nhận", hỏi lại tới khi xác nhận (US-002 AC-002)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    mockApi(
      handlers({
        'GET /orders/o1': () => {
          n += 1
          return {
            body: {
              order:
                n < 2
                  ? order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: '2026-10-01T03:15:00.000Z', canPay: true })
                  : order({ paymentMethod: 'payos', paymentStatus: 'PAID', canCancel: true }),
            },
          }
        },
      }).h,
    )
    renderAt('/account/orders/o1?payment=return')
    expect(await screen.findByText('Đang chờ xác nhận thanh toán…')).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(3100)
    expect(await screen.findByText('Thanh toán thành công. Cảm ơn bạn!')).toBeInTheDocument()
    vi.useRealTimers()
  })

  it('đơn của người khác / không có → báo không tìm thấy', async () => {
    mockApi(handlers({ 'GET /orders/o1': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) }).h)
    renderAt('/account/orders/o1')
    expect(await screen.findByText('Không tìm thấy.')).toBeInTheDocument()
  })
})
