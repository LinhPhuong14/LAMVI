import { describe, it, expect, vi } from 'vitest'
import { createMetrics } from './metrics.js'
import { createMemoryRepo } from '../adapters/memory/repo.js'

const sample = { method: 'GET', route: '/api/products', status: 200, ms: 7, path: '/api/products' }
describe('serverless metric persistence', () => {
  it('retries the same batch receipt after commit response is lost, without duplicating counts or errors', async () => {
    const repo = createMemoryRepo()
    const write = repo.recordApiMetricBatch.bind(repo)
    let first = true
    repo.recordApiMetricBatch = vi.fn(async (...args) => {
      await write(...args)
      if (first) { first = false; throw new Error('response lost') }
    })
    const metrics = createMetrics({ repo })
    metrics.record({ ...sample, status: 500, message: 'private@example.com' })
    await metrics.flush()
    expect(repo.recordApiMetricBatch).toHaveBeenCalledTimes(2)
    expect(repo.recordApiMetricBatch.mock.calls[0][0]).toBe(repo.recordApiMetricBatch.mock.calls[1][0])
    expect((await metrics.summary('1h')).totals.count).toBe(1)
    expect(await metrics.recentErrors('1h')).toHaveLength(1)
  })
  it('serializes concurrent flushes and persists samples arriving during the first write', async () => {
    const repo = createMemoryRepo()
    const write = repo.recordApiMetricBatch.bind(repo)
    let release
    const gate = new Promise(resolve => { release = resolve })
    let writes = 0
    repo.recordApiMetricBatch = vi.fn(async (...args) => { if (++writes === 1) await gate; await write(...args) })
    const metrics = createMetrics({ repo })
    metrics.record(sample)
    const first = metrics.flush()
    metrics.record(sample)
    const second = metrics.flush()
    expect(second).toBe(first)
    release()
    await second
    expect((await metrics.summary('1h')).totals.count).toBe(2)
  })
  it('retains bounded failed batches for a later flush and redacts failure logging', async () => {
    const repo = createMemoryRepo()
    const write = repo.recordApiMetricBatch.bind(repo)
    repo.recordApiMetricBatch = vi.fn().mockRejectedValue(new Error('secret@example.com'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const metrics = createMetrics({ repo, retries: 1, maxRows: 1 })
    metrics.record(sample)
    metrics.record({ ...sample, route: '/api/extra' })
    await metrics.flush()
    expect(repo.recordApiMetricBatch).toHaveBeenCalledTimes(2)
    expect(log.mock.calls.flat().join(' ')).not.toContain('secret')
    repo.recordApiMetricBatch = write
    await metrics.flush()
    expect((await metrics.summary('1h')).totals.count).toBe(1)
    log.mockRestore()
  })
  it('does no retention I/O per serverless request; maintenance cleans explicitly', async () => {
    const repo = createMemoryRepo()
    repo.deleteApiMetricsBefore = vi.fn(async () => {})
    const metrics = createMetrics({ repo })
    metrics.record(sample)
    await metrics.flush({ cleanup: false })
    expect(repo.deleteApiMetricsBefore).not.toHaveBeenCalled()
    await metrics.cleanup()
    expect(repo.deleteApiMetricsBefore).toHaveBeenCalledOnce()
    await metrics.cleanup()
    expect(repo.deleteApiMetricsBefore).toHaveBeenCalledOnce()
  })
  it('uses database aggregation rather than capped raw rows', async () => {
    const repo = createMemoryRepo()
    repo.aggregateApiMetrics = vi.fn(async () => [{ ...sample, count: 10001, total_ms: 70007, max_ms: 7, le_50: 10001, le_100: 0, le_250: 0, le_500: 0, le_1000: 0, le_2500: 0, gt_2500: 0 }])
    repo.listApiMetrics = vi.fn(() => { throw new Error('raw capped query forbidden') })
    expect((await createMetrics({ repo }).summary('7d')).totals.count).toBe(10001)
    expect(repo.listApiMetrics).not.toHaveBeenCalled()
  })
})
