export function loadConfig(env = process.env) {
  const supabase = {
    url: env.SUPABASE_URL,
    anonKey: env.SUPABASE_ANON_KEY,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  }
  return {
    port: Number(env.PORT) || 8787,
    publicSiteUrl: env.PUBLIC_SITE_URL || 'http://localhost:5173',
    supabase,
    useSupabase: Boolean(supabase.url && supabase.anonKey && supabase.serviceRoleKey),
  }
}
