// @vitest-environment jsdom
// Danh sách đơn: tải một lần, lọc ở client (chip + số, tìm kiếm), nút chuyển bước kế, chi tiết ở bên phải
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const order = (code, over = {}) => ({
  code,
  status: 'confirmed',
  recipientName: 'Người nhận',
  recipientPhone: '0900000000',
  paymentMethod: 'payos',
  paymentStatus: 'paid',
  paymentFlag: null,
  total: 1_000_000,
  createdAt: '2026-10-01T03:00:00.000Z',
  nextStatuses: ['in_production', 'cancelled'],
  ...over,
})
const items = [
  order('LV-AAA', { recipientName: 'Trần Thị Bích', recipientPhone: '0912345678' }),
  order('LV-BBB', { recipientName: 'Lê Văn Cường', recipientPhone: '0987654321' }),
  order('LV-CCC', { status: 'shipped', paymentMethod: 'cod', paymentStatus: 'pending', recipientName: 'Phạm Dung', nextStatuses: ['delivered', 'delivery_failed'] }),
  order('LV-DDD', { status: 'cancelled', paymentFlag: 'AMOUNT_MISMATCH', recipientName: 'Hoàng Em', nextStatuses: [] }),
]

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => vi.restoreAllMocks())

function setup(extra = {}) {
  const fetchMock = mockApi({
    'GET /me': me,
    'GET /admin/orders': () => ({ body: { items } }),
    'GET /admin/returns': () => ({ body: { items: [] } }),
    ...extra,
  })
  const listCalls = () => fetchMock.mock.calls.filter(([u, init = {}]) => (init.method || 'GET') === 'GET' && new URL(u, 'http://x').pathname === '/api/admin/orders')
  return { fetchMock, listCalls }
}
const chipNames = () => [...document.querySelectorAll('.chip')].map((c) => c.textContent)
const rows = () => [...document.querySelectorAll('.orders-table tbody tr')].map((r) => r.querySelector('code').textContent)

describe('OrdersPage — chip và tìm kiếm', () => {
  it('chip kèm số lượng; ẩn chip có 0 (trừ "Tất cả"); không còn select trạng thái', async () => {
    setup()
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    expect(chipNames()).toEqual(['Tất cả4', 'Đã xác nhận2', 'Đang giao1', 'Đã huỷ1', 'COD chưa thu1', 'Có cờ1'])
    expect(document.querySelector('select')).toBeNull()
    expect(document.querySelector('.chip b')).not.toBeNull()
  })

  it('bấm chip lọc ngay ở client, không gọi lại API; "Tất cả" trả về đủ', async () => {
    const { listCalls } = setup()
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    const before = listCalls().length
    fireEvent.click(screen.getByRole('button', { name: /^Đã xác nhận/ }))
    expect(rows()).toEqual(['LV-AAA', 'LV-BBB'])
    fireEvent.click(screen.getByRole('button', { name: /^COD chưa thu/ }))
    expect(rows()).toEqual(['LV-CCC'])
    fireEvent.click(screen.getByRole('button', { name: /^Có cờ/ }))
    expect(rows()).toEqual(['LV-DDD'])
    fireEvent.click(screen.getByRole('button', { name: /^Tất cả/ }))
    expect(rows()).toHaveLength(4)
    expect(listCalls()).toHaveLength(before)
  })

  it('?loc=confirmed mở sẵn chip tương ứng; chip đang chọn vẫn hiện dù đếm 0', async () => {
    setup()
    renderAt('/admin/orders?loc=confirmed')
    await screen.findByText('LV-AAA')
    expect(rows()).toEqual(['LV-AAA', 'LV-BBB'])
    expect(screen.getByRole('button', { name: /^Đã xác nhận/ })).toHaveAttribute('aria-pressed', 'true')
  })

  it('?loc=packed (không có đơn nào) → chip đang chọn vẫn hiện với số 0', async () => {
    setup()
    renderAt('/admin/orders?loc=packed')
    await screen.findByText('Chưa có đơn nào.')
    expect(screen.getByRole('button', { name: 'Đã đóng gói0' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('tìm theo mã, tên hoặc số điện thoại (không phân biệt hoa thường)', async () => {
    setup()
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    const box = screen.getByRole('searchbox', { name: 'Tìm theo mã, tên hoặc số điện thoại' })
    expect(box).toHaveAttribute('type', 'search')
    fireEvent.change(box, { target: { value: 'lv-bbb' } })
    expect(rows()).toEqual(['LV-BBB'])
    fireEvent.change(box, { target: { value: 'bích' } })
    expect(rows()).toEqual(['LV-AAA'])
    fireEvent.change(box, { target: { value: '0987' } })
    expect(rows()).toEqual(['LV-BBB'])
    fireEvent.change(box, { target: { value: 'không có' } })
    expect(screen.getByText('Chưa có đơn nào.')).toBeInTheDocument()
    fireEvent.change(box, { target: { value: '' } })
    expect(rows()).toHaveLength(4)
  })

  it('tìm kiếm kết hợp với chip', async () => {
    setup()
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    fireEvent.click(screen.getByRole('button', { name: /^Đã xác nhận/ }))
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'Phạm' } })
    expect(screen.getByText('Chưa có đơn nào.')).toBeInTheDocument()
  })
})

describe('OrdersPage — nút chuyển bước kế', () => {
  const rowOf = (code) => screen.getByText(code).closest('tr')

  it('mỗi hàng có "→ {trạng thái kế}" (bỏ qua huỷ / giao thất bại) và link "Chi tiết"; đơn không còn bước kế thì không có nút', async () => {
    setup()
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    expect(within(rowOf('LV-AAA')).getByRole('button', { name: '→ Đang làm' })).toHaveClass('btn-primary')
    expect(within(rowOf('LV-CCC')).getByRole('button', { name: /^→ / })).toBeInTheDocument()
    expect(within(rowOf('LV-DDD')).queryByRole('button')).toBeNull()
    expect(within(rowOf('LV-AAA')).getByRole('link', { name: 'Chi tiết' })).toHaveAttribute('href', '/admin/orders/LV-AAA')
  })

  it('bấm nút → confirm → POST /status với trạng thái kế, rồi tải lại danh sách', async () => {
    const posts = []
    let version = 0
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { listCalls } = setup({
      'GET /admin/orders': () => ({ body: { items: version ? items.map((o) => (o.code === 'LV-AAA' ? { ...o, status: 'in_production', nextStatuses: ['packed'] } : o)) : items } }),
      'POST /admin/orders/LV-AAA/status': (url, init) => {
        posts.push(JSON.parse(init.body))
        version = 1
        return { body: { ok: true } }
      },
    })
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    const before = listCalls().length
    fireEvent.click(within(rowOf('LV-AAA')).getByRole('button', { name: '→ Đang làm' }))
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(confirm.mock.calls[0][0]).toContain('LV-AAA')
    expect(confirm.mock.calls[0][0]).toContain('Đang làm')
    await waitFor(() => expect(posts).toEqual([{ status: 'in_production', trackingCode: null }]))
    await waitFor(() => expect(listCalls().length).toBeGreaterThan(before))
    expect(await within(rowOf('LV-AAA')).findByRole('button', { name: /^→ / })).not.toHaveTextContent('Đang làm')
    expect(window.location.pathname).not.toContain('LV-AAA') // bấm nút không điều hướng vào chi tiết
  })

  it('huỷ ở hộp xác nhận → không gọi POST', async () => {
    const posts = []
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    setup({ 'POST /admin/orders/LV-AAA/status': () => (posts.push(1), { body: {} }) })
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    fireEvent.click(within(rowOf('LV-AAA')).getByRole('button', { name: '→ Đang làm' }))
    await new Promise((r) => setTimeout(r, 30))
    expect(posts).toHaveLength(0)
  })

  it('POST lỗi → hiện thông báo lỗi, danh sách giữ nguyên', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    setup({ 'POST /admin/orders/LV-AAA/status': () => ({ status: 409, body: { error: { code: 'INVALID_STATUS_CHANGE' } } }) })
    renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    fireEvent.click(within(rowOf('LV-AAA')).getByRole('button', { name: '→ Đang làm' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(rows()).toHaveLength(4)
  })
})

describe('OrdersPage — chi tiết bên phải', () => {
  it('không có :code → không có aside; bấm hàng → /admin/orders/:code', async () => {
    setup({ 'GET /admin/orders/LV-BBB': () => ({ body: { item: { ...order('LV-BBB'), items: [], vatRate: 0.1, vatAmount: 0, subtotal: 0, shippingFee: 0 }, audit: [] } }) })
    const { container } = renderAt('/admin/orders')
    await screen.findByText('LV-AAA')
    expect(container.querySelector('aside.orders-detail')).toBeNull()
    fireEvent.click(screen.getByText('Lê Văn Cường'))
    const aside = await waitFor(() => {
      const a = container.querySelector('aside.orders-detail')
      expect(a).not.toBeNull()
      return a
    })
    expect(await within(aside).findByRole('heading', { name: 'LV-BBB' })).toBeInTheDocument()
    expect(rows()).toHaveLength(4) // danh sách vẫn ở bên trái
    expect(container.querySelector('.orders-split')).toHaveClass('has-detail')
    expect(container.querySelector('tr.is-open code')).toHaveTextContent('LV-BBB')
  })

  it('vào thẳng /admin/orders/:code → danh sách và chi tiết cùng hiện', async () => {
    setup({ 'GET /admin/orders/LV-AAA': () => ({ body: { item: { ...order('LV-AAA'), items: [], vatRate: 0.1, vatAmount: 0, subtotal: 0, shippingFee: 0 }, audit: [] } }) })
    const { container } = renderAt('/admin/orders/LV-AAA')
    expect(await screen.findByText('LV-CCC')).toBeInTheDocument()
    expect(await within(container.querySelector('aside.orders-detail')).findByRole('heading', { name: 'LV-AAA' })).toBeInTheDocument()
  })
})
