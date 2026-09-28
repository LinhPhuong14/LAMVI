import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { authRouter } from './routes/auth.js'
import { adminRouter } from './routes/admin.js'
import { errorHandler, notFound } from './errors.js'

// T-02: nhận adapter qua tham số để test bằng adapter bộ nhớ
export function createApp({ repo, auth, storage, config = { publicSiteUrl: 'http://localhost:5173' } }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  api.get('/health', (req, res) => res.json({ ok: true }))
  api.use(catalogRouter({ repo }))
  if (auth) api.use(authRouter({ repo, auth, config }))
  if (auth && storage) api.use(adminRouter({ repo, auth, storage, config }))
  // Storage bộ nhớ (dev/test) tự phục vụ tải lên/đọc file
  if (storage?.router) api.use(storage.router)
  api.use(() => {
    throw notFound()
  })

  app.use('/api', api)
  app.use(errorHandler)
  return app
}
