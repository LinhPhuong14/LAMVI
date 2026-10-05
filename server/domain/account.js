import { LOCALES } from '../i18n.js'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN, checkPassword } from '../../src/lib/password.js'

// D-42: đăng nhập bằng email + mật khẩu; SĐT chỉ lưu trong hồ sơ
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// SĐT di động VN: 0 hoặc +84, đầu số 3/5/7/8/9, 9 số sau (BR-SHP-002: chỉ trong nước)
const VN_PHONE_RE = /^(?:\+84|84|0)([35789]\d{8})$/

export { PASSWORD_MIN }
export const PASSWORD_MAX = PASSWORD_MAX_BYTES
export const NAME_MAX = 100

export function normalizeEmail(v) {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

// Trả về dạng chuẩn 0xxxxxxxxx hoặc null nếu không hợp lệ
export function normalizeVnPhone(v) {
  if (typeof v !== 'string') return null
  const m = v.replace(/[\s.-]/g, '').match(VN_PHONE_RE)
  return m ? `0${m[1]}` : null
}

export function validateEmail(email) {
  if (!email) return 'REQUIRED'
  if (email.length > 254 || !EMAIL_RE.test(email)) return 'INVALID_EMAIL'
  return null
}

/** Chính sách mật khẩu cơ bản (D-91) — nguồn duy nhất ở src/lib/password.js, dùng chung với giao diện. */
export function validatePassword(pw) {
  return checkPassword(pw)
}

// Kiểm tra các trường hồ sơ; partial=true cho PATCH (chỉ kiểm tra trường có gửi)
export function validateProfileInput(body, { partial = false } = {}) {
  const errors = {}
  const values = {}

  if (!partial || body.fullName !== undefined) {
    const name = typeof body.fullName === 'string' ? body.fullName.trim() : ''
    if (!name) errors.fullName = 'REQUIRED'
    else if (name.length > NAME_MAX) errors.fullName = 'TOO_LONG'
    else values.fullName = name
  }

  if (body.phone !== undefined && body.phone !== null && body.phone !== '') {
    const phone = normalizeVnPhone(body.phone)
    if (!phone) errors.phone = 'INVALID_PHONE'
    else values.phone = phone
  } else if (body.phone === '' || body.phone === null) {
    values.phone = null
  }

  if (body.preferredLocale !== undefined) {
    if (!LOCALES.includes(body.preferredLocale)) errors.preferredLocale = 'INVALID_LOCALE'
    else values.preferredLocale = body.preferredLocale
  }

  return { errors, values }
}

export function presentProfile(profile, user) {
  return {
    id: profile.id,
    email: user.email,
    fullName: profile.fullName,
    phone: profile.phone,
    preferredLocale: profile.preferredLocale,
    role: profile.role,
  }
}
