import express from 'express'
import { catalogRouter } from './routes/catalog.js'
import { errorHandler, notFound } from './errors.js'

// T-02: nhận adapter qua tham số để test bằng adapter bộ nhớ
export function createApp({ repo }) {
  const app = express()
  app.disable('x-powered-by')
  app.use(express.json({ limit: '100kb' }))

  const api = express.Router()
  api.get('/health', (req, res) => res.json({ ok: true }))
  api.use(catalogRouter({ repo }))
  api.use(() => {
    throw notFound()
  })

  app.use('/api', api)
  app.use(errorHandler)
  return app
}
