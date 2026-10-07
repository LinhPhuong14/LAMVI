// T-11: privacy QA uses synthetic contact details only, never production data.
import { EventEmitter } from 'node:events'
import { describe, expect, it } from 'vitest'
import { sanitizePath } from '../../src/analytics/ga.js'
import { createMetrics, redactErrorPath, redactSecrets, routeLabel } from './metrics.js'
import { createMemoryRepo } from '../adapters/memory/repo.js'

describe('independent URI and metric error privacy', () => {
  it.each([
    ['/zh/%2571r/synthetic-private-token?email=synthetic@example.invalid', '/zh/qr/:token'],
    ['/en/%72eset-password/synthetic-private-token#t=synthetic-token', '/en/reset-password/:token'],
    ['/api/%71r/synthetic-private-token/%broken', '/api/qr/:token'],
    ['/contact/synthetic%2540example.invalid', '/contact/[email]'],
    ['/contact/%2B44%20(20)%207946%200000', '/contact/[phone]'],
    ['/contact/%E0%A4%A', '/contact/[encoded]'],
  ])('shared sanitizer is deterministic and nonthrowing for %s', (input, expected) => {
    expect(() => sanitizePath(input)).not.toThrow()
    expect(redactErrorPath(input)).toBe(sanitizePath(input))
    expect(sanitizePath(input)).toBe(expected)
  })
  it.each(['/products/den-nguyet', '/api/products/den-sum-vay', '/api/orders/LV2610-ACDEFGH', '/en/orders/LV2610-ACDEFGH', '/lo/LO-2026-10'])('keeps stable nonsecret identifiers %s', (path) => {
    expect(sanitizePath(`${path}?email=synthetic@example.invalid#t=synthetic-token`)).toBe(path)
  })
  it('never stores international contacts or encoded contacts in code/message', async () => {
    const repo = createMemoryRepo(), metrics = createMetrics({ repo })
    metrics.record({ method: 'GET', route: '/api/products/:slug', path: '/api/products/synthetic%40example.invalid', status: 500, ms: 1,
      code: 'provider_error:synthetic%2540example.invalid', message: 'Delivery failed +1 (202) 555 0100 and +442079460000 synthetic%40example.invalid' })
    await metrics.flush({ cleanup: false })
    const [row] = await metrics.recentErrors('1h')
    expect(row.path).toBe('/api/products/[email]')
    for (const contact of ['synthetic', '202', '555', '442079460000', '%40', '%2540']) expect(`${row.code} ${row.message}`).not.toContain(contact)
    expect(row.message).toContain('[phone]')
    expect(row.code).toContain('[email]')
    expect(redactSecrets('Order LV2610-ACDEFGH failed')).toBe('Order LV2610-ACDEFGH failed')
  })
  it('route aggregates use templates rather than decoded user input', () => {
    const req = { originalUrl: '/api/products/synthetic%40example.invalid', baseUrl: '/api', route: { path: '/products/:slug' } }
    expect(routeLabel(req, { get: () => 'application/json' }, () => ({ kind: 'product' }))).toBe('/api/products/:slug')
  })
})

it('redacts contact before truncating raw middleware error path', async () => {
  const repo = createMemoryRepo(), metrics = createMetrics({ repo })
  const req = { method: 'GET', originalUrl: '/api/products/' + 'a/'.repeat(88) + 'synthetic@example.invalid', baseUrl: '/api', route: { path: '/products/:slug' } }
  const res = new EventEmitter()
  res.statusCode = 500; res.locals = {}; res.get = () => 'application/json'; res.writeHead = () => res
  metrics.middleware(req, res, () => {})
  res.writeHead(500); res.emit('finish')
  await metrics.flush({ cleanup: false })
  const [error] = await metrics.recentErrors('1h')
  expect(error.path).not.toContain('synthetic')
  expect(error.path.length).toBeLessThanOrEqual(200)
})
