import { describe, expect, it, vi } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createCartService } from './cart/service.js'
import { createOrderService } from './orders/service.js'
const products = Array.from({ length: 1200 }, (_, index) => ({ id: `product-${index}`, slug: `lamp-${index}`, status: 'published', kind: 'single', price: 1000, name: { vi: `Lamp ${index}` }, stock: 10 }))
describe('Cart scoped catalog reads', () => {
 it('renders and quotes a purchased product beyond the first 1000 catalog rows without scanning the catalog', async () => {
  const repo = createMemoryRepo({ products })
  await repo.setCartItem('user', 'product-1199', 2)
  vi.spyOn(repo, 'listProducts').mockRejectedValue(new Error('full catalog reads forbidden in cart'))
  const ids = vi.spyOn(repo, 'getProductsByIds')
  const cart = await createCartService({ repo }).get('user', 'vi')
  expect(cart.items[0]).toMatchObject({ slug: 'lamp-1199', quantity: 2, product: { name: 'Lamp 1199' } })
  const quote = await createOrderService({ repo }).quoteCart('user')
  expect(quote.view.items[0]).toMatchObject({ slug: 'lamp-1199', quantity: 2 })
  expect(quote.view.subtotal).toBe(2000)
  expect(ids.mock.calls).toEqual([[['product-1199']], [['product-1199']]])
 })
 it('mutates and presents the selected cart rows with the same bounded product lookup', async () => {
  const repo = createMemoryRepo({ products })
  vi.spyOn(repo, 'listProducts').mockRejectedValue(new Error('full catalog reads forbidden in cart'))
  const ids = vi.spyOn(repo, 'getProductsByIds')
  const cart = await createCartService({ repo }).setQuantity('user', 'lamp-1199', 1, 'vi')
  expect(cart.items).toHaveLength(1)
  expect(ids).toHaveBeenCalledWith(['product-1199'])
 })
})
