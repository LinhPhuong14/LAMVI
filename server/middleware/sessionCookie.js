import { HttpError } from '../errors.js'
import { readCookie } from '../google.js'

// T-49 (thay T-10, G-17): refresh token chỉ nằm trong cookie HttpOnly — JavaScript của trang (kể
// cả khi có XSS) không đọc được nên không lấy cắp được phiên dài hạn. Trình duyệt giữ access token
// ngắn hạn (≤1 giờ). Path hẹp để cookie không bị gửi kèm mọi request API.
export const REFRESH_COOKIE = 'lamvi_rt'
const PATH = '/api/auth'
const MAX_AGE_SEC = 30 * 24 * 3600

const attrs = (config) => `Path=${PATH}; HttpOnly; SameSite=Lax${config.publicSiteUrl?.startsWith('https:') ? '; Secure' : ''}`

export function setRefreshCookie(res, config, refreshToken) {
  res.append('Set-Cookie', `${REFRESH_COOKIE}=${encodeURIComponent(refreshToken)}; Max-Age=${MAX_AGE_SEC}; ${attrs(config)}`)
}

export function clearRefreshCookie(res, config) {
  res.append('Set-Cookie', `${REFRESH_COOKIE}=; Max-Age=0; ${attrs(config)}`)
}

export const readRefreshCookie = (req) => readCookie(req, REFRESH_COOKIE)

/** Cấp cookie và trả phần phiên được phép đưa cho JavaScript (không có refreshToken). */
export function issueSession(res, config, session) {
  setRefreshCookie(res, config, session.refreshToken)
  const publicSession = { ...session }
  delete publicSession.refreshToken
  return publicSession
}

/**
 * Chống CSRF cho endpoint dùng cookie (refresh, logout). SameSite=Lax đã chặn cookie trong POST
 * chéo site; kiểm tra thêm Origin là lớp thứ hai. Cùng host với request (chạy được ở domain Preview)
 * hoặc đúng PUBLIC_SITE_URL thì cho qua; không có Origin (curl, server-to-server) thì dựa vào
 * Sec-Fetch-Site nếu có.
 */
export function sameOriginOnly(config) {
  const site = (() => {
    try {
      return new URL(config.publicSiteUrl).origin
    } catch {
      return null
    }
  })()
  return (req, res, next) => {
    const origin = req.get('origin')
    if (origin) {
      let host = null
      try {
        host = new URL(origin).host
      } catch {
        // Origin hỏng → từ chối bên dưới
      }
      if (origin !== site && !(host && host === req.get('host'))) throw new HttpError(403, 'FORBIDDEN', 'Origin không hợp lệ')
    } else if (req.get('sec-fetch-site') === 'cross-site') {
      throw new HttpError(403, 'FORBIDDEN', 'Origin không hợp lệ')
    }
    next()
  }
}
