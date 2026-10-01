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
  // Lỗi chưa map (vd not_admin khi sai SUPABASE_SECRET_KEY) là lỗi server: bỏ status 4xx gốc để
  // errorHandler trả 500 và ghi log, thay vì báo như lỗi của khách
  const wrapped = new Error(`Supabase Auth: ${code ?? error?.message ?? 'unknown'}`)
  wrapped.cause = error
  return wrapped
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

    // D-63: không xác nhận email — tạo user đã xác nhận bằng admin API, Supabase không gửi email
    // (không phụ thuộc cài đặt "Confirm email" trên dashboard hay hạn mức SMTP gói Free)
    async signUp({ email, password }) {
      const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
      if (error) throw mapError(error)
      return { user: { id: data.user.id, email: data.user.email }, needsConfirmation: false }
    },

    async signIn({ email, password }) {
      const { data, error } = await makePublicClient().auth.signInWithPassword({ email, password })
      if (error) throw mapError(error)
      return toSession(data.session, data.user)
    },

    // D-78: email đã được Google xác minh (OAuth trực tiếp, không qua provider Google của Supabase).
    // generateLink tạo user nếu chưa có và không gửi email; verifyOtp đổi token băm lấy phiên.
    async signInVerifiedEmail(email) {
      const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
      if (error) throw mapError(error)
      const { data, error: err2 } = await makePublicClient().auth.verifyOtp({
        token_hash: link.properties.hashed_token,
        type: 'magiclink',
      })
      if (err2) throw mapError(err2)
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
      // G-18: chỉ token đến từ link "Quên mật khẩu" mới được đổi mật khẩu mà không cần mật khẩu cũ.
      // Token đã được Supabase xác minh ở trên; ở đây chỉ đọc claim `amr` để biết cách đăng nhập.
      return { id: data.user.id, email: data.user.email, isRecovery: isRecoveryToken(accessToken) }
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

    /**
     * G-18: xác minh mật khẩu hiện tại bằng cách thử đăng nhập trên một client riêng (không đụng
     * tới phiên đang dùng). Trả false khi sai, ném lỗi khi Supabase trục trặc.
     */
    async verifyPassword(userId, password) {
      const { data, error } = await admin.auth.admin.getUserById(userId)
      if (error || !data?.user?.email) return false
      const client = makePublicClient()
      const res = await client.auth.signInWithPassword({ email: data.user.email, password })
      if (res.error) return false
      // Thu hồi ngay phiên vừa tạo. PHẢI dùng scope 'local': mặc định của Supabase là 'global',
      // tức là đăng xuất khách khỏi mọi thiết bị chỉ vì vừa xác minh mật khẩu — và nếu bước đổi
      // mật khẩu ngay sau đó thất bại thì khách mất phiên mà mật khẩu không đổi.
      await client.auth.signOut({ scope: 'local' }).catch(() => {})
      return true
    },
  }
}


/**
 * Đọc claim `amr` của access token Supabase để biết token đến từ luồng khôi phục mật khẩu.
 * KHÔNG dùng để xác thực — token đã được `admin.auth.getUser()` xác minh trước đó; ở đây chỉ
 * đọc phần payload đã được ký. Không đọc được → coi như không phải token khôi phục (an toàn hơn).
 */
export function isRecoveryToken(accessToken) {
  try {
    const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64url').toString('utf8'))
    const amr = Array.isArray(payload.amr) ? payload.amr : []
    return amr.some((m) => m?.method === 'recovery')
  } catch {
    return false
  }
}
