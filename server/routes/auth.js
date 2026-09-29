import { Router } from 'express'
import { HttpError } from '../errors.js'
import { AuthError } from '../adapters/authErrors.js'
import { requireAuth } from '../middleware/auth.js'
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

  r.post('/auth/register', async (req, res) => {
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

  r.post('/auth/login', async (req, res) => {
    const b = body(req)
    const email = normalizeEmail(b.email)
    if (validateEmail(email) || typeof b.password !== 'string' || !b.password) {
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Sai email hoặc mật khẩu')
    }
    res.json(await call(() => auth.signIn({ email, password: b.password })))
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
  r.post('/auth/forgot-password', async (req, res) => {
    const email = normalizeEmail(body(req).email)
    const emailErr = validateEmail(email)
    if (emailErr) assertValid({ email: emailErr })
    const lang = normalizeLang(req.query.lang)
    await call(() => auth.sendPasswordReset(email, siteUrl(lang, '/reset-password')))
    res.status(202).json({ ok: true })
  })

  // Token khôi phục (từ link email) gửi qua Authorization: Bearer
  r.post('/auth/reset-password', guard, async (req, res) => {
    const pwErr = validatePassword(body(req).password)
    if (pwErr) assertValid({ password: pwErr })
    await call(() => auth.updatePassword(req.user.id, body(req).password))
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
