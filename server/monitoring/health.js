import { readFileSync } from 'node:fs'

const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const startedAt = new Date()

async function check(fn, timeoutMs) {
  const t0 = performance.now()
  let timer
  try {
    await Promise.race([fn(), new Promise((_, rej) => (timer = setTimeout(() => rej(new Error('timeout')), timeoutMs)))])
    return { status: 'ok', latencyMs: Math.round(performance.now() - t0) }
  } catch (err) {
    return { status: 'error', latencyMs: Math.round(performance.now() - t0), message: String(err?.message ?? err).slice(0, 200) }
  } finally {
    clearTimeout(timer)
  }
}

// Mây (D-55): chưa có khoá → not_configured; có khoá nhưng admin tắt → disabled; bật → ok
async function openaiCheck(may, env) {
  if (!may) return { name: 'openai', status: 'not_integrated', configured: Boolean(env.OPENAI_API_KEY) }
  try {
    const u = await may.usage()
    const base = { name: 'openai', configured: u.openaiConfigured, budgetPct: u.budgetPct, costUsd: u.costUsd, budgetUsd: u.budgetUsd }
    if (!u.openaiConfigured) return { ...base, status: 'not_configured' }
    if (!u.openaiEnabled) return { ...base, status: 'disabled' }
    return { ...base, status: u.alert === 'exhausted' ? 'error' : 'ok', message: u.alert ? `budget_${u.alert}` : undefined }
  } catch (err) {
    return { name: 'openai', status: 'error', message: String(err?.message ?? err).slice(0, 200) }
  }
}

// T-49: thư giao dịch. Thật sự gọi nhà cung cấp (không gửi thư) để biết khoá còn dùng được và tên
// miền gửi đã xác minh chưa — "có biến môi trường" chưa đủ để thư tới được khách.
async function mailCheck(mailer, config, timeoutMs) {
  const configured = Boolean(config.mail?.from && (config.mail.resendApiKey || config.mail.brevoApiKey))
  if (!mailer || !configured) return { name: 'mail', status: 'not_configured', configured }
  let note
  const result = await check(async () => {
    note = (await mailer.ping?.())?.note
  }, timeoutMs)
  // `message` chỉ được là mã ngắn (invalid_api_key, domain_not_verified, timeout…). Lỗi lạ (TypeError,
  // lỗi mạng kèm tiêu đề yêu cầu…) có thể chứa khoá → không trả nguyên văn ra dashboard.
  if (result.status === 'error' && !/^[a-z0-9_]+$/.test(result.message ?? '')) result.message = 'unexpected_error'
  return { name: 'mail', provider: mailer.provider, configured, ...result, ...(note ? { note } : {}) }
}

// D-52: trạng thái tích hợp — chỉ báo đã cấu hình/kết nối được, không bao giờ trả giá trị khoá
// Thành phần bắt buộc để bán hàng: thiếu cấu hình hoặc lỗi → "cần xử lý" (feedback 08/10, mục 30)
const REQUIRED = ['database', 'auth', 'payos', 'mail']
export function overallStatus(checks) {
  if (checks.some((c) => c.status === 'error')) return 'degraded'
  if (checks.some((c) => REQUIRED.includes(c.name) && c.status === 'not_configured')) return 'attention'
  return 'ok'
}

export async function runHealthChecks({ repo, auth, storage, config, may, mailer = null, payos = null, env = process.env, timeoutMs = 3000 }) {
  const supabase = config.useSupabase ? 'supabase' : 'memory'
  const [database, authCheck, storageCheck] = await Promise.all([
    check(() => repo.ping(), timeoutMs),
    check(() => auth.ping(), timeoutMs),
    check(() => storage.ping(), timeoutMs),
  ])
  // payOS đã tích hợp (FR-PAY-001) nhưng không có lệnh kiểm tra không tốn tiền → chỉ báo đã tạo client
  // hay chưa: 'configured' = đã cấu hình, chưa kiểm kết nối (G-26)
  const payosCheck = payos
    ? { name: 'payos', status: 'configured', configured: true }
    : { name: 'payos', status: 'not_configured', configured: Boolean(env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY) }
  const checks = [
    { name: 'database', provider: supabase, ...database },
    { name: 'auth', provider: supabase, ...authCheck },
    { name: 'storage', provider: supabase, ...storageCheck },
    payosCheck,
    await mailCheck(mailer, config, timeoutMs),
    await openaiCheck(may, env),
  ]
  const mem = process.memoryUsage()
  return {
    status: overallStatus(checks),
    checks,
    system: {
      version: pkg.version,
      commit: (env.GIT_COMMIT ?? env.VERCEL_GIT_COMMIT_SHA)?.slice(0, 12) ?? null,
      node: process.version,
      env: env.NODE_ENV ?? 'development',
      startedAt: startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      dataMode: supabase,
    },
  }
}
