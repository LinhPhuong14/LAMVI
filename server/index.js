import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
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
  if (process.env.DEV_ADMIN_EMAIL && process.env.DEV_ADMIN_PASSWORD) {
    const { user } = await auth.signUp({ email: process.env.DEV_ADMIN_EMAIL, password: process.env.DEV_ADMIN_PASSWORD })
    await repo.upsertProfile({ id: user.id, fullName: 'Admin', role: 'admin' })
    console.log(`[api] Admin dev: ${process.env.DEV_ADMIN_EMAIL}`)
  }
}

createApp({ repo, auth, storage, config }).listen(config.port, () => {
  console.log(`[api] http://localhost:${config.port}`)
})
