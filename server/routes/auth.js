import { Router } from 'express'
import { HttpError } from '../errors.js'
import { AuthError } from '../adapters/authErrors.js'
import { requireAuth } from '../middleware/auth.js'
import { byIpAndEmail, rateLimit } from '../middleware/rateLimit.js'
import { DEFAULT_HASH_SALT } from '../config.js'
import { COOKIE, authorizeUrl, exchangeCode, googleEnabled, newFlow, openState, readCookie, sealState } from '../google.js'
import { localePath, normalizeLang } from '../i18n.js'
import {
  normalizeEmail,
  presentProfile,
  validateEmail,
  validatePassword,
  validateProfileInput,
} from '../domain/account.js'

const STATUS = {
  EMAIL_TAKEN: 409,
  INVALID_CREDENTIALS: 401,
  EMAIL_NOT_CONFIRMED: 403,
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  PASSWORD_TOO_SHORT: 400,
  INVALID_EMAIL: 400,
}

const FIELD_ERRORS = { PASSWORD_TOO_SHORT: 'password', INVALID_EMAIL: 'email' }

// Chuyển AuthError của adapter sang HttpError; lỗi khác để errorHandler trả 500
async function call(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof AuthError && STATUS[err.code]) {
      const field = FIELD_ERRORS[err.code]
      if (field) throw new HttpError(400, 'VALIDATION_ERROR', err.code, { [field]: err.code })
      throw new HttpError(STATUS[err.code], err.code, err.code)
    }
    throw err
  }
}

function assertValid(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
}

const body = (req) => (req.body && typeof req.body === 'object' ? req.body : {})

// FR-ACC-001 (D-36, D-42): đăng ký, đăng nhập, đăng xuất, quên mật khẩu; hồ sơ tài khoản
export function authRouter({ repo, auth, config }) {
  const r = Router()
  const guard = requireAuth(auth)
  const siteUrl = (lang, path) => `${config.publicSiteUrl}${localePath(lang, path)}`

  // G-20: chống dò mật khẩu và spam. Ngưỡng ở config (loadConfig). Đếm theo cả IP và email để
  // một IP đổi email liên tục vẫn không dò được một tài khoản cụ thể.
  const rl = config.rateLimit ?? {}
  const limit = (thresholds, keys, { name } = {}) =>
    rateLimit({
      repo,
      salt: config.mayHashSalt ?? DEFAULT_HASH_SALT,
      name: name ?? thresholds,
      max: rl[thresholds]?.max ?? 10,
      windowSec: rl[thresholds]?.windowSec ?? 300,
      keys,
      enabled: rl.enabled !== false,
    })
  const loginLimit = limit('login', byIpAndEmail)
  const registerLimit = limit('register', byIpAndEmail)
  const forgotLimit = limit('forgot', byIpAndEmail)
  // Hai luồng đổi mật khẩu đếm riêng: dùng chung một bộ đếm thì người đặt lại mật khẩu bị chặn
  // vì người khác cùng IP vừa đổi mật khẩu.
  const resetLimit = limit('password', () => [], { name: 'reset' })
  const changeLimit = limit('password', () => [], { name: 'change' })

  r.post('/auth/register', registerLimit, async (req, res) => {
    const b = body(req)
    const email = normalizeEmail(b.email)
    const { errors, values } = validateProfileInput({
      ...b,
      preferredLocale: b.preferredLocale ?? normalizeLang(req.query.lang),
    })
    const emailErr = validateEmail(email)
    const pwErr = validatePassword(b.password)
    if (emailErr) errors.email = emailErr
    if (pwErr) errors.password = pwErr
    assertValid(errors)

    const lang = values.preferredLocale
    const result = await call(() =>
      auth.signUp({ email, password: b.password, redirectTo: siteUrl(lang, '/login') }),
    )
    // Phòng hờ adapter trả lại user đã có — không ghi đè hồ sơ của chủ email
    const existing = await repo.getProfile(result.user.id)
    if (!existing) await repo.upsertProfile({
      id: result.user.id,
      fullName: values.fullName,
      phone: values.phone ?? null,
      preferredLocale: lang,
    })
    res.status(201).json({ user: result.user, needsConfirmation: result.needsConfirmation })
  })

  r.post('/auth/login', loginLimit, async (req, res) => {
    const b = body(req)
    const email = normalizeEmail(b.email)
    if (validateEmail(email) || typeof b.password !== 'string' || !b.password) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Sai email hoặc mật khẩu')
    }
    res.json(await call(() => auth.signIn({ email, password: b.password })))
  })

  // D-78: đăng nhập Google. Nút chỉ hiện khi có GOOGLE_CLIENT_ID/SECRET.
  r.get('/auth/providers', (req, res) => res.json({ google: googleEnabled(config) }))

  const secret = config.mayHashSalt ?? DEFAULT_HASH_SALT
  const googleLimit = limit('login', undefined, { name: 'google' })
  const cookieAttrs = `Path=/api/auth/google; HttpOnly; SameSite=Lax${config.publicSiteUrl.startsWith('https:') ? '; Secure' : ''}`
  const loginUrl = (lang, query = '') => siteUrl(lang, `/login${query}`)

  r.get('/auth/google/start', googleLimit, (req, res) => {
    const lang = normalizeLang(req.query.lang)
    if (!googleEnabled(config)) return res.redirect(302, loginUrl(lang, '?error=GOOGLE_UNAVAILABLE'))
    const next = typeof req.query.next === 'string' && /^\/(?!\/)/.test(req.query.next) ? req.query.next : null
    const flow = newFlow({ next, lang })
    res.setHeader('Set-Cookie', `${COOKIE}=${sealState(flow, secret)}; Max-Age=600; ${cookieAttrs}`)
    res.redirect(302, authorizeUrl(config, flow))
  })

  r.get('/auth/google/callback', googleLimit, async (req, res) => {
    const flow = openState(readCookie(req, COOKIE), secret)
    res.setHeader('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieAttrs}`)
    const lang = flow?.lang ?? normalizeLang(req.query.lang)
    const fail = (code) => res.redirect(302, loginUrl(lang, `?error=${code}`))
    if (!flow || !googleEnabled(config) || req.query.state !== flow.state) return fail('GOOGLE_FAILED')
    if (req.query.error || typeof req.query.code !== 'string') return fail('GOOGLE_CANCELLED')
    try {
      const g = await exchangeCode(config, req.query.code, flow)
      const email = normalizeEmail(g.email)
      const session = await call(() => auth.signInVerifiedEmail(email))
      if (!(await repo.getProfile(session.user.id))) {
        await repo.upsertProfile({ id: session.user.id, fullName: g.name, preferredLocale: lang })
      }
      // Phiên đi trong fragment (không gửi lên server, không vào log); trang /auth/callback lưu rồi chuyển hướng
      const payload = Buffer.from(JSON.stringify({ session, next: flow.next })).toString('base64url')
      res.redirect(302, siteUrl(lang, '/auth/callback') + `#s=${payload}`)
    } catch (err) {
      console.error('[auth] google', err.message)
      fail('GOOGLE_FAILED')
    }
  })

  r.post('/auth/refresh', async (req, res) => {
    const { refreshToken } = body(req)
    if (typeof refreshToken !== 'string' || !refreshToken) throw new HttpError(401, 'UNAUTHORIZED')
    res.json(await call(() => auth.refresh(refreshToken)))
  })

  r.post('/auth/logout', guard, async (req, res) => {
    await call(() => auth.signOut(req.accessToken))
    res.status(204).end()
  })

  // Luôn trả 202 để không tiết lộ email có tồn tại hay không
  r.post('/auth/forgot-password', forgotLimit, async (req, res) => {
    const email = normalizeEmail(body(req).email)
    const emailErr = validateEmail(email)
    if (emailErr) assertValid({ email: emailErr })
    const lang = normalizeLang(req.query.lang)
    await call(() => auth.sendPasswordReset(email, siteUrl(lang, '/reset-password')))
    res.status(202).json({ ok: true })
  })

  // Token khôi phục (từ link email) gửi qua Authorization: Bearer.
  // G-18: CHỈ nhận token khôi phục. Trước đây mọi access token hợp lệ đều đổi được mật khẩu, nên
  // một phiên đang mở (máy dùng chung, token bị lấy cắp) đổi được mật khẩu mà không cần biết mật
  // khẩu cũ. Muốn đổi mật khẩu khi đang đăng nhập thì dùng /auth/change-password.
  r.post('/auth/reset-password', guard, resetLimit, async (req, res) => {
    if (!req.user.isRecovery) {
      throw new HttpError(403, 'RECOVERY_TOKEN_REQUIRED', 'Cần mở lại link đặt lại mật khẩu trong email')
    }
    const pwErr = validatePassword(body(req).password)
    if (pwErr) assertValid({ password: pwErr })
    await call(() => auth.updatePassword(req.user.id, body(req).password))
    await call(() => auth.signOut(req.accessToken))
    res.status(204).end()
  })

  // G-18: đổi mật khẩu khi đang đăng nhập — bắt buộc nhập lại mật khẩu hiện tại
  r.post('/auth/change-password', guard, changeLimit, async (req, res) => {
    const b = body(req)
    const pwErr = validatePassword(b.password)
    if (pwErr) assertValid({ password: pwErr })
    if (typeof b.currentPassword !== 'string' || !b.currentPassword) {
      assertValid({ currentPassword: 'REQUIRED' })
    }
    const ok = await call(() => auth.verifyPassword(req.user.id, b.currentPassword))
    if (!ok) assertValid({ currentPassword: 'INVALID_CREDENTIALS' })
    await call(() => auth.updatePassword(req.user.id, b.password))
    // Đổi mật khẩu thu hồi mọi phiên (kể cả phiên hiện tại) — khách đăng nhập lại bằng mật khẩu mới
    await call(() => auth.signOut(req.accessToken))
    res.status(204).end()
  })

  r.get('/me', guard, async (req, res) => {
    let profile = await repo.getProfile(req.user.id)
    // Tài khoản tạo ngoài API (vd Supabase dashboard) chưa có hồ sơ
    if (!profile) profile = await repo.upsertProfile({ id: req.user.id })
    res.json({ profile: presentProfile(profile, req.user) })
  })

  r.patch('/me', guard, async (req, res) => {
    const { errors, values } = validateProfileInput(body(req), { partial: true })
    assertValid(errors)
    // Không cho đổi role/email qua API này
    const profile = await repo.upsertProfile({ id: req.user.id, ...values })
    res.json({ profile: presentProfile(profile, req.user) })
  })

  return r
}
