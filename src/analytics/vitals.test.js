import { expect, it, vi } from 'vitest'
import { safeVital, startVitals } from './vitals.js'

it('excludes token paths, element attribution, IDs and personal data from diagnostics', () => {
  const callback = vi.fn(), handlers = []
  const observe = (fn) => handlers.push(fn)
  const target = { location: { pathname: '/qr/private-greeting-token' } }
  startVitals({ target, onMetric: callback, observers: { onCLS: observe, onINP: observe, onLCP: observe } })
  handlers[0]({ name: 'CLS', value: .02, rating: 'good', id: 'private-id', attribution: { text: 'Private name' }, entries: [{ url: 'private-url' }] })
  expect(callback).toHaveBeenCalledWith({ name: 'CLS', value: .02, rating: 'good', pageKind: 'private' })
  expect(JSON.stringify(target.__LAMVI_WEB_VITALS__)).not.toContain('private-greeting-token')
  expect(Object.keys(target.__LAMVI_WEB_VITALS__)).toEqual(['CLS'])
})

it('rejects malformed diagnostics and shields the app from collector failures', () => {
  expect(safeVital({ name: 'LCP', value: Infinity, rating: 'good' }, 'home')).toBeNull()
  expect(safeVital({ name: 'EMAIL', value: 1, rating: 'good' }, 'home')).toBeNull()
  const observe = (fn) => fn({ name: 'INP', value: 180, rating: 'good' })
  const target = { location: { pathname: '/shop' } }
  expect(() => startVitals({ target, onMetric: () => { throw Error('collector unavailable') }, observers: { onCLS: observe, onINP: observe, onLCP: observe } })).not.toThrow()
  expect(Object.keys(target.__LAMVI_WEB_VITALS__)).toEqual(['INP'])
})
