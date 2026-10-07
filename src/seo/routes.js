// Phân loại đường dẫn cho SSR (D-49). Dùng chung server (Node) và test — không có JSX.
import { splitLocale } from '../i18n/core.js'

// Trang riêng tư: không SSR nội dung, chỉ trả khung HTML + noindex (BR-SEO-001)
const PRIVATE = ['/login', '/register', '/forgot-password', '/reset-password', '/auth/callback', '/account', '/cart', '/checkout']

const seg = (s) => {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

/**
 * Phân loại đường dẫn. **Không phân biệt hoa/thường ở phần route** vì React Router cũng vậy:
 * `/ADMIN`, `/Account` vẫn mở đúng trang, nên nếu ở đây phân biệt thì trang riêng tư sẽ bị coi là
 * trang công khai → lọt index, lọt cache CDN dùng chung và bị nhúng GA.
 * Riêng slug sản phẩm và mã lô là dữ liệu, giữ nguyên chữ hoa/thường.
 */
export function classifyPath(pathname) {
  // D-48, D-51: admin và IT chỉ tiếng Việt, không có tiền tố ngôn ngữ
  if (/^\/(admin|it)(\/|$)/i.test(pathname)) return { kind: 'private', lang: 'vi' }
  const { lang, rest } = splitLocale(pathname)
  const path = rest.length > 1 ? rest.replace(/\/+$/, '') : rest
  const lower = path.toLowerCase()
  if (PRIVATE.includes(lower)) return { kind: 'private', lang }
  // Trang chi tiết đơn: nội dung phụ thuộc phiên đăng nhập (BR-SEO-001)
  if (/^\/don-hang\/[^/]+$/.test(lower)) return { kind: 'private', lang }
  // Trang QR lời chúc: token là bí mật (BR-QR-001) → không SSR nội dung, noindex
  if (/^\/qr\/[^/]+$/.test(lower)) return { kind: 'private', lang }
  if (path === '/') return { kind: 'home', lang }
  if (lower === '/shop') return { kind: 'shop', lang }
  let m = path.match(/^\/products\/([^/]+)$/i)
  if (m) return seg(m[1]) === null ? { kind: 'invalid', lang } : { kind: 'product', lang, slug: seg(m[1]) }
  m = path.match(/^\/collections\/([^/]+)$/i)
  if (m) return seg(m[1]) === null ? { kind: 'invalid', lang } : { kind: 'collection', lang, slug: seg(m[1]) }
  m = path.match(/^\/lo\/([^/]+)$/i)
  if (m) return seg(m[1]) === null ? { kind: 'invalid', lang } : { kind: 'batch', lang, code: seg(m[1]) }
  return { kind: 'other', lang }
}

// Các lời gọi API mà trang cần khi render (khớp key useApi: `${path}|${lang}`)
export function dataKeysFor(route) {
  const keys = ['/products', '/site'] // footer: catalog + verified public business fields
  if (route.kind === 'home') keys.push('/faq')
  if (route.kind === 'product') keys.push(`/products/${encodeURIComponent(route.slug)}`)
  if (route.kind === 'collection') keys.push(`/collections/${encodeURIComponent(route.slug)}`)
  if (route.kind === 'shop') keys.push('/collections')
  if (route.kind === 'batch') keys.push(`/batches/${encodeURIComponent(route.code)}`)
  return keys
}
