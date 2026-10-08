// @vitest-environment jsdom
// Kiểm thử độc lập: cờ syncError của CartProvider (gộp giỏ lỗi) không được "dính" sau khi đăng xuất / đổi tài khoản.
import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import CartProvider from './CartProvider.jsx'
import { useCart } from './context.js'

const mocks = vi.hoisted(() => ({ authedApi: vi.fn(), apiFn: vi.fn(), user: { id: 'u1' } }))
vi.mock('../auth/context.js', () => ({ useAuth: () => ({ user: mocks.user, authedApi: mocks.authedApi }) }))
vi.mock('../api/client.js', () => ({ api: (...a) => mocks.apiFn(...a) }))
vi.mock('../i18n/index.js', () => ({ useI18n: () => ({ lang: 'vi' }) }))

function Probe() {
  const { syncError, cart } = useCart()
  return <output data-testid="s">{String(Boolean(syncError))}|{cart ? cart.itemCount : 'null'}</output>
}
const empty = { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }

beforeEach(() => {
  localStorage.clear()
  mocks.authedApi.mockReset()
  mocks.apiFn.mockReset()
  mocks.user = { id: 'u1' }
})

it('gộp lỗi → syncError=true, giữ giỏ local', async () => {
  localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'a', quantity: 1 }]))
  const keyBefore = Object.keys(localStorage)
  mocks.authedApi.mockImplementation((url) => (url.includes('/cart/merge') ? Promise.reject(Object.assign(new Error('x'), { status: 503, code: 'SCHEMA_OUTDATED' })) : Promise.resolve(empty)))
  render(<CartProvider><Probe /></CartProvider>)
  await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('true|0'))
  expect(Object.keys(localStorage)).toEqual(keyBefore)
})

it('sau khi gộp lỗi rồi ĐĂNG XUẤT, cờ syncError không còn (khách vãng lai không thấy cảnh báo của tài khoản cũ)', async () => {
  localStorage.setItem('moc.cart', JSON.stringify([{ slug: 'a', quantity: 1 }]))
  mocks.authedApi.mockImplementation((url) => (url.includes('/cart/merge') ? Promise.reject(Object.assign(new Error('x'), { status: 503 })) : Promise.resolve(empty)))
  mocks.apiFn.mockResolvedValue({ ...empty, items: [{ slug: 'a', quantity: 1 }], itemCount: 1 })
  const { rerender } = render(<CartProvider><Probe /></CartProvider>)
  await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent('true|0'))
  mocks.user = null
  rerender(<CartProvider><Probe /></CartProvider>)
  await waitFor(() => expect(screen.getByTestId('s')).toHaveTextContent(/\|1$/))
  expect(screen.getByTestId('s')).toHaveTextContent('false|1')
})
