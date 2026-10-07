// Read-only deployment preflight. Run with the target Supabase environment bindings.
import { createClient } from '@supabase/supabase-js'
import { loadConfig } from '../server/config.js'

const config = loadConfig()
if (!config.useSupabase) {
  console.error('Schema preflight requires SUPABASE_URL and publishable/secret key bindings; no values are logged.')
  process.exit(1)
}
const client = createClient(config.supabase.url, config.supabase.serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
})
let failed = false
for (const [table, columns, migration] of [
  ['collections', 'id,slug,status,sort_order,story_title,story', '011'],
  ['products', 'id,collection_slug,piece_order,stock', '011–012'],
  ['orders', 'id,qr_token,delivered_at,province_code,ward_code,atomic_cancellation,checkout_idempotency_key,checkout_fingerprint', '010–018'],
  ['order_items', 'id,stock_reserved', '013'],
  ['notification_jobs', 'id,event,status,lease_token,delivery_started_at', '015'],
  ['return_requests', 'id,status,resolution,resolved_at', '016'],
  ['api_metric_batches', 'id,created_at', '017'],
]) {
  const { error } = await client.from(table).select(columns).limit(0)
  console.log(`${table}: ${error ? `FAIL (${error.code ?? 'network'}); verify migration ${migration} and permissions` : 'PASS'}`)
  if (error) failed = true
}
// The empty cart is rejected before any data write; verifies RPC availability safely.
const { error } = await client.rpc('create_checkout_order', { p_order: {}, p_items: [], p_coupon: null })
const rpcReady = error?.code === 'P0001' && error.message === 'CART_EMPTY'
console.log(`create_checkout_order: ${rpcReady ? 'PASS (empty cart rejected without writes)' : 'FAIL; verify migration 013 and service-role permissions'}`)
if (!rpcReady) failed = true
process.exitCode = failed ? 1 : 0
