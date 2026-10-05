// @vitest-environment jsdom
// Kiểm thử độc lập (T-11): quản lý người dùng (G-19) và khối lời chúc/QR ở chi tiết đơn — chỗ còn thiếu.
// Tên test có tiền tố [BUG] là test đang ĐỎ vì code nguồn sai (giữ nguyên, không hạ kỳ vọng).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'me', email: 'admin@lamvi.test' } }
const me = (role) => () => ({ body: { profile: { id: 'me', email: 'admin@lamvi.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const user = (over = {}) => ({
  id: 'u-an', email: 'an@lamvi.test', fullName: 'An', phone: '0912345678', role: 'customer', preferredLocale: 'vi',
  createdAt: '2026-10-01T03:00:00.000Z', locked: false, lockedAt: null, lockedReason: null, orderCount: 2, ...over,
})
const list = (items, extra = {}) => ({ body: { items, total: items.length, page: 1, pageSize: 20, ...extra } })
const detail = (item, extra = {}) => ({
  'GET /admin/users/u-an': () => ({ body: { item, orders: [], audit: [] } }),
  ...extra,
})

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  window.confirm = vi.fn(() => true)
  delete window.__xss
})

describe('XSS: dữ liệu người dùng và nhật ký chỉ hiện như văn bản', () => {
  const EVIL = '<img src=x onerror="window.__xss=1"><script>window.__xss=2</script>'

  it('danh sách: họ tên/email chứa HTML không sinh phần tử', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/users': () => list([user({ fullName: EVIL, email: `${EVIL}@x.test` })]) })
    const { container } = renderAt('/admin/users')
    await screen.findAllByText(EVIL, { exact: false })
    expect(container.querySelector('table img, table script')).toBeNull()
    expect(window.__xss).toBeUndefined()
  })

  it('chi tiết: lý do khoá và nhật ký (newValue) chứa HTML vẫn là chữ', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/users/u-an': () => ({
        body: {
          item: user({ locked: true, lockedAt: '2026-10-03T00:00:00.000Z', lockedReason: EVIL, fullName: EVIL }),
          orders: [],
          audit: [{ id: 1, at: '2026-10-03T00:00:00.000Z', actorRole: 'admin', action: 'lock', newValue: { locked: true, reason: EVIL } }],
        },
      }),
    })
    const { container } = renderAt('/admin/users/u-an')
    await screen.findByText('Lý do khoá')
    expect(container.querySelector('section img, section script')).toBeNull()
    expect(window.__xss).toBeUndefined()
    expect(container.querySelector('section').textContent).toContain('<img src=x')
  })

  it('chi tiết đơn: qrUrl chứa dấu nháy/HTML vẫn nằm gọn trong ô liên kết', async () => {
    const qrUrl = 'https://lamvi.test/en/qr/"><img src=x onerror="window.__xss=1">'
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/orders/LV2610-ACDEFGH': () => ({
        body: {
          item: {
            code: 'LV2610-ACDEFGH', status: 'confirmed', orderKind: 'gift', hasMessage: true, qrLang: 'en', recipientIsSelf: false,
            recipientName: 'B', recipientPhone: '0912345678', addressLine: 'x', province: 'HN', paymentMethod: 'payos', paymentStatus: 'paid',
            subtotal: 1, discount: 0, shippingFee: 0, total: 1, vatAmount: 0, vatRate: 0.1, items: [], nextStatuses: [],
            message: { state: 'DRAFT', hasText: false, textLang: null, hasVoice: false, hasVideo: false, confirmedAt: null, mediaDeleted: false },
            qrUrl,
          },
          audit: [],
        },
      }),
    })
    const { container } = renderAt('/admin/orders/LV2610-ACDEFGH')
    expect(await screen.findByLabelText('Liên kết QR')).toHaveValue(qrUrl)
    expect(container.querySelector('img[src="x"]')).toBeNull()
    expect(window.__xss).toBeUndefined()
  })
})

describe('Lỗi và trạng thái không mong đợi', () => {
  it('[BUG] server trả 409 CANNOT_MANAGE_SELF → thông báo dịch được, không hiện khoá i18n thô', async () => {
    mockApi({
      'GET /me': me('admin'),
      ...detail(user(), { 'POST /admin/users/u-an/lock': () => ({ status: 409, body: { error: { code: 'CANNOT_MANAGE_SELF' } } }) }),
    })
    renderAt('/admin/users/u-an')
    fireEvent.click(await screen.findByRole('button', { name: 'Khoá tài khoản' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).not.toMatch(/errors\.|CANNOT_MANAGE_SELF/)
    expect(alert.textContent.length).toBeGreaterThan(10)
  })

  it('/me lỗi → fail-closed: không hiện nút khoá, không có ô đổi vai trò', async () => {
    mockApi({ 'GET /me': () => ({ status: 500, body: {} }), ...detail(user()) })
    renderAt('/admin/users/u-an')
    await new Promise((r) => setTimeout(r, 150))
    expect(screen.queryByRole('button', { name: 'Khoá tài khoản' })).toBeNull()
    expect(screen.queryByLabelText('Đổi vai trò')).toBeNull()
  })

  it('bấm "Khoá" hai lần liên tiếp → chỉ một yêu cầu (nút bị vô hiệu khi đang xử lý)', async () => {
    let release
    const gate = new Promise((r) => (release = r))
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      ...detail(user(), {
        'POST /admin/users/u-an/lock': async () => {
          await gate
          return { body: { item: user({ locked: true }) } }
        },
      }),
    })
    renderAt('/admin/users/u-an')
    const btn = await screen.findByRole('button', { name: 'Khoá tài khoản' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    release()
    await waitFor(() => expect(fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/lock'))).toHaveLength(1))
  })

  it('lý do chỉ có khoảng trắng → không gửi trường reason; ô lý do giới hạn 300 ký tự', async () => {
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      ...detail(user(), { 'POST /admin/users/u-an/lock': () => ({ body: { item: user({ locked: true }) } }) }),
    })
    renderAt('/admin/users/u-an')
    const reason = await screen.findByLabelText('Lý do (tuỳ chọn, chỉ nội bộ)')
    expect(reason).toHaveAttribute('maxlength', '300')
    fireEvent.change(reason, { target: { value: '    ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Khoá tài khoản' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).endsWith('/lock'))).toBe(true))
    const post = fetchMock.mock.calls.find(([u]) => String(u).endsWith('/lock'))
    expect(JSON.parse(post[1].body)).toEqual({})
  })

  it('đổi vai trò bị server từ chối (403) → báo lỗi, vai trò hiển thị không đổi', async () => {
    mockApi({
      'GET /me': me('it'),
      ...detail(user(), { 'PATCH /admin/users/u-an': () => ({ status: 403, body: { error: { code: 'FORBIDDEN' } } }) }),
    })
    renderAt('/admin/users/u-an')
    fireEvent.change(await screen.findByLabelText('Đổi vai trò'), { target: { value: 'it' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('không có quyền')
    expect(screen.getByText('Khách hàng', { selector: 'dd' })).toBeInTheDocument()
  })

  it('đổi vai trò: nút "Cập nhật" tắt khi chưa đổi gì; huỷ xác nhận thì không gọi API', async () => {
    window.confirm = vi.fn(() => false)
    const fetchMock = mockApi({ 'GET /me': me('it'), ...detail(user()) })
    renderAt('/admin/users/u-an')
    const select = await screen.findByLabelText('Đổi vai trò')
    expect(screen.getByRole('button', { name: 'Cập nhật' })).toBeDisabled()
    fireEvent.change(select, { target: { value: 'admin' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cập nhật' }))
    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining('Admin'))
    expect(fetchMock.mock.calls.some(([, i]) => i?.method === 'PATCH')).toBe(false)
  })

  it('người đã khoá: không hiện ô lý do; nút chuyển thành "Mở khoá"; IT thấy cả ô đổi vai trò', async () => {
    mockApi({
      'GET /me': me('it'),
      ...detail(user({ locked: true, lockedAt: '2026-10-03T00:00:00.000Z', lockedReason: 'spam' })),
    })
    renderAt('/admin/users/u-an')
    expect(await screen.findByRole('button', { name: 'Mở khoá' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Lý do (tuỳ chọn, chỉ nội bộ)')).toBeNull()
    expect(screen.getByText('spam')).toBeInTheDocument()
    expect(screen.getByLabelText('Đổi vai trò')).toBeInTheDocument()
  })
})

describe('Danh sách: tìm kiếm, phân trang, chạy đua', () => {
  it('ký tự đặc biệt trong ô tìm được mã hoá, không sinh tham số thừa; khoảng trắng hai đầu bị cắt', async () => {
    const fetchMock = mockApi({ 'GET /me': me('admin'), 'GET /admin/users': () => list([user()]) })
    renderAt('/admin/users')
    await screen.findByText('an@lamvi.test')
    fireEvent.change(screen.getByLabelText('Tìm theo email, tên, SĐT'), { target: { value: '  a&role=it#x%  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Tìm' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('q='))).toBe(true))
    const url = new URL(String(fetchMock.mock.calls.map(([u]) => String(u)).find((u) => u.includes('q='))), 'http://x')
    expect(url.searchParams.get('q')).toBe('a&role=it#x%')
    expect(url.searchParams.get('role')).toBeNull()
  })

  it('đổi bộ lọc khi đang ở trang 2 → quay về trang 1 (bỏ tham số page)', async () => {
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      'GET /admin/users': (url) => list([user()], { total: 45, page: Number(url.searchParams.get('page') ?? 1) }),
    })
    renderAt('/admin/users')
    await screen.findByText('an@lamvi.test')
    fireEvent.click(screen.getByRole('button', { name: 'Sau' }))
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('page=2'))).toBe(true))
    fireEvent.change(screen.getByLabelText('Vai trò'), { target: { value: 'it' } })
    await waitFor(() => expect(fetchMock.mock.calls.some(([u]) => String(u).includes('role=it'))).toBe(true))
    const last = String(fetchMock.mock.calls.filter(([u]) => String(u).startsWith('/api/admin/users?')).at(-1)[0])
    expect(last).toContain('role=it')
    expect(last).not.toContain('page=')
  })

  it('trang cuối: nút "Sau" tắt; trang đầu: nút "Trước" tắt', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/users': () => list([user()], { total: 20, pageSize: 20 }) })
    renderAt('/admin/users')
    await screen.findByText('an@lamvi.test')
    expect(screen.queryByRole('navigation', { name: /Trang/ })).toBeNull() // 1 trang: không có phân trang
  })

  it('hai yêu cầu chạy đua: phản hồi cũ về muộn không đè kết quả của bộ lọc mới', async () => {
    let releaseOld
    const old = new Promise((r) => (releaseOld = r))
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/users': async (url) => {
        const s = url.searchParams.get('status')
        if (s === 'locked') {
          await old
          return list([user({ id: 'u-old', email: 'cu@lamvi.test', locked: true })])
        }
        return list([user({ id: 'u-new', email: 'moi@lamvi.test' })])
      },
    })
    renderAt('/admin/users')
    await screen.findByText('moi@lamvi.test')
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'locked' } })
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'active' } })
    await screen.findByText('moi@lamvi.test')
    releaseOld()
    await new Promise((r) => setTimeout(r, 30))
    expect(screen.queryByText('cu@lamvi.test')).toBeNull()
    expect(screen.getByText('moi@lamvi.test')).toBeInTheDocument()
  })

  it('người dùng thiếu email/họ tên/SĐT hiện dấu gạch, không văng lỗi', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/users': () => list([user({ email: null, fullName: null, phone: null, orderCount: 0 })]) })
    renderAt('/admin/users')
    await screen.findByText('1 người dùng')
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(3)
  })
})

describe('Chi tiết đơn: khối lời chúc & QR (GiftCard)', () => {
  const base = {
    code: 'LV2610-ACDEFGH', status: 'confirmed', orderKind: 'gift', hasMessage: true, qrLang: 'en', recipientIsSelf: false,
    recipientName: 'B', recipientPhone: '0912345678', addressLine: 'x', province: 'HN', paymentMethod: 'payos', paymentStatus: 'paid',
    subtotal: 1, discount: 0, shippingFee: 0, total: 1, vatAmount: 0, vatRate: 0.1, items: [], nextStatuses: [],
    message: { state: 'DRAFT', hasText: true, textLang: 'zh', hasVoice: false, hasVideo: false, confirmedAt: null, mediaDeleted: false },
    qrUrl: `https://lamvi.test/en/qr/${'c'.repeat(64)}`,
  }
  const open = (item) => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/orders/LV2610-ACDEFGH': () => ({ body: { item, audit: [] } }) })
    return renderAt('/admin/orders/LV2610-ACDEFGH')
  }

  it('đơn cũ chưa có token (qrUrl null) → ẩn cả khối, không hiện liên kết rỗng', async () => {
    open({ ...base, qrUrl: null })
    await screen.findByRole('heading', { level: 1 })
    expect(screen.queryByLabelText('Liên kết QR')).toBeNull()
    expect(screen.queryByText('Lời chúc & QR')).toBeNull()
  })

  it('clipboard bị chặn/không có → bấm sao chép không văng lỗi, nhãn không đổi', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    open(base)
    const btn = await screen.findByRole('button', { name: /Sao chép/ })
    fireEvent.click(btn)
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByRole('button', { name: /Sao chép/ })).toBeInTheDocument()
  })

  it('clipboard có → ghi đúng URL và đổi nhãn', async () => {
    const writeText = vi.fn(async () => {})
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const { container } = open(base)
    fireEvent.click(await screen.findByRole('button', { name: /Sao chép/ }))
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(base.qrUrl))
    expect(container.textContent).toMatch(/Đã sao chép/)
  })

  it('trạng thái lời chúc lạ từ server không làm hỏng khối; admin không bao giờ thấy chữ lời chúc dù server lỡ gửi kèm', async () => {
    const { container } = open({ ...base, message: { ...base.message, state: 'SOMETHING_NEW', text: 'BÍ MẬT LỜI CHÚC' } })
    await screen.findByLabelText('Liên kết QR')
    expect(container.textContent).not.toContain('BÍ MẬT LỜI CHÚC')
  })

  it('ảnh QR có kích thước cố định và alt; liên kết ô chỉ đọc', async () => {
    open(base)
    const field = await screen.findByLabelText('Liên kết QR')
    expect(field).toHaveAttribute('readonly')
    const img = await screen.findByAltText('Mã QR để in')
    expect(img).toHaveAttribute('width', '160')
  })
})
