import { AuthError } from '../adapters/authErrors.js'

/**
 * G-19: khoá tài khoản. Bọc auth provider để khoá có hiệu lực ở MỌI nơi dùng phiên (getUser) và ở
 * các cửa cấp phiên (đăng nhập, refresh, Google) mà không phải sửa từng route. Khoá chỉ phụ thuộc
 * `profiles.locked_at`, nên chạy giống nhau với adapter bộ nhớ và Supabase.
 *
 * Phiên đang có bị chặn ngay ở request kế tiếp (getUser → null → 401), không phải chờ hết hạn token.
 */
export function withAccountLock(auth, repo) {
  const isLocked = async (userId) => Boolean((await repo.getProfile(userId))?.lockedAt)

  // Cấp phiên xong mới biết user là ai → kiểm khoá, nếu khoá thì thu hồi phiên vừa cấp
  const gate = (fn) => async (...args) => {
    const session = await fn(...args)
    if (session?.user?.id && (await isLocked(session.user.id))) {
      await auth.signOut(session.accessToken).catch(() => {})
      throw new AuthError('ACCOUNT_LOCKED')
    }
    return session
  }

  const wrapped = Object.create(auth)
  wrapped.signIn = gate((...a) => auth.signIn(...a))
  wrapped.refresh = gate((...a) => auth.refresh(...a))
  if (auth.signInVerifiedEmail) wrapped.signInVerifiedEmail = gate((...a) => auth.signInVerifiedEmail(...a))
  wrapped.getUser = async (accessToken) => {
    const user = await auth.getUser(accessToken)
    return user && (await isLocked(user.id)) ? null : user
  }
  return wrapped
}
