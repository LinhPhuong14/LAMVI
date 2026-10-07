// Local-only lab smoke, never a production capacity certificate or a load test of customers.
import { writeFile } from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const args = Object.fromEntries(process.argv.slice(2).map((arg) => {
  const [key, ...value] = arg.replace(/^--/, '').split('=')
  return [key, value.join('=')]
}))
const base = new URL(args.base || 'http://127.0.0.1:5345')
if (!['127.0.0.1', 'localhost', '[::1]'].includes(base.hostname) || !['http:', 'https:'].includes(base.protocol)) {
  throw new Error('This tool only permits loopback URLs. Use an approved staging load test for hosted capacity.')
}
const requests = Math.min(100_000, Math.max(1, Number(args.requests) || 1000))
const concurrency = Math.min(100, Math.max(1, Number(args.concurrency) || 20))
const paths = ['/api/products', '/shop', '/api/collections', '/api/geo/provinces', '/products/den-nguyet']
const latencies = []
const failures = []
let next = 0
let failed = 0
const start = performance.now()
await Promise.all(Array.from({ length: concurrency }, async () => {
  for (;;) {
    const index = next++
    if (index >= requests) return
    const path = paths[index % paths.length]
    const t0 = performance.now()
    try {
      const res = await fetch(new URL(path, base), { signal: AbortSignal.timeout(15_000), redirect: 'error' })
      const body = await res.text()
      if (res.status !== 200 || !body.length) throw new Error(`HTTP_${res.status}`)
      if (path.startsWith('/api/')) {
        const data = JSON.parse(body)
        if (!Array.isArray(data.items)) throw new Error('INVALID_API_RESPONSE')
      } else if (!body.includes('LAMVI')) throw new Error('INVALID_HTML_RESPONSE')
    } catch (err) {
      if (failures.length < 20) failures.push({ path, error: err.name === 'TimeoutError' ? 'TIMEOUT' : err.message })
      failed++
    } finally { latencies.push(performance.now() - t0) }
  }
}))
const elapsedMs = performance.now() - start
latencies.sort((a, b) => a - b)
const percentile = (q) => Math.round(latencies[Math.max(0, Math.ceil(latencies.length * q) - 1)])
const report = { checkedAt: new Date().toISOString(), scope: 'LOCAL MEMORY ADAPTER / NO CDN / NO PROVIDER / NOT 1M CAPACITY PROOF', requests, concurrency, failed, durationMs: Math.round(elapsedMs), requestsPerSec: +(requests / elapsedMs * 1000).toFixed(1), p50Ms: percentile(.5), p95Ms: percentile(.95), p99Ms: percentile(.99), failures }
if (args.output) await writeFile(args.output, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify(report, null, 2))
process.exitCode = failed ? 1 : 0
