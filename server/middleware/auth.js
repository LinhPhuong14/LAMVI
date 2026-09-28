import { HttpError } from '../errors.js'

export const unauthorized = () => new HttpError(401, 'UNAUTHORIZED', 'Chưa đăng nhập')

export function bearerToken(req) {
  const h = req.get('authorization') || ''
  const m = h.match(/^Bearer\s+(\S+)$/i)
  return m ? m[1] : null
}

// Gắn req.user từ access token; không hợp lệ → 401
export function requireAuth(auth) {
  return async (req, res, next) => {
    const token = bearerToken(req)
    const user = token ? await auth.getUser(token) : null
    if (!user) throw unauthorized()
    req.user = user
    req.accessToken = token
    next()
  }
}

// Vai trò đọc từ hồ sơ ở server mỗi request, không tin client
export function requireRole(auth, repo, roles) {
  const authed = requireAuth(auth)
  return async (req, res, next) => {
    await authed(req, res, () => {})
    const profile = await repo.getProfile(req.user.id)
    if (!roles.includes(profile?.role)) throw new HttpError(403, 'FORBIDDEN', 'Không có quyền')
    req.role = profile.role
    next()
  }
}

// D-38, D-51: /admin cho admin và IT (IT có cả quyền admin)
export const ADMIN_ROLES = ['admin', 'it']
// D-51: dashboard IT chỉ cho IT
export const IT_ROLES = ['it']

export const requireAdmin = (auth, repo) => requireRole(auth, repo, ADMIN_ROLES)
export const requireIt = (auth, repo) => requireRole(auth, repo, IT_ROLES)
