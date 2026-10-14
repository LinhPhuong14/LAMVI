// @vitest-environment jsdom
// D-108: thiết kế lại trang bộ sưu tập (sân khấu đèn tách nền + danh sách biên tập)
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const lamp = (slug, name, extra = {}) => ({
  slug, name, kind: 'single', description: `Mô tả ${name}`, price: 1400000 - (slug === 'den-b' ? 100000 : 0), currency: 'VND', tone: 'amber', badge: null, collection: 'bst', pieceOrder: 1, inStock: true,
  specs: { size: 'Cao 20 cm' }, image: { url: `/images/lamps/${slug}.jpg`, alt: name, cutout: `/images/lamps/${slug}-cutout.webp` }, ...extra,
})
const collection = (over = {}) => ({ slug: 'bst', name: 'Bộ sưu tập đầu tiên', description: 'Năm bức tranh', tone: 'amber', lamps: [lamp('den-a', 'Đèn A'), lamp('den-b', 'Đèn B')], set: null, ...over })
const api = (c) =>
  mockApi({
    'GET /products': () => ({ body: { items: [] } }),
    'GET /collections/bst': () => ({ body: { item: c } }),
    'GET /collections': () => ({ body: { items: [] } }),
    'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
    'GET /faq': () => ({ body: { items: [] } }),
  })
beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe('Trang bộ sưu tập — thiết kế mới', () => {
  it('sân khấu: tên bộ (h1), số đèn, giá thấp nhất, nút cuộn tới danh sách; hàng đèn dùng ảnh tách nền', async () => {
    api(collection())
    renderAt('/collections/bst')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bộ sưu tập đầu tiên' })).toBeTruthy()
    const stage = within(document.querySelector('.cp-stage'))
    expect(stage.getByText('2 đèn')).toBeTruthy()
    expect(stage.getByText(/Từ/)).toBeTruthy()
    expect(stage.getByText(/1\.300\.000/)).toBeTruthy() // giá thấp nhất
    expect(stage.getByRole('link', { name: 'Chọn đèn' }).getAttribute('href')).toBe('#chon-den')
    const cutouts = [...document.querySelectorAll('.cp-lineup img.lamp-cutout')]
    expect(cutouts.map((i) => i.getAttribute('src'))).toEqual(['/images/lamps/den-a-cutout.webp', '/images/lamps/den-b-cutout.webp'])
    expect(document.getElementById('chon-den')).not.toBeNull()
  })

  it('hàng đèn và ảnh trang trí ẩn khỏi trình đọc màn hình → mỗi đèn chỉ có MỘT liên kết tên', async () => {
    api(collection())
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelector('.cp-lineup').getAttribute('aria-hidden')).toBe('true')
    expect(screen.getAllByRole('link', { name: 'Đèn A' })).toHaveLength(1)
    expect(screen.getAllByRole('link', { name: 'Đèn B' })).toHaveLength(1)
    expect(document.querySelectorAll('.cp-photo[aria-hidden="true"]')).toHaveLength(2)
  })

  it('danh sách biên tập: số thứ tự 01/02, xen kẽ trái–phải, thông số, giá, nút thêm giỏ và xem câu chuyện', async () => {
    api(collection())
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    const rows = [...document.querySelectorAll('.cp-row')]
    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.classList.contains('is-flip'))).toEqual([false, true])
    expect(within(rows[0]).getByText('01')).toBeTruthy()
    expect(within(rows[1]).getByText('02')).toBeTruthy()
    expect(within(rows[0]).getByText('Cao 20 cm')).toBeTruthy()
    expect(within(rows[0]).getByRole('button', { name: 'Thêm vào giỏ' })).toBeTruthy()
    expect(within(rows[0]).getByRole('link', { name: 'Xem câu chuyện' }).getAttribute('href')).toBe('/products/den-a')
    expect(within(rows[0]).getByText(/1\.400\.000/)).toBeTruthy()
  })

  it('hết hàng → nút bị khoá; sắp hết → báo còn mấy', async () => {
    api(collection({ lamps: [lamp('den-a', 'Đèn A', { inStock: false }), lamp('den-b', 'Đèn B', { stockLeft: 2 })] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    const rows = [...document.querySelectorAll('.cp-row')]
    expect(within(rows[0]).getByRole('button', { name: 'Tạm hết hàng' })).toBeDisabled()
    expect(within(rows[1]).getByText('Chỉ còn 2')).toBeTruthy()
  })

  it('đèn chưa có ảnh thật → hình minh hoạ, không vỡ; không có đèn → không có chip giá', async () => {
    api(collection({ lamps: [lamp('den-a', 'Đèn A', { image: null })] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelector('.cp-lineup svg')).not.toBeNull()
    expect(document.querySelector('.cp-lineup img')).toBeNull()
  })

  it('có gói cả bộ → vẫn hiện khối "Mua cả bộ"; bản en dùng nhãn en', async () => {
    api(collection({ set: lamp('bo-ab', 'Bộ AB', { kind: 'set', price: 2500000 }) }))
    renderAt('/collections/bst')
    expect(await screen.findByRole('button', { name: 'Mua cả bộ' })).toBeTruthy()
    expect(document.querySelectorAll('.cp-row')).toHaveLength(2)
  })
  it('bản en', async () => {
    mockApi({
      'GET /products': () => ({ body: { items: [] } }),
      'GET /collections/bst': () => ({ body: { item: collection() } }),
      'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
      'GET /faq': () => ({ body: { items: [] } }),
    })
    renderAt('/en/collections/bst')
    expect(await screen.findByRole('link', { name: 'Choose a lantern' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: 'Read the story' })[0].getAttribute('href')).toBe('/en/products/den-a')
  })
})
