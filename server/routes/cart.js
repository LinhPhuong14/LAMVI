import { Router } from 'express'
import { HttpError } from '../errors.js'
import { normalizeLang } from '../i18n.js'
import { requireAuth } from '../middleware/auth.js'
import { MAX_LINES, parseLine } from '../cart/service.js'

// Danh sách dòng từ trình duyệt ({ slug, quantity }); dòng sai bị bỏ qua
function parseLines(body) {
  const items = body?.items
  if (!Array.isArray(items) || items.length > MAX_LINES * 2) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu giỏ không hợp lệ', { items: 'INVALID' })
  }
  return items.map(parseLine).filter(Boolean)
}

// FR-CART-001 (§11, D-59…D-61)
export function cartRouter({ auth, cart }) {
  const r = Router()
  const guard = requireAuth(auth)
  const lang = (req) => normalizeLang(req.query.lang)

  // Khách vãng lai: tính giỏ lưu ở trình duyệt (chỉ đọc)
  r.post('/cart/quote', async (req, res) => {
    res.json(await cart.quote(parseLines(req.body), lang(req)))
  })

  r.get('/cart', guard, async (req, res) => {
    res.json(await cart.get(req.user.id, lang(req)))
  })

  r.put('/cart/items/:slug', guard, async (req, res) => {
    res.json(await cart.setQuantity(req.user.id, req.params.slug, req.body?.quantity, lang(req)))
  })

  r.delete('/cart/items/:slug', guard, async (req, res) => {
    res.json(await cart.remove(req.user.id, req.params.slug, lang(req)))
  })

  // D-59: gộp giỏ trình duyệt vào giỏ tài khoản khi đăng nhập
  r.post('/cart/merge', guard, async (req, res) => {
    res.json(await cart.merge(req.user.id, parseLines(req.body), lang(req)))
  })

  return r
}
