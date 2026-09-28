// D-52, D-53: số liệu API gộp theo phút × method × route × status, flush định kỳ vào repo (Supabase).

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

export function createMetrics({ repo, classify = () => ({ kind: 'other' }), flushMs = 60_000, retentionDays = 30, now = () => Date.now() }) {
  let buffer = new Map()
  let errors = []
  let lastCleanup = 0
  let timer = null

  function record({ method, route, status, ms, path, code, message }) {
    const bucket = bucketOf(now())
    const k = `${bucket}|${method}|${route}|${status}`
    const row = buffer.get(k) ?? emptyRow(bucket, method, route, status)
    row.count += 1
    row.total_ms += ms
    row.max_ms = Math.max(row.max_ms, ms)
    row[histKey(ms)] += 1
    buffer.set(k, row)
    if (status >= 500) {
      // Không lưu query string, body, token (dữ liệu cá nhân)
      errors.push({ at: new Date(now()).toISOString(), method, route, path, status, code: code ?? null, message: message ? String(message).slice(0, 300) : null })
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
        path: req.originalUrl.split('?')[0].slice(0, 200),
        code: res.locals.errorCode,
        message: res.locals.errorMessage,
      })
    })
    next()
  }

  async function flush() {
    const rows = [...buffer.values()]
    const errs = errors
    buffer = new Map()
    errors = []
    // Mỗi bước độc lập: bước này lỗi không chặn bước sau. Lỗi → bỏ lô đó (mất tối đa 1 phút số liệu) [ASSUMPTION]
    const step = async (name, fn) => {
      try {
        await fn()
      } catch (err) {
        console.error(`[metrics] ${name}`, err?.message ?? err)
      }
    }
    if (rows.length) await step('metrics', () => repo.recordApiMetrics(rows))
    if (errs.length) await step('errors', () => repo.recordApiErrors(errs))
    // Giữ 30 ngày [ASSUMPTION]; dọn tối đa mỗi giờ một lần, chỉ đánh dấu khi dọn thành công
    if (now() - lastCleanup > 3600_000) {
      await step('cleanup', async () => {
        await repo.deleteApiMetricsBefore(new Date(now() - retentionDays * 86400_000).toISOString())
        lastCleanup = now()
      })
    }
  }

  // Tổng hợp cho dashboard: dữ liệu đã lưu + phần chưa flush
  async function summary(range) {
    const since = new Date(now() - RANGES[range]).toISOString()
    const stored = await repo.listApiMetrics({ since })
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
    summary,
    recentErrors,
    start() {
      timer ??= setInterval(flush, flushMs)
      timer.unref?.()
    },
    async stop() {
      clearInterval(timer)
      timer = null
      await flush()
    },
  }
}
