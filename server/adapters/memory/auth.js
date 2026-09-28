import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto'
import { AuthError } from '../authErrors.js'

const hash = (pw, salt) => scryptSync(pw, salt, 32)
const token = () => randomBytes(24).toString('base64url')

// Auth bộ nhớ (T-04) — mô phỏng Supabase Auth cho dev/test
export function createMemoryAuth({ requireEmailConfirmation = false, accessTtlMs = 3600_000, now = () => Date.now() } = {}) {
  const users = new Map() // email → user
  const access = new Map() // token → { userId, expiresAt }
  const refresh = new Map() // token → userId
  const outbox = [] // email đã "gửi" (để test)

  const issue = (user) => {
    const accessToken = token()
    const refreshToken = token()
    const expiresAt = now() + accessTtlMs
    access.set(accessToken, { userId: user.id, expiresAt })
    refresh.set(refreshToken, user.id)
    return { accessToken, refreshToken, expiresAt: Math.floor(expiresAt / 1000), user: { id: user.id, email: user.email } }
  }

  const byId = (id) => [...users.values()].find((u) => u.id === id)

  return {
    outbox,

    async ping() {
      return true
    },

    async signUp({ email, password, redirectTo }) {
      if (users.has(email)) throw new AuthError('EMAIL_TAKEN')
      const salt = randomBytes(16)
      const user = { id: randomUUID(), email, salt, hash: hash(password, salt), confirmed: !requireEmailConfirmation }
      users.set(email, user)
      if (requireEmailConfirmation) outbox.push({ type: 'confirm', email, redirectTo })
      return { user: { id: user.id, email }, needsConfirmation: requireEmailConfirmation }
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
      for (const [t, v] of access) if (v.userId === s.userId) access.delete(t)
      for (const [t, id] of refresh) if (id === s.userId) refresh.delete(t)
    },

    async sendPasswordReset(email, redirectTo) {
      const u = users.get(email)
      if (!u) return // không tiết lộ email có tồn tại hay không
      const recovery = issue(u)
      outbox.push({ type: 'recovery', email, redirectTo, accessToken: recovery.accessToken })
    },

    async updatePassword(userId, password) {
      const u = byId(userId)
      if (!u) throw new AuthError('UNAUTHORIZED')
      u.salt = randomBytes(16)
      u.hash = hash(password, u.salt)
    },
  }
}
