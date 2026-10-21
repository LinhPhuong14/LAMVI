// Smoke test công khai, CHỈ ĐỌC (GET) cho bản đang chạy. Không tạo đơn, không gửi thư, không cần khoá.
// Dùng làm uptime monitor (.github/workflows/uptime.yml) và kiểm sau deploy:
//   node scripts/prod-smoke.js [https://www.lamvi.com.vn]
// Mã thoát 1 nếu có kiểm tra hỏng; mỗi kiểm tra thử lại 1 lần để bỏ qua lỗi mạng thoáng qua.
const base = (process.argv[2] || process.env.SMOKE_BASE_URL || 'https://www.lamvi.com.vn').replace(/\/$/, '')
const TIMEOUT_MS = 15000
const SLOW_MS = 4000

const json = (check) => async (res) => {
  const body = await res.json().catch(() => null)
  return body ? check(body) : 'không phải JSON'
}

const checks = [
  { path: '/', html: true },
  { path: '/en', html: true },
  { path: '/shop', html: true },
  { path: '/api/health?deep=1', run: json((b) => (b.ok === true && b.db === true ? null : `ok=${b.ok} db=${b.db}`)) },
  // Sản phẩm kèm `specs` => đã chạy migration 021; có đủ 5 đèn
  { path: '/api/products', run: json((b) => (b.items?.length >= 5 && b.items.every((p) => p.specs && p.price > 0) ? null : `items=${b.items?.length}, thiếu specs/giá (migration 021?)`)) },
  // Bộ sưu tập trả 503 SCHEMA_OUTDATED khi thiếu migration 011/014
  { path: '/api/collections', run: json((b) => (b.items?.length >= 1 ? null : 'danh sách rỗng')) },
  { path: '/api/faq', run: json((b) => (b.items?.length >= 1 ? null : 'danh sách rỗng')) },
  { path: '/api/geo/provinces', run: json((b) => (b.items?.length >= 30 ? null : `chỉ ${b.items?.length} tỉnh`)) },
  { path: '/api/shipping-policy', run: json(() => null) },
  { path: '/sitemap.xml', run: async (res) => ((await res.text()).includes('<urlset') ? null : 'sitemap sai định dạng') },
  { path: '/robots.txt', run: async (res) => ((await res.text()).includes('Sitemap:') ? null : 'thiếu Sitemap') },
  // Cổng bảo vệ phải còn hoạt động: chưa đăng nhập => 401
  { path: '/api/it/health', status: 401 },
  { path: '/api/orders', status: 401 },
]

async function once({ path, status = 200, html, run }) {
  const started = Date.now()
  const res = await fetch(base + path, { signal: AbortSignal.timeout(TIMEOUT_MS), redirect: 'manual' })
  const ms = Date.now() - started
  if (res.status !== status) return { ms, error: `HTTP ${res.status} (cần ${status})` }
  if (html && !(res.headers.get('content-type') || '').includes('text/html')) return { ms, error: 'không phải HTML' }
  const error = run ? await run(res) : null
  if (!error && ms > SLOW_MS) return { ms, warn: `chậm ${ms}ms` }
  return { ms, error }
}

let failed = 0
for (const check of checks) {
  let result
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      result = await once(check)
    } catch (err) {
      result = { ms: 0, error: `${err.name}: ${err.cause?.code || err.message}` }
    }
    if (!result.error) break
  }
  const label = result.error ? `FAIL  ${result.error}` : result.warn ? `WARN  ${result.warn}` : `PASS  ${result.ms}ms`
  console.log(`${check.path.padEnd(24)} ${label}`)
  if (result.error) failed++
}
console.log(failed ? `\n${failed}/${checks.length} kiểm tra hỏng — ${base}` : `\nTất cả ${checks.length} kiểm tra đạt — ${base}`)
process.exitCode = failed ? 1 : 0
