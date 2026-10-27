import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'
const API = 'https://analyticsdata.googleapis.com/v1beta'
// GA Data API có hạn mức theo property; nhiều admin mở dashboard cùng lúc không được nhân số lần gọi
const CACHE_MS = 15_000
const TOP = 8

const b64url = (v) => Buffer.from(v).toString('base64url')

/** Đọc khoá service account: JSON thô, JSON base64, hoặc cặp email + private key (\n dạng chữ). */
export function parseServiceAccount(env) {
  const raw = env.GA_SERVICE_ACCOUNT_JSON
  if (raw) {
    try {
      const text = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
      const json = JSON.parse(text)
      if (json.client_email && json.private_key) return { clientEmail: json.client_email, privateKey: json.private_key }
    } catch {
      // khoá hỏng → coi như chưa cấu hình
    }
    return null
  }
  if (env.GA_CLIENT_EMAIL && env.GA_PRIVATE_KEY) {
    return { clientEmail: env.GA_CLIENT_EMAIL, privateKey: env.GA_PRIVATE_KEY.replace(/\\n/g, '\n') }
  }
  return null
}

/**
 * Báo cáo thời gian thực từ GA4 Data API (`runRealtimeReport`). Chỉ trả số liệu gộp, không có dữ
 * liệu cá nhân (NFR-PRV-002). Trả `null` khi thiếu cấu hình để route báo "chưa cấu hình".
 */
export function createGaRealtime({ propertyId, clientEmail, privateKey, fetchImpl = fetch, now = Date.now } = {}) {
  if (!/^\d+$/.test(propertyId ?? '') || !clientEmail || !privateKey) return null

  // Lỗi mạng cũng phải thành GaError để route trả 502 thay vì 500
  const call = (url, init) =>
    fetchImpl(url, init).catch(() => {
      throw new GaError('UPSTREAM')
    })

  let token = null
  let cached = null
  let inflight = null

  // Giữ cả promise: 5 báo cáo chạy song song, lần đầu không được đổi token 5 lần
  let pending = null
  function accessToken() {
    if (token && token.expiresAt - 60_000 > now()) return token.value
    pending ??= fetchToken().finally(() => {
      pending = null
    })
    return pending
  }

  async function fetchToken() {
    const iat = Math.floor(now() / 1000)
    const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
    const claim = b64url(JSON.stringify({ iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat, exp: iat + 3600 }))
    let sig
    try {
      sig = createSign('RSA-SHA256').update(`${head}.${claim}`).sign(privateKey, 'base64url')
    } catch {
      throw new GaError('AUTH') // khoá riêng hỏng
    }
    const res = await call(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claim}.${sig}` }),
    })
    if (!res.ok) throw new GaError(res.status === 400 || res.status === 401 ? 'AUTH' : 'UPSTREAM')
    const json = await res.json().catch(() => null)
    if (typeof json?.access_token !== 'string' || !json.access_token) throw new GaError('UPSTREAM')
    token = { value: json.access_token, expiresAt: now() + (json.expires_in ?? 3600) * 1000 }
    return token.value
  }

  async function report(body, endpoint = 'runRealtimeReport') {
    const res = await call(`${API}/properties/${propertyId}:${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${await accessToken()}` },
      body: JSON.stringify(body),
    })
    if (res.status === 401 || res.status === 403) {
      token = null
      throw new GaError('AUTH')
    }
    if (!res.ok) throw new GaError(res.status === 429 ? 'QUOTA' : 'UPSTREAM')
    return res.json().catch(() => {
      throw new GaError('UPSTREAM')
    })
  }

  // Chỉ nhận số hữu hạn không âm
  const toNum = (v) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? n : 0
  }

  const rows = (json, dims) =>
    (json.rows ?? []).map((r) => ({
      ...Object.fromEntries(dims.map((d, i) => [d, r.dimensionValues?.[i]?.value ?? ''])),
      value: toNum(r.metricValues?.[0]?.value),
    }))
  const top = (list) => list.sort((a, b) => b.value - a.value).slice(0, TOP)

  async function load() {
    const users = (dimension, limit = 50) => ({
      dimensions: [{ name: dimension }],
      metrics: [{ name: 'activeUsers' }],
      limit,
    })
    const [total, byMinute, pages, countries, devices] = await Promise.all([
      report({ metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }] }),
      report({ ...users('minutesAgo', 30), orderBys: [{ dimension: { dimensionName: 'minutesAgo' } }] }),
      report(users('unifiedScreenName')),
      report(users('country')),
      report(users('deviceCategory')),
    ])
    const t = total.rows?.[0]?.metricValues ?? []
    // minutesAgo "00" = phút hiện tại; điền 0 cho phút không có người để biểu đồ đủ 30 cột
    const perMinute = Array.from({ length: 30 }, (_, i) => ({ minutesAgo: i, users: 0 }))
    for (const r of rows(byMinute, ['minutesAgo'])) {
      const m = r.minutesAgo === '' ? NaN : Number(r.minutesAgo)
      if (Number.isInteger(m) && m >= 0 && m < 30) perMinute[m].users = r.value
    }
    return {
      configured: true,
      fetchedAt: new Date(now()).toISOString(),
      activeUsers: toNum(t[0]?.value),
      pageViews: toNum(t[1]?.value),
      perMinute,
      pages: top(rows(pages, ['name'])),
      countries: top(rows(countries, ['name'])),
      devices: top(rows(devices, ['name'])),
    }
  }

  // Báo cáo theo kỳ (GA4 `runReport`): phễu mua hàng từ các sự kiện GA §23.3, người dùng theo ngày, kênh vào.
  // Chỉ số gộp, không có dữ liệu cá nhân. Cache 60 giây theo số ngày để nhiều admin không nhân hạn mức.
  const FUNNEL = ['view_item', 'add_to_cart', 'begin_checkout', 'purchase']
  const periodCache = new Map()
  async function loadPeriod(days) {
    const dateRanges = [{ startDate: `${days}daysAgo`, endDate: 'today' }]
    const run = (body) => report({ dateRanges, ...body }, 'runReport')
    const [totals, byEvent, byDay, channels] = await Promise.all([
      run({ metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }] }),
      run({
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'totalUsers' }, { name: 'eventCount' }],
        dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: FUNNEL } } },
      }),
      run({ dimensions: [{ name: 'date' }], metrics: [{ name: 'activeUsers' }], orderBys: [{ dimension: { dimensionName: 'date' } }], limit: 120 }),
      run({ dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'sessions' }], limit: 20 }),
    ])
    const t = totals.rows?.[0]?.metricValues ?? []
    const ev = new Map((byEvent.rows ?? []).map((r) => [r.dimensionValues?.[0]?.value, { users: toNum(r.metricValues?.[0]?.value), events: toNum(r.metricValues?.[1]?.value) }]))
    return {
      configured: true,
      days,
      fetchedAt: new Date(now()).toISOString(),
      users: toNum(t[0]?.value),
      pageViews: toNum(t[1]?.value),
      sessions: toNum(t[2]?.value),
      funnel: FUNNEL.map((name) => ({ name, users: ev.get(name)?.users ?? 0, events: ev.get(name)?.events ?? 0 })),
      daily: rows(byDay, ['date']).map((r) => ({ date: r.date, users: r.value })),
      channels: top(rows(channels, ['name'])),
    }
  }

  return {
    async period(days) {
      const key = [7, 28, 90].includes(days) ? days : 7
      const hit = periodCache.get(key)
      if (hit && hit.at + 60_000 > now()) return hit.data
      const data = await loadPeriod(key)
      periodCache.set(key, { at: now(), data })
      return data
    },
    async snapshot() {
      if (cached && cached.at + CACHE_MS > now()) return cached.data
      // Gọi đồng thời dùng chung một lần tải; lỗi không được cache
      inflight ??= load()
        .then((data) => {
          cached = { at: now(), data }
          return data
        })
        .finally(() => {
          inflight = null
        })
      return inflight
    },
  }
}

export class GaError extends Error {
  constructor(code) {
    super(code)
    this.code = code
  }
}
