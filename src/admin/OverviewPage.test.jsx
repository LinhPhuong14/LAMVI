// @vitest-environment jsdom
// Trang "Hôm nay" (/admin): việc cần làm, KPI 7 ngày, biểu đồ cột, đơn gần đây
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const now = new Date()
const iso = (daysAgo = 0) => new Date(now.getTime() - daysAgo * 86400000).toISOString()
const order = (code, over = {}) => ({
  code,
  status: 'confirmed',
  recipientName: `Người ${code}`,
  paymentMethod: 'payos',
  paymentStatus: 'paid',
  paymentFlag: null,
  total: 1_000_000,
  createdAt: iso(0),
  ...over,
})

const orders = [
  order('LV-A'),
  order('LV-B'),
  order('LV-C', { status: 'shipped', paymentMethod: 'cod', paymentStatus: 'pending', total: 500_000, createdAt: iso(1) }),
  order('LV-D', { status: 'delivered', paymentFlag: 'AMOUNT_MISMATCH', total: 250_000, createdAt: iso(2) }),
  order('LV-X', { status: 'cancelled', total: 9_000_000 }), // đơn huỷ không tính doanh thu
  order('LV-OLD', { status: 'delivered', total: 700_000, createdAt: iso(20) }), // ngoài 7 ngày
]
const returns = [{ id: 'r1' }, { id: 'r2' }]
const batches = [{ id: 'b1', status: 'draft' }, { id: 'b2', status: 'video_published' }, { id: 'b3', status: 'created' }]

const todo = (label) => screen.getByText(label).closest('li')

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))

describe('OverviewPage', () => {
  function setup(over = {}) {
    return mockApi({
      'GET /me': me,
      'GET /admin/orders': () => ({ body: { items: orders } }),
      'GET /admin/returns': () => ({ body: { items: returns } }),
      'GET /admin/batches': () => ({ body: { items: batches } }),
      ...over,
    })
  }

  it('/admin là trang Hôm nay với 3 thẻ việc cần làm lấy số từ dữ liệu', async () => {
    setup()
    const { container } = renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Hôm nay', level: 1 })).toBeInTheDocument()
    expect(container.querySelectorAll('.todo')).toHaveLength(3)
    expect(within(todo('Đơn mới chờ làm')).getByText('2')).toBeInTheDocument()
    expect(within(todo('COD chưa thu tiền')).getByText('1')).toBeInTheDocument()
    expect(within(todo('Yêu cầu đổi trả mới')).getByText('2')).toBeInTheDocument()
    expect(todo('Đơn mới chờ làm')).toHaveClass('has-work')
    expect(within(todo('Đơn mới chờ làm')).getByRole('link')).toHaveAttribute('href', '/admin/orders?loc=confirmed')
    expect(within(todo('COD chưa thu tiền')).getByRole('link')).toHaveAttribute('href', '/admin/orders?loc=cod')
    expect(within(todo('Yêu cầu đổi trả mới')).getByRole('link')).toHaveAttribute('href', '/admin/returns')
  })

  it('KPI 7 ngày: loại đơn huỷ và đơn ngoài 7 ngày; biểu đồ có 7 cột', async () => {
    setup()
    const { container } = renderAt('/admin')
    await screen.findByText('7 ngày qua')
    // 1.000.000×2 + 500.000 + 250.000 = 2.750.000 ; 4 đơn ; trung bình 687.500
    const kpis = container.querySelector('.overview-kpis')
    expect(kpis.textContent).toMatch(/2\.750\.000/)
    expect(within(kpis).getByText('Doanh thu')).toBeInTheDocument()
    expect(within(within(kpis).getByText('Đơn hàng').parentElement).getByText('4')).toBeInTheDocument()
    expect(kpis.textContent).toMatch(/687\.500/)
    expect(kpis.textContent).not.toMatch(/9\.000\.000/)
    expect(container.querySelector('.bars')).toHaveAttribute('role', 'img')
    expect(container.querySelectorAll('.bars .bar')).toHaveLength(7)
  })

  it('"Cần để mắt": đơn có cờ + lô chưa xuất bản video; "Đơn gần đây" tối đa 6, mới nhất trước', async () => {
    setup()
    const { container } = renderAt('/admin')
    await screen.findByText('Đơn gần đây')
    expect(screen.getByRole('link', { name: '1 đơn có cờ thanh toán' })).toHaveAttribute('href', '/admin/orders?loc=flag')
    expect(screen.getByRole('link', { name: '2 lô chưa xuất bản video' })).toHaveAttribute('href', '/admin/batches')
    const recent = [...container.querySelectorAll('.recent li a')]
    expect(recent).toHaveLength(6)
    expect(recent.at(-1)).toHaveAttribute('href', '/admin/orders/LV-OLD')
    expect(recent.at(-1).textContent).toContain('LV-OLD')
  })

  it('không có việc tồn → hiện "Không có việc tồn" ở cả 3 thẻ, số 0, không có has-work', async () => {
    setup({
      'GET /admin/orders': () => ({ body: { items: [] } }),
      'GET /admin/returns': () => ({ body: { items: [] } }),
      'GET /admin/batches': () => ({ body: { items: [] } }),
    })
    const { container } = renderAt('/admin')
    await screen.findByText('Đơn mới chờ làm')
    expect(screen.getAllByText('Không có việc tồn')).toHaveLength(3)
    expect(container.querySelectorAll('.todo.has-work')).toHaveLength(0)
    expect(screen.getByText('Chưa có cảnh báo.')).toBeInTheDocument()
    expect(screen.getByText('Chưa có đơn nào.')).toBeInTheDocument()
  })

  it('/admin/returns và /admin/batches lỗi → trang vẫn hiện, số đó là 0', async () => {
    setup({
      'GET /admin/returns': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
      'GET /admin/batches': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
    })
    renderAt('/admin')
    await screen.findByText('Đơn mới chờ làm')
    expect(within(todo('Yêu cầu đổi trả mới')).getByText('0')).toBeInTheDocument()
    expect(within(todo('Đơn mới chờ làm')).getByText('2')).toBeInTheDocument()
  })

  it('/admin/orders lỗi → thông báo lỗi', async () => {
    setup({ 'GET /admin/orders': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin')
    expect(await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')).toBeInTheDocument()
  })

  it('thanh bên: huy hiệu Đơn hàng = số đơn đã xác nhận, Đổi trả = số yêu cầu mới; mục "Hôm nay" active', async () => {
    setup()
    const { container } = renderAt('/admin')
    await screen.findByText('Đơn mới chờ làm')
    const nav = container.querySelector('.admin-nav nav')
    await within(nav).findAllByText('2', { selector: '.admin-badge' })
    const link = (name) => within(nav).getByRole('link', { name: new RegExp(`^${name}`) })
    expect(link('Đơn hàng').querySelector('.admin-badge')).toHaveTextContent('2')
    expect(link('Đổi trả').querySelector('.admin-badge')).toHaveTextContent('2')
    expect(link('Hôm nay')).toHaveClass('active')
    expect(link('Đơn hàng')).not.toHaveClass('active')
  })
})
