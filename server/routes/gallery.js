import { Router } from 'express'
import { normalizeLang } from '../i18n.js'
import { requireAuth } from '../middleware/auth.js'
import { buildGallery } from '../services/gallery.js'

// D-97: gallery đèn + chăn Đông Hồ của khách đã đăng nhập
export function galleryRouter({ repo, auth }) {
  const r = Router()
  r.get('/gallery', requireAuth(auth), async (req, res) => {
    res.json(await buildGallery(repo, req.user.id, normalizeLang(req.query.lang)))
  })
  return r
}
