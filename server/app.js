import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { authRouter } from './routes/auth.js'
import { errorHandler, notFound } from './errors.js'

// T-02: nhận adapter qua tham số để test bằng adapter bộ nhớ
export function createApp({ repo, auth, config = { publicSiteUrl: 'http://localhost:5173' } }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  api.get('/health', (req, res) => res.json({ ok: true }))
  api.use(catalogRouter({ repo }))
  if (auth) api.use(authRouter({ repo, auth, config }))
  api.use(() => {
    throw notFound()
  })

  app.use('/api', api)
  app.use(errorHandler)
  return app
}
