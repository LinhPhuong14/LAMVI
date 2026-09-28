import { randomBytes } from 'node:crypto'
import { Router } from 'express'
import { HttpError, notFound } from '../errors.js'
import { RepoError } from '../adapters/repoErrors.js'
import { requireAdmin } from '../middleware/auth.js'
import { VIDEO_TYPES, isVideoType, validateBatch, validateFaq, validateProduct, validateVideoUpload } from '../domain/admin.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})

function assertValid(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
}

// Trùng slug/mã lô → 409 kèm trường
async function write(fn) {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof RepoError && err.code === 'CONFLICT') {
      const code = err.field === 'code' ? 'BATCH_CODE_TAKEN' : 'SLUG_TAKEN'
      throw new HttpError(409, code, code, err.field ? { [err.field]: code } : undefined)
    }
    throw err
  }
}

const found = (row) => {
  if (!row) throw notFound()
  return row
}

const isPublished = (b) => b.status === 'video_published'

// Admin: sản phẩm (FR-CAT-004), FAQ (G-07), lô & video lô (FR-QR-007, D-46, D-47)
export function adminRouter({ repo, auth, storage, config }) {
  const r = Router()
  r.use('/admin', requireAdmin(auth, repo))
  const maxVideoBytes = (config.maxVideoMb ?? 500) * 1024 * 1024

  // --- Sản phẩm
  r.get('/admin/products', async (req, res) => {
    res.json({ items: await repo.listProducts() })
  })
  r.get('/admin/products/:id', async (req, res) => {
    res.json({ item: found(await repo.getProductById(req.params.id)) })
  })
  r.post('/admin/products', async (req, res) => {
    const { errors, values } = validateProduct(body(req))
    assertValid(errors)
    res.status(201).json({ item: await write(() => repo.createProduct(values)) })
  })
  r.patch('/admin/products/:id', async (req, res) => {
    const { errors, values } = validateProduct(body(req), { partial: true })
    assertValid(errors)
    if (!Object.keys(values).length) return res.json({ item: found(await repo.getProductById(req.params.id)) })
    res.json({ item: found(await write(() => repo.updateProduct(req.params.id, values))) })
  })
  // §3.2: admin được xoá sản phẩm. Khi có đơn hàng, sản phẩm đã bán phải ẩn thay vì xoá [ASSUMPTION]
  r.delete('/admin/products/:id', async (req, res) => {
    if (!(await repo.deleteProduct(req.params.id))) throw notFound()
    res.status(204).end()
  })

  // --- FAQ
  r.get('/admin/faq', async (req, res) => {
    res.json({ items: await repo.listFaq({ publishedOnly: false }) })
  })
  r.post('/admin/faq', async (req, res) => {
    const { errors, values } = validateFaq(body(req))
    assertValid(errors)
    res.status(201).json({ item: await repo.createFaq(values) })
  })
  r.patch('/admin/faq/:id', async (req, res) => {
    const { errors, values } = validateFaq(body(req), { partial: true })
    assertValid(errors)
    if (!Object.keys(values).length) return res.json({ item: found(await repo.getFaq(req.params.id)) })
    res.json({ item: found(await repo.updateFaq(req.params.id, values)) })
  })
  r.delete('/admin/faq/:id', async (req, res) => {
    if (!(await repo.deleteFaq(req.params.id))) throw notFound()
    res.status(204).end()
  })

  // --- Lô
  r.get('/admin/batches', async (req, res) => {
    res.json({ items: await repo.listBatches() })
  })
  r.get('/admin/batches/:id', async (req, res) => {
    res.json({ item: found(await repo.getBatchById(req.params.id)) })
  })
  r.post('/admin/batches', async (req, res) => {
    const { errors, values } = validateBatch(body(req))
    assertValid(errors)
    res.status(201).json({ item: await write(() => repo.createBatch(values)) })
  })
  r.patch('/admin/batches/:id', async (req, res) => {
    const { errors, values } = validateBatch(body(req), { partial: true })
    assertValid(errors)
    const batch = found(await repo.getBatchById(req.params.id))
    // Mã lô đã khắc trên đèn sau khi xuất bản → không đổi được (D-43, D-47)
    if (isPublished(batch) && values.code !== undefined && values.code !== batch.code) {
      throw new HttpError(409, 'BATCH_CODE_LOCKED', 'Không đổi mã lô đã xuất bản', { code: 'BATCH_CODE_LOCKED' })
    }
    if (!Object.keys(values).length) return res.json({ item: batch })
    res.json({ item: found(await write(() => repo.updateBatch(batch.id, values))) })
  })
  // D-47: lô đã xuất bản không được xoá
  r.delete('/admin/batches/:id', async (req, res) => {
    const batch = found(await repo.getBatchById(req.params.id))
    if (isPublished(batch)) throw new HttpError(409, 'BATCH_PUBLISHED', 'Lô đã xuất bản không được xoá')
    await repo.deleteBatch(batch.id)
    res.status(204).end()
  })

  // Bước 1: cấp URL tải video thẳng lên Storage (D-46)
  r.post('/admin/batches/:id/video-upload', async (req, res) => {
    const b = body(req)
    const batch = found(await repo.getBatchById(req.params.id))
    assertValid(validateVideoUpload(b, maxVideoBytes))
    // Mỗi lần tải một đường dẫn mới — video cũ không bị ghi đè (D-10)
    const path = `${batch.id}/${Date.now()}-${randomBytes(4).toString('hex')}.${VIDEO_TYPES[b.contentType]}`
    const upload = await storage.createVideoUpload({ path, contentType: b.contentType })
    res.status(201).json({ path, ...upload })
  })

  // Bước 2: xác nhận file đã tải lên → gắn vào lô (thay video được cả khi đã xuất bản — D-47)
  r.post('/admin/batches/:id/video', async (req, res) => {
    const { path } = body(req)
    const batch = found(await repo.getBatchById(req.params.id))
    if (typeof path !== 'string' || !path.startsWith(`${batch.id}/`) || path.includes('..')) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Đường dẫn không hợp lệ', { path: 'INVALID' })
    }
    const obj = await storage.statObject(path)
    if (!obj) throw new HttpError(400, 'VALIDATION_ERROR', 'Chưa có file', { path: 'VIDEO_NOT_UPLOADED' })
    if (obj.size > maxVideoBytes) throw new HttpError(400, 'VALIDATION_ERROR', 'File quá lớn', { size: 'VIDEO_TOO_LARGE' })
    // Kiểm lại kiểu file thật (người tải có thể gửi Content-Type khác lúc PUT)
    if (!isVideoType(obj.contentType)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Không phải video', { contentType: 'INVALID_VIDEO_TYPE' })
    }
    const item = await repo.updateBatch(batch.id, { videoPath: path, videoUrl: storage.publicUrl(path) })
    res.json({ item })
  })

  // Xuất bản: lô phải có video; không có thao tác gỡ xuất bản (D-47)
  r.post('/admin/batches/:id/publish', async (req, res) => {
    const batch = found(await repo.getBatchById(req.params.id))
    if (!batch.videoUrl) throw new HttpError(409, 'VIDEO_REQUIRED', 'Lô chưa có video')
    if (isPublished(batch)) return res.json({ item: batch })
    res.json({ item: await repo.updateBatch(batch.id, { status: 'video_published' }) })
  })

  return r
}
