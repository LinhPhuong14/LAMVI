// @vitest-environment jsdom
// T-11: kiểm thử độc lập checkout / đơn của tôi (§12–§16, FR-CHK-001…008, FR-ACC-002, US-001, US-002)
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { productsVi } from '../test/fixtures.js'
import { translate } from '../i18n/core.js'
import { formatVnd } from '../lib/money.js'
import { formatDateTime } from '../lib/date.js'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@moc.test' } }
const cartWith = (n) => ({
  items: n ? [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', tone: 'amber', unitPrice: 890000, quantity: n, lineTotal: 890000 * n, available: true }] : [],
  subtotalExclVat: 890000 * n,
  itemCount: n,
  hasUnavailable: false,
  maxQuantity: 10,
  currency: 'VND',
})

function quoteBody({ recipientType } = {}, over = {}) {
  const subtotal = 890000
  const vat = 89000
  return {
    items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', tone: 'amber', unitPrice: 890000, quantity: 1, lineTotal: 890000 }],
    hasUnavailable: false,
    pricing: { subtotal, discount: 0, shippingFeeBeforeDiscount: 30000, shippingFee: 30000, vat, vatRate: 0.1, total: subtotal + 30000 + vat, currency: 'VND' },
    coupon: null,
    couponError: null,
    cod: recipientType === 'other' ? { allowed: false, reason: 'COD_RECIPIENT_OTHER' } : { allowed: true, reason: null },
    payosAvailable: true,
    shop: { shippingFee: 30000, freeShippingFrom: 1500000 },
    ...over,
  }
}

const order = (over = {}) => ({
  id: 'o1',
  code: 100001,
  status: 'CONFIRMED',
  productionStage: null,
  orderType: 'self',
  hasMessage: false,
  qrLang: null,
  recipientType: 'self',
  recipient: { name: 'Nguyễn An', phone: '0912345678', province: 'Hà Nội', district: 'Hoàn Kiếm', ward: 'Hàng Trống', street: '1 Lý Thái Tổ' },
  paymentMethod: 'cod',
  paymentStatus: 'COD_PENDING',
  couponCode: null,
  subtotal: 890000,
  discount: 0,
  shippingFee: 30000,
  vat: 89000,
  total: 1009000,
  paymentExpiresAt: null,
  trackingCode: null,
  cancelReason: null,
  refundedAmount: null,
  canCancel: true,
  canPay: false,
  createdAt: '2026-10-01T03:00:00.000Z',
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', unitPrice: 890000, quantity: 1, lineTotal: 890000 }],
  ...over,
})

function handlers(extra = {}) {
  const log = []
  const h = {
    'GET /products': () => ({ body: productsVi }),
    'GET /faq': () => ({ body: { items: [] } }),
    'GET /cart': () => ({ body: cartWith(1) }),
    'GET /me': () => ({ body: { profile: { fullName: 'Nguyễn An', phone: '0912345678', preferredLocale: 'vi', email: 'an@moc.test' } } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'POST /checkout/quote': (url, init) => {
      const b = JSON.parse(init.body)
      log.push({ key: 'quote', body: b, lang: url.searchParams.get('lang') })
      return { body: quoteBody(b) }
    },
    'POST /orders': (url, init) => {
      const b = JSON.parse(init.body)
      log.push({ key: 'order', body: b })
      return { status: 201, body: { order: order(), checkoutUrl: b.paymentMethod === 'payos' ? 'https://pay.test/1' : null } }
    },
    'GET /orders/o1': () => ({ body: { order: order() } }),
    ...extra,
  }
  return { h, log }
}

const orderCalls = (f) => f.mock.calls.filter(([u, init]) => String(u).startsWith('/api/orders?') && init?.method === 'POST')
const sentOrders = (f) => orderCalls(f).map(([, init]) => JSON.parse(init.body))
const getCalls = (f, path) => f.mock.calls.filter(([u, init]) => new URL(u, 'http://x').pathname === `/api${path}` && (init?.method ?? 'GET') === 'GET')

async function readyForm() {
  await waitFor(() => expect(screen.getByLabelText('Họ và tên người nhận')).toHaveValue('Nguyễn An'))
  for (const [label, value] of [
    ['Tỉnh / Thành phố', 'Hà Nội'],
    ['Quận / Huyện', 'Hoàn Kiếm'],
    ['Phường / Xã', 'Hàng Trống'],
    ['Số nhà, đường', '1 Lý Thái Tổ'],
  ]) {
    fireEvent.change(screen.getByLabelText(label), { target: { value } })
  }
}

beforeEach(() => {
  localStorage.setItem('moc.tour.done', '1')
  localStorage.setItem('moc.session', JSON.stringify(session))
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('Checkout — đa ngôn ngữ (FR-I18N, D-37)', () => {
  it('/en/checkout: chuỗi tiếng Anh, quote gọi lang=en, link giỏ trống giữ tiền tố /en', async () => {
    const { h, log } = handlers()
    mockApi(h)
    renderAt('/en/checkout')
    expect(await screen.findByRole('heading', { level: 1, name: 'Checkout' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Order summary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Place order and pay' })).toBeInTheDocument()
    expect(screen.getByLabelText('Recipient full name')).toBeInTheDocument()
    expect(log.find((l) => l.key === 'quote').lang).toBe('en')
    expect(document.title).toContain('Checkout')
  })

  it('/en/checkout giỏ trống → link quay lại /en/cart', async () => {
    mockApi(handlers({ 'POST /checkout/quote': () => ({ body: quoteBody({}, { items: [] }) }) }).h)
    renderAt('/en/checkout')
    const link = await screen.findByRole('link', { name: translate('en', 'checkout.backToCart') })
    expect(link).toHaveAttribute('href', '/en/cart')
  })

  it('/zh/account/orders/:id khi chưa đăng nhập → /zh/login, next giữ cả query', async () => {
    localStorage.removeItem('moc.session')
    mockApi(handlers().h)
    renderAt('/zh/account/orders/o1?payment=return')
    await waitFor(() => expect(document.querySelector('a[href^="/zh/register?next="]')).not.toBeNull())
    const href = document.querySelector('a[href^="/zh/register?next="]').getAttribute('href')
    expect(decodeURIComponent(href.split('next=')[1])).toBe('/zh/account/orders/o1?payment=return')
  })

  it('/zh/account/orders/:id: tiêu đề, trạng thái, nút, link về tài khoản bằng tiếng Trung', async () => {
    const f = mockApi(handlers().h)
    renderAt('/zh/account/orders/o1')
    expect(await screen.findByRole('heading', { name: translate('zh', 'orders.orderTitle', { code: 100001 }) })).toBeInTheDocument()
    expect(screen.getByText(translate('zh', 'orderStatus.CONFIRMED'))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: translate('zh', 'orders.cancel') })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: translate('zh', 'orders.backToAccount') })).toHaveAttribute('href', '/zh/account')
    expect(screen.getByText(new RegExp(translate('zh', 'paymentStatus.COD_PENDING')))).toBeInTheDocument()
    expect(getCalls(f, '/orders/o1')[0][0]).toContain('lang=zh')
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('/zh/account: danh sách đơn có link /zh/account/orders/:id', async () => {
    mockApi(
      handlers({
        'GET /orders': () => ({
          body: { items: [{ id: 'o1', code: 100001, status: 'SHIPPED', productionStage: null, total: 1009000, itemCount: 2, firstItemName: '月灯', createdAt: '2026-10-01T03:00:00.000Z' }] },
        }),
      }).h,
    )
    renderAt('/zh/account')
    const link = await screen.findByRole('link', { name: /#100001/ })
    expect(link).toHaveAttribute('href', '/zh/account/orders/o1')
    expect(link.textContent).toContain(translate('zh', 'orders.itemCount', { n: 2 }))
    expect(screen.getByText(translate('zh', 'orderStatus.SHIPPED'))).toBeInTheDocument()
  })
})

describe('Checkout — gửi đơn & clientKey (chống tạo hai đơn)', () => {
  it('bấm đặt hàng hai lần nhanh → chỉ 1 request; nút bị khoá + chữ "Đang đặt hàng…"', async () => {
    let release
    const { h } = handlers({
      'POST /orders': () =>
        new Promise((r) => {
          release = () => r({ status: 201, body: { order: order(), checkoutUrl: null } })
        }),
    })
    const f = mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Thanh toán khi nhận hàng/))
    await readyForm()
    const btn = screen.getByRole('button', { name: 'Đặt hàng' })
    fireEvent.click(btn)
    fireEvent.click(btn)
    const placing = await screen.findByRole('button', { name: 'Đang đặt hàng…' })
    expect(placing).toBeDisabled()
    fireEvent.click(placing)
    await waitFor(() => expect(orderCalls(f)).toHaveLength(1))
    await act(async () => release())
    expect(await screen.findByRole('heading', { name: 'Đơn #100001' })).toBeInTheDocument()
    expect(orderCalls(f)).toHaveLength(1)
  })

  it('gửi form hai lần (vd Enter) trong lúc chờ → mọi request dùng CÙNG clientKey', async () => {
    let release
    const { h } = handlers({
      'POST /orders': () =>
        new Promise((r) => {
          release = () => r({ status: 201, body: { order: order(), checkoutUrl: null } })
        }),
    })
    const f = mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Thanh toán khi nhận hàng/))
    await readyForm()
    const form = screen.getByLabelText('Số nhà, đường').closest('form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(orderCalls(f).length).toBeGreaterThanOrEqual(1))
    const keys = new Set(sentOrders(f).map((b) => b.clientKey))
    expect(keys.size).toBe(1)
    await act(async () => release?.())
  })

  it('lỗi mạng → báo lỗi, thử lại dùng nguyên clientKey; PAYMENT_UNAVAILABLE → khoá mới', async () => {
    let n = 0
    const { h } = handlers({
      'POST /orders': () => {
        n += 1
        if (n === 1) throw new TypeError('Failed to fetch')
        if (n === 2) return { status: 502, body: { error: { code: 'PAYMENT_UNAVAILABLE' } } }
        return { status: 201, body: { order: order({ status: 'PENDING_PAYMENT' }), checkoutUrl: null } }
      },
    })
    const f = mockApi(h)
    renderAt('/checkout')
    await readyForm()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    expect(await screen.findByText('Không kết nối được máy chủ. Vui lòng thử lại.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    expect(await screen.findByText('Chưa tạo được link thanh toán. Vui lòng thử lại.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    await waitFor(() => expect(orderCalls(f)).toHaveLength(3))
    const [k1, k2, k3] = sentOrders(f).map((b) => b.clientKey)
    expect(k2).toBe(k1)
    expect(k3).not.toBe(k1)
  })

  it('đặt xong → giỏ ở header được nạp lại từ server', async () => {
    let cartCount = 1
    const { h } = handlers({
      'GET /cart': () => ({ body: cartWith(cartCount) }),
      'POST /orders': () => {
        cartCount = 0
        return { status: 201, body: { order: order(), checkoutUrl: null } }
      },
    })
    const f = mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Thanh toán khi nhận hàng/))
    await readyForm()
    await waitFor(() => expect(screen.getByRole('link', { name: 'Giỏ hàng (1)' })).toBeInTheDocument())
    const before = getCalls(f, '/cart').length
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await screen.findByRole('heading', { name: 'Đơn #100001' })
    await waitFor(() => expect(getCalls(f, '/cart').length).toBeGreaterThan(before))
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Giỏ hàng (1)' })).toBeNull())
  })
})

describe('Checkout — phương thức thanh toán (BR-PAY-004, D-71)', () => {
  it('self → other → self: COD tắt rồi bật lại; gửi đúng paymentMethod + recipientType', async () => {
    const { h, log } = handlers()
    const f = mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Thanh toán khi nhận hàng/))
    fireEvent.click(screen.getByLabelText('Người khác'))
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled())
    expect(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' })).toBeEnabled()
    fireEvent.click(screen.getByLabelText('Bản thân'))
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeEnabled())
    expect(log.filter((l) => l.key === 'quote').map((l) => l.body.recipientType)).toEqual(['self', 'other', 'self'])
    // Chọn lại người khác rồi đặt → payOS
    fireEvent.click(screen.getByLabelText('Người khác'))
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled())
    await readyForm()
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    await waitFor(() => expect(orderCalls(f)).toHaveLength(1))
    expect(sentOrders(f)[0]).toMatchObject({ recipientType: 'other', paymentMethod: 'payos' })
  })

  it('payOS chưa bật (payosAvailable=false) → chỉ COD, nút "Đặt hàng"', async () => {
    const { h } = handlers({ 'POST /checkout/quote': (u, init) => ({ body: quoteBody(JSON.parse(init.body), { payosAvailable: false }) }) })
    const f = mockApi(h)
    renderAt('/checkout')
    const payos = await screen.findByLabelText(/Chuyển khoản/)
    expect(payos).toBeDisabled()
    expect(payos).not.toBeChecked()
    expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeChecked()
    expect(screen.getByText('Thanh toán trực tuyến tạm thời chưa mở.')).toBeInTheDocument()
    await readyForm()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(orderCalls(f)).toHaveLength(1))
    expect(sentOrders(f)[0].paymentMethod).toBe('cod')
  })

  it('payOS tắt + giao người khác → không còn phương thức nào, nút đặt bị khoá', async () => {
    const { h } = handlers({ 'POST /checkout/quote': (u, init) => ({ body: quoteBody(JSON.parse(init.body), { payosAvailable: false }) }) })
    mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText('Người khác'))
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled())
    expect(screen.getByLabelText(/Chuyển khoản/)).toBeDisabled()
    expect(document.querySelector('button[type="submit"]')).toBeDisabled()
  })

  it('COD vượt trần (quote cod.reason=COD_OVER_LIMIT) → COD khoá, lý do hiện ra', async () => {
    const { h } = handlers({
      'POST /checkout/quote': (u, init) => ({ body: quoteBody(JSON.parse(init.body), { cod: { allowed: false, reason: 'COD_OVER_LIMIT' } }) }),
    })
    mockApi(h)
    renderAt('/checkout')
    expect(await screen.findByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled()
    expect(screen.getByText('Đơn vượt mức tối đa cho COD.')).toBeInTheDocument()
  })
})

describe('Checkout — bảng giá, coupon, lỗi khi đặt', () => {
  it('quote có hasUnavailable → nút đặt bị khoá, có link về giỏ', async () => {
    mockApi(handlers({ 'POST /checkout/quote': (u, init) => ({ body: quoteBody(JSON.parse(init.body), { hasUnavailable: true }) }) }).h)
    renderAt('/checkout')
    expect(await screen.findByText(/Giỏ có sản phẩm không còn bán\./)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' })).toBeDisabled()
    const summary = screen.getByRole('heading', { name: 'Đơn hàng' }).closest('aside')
    expect(within(summary).getByRole('link', { name: 'Quay lại giỏ hàng' })).toHaveAttribute('href', '/cart')
  })

  it('miễn phí ship (D-63) → "Miễn phí", không hiện gợi ý mức miễn phí', async () => {
    mockApi(
      handlers({
        'POST /checkout/quote': (u, init) => {
          const q = quoteBody(JSON.parse(init.body))
          return { body: { ...q, pricing: { ...q.pricing, shippingFee: 0, total: q.pricing.total - 30000 } } }
        },
      }).h,
    )
    renderAt('/checkout')
    const summary = (await screen.findByRole('heading', { name: 'Đơn hàng' })).closest('aside')
    expect(within(summary).getByText('Phí vận chuyển').nextSibling.textContent).toBe('Miễn phí')
    expect(within(summary).queryByText(/Miễn phí vận chuyển cho đơn/)).toBeNull()
  })

  it('coupon COUPON_MIN_ORDER (từ quote) → số tiền tối thiểu được định dạng VND', async () => {
    mockApi(
      handlers({
        'POST /checkout/quote': (u, init) => {
          const b = JSON.parse(init.body)
          return { body: quoteBody(b, { couponError: b.couponCode ? { code: 'COUPON_MIN_ORDER', minOrder: 1000000 } : null }) }
        },
      }).h,
    )
    renderAt('/checkout')
    fireEvent.change(await screen.findByLabelText('Mã giảm giá'), { target: { value: 'TET' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    const msg = await screen.findByText(/Mã áp dụng cho đơn có tạm tính từ/)
    expect(msg.textContent).toBe(`Mã áp dụng cho đơn có tạm tính từ ${formatVnd(1000000)}.`)
    expect(msg.textContent).toMatch(/1\.000\.000/)
  })

  it('bỏ mã → gửi lại quote với couponCode=null, ô nhập rỗng', async () => {
    const { h, log } = handlers()
    mockApi(h)
    renderAt('/checkout')
    fireEvent.change(await screen.findByLabelText('Mã giảm giá'), { target: { value: '  sai  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(log.at(-1).body.couponCode).toBe('sai'))
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ mã' }))
    await waitFor(() => expect(log.at(-1).body.couponCode).toBeNull())
    expect(screen.getByLabelText('Mã giảm giá')).toHaveValue('')
  })

  it('COUPON_MIN_ORDER khi đặt hàng (mã vừa đổi điều kiện) → không được hiện "{min}" thô cho khách', async () => {
    let changed = false
    const { h } = handlers({
      'POST /checkout/quote': (u, init) => {
        const b = JSON.parse(init.body)
        if (!b.couponCode) return { body: quoteBody(b) }
        return changed
          ? { body: quoteBody(b, { couponError: { code: 'COUPON_MIN_ORDER', minOrder: 1000000 } }) }
          : { body: quoteBody(b, { coupon: { code: 'TET', type: 'amount', value: 50000 } }) }
      },
      'POST /orders': () => {
        changed = true
        return { status: 409, body: { error: { code: 'COUPON_MIN_ORDER', fields: { couponCode: 'COUPON_MIN_ORDER' } } } }
      },
    })
    mockApi(h)
    renderAt('/checkout')
    await readyForm()
    fireEvent.change(screen.getByLabelText('Mã giảm giá'), { target: { value: 'TET' } })
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await screen.findByText('Đã áp dụng mã TET.')
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    await waitFor(() => expect(screen.getAllByText(/Mã áp dụng cho đơn có tạm tính từ/).length).toBeGreaterThan(0))
    await waitFor(() => expect(screen.queryByText('Đã áp dụng mã TET.')).toBeNull())
    expect(document.body.textContent).not.toContain('{min}')
  })

  it('CART_EMPTY khi đặt (vd đã đặt ở tab khác) → tải lại bảng giá, hiện giỏ trống', async () => {
    let empty = false
    const { h } = handlers({
      'POST /checkout/quote': (u, init) => ({ body: quoteBody(JSON.parse(init.body), empty ? { items: [] } : {}) }),
      'POST /orders': () => {
        empty = true
        return { status: 409, body: { error: { code: 'CART_EMPTY' } } }
      },
    })
    mockApi(h)
    renderAt('/checkout')
    await readyForm()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' }))
    expect(await screen.findByRole('link', { name: 'Quay lại giỏ hàng' })).toHaveAttribute('href', '/cart')
    expect(screen.getByText('Giỏ hàng đang trống.')).toBeInTheDocument()
  })

  it('COD_OVER_LIMIT khi đặt → báo lỗi, bảng giá mới khoá COD và chuyển sang payOS', async () => {
    let over = false
    const { h } = handlers({
      'POST /checkout/quote': (u, init) => ({
        body: quoteBody(JSON.parse(init.body), over ? { cod: { allowed: false, reason: 'COD_OVER_LIMIT' } } : {}),
      }),
      'POST /orders': () => {
        over = true
        return { status: 409, body: { error: { code: 'COD_OVER_LIMIT', fields: { paymentMethod: 'COD_OVER_LIMIT' } } } }
      },
    })
    mockApi(h)
    renderAt('/checkout')
    fireEvent.click(await screen.findByLabelText(/Thanh toán khi nhận hàng/))
    await readyForm()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Đơn vượt mức tối đa cho COD.')
    await waitFor(() => expect(screen.getByLabelText(/Thanh toán khi nhận hàng/)).toBeDisabled())
    expect(screen.getByLabelText(/Chuyển khoản/)).toBeChecked()
    expect(screen.getByRole('button', { name: 'Đặt hàng và thanh toán' })).toBeEnabled()
  })

  it('quote lỗi (500) → thông báo lỗi chung, không treo "Đang tính giá…"', async () => {
    mockApi(handlers({ 'POST /checkout/quote': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }).h)
    renderAt('/checkout')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra. Vui lòng thử lại sau.')
    expect(screen.queryByText('Đang tính giá…')).toBeNull()
  })

  it('đơn Tặng gửi hasMessage qua qrLang; Tự mua không lời chúc → không gửi qrLang (D-64)', async () => {
    const { h } = handlers()
    const f = mockApi(h)
    renderAt('/en/checkout')
    await waitFor(() => expect(screen.getByLabelText('Recipient full name')).toHaveValue('Nguyễn An'))
    // mặc định ngôn ngữ trang lời chúc = ngôn ngữ đang xem
    expect(screen.getByLabelText(translate('en', 'checkout.qrLang'))).toHaveValue('en')
    fireEvent.change(screen.getByLabelText(translate('en', 'checkout.qrLang')), { target: { value: 'zh' } })
    for (const k of ['province', 'district', 'ward', 'street']) {
      fireEvent.change(screen.getByLabelText(translate('en', `checkout.${k}`)), { target: { value: 'X' } })
    }
    vi.stubGlobal('location', { ...window.location, assign: vi.fn() })
    fireEvent.click(screen.getByRole('button', { name: 'Place order and pay' }))
    await waitFor(() => expect(orderCalls(f)).toHaveLength(1))
    expect(sentOrders(f)[0]).toMatchObject({ orderType: 'gift', qrLang: 'zh' })
    expect(orderCalls(f)[0][0]).toContain('lang=en')
  })
})

describe('Đơn của tôi — trạng thái (FR-ACC-002, §16)', () => {
  const at = (o, url = '/account/orders/o1', extra = {}) => {
    const f = mockApi(handlers({ 'GET /orders/o1': () => ({ body: { order: o } }), ...extra }).h)
    renderAt(url)
    return f
  }

  it('PENDING_PAYMENT: nút Thanh toán + hạn thanh toán định dạng giờ VN; bấm → /pay rồi chuyển trang', async () => {
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })
    const exp = '2026-10-01T03:15:00.000Z'
    const f = at(order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: exp, canPay: true }), '/account/orders/o1', {
      'POST /orders/o1/pay': () => ({ body: { checkoutUrl: 'https://pay.test/again' } }),
    })
    expect(await screen.findByText(`Đơn đang chờ thanh toán (hạn ${formatDateTime(exp, 'vi')}).`)).toBeInTheDocument()
    expect(formatDateTime(exp, 'vi')).toMatch(/10:15/)
    expect(document.querySelector('.order-stages')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Thanh toán' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://pay.test/again'))
    expect(f.mock.calls.some(([u, i]) => String(u).startsWith('/api/orders/o1/pay') && i.method === 'POST')).toBe(true)
  })

  it('Thanh toán lại lỗi ORDER_NOT_PAYABLE → báo lỗi và nạp lại đơn', async () => {
    let n = 0
    const f = at(null, '/account/orders/o1', {
      'GET /orders/o1': () => {
        n += 1
        return {
          body: {
            order:
              n === 1
                ? order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: '2026-10-01T03:15:00.000Z', canPay: true })
                : order({ status: 'CANCELLED', paymentMethod: 'payos', paymentStatus: 'EXPIRED', cancelReason: 'payment_expired', canCancel: false }),
          },
        }
      },
      'POST /orders/o1/pay': () => ({ status: 409, body: { error: { code: 'ORDER_NOT_PAYABLE' } } }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Thanh toán' }))
    expect(await screen.findByText('Đơn không còn chờ thanh toán.')).toBeInTheDocument()
    expect(await screen.findByText('Đơn đã huỷ vì quá hạn thanh toán.')).toBeInTheDocument()
    expect(getCalls(f, '/orders/o1')).toHaveLength(2)
    expect(screen.queryByRole('button', { name: 'Thanh toán' })).toBeNull()
  })

  it.each([
    ['customer', 'Bạn đã huỷ đơn này.'],
    ['admin', 'Đơn đã được MỘC huỷ.'],
    ['payment_expired', 'Đơn đã huỷ vì quá hạn thanh toán.'],
    ['payment_error', 'Đơn đã huỷ vì không tạo được thanh toán.'],
    ['payment_mismatch', 'Đơn đã huỷ vì số tiền thanh toán không khớp.'],
    [null, 'Đơn đã được MỘC huỷ.'],
  ])('CANCELLED (cancelReason=%s) → thông báo lý do, không công đoạn, không nút', async (reason, text) => {
    at(order({ status: 'CANCELLED', cancelReason: reason, paymentStatus: 'CANCELLED', canCancel: false }))
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(document.querySelector('.order-stages')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Huỷ đơn' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Thanh toán' })).toBeNull()
  })

  it('CANCELLED + REFUND_PENDING / REFUNDED → hiện thông tin hoàn tiền (D-70)', async () => {
    at(order({ status: 'CANCELLED', cancelReason: 'customer', paymentMethod: 'payos', paymentStatus: 'REFUND_PENDING', canCancel: false }))
    expect(await screen.findByText(/Bạn đã huỷ đơn này\. Tiền đã thanh toán sẽ được hoàn lại/)).toBeInTheDocument()
    expect(screen.getByText(/Chờ hoàn tiền/)).toBeInTheDocument()
  })

  it('REFUNDED → "Đã hoàn <số tiền>"', async () => {
    at(order({ status: 'CANCELLED', cancelReason: 'admin', paymentMethod: 'payos', paymentStatus: 'REFUNDED', refundedAmount: 500000, canCancel: false }))
    await screen.findByText(/Đơn đã được MỘC huỷ/)
    expect(document.querySelector('.order .notice').textContent).toContain(`Đã hoàn ${formatVnd(500000)}.`)
  })

  it('SHIPPED có mã vận đơn, đủ 4 công đoạn, không còn huỷ được', async () => {
    at(order({ status: 'SHIPPED', trackingCode: 'GHN-123', canCancel: false }))
    expect(await screen.findByText('GHN-123')).toBeInTheDocument()
    expect(screen.getByText(/Mã vận đơn/)).toBeInTheDocument()
    expect(document.querySelectorAll('.order-stages li')).toHaveLength(4)
    expect(document.querySelectorAll('.order-stages li.is-done')).toHaveLength(4)
    expect(screen.queryByRole('button', { name: 'Huỷ đơn' })).toBeNull()
  })

  it.each([1, 2, 3, 4])('IN_PRODUCTION công đoạn %i → %i bước xong, bước kế tiếp được đánh dấu', async (stage) => {
    at(order({ status: 'IN_PRODUCTION', productionStage: stage }))
    await screen.findByRole('heading', { name: 'Đơn #100001' })
    expect(document.querySelectorAll('.order-stages li.is-done')).toHaveLength(stage)
    expect(document.querySelectorAll('.order-stages li.is-next')).toHaveLength(stage < 4 ? 1 : 0)
  })

  it('CONFIRMED: hiện 4 công đoạn, chưa bước nào xong', async () => {
    at(order())
    await screen.findByRole('heading', { name: 'Đơn #100001' })
    expect(document.querySelectorAll('.order-stages li')).toHaveLength(4)
    expect(document.querySelectorAll('.order-stages li.is-done')).toHaveLength(0)
  })

  it('đơn có lời chúc → hiện ngôn ngữ trang QR; giảm giá hiện kèm mã', async () => {
    at(order({ orderType: 'gift', hasMessage: true, qrLang: 'en', discount: 89000, couponCode: 'GIAM10' }))
    expect(await screen.findByText('Đơn có lời chúc — trang lời chúc hiển thị bằng English.')).toBeInTheDocument()
    expect(screen.getByText('Giảm giá (GIAM10)')).toBeInTheDocument()
  })

  it('payment=cancel khi đơn còn chờ → thông báo đã thoát trang thanh toán; không hỏi lại định kỳ', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const f = at(
      order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: '2026-10-01T03:15:00.000Z', canPay: true }),
      '/account/orders/o1?payment=cancel',
    )
    expect(await screen.findByText(/Bạn đã thoát trang thanh toán/)).toBeInTheDocument()
    await vi.advanceTimersByTimeAsync(10000)
    expect(getCalls(f, '/orders/o1')).toHaveLength(1)
  })

  it('payment=return: dừng hỏi lại ngay sau khi đã xác nhận', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    let n = 0
    const f = at(null, '/account/orders/o1?payment=return', {
      'GET /orders/o1': () => {
        n += 1
        return {
          body: {
            order:
              n < 3
                ? order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: '2026-10-01T03:15:00.000Z', canPay: true })
                : order({ paymentMethod: 'payos', paymentStatus: 'PAID' }),
          },
        }
      },
    })
    await screen.findByText('Đang chờ xác nhận thanh toán…')
    for (let i = 0; i < 3; i += 1) await vi.advanceTimersByTimeAsync(3000)
    expect(await screen.findByText('Thanh toán thành công. Cảm ơn bạn!')).toBeInTheDocument()
    const calls = getCalls(f, '/orders/o1').length
    expect(calls).toBe(3)
    await vi.advanceTimersByTimeAsync(30000)
    expect(getCalls(f, '/orders/o1')).toHaveLength(calls)
  })

  it('payment=return: webhook không bao giờ tới → hỏi lại tối đa 40 lần rồi dừng', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const f = at(
      order({ status: 'PENDING_PAYMENT', paymentMethod: 'payos', paymentStatus: 'PENDING', paymentExpiresAt: '2026-10-01T03:15:00.000Z', canPay: true }),
      '/account/orders/o1?payment=return',
    )
    await screen.findByText('Đang chờ xác nhận thanh toán…')
    for (let i = 0; i < 45; i += 1) await vi.advanceTimersByTimeAsync(3000)
    expect(getCalls(f, '/orders/o1')).toHaveLength(41)
    await vi.advanceTimersByTimeAsync(60000)
    expect(getCalls(f, '/orders/o1')).toHaveLength(41)
  })

  it('huỷ đơn: confirm=false → không gọi API', async () => {
    vi.stubGlobal('confirm', () => false)
    const f = at(order())
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ đơn' }))
    expect(f.mock.calls.some(([u]) => String(u).includes('/cancel'))).toBe(false)
    expect(screen.getByRole('button', { name: 'Huỷ đơn' })).toBeEnabled()
  })

  it('huỷ đơn lỗi ORDER_NOT_CANCELLABLE → báo lỗi, nạp lại đơn (đã gửi đi)', async () => {
    vi.stubGlobal('confirm', () => true)
    let n = 0
    at(null, '/account/orders/o1', {
      'GET /orders/o1': () => {
        n += 1
        return { body: { order: n === 1 ? order() : order({ status: 'SHIPPED', trackingCode: 'GHN-9', canCancel: false }) } }
      },
      'POST /orders/o1/cancel': () => ({ status: 409, body: { error: { code: 'ORDER_NOT_CANCELLABLE' } } }),
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Huỷ đơn' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Đơn đã gửi đi nên không huỷ được nữa.')
    expect(await screen.findByText('GHN-9')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Huỷ đơn' })).toBeNull()
  })

  it('lỗi tải đơn (500) → lỗi chung (không phải "không tìm thấy"), noindex, link về tài khoản', async () => {
    mockApi(handlers({ 'GET /orders/o1': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }).h)
    renderAt('/account/orders/o1')
    expect(await screen.findByRole('alert')).toHaveTextContent('Có lỗi xảy ra. Vui lòng thử lại sau.')
    expect(screen.getByRole('link', { name: 'Về trang tài khoản' })).toHaveAttribute('href', '/account')
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('id có ký tự đặc biệt được mã hoá khi gọi API', async () => {
    const f = mockApi(handlers({ 'GET /orders/a b': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) }).h)
    renderAt('/account/orders/a%20b%3F')
    await screen.findByText('Không tìm thấy.')
    expect(f.mock.calls.some(([u]) => String(u).startsWith('/api/orders/a%20b%3F?'))).toBe(true)
  })
})

describe('Trang tài khoản — danh sách đơn', () => {
  it('chưa có đơn → "Bạn chưa có đơn hàng nào."', async () => {
    mockApi(handlers({ 'GET /orders': () => ({ body: { items: [] } }) }).h)
    renderAt('/account')
    expect(await screen.findByText('Bạn chưa có đơn hàng nào.')).toBeInTheDocument()
  })

  it('lỗi tải đơn → thông báo, không chiếm role=alert của trang', async () => {
    mockApi(handlers({ 'GET /orders': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) }).h)
    renderAt('/account')
    const msg = await screen.findByText('Có lỗi xảy ra. Vui lòng thử lại sau.')
    expect(msg).not.toHaveAttribute('role', 'alert')
  })
})
