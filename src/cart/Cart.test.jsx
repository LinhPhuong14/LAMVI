// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
const PRICES = { 'den-nguyet': 890000, 'den-sum-vay': 1680000 }

// Server giả tính giá như thật từ danh sách { slug, quantity }
function present(lines, hidden = []) {
  const items = lines.map(({ slug, quantity }) => {
    const available = !hidden.includes(slug)
    return {
      slug,
      quantity,
      available,
      product: { name: slug === 'den-nguyet' ? 'Đèn Nguyệt' : 'Đèn Sum Vầy', tone: 'amber', price: available ? PRICES[slug] : null },
      lineTotal: available ? PRICES[slug] * quantity : null,
    }
  })
  return {
    items,
    subtotal: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0),
    itemCount: items.filter((i) => i.available).reduce((s, i) => s + i.quantity, 0),
    hasUnavailable: items.some((i) => !i.available),
    maxQuantity: 10,
    currency: 'VND',
  }
}

const base = {
  'GET /products': () => ({ body: productsVi }),
  'GET /faq': () => ({ body: { items: [] } }),
  'POST /cart/quote': (url, init) => ({ body: present(JSON.parse(init.body).items) }),
}

beforeEach(() => localStorage.setItem('moc.tour.done', '1'))

describe('Giỏ khách vãng lai (D-59)', () => {
  it('thêm từ thẻ sản phẩm → lưu trình duyệt, header hiện số lượng, giá do server tính', async () => {
    const f = mockApi(base)
    renderAt('/')
    const card = (await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })).closest('.product-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Thêm vào giỏ' }))
    expect(await screen.findByText(/Mây đã bỏ/)).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('moc.cart'))).toEqual([{ slug: 'den-nguyet', quantity: 1 }])
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (1)' })).toHaveAttribute('href', '/cart')
    const quote = f.mock.calls.filter(([u]) => String(u).startsWith('/api/cart/quote')).at(-1)
    expect(JSON.parse(quote[1].body)).toEqual({ items: [{ slug: 'den-nguyet', quantity: 1 }] })
  })

  it('trang giỏ: tạm tính chưa VAT, đổi số lượng (tối đa 10), xoá; noindex', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }, { slug: 'den-sum-vay', quantity: 1 }]))
    mockApi(base)
    renderAt('/cart')
    expect(await screen.findByText(/3\.460\.000/)).toBeInTheDocument()
    expect(screen.getByText('Giá đã gồm VAT. Phí giao hàng chính xác được chốt ở bước thanh toán.')).toBeInTheDocument()
    const line = screen.getByText('Đèn Nguyệt', { selector: 'strong' }).closest('li')
    fireEvent.click(within(line).getByRole('button', { name: 'Tăng số lượng' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('moc.cart'))[0]).toEqual({ slug: 'den-nguyet', quantity: 3 }))
    fireEvent.change(within(line).getByRole('spinbutton'), { target: { value: '99' } })
    await waitFor(() => expect(JSON.parse(localStorage.getItem('moc.cart'))[0].quantity).toBe(10))
    fireEvent.click(within(line).getByRole('button', { name: 'Xoá' }))
    await waitFor(() => expect(JSON.parse(localStorage.getItem('moc.cart'))).toEqual([{ slug: 'den-sum-vay', quantity: 1 }]))
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('D-61 / US-001 AC-003: chưa đăng nhập bấm Thanh toán → trang đăng nhập với next=/cart, giỏ còn nguyên', async () => {
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 1 }]))
    mockApi(base)
    renderAt('/en/cart')
    fireEvent.click(await screen.findByRole('button', { name: 'Checkout' }))
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument()
    expect(JSON.parse(localStorage.getItem('moc.cart'))).toEqual([{ slug: 'den-nguyet', quantity: 1 }])
  })

  it('giỏ trống', async () => {
    mockApi(base)
    renderAt('/cart')
    expect(await screen.findByText('Giỏ hàng đang trống.')).toBeInTheDocument()
  })
})

describe('Giỏ tài khoản (D-41, D-59, D-61)', () => {
  it('đăng nhập có giỏ trình duyệt → gộp vào server rồi xoá bản trình duyệt', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'den-nguyet', quantity: 2 }]))
    const merged = []
    mockApi({
      ...base,
      'POST /cart/merge': (url, init) => {
        merged.push(JSON.parse(init.body))
        return { body: present([{ slug: 'den-nguyet', quantity: 3 }]) }
      },
    })
    renderAt('/cart')
    expect(await screen.findByRole('link', { name: 'Giỏ hàng (3)' })).toBeInTheDocument()
    expect(merged).toEqual([{ items: [{ slug: 'den-nguyet', quantity: 2 }] }])
    expect(localStorage.getItem('moc.cart')).toBeNull()
  })

  it('sản phẩm bị ẩn: cảnh báo, không đổi được số lượng', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /cart': () => ({ body: present([{ slug: 'den-nguyet', quantity: 1 }, { slug: 'den-sum-vay', quantity: 1 }], ['den-sum-vay']) }),
    })
    renderAt('/cart')
    expect(await screen.findByText('Sản phẩm này hiện không còn bán — vui lòng xoá khỏi giỏ.')).toBeInTheDocument()
    expect(screen.getByText(/Giỏ có sản phẩm không còn bán/)).toBeInTheDocument()
    const hiddenLine = screen.getByText('Đèn Sum Vầy', { selector: 'strong' }).closest('li')
    expect(within(hiddenLine).getByRole('button', { name: 'Tăng số lượng' })).toBeDisabled()
  })

  it('trang sản phẩm: chọn số lượng rồi thêm → PUT số lượng cộng dồn', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    const puts = []
    mockApi({
      ...base,
      'GET /products/den-nguyet': () => ({ body: { item: productsVi.items[0] } }),
      'GET /cart': () => ({ body: present([{ slug: 'den-nguyet', quantity: 1 }]) }),
      'PUT /cart/items/den-nguyet': (url, init) => {
        puts.push(JSON.parse(init.body))
        return { body: present([{ slug: 'den-nguyet', quantity: JSON.parse(init.body).quantity }]) }
      },
    })
    renderAt('/products/den-nguyet')
    await screen.findByRole('link', { name: 'Giỏ hàng (1)' })
    fireEvent.click(screen.getByRole('button', { name: 'Tăng số lượng' }))
    // Nút chính nằm trong khung mua hàng; phía dưới còn thẻ "Có thể bạn cũng thích" cũng có nút thêm vào giỏ
    fireEvent.click(within(document.querySelector('.pdp-buy')).getByRole('button', { name: 'Thêm vào giỏ' }))
    expect(await screen.findByText(/Mây đã bỏ/)).toBeInTheDocument()
    expect(puts).toEqual([{ quantity: 3 }])
  })

  it('lỗi server khi thêm → hiện thông báo', async () => {
    localStorage.setItem('moc.session', JSON.stringify(session))
    mockApi({
      ...base,
      'GET /cart': () => ({ body: present([]) }),
      'PUT /cart/items/den-nguyet': () => ({ status: 409, body: { error: { code: 'PRODUCT_UNAVAILABLE' } } }),
    })
    renderAt('/')
    const card = (await screen.findByText('Đèn Nguyệt', { selector: '.product-card a' })).closest('.product-card')
    fireEvent.click(within(card).getByRole('button', { name: 'Thêm vào giỏ' }))
    expect(await within(card).findByText('Sản phẩm này hiện không còn bán.')).toBeInTheDocument()
  })
})
