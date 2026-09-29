// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) — hành vi thời gian chạy của track()/trackPageView() khi gtag chưa có,
// bị thay, hoặc tham số dị dạng (FR-GA-001 §23.3, NFR-PRV-002, NFR-AVL-001).
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { isEnabled, track, trackPageView, usePageViews } from './index.js'

const events = () => (window.dataLayer ?? []).filter((c) => c[0] === 'event')

function installGtag() {
  window.dataLayer = []
  window.gtag = (...args) => window.dataLayer.push(args)
}

beforeEach(() => {
  delete window.gtag
  window.dataLayer = []
  window.history.pushState({}, '', '/')
})

describe('gtag xuất hiện muộn (gtag.js tải bất đồng bộ)', () => {
  it('gọi trước khi có gtag → false; sau khi gtag có → gửi được, không mất hàm tham chiếu cũ', () => {
    expect(track('view_item', { item_id: 'a' })).toBe(false)
    expect(isEnabled()).toBe(false)

    installGtag()
    expect(isEnabled()).toBe(true)
    expect(track('view_item', { item_id: 'a' })).toBe(true)
    expect(events()).toHaveLength(1)
  })

  it('gtag bị gỡ giữa chừng (adblock xoá) → quay lại false, không ném lỗi', () => {
    installGtag()
    expect(track('mascot_open')).toBe(true)
    delete window.gtag
    expect(() => track('mascot_open')).not.toThrow()
    expect(track('mascot_open')).toBe(false)
  })

  it('window.gtag không phải hàm (biến bị ghi đè) → coi như chưa bật', () => {
    window.gtag = { push: () => {} }
    expect(isEnabled()).toBe(false)
    expect(track('add_to_cart', { item_id: 'a' })).toBe(false)
    expect(trackPageView('/')).toBe(false)
  })
})

describe('track() — tham số dị dạng (NFR-AVL-001)', () => {
  it('params null / undefined / chuỗi / mảng đều gửi được, chỉ còn tham số trang', () => {
    installGtag()
    for (const p of [null, undefined, 'chuoi', [1, 2, 3], 0, false]) {
      expect(track('mascot_open', p)).toBe(true)
    }
    for (const e of events()) {
      expect(Object.keys(e[2]).sort()).toEqual(['page_location', 'page_path'])
    }
  })

  it('params có getter ném lỗi → không lan ra ứng dụng, trả false', () => {
    installGtag()
    const hostile = {}
    Object.defineProperty(hostile, 'item_id', {
      enumerable: true,
      get() {
        throw new Error('getter hỏng')
      },
    })
    expect(() => track('add_to_cart', hostile)).not.toThrow()
    expect(track('add_to_cart', hostile)).toBe(false)
    expect(events()).toHaveLength(0)
  })

  it('params tự tham chiếu vòng → không ném lỗi', () => {
    installGtag()
    const a = { ok: 1 }
    a.self = a
    expect(() => track('view_item', a)).not.toThrow()
    expect(events()[0][2]).toMatchObject({ ok: 1 })
    expect(events()[0][2].self).toBeUndefined()
  })

  it('gọi nhiều lần liên tiếp không mất sự kiện và không lẫn tham số', () => {
    installGtag()
    for (let i = 0; i < 50; i += 1) track('add_to_cart', { item_id: `sp-${i}`, quantity: i })
    expect(events()).toHaveLength(50)
    expect(events()[49][2]).toMatchObject({ item_id: 'sp-49', quantity: 49 })
    expect(events()[0][2]).toMatchObject({ item_id: 'sp-0', quantity: 0 })
  })

  it('tên sự kiện dị dạng (null, số, chuỗi rỗng, có khoảng trắng) bị bỏ qua', () => {
    installGtag()
    for (const name of [null, undefined, '', 123, 'view_item ', 'VIEW_ITEM', 'page_view']) {
      expect(track(name, { item_id: 'a' })).toBe(false)
    }
    expect(events()).toHaveLength(0)
  })
})

describe('trackPageView — tiêu đề trang', () => {
  it('page_title đi qua sanitizeParams: cắt 100 ký tự (NFR-PRV-002)', () => {
    // Tiêu đề trang QR lời chúc có thể chứa tên người nhận / nội dung lời chúc → phải bị cắt như
    // mọi tham số chuỗi khác, không đi nguyên văn sang GA.
    installGtag()
    const title = `Lời chúc gửi Nguyễn Văn A — ${'x'.repeat(300)}`
    trackPageView('/qr/bimat', title)
    expect(events()[0][2].page_title).toHaveLength(100)
    expect(events()[0][2].page_title).toBe(title.slice(0, 100))
    // Đường dẫn vẫn được làm sạch đúng
    expect(events()[0][2].page_path).toBe('/qr/:token')
  })

  it('không có tiêu đề → không gửi page_title rỗng', () => {
    installGtag()
    trackPageView('/')
    expect(events()[0][2].page_title).toBeUndefined()
  })
})

describe('usePageViews — điều hướng lặp lại', () => {
  function App() {
    usePageViews()
    return (
      <Routes>
        <Route path="/" element={<p>trang chu</p>} />
        <Route path="/products/:slug" element={<p>san pham</p>} />
      </Routes>
    )
  }

  it('render lại cùng một đường dẫn không gửi page_view trùng', async () => {
    installGtag()
    const { rerender } = render(
      <MemoryRouter initialEntries={['/products/den-nguyet']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(events()).toHaveLength(1))
    rerender(
      <MemoryRouter initialEntries={['/products/den-nguyet']}>
        <App />
      </MemoryRouter>,
    )
    await new Promise((r) => setTimeout(r, 20))
    expect(events()).toHaveLength(1)
  })

  it('chưa bật GA thì mọi lần điều hướng vẫn im lặng (không cảnh báo console)', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    render(
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>,
    )
    await waitFor(() => expect(document.body.textContent).toContain('trang chu'))
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
