// Store no recipient/address/checkout text. Only a random request key and SHA-256
// fingerprint survive a reload; the authoritative replay record is in Postgres.
const active = new Map()
const storageKey = (userId) => `LAMVI.checkout.request.${userId}`
export function readCheckoutRequest(userId) {
  const memory = active.get(userId)
  if (memory) return memory.key
  try {
    const stored = JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? 'null')
    return stored && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(stored.key) && /^[0-9a-f]{64}$/.test(stored.fingerprint) ? stored.key : null
  } catch { return null }
}
export function clearCheckoutRequest(userId) {
  active.delete(userId)
  try { sessionStorage.removeItem(storageKey(userId)) } catch { /* storage may be unavailable */ }
}
export async function checkoutRequestKey(userId, body, items) {
  const serialized = JSON.stringify({ body, items: items.map(({ slug, quantity, unitPrice }) => ({ slug, quantity, unitPrice })) })
  const previous = active.get(userId)
  if (previous?.serialized === serialized) return previous.key
  let digest = null
  if (globalThis.crypto?.subtle) {
    digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(serialized))), (byte) => byte.toString(16).padStart(2, '0')).join('')
  }
  let stored
  if (digest) {
    try { stored = JSON.parse(sessionStorage.getItem(storageKey(userId)) ?? 'null') } catch { /* ignored */ }
  }
  const key = stored?.fingerprint === digest && /^[0-9a-f-]{36}$/i.test(stored.key) ? stored.key : crypto.randomUUID()
  active.set(userId, { key, serialized })
  if (digest) {
    try { sessionStorage.setItem(storageKey(userId), JSON.stringify({ key, fingerprint: digest })) } catch { /* in-memory retry still works */ }
  }
  return key
}
