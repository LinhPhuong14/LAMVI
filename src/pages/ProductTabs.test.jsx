// @vitest-environment jsdom
// Feedback 08/10, mục 8: tab Mô tả / Thông số / Giao hàng & đổi trả
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const mk = (specs) => ({ slug: 'den-a', kind: 'single', name: 'Đèn A', description: 'Mô tả đèn A', badge: null, tone: 'amber', price: 890000, currency: 'VND', image: null, specs })
const api = (item) =>
  mockApi({
    'GET /products': () => ({ body: { items: [item] } }),
    'GET /products/den-a': () => ({ body: { item } }),
    'GET /shipping-policy': () => ({ body: { fee: 30000, freeFrom: 1000000 } }),
    'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
    'GET /faq': () => ({ body: { items: [] } }),
  })

beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe('Tab thông tin sản phẩm', () => {
  it('tab Thông số liệt kê các mục có dữ liệu theo thứ tự cố định', async () => {
    api(mk({ care: 'Tránh ẩm', size: 'Cao 30 cm', material: 'Giấy dó' }))
    renderAt('/products/den-a')
    fireEvent.click(await screen.findByRole('tab', { name: 'Thông số' }))
    const panel = document.getElementById('pdp-panel-specs')
    expect(panel.hidden).toBe(false)
    expect([...panel.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Kích thước', 'Chất liệu', 'Bảo quản'])
    expect(panel.textContent).toContain('Cao 30 cm')
    expect(screen.getByRole('tab', { name: 'Thông số' }).getAttribute('aria-selected')).toBe('true')
  })

  it('chưa có thông số → báo đang cập nhật; tab Giao hàng có phí ship và liên kết chính sách', async () => {
    api(mk({}))
    renderAt('/products/den-a')
    fireEvent.click(await screen.findByRole('tab', { name: 'Thông số' }))
    expect(screen.getByText('Thông số chi tiết đang được cập nhật.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Giao hàng & đổi trả' }))
    const ship = document.getElementById('pdp-panel-ship')
    expect(ship.querySelector('a[href="/shipping"]')).not.toBeNull()
    expect(ship.querySelector('a[href="/returns"]')).not.toBeNull()
  })

  it('mô tả là tab mặc định; ba panel đều có trong HTML', async () => {
    api(mk({ size: 'Cao 30 cm' }))
    renderAt('/products/den-a')
    await screen.findByRole('tab', { name: 'Mô tả' })
    expect(document.getElementById('pdp-panel-desc').hidden).toBe(false)
    expect(document.getElementById('pdp-panel-specs').hidden).toBe(true)
    expect(document.querySelectorAll('[role="tabpanel"]')).toHaveLength(3)
  })
})
