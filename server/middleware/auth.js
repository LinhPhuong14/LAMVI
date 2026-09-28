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
