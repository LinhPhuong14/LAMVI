// @vitest-environment jsdom
// Bố cục trang nội bộ (quản trị D-48, dashboard IT D-51) theo design-rules §12.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role, preferredLocale: 'vi', fullName: 'A' } } })

const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '')
const CSS = strip(readFileSync(join(process.cwd(), 'src/styles/pages.css'), 'utf8'))
// Khối CSS của trang nội bộ: từ tiêu đề khối tới khối Mây
const ADMIN_CSS = CSS.slice(CSS.indexOf('.admin {'), CSS.indexOf('.may-fab'))

const itHealth = {
  status: 'ok',
  checks: [{ name: 'database', status: 'ok', latencyMs: 1 }],
  system: {
    version: '0',
    commit: 'x',
    node: 'v22',
    env: 'test',
    startedAt: '2026-09-28T00:00:00Z',
    uptimeSec: 60,
    memoryMb: { rss: 1, heapUsed: 1 },
    dataMode: 'memory',
  },
  maintenance: { enabled: false, updatedAt: null, updatedBy: null },
}

const itApi = () =>
  mockApi({
    'GET /me': me('it'),
    'GET /it/health': () => ({ body: itHealth }),
    'GET /it/metrics': () => ({
      body: { range: '24h', totals: { count: 12, errorRate: 0.1, p95Ms: 20, avgMs: 5 }, routes: [] },
    }),
    'GET /it/errors': () => ({ body: { items: [] } }),
  })

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Thanh bên trang nội bộ', () => {
  it('admin: ấn triện + nhãn khu vực + 6 mục có biểu tượng, mục đang mở được đánh dấu', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: [] } }) })
    const { container } = renderAt('/admin/products')
    await screen.findByRole('heading', { name: 'Sản phẩm', level: 1 })

    const nav = container.querySelector('.admin-nav nav')
    const links = [...nav.querySelectorAll('a')]
    expect(links.map((a) => a.textContent)).toEqual([
      'Đơn hàng',
      'Sản phẩm',
      'Hỏi đáp',
      'Lô đèn',
      'Mã giảm giá',
      'Mây (AI)',
    ])
    // Biểu tượng là trang trí; nhãn chữ mới là nội dung cho trình đọc màn hình
    for (const a of links) {
      const icon = a.querySelector('svg.admin-nav-icon')
      expect(icon).not.toBeNull()
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
    expect(links.find((a) => a.textContent === 'Sản phẩm')).toHaveClass('active')
    expect(nav).toHaveAttribute('aria-label')
  })

  it('D-51: chỉ IT mới thấy link sang dashboard IT', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: [] } }) })
    renderAt('/admin/products')
    await screen.findByRole('heading', { name: 'Sản phẩm', level: 1 })
    expect(screen.queryByRole('link', { name: 'Dashboard IT' })).toBeNull()
  })

  it('dashboard IT dùng cùng thanh bên, đánh dấu trang hiện tại', async () => {
    const { container } = itApi() && renderAt('/it')
    await screen.findByRole('heading', { name: 'Dashboard IT', level: 1 })
    const current = container.querySelector('.admin-nav nav a.active')
    expect(current.textContent).toBe('Dashboard IT')
    expect(current).toHaveAttribute('aria-current', 'page')
    expect(within(container.querySelector('.admin-side-foot')).getByText('Về trang web')).toBeInTheDocument()
  })
})

describe('Đầu trang', () => {
  it('trang cấp một chỉ có tiêu đề — không lặp lại tên khu vực đã có ở thanh bên', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/coupons': () => ({ body: { items: [] } }) })
    const { container } = renderAt('/admin/coupons')
    await screen.findByRole('heading', { name: 'Mã giảm giá', level: 1 })
    expect(container.querySelector('.admin-head .admin-eyebrow')).toBeNull()
    // "Quản trị LAMVI" chỉ xuất hiện một lần (ở thanh bên)
    expect(screen.getAllByText('Quản trị LAMVI')).toHaveLength(1)
  })

  it('trang chi tiết đơn: eyebrow "Đơn hàng" + tiêu đề là mã đơn', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/orders/LV2610-ACDEFGH': () => ({
        body: {
          item: {
            code: 'LV2610-ACDEFGH',
            status: 'confirmed',
            orderKind: 'self',
            hasMessage: false,
            recipientName: 'A',
            recipientPhone: '0912345678',
            addressLine: 'x',
            province: 'Hà Nội',
            paymentMethod: 'cod',
            paymentStatus: 'pending',
            subtotal: 1,
            discount: 0,
            shippingFee: 0,
            total: 1,
            vatAmount: 0,
            vatRate: 0.1,
            items: [],
            nextStatuses: [],
          },
          audit: [],
        },
      }),
    })
    const { container } = renderAt('/admin/orders/LV2610-ACDEFGH')
    await screen.findByRole('heading', { name: 'LV2610-ACDEFGH', level: 1 })
    expect(container.querySelector('.admin-head .admin-eyebrow').textContent).toBe('Đơn hàng')
  })
})

// design-rules §12: trang ứng dụng dùng nét 1px, không bóng đổ, không khung viền đôi / góc triện
describe('CSS trang nội bộ theo design-rules §12', () => {
  it('thẻ dùng nét mảnh và KHÔNG có bóng đổ', () => {
    expect(ADMIN_CSS).toMatch(/\.admin \.account-card \{[^}]*box-shadow: none/s)
    expect(ADMIN_CSS).toMatch(/\.admin \.account-card \{[^}]*border: 1px solid var\(--dash-line\)/s)
    // Khung tranh bồi (đường chỉ inset) của trang công khai bị tắt trong trang nội bộ
    expect(ADMIN_CSS).toMatch(/\.admin \.account-card::before \{\s*display: none/)
  })

  it('không dùng bóng in của trang công khai, không góc hoa văn triện', () => {
    expect(ADMIN_CSS).not.toMatch(/var\(--print/)
    expect(ADMIN_CSS).not.toMatch(/--corner-/)
  })

  it('không viền dày, không bóng đổ lệch cứng, không mã màu cứng (§11)', () => {
    expect(ADMIN_CSS).not.toMatch(/border(-\w+)?:\s*[2-9]px/)
    expect(ADMIN_CSS).not.toMatch(/box-shadow:\s*\d+px\s+\d+px\s+0/)
    expect(ADMIN_CSS).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })

  it('dùng token nét riêng của trang ứng dụng, không dùng bí danh cũ', () => {
    expect(ADMIN_CSS).toMatch(/--dash-line:/)
    expect(ADMIN_CSS).not.toMatch(/var\(--brown-line\)/)
    expect(ADMIN_CSS).not.toMatch(/var\(--paper-deep\)/)
  })

  it('vùng nội dung căn giữa, không dồn trái (§12)', () => {
    expect(ADMIN_CSS).toMatch(/\.admin-main > \* \{[^}]*margin-inline: auto/s)
  })

  it('màn hẹp: thanh bên thành hàng ngang, không còn cột', () => {
    expect(ADMIN_CSS).toMatch(/@media \(max-width: 960px\)[\s\S]*?\.admin \{\s*grid-template-columns: 1fr/)
  })
})

describe('Số liệu dashboard IT', () => {
  it('dải số liệu ngăn bằng nét dọc, số dùng Fraunces kiểu cổ (§12)', async () => {
    itApi()
    renderAt('/it')
    await screen.findByRole('heading', { name: 'Dashboard IT', level: 1 })
    await waitFor(() => expect(document.querySelectorAll('.it-kpis div').length).toBe(4))
    expect(ADMIN_CSS).toMatch(/\.it-kpis div \+ div \{\s*border-left: 1px solid var\(--dash-line\)/)
    expect(ADMIN_CSS).toMatch(/\.it-kpis strong \{[^}]*font-variant-numeric: oldstyle-nums/s)
  })

  it('hàng có lỗi 5xx đánh dấu bằng vạch son, không tô mảng đỏ đậm', () => {
    expect(ADMIN_CSS).toMatch(/\.it-row-error td:first-child \{\s*box-shadow: inset 2px 0 0 var\(--son\)/)
  })
})
