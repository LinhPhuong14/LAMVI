import { EventEmitter } from 'node:events'
import { describe, expect, it, vi } from 'vitest'
const { waitUntil, flush, app } = vi.hoisted(() => {
  const flush = vi.fn(async () => {})
  const app = Object.assign(vi.fn((req, res) => {
    // Express can finish synchronously; the platform listener must already exist.
    res.on('finish', () => { req.recorded = true })
    res.emit('finish')
  }), { locals: { metrics: { flush } } })
  return { waitUntil: vi.fn(), flush, app }
})
vi.mock('@vercel/functions', () => ({ waitUntil }))
vi.mock('../index.js', () => ({ app }))
import handler from '../../api/index.js'
describe('Vercel metrics lifecycle', () => {
  it('registers platform work before a synchronous response and flushes after finish recording', async () => {
    const req = {}
    flush.mockImplementationOnce(async () => { expect(req.recorded).toBe(true) })
    handler(req, new EventEmitter())
    expect(waitUntil).toHaveBeenCalledOnce()
    await waitUntil.mock.calls[0][0]
    expect(flush).toHaveBeenCalledOnce()
  })
})
