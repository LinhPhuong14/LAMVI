// @vitest-environment jsdom
// Dashboard khách v3: "Cần làm", lọc đơn, tab lời chúc, thẻ bảo mật (đổi mật khẩu)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'
import viMsg from '../i18n/messages/vi.js'

const A = viMsg.account
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'Nguyễn An', phone: null, preferredLocale: 'vi', role: 'customer' }
const emptyCart = { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const fullCart = { items: [{ slug: 'den-nguyet', quantity: 3 }], subtotal: 2670000, itemCount: 3, hasUnavailable: false, maxQuantity: 10 }

let seq = 0
const order = (status, over = {}) => {
  seq += 1
  const code = `LV2610-V3${String(seq).padStart(5, '0')}`
  return {
    code,
    status,
    total: 900_000,
    createdAt: '2026-10-01T03:00:00.000Z',
    hasMessage: false,
    recipientName: `Người nhận ${seq}`,
    addressLine: '12 Hàng Gai',
    ward: 'Hàng Gai',
    province: 'Hà Nội',
    items: [{ slug: 'den-nguyet', name: `Đèn số ${seq}`, quantity: 1, unitPrice: 890_000, lineTotal: 890_000 }],
    ...over,
  }
}

function api({ orders = [], cart = emptyCart, extra = {} } = {}) {
  return mockApi({
    'GET /products': () => ({ body: productsVi }),
    'GET /faq': () => ({ body: faqVi }),
    'GET /me': () => ({ body: { profile } }),
    'GET /may/history': () => ({ body: { items: [] } }),
    'GET /cart': () => ({ body: cart }),
    'GET /orders': () => ({ body: { items: orders } }),
    'GET /gallery': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }),
    'POST /auth/logout': () => ({ status: 204 }),
    ...extra,
  })
}
const login = () => localStorage.setItem('moc.session', JSON.stringify(session))
const panel = () => screen.getByRole('tabpanel')
const tab = (name) => within(screen.getByRole('tablist')).getByRole('tab', { name: new RegExp(name) })
const todoItems = async () => {
  await waitFor(() => expect(panel().querySelector('.dash-todo-list, .dash-todo-empty')).not.toBeNull())
  return [...panel().querySelectorAll('.dash-todo-list li')]
}

afterEach(() => {
  vi.useRealTimers()
})

describe('Tổng quan — khối "Cần làm"', () => {
  it('đơn chờ thanh toán → thẻ "Thanh toán" tới trang đơn', async () => {
    login()
    const o = order('pending_payment')
    api({ orders: [o] })
    renderAt('/account')
    const items = await todoItems()
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent(A.todo.pay.replace('{code}', o.code))
    const link = within(items[0]).getByRole('link', { name: A.todo.payBtn })
    expect(link).toHaveAttribute('href', `/don-hang/${o.code}`)
  })

  it('đơn có lời chúc còn sửa được → "Soạn lời chúc"; đã giao thì không', async () => {
    login()
    const o = order('confirmed', { hasMessage: true })
    const d = order('delivered', { hasMessage: true })
    api({ orders: [o, d] })
    renderAt('/account')
    const items = await todoItems()
    const compose = items.filter((li) => within(li).queryByRole('link', { name: A.todo.composeBtn }))
    expect(compose).toHaveLength(1)
    expect(compose[0]).toHaveTextContent(A.todo.compose.replace('{code}', o.code))
    expect(panel().textContent).not.toContain(A.todo.compose.replace('{code}', d.code))
  })

  it('đơn đang làm/giao → "Xem đơn" kèm trạng thái', async () => {
    login()
    const o = order('shipped')
    api({ orders: [o] })
    renderAt('/account')
    const items = await todoItems()
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent(`Đơn ${o.code}: ${viMsg.orders.statuses.shipped}`)
    expect(within(items[0]).getByRole('link', { name: A.todo.trackBtn })).toHaveAttribute('href', `/don-hang/${o.code}`)
  })

  it('giỏ hàng có món → thẻ "Giỏ hàng có n món" tới /cart', async () => {
    login()
    api({ cart: fullCart })
    renderAt('/account')
    const items = await waitFor(async () => {
      const l = await todoItems()
      expect(l).toHaveLength(1)
      return l
    })
    expect(items[0]).toHaveTextContent(A.todo.cart.replace('{n}', '3'))
    expect(within(items[0]).getByRole('link')).toHaveAttribute('href', '/cart')
  })

  it('mỗi thẻ có đúng một nút/liên kết; tối đa 3 thẻ dù có nhiều việc hơn', async () => {
    login()
    api({
      cart: fullCart,
      orders: [order('pending_payment'), order('confirmed', { hasMessage: true }), order('packed', { hasMessage: true }), order('in_production'), order('pending_payment')],
    })
    renderAt('/account')
    await waitFor(async () => expect(await todoItems()).toHaveLength(3))
    const items = await todoItems()
    expect(items).toHaveLength(3)
    for (const li of items) expect(li.querySelectorAll('a, button')).toHaveLength(1)
    expect(within(items[0]).getByRole('link', { name: A.todo.payBtn })).toBeInTheDocument()
    expect(within(items[1]).getByRole('link', { name: A.todo.composeBtn })).toBeInTheDocument()
    expect(within(items[2]).getByRole('link', { name: A.todo.composeBtn })).toBeInTheDocument()
    expect(panel().textContent).not.toContain(A.todo.cart.replace('{n}', '3'))
  })

  it('không có việc (đơn đã giao, giỏ trống) → trạng thái rỗng + nút "Tiếp tục xem đèn"', async () => {
    login()
    api({ orders: [order('delivered'), order('cancelled')] })
    renderAt('/account')
    await waitFor(() => expect(panel().querySelector('.dash-todo-empty')).not.toBeNull())
    const empty = panel().querySelector('.dash-todo-empty')
    expect(empty).toHaveTextContent(A.todo.none)
    expect(within(empty).getByRole('link', { name: A.todo.browse })).toHaveAttribute('href', '/shop')
    expect(panel().querySelector('.dash-todo-list')).toBeNull()
  })

  it('Tổng quan có "Đơn gần nhất" khi có đơn đang làm; không có .dash-stats', async () => {
    login()
    const o = order('in_production')
    api({ orders: [o] })
    renderAt('/account')
    await screen.findByRole('heading', { name: A.latestOrder })
    expect(panel().querySelector('.dash-latest')).toHaveTextContent(o.code)
    expect(panel().querySelector('.dash-stats')).toBeNull()
  })
})

describe('Tab Đơn hàng — chip lọc và chi tiết', () => {
  const chips = () => [...panel().querySelectorAll('.chip')]
  const chip = (g) => chips().find((c) => c.textContent.startsWith(A.ordersView[g]))
  const rows = () => [...panel().querySelectorAll('.order-row')]

  const data = () => {
    const a1 = order('pending_payment')
    const a2 = order('in_production', { hasMessage: true })
    const s1 = order('shipped')
    const d1 = order('delivered')
    const d2 = order('delivered')
    const c1 = order('cancelled')
    return { a1, a2, s1, d1, d2, c1, all: [a1, a2, s1, d1, d2, c1] }
  }

  it('5 chip theo thứ tự, mỗi chip có số lượng; mặc định "Đang xử lý"', async () => {
    login()
    const d = data()
    api({ orders: d.all })
    renderAt('/account?tab=orders')
    await waitFor(() => expect(chips()).toHaveLength(5))
    expect(chips().map((c) => c.firstChild.textContent)).toEqual(['active', 'shipping', 'done', 'cancelled', 'all'].map((g) => A.ordersView[g]))
    expect(chips().map((c) => c.querySelector('b').textContent)).toEqual(['2', '1', '2', '1', '6'])
    expect(chip('active')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('all')).toHaveAttribute('aria-pressed', 'false')
    expect(rows()).toHaveLength(2)
  })

  it('bấm chip lọc danh sách; nhóm rỗng hiện thông báo', async () => {
    login()
    const d = data()
    api({ orders: [d.a1, d.s1] })
    renderAt('/account?tab=orders')
    await waitFor(() => expect(chips()).toHaveLength(5))
    fireEvent.click(chip('shipping'))
    expect(chip('shipping')).toHaveAttribute('aria-pressed', 'true')
    expect(chip('active')).toHaveAttribute('aria-pressed', 'false')
    expect(rows().map((r) => r.querySelector('strong').textContent)).toEqual([d.s1.code])
    fireEvent.click(chip('done'))
    expect(rows()).toHaveLength(0)
    expect(panel()).toHaveTextContent(A.ordersView.none)
    expect(panel().querySelector('article.dash-order-detail')).toBeNull()
    fireEvent.click(chip('all'))
    expect(rows()).toHaveLength(2)
  })

  it('chọn đơn → chi tiết bên phải đổi theo (sản phẩm, tổng, người nhận, liên kết)', async () => {
    login()
    const d = data()
    api({ orders: d.all })
    renderAt('/account?tab=orders')
    await waitFor(() => expect(rows()).toHaveLength(2))
    // đơn đầu tiên được chọn sẵn
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'true')
    expect(rows()[1]).toHaveAttribute('aria-pressed', 'false')
    let detail = panel().querySelector('article.dash-order-detail')
    expect(detail).toHaveTextContent(d.a1.code)
    expect(detail).toHaveTextContent(d.a1.recipientName)
    expect(within(detail).getByRole('link', { name: A.ordersView.open })).toHaveAttribute('href', `/don-hang/${d.a1.code}`)
    expect(within(detail).queryByRole('link', { name: A.todo.composeBtn })).toBeNull() // a1 không có lời chúc

    fireEvent.click(rows()[1])
    expect(rows()[1]).toHaveAttribute('aria-pressed', 'true')
    expect(rows()[0]).toHaveAttribute('aria-pressed', 'false')
    detail = panel().querySelector('article.dash-order-detail')
    expect(detail).toHaveTextContent(d.a2.code)
    expect(detail).toHaveTextContent(d.a2.items[0].name)
    expect(detail).toHaveTextContent('900.000')
    expect(detail).toHaveTextContent(d.a2.recipientName)
    expect(within(detail).getByRole('link', { name: A.todo.composeBtn })).toHaveAttribute('href', `/don-hang/${d.a2.code}`)
    expect(within(detail).getByRole('link', { name: A.ordersView.open })).toHaveAttribute('href', `/don-hang/${d.a2.code}`)
  })

  it('đơn đã giao có lời chúc: không có nút "Soạn lời chúc" (không còn sửa được)', async () => {
    login()
    const o = order('delivered', { hasMessage: true })
    api({ orders: [o] })
    renderAt('/account?tab=orders')
    await waitFor(() => expect(chips()).toHaveLength(5))
    fireEvent.click(chip('done'))
    const detail = panel().querySelector('article.dash-order-detail')
    expect(detail).toHaveTextContent(o.code)
    expect(within(detail).queryByRole('link', { name: A.todo.composeBtn })).toBeNull()
  })
})

describe('Tab "Lời chúc & video"', () => {
  it('nhãn tab và phụ đề lấy từ messages', async () => {
    login()
    api()
    renderAt('/account?tab=gallery')
    await screen.findByRole('tablist')
    expect(tab(A.tabs.gallery)).toHaveAttribute('aria-selected', 'true')
    expect(A.tabs.gallery).toBe('Lời chúc & video')
    expect(document.querySelector('.dash-top-sub')).toHaveTextContent(A.subtitle.gallery)
  })

  it('liệt kê đúng các đơn hasMessage; sửa được → "Soạn hoặc sửa", còn lại → "Xem"', async () => {
    login()
    const e = order('in_production', { hasMessage: true })
    const v = order('delivered', { hasMessage: true })
    const n = order('confirmed', { hasMessage: false })
    api({ orders: [e, v, n] })
    renderAt('/account?tab=gallery')
    const title = await screen.findByRole('heading', { name: A.messages.title })
    const card = title.closest('article')
    await waitFor(() => expect(card.querySelectorAll('.dash-messages li')).toHaveLength(2))
    const lis = [...card.querySelectorAll('.dash-messages li')]
    expect(lis[0]).toHaveTextContent(e.code)
    expect(within(lis[0]).getByRole('link', { name: A.messages.edit })).toHaveAttribute('href', `/don-hang/${e.code}`)
    expect(lis[1]).toHaveTextContent(v.code)
    expect(within(lis[1]).getByRole('link', { name: A.messages.view })).toHaveAttribute('href', `/don-hang/${v.code}`)
    expect(card.textContent).not.toContain(n.code)
  })

  it('không có đơn nào có lời chúc → thông báo rỗng', async () => {
    login()
    api({ orders: [order('confirmed')] })
    renderAt('/account?tab=gallery')
    expect(await screen.findByText(A.messages.none)).toBeInTheDocument()
  })
})

describe('Tab Hồ sơ — SecurityCard', () => {
  const fill = async ({ cur = 'Cu-Mat#Khau1', pw = 'Moi-Mat#Khau2', cf = 'Moi-Mat#Khau2' } = {}) => {
    const card = (await screen.findByRole('heading', { name: A.security.title })).closest('article')
    fireEvent.change(within(card).getByLabelText(A.security.current), { target: { value: cur } })
    fireEvent.change(within(card).getByLabelText(viMsg.auth.newPassword), { target: { value: pw } })
    fireEvent.change(within(card).getByLabelText(viMsg.auth.confirmPassword), { target: { value: cf } })
    return card
  }
  const changeCalls = (f) => f.mock.calls.filter(([u]) => String(u).includes('/auth/change-password'))

  it('có 3 ô mật khẩu cạnh biểu mẫu hồ sơ', async () => {
    login()
    api()
    renderAt('/account?tab=profile')
    const card = (await screen.findByRole('heading', { name: A.security.title })).closest('article')
    expect(card.querySelectorAll('input[type="password"]')).toHaveLength(3)
    expect(await screen.findByDisplayValue('Nguyễn An')).toBeInTheDocument()
  })

  it('gửi đúng body {currentPassword, password, confirmPassword}', async () => {
    login()
    const f = api({ extra: { 'POST /auth/change-password': () => ({ status: 204 }) } })
    renderAt('/account?tab=profile')
    const card = await fill()
    fireEvent.click(within(card).getByRole('button', { name: A.security.save }))
    await waitFor(() => expect(changeCalls(f)).toHaveLength(1))
    const [, init] = changeCalls(f)[0]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toEqual({ currentPassword: 'Cu-Mat#Khau1', password: 'Moi-Mat#Khau2', confirmPassword: 'Moi-Mat#Khau2' })
  })

  it('nhập lại không khớp → báo lỗi ở ô nhập lại và không gửi', async () => {
    login()
    const f = api({ extra: { 'POST /auth/change-password': () => ({ status: 204 }) } })
    renderAt('/account?tab=profile')
    const card = await fill({ cf: 'Khac-Mat#Khau3' })
    expect(within(card).getByText(viMsg.errors.PASSWORD_MISMATCH)).toBeInTheDocument()
    fireEvent.click(within(card).getByRole('button', { name: A.security.save }))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 30))
    })
    expect(changeCalls(f)).toHaveLength(0)
    expect(within(card).queryByRole('status')).toBeNull()
  })

  it('INVALID_CREDENTIALS theo trường hiện ở ô mật khẩu hiện tại; không đăng xuất', async () => {
    login()
    const f = api({
      extra: {
        'POST /auth/change-password': () => ({
          status: 400,
          body: { error: { code: 'VALIDATION_ERROR', fields: { currentPassword: 'INVALID_CREDENTIALS' } } },
        }),
      },
    })
    renderAt('/account?tab=profile')
    const card = await fill()
    fireEvent.click(within(card).getByRole('button', { name: A.security.save }))
    const err = await within(card).findByText(viMsg.errors.INVALID_CREDENTIALS)
    expect(err).toHaveClass('field-error')
    expect(within(card).getByLabelText(A.security.current)).toHaveAttribute('aria-invalid', 'true')
    expect(within(card).queryByRole('status')).toBeNull()
    expect(f.mock.calls.some(([u]) => String(u).includes('/auth/logout'))).toBe(false)
    expect(localStorage.getItem('moc.session')).not.toBeNull()
  })

  it('lỗi chung (không theo trường) hiện alert', async () => {
    login()
    api({ extra: { 'POST /auth/change-password': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) } })
    renderAt('/account?tab=profile')
    const card = await fill()
    fireEvent.click(within(card).getByRole('button', { name: A.security.save }))
    expect(await within(card).findByRole('alert')).toHaveTextContent(viMsg.errors.INTERNAL_ERROR)
  })

  it('thành công → thông báo, sau ~1,8 giây đăng xuất và về /login (fake timers)', async () => {
    login()
    const f = api({ extra: { 'POST /auth/change-password': () => ({ status: 204 }) } })
    renderAt('/account?tab=profile')
    const card = await fill()
    // Dùng timer giả; không dùng findBy/waitFor (chúng cần setTimeout thật) mà tua thời gian bằng tay
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    fireEvent.click(within(card).getByRole('button', { name: A.security.save }))
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100)
    })
    expect(within(card).getByRole('status')).toHaveTextContent(A.security.done)
    expect(within(card).getByRole('button', { name: A.security.save })).toBeDisabled()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1600) // tổng 1700 ms < 1800 ms
    })
    expect(f.mock.calls.some(([u]) => String(u).includes('/auth/logout'))).toBe(false)
    expect(localStorage.getItem('moc.session')).not.toBeNull()

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300) // vượt mốc 1800 ms
    })
    expect(f.mock.calls.some(([u]) => String(u).includes('/auth/logout'))).toBe(true)
    expect(localStorage.getItem('moc.session')).toBeNull()
    vi.useRealTimers()
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })
})
