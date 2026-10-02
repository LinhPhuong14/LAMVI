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

// D-52: trạng thái tích hợp — chỉ báo đã cấu hình/kết nối được, không bao giờ trả giá trị khoá
export async function runHealthChecks({ repo, auth, storage, config, may, env = process.env, timeoutMs = 3000 }) {
  const supabase = config.useSupabase ? 'supabase' : 'memory'
  const [database, authCheck, storageCheck] = await Promise.all([
    check(() => repo.ping(), timeoutMs),
    check(() => auth.ping(), timeoutMs),
    check(() => storage.ping(), timeoutMs),
  ])
  const integration = (name, configured) => ({
    name,
    // Chưa có code tích hợp (checkout/Mây chưa làm) → chỉ báo đã có biến môi trường chưa
    status: 'not_integrated',
    configured,
  })
  const checks = [
    { name: 'database', provider: supabase, ...database },
    { name: 'auth', provider: supabase, ...authCheck },
    { name: 'storage', provider: supabase, ...storageCheck },
    integration('payos', Boolean(env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY)),
    // T-49: thư giao dịch — chỉ báo đã cấu hình chưa, không trả khoá
    { name: 'mail', status: 'not_integrated', configured: Boolean(config.mail?.from && (config.mail.resendApiKey || config.mail.brevoApiKey)) },
    await openaiCheck(may, env),
  ]
  const mem = process.memoryUsage()
  return {
    status: checks.every((c) => c.status !== 'error') ? 'ok' : 'degraded',
    checks,
    system: {
      version: pkg.version,
      commit: env.GIT_COMMIT ?? null,
      node: process.version,
      env: env.NODE_ENV ?? 'development',
      startedAt: startedAt.toISOString(),
      uptimeSec: Math.round(process.uptime()),
      memoryMb: { rss: Math.round(mem.rss / 1048576), heapUsed: Math.round(mem.heapUsed / 1048576) },
      dataMode: supabase,
    },
  }
}
