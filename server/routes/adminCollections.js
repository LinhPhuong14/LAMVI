import { Router } from 'express'
import { requireAdmin } from '../middleware/auth.js'
import { HttpError, notFound } from '../errors.js'
import { RepoError } from '../adapters/repoErrors.js'
import { validateCollection } from '../domain/collectionValidate.js'

export function adminCollectionsRouter({ repo, auth }) {
  const r = Router()
  r.use('/admin/collections', requireAdmin(auth, repo))
  const found = async (id) => { const c = await repo.getCollectionById(id); if (!c) throw notFound(); return c }
  const validated = (req, partial) => {
    const b = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
    const { values, errors } = validateCollection(b, { partial })
    if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
    return values
  }
  const write = async (fn) => {
    try { return await fn() } catch (e) {
      if (e instanceof RepoError && e.code === 'CONFLICT') throw new HttpError(409, 'SLUG_TAKEN', 'Slug đã được dùng', { slug: 'SLUG_TAKEN' })
      if (e instanceof RepoError && e.code === 'COLLECTION_IN_USE') throw new HttpError(409, 'COLLECTION_IN_USE', 'Bộ đang có sản phẩm; hãy ẩn thay vì xoá')
      throw e
    }
  }
  const audit = async (req, item, action) => {
    // Metadata only: never put reward story into general audit logs.
    try { await repo.appendAuditLog?.([{ actorId: req.user.id, actorRole: req.role, entity: 'collection', entityId: item.id, action, newValue: { slug: item.slug, status: item.status } }]) }
    catch (e) { console.error('[audit] collection', e) }
  }
  r.get('/admin/collections', async (_req, res) => res.json({ items: await repo.listCollections() }))
  r.get('/admin/collections/:id', async (req, res) => res.json({ item: await found(req.params.id) }))
  r.post('/admin/collections', async (req, res) => {
    const item = await write(() => repo.createCollection(validated(req, false)))
    await audit(req, item, 'create'); res.status(201).json({ item })
  })
  r.patch('/admin/collections/:id', async (req, res) => {
    const before = await found(req.params.id), values = validated(req, true)
    if (values.slug !== undefined && values.slug !== before.slug) throw new HttpError(409, 'COLLECTION_SLUG_LOCKED', 'Slug bộ không đổi sau khi tạo', { slug: 'COLLECTION_SLUG_LOCKED' })
    const item = await write(() => repo.updateCollection(before.id, values))
    if (!item) throw notFound()
    await audit(req, item, 'update'); res.json({ item })
  })
  r.delete('/admin/collections/:id', async (req, res) => {
    const before = await found(req.params.id)
    if ((await repo.listProducts()).some((p) => p.collectionSlug === before.slug)) throw new HttpError(409, 'COLLECTION_IN_USE', 'Bộ đang có sản phẩm; hãy ẩn thay vì xoá')
    if (!await write(() => repo.deleteCollection(before.id))) throw notFound()
    await audit(req, before, 'delete'); res.status(204).end()
  })
  return r
}
