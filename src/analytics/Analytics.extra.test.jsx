// @vitest-environment jsdom
// Kiểm thử hành vi GA phía client (FR-GA-001 §23.3, NFR-PRV-002, NFR-AVL-001).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom'
import { track, trackPageView, usePageViews, isEnabled } from './index.js'

const calls = () => window.dataLayer ?? []
const events = () => calls().filter((c) => c[0] === 'event')

function installGtag() {
  window.dataLayer = []
  window.gtag = (...args) => window.dataLayer.push(args)
}

beforeEach(() => {
  delete window.gtag
  window.dataLayer = []
})

describe('track() — chỉ sự kiện trong §23.3', () => {
  it('gửi được sự kiện hợp lệ kèm tham số đã làm sạch', () => {
    installGtag()
    expect(track('add_to_cart', { item_id: 'den-nguyet', quantity: 2 })).toBe(true)
    expect(events()[0][1]).toBe('add_to_cart')
    expect(events()[0][2]).toMatchObject({ item_id: 'den-nguyet', quantity: 2 })
  })

  it('bỏ qua sự kiện không có trong danh sách (tránh gửi nhầm dữ liệu nhạy cảm)', () => {
    installGtag()
    expect(track('gui_dia_chi_khach', { address: '12 Hàng Bông' })).toBe(false)
    expect(events()).toHaveLength(0)
  })

  it('NFR-PRV-002: mỗi sự kiện tự mang đường dẫn đã làm sạch, không để GA đọc URL thật', () => {
    installGtag()
    window.history.pushState({}, '', '/qr/token-bi-mat-123?ref=zalo')
    track('open_qr_gift', {})
    const params = events()[0][2]
    expect(params.page_path).toBe('/qr/:token')
    expect(params.page_location).toBe(`${window.location.origin}/qr/:token`)
    expect(JSON.stringify(params)).not.toContain('token-bi-mat-123')
    expect(JSON.stringify(params)).not.toContain('ref=zalo')
  })

  it('tham số của người gọi không ghi đè được đường dẫn đã làm sạch', () => {
    installGtag()
    window.history.pushState({}, '', '/qr/token-bi-mat-456')
    track('open_qr_gift', { page_path: '/qr/token-bi-mat-456' })
    expect(events()[0][2].page_path).toBe('/qr/:token')
  })

  it('NFR-AVL-001: chưa nhúng GA → không ném lỗi, trả false', () => {
    expect(isEnabled()).toBe(false)
    expect(track('add_to_cart', { item_id: 'x' })).toBe(false)
    expect(trackPageView('/')).toBe(false)
  })

  it('NFR-AVL-001: gtag ném lỗi → không lan ra ứng dụng', () => {
    window.gtag = () => {
      throw new Error('GA chặn bởi trình duyệt')
    }
    expect(() => track('mascot_open')).not.toThrow()
    expect(track('mascot_open')).toBe(false)
  })
})

describe('page_view theo điều hướng SPA', () => {
  function GoToProduct() {
    const navigate = useNavigate()
    return (
      <button type="button" onClick={() => navigate('/products/den-nguyet')}>
        tới sản phẩm
      </button>
    )
  }

  function App() {
    usePageViews()
    return (
      <Routes>
        <Route path="/" element={<GoToProduct />} />
        <Route path="/products/:slug" element={<h1>Chi tiết</h1>} />
        <Route path="/qr/:token" element={<h1>Lời chúc</h1>} />
      </Routes>
    )
  }

  it('gửi page_view khi tải trang và mỗi lần điều hướng SPA', async () => {
    installGtag()
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(events()).toHaveLength(1))
    expect(events()[0][2].page_path).toBe('/')

    fireEvent.click(screen.getByRole('button', { name: 'tới sản phẩm' }))
    await screen.findByText('Chi tiết')
    await waitFor(() => expect(events()).toHaveLength(2))
    expect(events()[1][2].page_path).toBe('/products/den-nguyet')
  })

  it('trang QR lời chúc: page_view không chứa token', async () => {
    installGtag()
    render(
      <MemoryRouter initialEntries={['/qr/sieu-bi-mat']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(events()).toHaveLength(1))
    expect(events()[0][2].page_path).toBe('/qr/:token')
    expect(JSON.stringify(events()[0])).not.toContain('sieu-bi-mat')
  })

  it('chưa nhúng GA → điều hướng vẫn chạy bình thường, không lỗi', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/products/den-nguyet']}>
        <App />
      </MemoryRouter>,
    )
    await screen.findByText('Chi tiết')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
