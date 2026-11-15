import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { IMAGE_TYPES, isImageType, validateImageUpload } from '../domain/admin.js'
import { PRODUCT_IMAGE_BUCKET } from '../adapters/supabase/storage.js'
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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

/**
 * D-134: admin soạn phong thư cho từng đơn và xuất bản ra QR.
 * D-142: admin tạo được thư lẻ không cần đơn (`POST /admin/letters`, thao tác theo `/admin/letters/:id`).
 * D-138: người nhận mở /thu/<slug>#<token> trên domain chính; ai có link là xem được.
 */
export function lettersRouter({ repo, auth, config, storage = null }) {
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
    const letter = await repo.getLetterBySlug(slug)
    const ok = letter && letter.status === 'published' && letter.content && tokenMatches(token, letter.token)
    if (!ok) throw notFound()
    // D-142: thư lẻ không có đơn — không gọi getOrderById(null) (Postgres lỗi ép uuid)
    const order = letter.orderId && repo.getOrderById ? await repo.getOrderById(letter.orderId) : null
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
        id: l.id ?? null,
        label: l.label ?? null,
        orderCode: l.orderCode,
        orderStatus: l.orderStatus,
        status: l.status,
        recipientName: l.content?.recipientName ?? null,
        senderName: l.content?.senderName ?? null,
        occasion: l.content?.occasion ?? null,
        // D-141: web 2D là bản chính — thư không ghi template coi là 'web'
        template: l.content?.template === 'room' ? 'room' : 'web',
        lamp: l.content?.lamp ?? null,
        slug: l.slug,
        publishedAt: l.publishedAt ?? null,
        openedAt: l.openedAt ?? null,
        updatedAt: l.updatedAt ?? null,
        url: l.slug && l.token ? letterUrl(config, l.slug, l.token) : null,
      })),
    })
  })

  // Một "đích" phong thư: thư của đơn (theo mã đơn) hoặc thư lẻ (D-142, theo id) — cùng bộ thao tác
  async function orderTarget(req) {
    const o = await repo.getOrderByCode(req.params.code)
    if (!o) throw notFound()
    return {
      entity: 'order',
      entityId: o.id,
      cancelled: o.status === 'cancelled',
      load: () => repo.getOrderLetter(o.id),
      save: (patch) => repo.saveOrderLetter(o.id, patch),
      slugOwner: (other) => other.orderId === o.id,
    }
  }
  async function letterTarget(req) {
    const id = req.params.id
    if (typeof id !== 'string' || !UUID_RE.test(id) || !repo.getLetterById) throw notFound()
    const letter = await repo.getLetterById(id)
    if (!letter) throw notFound()
    const order = letter.orderId && repo.getOrderById ? await repo.getOrderById(letter.orderId) : null
    return {
      entity: 'letter',
      entityId: id,
      cancelled: order?.status === 'cancelled',
      load: () => repo.getLetterById(id),
      save: async (patch) => (await repo.saveLetterById(id, patch)) ?? Promise.reject(notFound()),
      slugOwner: (other) => other.id === id,
    }
  }

  // label: ghi chú nội bộ của thư lẻ (người nhận không thấy)
  function labelOf(req) {
    const raw = body(req).label
    if (raw == null) return undefined
    if (typeof raw !== 'string') throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { label: 'INVALID' })
    const v = raw.trim()
    if (v.length > 120) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { label: 'TOO_LONG' })
    return v || null
  }

  function mount(base, targetOf) {
    r.get(base, async (req, res) => {
      const t = await targetOf(req)
      res.json({ item: presentLetterForAdmin(await t.load(), config) })
    })

    // Lưu nháp (hoặc sửa thư đã xuất bản — người nhận thấy ngay bản mới, QR giữ nguyên)
    r.put(base, async (req, res) => {
      const t = await targetOf(req)
      const { value, errors } = validateLetterContent(body(req).content)
      if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
      const label = t.entity === 'letter' ? labelOf(req) : undefined
      const before = await t.load()
      const saved = await t.save({ content: value, ...(label !== undefined ? { label } : {}), updatedBy: req.user.id })
      await audit(req, t, before ? 'letter_update' : 'letter_create', before?.status ?? null, saved.status)
      res.json({ item: presentLetterForAdmin(saved, config) })
    })

    // Xuất bản: lần đầu sinh slug + token. Đã có thì giữ nguyên (QR đã in vẫn dùng được).
    r.post(`${base}/publish`, async (req, res) => {
      const t = await targetOf(req)
      if (t.cancelled) throw new HttpError(409, 'ORDER_CANCELLED', 'Đơn đã huỷ')
      const letter = await t.load()
      if (!letter?.content) throw new HttpError(409, 'LETTER_EMPTY', 'Chưa soạn phong thư')
      const { errors } = validateLetterContent(letter.content)
      if (Object.keys(errors).length) throw new HttpError(409, 'LETTER_INVALID', 'Phong thư chưa hợp lệ', errors)
      const keys = letter.slug && letter.token ? {} : await freshKeys(t)
      const saved = await t.save({ ...keys, status: 'published', publishedAt: letter.publishedAt ?? new Date().toISOString(), updatedBy: req.user.id })
      await audit(req, t, 'letter_publish', letter.status, 'published')
      res.json({ item: presentLetterForAdmin(saved, config) })
    })

    // Gỡ xuất bản: link/QR cũ trả 404 cho tới khi xuất bản lại (cùng QR)
    r.post(`${base}/unpublish`, async (req, res) => {
      const t = await targetOf(req)
      const letter = await t.load()
      if (!letter) throw notFound()
      const saved = await t.save({ status: 'draft', updatedBy: req.user.id })
      await audit(req, t, 'letter_unpublish', letter.status, 'draft')
      res.json({ item: presentLetterForAdmin(saved, config) })
    })

    // Tạo QR mới (lộ link, in hỏng…): đổi cả mã thư (slug) và token, QR cũ hết hiệu lực ngay
    r.post(`${base}/rotate`, async (req, res) => {
      const t = await targetOf(req)
      const letter = await t.load()
      if (!letter) throw notFound()
      const saved = await t.save({ ...(await freshKeys(t)), updatedBy: req.user.id })
      await audit(req, t, 'letter_rotate', null, null)
      res.json({ item: presentLetterForAdmin(saved, config) })
    })
  }

  // D-154: logo doanh nghiệp cho thư — bước 1 xin URL tải lên (ảnh PNG/JPG/WebP, không SVG), bước 2 xác nhận lấy URL công khai
  const LOGO_PREFIX = 'letter-logos/'
  const maxLogoBytes = Math.min(2, config.maxImageMb ?? 5) * 1024 * 1024
  r.post('/admin/letters/logo-upload', async (req, res) => {
    if (!storage) throw notFound()
    const b = body(req)
    const errors = validateImageUpload(b, maxLogoBytes)
    if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
    const path = `${LOGO_PREFIX}${Date.now()}-${randomBytes(6).toString('hex')}.${IMAGE_TYPES[b.contentType]}`
    const upload = await storage.createUpload({ path, contentType: b.contentType, bucket: PRODUCT_IMAGE_BUCKET })
    res.status(201).json({ path, ...upload })
  })
  r.post('/admin/letters/logo', async (req, res) => {
    if (!storage) throw notFound()
    const { path } = body(req)
    if (typeof path !== 'string' || !path.startsWith(LOGO_PREFIX) || path.includes('..') || path.length > 200) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Đường dẫn không hợp lệ', { path: 'INVALID' })
    }
    const obj = await storage.statObject(path, PRODUCT_IMAGE_BUCKET)
    if (!obj) throw new HttpError(400, 'VALIDATION_ERROR', 'Chưa có file', { path: 'IMAGE_NOT_UPLOADED' })
    if (obj.size > maxLogoBytes) throw new HttpError(400, 'VALIDATION_ERROR', 'File quá lớn', { size: 'IMAGE_TOO_LARGE' })
    if (!isImageType(obj.contentType)) throw new HttpError(400, 'VALIDATION_ERROR', 'Không phải ảnh', { contentType: 'INVALID_IMAGE_TYPE' })
    res.json({ url: storage.publicUrl(path, PRODUCT_IMAGE_BUCKET) })
  })

  // D-142: tạo thư lẻ — không cần đơn hàng. Có thể gửi kèm nội dung (lưu nháp ngay) hoặc chỉ ghi chú.
  r.post('/admin/letters', async (req, res) => {
    if (!repo.createLetter) throw notFound()
    const label = labelOf(req) ?? null
    let content = null
    if (body(req).content != null) {
      const { value, errors } = validateLetterContent(body(req).content)
      if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
      content = value
    }
    const saved = await repo.createLetter({ label, content, status: 'draft', updatedBy: req.user.id })
    await audit(req, { entity: 'letter', entityId: saved.id }, 'letter_create', null, 'draft')
    res.status(201).json({ item: presentLetterForAdmin(saved, config) })
  })

  mount('/admin/orders/:code/letter', orderTarget)
  mount('/admin/letters/:id', letterTarget)

  return r

  // Slug trùng (xác suất rất nhỏ) → thử lại
  async function freshKeys(t) {
    for (let i = 0; i < 5; i++) {
      const slug = generateSlug()
      const other = await repo.getLetterBySlug(slug)
      if (!other || t.slugOwner(other)) return { slug, token: generateToken() }
    }
    throw new RepoError('CONFLICT', 'slug')
  }

  // NFR-AUD-001: không ghi nội dung thư vào nhật ký, chỉ thao tác + trạng thái
  async function audit(req, t, action, oldStatus, newStatus) {
    if (!repo.appendAuditLog) return
    try {
      await repo.appendAuditLog([
        { actorId: req.user.id, actorRole: req.role ?? 'admin', entity: t.entity, entityId: t.entityId, action, oldValue: { letter: oldStatus }, newValue: { letter: newStatus } },
      ])
    } catch (err) {
      console.error('[audit]', err)
    }
  }
}
