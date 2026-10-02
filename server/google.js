import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

// D-78: đăng nhập Google bằng OAuth 2.0 authorization code với OAuth client của Google Cloud
// (GOOGLE_CLIENT_ID/SECRET), không dùng provider Google của Supabase. Không giữ trạng thái trong
// bộ nhớ tiến trình (serverless): state/nonce nằm trong cookie ký HMAC.

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const ISSUERS = new Set(['https://accounts.google.com', 'accounts.google.com'])

export const COOKIE = 'lamvi_gauth'
export const googleEnabled = (config) => Boolean(config.google?.clientId && config.google?.clientSecret)
export const redirectUri = (config) => `${config.publicSiteUrl}/api/auth/google/callback`

const sign = (body, secret) => createHmac('sha256', secret).update(body).digest('base64url')

export function sealState(payload, secret) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${body}.${sign(body, secret)}`
}

export function openState(value, secret) {
  if (typeof value !== 'string') return null
  const [body, mac] = value.split('.')
  if (!body || !mac) return null
  const a = Buffer.from(mac)
  const b = Buffer.from(sign(body, secret))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'))
    return p.exp > Date.now() ? p : null
  } catch {
    return null
  }
}

export function readCookie(req, name) {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim())
      } catch {
        return null // cookie %-encode hỏng: coi như không có
      }
    }
  }
  return null
}

export function newFlow({ next, lang }) {
  return {
    state: randomBytes(16).toString('base64url'),
    nonce: randomBytes(16).toString('base64url'),
    next,
    lang,
    exp: Date.now() + 10 * 60_000,
  }
}

export function authorizeUrl(config, flow) {
  const q = new URLSearchParams({
    client_id: config.google.clientId,
    redirect_uri: redirectUri(config),
    response_type: 'code',
    scope: 'openid email profile',
    state: flow.state,
    nonce: flow.nonce,
    prompt: 'select_account',
  })
  return `${AUTH_URL}?${q}`
}

/** Đổi code lấy id_token (nhận trực tiếp từ Google qua TLS nên không cần kiểm chữ ký) và kiểm claim */
export async function exchangeCode(config, code, flow, fetchImpl = fetch) {
  const res = await fetchImpl(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.google.clientId,
      client_secret: config.google.clientSecret,
      redirect_uri: redirectUri(config),
      grant_type: 'authorization_code',
    }),
  })
  if (!res.ok) throw new Error('GOOGLE_TOKEN_EXCHANGE')
  const { id_token: idToken } = await res.json()
  const claims = JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64url').toString('utf8'))
  if (
    claims.aud !== config.google.clientId ||
    !ISSUERS.has(claims.iss) ||
    claims.nonce !== flow.nonce ||
    claims.exp * 1000 < Date.now() ||
    claims.email_verified !== true ||
    typeof claims.email !== 'string'
  ) {
    throw new Error('GOOGLE_CLAIMS')
  }
  return { email: claims.email, name: typeof claims.name === 'string' ? claims.name : null }
}
