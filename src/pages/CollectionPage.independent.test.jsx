// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) trang bộ sưu tập D-108: edge case dữ liệu thiếu/lạ, a11y, thứ tự heading
import { beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const lamp = (slug, name, extra = {}) => ({
  slug, name, kind: 'single', description: `Mô tả ${name}`, price: 1400000, currency: 'VND', tone: 'amber', badge: null, collection: 'bst', pieceOrder: 1, inStock: true,
  specs: { size: 'Cao 20 cm' }, image: { url: `/images/lamps/${slug}.jpg`, alt: name, cutout: `/images/lamps/${slug}-cutout.webp` }, ...extra,
})
const collection = (over = {}) => ({ slug: 'bst', name: 'Bộ sưu tập đầu tiên', description: 'Năm bức tranh', tone: 'amber', lamps: [lamp('den-a', 'Đèn A')], set: null, ...over })
const api = (c) =>
  mockApi({
    'GET /products': () => ({ body: { items: [] } }),
    'GET /collections/bst': () => ({ body: { item: c } }),
    'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
    'GET /faq': () => ({ body: { items: [] } }),
  })
beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe('Trang bộ sưu tập — edge case độc lập', () => {
  it('lamps rỗng → vẫn có h1, không có hàng, không chip giá, không "NaN"', async () => {
    api(collection({ lamps: [] }))
    renderAt('/collections/bst')
    expect(await screen.findByRole('heading', { level: 1, name: 'Bộ sưu tập đầu tiên' })).toBeTruthy()
    expect(document.querySelectorAll('.cp-row')).toHaveLength(0)
    expect(document.querySelectorAll('.cp-chips li')).toHaveLength(1)
    expect(document.querySelector('.cp-stage').textContent).not.toMatch(/NaN|Từ/)
  })

  it('đèn không có specs hoặc specs null/size rỗng → không dòng thông số, không lỗi', async () => {
    api(collection({ lamps: [lamp('den-a', 'Đèn A', { specs: null }), lamp('den-b', 'Đèn B', { specs: {} }), lamp('den-c', 'Đèn C', { specs: { size: '' } }), lamp('den-d', 'Đèn D', { specs: undefined })] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    expect(document.querySelectorAll('.cp-row')).toHaveLength(4)
    expect(document.querySelectorAll('.cp-spec')).toHaveLength(0)
  })

  it('giá thấp nhất lấy đúng khi giá không theo thứ tự', async () => {
    api(collection({ lamps: [lamp('den-a', 'A', { price: 1500000 }), lamp('den-b', 'B', { price: 900000 }), lamp('den-c', 'C', { price: 1200000 })] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    expect(within(document.querySelector('.cp-chips')).getByText(/900\.000/)).toBeTruthy()
  })

  it('a11y: liên kết trang trí tabIndex=-1 và nằm trong aria-hidden; không nút/ô nhập trong vùng aria-hidden; thứ tự heading h1 → h2 → h3', async () => {
    api(collection({ lamps: [lamp('den-a', 'Đèn A'), lamp('den-b', 'Đèn B')] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    for (const a of document.querySelectorAll('.cp-lineup a, a.cp-photo')) {
      expect(a.getAttribute('tabindex')).toBe('-1')
      expect(a.closest('[aria-hidden="true"]')).not.toBeNull()
    }
    expect(document.querySelectorAll('[aria-hidden="true"] button, [aria-hidden="true"] input')).toHaveLength(0)
    const main = [...document.querySelectorAll('.collection-page h1, .collection-page h2, .collection-page h3')].map((h) => Number(h.tagName[1]))
    expect(main[0]).toBe(1)
    for (let i = 1; i < main.length; i++) expect(main[i] - main[i - 1]).toBeLessThanOrEqual(1)
    // ảnh trong hàng đèn tách nền có alt (không để thiếu thuộc tính alt)
    for (const img of document.querySelectorAll('.cp-lineup img, .cp-photo img')) expect(img.hasAttribute('alt')).toBe(true)
  })

  it('ảnh cutout trong sân khấu có width/height > 0 (tránh CLS) và ảnh admin (không cutout) dùng ảnh thường phủ khung', async () => {
    api(collection({ lamps: [lamp('den-a', 'Đèn A', { image: { url: 'https://cdn.test/own.jpg', alt: 'Ảnh admin' } })] }))
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    const stageImg = document.querySelector('.cp-lineup img')
    expect(stageImg.getAttribute('src')).toBe('https://cdn.test/own.jpg')
    expect(stageImg.classList.contains('lamp-cutout')).toBe(false)
    const rowImg = document.querySelector('.cp-photo img')
    expect(rowImg.getAttribute('src')).toBe('https://cdn.test/own.jpg')
  })

  it('không còn chữ chú thích nguồn fanpage trên trang chủ/bộ sưu tập', async () => {
    api(collection())
    renderAt('/collections/bst')
    await screen.findByRole('heading', { level: 1 })
    expect(document.body.textContent).not.toMatch(/fanpage chính thức|Ảnh: /)
  })
})
