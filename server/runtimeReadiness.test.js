import { describe, expect, it } from 'vitest'
import { loadConfig } from './config.js'
import { assertRuntimeReady, runtimeReadiness } from './runtimeReadiness.js'

const hosted = { VERCEL: '1', NODE_ENV: 'production', SUPABASE_URL: 'https://db.example.com', SUPABASE_PUBLISHABLE_KEY: 'publishable-test', SUPABASE_SECRET_KEY: 'secret-test', PUBLIC_SITE_URL: 'https://www.lamvi.com.vn', MAY_HASH_SALT: 'private-test-salt', TRUST_PROXY: '1' }

describe('production runtime readiness', () => {
  it('fails closed instead of using memory with missing database configuration', () => {
    expect(() => assertRuntimeReady(loadConfig({}), { VERCEL: '1' })).toThrow('SUPABASE_BINDINGS')
  })
  it('accepts full hosted configuration without disclosing secret values', () => {
    const result = runtimeReadiness(loadConfig(hosted), hosted)
    expect(result.ready).toBe(true)
    expect(JSON.stringify(result)).not.toContain('private-test-salt')
    expect(result.optional).toEqual(['TRANSACTIONAL_EMAIL', 'CRON_SECRET', 'PAYOS'])
  })
  it.each([
    [{ RATE_LIMIT: '0' }, 'RATE_LIMIT_ENABLED'],
    [{ TRUST_PROXY: 'true' }, 'TRUST_PROXY_1'],
    [{ MAY_HASH_SALT: '' }, 'MAY_HASH_SALT_PRIVATE'],
    [{ PUBLIC_SITE_URL: 'http://www.lamvi.com.vn' }, 'PUBLIC_SITE_URL_HTTPS'],
    [{ DEV_ADMIN_PASSWORD: 'must-not-log' }, 'REMOVE_DEV_ACCOUNTS'],
  ])('rejects unsafe production overrides', (changes, issue) => {
    const env = { ...hosted, ...changes }
    expect(runtimeReadiness(loadConfig(env), env).required).toContain(issue)
  })
  it('permits explicitly opted-in local built demo but cannot use exception on a host', () => {
    const env = { NODE_ENV: 'production', ALLOW_LOCAL_MEMORY: '1', PUBLIC_SITE_URL: 'http://localhost:5173' }
    expect(runtimeReadiness(loadConfig(env), env)).toMatchObject({ ready: true, localDemo: true })
    expect(runtimeReadiness(loadConfig(env), { ...env, VERCEL: '1' }).ready).toBe(false)
    const remote = { ...env, PUBLIC_SITE_URL: 'https://example.com' }
    expect(runtimeReadiness(loadConfig(remote), remote).ready).toBe(false)
  })
  it('does not impose production bindings on normal development', () => {
    expect(runtimeReadiness(loadConfig({}), {}).ready).toBe(true)
  })
})
