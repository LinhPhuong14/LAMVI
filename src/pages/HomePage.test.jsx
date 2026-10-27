// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import { faqVi, productsVi } from '../test/fixtures.js'

const handlers = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: faqVi }),
}

describe('Trang chủ', () => {
  it('G-01/G-09: sản phẩm lấy từ API, giá kèm "đã gồm VAT" (D-68)', async () => {
    mockApi(handlers)
    renderAt('/')
    const grid = await screen.findByText('Đèn Sum Vầy', { selector: '.product-card a' })
    const card = grid.closest('.product-card')
    expect(within(card).getByText('đã gồm VAT')).toBeInTheDocument()
    expect(within(card).getByText(/1\.680\.000/)).toBeInTheDocument()
  })

  it('G-07: FAQ lấy từ API', async () => {
    mockApi(handlers)
    renderAt('/')
    expect(await screen.findByText('Lưu bao lâu?')).toBeInTheDocument()
  })

  it('D-37: /en gọi API với lang=en và đặt html lang', async () => {
    const fetchMock = mockApi(handlers)
    renderAt('/en')
    await screen.findAllByText('Đèn Nguyệt')
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/products?lang=en'))).toBe(true)
    expect(document.documentElement.lang).toBe('en')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Every lantern')
  })

  it('API lỗi → hiện thông báo lỗi, không vỡ trang', async () => {
    mockApi({ 'GET /products': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/')
    expect(await screen.findByText('Không tải được sản phẩm. Vui lòng thử lại sau.')).toBeInTheDocument()
  })
})

describe('Hero trang chủ', () => {
  it('dùng ảnh cover có srcSet 800/1280/1672, alt từ i18n; không còn đèn hay ảnh minh hoạ cũ', async () => {
    mockApi(handlers)
    const { container } = renderAt('/')
    await screen.findAllByText('Đèn Nguyệt')
    const fig = container.querySelector('figure.hero-cover')
    expect(fig).toBeInTheDocument()
    const img = fig.querySelector('img')
    expect(img).toHaveAttribute('src', '/images/brand/cover-1280.webp')
    expect(img.getAttribute('srcset')).toMatch(/cover-800\.webp 800w.*cover-1280\.webp 1280w.*cover-1672\.webp 1672w/)
    expect(img).toHaveAttribute('alt', viMsg.hero.coverAlt)
    expect(img).toHaveAttribute('width', '1672')
    expect(img).toHaveAttribute('height', '800')
    expect(img.getAttribute('fetchpriority') ?? img.getAttribute('fetchPriority')).toBe('high')
    expect(container.querySelector('.hero-polaroid')).toBeNull()
    expect(container.querySelector('.hero-lamp')).toBeNull()
  })
})

describe('Trang sản phẩm', () => {
  it('FR-CAT-001: hiển thị chi tiết theo ngôn ngữ', async () => {
    mockApi({ ...handlers, 'GET /products/den-nguyet': () => ({ body: { item: productsVi.items[0] } }) })
    renderAt('/zh/products/den-nguyet')
    expect(await screen.findByRole('heading', { level: 1, name: 'Đèn Nguyệt' })).toBeInTheDocument()
    expect(screen.getAllByText('含增值税').length).toBeGreaterThan(0)
  })

  it('404 → "Không tìm thấy sản phẩm."', async () => {
    mockApi(handlers)
    renderAt('/products/khong-co')
    expect(await screen.findByText('Không tìm thấy sản phẩm.')).toBeInTheDocument()
  })
})
