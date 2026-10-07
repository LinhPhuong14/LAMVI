import { DEFAULT_HASH_SALT } from './config.js'

// Deployment must never silently accept orders in the ephemeral memory adapter.
// The explicit local demo exception is limited to loopback and cannot run on Vercel.
export function runtimeReadiness(config, env = process.env) {
  const hosted = Boolean(env.VERCEL)
  const production = hosted || env.NODE_ENV === 'production'
  let localDemo = false
  try {
    const url = new URL(config.publicSiteUrl)
    localDemo = !hosted && env.ALLOW_LOCAL_MEMORY === '1' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  } catch { /* invalid site URL is reported below */ }
  const required = []
  const optional = []
  if (production && !localDemo) {
    if (!config.useSupabase) required.push('SUPABASE_BINDINGS')
    let url
    try { url = new URL(config.publicSiteUrl) } catch { /* validate below */ }
    if (!url || url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) required.push('PUBLIC_SITE_URL_HTTPS')
    if (!config.mayHashSalt || config.mayHashSalt === DEFAULT_HASH_SALT || config.mayHashSalt === config.supabase?.url) required.push('MAY_HASH_SALT_PRIVATE')
    if (config.rateLimit?.enabled === false) required.push('RATE_LIMIT_ENABLED')
    if (hosted && config.trustProxy !== 1) required.push('TRUST_PROXY_1')
    if (Object.keys(env).some((k) => /^DEV_(ADMIN|IT)_(EMAIL|PASSWORD)$/.test(k) && env[k])) required.push('REMOVE_DEV_ACCOUNTS')
  }
  if (!config.mail?.from || !(config.mail.resendApiKey || config.mail.brevoApiKey)) optional.push('TRANSACTIONAL_EMAIL')
  if (!config.cronSecret) optional.push('CRON_SECRET')
  if (!config.payos?.clientId || !config.payos.apiKey || !config.payos.checksumKey) optional.push('PAYOS')
  return { ready: required.length === 0, production, localDemo, required, optional }
}

export function assertRuntimeReady(config, env = process.env) {
  const result = runtimeReadiness(config, env)
  if (!result.ready) throw new Error(`Deployment configuration incomplete: ${result.required.join(', ')}. See docs/knowledge/deploy-vercel.md.`)
  return result
}
