// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) — trang chi tiết đơn (§12, FR-ACC-002) và nút "Thanh toán ngay"
// (lấy lại liên kết thanh toán, FR-PAY-001).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }

const order = (over = {}) => ({
  code: 'LV2610-ACDEFGH',
  status: 'pending_payment',
  orderKind: 'self',
  hasMessage: false,
  qrLang: null,
  recipientIsSelf: true,
  recipientName: 'Nguyễn Văn A',
  recipientPhone: '0912345678',
  addressLine: '12 Hàng Bông',
  ward: null,
  district: 'Hoàn Kiếm',
  province: 'Hà Nội',
  note: null,
  paymentMethod: 'payos',
  paymentStatus: 'pending',
  paymentExpiresAt: '2026-10-01T03:15:00.000Z',
  subtotal: 890_000,
  discount: 0,
  shippingFee: 30_000,
  total: 920_000,
  vatAmount: 83_636,
  vatRate: 0.1,
  couponCode: null,
  trackingCode: null,
  cancelledAt: null,
  createdAt: '2026-10-01T03:00:00.000Z',
  currency: 'VND',
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', unitPrice: 890_000, quantity: 1, lineTotal: 890_000 }],
  ...over,
})

let assign

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  assign = vi.fn()
  // jsdom không cho điều hướng thật → thay location bằng bản giả chỉ dùng trong test
  vi.stubGlobal('location', { ...window.location, assign, href: 'http://localhost/don-hang/LV2610-ACDEFGH' })
})

afterEach(() => {
  vi.restoreAllMocks()
})

const detail = (over = {}, extra = {}) => ({
  'GET /orders/LV2610-ACDEFGH': () => ({ body: { item: order(over) } }),
  ...extra,
})

describe('Trang đơn — nút "Thanh toán ngay" (FR-PAY-001)', () => {
  it('đơn payOS đang chờ trả tiền → có nút; bấm gọi đúng API và chuyển tới trang thanh toán', async () => {
    const calls = []
    mockApi(
      detail(
        {},
        {
          'POST /orders/LV2610-ACDEFGH/payment': (url, init) => {
            calls.push({ url: String(url), body: init.body })
            return { body: { payment: { checkoutUrl: 'https://pay.test/123', qrCode: 'QR' } } }
          },
        },
      ),
    )
    renderAt('/don-hang/LV2610-ACDEFGH')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán ngay' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].url).toContain('/api/orders/LV2610-ACDEFGH/payment')
    expect(assign).toHaveBeenCalledWith('https://pay.test/123')
  })

  it('đơn COD đang chờ xử lý → KHÔNG có nút thanh toán', async () => {
    mockApi(detail({ paymentMethod: 'cod', status: 'confirmed', paymentStatus: 'unpaid' }))
    renderAt('/don-hang/LV2610-ACDEFGH')
    await screen.findByRole('heading', { name: /LV2610-ACDEFGH/ })
    expect(screen.queryByRole('button', { name: 'Thanh toán ngay' })).toBeNull()
  })

  it('đơn đã huỷ / đã xác nhận → không có nút thanh toán', async () => {
    for (const status of ['cancelled', 'confirmed', 'delivered']) {
      mockApi(detail({ status, paymentStatus: status === 'cancelled' ? 'expired' : 'paid' }))
      const { unmount } = renderAt('/don-hang/LV2610-ACDEFGH')
      await screen.findByRole('heading', { name: /LV2610-ACDEFGH/ })
      expect(screen.queryByRole('button', { name: 'Thanh toán ngay' }), status).toBeNull()
      unmount()
    }
  })

  it('cổng trả về lỗi (không có checkoutUrl) → báo lỗi, không chuyển hướng', async () => {
    mockApi(
      detail(
        {},
        {
          'POST /orders/LV2610-ACDEFGH/payment': () => ({
            body: { payment: { error: 'PAYMENT_GATEWAY_ERROR', expiresAt: '2026-10-01T03:15:00.000Z' } },
          }),
        },
      ),
    )
    renderAt('/don-hang/LV2610-ACDEFGH')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán ngay' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(assign).not.toHaveBeenCalled()
  })

  it('đơn hết hạn trong lúc mở tab (409) → báo lỗi và nạp lại đơn từ server', async () => {
    let loads = 0
    mockApi({
      'GET /orders/LV2610-ACDEFGH': () => {
        loads += 1
        return { body: { item: order(loads > 1 ? { status: 'cancelled', paymentStatus: 'expired' } : {}) } }
      },
      'POST /orders/LV2610-ACDEFGH/payment': () => ({
        status: 409,
        body: { error: { code: 'ORDER_NOT_PAYABLE', message: 'Đơn không ở trạng thái chờ thanh toán' } },
      }),
    })
    renderAt('/don-hang/LV2610-ACDEFGH')
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán ngay' }))
    await waitFor(() => expect(loads).toBeGreaterThan(1))
    expect(assign).not.toHaveBeenCalled()
  })

  it('đơn không tồn tại → 404 và câu báo lỗi, không hiện nội dung đơn', async () => {
    mockApi({ 'GET /orders/LV2610-KHONGCO': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    renderAt('/don-hang/LV2610-KHONGCO')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy.')
    expect(screen.queryByRole('button', { name: 'Thanh toán ngay' })).toBeNull()
  })

  it('chưa đăng nhập → chuyển sang trang đăng nhập, không gọi API đơn', async () => {
    localStorage.clear()
    const fetchMock = mockApi(detail())
    renderAt('/don-hang/LV2610-ACDEFGH')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([u]) => String(u)).some((u) => u.includes('/orders/'))).toBe(false)
  })
})
