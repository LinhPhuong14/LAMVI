// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) — các sự kiện §23.3 đã được nối vào trang thật (FR-GA-001, D-72).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const events = () => (window.dataLayer ?? []).filter((c) => c[0] === 'event')
const named = (name) => events().filter((e) => e[1] === name)

const PRODUCT = { slug: 'den-vong', name: 'Đèn Vọng', price: 1050000, currency: 'VND' }
const base = {
  'GET /products': () => ({ body: { items: [] } }),
  'GET /faq': () => ({ body: { items: [] } }),
  'GET /products/den-vong': () => ({ body: { item: PRODUCT } }),
  'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 1, hasUnavailable: false, maxQuantity: 20 } }),
}

beforeEach(() => {
  window.dataLayer = []
  window.gtag = (...args) => window.dataLayer.push(args)
})
afterEach(() => {
  delete window.gtag
  vi.restoreAllMocks()
})

describe('view_item (trang chi tiết sản phẩm)', () => {
  it('gửi đúng một lần với item_id, item_name, value, currency', async () => {
    window.history.pushState({}, '', '/products/den-vong')
    mockApi(base)
    renderAt('/products/den-vong')
    await screen.findByRole('heading', { name: 'Đèn Vọng' })
    await waitFor(() => expect(named('view_item')).toHaveLength(1))
    expect(named('view_item')[0][2]).toMatchObject({
      item_id: 'den-vong',
      item_name: 'Đèn Vọng',
      value: 1050000,
      currency: 'VND',
      page_path: '/products/den-vong',
    })
  })

  it('sản phẩm không tồn tại → không gửi view_item', async () => {
    window.history.pushState({}, '', '/products/khong-co')
    mockApi({ ...base, 'GET /products/khong-co': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    renderAt('/products/khong-co')
    await screen.findByRole('heading', { level: 1 })
    expect(named('view_item')).toHaveLength(0)
  })
})

describe('add_to_cart', () => {
  it('thêm thành công → gửi một lần; giá trị đúng slug và số lượng', async () => {
    window.history.pushState({}, '', '/products/den-vong')
    mockApi(base)
    renderAt('/products/den-vong')
    const btn = await screen.findByRole('button', { name: /giỏ/i })
    fireEvent.click(btn)
    await waitFor(() => expect(named('add_to_cart')).toHaveLength(1))
    expect(named('add_to_cart')[0][2]).toMatchObject({ item_id: 'den-vong', quantity: 1, currency: 'VND' })
  })

  it('thêm lỗi (server 500) → KHÔNG gửi add_to_cart', async () => {
    window.history.pushState({}, '', '/products/den-vong')
    mockApi({ ...base, 'POST /cart/quote': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/products/den-vong')
    const btn = await screen.findByRole('button', { name: /giỏ/i })
    fireEvent.click(btn)
    await screen.findByText(/lỗi|thử lại/i)
    expect(named('add_to_cart')).toHaveLength(0)
  })
})

describe('open_qr_batch (D-43: mã lô không phải bí mật)', () => {
  const batch = { code: 'L-01', title: 'Lô tháng 1', videoUrl: 'https://x/v.mp4', producedOn: '2026-01-05' }

  it('mở được trang lô → gửi một lần kèm batch_code', async () => {
    window.history.pushState({}, '', '/lo/L-01')
    mockApi({ ...base, 'GET /batches/L-01': () => ({ body: { item: batch } }) })
    renderAt('/lo/L-01')
    await waitFor(() => expect(named('open_qr_batch')).toHaveLength(1))
    expect(named('open_qr_batch')[0][2]).toMatchObject({ batch_code: 'L-01', page_path: '/lo/L-01' })
  })

  it('lô không có/chưa xuất bản video → không gửi', async () => {
    window.history.pushState({}, '', '/lo/L-01')
    mockApi({ ...base, 'GET /batches/L-01': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(named('open_qr_batch')).toHaveLength(0)
  })
})

describe('mascot_open', () => {
  it('bấm nút Mây gửi đúng một lần mỗi lần MỞ (đóng lại không gửi)', async () => {
    window.history.pushState({}, '', '/products/den-vong')
    mockApi(base)
    renderAt('/products/den-vong')
    const fab = await screen.findByRole('button', { name: 'Trò chuyện với Mây' })
    fireEvent.click(fab)
    await waitFor(() => expect(named('mascot_open')).toHaveLength(1))
    fireEvent.click(fab) // đóng
    fireEvent.click(fab) // mở lại
    await waitFor(() => expect(named('mascot_open')).toHaveLength(2))
  })
})

describe('Không sự kiện nào mang dữ liệu ngoài danh sách §23.3', () => {
  it('mọi sự kiện gửi đi đều thuộc danh sách + page_view', async () => {
    window.history.pushState({}, '', '/products/den-vong')
    mockApi(base)
    renderAt('/products/den-vong')
    await screen.findByRole('heading', { name: 'Đèn Vọng' })
    const { GA_EVENTS } = await import('./ga.js')
    for (const e of events()) {
      expect([...GA_EVENTS, 'page_view']).toContain(e[1])
    }
  })
})
