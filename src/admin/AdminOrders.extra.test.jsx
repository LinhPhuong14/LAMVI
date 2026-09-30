// @vitest-environment jsdom
// Admin đơn hàng (FR-ORD-002, §16) và coupon (FR-CPN-001, §14)
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })

const order = (over = {}) => ({
  code: 'LV2610-ACDEFGH',
  status: 'confirmed',
  orderKind: 'gift',
  hasMessage: true,
  qrLang: 'en',
  recipientIsSelf: false,
  recipientName: 'Trần Thị B',
  recipientPhone: '0912345678',
  addressLine: '5 Lý Thường Kiệt',
  ward: 'Cửa Nam',
  district: 'Hoàn Kiếm',
  province: 'Hà Nội',
  note: 'Gọi trước khi giao',
  paymentMethod: 'payos',
  paymentStatus: 'paid',
  subtotal: 1_780_000,
  discount: 178_000,
  shippingFee: 30_000,
  total: 1_632_000,
  vatAmount: 148_364,
  vatRate: 0.1,
  couponCode: 'TET2026',
  trackingCode: null,
  createdAt: '2026-10-01T03:00:00.000Z',
  currency: 'VND',
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', unitPrice: 890_000, quantity: 2, lineTotal: 1_780_000 }],
  nextStatuses: ['in_production', 'cancelled'],
  paymentFlag: null,
  ...over,
})

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Admin — danh sách đơn', () => {
  it('hiện mã đơn, người nhận, tổng tiền, trạng thái; lọc theo trạng thái gọi đúng API', async () => {
    const calls = []
    mockApi({
      'GET /me': me,
      'GET /admin/orders': (url) => {
        calls.push(String(url))
        return { body: { items: [order()] } }
      },
    })
    renderAt('/admin/orders')
    const row = (await screen.findByText('LV2610-ACDEFGH')).closest('tr')
    expect(within(row).getByText('Trần Thị B')).toBeInTheDocument()
    expect(row.textContent).toContain('1.632.000')
    expect(within(row).getByText('Đã xác nhận')).toBeInTheDocument()
    expect(within(row).getByText('Đã thanh toán')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'shipped' } })
    await waitFor(() => expect(calls.some((u) => u.includes('status=shipped'))).toBe(true))
  })

  it('đơn có cờ cần xử lý tay được đánh dấu trong danh sách', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/orders': () => ({ body: { items: [order({ paymentFlag: 'AMOUNT_MISMATCH' })] } }),
    })
    renderAt('/admin/orders')
    const row = (await screen.findByText('LV2610-ACDEFGH')).closest('tr')
    expect(row.textContent).toContain('⚑')
  })

  it('chưa có đơn nào → câu thông báo, không hiện bảng rỗng', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/orders': () => ({ body: { items: [] } }) })
    renderAt('/admin/orders')
    expect(await screen.findByText('Chưa có đơn nào.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })
})

describe('Admin — chi tiết đơn (§16, NFR-AUD-001)', () => {
  const detail = (over = {}, audit = []) => ({
    'GET /me': me,
    'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item: order(over), audit } }),
  })

  it('hiện bảng giá, người nhận, thanh toán và loại đơn', async () => {
    mockApi(detail())
    renderAt('/admin/orders/LV2610-ACDEFGH')
    await screen.findByRole('heading', { name: 'LV2610-ACDEFGH' })
    // Tên và địa chỉ nằm trong cùng một <p>, chia thành nhiều nút văn bản
    const recipient = screen.getByRole('heading', { name: 'Người nhận' }).nextElementSibling
    expect(recipient.textContent).toContain('Trần Thị B · 0912345678')
    expect(recipient.textContent).toContain('5 Lý Thường Kiệt, Cửa Nam, Hoàn Kiếm, Hà Nội')
    expect(screen.getByText(/Giảm giá \(TET2026\)/)).toBeInTheDocument()
    expect(screen.getByText('Mua tặng')).toBeInTheDocument()
    // Ngôn ngữ trang QR của người nhận (FR-CHK-005)
    expect(screen.getByText('English')).toBeInTheDocument()
    expect(screen.getByText(/Gọi trước khi giao/)).toBeInTheDocument()
  })

  it('chỉ cho chọn trạng thái kế tiếp hợp lệ (§16)', async () => {
    mockApi(detail())
    renderAt('/admin/orders/LV2610-ACDEFGH')
    const select = await screen.findByLabelText('Chuyển trạng thái')
    expect([...select.options].map((o) => o.textContent)).toEqual(['Đang làm', 'Đã huỷ'])
  })

  it('đơn ở trạng thái cuối → không có ô chuyển trạng thái', async () => {
    mockApi(detail({ status: 'delivered', nextStatuses: [] }))
    renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByText('Đơn đã ở trạng thái cuối.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Chuyển trạng thái')).toBeNull()
  })

  it('cờ cần xử lý tay hiện lời giải thích cho admin', async () => {
    mockApi(detail({ paymentFlag: 'PAID_AFTER_CANCEL' }))
    renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByText(/Khách trả tiền sau khi đơn đã huỷ/)).toBeInTheDocument()
  })

  it('nút ghi nhận hoàn tiền chỉ hiện khi đơn chờ hoàn tiền (D-74)', async () => {
    mockApi(detail())
    renderAt('/admin/orders/LV2610-ACDEFGH')
    await screen.findByRole('heading', { name: 'LV2610-ACDEFGH' })
    expect(screen.queryByRole('button', { name: 'Đã hoàn tiền' })).toBeNull()
  })

  it('đơn chờ hoàn tiền: có nút ghi nhận + nhắc rằng chuyển khoản là thủ công', async () => {
    mockApi(detail({ paymentStatus: 'refund_pending', status: 'cancelled', nextStatuses: [] }))
    renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByRole('button', { name: 'Đã hoàn tiền' })).toBeInTheDocument()
    expect(screen.getByText(/thực hiện thủ công qua ngân hàng/)).toBeInTheDocument()
  })

  it('NFR-AUD-001: hiện nhật ký thay đổi', async () => {
    mockApi(
      detail({}, [
        { id: 2, at: '2026-10-01T04:00:00.000Z', actorRole: 'admin', action: 'status', newValue: { status: 'in_production' } },
        { id: 1, at: '2026-10-01T03:00:00.000Z', actorRole: 'customer', action: 'create', newValue: { code: 'LV2610-ACDEFGH' } },
      ]),
    )
    renderAt('/admin/orders/LV2610-ACDEFGH')
    await screen.findByRole('heading', { name: 'Nhật ký thay đổi' })
    expect(screen.getByText(/"status":"in_production"/)).toBeInTheDocument()
    expect(screen.getAllByText('status').length).toBeGreaterThan(0)
  })

  it('đổi trạng thái: gửi đúng trạng thái và mã vận đơn, rồi nạp lại đơn', async () => {
    const posts = []
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      ...detail({ status: 'packed', nextStatuses: ['shipped', 'cancelled'] }),
      'POST /admin/orders/LV2610-ACDEFGH/status': (url, init) => {
        posts.push(JSON.parse(init.body))
        return { body: { item: { ...order({ status: 'shipped', trackingCode: 'GHN1' }), nextStatuses: ['delivered'] } } }
      },
    })
    renderAt('/admin/orders/LV2610-ACDEFGH')
    fireEvent.change(await screen.findByLabelText('Mã vận đơn'), { target: { value: 'GHN1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(posts).toEqual([{ status: 'shipped', trackingCode: 'GHN1' }]))
    confirm.mockRestore()
  })
})

describe('Admin — coupon (§14, D-71)', () => {
  const coupons = [
    {
      id: 'c1',
      code: 'TET2026',
      type: 'percent',
      value: 10,
      maxDiscount: 200_000,
      usedCount: 3,
      usageLimit: 100,
      perUserLimit: 1,
      startsAt: null,
      endsAt: null,
      status: 'active',
    },
  ]

  it('danh sách: mã, loại, giá trị, lượt đã dùng, trạng thái', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/coupons': () => ({ body: { items: coupons } }) })
    renderAt('/admin/coupons')
    const row = (await screen.findByText('TET2026')).closest('tr')
    expect(within(row).getByText('Giảm theo %')).toBeInTheDocument()
    expect(within(row).getByText('10%')).toBeInTheDocument()
    expect(within(row).getByText('3 / 100')).toBeInTheDocument()
    expect(within(row).getByText('Đang áp dụng')).toBeInTheDocument()
  })

  it('form theo loại: % có ô "Giảm tối đa"; miễn phí ship không có ô giá trị', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/coupons': () => ({ body: { items: [] } }) })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    expect(screen.getByLabelText('Giảm tối đa (VND)')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'free_shipping' } })
    expect(screen.queryByLabelText('Giảm tối đa (VND)')).toBeNull()
    expect(screen.queryByLabelText('Giá trị')).toBeNull()

    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'amount' } })
    expect(screen.getByLabelText('Giá trị')).toBeInTheDocument()
    expect(screen.queryByLabelText('Giảm tối đa (VND)')).toBeNull()
  })

  it('tạo coupon: gửi số dạng số, ô trống thành null (không giới hạn)', async () => {
    const posts = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'POST /admin/coupons': (url, init) => {
        posts.push(JSON.parse(init.body))
        return { status: 201, body: { item: coupons[0] } }
      },
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'tet2026' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      code: 'tet2026',
      type: 'percent',
      value: 10,
      maxDiscount: null,
      minOrder: null,
      usageLimit: null,
      perUserLimit: 1,
      startsAt: null,
      endsAt: null,
    })
  })

  it('lỗi theo trường hiện ngay dưới ô tương ứng', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'POST /admin/coupons': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', fields: { code: 'INVALID_CODE' } } },
      }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'a' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Mã')).toHaveAccessibleDescription(
        'Mã chỉ gồm chữ in hoa và số, từ 3 đến 32 ký tự.',
      ),
    )
  })

  it('coupon đã dùng: xoá bị từ chối, hiện lời khuyên tắt thay vì xoá', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: coupons } }),
      'DELETE /admin/coupons/c1': () => ({ status: 409, body: { error: { code: 'COUPON_IN_USE' } } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Xoá' }))
    expect(await screen.findByText('Mã đã được dùng — hãy tắt thay vì xoá.')).toBeInTheDocument()
    confirm.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Kiểm thử độc lập (T-11) — quyền vào trang admin, xử lý lỗi API, form coupon
// ---------------------------------------------------------------------------

describe('Admin — quyền truy cập (D-38, D-51)', () => {
  it('khách (role customer) vào /admin/orders → báo không có quyền, KHÔNG gọi API đơn hàng', async () => {
    const calls = []
    mockApi({
      'GET /me': () => {
        calls.push('me')
        return { body: { profile: { id: 'u9', email: 'khach@lamvi.test', role: 'customer', preferredLocale: 'vi' } } }
      },
      'GET /admin/orders': () => {
        calls.push('orders')
        return { body: { items: [] } }
      },
    })
    renderAt('/admin/orders')
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
    expect(calls).not.toContain('orders')
    expect(screen.queryByRole('link', { name: 'Đơn hàng' })).toBeNull()
  })

  it('khách vào /admin/coupons → báo không có quyền', async () => {
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u9', email: 'k@lamvi.test', role: 'customer', preferredLocale: 'vi' } } }),
    })
    renderAt('/admin/coupons')
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('chưa đăng nhập → chuyển sang trang đăng nhập, không gọi /me', async () => {
    localStorage.clear()
    const fetchMock = mockApi({ 'GET /me': me })
    renderAt('/admin/orders')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.map(([u]) => String(u))).not.toContain('/api/me')
  })

  it('/me lỗi → không cho vào (không mặc định là admin)', async () => {
    mockApi({ 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin/orders')
    expect(await screen.findByText('Không có quyền truy cập')).toBeInTheDocument()
  })

  it('vai trò IT vào được và thấy link dashboard IT', async () => {
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u2', email: 'it@lamvi.test', role: 'it', preferredLocale: 'vi' } } }),
      'GET /admin/orders': () => ({ body: { items: [] } }),
    })
    renderAt('/admin/orders')
    expect(await screen.findByText('Chưa có đơn nào.')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Dashboard IT' })).toBeInTheDocument()
  })
})

describe('Admin — lỗi API hiện đúng chỗ', () => {
  it('danh sách đơn lỗi → thông báo lỗi, không hiện bảng', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/orders': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin/orders')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra. Vui lòng thử lại sau.')
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('chi tiết đơn không tồn tại → thông báo lỗi thay cho nội dung đơn', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV2610-KHONGCO': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }),
    })
    renderAt('/admin/orders/LV2610-KHONGCO')
    expect(await screen.findByRole('alert')).toHaveTextContent('Không tìm thấy.')
  })

  it('đổi trạng thái thất bại → hiện lỗi, giữ nguyên đơn trên màn hình', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item: order({ nextStatuses: ['in_production'] }), audit: [] } }),
      'POST /admin/orders/LV2610-ACDEFGH/status': () => ({
        status: 409,
        body: { error: { code: 'INVALID_STATUS_CHANGE' } },
      }),
    })
    renderAt('/admin/orders/LV2610-ACDEFGH')
    fireEvent.click(await screen.findByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
    expect(screen.getByRole('heading', { name: 'LV2610-ACDEFGH' })).toBeInTheDocument()
    confirm.mockRestore()
  })

  it('huỷ ở hộp xác nhận → không gọi API đổi trạng thái', async () => {
    const posts = []
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item: order({ nextStatuses: ['in_production'] }), audit: [] } }),
      'POST /admin/orders/LV2610-ACDEFGH/status': () => (posts.push(1), { body: { item: order() } }),
    })
    renderAt('/admin/orders/LV2610-ACDEFGH')
    fireEvent.click(await screen.findByRole('button', { name: 'Cập nhật' }))
    expect(posts).toHaveLength(0)
    confirm.mockRestore()
  })
})

describe('Admin — coupon: danh sách rỗng, lỗi và form đổi loại', () => {
  const c1 = {
    id: 'c1',
    code: 'TET2026',
    type: 'percent',
    value: 10,
    maxDiscount: 200_000,
    usedCount: 0,
    usageLimit: null,
    perUserLimit: 1,
    startsAt: '2026-10-01T03:30:00.000Z',
    endsAt: '2026-12-31T16:59:00.000Z',
    status: 'active',
  }

  it('chưa có mã nào → câu thông báo, không hiện bảng rỗng', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/coupons': () => ({ body: { items: [] } }) })
    renderAt('/admin/coupons')
    expect(await screen.findByText('Chưa có mã giảm giá nào.')).toBeInTheDocument()
    expect(screen.queryByRole('table')).toBeNull()
  })

  it('tải danh sách lỗi → thông báo lỗi', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/coupons': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin/coupons')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra. Vui lòng thử lại sau.')
  })

  it('đổi loại nhiều lần: giá trị đã nhập được giữ, ô "Giảm tối đa" chỉ có ở mã %', async () => {
    const posts = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'POST /admin/coupons': (url, init) => (posts.push(JSON.parse(init.body)), { status: 201, body: { item: c1 } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'TET2026' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Giảm tối đa (VND)'), { target: { value: '200000' } })

    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'amount' } })
    expect(screen.queryByLabelText('Giảm tối đa (VND)')).toBeNull()
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'percent' } })
    // Giá trị cũ vẫn còn sau khi quay lại loại %
    expect(screen.getByLabelText('Giá trị')).toHaveValue(10)
    expect(screen.getByLabelText('Giảm tối đa (VND)')).toHaveValue(200000)

    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({ type: 'percent', value: 10, maxDiscount: 200_000 })
  })

  it('chuyển sang "miễn phí vận chuyển": body không gửi value, maxDiscount về null', async () => {
    const posts = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'POST /admin/coupons': (url, init) => (posts.push(JSON.parse(init.body)), { status: 201, body: { item: c1 } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'FREESHIP' } })
    fireEvent.change(screen.getByLabelText('Giá trị'), { target: { value: '10' } })
    fireEvent.change(screen.getByLabelText('Loại'), { target: { value: 'free_shipping' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).not.toHaveProperty('value')
    expect(posts[0].maxDiscount).toBeNull()
  })

  it('sửa mã có sẵn: PATCH đúng id, không gửi kèm id/usedCount', async () => {
    const patches = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [c1] } }),
      'PATCH /admin/coupons/c1': (url, init) => (patches.push(JSON.parse(init.body)), { body: { item: c1 } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0]).not.toHaveProperty('id')
    expect(patches[0]).not.toHaveProperty('usedCount')
  })

  // datetime-local dùng giờ địa phương; mở form rồi lưu lại không được làm lệch mốc thời gian
  it('sửa rồi lưu lại không đổi mốc thời gian (datetime-local ↔ ISO, làm tròn tới phút)', async () => {
    const patches = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [c1] } }),
      'PATCH /admin/coupons/c1': (url, init) => (patches.push(JSON.parse(init.body)), { body: { item: c1 } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(Date.parse(patches[0].startsAt)).toBe(Date.parse(c1.startsAt))
    expect(Date.parse(patches[0].endsAt)).toBe(Date.parse(c1.endsAt))
  })

  it('xoá mốc thời gian (ô trống) → gửi null', async () => {
    const patches = []
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [c1] } }),
      'PATCH /admin/coupons/c1': (url, init) => (patches.push(JSON.parse(init.body)), { body: { item: c1 } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Sửa' }))
    fireEvent.change(screen.getByLabelText('Bắt đầu'), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText('Kết thúc'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(patches).toHaveLength(1))
    expect(patches[0].startsAt).toBeNull()
    expect(patches[0].endsAt).toBeNull()
  })

  it('lỗi chung (không theo trường) hiện một thông báo ở form', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items: [] } }),
      'POST /admin/coupons': () => ({ status: 409, body: { error: { code: 'CODE_TAKEN' } } }),
    })
    renderAt('/admin/coupons')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Mã'), { target: { value: 'TET2026' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(screen.getAllByRole('alert').length).toBeGreaterThan(0))
  })
})

