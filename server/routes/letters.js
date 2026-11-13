import { Router } from 'express'
import { HttpError, notFound } from '../errors.js'
import { RepoError } from '../adapters/repoErrors.js'
import { requireAdmin } from '../middleware/auth.js'
import { rateLimit } from '../middleware/rateLimit.js'
import { DEFAULT_HASH_SALT } from '../config.js'
import {
  SLUG_RE,
  generateSlug,
  generateToken,
  letterUrl,
  presentLetterForAdmin,
  presentLetterForRecipient,
  tokenMatches,
  validateLetterContent,
} from '../domain/letter.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

/**
 * D-134: admin soạn phong thư cho từng đơn và xuất bản ra QR.
 * D-135: người nhận mở bằng subdomain ngẫu nhiên + token trong QR; ai có link là xem được.
 */
export function lettersRouter({ repo, auth, config }) {
  const r = Router()
  const limit = (name, max, windowSec) =>
    rateLimit({
      repo,
      salt: config.mayHashSalt ?? DEFAULT_HASH_SALT,
      name,
      max: config.rateLimit?.letters?.[name]?.max ?? max,
      windowSec,
      enabled: config.rateLimit?.enabled !== false,
    })

  // --- Người nhận: token gửi trong body (không nằm trên URL → không vào log). Slug sai, token sai,
  // thư chưa xuất bản hoặc đơn đã huỷ cùng trả 404 giống nhau để không dò được.
  r.post('/letters/open', limit('letter-open', 60, 600), async (req, res) => {
    const { slug, token } = body(req)
    if (typeof slug !== 'string' || !SLUG_RE.test(slug)) throw notFound()
    // Dưới subdomain của thư: chỉ mở đúng thư của subdomain đó
    if (req.letterSlug && req.letterSlug !== slug) throw notFound()
    const letter = await repo.getLetterBySlug(slug)
    const ok = letter && letter.status === 'published' && letter.content && tokenMatches(token, letter.token)
    if (!ok) throw notFound()
    const order = repo.getOrderById ? await repo.getOrderById(letter.orderId) : null
    if (order && order.status === 'cancelled') throw notFound()
    if (!letter.openedAt && repo.markLetterOpened) await repo.markLetterOpened(letter.id, new Date().toISOString())
    res.set('Referrer-Policy', 'no-referrer')
    res.json({ item: presentLetterForRecipient(letter) })
  })

  if (!auth) return r

  // --- Admin
  r.use('/admin/orders/:code/letter', requireAdmin(auth, repo))
  r.use('/admin/letters', requireAdmin(auth, repo))

  // Thư viện QR: mọi QR đã tạo, để in lại đúng QR cũ khi thiệp bị mất (không sinh token mới)
  r.get('/admin/letters', async (req, res) => {
    const rows = repo.listOrderLetters ? await repo.listOrderLetters({ limit: 5000 }) : []
    res.json({
      items: rows.map((l) => ({
        orderCode: l.orderCode,
        orderStatus: l.orderStatus,
        status: l.status,
        recipientName: l.content?.recipientName ?? null,
        senderName: l.content?.senderName ?? null,
        occasion: l.content?.occasion ?? null,
        slug: l.slug,
        publishedAt: l.publishedAt ?? null,
        openedAt: l.openedAt ?? null,
        updatedAt: l.updatedAt ?? null,
        url: l.slug && l.token ? letterUrl(config, l.slug, l.token) : null,
      })),
    })
  })

  async function orderOf(req) {
    const o = await repo.getOrderByCode(req.params.code)
    if (!o) throw notFound()
    return o
  }

  r.get('/admin/orders/:code/letter', async (req, res) => {
    const o = await orderOf(req)
    res.json({ item: presentLetterForAdmin(await repo.getOrderLetter(o.id), config) })
  })

  // Lưu nháp (hoặc sửa thư đã xuất bản — người nhận thấy ngay bản mới, QR giữ nguyên)
  r.put('/admin/orders/:code/letter', async (req, res) => {
    const o = await orderOf(req)
    const { value, errors } = validateLetterContent(body(req).content)
    if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
    const before = await repo.getOrderLetter(o.id)
    const saved = await repo.saveOrderLetter(o.id, { content: value, updatedBy: req.user.id })
    await audit(req, o.id, before ? 'letter_update' : 'letter_create', before?.status ?? null, saved.status)
    res.json({ item: presentLetterForAdmin(saved, config) })
  })

  // Xuất bản: lần đầu sinh slug + token. Đã có thì giữ nguyên (QR đã in vẫn dùng được).
  r.post('/admin/orders/:code/letter/publish', async (req, res) => {
    const o = await orderOf(req)
    if (o.status === 'cancelled') throw new HttpError(409, 'ORDER_CANCELLED', 'Đơn đã huỷ')
    const letter = await repo.getOrderLetter(o.id)
    if (!letter?.content) throw new HttpError(409, 'LETTER_EMPTY', 'Chưa soạn phong thư')
    const { errors } = validateLetterContent(letter.content)
    if (Object.keys(errors).length) throw new HttpError(409, 'LETTER_INVALID', 'Phong thư chưa hợp lệ', errors)
    const keys = letter.slug && letter.token ? {} : await freshKeys(o.id)
    const saved = await repo.saveOrderLetter(o.id, { ...keys, status: 'published', publishedAt: letter.publishedAt ?? new Date().toISOString(), updatedBy: req.user.id })
    await audit(req, o.id, 'letter_publish', letter.status, 'published')
    res.json({ item: presentLetterForAdmin(saved, config) })
  })

  // Gỡ xuất bản: link/QR cũ trả 404 cho tới khi xuất bản lại (cùng QR)
  r.post('/admin/orders/:code/letter/unpublish', async (req, res) => {
    const o = await orderOf(req)
    const letter = await repo.getOrderLetter(o.id)
    if (!letter) throw notFound()
    const saved = await repo.saveOrderLetter(o.id, { status: 'draft', updatedBy: req.user.id })
    await audit(req, o.id, 'letter_unpublish', letter.status, 'draft')
    res.json({ item: presentLetterForAdmin(saved, config) })
  })

  // Tạo QR mới (lộ link, in hỏng…): đổi cả subdomain và token, QR cũ hết hiệu lực ngay
  r.post('/admin/orders/:code/letter/rotate', async (req, res) => {
    const o = await orderOf(req)
    const letter = await repo.getOrderLetter(o.id)
    if (!letter) throw notFound()
    const saved = await repo.saveOrderLetter(o.id, { ...(await freshKeys(o.id)), updatedBy: req.user.id })
    await audit(req, o.id, 'letter_rotate', null, null)
    res.json({ item: presentLetterForAdmin(saved, config) })
  })

  return r

  // Slug trùng (xác suất rất nhỏ) → thử lại
  async function freshKeys(orderId) {
    for (let i = 0; i < 5; i++) {
      const slug = generateSlug()
      const other = await repo.getLetterBySlug(slug)
      if (!other || other.orderId === orderId) return { slug, token: generateToken() }
    }
    throw new RepoError('CONFLICT', 'slug')
  }

  // NFR-AUD-001: không ghi nội dung thư vào nhật ký, chỉ thao tác + trạng thái
  async function audit(req, orderId, action, oldStatus, newStatus) {
    if (!repo.appendAuditLog) return
    try {
      await repo.appendAuditLog([
        { actorId: req.user.id, actorRole: req.role ?? 'admin', entity: 'order', entityId: orderId, action, oldValue: { letter: oldStatus }, newValue: { letter: newStatus } },
      ])
    } catch (err) {
      console.error('[audit]', err)
    }
  }
}
