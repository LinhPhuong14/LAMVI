import { AuthError } from '../authErrors.js'

// Bọc Supabase Auth (T-03, T-05). makePublicClient tạo client anon mới cho mỗi lần gọi
// để không dùng chung trạng thái phiên giữa các request.
function mapError(error) {
  const code = error?.code
  if (error?.status === 429 || code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit') {
    return new AuthError('RATE_LIMITED')
  }
  if (code === 'user_already_exists' || code === 'email_exists') return new AuthError('EMAIL_TAKEN')
  if (code === 'invalid_credentials') return new AuthError('INVALID_CREDENTIALS')
  if (code === 'email_not_confirmed') return new AuthError('EMAIL_NOT_CONFIRMED')
  if (code === 'weak_password') return new AuthError('PASSWORD_TOO_SHORT')
  if (code === 'email_address_invalid') return new AuthError('INVALID_EMAIL')
  if (code === 'refresh_token_not_found' || code === 'refresh_token_already_used' || code === 'session_not_found') {
    return new AuthError('UNAUTHORIZED')
  }
  return error
}

const toSession = (session, user) => ({
  accessToken: session.access_token,
  refreshToken: session.refresh_token,
  expiresAt: session.expires_at,
  user: { id: user.id, email: user.email },
})

export function createSupabaseAuth({ admin, makePublicClient }) {
  return {
    // Kiểm tra kết nối Auth (dashboard IT)
    async ping() {
      const { error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
      if (error) throw error
    },

    async signUp({ email, password, redirectTo }) {
      const { data, error } = await makePublicClient().auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      })
      if (error) throw mapError(error)
      // Khi bật xác nhận email, Supabase trả user không có identity nếu email đã tồn tại
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        throw new AuthError('EMAIL_TAKEN')
      }
      return { user: { id: data.user.id, email: data.user.email }, needsConfirmation: !data.session }
    },

    async signIn({ email, password }) {
      const { data, error } = await makePublicClient().auth.signInWithPassword({ email, password })
      if (error) throw mapError(error)
      return toSession(data.session, data.user)
    },

    async refresh(refreshToken) {
      const { data, error } = await makePublicClient().auth.refreshSession({ refresh_token: refreshToken })
      if (error) throw mapError(error)
      if (!data.session) throw new AuthError('UNAUTHORIZED')
      return toSession(data.session, data.user)
    },

    async getUser(accessToken) {
      const { data, error } = await admin.auth.getUser(accessToken)
      if (error || !data?.user) return null
      return { id: data.user.id, email: data.user.email }
    },

    async signOut(accessToken) {
      // 'global': thu hồi mọi phiên của tài khoản (khớp adapter bộ nhớ; cần sau khi đặt lại mật khẩu)
      const { error } = await admin.auth.admin.signOut(accessToken, 'global')
      if (error && error.status !== 401 && error.status !== 404) throw mapError(error)
    },

    async sendPasswordReset(email, redirectTo) {
      const { error } = await makePublicClient().auth.resetPasswordForEmail(email, { redirectTo })
      // Không ném lỗi nào (kể cả 429 theo từng user của Supabase) — nếu không, gửi hai lần
      // liên tiếp sẽ dò được email có tồn tại hay không
      if (error) console.error('[auth] resetPasswordForEmail', error.code ?? error.message)
    },

    async updatePassword(userId, password) {
      const { error } = await admin.auth.admin.updateUserById(userId, { password })
      if (error) throw mapError(error)
    },
  }
}
