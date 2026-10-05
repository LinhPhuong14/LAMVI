import { Router } from 'express'
import { rateLimit } from '../middleware/rateLimit.js'
import { DEFAULT_HASH_SALT } from '../config.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

/**
 * Trang QR lời chúc cho người nhận (FR-QR-002…005, US-004). KHÔNG yêu cầu đăng nhập: bảo vệ bằng
 * token ngẫu nhiên 256 bit (BR-QR-001). Token sai và đơn đã huỷ cùng trả 404 (AC-004).
 */
export function qrRouter({ repo, messages, config }) {
  const r = Router()
  const limit = (name, max, windowSec) =>
    rateLimit({
      repo,
      salt: config.mayHashSalt ?? DEFAULT_HASH_SALT,
      name,
      max: config.rateLimit?.qr?.[name]?.max ?? max,
      windowSec,
      enabled: config.rateLimit?.enabled !== false,
    })

  r.get('/qr/:token', limit('qr-view', 120, 600), async (req, res) => {
    res.json({ item: await messages.view(req.params.token) })
  })
  r.post('/qr/:token/confirm', limit('qr-confirm', 30, 3600), async (req, res) => {
    res.json({ item: await messages.confirm(req.params.token) })
  })
  // G-31: dịch tốn ngân sách Mây → giới hạn chặt hơn
  r.post('/qr/:token/translate', limit('qr-translate', 20, 3600), async (req, res) => {
    res.json({ item: await messages.translate(req.params.token, body(req).lang) })
  })
  return r
}
