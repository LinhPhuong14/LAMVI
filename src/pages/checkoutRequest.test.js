import { webcrypto } from 'node:crypto'
import { beforeEach, expect, it, vi } from 'vitest'
import { checkoutRequestKey, clearCheckoutRequest } from './checkoutRequest.js'
const data = new Map()
beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto)
  vi.stubGlobal('sessionStorage', { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value), removeItem: (key) => data.delete(key) })
  clearCheckoutRequest('user-1')
  data.clear()
})
it('retains the same key for an uncertain retry and rotates for changed quantity or address', async () => {
  const body = { recipientName: 'Private Person', addressLine: 'Private Address', expectedTotal: 1000 }
  const items = [{ slug: 'lamp', quantity: 1, unitPrice: 1000 }]
  const first = await checkoutRequestKey('user-1', body, items)
  expect(await checkoutRequestKey('user-1', body, items)).toBe(first)
  const stored = [...data.values()][0]
  expect(stored).not.toContain('Private')
  expect(Object.keys(JSON.parse(stored))).toEqual(['key', 'fingerprint'])
  expect(await checkoutRequestKey('user-1', body, [{ ...items[0], quantity: 2 }])).not.toBe(first)
  expect(await checkoutRequestKey('user-1', { ...body, addressLine: 'Changed' }, items)).not.toBe(first)
})
it('clears the intent after success and scopes keys by user', async () => {
  const first = await checkoutRequestKey('user-1', {}, [])
  expect(await checkoutRequestKey('user-2', {}, [])).not.toBe(first)
  clearCheckoutRequest('user-1')
  expect(await checkoutRequestKey('user-1', {}, [])).not.toBe(first)
})
