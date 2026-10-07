// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import CartProvider from './CartProvider.jsx'
import { useCart } from './context.js'

const mocks = vi.hoisted(() => ({ api: vi.fn(), authedApi: vi.fn(), user: { id: 'u1' } }))
vi.mock('../auth/context.js', () => ({ useAuth: () => ({ user: mocks.user, authedApi: mocks.authedApi }) }))
vi.mock('../api/client.js', () => ({ api: mocks.api }))
vi.mock('../i18n/index.js', () => ({ useI18n: () => ({ lang: 'vi' }) }))
function Probe() {
  const { cart, pendingLines, setQuantity, remove, error } = useCart()
  return <><output>{cart?.subtotal}</output><span data-testid="pending">{Object.keys(pendingLines).join(',')}</span><span data-testid="error">{error}</span>
    <button onClick={() => setQuantity('a', 2)}>quantity</button><button onClick={() => remove('b')}>remove</button></>
}
beforeEach(() => {
  localStorage.clear()
  mocks.user = { id: 'u1' }
  mocks.authedApi.mockReset().mockResolvedValue({ items: [], subtotal: 0 })
})
describe('Cart mutations', () => {
  it('queues cross-line mutations, retains line pending until confirmation and preserves final server response', async () => {
    let release
    mocks.authedApi.mockImplementation((url) => url.includes('/items/a') ? new Promise((resolve) => { release = resolve }) : Promise.resolve({ items: [], subtotal: url.includes('/items/b') ? 30 : 0 }))
    render(<CartProvider><Probe /></CartProvider>)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0'))
    fireEvent.click(screen.getByText('quantity'))
    await waitFor(() => expect(release).toBeTypeOf('function'))
    fireEvent.click(screen.getByText('remove'))
    expect(screen.getByTestId('pending')).toHaveTextContent('a,b')
    expect(mocks.authedApi.mock.calls.some(([url]) => url.includes('/items/b'))).toBe(false)
    await act(async () => { release({ items: [], subtotal: 20 }) })
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('30'))
    expect(screen.getByTestId('pending')).toBeEmptyDOMElement()
  })
  it('ignores stale failures after a session changes and skips queued writes for the old user', async () => {
    let reject
    mocks.authedApi.mockImplementation((url) => url.includes('/items/a') ? new Promise((_, fail) => { reject = fail }) : Promise.resolve({ items: [], subtotal: 0 }))
    const view = render(<CartProvider><Probe /></CartProvider>)
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('0'))
    fireEvent.click(screen.getByText('quantity'))
    await waitFor(() => expect(reject).toBeTypeOf('function'))
    fireEvent.click(screen.getByText('remove'))
    mocks.user = { id: 'u2' }
    view.rerender(<CartProvider><Probe /></CartProvider>)
    await act(async () => { reject({ code: 'NETWORK_ERROR' }) })
    expect(screen.getByTestId('error')).toBeEmptyDOMElement()
    expect(mocks.authedApi.mock.calls.some(([url]) => url.includes('/items/b'))).toBe(false)
  })
})
