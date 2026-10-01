// @vitest-environment jsdom
// T-11: kiểm thử độc lập admin đơn hàng / coupon / phí ship (FR-ORD-002, FR-CPN-*, D-63…D-71)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const meAs = (role) => () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const batches = [{ id: 'b1', code: 'LO-01', status: 'video_published', videoUrl: 'x' }]
const order = (over = {}) => ({
  id: 'o1',
  code: 100001,
  userId: 'u2',
  status: 'CONFIRMED',
  productionStage: null,
  orderType: 'self',
  hasMessage: false,
  qrLang: null,
  recipientType: 'self',
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
  items: [{ id: 'i1', productName: { vi: 'Đèn Nguyệt' }, quantity: 1, lineTotal: 890000, batchId: 'b1', batch: null }],
  ...over,
})

function detail(o, extra = {}) {
  const calls = []
  const actions = {}
  for (const a of ['start_production', 'set_stage', 'pack', 'ship', 'set_tracking', 'deliver', 'delivery_failed', 'cancel', 'cod_collected', 'refund']) {
    actions[`POST /admin/orders/o1/actions/${a}`] = (u, init) => {
      calls.push([a, JSON.parse(init.body)])
      return { body: { item: o } }
    }
  }
  const f = mockApi({
    'GET /me': meAs('admin'),
    'GET /admin/batches': () => ({ body: { items: batches } }),
    'GET /admin/orders/o1': () => ({ body: { item: o } }),
    ...actions,
    ...extra,
  })
  renderAt('/admin/orders/o1')
  return { f, calls }
}

const actionsBox = () => document.querySelector('.admin-order-actions')
const actionButtons = () => within(actionsBox()).queryAllByRole('button').map((b) => b.textContent)

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('Admin — phân quyền (D-38, D-51)', () => {
  it('khách (role=customer) → "Không có quyền truy cập", không gọi API /admin/orders', async () => {
    const f = mockApi({ 'GET /me': meAs('customer'), 'GET /admin/orders': () => ({ body: { items: [] } }) })
    renderAt('/admin/orders')
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(f.mock.calls.some(([u]) => String(u).includes('/admin/orders'))).toBe(false)
    expect(screen.queryByRole('link', { name: 'Đơn hàng' })).toBeNull()
  })

  it('chưa đăng nhập → /login?next=/admin/coupons', async () => {
    localStorage.removeItem('moc.session')
    mockApi({ 'GET /products': () => ({ body: { items: [] } }), 'GET /faq': () => ({ body: { items: [] } }) })
    renderAt('/admin/coupons')
    await waitFor(() => expect(document.querySelector('a[href^="/register?next="]')).not.toBeNull())
    expect(decodeURIComponent(document.querySelector('a[href^="/register?next="]').getAttribute('href').split('next=')[1])).toBe('/admin/coupons')
  })

  it('IT cũng vào được; /admin mặc định mở danh sách đơn; menu có Đơn hàng / Mã giảm giá / Phí ship; noindex', async () => {
    mockApi({ 'GET /me': meAs('it'), 'GET /admin/orders': () => ({ body: { items: [] } }) })
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Đơn hàng' })).toBeInTheDocument()
    expect(await screen.findByText('Chưa có dữ liệu.')).toBeInTheDocument()
    const nav = document.querySelector('.admin-nav')
    expect(within(nav).getByRole('link', { name: 'Đơn hàng' })).toHaveAttribute('href', '/admin/orders')
    expect(nav.querySelector('a[href="/admin/coupons"]')).not.toBeNull()
    expect(nav.querySelector('a[href="/admin/shop"]')).not.toBeNull()
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('API danh sách đơn trả 403 → thông báo lỗi', async () => {
    mockApi({ 'GET /me': meAs('admin'), 'GET /admin/orders': () => ({ status: 403, body: { error: { code: 'FORBIDDEN' } } }) })
    renderAt('/admin/orders')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('Admin — chi tiết đơn: nút thao tác theo trạng thái (§16)', () => {
  it.each([
    ['PENDING_PAYMENT', {}, ['Huỷ đơn']],
    ['CONFIRMED', {}, ['Bắt đầu làm', 'Huỷ đơn']],
    ['IN_PRODUCTION', { productionStage: 2 }, ['Cập nhật công đoạn', 'Đã đóng gói', 'Huỷ đơn']],
    ['PACKED', {}, ['Gửi hàng', 'Huỷ đơn']],
    ['SHIPPED', { trackingCode: 'GHN-1' }, ['Sửa mã vận đơn', 'Đã giao', 'Giao thất bại']],
    ['SHIPPED', { trackingCode: 'GHN-1', paymentMethod: 'cod', paymentStatus: 'COD_PENDING' }, ['Sửa mã vận đơn', 'Đã giao', 'Giao thất bại', 'Đã thu COD']],
    ['DELIVERED', { paymentMethod: 'cod', paymentStatus: 'COD_PENDING' }, ['Đã thu COD']],
    ['DELIVERED', {}, []],
    ['DELIVERY_FAILED', { trackingCode: 'GHN-1' }, ['Sửa mã vận đơn']],
    ['CANCELLED', { paymentStatus: 'CANCELLED' }, []],
    ['CANCELLED', { paymentStatus: 'REFUND_PENDING' }, ['Ghi nhận đã hoàn tiền']],
    ['CANCELLED', { paymentStatus: 'REFUNDED', refundedAmount: 1009000, refundNote: 'CK' }, []],
  ])('%s %o → %o', async (status, over, expected) => {
    detail(order({ status, ...over }))
    await screen.findByRole('heading', { name: 'Đơn #100001' })
    expect(actionButtons()).toEqual(expected)
  })

  it('cập nhật công đoạn gửi đúng số đã chọn', async () => {
    const { calls } = detail(order({ status: 'IN_PRODUCTION', productionStage: 1 }))
    fireEvent.change(await screen.findByLabelText('Công đoạn'), { target: { value: '3' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật công đoạn' }))
    await waitFor(() => expect(calls).toContainEqual(['set_stage', { stage: 3 }]))
  })

  it('lô bị khoá khi đơn đã gửi / đã huỷ', async () => {
    detail(order({ status: 'SHIPPED', trackingCode: 'GHN-1' }))
    expect(await screen.findByLabelText('Lô')).toBeDisabled()
  })

  it('huỷ đơn admin: confirm=false → không gọi API; confirm=true → gọi cancel', async () => {
    let answer = false
    vi.stubGlobal('confirm', () => answer)
    const { calls } = detail(order())
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ đơn' }))
    expect(calls).toEqual([])
    answer = true
    fireEvent.click(screen.getByRole('button', { name: 'Huỷ đơn' }))
    await waitFor(() => expect(calls).toEqual([['cancel', {}]]))
  })

  it('mã vận đơn sai → lỗi hiện tại ô "Mã vận đơn"', async () => {
    detail(order({ status: 'PACKED' }), {
      'POST /admin/orders/o1/actions/ship': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { trackingCode: 'INVALID' } } } }),
    })
    const input = await screen.findByLabelText('Mã vận đơn')
    fireEvent.click(screen.getByRole('button', { name: 'Gửi hàng' }))
    await waitFor(() => expect(input).toHaveAttribute('aria-invalid', 'true'))
    expect(screen.getAllByText('Giá trị không hợp lệ.').length).toBeGreaterThan(0)
  })

  it('hoàn tiền nhập sai số tiền / thiếu ghi chú → lỗi tại ô, đơn không đổi', async () => {
    let sent
    detail(order({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING' }), {
      'POST /admin/orders/o1/actions/refund': (u, init) => {
        sent = JSON.parse(init.body)
        return { status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { amount: 'INVALID' } } } }
      },
    })
    const amount = await screen.findByLabelText('Số tiền đã hoàn (VND)')
    fireEvent.change(amount, { target: { value: '2000000' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ghi nhận đã hoàn tiền' }))
    await waitFor(() => expect(amount).toHaveAttribute('aria-invalid', 'true'))
    expect(sent).toEqual({ amount: 2000000, note: '' })
    expect(screen.getByRole('button', { name: 'Ghi nhận đã hoàn tiền' })).toBeEnabled()
  })

  it('cờ AMOUNT_MISMATCH, thông tin đã nhận tiền, giảm giá có mã', async () => {
    detail(order({ status: 'CANCELLED', paymentStatus: 'REFUND_PENDING', flags: ['AMOUNT_MISMATCH'], paidAmount: 1000000, discount: 50000, couponCode: 'TET' }))
    expect(await screen.findByText('Số tiền nhận khác tổng đơn — cần hoàn tiền')).toBeInTheDocument()
    expect(screen.getByText(/Đã nhận 1\.000\.000.*mã GD FT1/)).toBeInTheDocument()
    expect(screen.getByText('Giảm giá (TET)')).toBeInTheDocument()
    // Số tiền hoàn mặc định = số đã nhận
    expect(screen.getByLabelText('Số tiền đã hoàn (VND)')).toHaveValue(1000000)
  })

  it('đơn không tồn tại → "Không tìm thấy."', async () => {
    mockApi({
      'GET /me': meAs('admin'),
      'GET /admin/batches': () => ({ body: { items: [] } }),
      'GET /admin/orders/o1': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }),
    })
    renderAt('/admin/orders/o1')
    expect(await screen.findByText('Không tìm thấy.')).toBeInTheDocument()
  })
})

describe('Admin — coupon (D-65…D-68)', () => {
  const products = [{ id: 'p1', name: { vi: 'Đèn Nguyệt' } }, { id: 'p2', name: { vi: 'Đèn Vọng' } }]
  function setup(items = [], extra = {}) {
    const sent = []
    const f = mockApi({
      'GET /me': meAs('admin'),
      'GET /admin/coupons': () => ({ body: { items } }),
      'GET /admin/products': () => ({ body: { items: products } }),
      'POST /admin/coupons': (u, init) => {
        sent.push(['POST', JSON.parse(init.body)])
        return { status: 201, body: { item: { id: 'cx' } } }
      },
      'PATCH /admin/coupons/c1': (u, init) => {
        sent.push(['PATCH', JSON.parse(init.body)])
        return { body: { item: { id: 'c1' } } }
      },
      ...extra,
    })
    renderAt('/admin/coupons')
    return { f, sent }
  }

  it('đổi loại: % có trần; số tiền ẩn trần; miễn ship ẩn cả giá trị; gửi value=0, maxDiscount=null', async () => {
    const { sent } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    expect(screen.getByLabelText('Giá trị')).toBeInTheDocument()
    expect(screen.getByLabelText('Giảm tối đa (VND, chỉ loại %)')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Giảm tối đa (VND, chỉ loại %)'), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'amount' } })
    expect(screen.queryByLabelText('Giảm tối đa (VND, chỉ loại %)')).toBeNull()
    expect(screen.getByText('Số tiền VND')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'free_shipping' } })
    expect(screen.queryByLabelText('Giá trị')).toBeNull()
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'FREESHIP' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0][1]).toMatchObject({ code: 'FREESHIP', type: 'free_shipping', value: 0, maxDiscount: null, productIds: null, minOrder: null, perUserLimit: null })
  })

  it('loại số tiền: maxDiscount đã nhập trước đó không bị gửi', async () => {
    const { sent } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Giảm tối đa (VND, chỉ loại %)'), { target: { value: '100000' } })
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'amount' } })
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'GIAM50' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '50000' } })
    fireEvent.change(screen.getByLabelText('Tổng số lượt'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Số lượt mỗi khách'), { target: { value: '1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0][1]).toMatchObject({ type: 'amount', value: 50000, maxDiscount: null, usageLimit: 100, perUserLimit: 1 })
  })

  it('datetime-local (giờ trình duyệt) → ISO', async () => {
    const { sent } = setup()
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'TET' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '2026-10-05T08:30' } })
    fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: '2026-10-10T23:59' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0][1].startsAt).toBe(new Date('2026-10-05T08:30').toISOString())
    expect(sent[0][1].endsAt).toBe(new Date('2026-10-10T23:59').toISOString())
  })

  it('sửa coupon (PATCH): form điền sẵn, giữ phạm vi sản phẩm + thời gian; lưu lại không đổi gì', async () => {
    const c = {
      id: 'c1',
      code: 'TET',
      status: 'inactive',
      type: 'percent',
      value: 15,
      maxDiscount: 200000,
      minOrder: 500000,
      startsAt: '2026-10-05T01:30:00.000Z',
      endsAt: '2026-10-10T16:59:00.000Z',
      usageLimit: 50,
      perUserLimit: 2,
      productIds: ['p2'],
      note: 'Tết',
      used: 3,
    }
    const { sent } = setup([c])
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    expect(screen.getByLabelText('Mã')).toHaveValue('TET')
    expect(screen.getByLabelText('Trạng thái')).toHaveValue('inactive')
    expect(screen.getByLabelText('Đèn Vọng')).toBeChecked()
    expect(screen.getByLabelText('Đèn Nguyệt')).not.toBeChecked()
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0][0]).toBe('PATCH')
    expect(sent[0][1]).toEqual({
      code: 'TET',
      status: 'inactive',
      type: 'percent',
      value: 15,
      maxDiscount: 200000,
      minOrder: 500000,
      startsAt: '2026-10-05T01:30:00.000Z',
      endsAt: '2026-10-10T16:59:00.000Z',
      usageLimit: 50,
      perUserLimit: 2,
      productIds: ['p2'],
      note: 'Tết',
    })
  })

  it('bảng coupon: hiển thị giá trị %/trần, đã dùng / tổng lượt, phạm vi sản phẩm', async () => {
    setup([
      { id: 'c1', code: 'TET', status: 'active', type: 'percent', value: 10, maxDiscount: 200000, usageLimit: 50, used: 3, productIds: ['p1'], startsAt: null, endsAt: null },
      { id: 'c2', code: 'SHIP', status: 'inactive', type: 'free_shipping', value: 0, maxDiscount: null, usageLimit: null, used: 0, productIds: null, startsAt: null, endsAt: null },
    ])
    const row1 = (await screen.findByText('TET')).closest('tr')
    expect(row1.textContent).toMatch(/10%.*tối đa 200\.000/)
    expect(row1.textContent).toContain('3 / 50')
    expect(row1.textContent).toContain('Chỉ các sản phẩm đã chọn')
    const row2 = screen.getByText('SHIP').closest('tr')
    expect(row2.textContent).toContain('Miễn phí ship')
    expect(row2.textContent).toContain('Đã tắt')
  })

  it('xoá coupon đã dùng → COUPON_IN_USE; confirm=false → không gọi DELETE', async () => {
    let answer = false
    vi.stubGlobal('confirm', () => answer)
    const del = vi.fn(() => ({ status: 409, body: { error: { code: 'COUPON_IN_USE' } } }))
    setup([{ id: 'c1', code: 'TET', status: 'active', type: 'amount', value: 50000, used: 2, usageLimit: null, productIds: null }], { 'DELETE /admin/coupons/c1': del })
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }))
    expect(del).not.toHaveBeenCalled()
    answer = true
    fireEvent.click(screen.getByRole('button', { name: 'Xoá' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Mã đã có đơn sử dụng — hãy tắt thay vì xoá.')
    expect(screen.getByText('TET')).toBeInTheDocument()
  })

  it('mã trùng → lỗi tại ô Mã, không hiện thông báo chung trùng lặp', async () => {
    setup([], { 'POST /admin/coupons': () => ({ status: 409, body: { error: { code: 'COUPON_CODE_TAKEN', fields: { code: 'COUPON_CODE_TAKEN' } } } }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'TET' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Mã giảm giá đã tồn tại.')).toBeInTheDocument()
    expect(screen.getByLabelText('Mã')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('phạm vi sản phẩm rỗng bị server từ chối → lỗi hiện dưới phần "Áp dụng cho"', async () => {
    setup([], { 'POST /admin/coupons': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { productIds: 'REQUIRED' } } } }) })
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.click(screen.getByLabelText('Chỉ các sản phẩm đã chọn'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    const scope = screen.getByText('Áp dụng cho').closest('fieldset')
    await waitFor(() => expect(scope.querySelector('.field-error')).not.toBeNull())
  })
})

describe('Admin — phí ship & COD (D-63, D-71)', () => {
  it('lỗi trường từ server hiện tại ô, không có thông báo "Đã lưu"', async () => {
    mockApi({
      'GET /me': meAs('admin'),
      'GET /admin/shop': () => ({ body: { config: { shippingFee: 30000, freeShippingFrom: 1500000, codMaxTotal: null } } }),
      'PUT /admin/shop': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { shippingFee: 'INVALID_PRICE' } } } }),
    })
    renderAt('/admin/shop')
    const fee = await screen.findByLabelText('Phí ship đồng giá (VND)')
    expect(screen.getByLabelText('Tổng đơn tối đa cho COD (VND)')).toHaveValue(null)
    fireEvent.change(fee, { target: { value: '-1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Giá phải là số nguyên VND, không âm.')).toBeInTheDocument()
    expect(fee).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Đã lưu.')).toBeNull()
  })

  it('tải cấu hình lỗi → thông báo', async () => {
    mockApi({ 'GET /me': meAs('admin'), 'GET /admin/shop': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin/shop')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra')
  })
})
