import { Router } from 'express'
import { HttpError } from '../errors.js'
import { DEFAULT_HASH_SALT } from '../config.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { normalizeBrand } from '../mail/layout.js'
import { normalizeEmail, validateEmail } from '../domain/account.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
// Chuỗi một dòng: bỏ ký tự điều khiển (chống chèn header/thư giả vào tiêu đề)
const oneLine = (v, max) => (typeof v === 'string' ? v.replace(/[\p{Cc}\p{Zl}\p{Zp}]+/gu, ' ').trim().slice(0, max) : '')

/**
 * Feedback 08/10, mục 4: form liên hệ (có trường mã đơn). Không lưu DB — gửi thư tới hộp thư hỗ trợ
 * (MAIL_SUPPORT_EMAIL) với Reply-To là email khách. Thiếu hộp thư hoặc nhà cung cấp thư → 503, để
 * giao diện ẩn form thay vì nhận tin rồi bỏ rơi.
 */
export function contactRouter({ repo, config, mailer }) {
  const r = Router()
  const brand = normalizeBrand(config.mail?.brand)
  const rl = config.rateLimit ?? {}

  r.post(
    '/contact',
    rateLimit({ repo, salt: config.mayHashSalt ?? DEFAULT_HASH_SALT, name: 'contact', max: rl.contact?.max ?? 5, windowSec: rl.contact?.windowSec ?? 3600, enabled: rl.enabled !== false }),
    async (req, res) => {
      if (!brand.supportEmail || !mailer) throw new HttpError(503, 'CONTACT_UNAVAILABLE', 'Biểu mẫu liên hệ chưa mở')
      const b = req.body && typeof req.body === 'object' ? req.body : {}
      const name = oneLine(b.name, 100)
      const email = normalizeEmail(oneLine(b.email, 254))
      const phone = oneLine(b.phone, 24)
      const orderCode = oneLine(b.orderCode, 40)
      const message = typeof b.message === 'string' ? b.message.replace(/\r\n/g, '\n').trim().slice(0, 3000) : ''
      const fields = {}
      if (!name) fields.name = 'REQUIRED'
      // Chỉ nhận một địa chỉ đơn giản: Reply-To không được thành nhiều người nhận
      if (validateEmail(email) || /[,;<>"]/.test(email)) fields.email = 'INVALID_EMAIL'
      if (message.length < 10) fields.message = 'MESSAGE_TOO_SHORT'
      if (Object.keys(fields).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', fields)

      const lines = [`Họ tên: ${name}`, `Email: ${email}`, ...(phone ? [`Điện thoại: ${phone}`] : []), ...(orderCode ? [`Mã đơn: ${orderCode}`] : []), '', message]
      try {
        await mailer.send({
          to: brand.supportEmail,
          replyTo: email,
          subject: `[Liên hệ website]${orderCode ? ` ${orderCode} —` : ''} ${name}`,
          text: lines.join('\n'),
          html: `<pre style="font:14px/1.6 sans-serif;white-space:pre-wrap">${esc(lines.join('\n'))}</pre>`,
        })
      } catch (err) {
        console.error('[contact]', err.message)
        throw new HttpError(503, 'CONTACT_UNAVAILABLE', 'Chưa gửi được. Vui lòng thử lại hoặc liên hệ qua hotline/Zalo.')
      }
      res.status(202).json({ ok: true })
    },
  )
  return r
}
