// @vitest-environment jsdom
// Trang thanh toán (FR-CHK-001…008, §12) — luồng khách thật sự bấm, và giao diện theo design-rules.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'khach@lamvi.test' } }
const profile = { id: 'u1', email: 'khach@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'A' }

const quote = (over = {}) => ({
  items: [{ slug: 'den-nguyet', name: 'Đèn Nguyệt', image: null, unitPrice: 890_000, quantity: 2, lineTotal: 1_780_000 }],
  subtotal: 1_780_000,
  discount: 0,
  shippingFee: 0,
  freeShipping: true,
  total: 1_780_000,
  vatAmount: 161_818,
  vatRate: 0.1,
  currency: 'VND',
  couponCode: null,
  couponError: null,
  hasUnavailable: false,
  freeShippingFrom: 1_000_000,
  ...over,
})

const emptyCart = { items: [], subtotal: 0, currency: 'VND', itemCount: 0, hasUnavailable: false, maxQuantity: 10 }

function api({ quoteBody = quote(), order: orderHandler, extra = {} } = {}) {
  return mockApi({
    'GET /me': () => ({ body: { profile } }),
    'GET /cart': () => ({ body: emptyCart }),
    'GET /products': () => ({ body: { items: [] } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'POST /checkout/quote': () => (typeof quoteBody === 'function' ? quoteBody() : { body: quoteBody }),
    'GET /geo/provinces': () => ({ body: { items: [{ code: '1', name: 'Thành phố Hà Nội' }, { code: '79', name: 'Thành phố Hồ Chí Minh' }] } }),
    'GET /geo/provinces/1/wards': () => ({ body: { items: [{ code: '4', name: 'Phường Ba Đình' }, { code: '8', name: 'Phường Ngọc Hà' }] } }),
    'GET /geo/provinces/79/wards': () => ({ body: { items: [{ code: '26734', name: 'Phường Sài Gòn' }] } }),
    'POST /orders': orderHandler ?? (() => ({ status: 201, body: { order: { code: 'LV2610-ACDEFGH' }, payment: null } })),
    ...extra,
  })
}

const fill = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Bảng giá và các bước (FR-CHK-002…008)', () => {
  it('hiện ba bước có đánh số, tóm tắt đơn và dòng tổng', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })

    // Ba bước checkout, mỗi bước là một tấm giấy có số thứ tự
    const steps = [...document.querySelectorAll('.checkout fieldset legend')].map((l) => l.textContent)
    expect(steps).toEqual(['1Đơn này là', '2Người nhận hàng', '3Thanh toán'])

    const sum = document.querySelector('.order-summary')
    expect(within(sum).getByText('Đèn Nguyệt', { exact: false })).toBeInTheDocument()
    expect(sum.textContent).toContain('1.780.000')
    // D-70: miễn phí ship khi tạm tính ≥ 1.000.000đ
    expect(within(sum).getByText('Miễn phí')).toBeInTheDocument()
    // D-68: tách dòng VAT cho minh bạch
    expect(sum.querySelector('.sum-note').textContent).toContain('161.818')
  })

  it('giỏ rỗng → mời về giỏ hàng, không hiện form', async () => {
    api({ quoteBody: quote({ items: [], subtotal: 0, total: 0 }) })
    renderAt('/checkout')
    expect(await screen.findByText('Giỏ hàng đang trống.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đặt hàng' })).toBeNull()
  })

  it('FR-CHK-001: chưa đăng nhập → chuyển sang đăng nhập kèm next', async () => {
    localStorage.clear()
    api()
    renderAt('/checkout')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })
})

describe('Loại đơn và lời chúc (FR-CHK-002/003/005)', () => {
  it('đơn tặng: bỏ ô "Thêm lời chúc", hiện chọn ngôn ngữ trang QR', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    expect(screen.getByLabelText('Thêm lời chúc gắn mã QR')).toBeInTheDocument()
    expect(screen.queryByLabelText('Ngôn ngữ trang lời chúc')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Mua tặng' }))
    expect(screen.queryByLabelText('Thêm lời chúc gắn mã QR')).toBeNull()
    expect(screen.getByLabelText('Ngôn ngữ trang lời chúc')).toBeInTheDocument()
  })

  it('đơn tự mua tích "Thêm lời chúc" → cũng phải chọn ngôn ngữ trang QR', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    fireEvent.click(screen.getByLabelText('Thêm lời chúc gắn mã QR'))
    expect(screen.getByLabelText('Ngôn ngữ trang lời chúc')).toBeInTheDocument()
  })
})

describe('BR-PAY-004: giao cho người khác không dùng COD', () => {
  it('chọn "Giao cho người khác" → COD bị khoá và tự chuyển sang payOS', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    const cod = document.querySelector('input[value="cod"]')
    const payos = document.querySelector('input[value="payos"]')
    expect(cod.checked).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Giao cho người khác' }))
    expect(cod.disabled).toBe(true)
    expect(payos.checked).toBe(true)
    expect(screen.getByText('Đơn giao cho người khác chưa hỗ trợ thanh toán khi nhận hàng.')).toBeInTheDocument()
  })
})

describe('Mã giảm giá (FR-CHK-006)', () => {
  it('áp mã hợp lệ → hiện mã đã áp và số tiền giảm', async () => {
    let applied = false
    api({
      quoteBody: () => ({
        body: applied ? quote({ discount: 178_000, total: 1_602_000, couponCode: 'TET2026' }) : quote(),
      }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    fill('Mã giảm giá', 'tet2026')
    applied = true
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    expect(await screen.findByText('Đã áp dụng mã TET2026.')).toBeInTheDocument()
    expect(document.querySelector('.order-summary').textContent).toContain('178.000')
  })

  it('mã sai → nêu lý do ngay dưới ô nhập, vẫn hiện bảng giá', async () => {
    api({ quoteBody: quote({ couponError: 'COUPON_EXPIRED' }) })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await waitFor(() =>
      expect(screen.getByLabelText('Mã giảm giá')).toHaveAccessibleDescription('Mã giảm giá đã hết hạn.'),
    )
    expect(document.querySelector('.order-summary').textContent).toContain('1.780.000')
  })
})

describe('Đặt hàng', () => {
  const address = async () => {
    fill('Họ tên người nhận', 'Nguyễn Văn A')
    fill('Số điện thoại', '0912345678')
    fill('Địa chỉ (số nhà, đường)', '12 Hàng Bông')
    await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
    fill('Tỉnh / thành phố', '1')
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Ba Đình' })
    fireEvent.click(screen.getByRole('option', { name: 'Phường Ba Đình' }))
  }

  it('gửi đúng dữ liệu kèm tổng khách đã thấy (D-41) rồi sang trang cảm ơn', async () => {
    const posts = []
    api({
      order: (url, init) => {
        posts.push(JSON.parse(init.body))
        return { status: 201, body: { order: { code: 'LV2610-ACDEFGH' }, payment: null } }
      },
      extra: { 'GET /orders/LV2610-ACDEFGH': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) },
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await address()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(posts).toHaveLength(1))
    expect(posts[0]).toMatchObject({
      orderKind: 'self',
      hasMessage: false,
      recipientIsSelf: true,
      recipientName: 'Nguyễn Văn A',
      provinceCode: '1',
      wardCode: '4',
      paymentMethod: 'cod',
      expectedTotal: 1_780_000,
    })
  })

  it('feedback 08/10, 7.2: soạn lời chúc chữ trong checkout → lưu ngay sau khi tạo đơn; đơn lỗi lưu thì vẫn sang trang cảm ơn', async () => {
    const puts = []
    api({
      order: () => ({ status: 201, body: { order: { code: 'LV2610-ACDEFGH' }, payment: null } }),
      extra: {
        'PUT /orders/LV2610-ACDEFGH/message': (url, init) => (puts.push(JSON.parse(init.body)), { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
        'GET /orders/LV2610-ACDEFGH': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }),
      },
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await address()
    fireEvent.click(screen.getByRole('radio', { name: /Thanh toán khi nhận hàng/ }))
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.change(await screen.findByLabelText('Lời chúc (chữ)'), { target: { value: '  Chúc mẹ luôn khỏe  ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0]).toEqual({ text: 'Chúc mẹ luôn khỏe', textLang: 'vi' })
  })

  it('lỗi theo trường từ server hiện ngay dưới ô tương ứng', async () => {
    api({
      order: () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', fields: { recipientPhone: 'INVALID_PHONE' } } },
      }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await address()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() =>
      expect(screen.getByLabelText('Số điện thoại')).toHaveAccessibleDescription(
        'Số điện thoại Việt Nam không hợp lệ.',
      ),
    )
  })

  it('§12: giá đổi giữa chừng → báo xác nhận lại và nạp bảng giá mới', async () => {
    let n = 0
    api({
      quoteBody: () => {
        n += 1
        return { body: n === 1 ? quote() : quote({ subtotal: 2_000_000, total: 2_000_000 }) }
      },
      order: () => ({
        status: 409,
        body: { error: { code: 'PRICE_CHANGED', message: 'x', details: { quote: { total: 2_000_000 } } } },
      }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await address()
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    expect(await screen.findByText(/Giá vừa thay đổi/)).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.order-summary').textContent).toContain('2.000.000'))
  })

  it('payOS: chuyển sang trang thanh toán của cổng', async () => {
    const assign = vi.fn()
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, assign, origin: 'http://localhost' })
    api({
      order: () => ({
        status: 201,
        body: { order: { code: 'LV2610-ACDEFGH' }, payment: { checkoutUrl: 'https://pay.test/1' } },
      }),
    })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    await address()
    fireEvent.click(document.querySelector('input[value="payos"]'))
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://pay.test/1'))
    vi.restoreAllMocks()
  })
})

// design-rules §5 và §11: khung theo hệ có sẵn, không viền dày / bóng đổ cứng
describe('Giao diện đồng bộ với các trang khác', () => {
  it('các bước dùng khung tranh bồi, tóm tắt dùng thiếp thư có góc hoa văn', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    // Khung tranh bồi = .account-card (dùng chung với giỏ hàng, admin, dashboard IT)
    expect(document.querySelectorAll('.checkout fieldset.account-card')).toHaveLength(3)
    expect(document.querySelector('.order-summary')).toBeInTheDocument()
    // Nhãn bước có số trong ấn son + hoa sen (hoạ tiết là trang trí → aria-hidden)
    const seals = document.querySelectorAll('.checkout legend .step-no')
    expect(seals).toHaveLength(3)
    for (const el of seals) expect(el).toHaveAttribute('aria-hidden', 'true')
  })

  it('CSS trang mới không dùng viền dày hay bóng đổ lệch cứng (design-rules §11)', () => {
    const css = readFileSync(join(process.cwd(), 'src/styles/pages.css'), 'utf8')
    const block = css.slice(css.indexOf('Checkout & đơn hàng'))
    expect(block).not.toMatch(/border:\s*[2-9]px/)
    expect(block).not.toMatch(/box-shadow:\s*\d+px\s+\d+px\s+0/)
    // Dùng token màu, không viết mã màu cứng
    expect(block).not.toMatch(/#[0-9a-f]{3,6}\b/i)
  })
})

describe('Địa chỉ: tỉnh/thành → phường/xã (G-46, D-99)', () => {
  it('phường/xã bị khoá tới khi chọn tỉnh; đổi tỉnh thì xoá phường/xã đã chọn và nạp danh sách mới', async () => {
    api()
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toBeDisabled()
    expect(screen.queryByLabelText('Quận / huyện')).toBeNull()
    await screen.findByRole('option', { name: 'Thành phố Hà Nội' })
    fill('Tỉnh / thành phố', '1')
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Ngọc Hà' })
    fireEvent.click(screen.getByRole('option', { name: 'Phường Ngọc Hà' }))
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toHaveValue('Phường Ngọc Hà')
    fill('Tỉnh / thành phố', '79')
    fireEvent.focus(screen.getByRole('combobox', { name: 'Phường / xã' }))
    await screen.findByRole('option', { name: 'Phường Sài Gòn' })
    expect(screen.getByRole('combobox', { name: 'Phường / xã' })).toHaveValue('')
    expect(screen.queryByRole('option', { name: 'Phường Ngọc Hà' })).toBeNull()
  })

  it('danh mục lỗi → gợi ý tải lại trang', async () => {
    api({ extra: { 'GET /geo/provinces': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) } })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    expect(await screen.findByText(/Chưa tải được danh mục địa chỉ/)).toBeInTheDocument()
  })

  it('lỗi theo trường của server (provinceCode, wardCode) hiện dưới ô tương ứng', async () => {
    api({ order: () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { provinceCode: 'REQUIRED', wardCode: 'REQUIRED' } } } }) })
    renderAt('/checkout')
    await screen.findByRole('heading', { name: 'Tóm tắt đơn' })
    fireEvent.click(screen.getByRole('button', { name: 'Đặt hàng' }))
    await waitFor(() => expect(screen.getByLabelText('Tỉnh / thành phố')).toHaveAttribute('aria-invalid', 'true'))
  })
})


describe('Checkout quote and submit concurrency', () => {
  it('blocks order POST during coupon refresh and failed quote, then enables retry without losing recipient input', async () => {
    let count = 0
    let release
    const fetch = api({ extra: {
      'POST /checkout/quote': () => {
        count += 1
        if (count === 2) return new Promise((resolve) => { release = resolve })
        return { body: quote() }
      },
    } })
    renderAt('/checkout')
    const submit = await screen.findByRole('button', { name: 'Đặt hàng' })
    fill('Họ tên người nhận', 'Nguyễn An')
    fill('Mã giảm giá', 'TEST')
    fireEvent.click(screen.getByRole('button', { name: 'Áp dụng' }))
    await waitFor(() => expect(release).toBeTypeOf('function'))
    expect(submit).toBeDisabled()
    fireEvent.submit(document.querySelector('.checkout-form'))
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/orders'))).toBe(false)
    await act(async () => release({ status: 503, body: { error: { code: 'INTERNAL_ERROR' } } }))
    expect(submit).toBeDisabled()
    fireEvent.submit(document.querySelector('.checkout-form'))
    expect(fetch.mock.calls.some(([url]) => String(url).startsWith('/api/orders'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await waitFor(() => expect(submit).toBeEnabled())
    expect(screen.getByLabelText('Họ tên người nhận')).toHaveValue('Nguyễn An')
  })

  it('guards duplicate submit events before React renders pending state', async () => {
    let release
    const fetch = api({ order: () => new Promise((resolve) => { release = resolve }) })
    renderAt('/checkout')
    await screen.findByRole('button', { name: 'Đặt hàng' })
    const form = document.querySelector('.checkout-form')
    fireEvent.submit(form)
    fireEvent.submit(form)
    await waitFor(() => expect(release).toBeTypeOf('function'))
    expect(fetch.mock.calls.filter(([url, init]) => String(url).startsWith('/api/orders') && init.method === 'POST')).toHaveLength(1)
    await act(async () => release({ status: 400, body: { error: { code: 'VALIDATION_ERROR' } } }))
    expect(screen.getByRole('button', { name: 'Đặt hàng' })).toBeEnabled()
  })
})
