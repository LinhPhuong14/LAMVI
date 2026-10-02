import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { seoRouter } from './routes/seo.js'
import { itRouter } from './routes/it.js'
import { mayRouter } from './routes/may.js'
import { createMayService } from './may/service.js'
import { cartRouter } from './routes/cart.js'
import { ordersRouter } from './routes/orders.js'
import { createOrderService } from './orders/service.js'
import { createCartService } from './cart/service.js'
import { createMetrics } from './monitoring/metrics.js'
import { createGaRealtime } from './adapters/gaRealtime.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { classifyPath } from '../src/seo/routes.js'
import { errorHandler, notFound } from './errors.js'
import { securityHeaders } from './middleware/security.js'
import { createMailer } from './mail/mailer.js'
import { isPwnedPassword } from './security/pwned.js'

// T-02: nhận adapter qua tham số để test bằng adapter bộ nhớ
export function createApp({
  repo,
  auth,
  storage,
  web,
  config = { publicSiteUrl: 'http://localhost:5173' },
  metrics = createMetrics({ repo, classify: classifyPath }),
  maintenance = createMaintenance({ repo }),
  may = createMayService({ repo, openai: null }),
  payos = null,
  orders = createOrderService({ repo, payos }),
  gaRealtime = createGaRealtime(config.gaRealtime ?? {}),
  // T-49: thư giao dịch (null → không gửi) và kiểm tra mật khẩu đã lộ (null → bỏ qua)
  mailer = createMailer(config.mail),
  pwned = config.pwnedCheck ? isPwnedPassword : null,
  dev = false,
}) {
  const app = express()
  app.disable('x-powered-by')
  // IP thật khi chạy sau proxy (hạn mức Mây theo IP) — đặt TRUST_PROXY theo hạ tầng
  if (config.trustProxy !== undefined) app.set('trust proxy', config.trustProxy)
  // T-37: security headers cho mọi response (kể cả lỗi). Đặt trước router để không bỏ sót.
  app.use(securityHeaders({ config, dev }))
  // D-52: đếm mọi request (API + trang web)
  app.use(metrics.middleware)
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  // API không được cache: phần lớn endpoint phụ thuộc phiên đăng nhập (giỏ hàng, tài khoản, admin)
  // và phần còn lại phải phản ánh DB ngay. Đặt ở đây để không sót endpoint nào.
  api.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  // D-54: bảo trì → API ghi trả 503
  api.use(maintenance.apiGuard)
  api.get('/health', (req, res) => res.json({ ok: true }))
  api.use(catalogRouter({ repo }))
  if (auth) api.use(authRouter({ repo, auth, config, mailer, pwned }))
  if (auth && storage) api.use(adminRouter({ repo, auth, storage, config, orders, gaRealtime }))
  if (auth && storage) api.use(itRouter({ repo, auth, storage, config, metrics, maintenance, may }))
  if (auth) api.use(mayRouter({ repo, auth, may }))
  if (auth) api.use(cartRouter({ auth, cart: createCartService({ repo }) }))
  // FR-CHK-*, FR-ORD-*, FR-PAY-*: cần repo có bảng đơn hàng (adapter cũ trong test không có)
  if (auth && repo.createOrder) api.use(ordersRouter({ repo, auth, orders, config, payos }))
  // Storage bộ nhớ (dev/test) tự phục vụ tải lên/đọc file
  if (storage?.router) api.use(storage.router)
  api.use(() => {
    throw notFound()
  })

  app.use('/api', api)
  app.use(seoRouter({ repo, config }))
  // D-49: SSR/trang web (không có trong test API)
  if (web) app.use(web)
  app.use(errorHandler)
  app.locals.metrics = metrics
  app.locals.maintenance = maintenance
  return app
}
