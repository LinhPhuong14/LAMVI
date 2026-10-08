import { createHash } from 'node:crypto'
import { GTAG_ORIGIN } from '../../src/analytics/ga.js'

/** Hash CSP của một đoạn script nội tuyến (đúng nội dung giữa <script> và </script>). */
export const cspHash = (source) => `sha256-${createHash('sha256').update(source, 'utf8').digest('base64')}`

// T-37: HTTP security headers cho môi trường thật. Đặt trước mọi router để áp cho cả API và web.
//
// CSP cho script nội tuyến do SSR sinh (__INITIAL_DATA__, gtag) dùng **hash**, không dùng nonce:
// trang công khai được CDN giữ và phục vụ cho nhiều người (s-maxage, xem deploy-vercel.md quy tắc 9),
// mà nonce dùng lại cho nhiều người thì mất hết tác dụng — chỉ mạnh khi mỗi người một giá trị mới.
// Hash thì công khai theo thiết kế và luôn khớp đúng nội dung được cache.
// Ở chế độ dev, Vite chèn script nội tuyến riêng (HMR/react-refresh) nên CSP chỉ bật khi không phải dev.

const GA_COLLECT = 'https://www.google-analytics.com'
const GA_REGION_COLLECT = 'https://*.analytics.google.com'

/** Lấy origin của Supabase từ URL project để mở đúng một host, không mở '*'. */
function supabaseOrigin(url) {
  if (!url) return null
  try {
    return new URL(url).origin
  } catch {
    return null
  }
}

/**
 * @param {object} p
 * @param {string[]} [p.inlineScriptHashes] hash CSP của script nội tuyến trên chính response này
 */
export function buildCsp({ supabaseUrl, gaEnabled, inlineScriptHashes = [] }) {
  const supa = supabaseOrigin(supabaseUrl)
  const script = ["'self'", ...inlineScriptHashes.map((h) => `'${h}'`)]
  const connect = ["'self'"]
  const img = ["'self'", 'data:', 'blob:']
  const media = ["'self'", 'blob:']

  if (gaEnabled) {
    script.push(GTAG_ORIGIN)
    connect.push(GA_COLLECT, GA_REGION_COLLECT, GTAG_ORIGIN)
    img.push(GA_COLLECT, GTAG_ORIGIN)
  }
  if (supa) {
    // Video lô + ảnh sản phẩm ở Supabase Storage; tải lên bằng signed URL từ trang admin
    connect.push(supa)
    img.push(supa)
    media.push(supa)
  }

  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    // React/framer-motion đặt style nội tuyến trên phần tử → bắt buộc 'unsafe-inline' cho style
    "style-src 'self' 'unsafe-inline'",
    `img-src ${img.join(' ')}`,
    `media-src ${media.join(' ')}`,
    "font-src 'self'",
    `connect-src ${connect.join(' ')}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * @param {object} p
 * @param {object} p.config loadConfig()
 * @param {boolean} [p.dev] chế độ dev (Vite) → không đặt CSP và HSTS
 */
export function securityHeaders({ config, dev = false }) {
  const gaEnabled = Boolean(config.gaMeasurementId)
  const supabaseUrl = config.supabase?.url ?? null

  return function securityHeadersMiddleware(req, res, next) {
    res.set('X-Content-Type-Options', 'nosniff')
    res.set('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.set('X-Frame-Options', 'DENY')
    // Không dùng các API này ở đâu cả — tắt hẳn để giảm bề mặt tấn công
    res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
    res.set('Cross-Origin-Opener-Policy', 'same-origin')
    res.set('Cross-Origin-Resource-Policy', 'same-origin')

    if (!dev) {
      // Chỉ gửi HSTS khi request thật sự qua HTTPS (sau proxy: X-Forwarded-Proto)
      if (req.secure || req.get('x-forwarded-proto') === 'https') {
        res.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
      }
      // Mặc định: không cho phép script nội tuyến nào. Trang HTML do SSR dựng sẽ đặt lại header
      // này kèm hash của đúng các script nội tuyến của nó (res.locals.setCsp).
      res.locals.setCsp = (inlineScriptHashes = []) =>
        res.set('Content-Security-Policy', buildCsp({ supabaseUrl, gaEnabled, inlineScriptHashes }))
      res.locals.setCsp()
    }
    next()
  }
}
