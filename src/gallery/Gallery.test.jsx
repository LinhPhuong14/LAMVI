// @vitest-environment jsdom
// D-96, D-97: gallery đèn + chăn Đông Hồ, trang bộ sưu tập, Cửa hàng
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'An', phone: null, preferredLocale: 'vi', role: 'customer' }
const emptyCart = { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }

const lamp = (slug, name, extra = {}) => ({ slug, name, kind: 'single', description: `Mô tả ${name}`, price: 800000, currency: 'VND', tone: 'amber', badge: null, image: null, collection: 'sum-vay', pieceOrder: 1, ...extra })
const lamps = [lamp('den-a', 'Đèn A'), lamp('den-b', 'Đèn B', { pieceOrder: 2 })]
const set = lamp('bo-ab', 'Bộ AB', { kind: 'set', price: 1500000, pieceOrder: 0 })
const collection = { slug: 'sum-vay', name: 'Sum Vầy', description: 'Mô tả bộ', tone: 'amber', lamps, set }
const standalone = lamp('den-le', 'Đèn Lẻ', { collection: null })

const piece = (slug, name, owned) => ({ slug, name, tone: 'amber', owned })
const gal = (over = {}) => ({
  lamps: [],
  collections: [{ slug: 'sum-vay', name: 'Sum Vầy', tone: 'amber', pieces: [piece('den-a', 'Đèn A', false), piece('den-b', 'Đèn B', false)], ownedCount: 0, complete: false, reward: null }],
  quilt: { totalPieces: 2, unlockedPieces: 0, completedCollections: 0, totalCollections: 1, complete: false },
  ...over,
})
const completeGal = () =>
  gal({
    lamps: [
      { slug: 'den-a', name: 'Đèn A', tone: 'amber', image: null, collection: 'sum-vay', orderCode: 'LV2610-AAAAAAA', receivedAt: '2026-10-01T00:00:00Z', viaSet: false, greeting: { path: '/qr/tok' }, batch: { code: 'L1', title: 'Mẻ 1', path: '/lo/L1' } },
      { slug: 'den-b', name: 'Đèn B', tone: 'amber', image: null, collection: 'sum-vay', orderCode: 'LV2610-AAAAAAA', receivedAt: '2026-10-01T00:00:00Z', viaSet: false, greeting: { path: null }, batch: null },
    ],
    collections: [{ slug: 'sum-vay', name: 'Sum Vầy', tone: 'amber', pieces: [piece('den-a', 'Đèn A', true), piece('den-b', 'Đèn B', true)], ownedCount: 2, complete: true, reward: { title: 'Mâm cơm ngày Tết', story: 'Chiều ba mươi cả nhà quây quần.' } }],
    quilt: { totalPieces: 2, unlockedPieces: 2, completedCollections: 1, totalCollections: 1, complete: true },
  })

const base = (galBody) => ({
  'GET /products': () => ({ body: { items: [...lamps, set, standalone] } }),
  'GET /collections': () => ({ body: { items: [collection] } }),
  'GET /collections/sum-vay': () => ({ body: { item: collection } }),
  'GET /me': () => ({ body: { profile } }),
  'GET /may/history': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: emptyCart }),
  'GET /orders': () => ({ body: { items: [] } }),
  'GET /gallery': () => ({ body: galBody }),
})

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Cửa hàng với bộ sưu tập (D-96)', () => {
  it('bộ sưu tập là thẻ lớn riêng; đèn thuộc bộ không lặp ở mục đèn lẻ', async () => {
    mockApi(base(gal()))
    renderAt('/shop')
    expect(await screen.findByRole('heading', { level: 2, name: 'Bộ sưu tập' })).toBeTruthy()
    const shop = within(document.querySelector('.shop'))
    expect(shop.getByRole('link', { name: 'Sum Vầy' }).getAttribute('href')).toBe('/collections/sum-vay')
    expect(shop.getByText('2 đèn')).toBeTruthy()
    // Đèn lẻ độc lập vẫn là thẻ sản phẩm; đèn thuộc bộ chỉ hiện tên trong thẻ bộ, không có link sản phẩm riêng
    expect(await shop.findByRole('link', { name: 'Đèn Lẻ' })).toBeTruthy()
    expect(shop.queryByRole('link', { name: 'Đèn A' })).toBeNull()
  })

  it('API bộ sưu tập lỗi → vẫn hiện mọi đèn như trước', async () => {
    mockApi({ ...base(gal()), 'GET /collections': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/shop')
    expect(await within(document.querySelector('.shop')).findByRole('link', { name: 'Đèn A' })).toBeTruthy()
  })
})

describe('Trang bộ sưu tập', () => {
  it('mua cả bộ hoặc từng đèn lẻ', async () => {
    mockApi(base(gal()))
    renderAt('/collections/sum-vay')
    expect(await screen.findByRole('heading', { level: 1, name: 'Sum Vầy' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Mua cả bộ' })).toBeTruthy()
    const page = within(document.querySelector('.collection-page'))
    expect(page.getByRole('link', { name: 'Đèn A' })).toBeTruthy()
    expect(page.getByRole('link', { name: 'Đèn B' })).toBeTruthy()
    expect(screen.getAllByRole('button', { name: 'Thêm vào giỏ' }).length).toBeGreaterThanOrEqual(2)
  })

  it('không tồn tại → thông báo không tìm thấy', async () => {
    mockApi({ ...base(gal()), 'GET /collections/xx': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    renderAt('/collections/xx')
    expect(await screen.findByRole('heading', { level: 1, name: 'Không tìm thấy bộ sưu tập' })).toBeTruthy()
  })
})

describe('Tab Gallery + chăn Đông Hồ (D-97)', () => {
  it('chưa có đèn: chăn khoá, không lộ cốt truyện, có lời mời mua', async () => {
    mockApi(base(gal()))
    renderAt('/account?tab=gallery')
    expect(await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })).toBeTruthy()
    expect(screen.getByText('0/2 mảnh')).toBeTruthy()
    expect(screen.getAllByRole('img', { name: 'Mảnh chưa mở khoá' }).length).toBe(3) // 2 mảnh nhỏ + 1 mảnh lớn
    expect(screen.getByText(/Còn 2 đèn nữa/)).toBeTruthy()
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.getByText(/Gallery sẽ có đèn đầu tiên/)).toBeTruthy()
  })

  it('đủ bộ lần đầu: hiện hộp phần thưởng với cốt truyện; đóng thì ghi nhớ, vào lại không bật nữa', async () => {
    mockApi(base(completeGal()))
    renderAt('/account?tab=gallery')
    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(within(dialog).getByRole('heading', { name: 'Mâm cơm ngày Tết' })).toBeTruthy()
    // Chữ được gõ dần; nhãn truy cập luôn đầy đủ
    expect(within(dialog).getByLabelText('Chiều ba mươi cả nhà quây quần.')).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thu vào chăn' }))
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Mâm cơm ngày Tết' })).toBeNull())
    expect(localStorage.getItem('moc.quilt.seen.u1')).toContain('c:sum-vay')
  })

  it('đã xem rồi: không tự bật; nút Đọc cốt truyện mở lại, Esc đóng', async () => {
    localStorage.setItem('moc.quilt.seen.u1', JSON.stringify(['p:den-a', 'p:den-b', 'c:sum-vay', 'finale']))
    mockApi(base(completeGal()))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    await new Promise((r) => setTimeout(r, 1300))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Đọc cốt truyện' }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
  })

  it('thẻ đèn: video mẻ đèn, xem lời chúc (đơn tự mua), quà tặng chỉ báo đã gửi', async () => {
    localStorage.setItem('moc.quilt.seen.u1', JSON.stringify(['p:den-a', 'p:den-b', 'c:sum-vay', 'finale']))
    mockApi(base(completeGal()))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Đèn của tôi' })
    expect(screen.getByRole('link', { name: 'Video mẻ đèn' }).getAttribute('href')).toBe('/lo/L1')
    expect(screen.getByRole('link', { name: 'Xem lời chúc' }).getAttribute('href')).toBe('/qr/tok')
    expect(screen.getByText('Đã gửi kèm lời chúc')).toBeTruthy()
  })

  it('API lỗi → báo lỗi', async () => {
    mockApi({ ...base(gal()), 'GET /gallery': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/account?tab=gallery')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })
})
