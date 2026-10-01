// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const batches = [
  { id: 'b1', code: 'LO-01', status: 'video_published', videoUrl: 'x' },
  { id: 'b2', code: 'LO-02', status: 'created', videoUrl: null },
]
const order = (over = {}) => ({
  id: 'o1',
  code: 100001,
  userId: 'u2',
  status: 'CONFIRMED',
  productionStage: null,
  orderType: 'gift',
  hasMessage: true,
  qrLang: 'en',
  recipientType: 'other',
  recipient: { name: 'Bình', phone: '0912345678', province: 'Hà Nội', district: 'Ba Đình', ward: 'Kim Mã', street: '2 Kim Mã' },
  paymentMethod: 'payos',
  paymentStatus: 'PAID',
  couponCode: null,
  subtotal: 890000,
  discount: 0,
  shippingFee: 30000,
  vat: 89000,
  total: 1009000,
  paidAt: '2026-10-01T03:05:00.000Z',
  paidAmount: 1009000,
  paymentRef: 'FT1',
  flags: [],
  trackingCode: null,
  createdAt: '2026-10-01T03:00:00.000Z',
  buyer: { id: 'u2', fullName: 'An', phone: null },
  items: [{ id: 'i1', productName: { vi: 'Đèn Nguyệt' }, quantity: 1, lineTotal: 890000, batchId: null, batch: null }],
  ...over,
})

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => vi.unstubAllGlobals())

describe('Admin — đơn hàng (FR-ORD-002)', () => {
  it('danh sách + lọc theo trạng thái / cần xử lý tiền', async () => {
    const f = mockApi({
      'GET /me': me,
      'GET /admin/orders': () => ({ body: { items: [{ ...order({ flags: ['PAID_AFTER_CANCEL'] }), itemCount: 1 }] } }),
    })
    renderAt('/admin/orders')
    expect(await screen.findByRole('link', { name: '#100001' })).toHaveAttribute('href', '/admin/orders/o1')
    expect(screen.getByText('⚠')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cần xử lý tiền' }))
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/api/admin/orders?flagged=1'))).toBe(true))
    fireEvent.click(screen.getByRole('button', { name: 'Đang giao' }))
    await waitFor(() => expect(f.mock.calls.some(([u]) => String(u).includes('/api/admin/orders?status=SHIPPED'))).toBe(true))
  })

  it('chi tiết: gán lô, bắt đầu làm, gửi lỗi BATCH_NOT_PUBLISHED hiện thông báo', async () => {
    const calls = []
    let current = order()
    mockApi({
      'GET /me': me,
      'GET /admin/batches': () => ({ body: { items: batches } }),
      'GET /admin/orders/o1': () => ({ body: { item: current } }),
      'PUT /admin/orders/o1/items/i1/batch': (u, init) => {
        calls.push(['batch', JSON.parse(init.body)])
        current = order({ items: [{ ...current.items[0], batchId: 'b1', batch: { id: 'b1', code: 'LO-01', published: true } }] })
        return { body: { item: current } }
      },
      'POST /admin/orders/o1/actions/start_production': () => {
        calls.push(['start'])
        current = { ...current, status: 'IN_PRODUCTION', productionStage: 1 }
        return { body: { item: current } }
      },
    })
    renderAt('/admin/orders/o1')
    expect(await screen.findByRole('heading', { name: 'Đơn #100001' })).toBeInTheDocument()
    expect(screen.getByText(/Có lời chúc — trang QR bằng English/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Lô'), { target: { value: 'b1' } })
    await waitFor(() => expect(calls).toContainEqual(['batch', { batchId: 'b1' }]))
    fireEvent.click(screen.getByRole('button', { name: 'Bắt đầu làm' }))
    expect(await screen.findByRole('button', { name: 'Đã đóng gói' })).toBeInTheDocument()
    expect(screen.getByText(/Công đoạn 1\/4/)).toBeInTheDocument()
  })

  it('đóng gói → gửi hàng: lỗi lô chưa xuất bản hiện thông báo', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/batches': () => ({ body: { items: batches } }),
      'GET /admin/orders/o1': () => ({ body: { item: order({ status: 'PACKED' }) } }),
      'POST /admin/orders/o1/actions/ship': () => ({ status: 409, body: { error: { code: 'BATCH_NOT_PUBLISHED' } } }),
    })
    renderAt('/admin/orders/o1')
    fireEvent.change(await screen.findByLabelText('Mã vận đơn'), { target: { value: 'GHN-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Gửi hàng' }))
    expect(await screen.findByText('Còn dòng hàng chưa gán lô đã xuất bản video.')).toBeInTheDocument()
  })

  it('chờ hoàn tiền: nhập số tiền + ghi chú rồi ghi nhận (D-70)', async () => {
    let sent
    mockApi({
      'GET /me': me,
      'GET /admin/batches': () => ({ body: { items: batches } }),
      'GET /admin/orders/o1': () => ({ body: { item: order({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['PAID_AFTER_CANCEL'] }) } }),
      'POST /admin/orders/o1/actions/refund': (u, init) => {
        sent = JSON.parse(init.body)
        return { body: { item: order({ status: 'CANCELLED', paymentStatus: 'REFUNDED', refundedAmount: sent.amount, refundNote: sent.note, flags: ['PAID_AFTER_CANCEL'] }) } }
      },
    })
    renderAt('/admin/orders/o1')
    expect(await screen.findByText('Tiền về sau khi đơn đã huỷ — cần hoàn tiền')).toBeInTheDocument()
    expect(screen.getByLabelText('Số tiền đã hoàn (VND)')).toHaveValue(1009000)
    fireEvent.change(screen.getByLabelText('Ghi chú hoàn tiền (ngân hàng, ngày, mã GD…)'), { target: { value: 'CK VCB' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã hoàn tiền' }))
    expect(await screen.findByText(/Đã hoàn .*1\.009\.000.* — CK VCB/)).toBeInTheDocument()
    expect(sent).toEqual({ amount: 1009000, note: 'CK VCB' })
  })
})

describe('Admin — mã giảm giá & phí ship', () => {
  it('tạo coupon % theo sản phẩm, có trần', async () => {
    let body
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'GET /admin/products': () => ({ body: { items: [{ id: 'p1', name: { vi: 'Đèn Nguyệt' } }, { id: 'p2', name: { vi: 'Đèn Vọng' } }] } }),
      'POST /admin/coupons': (u, init) => {
        body = JSON.parse(init.body)
        return { status: 201, body: { item: { id: 'c1', ...body, used: 0 } } }
      },
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'tet' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Giảm tối đa (VND, chỉ loại %)'), { target: { value: '200000' } })
    fireEvent.click(screen.getByLabelText('Chỉ các sản phẩm đã chọn'))
    fireEvent.click(await screen.findByLabelText('Đèn Vọng'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(body).toBeTruthy())
    expect(body).toMatchObject({ code: 'tet', type: 'percent', value: 10, maxDiscount: 200000, productIds: ['p2'], usageLimit: null, startsAt: null })
  })

  it('cấu hình phí ship: để trống mức miễn phí = null', async () => {
    let body
    mockApi({
      'GET /me': me,
      'GET /admin/shop': () => ({ body: { config: { shippingFee: 30000, freeShippingFrom: 1500000, codMaxTotal: 5000000 } } }),
      'PUT /admin/shop': (u, init) => {
        body = JSON.parse(init.body)
        return { body: { config: body } }
      },
    })
    renderAt('/admin/shop')
    const free = await screen.findByLabelText('Miễn phí ship khi tạm tính từ (VND)')
    expect(free).toHaveValue(1500000)
    fireEvent.change(free, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Đã lưu.')).toBeInTheDocument()
    expect(body).toEqual({ shippingFee: 30000, freeShippingFrom: null, codMaxTotal: 5000000 })
  })
})
