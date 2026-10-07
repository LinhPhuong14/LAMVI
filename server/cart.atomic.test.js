import { describe, expect, it } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createCartService } from './cart/service.js'
const product = (number) => ({ id: `p${number}`, slug: `lamp-${number}`, name: { vi: 'Lamp' }, price: 1000, kind: 'single', status: 'published', stock: null })
describe('Atomic customer cart writes', () => {
 it('retains concurrent merge increments instead of replacing a stale quantity', async () => {
  const repo = createMemoryRepo({ products: [product(1)] })
  const service = createCartService({ repo })
  await service.setQuantity('user', 'lamp-1', 1, 'vi')
  await Promise.all([service.merge('user', [{ slug: 'lamp-1', quantity: 2 }], 'vi'), service.merge('user', [{ slug: 'lamp-1', quantity: 3 }], 'vi')])
  expect((await service.get('user', 'vi')).items[0].quantity).toBe(6)
 })
 it('allows only one extra line when concurrent requests start from 49 lines', async () => {
  const repo = createMemoryRepo({ products: Array.from({ length: 51 }, (_, n) => product(n)) })
  const service = createCartService({ repo })
  for (let n = 0; n < 49; n++) await repo.setCartItem('user', `p${n}`, 1)
  const result = await Promise.allSettled([service.setQuantity('user', 'lamp-49', 1, 'vi'), service.setQuantity('user', 'lamp-50', 1, 'vi')])
  expect(result.filter((item) => item.status === 'fulfilled')).toHaveLength(1)
  expect(result.find((item) => item.status === 'rejected').reason.code).toBe('CART_FULL')
  expect(await repo.getCart('user')).toHaveLength(50)
 })
 it('rejects hidden additions and protects the original cart on failed set', async () => {
  const repo = createMemoryRepo({ products: [{ ...product(1), stock: 1 }, { ...product(2), status: 'draft' }] })
  const service = createCartService({ repo })
  await service.setQuantity('user', 'lamp-1', 1, 'vi')
  await expect(service.setQuantity('user', 'lamp-1', 2, 'vi')).rejects.toMatchObject({ code: 'OUT_OF_STOCK', status: 409 })
  await expect(service.setQuantity('user', 'lamp-2', 1, 'vi')).rejects.toMatchObject({ code: 'PRODUCT_UNAVAILABLE', status: 404 })
  expect((await service.get('user', 'vi')).items).toHaveLength(1)
 })
})
