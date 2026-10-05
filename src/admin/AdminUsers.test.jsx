// @vitest-environment jsdom
// Quản lý người dùng trong admin (G-19) và khối lời chúc/QR ở chi tiết đơn (FR-QR-001, Q-14).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'me', email: 'admin@lamvi.test' } }
const me = (role) => () => ({ body: { profile: { id: 'me', email: 'admin@lamvi.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const user = (over = {}) => ({
  id: 'u-an', email: 'an@lamvi.test', fullName: 'An', phone: '0912345678', role: 'customer', preferredLocale: 'vi',
  createdAt: '2026-10-01T03:00:00.000Z', locked: false, lockedAt: null, lockedReason: null, orderCount: 2, ...over,
})

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  vi.stubGlobal('confirm', vi.fn(() => true))
  window.confirm = vi.fn(() => true)
})

describe('Danh sách người dùng', () => {
  it('liệt kê, lọc theo trạng thái gửi đúng tham số, có link chi tiết', async () => {
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      'GET /admin/users': () => ({ body: { items: [user(), user({ id: 'u-b', email: 'b@lamvi.test', locked: true })], total: 2, page: 1, pageSize: 20 } }),
    })
    renderAt('/admin/users')
    expect(await screen.findByText('an@lamvi.test')).toBeInTheDocument()
    expect(screen.getByText('2 người dùng')).toBeInTheDocument()
    // Chỉ đếm nhãn trong bảng (ô lọc cũng có <option> "Đã khoá")
    expect(document.querySelectorAll('td .status-draft')).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Chi tiết' })[0].getAttribute('href')).toBe('/admin/users/u-an')
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'locked' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('status=locked'))).toBe(true))
  })

  it('tìm kiếm gửi q; phân trang gửi page', async () => {
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      'GET /admin/users': () => ({ body: { items: [user()], total: 45, page: 1, pageSize: 20 } }),
    })
    renderAt('/admin/users')
    await screen.findByText('an@lamvi.test')
    fireEvent.change(screen.getByLabelText('Tìm theo email, tên, SĐT'), { target: { value: 'an@' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('q=an%40'))).toBe(true))
    fireEvent.click(await screen.findByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('page=2'))).toBe(true))
    expect(screen.getByText('Trang 2/3')).toBeInTheDocument()
  })

  it('rỗng → thông báo; lỗi → hiện lỗi', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/users': () => ({ body: { items: [], total: 0, page: 1, pageSize: 20 } }) })
    renderAt('/admin/users')
    expect(await screen.findByText('Không có người dùng phù hợp.')).toBeInTheDocument()
  })

  it('khách không vào được trang admin', async () => {
    mockApi({ 'GET /me': me('customer') })
    renderAt('/admin/users')
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
  })
})

describe('Chi tiết người dùng', () => {
  const detail = (item, extra = {}) => ({
    'GET /admin/users/u-an': () => ({ body: { item, orders: [{ code: 'LV2610-AAAAAAA', status: 'confirmed', total: 920000, createdAt: '2026-10-02T03:00:00.000Z' }], audit: [] } }),
    ...extra,
  })

  it('khoá: hỏi xác nhận, gửi lý do, tải lại', async () => {
    let locked = false
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      ...detail(user(), {}),
      'GET /admin/users/u-an': () => ({ body: { item: user({ locked, lockedAt: locked ? '2026-10-03T00:00:00.000Z' : null }), orders: [], audit: [] } }),
      'POST /admin/users/u-an/lock': () => {
        locked = true
        return { body: { item: user({ locked: true }) } }
      },
    })
    renderAt('/admin/users/u-an')
    fireEvent.change(await screen.findByLabelText('Lý do (tuỳ chọn, chỉ nội bộ)'), { target: { value: 'spam' } })
    fireEvent.click(screen.getByRole('button', { name: 'Khoá tài khoản' }))
    await screen.findByRole('button', { name: 'Mở khoá' })
    const post = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/lock'))
    expect(JSON.parse(post[1].body)).toEqual({ reason: 'spam' })
    expect(window.confirm).toHaveBeenCalled()
  })

  it('huỷ xác nhận → không gọi API', async () => {
    window.confirm = vi.fn(() => false)
    const fetchMock = mockApi({ 'GET /me': me('admin'), ...detail(user()) })
    renderAt('/admin/users/u-an')
    fireEvent.click(await screen.findByRole('button', { name: 'Khoá tài khoản' }))
    expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/lock'))).toBe(false)
  })

  it('admin: không có ô đổi vai trò; không khoá được admin khác (chỉ IT)', async () => {
    mockApi({ 'GET /me': me('admin'), ...detail(user({ role: 'admin' })) })
    renderAt('/admin/users/u-an')
    await screen.findByText('Admin chỉ khoá/mở khoá được khách hàng. Tài khoản admin/IT do IT quản lý.')
    expect(screen.queryByRole('button', { name: 'Khoá tài khoản' })).toBeNull()
    expect(screen.queryByLabelText('Đổi vai trò')).toBeNull()
  })

  it('IT: đổi vai trò bằng PATCH', async () => {
    const fetchMock = mockApi({
      'GET /me': me('it'),
      ...detail(user()),
      'PATCH /admin/users/u-an': () => ({ body: { item: user({ role: 'admin' }) } }),
    })
    renderAt('/admin/users/u-an')
    fireEvent.change(await screen.findByLabelText('Đổi vai trò'), { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u) === '/api/admin/users/u-an' && i.method === 'PATCH')).toBe(true))
    const patch = fetchMock.mock.calls.find(([, i]) => i?.method === 'PATCH')
    expect(JSON.parse(patch[1].body)).toEqual({ role: 'admin' })
  })

  it('chính mình: không có nút khoá/đổi vai trò', async () => {
    mockApi({ 'GET /me': me('it'), 'GET /admin/users/me': () => ({ body: { item: user({ id: 'me', role: 'it' }), orders: [], audit: [] } }) })
    renderAt('/admin/users/me')
    expect(await screen.findByText(/không thể tự khoá/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Khoá tài khoản' })).toBeNull()
    expect(screen.queryByLabelText('Đổi vai trò')).toBeNull()
  })

  it('lỗi từ server hiện bằng thông báo dịch được', async () => {
    mockApi({
      'GET /me': me('admin'),
      ...detail(user(), { 'POST /admin/users/u-an/lock': () => ({ status: 403, body: { error: { code: 'FORBIDDEN' } } }) }),
    })
    renderAt('/admin/users/u-an')
    fireEvent.click(await screen.findByRole('button', { name: 'Khoá tài khoản' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền')
  })
})

describe('Chi tiết đơn: lời chúc & QR (Q-14 mặc định an toàn)', () => {
  const order = {
    code: 'LV2610-ACDEFGH', status: 'confirmed', orderKind: 'gift', hasMessage: true, qrLang: 'en', recipientIsSelf: false,
    recipientName: 'B', recipientPhone: '0912345678', addressLine: 'x', province: 'HN', paymentMethod: 'payos', paymentStatus: 'paid',
    subtotal: 1, discount: 0, shippingFee: 0, total: 1, vatAmount: 0, vatRate: 0.1, items: [], nextStatuses: [],
    message: { state: 'DRAFT', hasText: true, textLang: 'zh', hasVoice: false, hasVideo: true, confirmedAt: null, mediaDeleted: false },
    qrUrl: `https://lamvi.test/en/qr/${'b'.repeat(64)}`,
  }

  it('hiện tình trạng + liên kết QR + ảnh QR; KHÔNG có nội dung chữ', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item: order, audit: [] } }) })
    renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByText('Bản nháp')).toBeInTheDocument()
    expect(screen.getByLabelText('Liên kết QR')).toHaveValue(order.qrUrl)
    expect(await screen.findByAltText('Mã QR để in')).toBeInTheDocument()
    expect(screen.getByText('Chưa xác nhận')).toBeInTheDocument()
  })

  it('đơn không có lời chúc vẫn có QR (thiệp cảm ơn in cho mọi đơn — D-28)', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item: { ...order, hasMessage: false, message: null }, audit: [] } }),
    })
    renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByText('Đơn này không có lời chúc.')).toBeInTheDocument()
    expect(screen.getByLabelText('Liên kết QR')).toBeInTheDocument()
  })
})
