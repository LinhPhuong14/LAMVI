import { SLUG_RE } from '../domain/letter.js'

// D-135: subdomain riêng của từng phong thư (<slug>.<LETTER_BASE_DOMAIN>). Subdomain chỉ phục vụ đúng
// trang thư của nó + tệp tĩnh + API mở thư; mọi đường dẫn khác đưa về trang thư, API khác trả 404 —
// không để site chính (đăng nhập, admin, giỏ hàng…) chạy dưới subdomain của thư.
const STATIC = /^\/(assets|letter-room|images|videos|fonts)\/|^\/(favicon\.png|apple-touch-icon\.png|icons\.svg|robots\.txt)$/
const ALLOWED_API = new Set(['/api/letters/open', '/api/health', '/api/site'])

export function letterHost({ baseDomain }) {
  const base = baseDomain ? String(baseDomain).toLowerCase() : null
  return function letterHostMiddleware(req, res, next) {
    if (!base) return next()
    // Bỏ dấu chấm cuối (FQDN `a.b.vn.` mở cùng site) để không lách được bộ lọc
    const host = String(req.hostname || '').toLowerCase().replace(/\.$/, '')
    // Chính domain gốc của thư (không có slug) không phục vụ site chính
    if (host === base) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    if (!host.endsWith(`.${base}`)) return next()
    const slug = host.slice(0, -(base.length + 1))
    if (!SLUG_RE.test(slug)) {
      res.status(404).type('text/plain').send('Not found')
      return
    }
    req.letterSlug = slug
    const path = req.path
    if (path.startsWith('/api/')) {
      if (ALLOWED_API.has(path)) return next()
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Không tìm thấy' } })
      return
    }
    if (path === '/robots.txt') {
      res.type('text/plain').send('User-agent: *\nDisallow: /\n')
      return
    }
    if (STATIC.test(path) || path === `/thu/${slug}`) {
      res.set('X-Robots-Tag', 'noindex, nofollow')
      return next()
    }
    // Trình duyệt giữ nguyên phần #token khi theo redirect không có fragment
    res.set('Cache-Control', 'no-store')
    res.redirect(302, `/thu/${slug}`)
  }
}
