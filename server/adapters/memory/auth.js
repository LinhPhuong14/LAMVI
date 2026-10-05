import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { AuthError } from '../authErrors.js'

const hash = (pw, salt) => scryptSync(pw, salt, 32)
const token = () => randomBytes(24).toString('base64url')

// Auth bộ nhớ (T-04) — mô phỏng Supabase Auth cho dev/test
export function createMemoryAuth({ requireEmailConfirmation = false, accessTtlMs = 3600_000, now = () => Date.now() } = {}) {
  const users = new Map() // email → user
  const access = new Map() // token → { userId, expiresAt }
  const refresh = new Map() // token → userId
  const recovery = new Map() // token đặt lại mật khẩu (dùng một lần) → { userId, expiresAt }

  const issue = (user) => {
    const accessToken = token()
    const refreshToken = token()
    const expiresAt = now() + accessTtlMs
    access.set(accessToken, { userId: user.id, expiresAt })
    refresh.set(refreshToken, user.id)
    return { accessToken, refreshToken, expiresAt: Math.floor(expiresAt / 1000), user: { id: user.id, email: user.email } }
  }

  const byId = (id) => [...users.values()].find((u) => u.id === id)

  const revokeAll = (userId) => {
    for (const [t, v] of access) if (v.userId === userId) access.delete(t)
    for (const [t, id] of refresh) if (id === userId) refresh.delete(t)
  }

  return {
    async ping() {
      return true
    },

    async signUp({ email, password }) {
      if (users.has(email)) throw new AuthError('EMAIL_TAKEN')
      const salt = randomBytes(16)
      const user = { id: randomUUID(), email, salt, hash: hash(password, salt), confirmed: !requireEmailConfirmation }
      users.set(email, user)
            return { user: { id: user.id, email }, needsConfirmation: requireEmailConfirmation }
    },

    async deleteUser(id) {
      for (const [email, u] of users) if (u.id === id) users.delete(email)
    },

    // Chỉ dùng trong test: xác nhận email
    confirmEmail(email) {
      const u = users.get(email)
      if (u) u.confirmed = true
    },

    async signIn({ email, password }) {
      const u = users.get(email)
      if (!u || !timingSafeEqual(u.hash, hash(password, u.salt))) throw new AuthError('INVALID_CREDENTIALS')
      if (!u.confirmed) throw new AuthError('EMAIL_NOT_CONFIRMED')
      return issue(u)
    },

    // D-78: email đã được Google xác minh → tìm hoặc tạo user (không mật khẩu) rồi cấp phiên
    async signInVerifiedEmail(email) {
      let u = users.get(email)
      if (!u) {
        const salt = randomBytes(16)
        u = { id: randomUUID(), email, salt, hash: hash(randomBytes(24).toString('hex'), salt), confirmed: true }
        users.set(email, u)
      }
      return issue(u)
    },

    async refresh(refreshToken) {
      const userId = refresh.get(refreshToken)
      if (!userId) throw new AuthError('UNAUTHORIZED')
      refresh.delete(refreshToken) // xoay vòng refresh token như Supabase
      return issue(byId(userId))
    },

    async getUser(accessToken) {
      const s = access.get(accessToken)
      if (!s || s.expiresAt <= now()) return null
      const u = byId(s.userId)
      return u ? { id: u.id, email: u.email } : null
    },

    async signOut(accessToken) {
      const s = access.get(accessToken)
      if (!s) return
      revokeAll(s.userId)
    },

    // T-49: token đặt lại mật khẩu một lần, hạn 1 giờ; email không tồn tại → null (route không lộ)
    async createRecoveryToken(email) {
      const u = users.get(email)
      if (!u) return null
      const t = token()
      recovery.set(t, { userId: u.id, expiresAt: now() + 3600_000 })
      return t
    },

    // Đổi token lấy quyền đặt mật khẩu mới; thu hồi mọi phiên. Token chỉ dùng được một lần.
    async resetPassword({ token: t, password }) {
      const r = recovery.get(t)
      recovery.delete(t)
      const u = r && r.expiresAt > now() ? byId(r.userId) : null
      if (!u) throw new AuthError('INVALID_RESET_TOKEN')
      u.salt = randomBytes(16)
      u.hash = hash(password, u.salt)
      revokeAll(u.id)
      return { user: { id: u.id, email: u.email } }
    },

    async updatePassword(userId, password) {
      const u = byId(userId)
      if (!u) throw new AuthError('UNAUTHORIZED')
      u.salt = randomBytes(16)
      u.hash = hash(password, u.salt)
    },

    // G-18: đổi mật khẩu khi đang đăng nhập phải nhập lại mật khẩu hiện tại
    async verifyPassword(userId, password) {
      const u = byId(userId)
      if (!u) return false
      const attempt = hash(password, u.salt)
      return attempt.length === u.hash.length && timingSafeEqual(u.hash, attempt)
    },
  }
}
