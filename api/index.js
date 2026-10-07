// Vercel Function duy nhất (T-33): mọi request đi qua Express (web SSR + API), xem vercel.json
import { waitUntil } from '@vercel/functions'
import { app } from '../server/index.js'

export default function handler(req, res) {
  // Promise continuation runs after every finish listener recorded its sample.
  res.on('finish', () => waitUntil(Promise.resolve().then(() => app.locals.metrics.flush({ cleanup: false }))))
  app(req, res)
}
