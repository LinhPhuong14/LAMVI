import { createClient } from '@supabase/supabase-js'
import { createApp } from './app.js'
import { loadConfig } from './config.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createSupabaseRepo } from './adapters/supabase/repo.js'
import { createSupabaseAuth } from './adapters/supabase/auth.js'

const config = loadConfig()
let repo
let auth

// T-04: có đủ biến Supabase → dùng Supabase; không thì dùng bộ nhớ (chỉ cho dev)
if (config.useSupabase) {
  const opts = { auth: { persistSession: false, autoRefreshToken: false } }
  const admin = createClient(config.supabase.url, config.supabase.serviceRoleKey, opts)
  const makePublicClient = () => createClient(config.supabase.url, config.supabase.anonKey, opts)
  repo = createSupabaseRepo(admin)
  auth = createSupabaseAuth({ admin, makePublicClient })
  console.log('[api] Dùng Supabase')
} else {
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  console.warn('[api] Thiếu biến SUPABASE_* — dùng dữ liệu bộ nhớ (không lưu lâu dài)')
}

createApp({ repo, auth, config }).listen(config.port, () => {
  console.log(`[api] http://localhost:${config.port}`)
})
