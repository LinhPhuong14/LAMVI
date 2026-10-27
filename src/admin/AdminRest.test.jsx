// @vitest-environment jsdom
// Bố cục Split mới (docs/knowledge/dashboard-ux.md): mã giảm giá, sản phẩm, lô, người dùng.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { S } from './strings.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'me', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'me', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const aside = () => document.querySelector('aside.split-aside')
const chip = (label) => screen.getByRole('button', { name: new RegExp(`^${label}`) })

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
  window.confirm = vi.fn(() => true)
})

describe('Mã giảm giá', () => {
  const coupons = [
    { id: 'c1', code: 'MOC10', type: 'percent', value: 10, status: 'active', usedCount: 0, perUserLimit: 1 },
    { id: 'c2', code: 'FREESHIP', type: 'free_shipping', status: 'disabled', usedCount: 1, perUserLimit: 1 },
    { id: 'c3', code: 'TET', type: 'amount', value: 50000, status: 'active', usedCount: 0, perUserLimit: 1 },
  ]
  function setup(patches = []) {
    let items = coupons
    const fetchMock = mockApi({
      'GET /me': me,
      'GET /admin/coupons': () => ({ body: { items } }),
      'PATCH /admin/coupons/c1': (url, init) => {
        const body = JSON.parse(init.body)
        patches.push(body)
        items = items.map((c) => (c.id === 'c1' ? { ...c, ...body } : c))
        return { body: { item: items[0] } }
      },
    })
    return fetchMock
  }

  it('chip hiện số lượng và lọc danh sách, aria-pressed đổi theo', async () => {
    setup()
    renderAt('/admin/coupons')
    await screen.findByText('MOC10')
    expect(chip(S.orders.chipAll)).toHaveTextContent('3')
    expect(chip(S.coupons.statuses.active)).toHaveTextContent('2')
    expect(chip(S.coupons.statuses.disabled)).toHaveTextContent('1')
    expect(chip(S.orders.chipAll)).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(chip(S.coupons.statuses.disabled))
    expect(chip(S.coupons.statuses.disabled)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('FREESHIP')).toBeInTheDocument()
    expect(screen.queryByText('MOC10')).toBeNull()
    fireEvent.click(chip(S.coupons.statuses.active))
    expect(screen.getByText('MOC10')).toBeInTheDocument()
    expect(screen.getByText('TET')).toBeInTheDocument()
    expect(screen.queryByText('FREESHIP')).toBeNull()
  })

  it('công tắc gửi PATCH {status} đúng chiều rồi tải lại danh sách', async () => {
    const patches = []
    const fetchMock = setup(patches)
    renderAt('/admin/coupons')
    const sw = await screen.findByRole('switch', { name: `MOC10: ${S.coupons.statuses.active}` })
    expect(sw).toBeChecked()
    const before = fetchMock.mock.calls.filter(([u, i]) => String(u).includes('/admin/coupons') && (i?.method ?? 'GET') === 'GET').length
    fireEvent.click(sw)
    await waitFor(() => expect(patches).toEqual([{ status: 'disabled' }]))
    expect(await screen.findByRole('switch', { name: `MOC10: ${S.coupons.statuses.disabled}` })).not.toBeChecked()
    const after = fetchMock.mock.calls.filter(([u, i]) => String(u).includes('/admin/coupons') && (i?.method ?? 'GET') === 'GET').length
    expect(after).toBeGreaterThan(before)

    fireEvent.click(screen.getByRole('switch', { name: `MOC10: ${S.coupons.statuses.disabled}` }))
    await waitFor(() => expect(patches.at(-1)).toEqual({ status: 'active' }))
  })

  it('aside mở khi bấm Thêm mới / Sửa và đóng khi Huỷ', async () => {
    setup()
    renderAt('/admin/coupons')
    await screen.findByText('MOC10')
    expect(aside()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: S.common.create }))
    expect(within(aside()).getByLabelText(S.coupons.code)).toHaveValue('')
    fireEvent.click(within(aside()).getByRole('button', { name: S.common.cancel }))
    expect(aside()).toBeNull()

    fireEvent.click(within(screen.getByText('TET').closest('tr')).getByRole('button', { name: S.common.edit }))
    expect(within(aside()).getByLabelText(S.coupons.code)).toHaveValue('TET')
    // Danh sách vẫn hiện bên cạnh biểu mẫu
    expect(document.querySelector('.split-main')).toContainElement(screen.getByText('MOC10'))
  })
})

describe('Sản phẩm', () => {
  const products = [
    { id: 'p1', slug: 'den-nguyet', kind: 'single', status: 'published', price: 890000, stock: 5, name: { vi: 'Đèn Nguyệt' }, sortOrder: 1 },
    { id: 'p2', slug: 'den-ga-an', kind: 'single', status: 'hidden', price: 500000, stock: 0, name: { vi: 'Đèn Ẩn' }, sortOrder: 2, imageUrl: 'https://cdn.test/an.webp' },
    { id: 'p3', slug: 'den-nhap', kind: 'single', status: 'draft', price: 300000, stock: null, name: { vi: 'Đèn Nháp' }, sortOrder: 3 },
  ]
  const setup = () => mockApi({ 'GET /me': me, 'GET /admin/products': () => ({ body: { items: products } }), 'GET /admin/collections': () => ({ body: { items: [] } }) })
  const card = async (name) => (await screen.findByText(name)).closest('article.admin-card')

  it('thẻ hiện giá, tồn kho, trạng thái và ảnh (imageUrl hoặc ảnh theo slug)', async () => {
    setup()
    renderAt('/admin/products')
    const c1 = await card('Đèn Nguyệt')
    expect(c1.closest('ul.admin-cards')).not.toBeNull()
    expect(c1).toHaveTextContent(/890\.000/)
    expect(c1).toHaveTextContent(`${S.products.colStock}: 5`)
    expect(c1).toHaveTextContent(S.products.statuses.published)
    expect(c1.querySelector('img')).toHaveAttribute('src', '/images/lamps/nguyet-cutout.webp')
    expect(within(c1).getByRole('button', { name: S.common.edit })).toHaveClass('btn-primary')
    const c2 = await card('Đèn Ẩn')
    expect(c2).toHaveTextContent(`${S.products.colStock}: ${S.products.stockOut}`)
    expect(c2.querySelector('img')).toHaveAttribute('src', 'https://cdn.test/an.webp')
    expect(await card('Đèn Nháp')).toHaveTextContent(`${S.products.colStock}: ${S.products.stockUntracked}`)
  })

  it('tìm theo tên hoặc slug; chip đếm và lọc theo trạng thái', async () => {
    setup()
    renderAt('/admin/products')
    await card('Đèn Nguyệt')
    expect(chip(S.orders.chipAll)).toHaveTextContent('3')
    expect(chip(S.products.statuses.hidden)).toHaveTextContent('1')

    const search = document.querySelector('input[type="search"]')
    fireEvent.change(search, { target: { value: 'nháp' } })
    expect(screen.getByText('Đèn Nháp')).toBeInTheDocument()
    expect(screen.queryByText('Đèn Nguyệt')).toBeNull()
    fireEvent.change(search, { target: { value: 'ga-an' } })
    expect(screen.getByText('Đèn Ẩn')).toBeInTheDocument()
    expect(screen.queryByText('Đèn Nháp')).toBeNull()

    fireEvent.change(search, { target: { value: '' } })
    fireEvent.click(chip(S.products.statuses.published))
    expect(chip(S.products.statuses.published)).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Đèn Nguyệt')).toBeInTheDocument()
    expect(screen.queryByText('Đèn Ẩn')).toBeNull()
  })

  it('bấm Sửa trên thẻ / Thêm mới mở biểu mẫu ở aside, danh sách vẫn hiện', async () => {
    setup()
    renderAt('/admin/products')
    expect(aside()).toBeNull()
    fireEvent.click(within(await card('Đèn Nguyệt')).getByRole('button', { name: S.common.edit }))
    expect(within(aside()).getByLabelText(S.products.slug)).toHaveValue('den-nguyet')
    expect(document.querySelector('.split-main')).toContainElement(screen.getByText('Đèn Ẩn'))
    fireEvent.click(within(aside()).getByRole('button', { name: S.common.cancel }))
    expect(aside()).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: S.common.create }))
    expect(within(aside()).getByLabelText(S.products.slug)).toHaveValue('')
  })
})

describe('Lô', () => {
  const noVideo = { id: 'b1', code: 'L-01', status: 'created', videoUrl: null, producedOn: '2026-10-01', title: { vi: 'Lô 1' } }
  const withVideo = { ...noVideo, id: 'b2', code: 'L-02', videoUrl: '/v.mp4' }
  const published = { ...withVideo, id: 'b3', code: 'L-03', status: 'video_published' }
  const setup = () => mockApi({ 'GET /me': me, 'GET /admin/batches': () => ({ body: { items: [noVideo, withVideo, published] } }) })
  const row = async (code) => (await screen.findByText(code)).closest('tr')
  const steps = (tr) => [...tr.querySelectorAll('ol.steps li')].map((li) => [li.textContent, li.classList.contains('is-done')])

  it('thanh 3 bước đúng trạng thái, bảng không còn cột Video', async () => {
    setup()
    renderAt('/admin/batches')
    expect(steps(await row('L-01'))).toEqual([[S.batches.stepCreate, true], [S.batches.stepVideo, false], [S.batches.stepPublish, false]])
    expect(steps(await row('L-02'))).toEqual([[S.batches.stepCreate, true], [S.batches.stepVideo, true], [S.batches.stepPublish, false]])
    expect(steps(await row('L-03'))).toEqual([[S.batches.stepCreate, true], [S.batches.stepVideo, true], [S.batches.stepPublish, true]])
    expect(screen.queryByRole('columnheader', { name: S.batches.video })).toBeNull()
  })

  it('nhãn nút theo trạng thái; Xoá chỉ cho lô chưa xuất bản', async () => {
    setup()
    renderAt('/admin/batches')
    const r1 = await row('L-01')
    const r2 = await row('L-02')
    const r3 = await row('L-03')
    expect(within(r1).getByRole('button', { name: 'Tải video' })).toHaveClass('btn-primary')
    expect(within(r2).getByRole('button', { name: 'Xuất bản' })).toHaveClass('btn-primary')
    expect(within(r3).getByRole('button', { name: 'Sửa' })).not.toHaveClass('btn-primary')
    expect(within(r1).getByRole('button', { name: S.common.delete })).toBeInTheDocument()
    expect(within(r2).getByRole('button', { name: S.common.delete })).toBeInTheDocument()
    expect(within(r3).queryByRole('button', { name: S.common.delete })).toBeNull()
  })

  it('bấm nút hành động mở biểu mẫu và bảng video trong aside', async () => {
    setup()
    renderAt('/admin/batches')
    expect(aside()).toBeNull()
    fireEvent.click(within(await row('L-01')).getByRole('button', { name: 'Tải video' }))
    expect(within(aside()).getByLabelText(S.batches.code)).toHaveValue('L-01')
    expect(within(aside()).getByText(S.batches.chooseVideo)).toBeInTheDocument()
  })
})

describe('Người dùng', () => {
  const user = {
    id: 'u-an', email: 'an@lamvi.test', fullName: 'An', phone: '0912345678', role: 'customer', preferredLocale: 'vi',
    createdAt: '2026-10-01T03:00:00.000Z', locked: false, lockedAt: null, lockedReason: null, orderCount: 2,
  }
  const setup = () =>
    mockApi({
      'GET /me': me,
      'GET /admin/users': () => ({ body: { items: [user], total: 1, page: 1, pageSize: 20 } }),
      'GET /admin/users/u-an': () => ({ body: { item: user, orders: [], audit: [] } }),
    })

  it('/admin/users/:id: chi tiết ở aside cùng lúc với danh sách', async () => {
    setup()
    renderAt('/admin/users/u-an')
    expect(await within(await waitFor(() => aside() ?? Promise.reject(new Error('no aside')))).findByRole('button', { name: S.users.lock })).toBeInTheDocument()
    const main = document.querySelector('.split-main')
    expect(await within(main).findByText('an@lamvi.test')).toBeInTheDocument()
    expect(main.querySelector('tr.is-open')).not.toBeNull()
  })

  it('/admin/users: chưa có aside; bấm hàng mở chi tiết; cột phụ có col-secondary', async () => {
    setup()
    renderAt('/admin/users')
    const cell = await screen.findByText('an@lamvi.test')
    expect(aside()).toBeNull()
    expect(cell).toHaveClass('col-secondary')
    expect(screen.getByText('0912345678')).toHaveClass('col-secondary')
    fireEvent.click(cell.closest('tr'))
    expect(await within(await waitFor(() => aside() ?? Promise.reject(new Error('no aside')))).findByRole('button', { name: S.users.lock })).toBeInTheDocument()
    expect(screen.getByText('an@lamvi.test', { selector: 'td' })).toBeInTheDocument()
  })
})
