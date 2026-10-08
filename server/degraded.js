import express from 'express'
import { errorPage } from './errorPage.js'
import { splitLocale } from '../src/i18n/core.js'

/**
 * Ứng dụng dự phòng khi `main.js` không khởi động được (thiếu biến môi trường, Supabase từ chối kết
 * nối, thiếu bản build…). Trước đây lỗi này làm cả function sập: mọi URL trả 500
 * FUNCTION_INVOCATION_FAILED (feedback 08/10, mục 1). Giờ function vẫn sống và:
 * - /api/health → 503 { ok: false } để uptime monitor báo ngay;
 * - các API khác → 503 JSON, KHÔNG nhận đơn (vẫn fail-closed, không rơi về adapter bộ nhớ);
 * - trang web → trang lỗi có thương hiệu, không cache để khỏi giữ lại trang lỗi sau khi sửa xong.
 * Chi tiết lỗi chỉ ghi log, không trả cho client.
 */
export function createDegradedApp(err, { env = process.env } = {}) {
  console.error('[boot] khởi động thất bại — chạy chế độ dự phòng:', err)
  const brand = {
    name: env.MAIL_BRAND_NAME,
    phone: env.MAIL_SUPPORT_PHONE,
    supportEmail: env.MAIL_SUPPORT_EMAIL,
    zaloUrl: env.MAIL_ZALO_URL,
  }
  const app = express()
  app.disable('x-powered-by')
  app.use((req, res, next) => {
    res.set({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Retry-After': '60' })
    next()
  })
  app.use('/api', (req, res) => {
    res.status(503).json(/^\/health\/?$/i.test(req.path) ? { ok: false, degraded: true } : { error: { code: 'SERVICE_UNAVAILABLE', message: 'Hệ thống đang gặp sự cố tạm thời' } })
  })
  app.use((req, res) => {
    let lang = 'vi'
    try {
      lang = splitLocale(decodeURIComponent(req.path)).lang
    } catch { /* URL hỏng → tiếng Việt */ }
    res.status(503).type('html').send(errorPage({ lang, brand }))
  })
  // Phòng khi chính trang lỗi ném lỗi
  app.use((e, req, res, _next) => {
    console.error('[boot] degraded', e)
    res.status(503).type('text/plain').send('LAMVI đang gặp sự cố tạm thời. Vui lòng thử lại sau ít phút.')
  })
  return app
}
