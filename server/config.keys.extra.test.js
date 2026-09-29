import { describe, it, expect } from 'vitest'
import { loadConfig } from './config.js'

describe('loadConfig — khoá Supabase', () => {
  const url = 'https://x.supabase.co'

  it('nhận tên khoá mới publishable/secret', () => {
    const c = loadConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_a', SUPABASE_SECRET_KEY: 'sb_secret_b' })
    expect(c.supabase.anonKey).toBe('sb_publishable_a')
    expect(c.supabase.serviceRoleKey).toBe('sb_secret_b')
    expect(c.useSupabase).toBe(true)
  })

  it('vẫn nhận tên cũ anon/service_role', () => {
    const c = loadConfig({ SUPABASE_URL: url, SUPABASE_ANON_KEY: 'a', SUPABASE_SERVICE_ROLE_KEY: 'b' })
    expect(c.useSupabase).toBe(true)
  })

  it('ưu tiên tên mới khi có cả hai', () => {
    const c = loadConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'new', SUPABASE_ANON_KEY: 'old', SUPABASE_SECRET_KEY: 'snew', SUPABASE_SERVICE_ROLE_KEY: 'sold' })
    expect(c.supabase.anonKey).toBe('new')
    expect(c.supabase.serviceRoleKey).toBe('snew')
  })

  it('thiếu secret → bộ nhớ', () => {
    expect(loadConfig({ SUPABASE_URL: url, SUPABASE_PUBLISHABLE_KEY: 'a' }).useSupabase).toBe(false)
  })
})
