import { Router } from 'express'
import { HttpError } from '../errors.js'
import { AuthError } from '../adapters/authErrors.js'
import { bearerToken, requireAuth } from '../middleware/auth.js'
import { clearRefreshCookie, issueSession, readRefreshCookie, sameOriginOnly, setRefreshCookie } from '../middleware/sessionCookie.js'
import { passwordChangedMail, recoveryMail } from '../mail/templates.js'
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
  ACCOUNT_LOCKED: 403, // G-19
  UNAUTHORIZED: 401,
  RATE_LIMITED: 429,
  PASSWORD_TOO_SHORT: 400,
  INVALID_EMAIL: 400,
  INVALID_RESET_TOKEN: 400,
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
export function authRouter({ repo, auth, config, mailer = null, pwned = null }) {
  const r = Router()
  const guard = requireAuth(auth)
  const siteUrl = (lang, path) => `${config.publicSiteUrl}${localePath(lang, path)}`
  const sameOrigin = sameOriginOnly(config)

  // T-49: thư giao dịch là việc phụ — lỗi gửi chỉ ghi log, không làm hỏng thao tác chính và không
  // để lộ email có tài khoản hay không
  async function notify(to, mail) {
    if (!mailer) {
      console.warn('[mail] Chưa cấu hình MAIL_FROM + RESEND_API_KEY/BREVO_API_KEY — không gửi được thư')
      return false
    }
    try {
      await mailer.send({ to, ...mail })
      return true
    } catch (err) {
      console.error('[mail]', err.message)
      return false
    }
  }

  // NFR-AUD-001: sự kiện bảo mật của tài khoản (không lưu mật khẩu/token)
  async function audit(userId, action) {
    try {
      await repo.appendAuditLog?.([{ actorId: userId, actorRole: 'user', entity: 'account', entityId: userId, action }])
    } catch (err) {
      console.error('[auth] audit', err.message)
    }
  }

  // Mật khẩu hợp lệ về độ dài và chưa lộ trong rò rỉ công khai (T-49). Kiểm tra TRƯỚC khi tiêu
  // thụ token đặt lại để mật khẩu yếu không làm cháy link.
  async function assertPasswordAcceptable(password) {
    const err = validatePassword(password)
    if (err) assertValid({ password: err })
    if (pwned && (await pwned(password))) assertValid({ password: 'PASSWORD_BREACHED' })
  }

  // D-91: ô "nhập lại mật khẩu mới". Giao diện luôn gửi; không gửi (API cũ/tích hợp khác) thì bỏ qua,
  // gửi mà không khớp thì từ chối trước khi tiêu thụ token đặt lại.
  function assertConfirmed(b) {
    if (b.confirmPassword !== undefined && b.confirmPassword !== b.password) assertValid({ confirmPassword: 'PASSWORD_MISMATCH' })
  }

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
  // vì người khác cùng IP vừa đổi mật khẩu. Đổi mật khẩu đếm theo tài khoản (kể cả khi access token
  // bị lấy cắp, kẻ gian không dò được mật khẩu hiện tại bằng cách thử liên tục).
  const resetLimit = limit('password', undefined, { name: 'reset' })
  const changeLimit = limit('password', (req) => [`u:${req.user.id}`], { name: 'change' })
  const refreshLimit = limit('refresh', undefined, { name: 'refresh' })

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
    assertConfirmed(b)
    await assertPasswordAcceptable(b.password)

    const lang = values.preferredLocale
    const result = await call(() => auth.signUp({ email, password: b.password }))
    // Phòng hờ adapter trả lại user đã có — không ghi đè hồ sơ của chủ email
    try {
      const existing = await repo.getProfile(result.user.id)
      if (!existing) await repo.upsertProfile({
        id: result.user.id,
        fullName: values.fullName,
        phone: values.phone ?? null,
        preferredLocale: lang,
        email,
      })
    } catch (err) {
      // G-38: ghi hồ sơ lỗi thì gỡ user vừa tạo, để khách đăng ký lại được thay vì kẹt "email đã có"
      await Promise.resolve(auth.deleteUser?.(result.user.id)).catch((e) => console.error('[signup] rollback', e?.message ?? e))
      throw err
    }
    res.status(201).json({ user: result.user, needsConfirmation: result.needsConfirmation })
  })

  r.post('/auth/login', loginLimit, async (req, res) => {
    const b = body(req)
    const email = normalizeEmail(b.email)
    if (validateEmail(email) || typeof b.password !== 'string' || !b.password) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Sai email hoặc mật khẩu')
    }
    res.json(issueSession(res, config, await call(() => auth.signIn({ email, password: b.password }))))
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
    const next = typeof req.query.next === 'string' && /^\/(?![/\\])[^\t\r\n]*$/.test(req.query.next) ? req.query.next : null
    const flow = newFlow({ next, lang })
    res.append('Set-Cookie', `${COOKIE}=${sealState(flow, secret)}; Max-Age=600; ${cookieAttrs}`)
    res.redirect(302, authorizeUrl(config, flow))
  })

  r.get('/auth/google/callback', googleLimit, async (req, res) => {
    const flow = openState(readCookie(req, COOKIE), secret)
    res.append('Set-Cookie', `${COOKIE}=; Max-Age=0; ${cookieAttrs}`)
    const lang = flow?.lang ?? normalizeLang(req.query.lang)
    const fail = (code) => res.redirect(302, loginUrl(lang, `?error=${code}`))
    if (!flow || !googleEnabled(config) || req.query.state !== flow.state) return fail('GOOGLE_FAILED')
    if (req.query.error || typeof req.query.code !== 'string') return fail('GOOGLE_CANCELLED')
    try {
      const g = await exchangeCode(config, req.query.code, flow)
      const email = normalizeEmail(g.email)
      const session = await call(() => auth.signInVerifiedEmail(email))
      if (!(await repo.getProfile(session.user.id))) {
        await repo.upsertProfile({ id: session.user.id, fullName: g.name, preferredLocale: lang, email })
      }
      // T-49: không đưa token lên URL. Refresh token nằm trong cookie HttpOnly; trang /auth/callback
      // gọi /auth/refresh để lấy access token. `next` đã được kiểm là đường dẫn nội bộ ở /start.
      setRefreshCookie(res, config, session.refreshToken)
      res.redirect(302, siteUrl(lang, '/auth/callback') + (flow.next ? `?next=${encodeURIComponent(flow.next)}` : ''))
    } catch (err) {
      console.error('[auth] google', err.message)
      fail('GOOGLE_FAILED')
    }
  })

  // T-49: refresh token chỉ đọc từ cookie HttpOnly; trả access token mới và xoay vòng cookie
  r.post('/auth/refresh', sameOrigin, refreshLimit, async (req, res) => {
    const refreshToken = readRefreshCookie(req)
    if (!refreshToken) throw new HttpError(401, 'UNAUTHORIZED')
    try {
      res.json(issueSession(res, config, await call(() => auth.refresh(refreshToken))))
    } catch (err) {
      // Refresh token bị từ chối → xoá cookie hỏng; lỗi mạng/5xx giữ nguyên để thử lại
      if (err.status === 401) clearRefreshCookie(res, config)
      throw err
    }
  })

  // Đăng xuất luôn xoá cookie, kể cả khi access token đã hết hạn (khi đó đổi cookie lấy token để thu hồi)
  r.post('/auth/logout', sameOrigin, async (req, res) => {
    clearRefreshCookie(res, config)
    let token = bearerToken(req)
    if (!token || !(await auth.getUser(token).catch(() => null))) {
      const refreshToken = readRefreshCookie(req)
      token = null
      if (refreshToken) token = (await auth.refresh(refreshToken).catch(() => null))?.accessToken ?? null
    }
    if (token) await call(() => auth.signOut(token))
    res.status(204).end()
  })

  // D-92: email CHƯA từng đăng ký thì không được "quên mật khẩu" — báo rõ 404 EMAIL_NOT_REGISTERED để khách
  // biết đăng ký thay vì chờ một lá thư không bao giờ tới. Đánh đổi có chủ ý: ai cũng dò được email có tài
  // khoản hay không (G-65); giảm nhẹ bằng giới hạn tốc độ theo cả IP và email (G-20).
  // Lỗi từ nhà cung cấp (Supabase/thư) vẫn trả 202 và chỉ ghi log — lỗi hạ tầng không phải lỗi của khách.
  r.post('/auth/forgot-password', forgotLimit, async (req, res) => {
    const email = normalizeEmail(body(req).email)
    const emailErr = validateEmail(email)
    if (emailErr) assertValid({ email: emailErr })
    const lang = normalizeLang(req.query.lang)
    let token = null
    try {
      token = await auth.createRecoveryToken(email)
    } catch (err) {
      console.error('[auth] createRecoveryToken', err.code ?? err.message)
      return res.status(202).json({ ok: true })
    }
    if (!token) throw new HttpError(404, 'EMAIL_NOT_REGISTERED', 'Email này chưa đăng ký tài khoản')
    const url = `${siteUrl(lang, '/reset-password')}#t=${encodeURIComponent(token)}`
    await notify(email, recoveryMail({ lang, url, siteUrl: config.publicSiteUrl }))
    res.status(202).json({ ok: true })
  })

  async function afterPasswordChange(user, res) {
    clearRefreshCookie(res, config)
    await audit(user.id, 'password_changed')
    const profile = await repo.getProfile(user.id).catch(() => null)
    await notify(user.email, passwordChangedMail({ lang: profile?.preferredLocale, siteUrl: config.publicSiteUrl }))
  }

  // Token một lần từ link trong thư (#t=…) thay cho phiên khôi phục của Supabase. Mọi phiên bị
  // thu hồi; khách đăng nhập lại bằng mật khẩu mới.
  r.post('/auth/reset-password', resetLimit, async (req, res) => {
    const b = body(req)
    if (typeof b.token !== 'string' || !b.token) throw new HttpError(400, 'INVALID_RESET_TOKEN', 'Link đặt lại mật khẩu không hợp lệ')
    assertConfirmed(b)
    await assertPasswordAcceptable(b.password)
    const { user } = await call(() => auth.resetPassword({ token: b.token, password: b.password }))
    await afterPasswordChange(user, res)
    res.status(204).end()
  })

  // G-18: đổi mật khẩu khi đang đăng nhập — bắt buộc nhập lại mật khẩu hiện tại
  r.post('/auth/change-password', guard, changeLimit, async (req, res) => {
    const b = body(req)
    assertConfirmed(b)
    await assertPasswordAcceptable(b.password)
    if (typeof b.currentPassword !== 'string' || !b.currentPassword) {
      assertValid({ currentPassword: 'REQUIRED' })
    }
    const ok = await call(() => auth.verifyPassword(req.user.id, b.currentPassword))
    if (!ok) assertValid({ currentPassword: 'INVALID_CREDENTIALS' })
    await call(() => auth.updatePassword(req.user.id, b.password))
    // Đổi mật khẩu thu hồi mọi phiên (kể cả phiên hiện tại) — khách đăng nhập lại bằng mật khẩu mới
    await call(() => auth.signOut(req.accessToken))
    await afterPasswordChange(req.user, res)
    res.status(204).end()
  })

  r.get('/me', guard, async (req, res) => {
    let profile = await repo.getProfile(req.user.id)
    // Tài khoản tạo ngoài API (vd Supabase dashboard) chưa có hồ sơ
    if (!profile) profile = await repo.upsertProfile({ id: req.user.id, email: req.user.email })
    // Hồ sơ cũ chưa có email (admin tìm người dùng theo email) → bổ sung
    else if (!profile.email && req.user.email) profile = await repo.upsertProfile({ id: req.user.id, email: req.user.email })
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
