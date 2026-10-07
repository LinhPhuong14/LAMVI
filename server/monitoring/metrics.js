// D-52, D-53: số liệu API gộp theo phút × method × route × status, flush định kỳ vào repo (Supabase).
import { randomUUID } from 'node:crypto'
import { redactPii } from '../may/guard.js'
import { sanitizePath } from '../../src/analytics/ga.js'

// Chuỗi dài không khoảng trắng trông như token/JWT/khoá — che trước khi lưu vào nhật ký lỗi
const TOKENISH = /\b[A-Za-z0-9_-]{24,}\b/g

/** G-28: che email, SĐT (redactPii) và các chuỗi giống token trong thông điệp lỗi. */
export function redactSecrets(text) {
  let clean = String(text)
  for (let attempt = 0; attempt < 3; attempt++) {
    const decoded = clean.replace(/(?:%[0-9a-f]{2})+/gi, encoded => {
      try { return decodeURIComponent(encoded) } catch { return '[encoded]' }
    })
    if (decoded === clean) break
    clean = decoded
  }
  return redactPii(clean)
    .replace(/\+\d(?:[\s.()-]*\d){7,14}\b|\b\d{10,15}\b/g, '[phone]')
    .replace(TOKENISH, '[token]')
}

// URI segments can contain percent-encoded PII outside the QR/reset routes.
// Decode before redaction, but never let a malformed escape break a response.
export function redactErrorPath(path) {
  return sanitizePath(path).slice(0, 200)
}

export const BOUNDS = [50, 100, 250, 500, 1000, 2500]
export const HIST_KEYS = ['le_50', 'le_100', 'le_250', 'le_500', 'le_1000', 'le_2500', 'gt_2500']
export const RANGES = { '1h': 3600_000, '24h': 86400_000, '7d': 7 * 86400_000 }
// Nhóm API đã biết — đường dẫn lạ gộp chung '/api/*' để nhãn không chứa giá trị tuỳ ý (uuid, chuỗi bot quét)
const KNOWN_API_SEGMENTS = ['products', 'faq', 'batches', 'auth', 'me', 'admin', 'it', 'health', 'dev-storage']

const histKey = (ms) => HIST_KEYS[BOUNDS.findIndex((b) => ms <= b)] ?? 'gt_2500'
const bucketOf = (t) => new Date(Math.floor(t / 60000) * 60000).toISOString()
const emptyRow = (bucket, method, route, status) => ({
  bucket,
  method,
  route,
  status,
  count: 0,
  total_ms: 0,
  max_ms: 0,
  ...Object.fromEntries(HIST_KEYS.map((k) => [k, 0])),
})

// Nhãn route: mẫu route của Express (không chứa slug/mã cụ thể) để gộp số liệu
// Gọi lúc ghi header (còn trong handler): req.route, req.baseUrl còn đúng ngữ cảnh router
export function routeLabel(req, res, classify) {
  const path = req.originalUrl.split('?')[0]
  if (path.startsWith('/api/') || path === '/api') {
    // Lỗi ném từ handler được errorHandler (cấp app) ghi header: baseUrl đã reset nhưng req.route còn
    if (req.route?.path) return `${req.baseUrl.startsWith('/api') ? req.baseUrl : '/api'}${String(req.route.path)}`
    const seg = path.split('/')[2]
    return KNOWN_API_SEGMENTS.includes(seg) ? `/api/${seg}/*` : '/api/*'
  }
  if (path === '/sitemap.xml' || path === '/robots.txt') return path
  if (String(res.get('Content-Type') ?? '').startsWith('text/html')) return `page:${classify(path).kind}`
  return null // tài nguyên tĩnh, HMR… không đếm
}

// Ước lượng phân vị từ histogram: cận trên của ô chứa phân vị
export function percentile(row, q) {
  if (!row.count) return null
  const target = q * row.count
  let acc = 0
  for (let i = 0; i < HIST_KEYS.length; i++) {
    acc += row[HIST_KEYS[i]]
    if (acc >= target) return i < BOUNDS.length ? BOUNDS[i] : Math.round(row.max_ms)
  }
  return Math.round(row.max_ms)
}

export function createMetrics({ repo, classify = () => ({ kind: 'other' }), flushMs = 60_000, retentionDays = 30, now = () => Date.now(), maxRows = 1000, maxErrors = 100, maxBatches = 8, retries = 2 }) {
  let buffer = new Map()
  let errors = []
  let lastCleanup = 0
  let timer = null
  let flushing = null
  const batches = []

  function record({ method, route, status, ms, path, code, message }) {
    const at = now()
    const bucket = bucketOf(at)
    const k = `${bucket}|${method}|${route}|${status}`
    if (!buffer.has(k) && buffer.size >= maxRows) return
    const row = buffer.get(k) ?? emptyRow(bucket, method, route, status)
    row.count += 1
    row.total_ms += ms
    row.max_ms = Math.max(row.max_ms, ms)
    row[histKey(ms)] += 1
    buffer.set(k, row)
    if (status >= 500 && errors.length < maxErrors) {
      // G-28 / NFR-PRV-002: lỗi 5xx được IT xem, nên không lưu dữ liệu cá nhân.
      // - Không lưu query string, body, token ngay từ đầu.
      // - Đường dẫn: che đoạn bí mật (token trang QR lời chúc, token đặt lại mật khẩu).
      // - Thông điệp lỗi có thể chứa email/SĐT khách (lỗi từ DB, từ cổng thanh toán) → che.
      errors.push({
        at: new Date(at).toISOString(),
        method,
        route,
        path: redactErrorPath(path),
        status,
        code: code == null ? null : redactSecrets(String(code)).slice(0, 80),
        message: message ? redactSecrets(String(message)).slice(0, 300) : null,
      })
    }
  }

  function middleware(req, res, next) {
    const start = process.hrtime.bigint()
    let route
    const writeHead = res.writeHead
    res.writeHead = function (...args) {
      route ??= routeLabel(req, res, classify)
      return writeHead.apply(this, args)
    }
    res.on('finish', () => {
      route ??= routeLabel(req, res, classify)
      if (!route) return
      const ms = Number(process.hrtime.bigint() - start) / 1e6
      record({
        method: req.method,
        route,
        status: res.statusCode,
        ms,
        path: req.originalUrl.split('?')[0],
        code: res.locals.errorCode,
        message: res.locals.errorMessage,
      })
    })
    next()
  }

  function snapshot() {
    if ((!buffer.size && !errors.length) || batches.length >= maxBatches) return
    batches.push({ id: randomUUID(), rows: [...buffer.values()], errors })
    buffer = new Map()
    errors = []
  }

  async function cleanup() {
    if (now() - lastCleanup <= 3600_000) return
    try {
      await repo.deleteApiMetricsBefore(new Date(now() - retentionDays * 86400_000).toISOString())
      lastCleanup = now()
    } catch {
      console.error('[metrics] retention cleanup failed')
    }
  }

  function flush({ cleanup: runCleanup = true } = {}) {
    // Snapshot also during an in-flight write, so a second request's waitUntil
    // covers its own measurements. No parallel writes/double-counted batches.
    snapshot()
    if (flushing) return flushing
    flushing = (async () => {
      let drained = 0
      // Bound work even if concurrent requests continuously replenish the queue.
      while (batches.length && drained++ < maxBatches * 2) {
        const batch = batches[0]
        let saved = false
        for (let attempt = 0; attempt <= retries; attempt++) {
          try {
            if (repo.recordApiMetricBatch) {
              await repo.recordApiMetricBatch(batch.id, batch.rows, batch.errors)
            } else {
              // Compatibility for older/test adapters: never retry ambiguous writes.
              if (batch.rows.length) await repo.recordApiMetrics(batch.rows)
              if (batch.errors.length) await repo.recordApiErrors(batch.errors)
            }
            saved = true
            break
          } catch {
            if (!repo.recordApiMetricBatch) break
          }
        }
        if (!saved) {
          console.error('[metrics] batch persistence failed; bounded buffer retained')
          break
        }
        batches.shift()
        snapshot()
      }
      if (runCleanup) await cleanup()
    })().finally(() => { flushing = null })
    return flushing
  }

  // Tổng hợp cho dashboard: dữ liệu đã lưu + phần chưa flush
  async function summary(range) {
    const since = new Date(now() - RANGES[range]).toISOString()
    const stored = repo.aggregateApiMetrics
      ? await repo.aggregateApiMetrics({ since })
      : await repo.listApiMetrics({ since })
    // Unsaved batches can have committed despite a lost response; do not add them
    // to durable totals until retry confirms their idempotency receipt.
    const pending = [...buffer.values()].filter((r) => r.bucket >= since)
    const byRoute = new Map()
    const totals = emptyRow(null, '*', '*', 0)
    const add = (acc, r) => {
      acc.count += r.count
      acc.total_ms += r.total_ms
      acc.max_ms = Math.max(acc.max_ms, r.max_ms)
      for (const h of HIST_KEYS) acc[h] += r[h]
      const cls = `s${Math.floor(r.status / 100)}xx`
      acc[cls] = (acc[cls] ?? 0) + r.count
    }
    for (const r of [...stored, ...pending]) {
      const k = `${r.method} ${r.route}`
      if (!byRoute.has(k)) byRoute.set(k, emptyRow(null, r.method, r.route, 0))
      add(byRoute.get(k), r)
      add(totals, r)
    }
    const present = (r) => ({
      method: r.method,
      route: r.route,
      count: r.count,
      s2xx: r.s2xx ?? 0,
      s3xx: r.s3xx ?? 0,
      s4xx: r.s4xx ?? 0,
      s5xx: r.s5xx ?? 0,
      errorRate: r.count ? (r.s5xx ?? 0) / r.count : 0,
      avgMs: r.count ? Math.round(r.total_ms / r.count) : null,
      p50Ms: percentile(r, 0.5),
      p95Ms: percentile(r, 0.95),
      maxMs: Math.round(r.max_ms),
    })
    return {
      range,
      since,
      totals: present(totals),
      routes: [...byRoute.values()].map(present).sort((a, b) => b.count - a.count),
    }
  }

  async function recentErrors(range, limit = 50) {
    const since = new Date(now() - RANGES[range]).toISOString()
    const stored = await repo.listApiErrors({ since, limit })
    return [...errors.filter((e) => e.at >= since), ...stored].sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit)
  }

  return {
    record,
    middleware,
    flush,
    cleanup,
    summary,
    recentErrors,
    start() {
      timer ??= setInterval(() => flush(), flushMs)
      timer.unref?.()
    },
    async stop() {
      clearInterval(timer)
      timer = null
      await flush()
    },
  }
}
