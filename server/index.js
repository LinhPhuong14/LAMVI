import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { createWeb } from './ssr.js'
import { createMetrics } from './monitoring/metrics.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { createMayService } from './may/service.js'
import { createOrderService } from './orders/service.js'
import { createPayos } from './payments/payos.js'
import { createFakePayos } from './payments/fakePayos.js'
import { createOpenAiClient } from './adapters/openai.js'
import { classifyPath } from '../src/seo/routes.js'
import { loadConfig } from './config.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createSupabaseRepo } from './adapters/supabase/repo.js'
import { createSupabaseAuth } from './adapters/supabase/auth.js'
import { createSupabaseStorage } from './adapters/supabase/storage.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

const config = loadConfig()
let repo
let auth
let storage

// T-04: có đủ biến Supabase → dùng Supabase; không thì dùng bộ nhớ (chỉ cho dev)
if (config.useSupabase) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, opts)
  const makePublicClient = () => createClient(config.supabase.url, config.supabase.anonKey, opts)
  repo = createSupabaseRepo(admin)
  auth = createSupabaseAuth({ admin, makePublicClient })
  storage = createSupabaseStorage(admin)
  console.log('[api] Dùng Supabase')
} else {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  storage = createMemoryStorage({ maxBytes: config.maxVideoMb * 1024 * 1024 })
  console.warn('[api] Thiếu biến SUPABASE_* — dùng dữ liệu bộ nhớ (không lưu lâu dài)')
  // Chỉ dev: tạo sẵn tài khoản admin để thử /admin
  for (const [prefix, role] of [['DEV_ADMIN', 'admin'], ['DEV_IT', 'it']]) {
    const email = process.env[`${prefix}_EMAIL`]
    const password = process.env[`${prefix}_PASSWORD`]
    if (!email || !password) continue
    const { user } = await auth.signUp({ email, password })
    await repo.upsertProfile({ id: user.id, fullName: role.toUpperCase(), role })
    console.log(`[api] Tài khoản ${role} dev: ${email}`)
  }
}

// D-49: một server phục vụ cả web (SSR) và API. API_ONLY=1 để chỉ chạy API.
const dev = process.env.NODE_ENV !== 'production'
// D-52, D-54: dùng chung cho API và SSR
const metrics = createMetrics({ repo, classify: classifyPath })
const maintenance = createMaintenance({ repo })
const may = createMayService({
  repo,
  openai: config.openai.apiKey ? createOpenAiClient({ apiKey: config.openai.apiKey, model: config.openai.model }) : null,
  priceInPer1M: config.openai.priceInPer1M,
  priceOutPer1M: config.openai.priceOutPer1M,
  hashSalt: config.mayHashSalt,
})
const payosReady = Boolean(config.payos.clientId && config.payos.apiKey && config.payos.checksumKey)
// Thiếu PAYOS_*: dev → payOS giả lập (T-25); production → tắt payOS, chỉ còn COD
if (!payosReady) console.warn(dev ? '[api] Thiếu PAYOS_* — dùng payOS giả lập tại /api/dev/payos/:mã đơn' : '[api] Thiếu PAYOS_* — tắt thanh toán payOS')
const payments = payosReady ? createPayos(config.payos) : dev ? createFakePayos({ publicSiteUrl: config.publicSiteUrl }) : null
const orders = createOrderService({ repo, payments, publicSiteUrl: config.publicSiteUrl })
const web = process.env.API_ONLY === '1' ? undefined : await createWeb({ repo, config, dev, maintenance })

metrics.start()
// BR-PAY-003: dọn đơn payOS quá hạn mỗi phút
setInterval(() => orders.sweepExpired().catch((err) => console.error('[orders] sweep', err?.message ?? err)), 60_000).unref()
// Ghi nốt số liệu chưa flush khi tắt server
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.once(sig, async () => {
    await metrics.stop()
    process.exit(0)
  })
}

createApp({ repo, auth, storage, web, config, metrics, maintenance, may, payments, orders }).listen(config.port, () => {
  console.log(`[web+api] http://localhost:${config.port}`)
})
