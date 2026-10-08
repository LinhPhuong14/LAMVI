import { returnsRouter } from './returns/routes.js'
import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { authRouter } from './routes/auth.js'
import { adminCollectionsRouter } from './routes/adminCollections.js'
import { adminRouter } from './routes/admin.js'
import { seoRouter } from './routes/seo.js'
import { itRouter } from './routes/it.js'
import { mayRouter } from './routes/may.js'
import { galleryRouter } from './routes/gallery.js'
import { geoRouter } from './routes/geo.js'
import { createMayService } from './may/service.js'
import { cartRouter } from './routes/cart.js'
import { ordersRouter } from './routes/orders.js'
import { adminUsersRouter } from './routes/adminUsers.js'
import { qrRouter } from './routes/qr.js'
import { createMessageService } from './messages/service.js'
import { withAccountLock } from './security/lockedAccounts.js'
import { createOrderService } from './orders/service.js'
import { createOrderNotifier } from './orders/notify.js'
import { createCartService } from './cart/service.js'
import { createMetrics } from './monitoring/metrics.js'
import { createGaRealtime } from './adapters/gaRealtime.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { classifyPath } from '../src/seo/routes.js'
import { errorHandler, notFound } from './errors.js'
import { securityHeaders } from './middleware/security.js'
import { createMailer } from './mail/mailer.js'
import { notificationOperationsRouter } from './routes/notificationOperations.js'
import { isPwnedPassword } from './security/pwned.js'
import { publicSite } from './services/site.js'
import { contactRouter } from './routes/contact.js'

// T-02: nhận adapter qua tham số để test bằng adapter bộ nhớ
export function createApp({
  repo,
  returnsRepo = null,
  auth: rawAuth,
  storage,
  web,
  config = { publicSiteUrl: 'http://localhost:5173' },
  metrics = createMetrics({ repo, classify: classifyPath }),
  maintenance = createMaintenance({ repo }),
  may = createMayService({ repo, openai: null }),
  payos = null,
  notifications = null,
  notificationOutbox = null,
  gaRealtime = createGaRealtime(config.gaRealtime ?? {}),
  // T-49: thư giao dịch (null → không gửi) và kiểm tra mật khẩu đã lộ (null → bỏ qua)
  mailer = createMailer(config.mail),
  // §20, Q-24 → email: thông báo đơn hàng dùng chung nhà cung cấp thư với đặt lại mật khẩu (T-56)
  orders = createOrderService({
    repo,
    payos,
    notify: createOrderNotifier({ repo, mailer, siteUrl: config.publicSiteUrl, brand: config.mail?.brand, worker: notifications }),
  }),
  pwned = config.pwnedCheck ? isPwnedPassword : null,
  // FR-MSG-001, FR-QR-*: lời chúc cần storage (bucket riêng tư); thiếu storage → không bật
  messages = storage ? createMessageService({ repo, storage, may }) : null,
  dev = false,
}) {
  // G-19: khoá tài khoản có hiệu lực ở mọi route dùng phiên
  const auth = rawAuth && repo.getProfile ? withAccountLock(rawAuth, repo) : rawAuth
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
  // Uptime monitor: /api/health nhanh (chỉ chứng tỏ function sống); ?deep=1 còn thử đọc DB → 503 nếu hỏng
  api.get('/health', async (req, res) => {
    if (req.query.deep === undefined) return res.json({ ok: true })
    const db = await maintenance.get()
    if (db.error) return res.status(503).json({ ok: false, db: false })
    res.json({ ok: true, db: true })
  })
  api.get('/site', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60, s-maxage=300')
    res.json(publicSite(config))
  })
  api.use(catalogRouter({ repo }))
  api.use(contactRouter({ repo, config, mailer }))
  api.use(geoRouter())
  if (auth && storage && returnsRepo) api.use(returnsRouter({ repo, returnsRepo, auth, storage, config }))
  if (auth) api.use(authRouter({ repo, auth, config, mailer, pwned }))
  if (auth && storage) api.use(adminRouter({ repo, auth, storage, config, orders, gaRealtime }))
  if (auth && repo.createCollection) api.use(adminCollectionsRouter({ repo, auth }))
  if (auth && storage) api.use(adminUsersRouter({ repo, auth }))
  if (auth && notificationOutbox) api.use(notificationOperationsRouter({ repo, auth, outbox: notificationOutbox }))
  if (auth && storage) api.use(itRouter({ repo, auth, storage, config, metrics, maintenance, may, mailer, payos }))
  if (auth) api.use(mayRouter({ repo, auth, may }))
  if (auth) api.use(cartRouter({ auth, cart: createCartService({ repo }) }))
  // FR-CHK-*, FR-ORD-*, FR-PAY-*: cần repo có bảng đơn hàng (adapter cũ trong test không có)
  if (auth && repo.createOrder) api.use(ordersRouter({ repo, auth, orders, config, payos, messages, notifications, metrics }))
  if (auth && repo.createOrder && repo.listCollections) api.use(galleryRouter({ repo, auth }))
  // Trang QR lời chúc: người nhận, không đăng nhập (US-004)
  if (messages && repo.getOrderByQrToken) api.use(qrRouter({ repo, messages, config }))
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
