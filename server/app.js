import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { seoRouter } from './routes/seo.js'
import { itRouter } from './routes/it.js'
import { mayRouter } from './routes/may.js'
import { createMayService } from './may/service.js'
import { cartRouter } from './routes/cart.js'
import { createCartService } from './cart/service.js'
import { ordersRouter } from './routes/orders.js'
import { adminShopRouter } from './routes/adminShop.js'
import { createOrderService } from './orders/service.js'
import { createAdminOrderService } from './orders/admin.js'
import { createFakePayos } from './payments/fakePayos.js'
import { createMetrics } from './monitoring/metrics.js'
import { createMaintenance } from './monitoring/maintenance.js'
import { classifyPath } from '../src/seo/routes.js'
import { errorHandler, notFound } from './errors.js'

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
  payments = createFakePayos({ publicSiteUrl: config.publicSiteUrl }),
  orders = createOrderService({ repo, payments, publicSiteUrl: config.publicSiteUrl }),
}) {
  const app = express()
  app.disable('x-powered-by')
  // IP thật khi chạy sau proxy (hạn mức Mây theo IP) — đặt TRUST_PROXY theo hạ tầng
  if (config.trustProxy !== undefined) app.set('trust proxy', config.trustProxy)
  // D-52: đếm mọi request (API + trang web)
  app.use(metrics.middleware)
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  // D-54: bảo trì → API ghi trả 503
  api.use(maintenance.apiGuard)
  api.get('/health', (req, res) => res.json({ ok: true }))
  api.use(catalogRouter({ repo }))
  if (auth) api.use(authRouter({ repo, auth, config }))
  if (auth && storage) api.use(adminRouter({ repo, auth, storage, config }))
  if (auth && storage) api.use(itRouter({ repo, auth, storage, config, metrics, maintenance, may }))
  if (auth) api.use(mayRouter({ repo, auth, may }))
  if (auth) api.use(cartRouter({ auth, cart: createCartService({ repo }) }))
  if (auth) api.use(ordersRouter({ auth, orders, payments }))
  if (auth) api.use(adminShopRouter({ repo, auth, adminOrders: createAdminOrderService({ repo, orders }), audit: orders.audit }))
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
  app.locals.orders = orders
  return app
}
