import { randomUUID } from 'node:crypto'
import { HttpError, notFound } from '../errors.js'
export const RETURN_BUCKET = 'return-evidence'
export const RETURN_REASONS = ['manufacturing_defect', 'shipping_damage', 'wrong_item']
export const RETURN_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']
export const returnEligible = (order, now = Date.now()) =>
  order?.status === 'delivered' &&
  Number.isFinite(Date.parse(order.deliveredAt)) &&
  now >= Date.parse(order.deliveredAt) &&
  now <= Date.parse(order.deliveredAt) + 7 * 86400000
const requestId = (id) => {
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
    throw notFound()
}
const sameSubmission = (r, input) => {
  if (
    input?.continuousVideo !== true ||
    input.reason !== r.reason ||
    typeof input.description !== 'string' ||
    input.description.trim() !== r.description ||
    !Array.isArray(input.items)
  )
    return false
  const canonical = (items) =>
    items.every((i) => i && typeof i === 'object' && typeof i.slug === 'string' && Number.isSafeInteger(i.quantity))
      ? JSON.stringify(
          items.map(({ slug, quantity }) => ({ slug, quantity })).sort((a, b) => a.slug.localeCompare(b.slug)),
        )
      : null
  const incoming = canonical(input.items)
  return incoming !== null && incoming === canonical(r.items)
}
const fail = (code, status = 400) => {
  throw new HttpError(status, code)
}
export function createReturnsService({ repo, returnsRepo, storage, maxBytes = 0, now = () => Date.now() }) {
  const enabled = Number.isSafeInteger(maxBytes) && maxBytes > 0 && maxBytes <= 100 * 1024 * 1024
  const view = (r) => ({
    id: r.id,
    status: r.status,
    reason: r.reason,
    description: r.description,
    items: r.items,
    submittedAt: r.submittedAt,
    createdAt: r.createdAt,
    decisionNote: r.decisionNote ?? null,
    decidedAt: r.decidedAt ?? null,
    resolution: r.resolution ?? null,
    resolutionNote: r.resolutionNote ?? null,
    resolvedAt: r.resolvedAt ?? null,
  })
  async function ownerOrder(code, userId) {
    const o = await repo.getOrderByCode(code)
    if (!o || o.userId !== userId) throw notFound()
    return o
  }
  async function ownerRequest(id, userId) {
    requestId(id)
    const r = await returnsRepo.get(id)
    if (!r || r.userId !== userId) throw notFound()
    return r
  }
  async function recoverCommitted(id, userId, input, error) {
    const fresh = await ownerRequest(id, userId)
    if (fresh.status !== 'uploading' && sameSubmission(fresh, input)) return view(fresh)
    throw error
  }
  function requireEnabled() {
    if (!enabled) fail('RETURNS_NOT_CONFIGURED', 503)
  }
  function eligible(o) {
    if (!returnEligible(o, now())) fail('RETURN_WINDOW_CLOSED', 409)
  }
  return {
    async ownerList(code, userId) {
      const o = await ownerOrder(code, userId)
      return {
        enabled,
        eligible: enabled && returnEligible(o, now()),
        maxBytes: enabled ? maxBytes : 0,
        items: (await returnsRepo.list({ orderId: o.id, userId })).map(view),
      }
    },
    async upload(code, userId, input) {
      requireEnabled()
      const o = await ownerOrder(code, userId)
      eligible(o)
      if (
        !RETURN_TYPES.includes(input.contentType) ||
        !Number.isSafeInteger(input.size) ||
        input.size < 1 ||
        input.size > maxBytes
      )
        fail('INVALID_RETURN_VIDEO')
      const id = randomUUID(),
        path = `${userId}/${o.id}/${id}`
      const r = await returnsRepo.create({
        id,
        orderId: o.id,
        userId,
        status: 'uploading',
        reason: null,
        description: '',
        items: [],
        videoPath: path,
        videoType: input.contentType,
        videoBytes: input.size,
        createdAt: new Date(now()).toISOString(),
      })
      const signed = await storage.createUpload({
        path,
        bucket: RETURN_BUCKET,
        contentType: input.contentType,
      })
      return { id: r.id, ...signed }
    },
    async submit(id, userId, input) {
      requireEnabled()
      const r = await ownerRequest(id, userId)
      if (r.status !== 'uploading') {
        if (sameSubmission(r, input)) return view(r)
        fail('RETURN_ALREADY_SUBMITTED', 409)
      }
      const o = await repo.getOrderById(r.orderId)
      if (!o || o.userId !== userId) throw notFound()
      try {
        eligible(o)
      } catch (error) {
        return recoverCommitted(id, userId, input, error)
      }
      if (
        input.continuousVideo !== true ||
        !RETURN_REASONS.includes(input.reason) ||
        typeof input.description !== 'string' ||
        input.description.trim().length < 3 ||
        input.description.length > 2000
      )
        fail('INVALID_RETURN_REQUEST')
      if (!Array.isArray(input.items) || !input.items.length || input.items.length > o.items.length)
        fail('INVALID_RETURN_ITEMS')
      const seen = new Set()
      for (const item of input.items) {
        if (!item || typeof item !== 'object' || Array.isArray(item)) fail('INVALID_RETURN_ITEMS')
        const purchased = o.items.find((i) => i.slug === item.slug)
        if (
          !purchased ||
          seen.has(item.slug) ||
          !Number.isSafeInteger(item.quantity) ||
          item.quantity < 1 ||
          item.quantity > purchased.quantity
        )
          fail('INVALID_RETURN_ITEMS')
        seen.add(item.slug)
      }
      const previous = await returnsRepo.list({
        orderId: o.id,
        userId,
        limit: 100,
      })
      for (const item of input.items) {
        const already = previous
          .filter((p) => p.status !== 'rejected' && p.id !== id)
          .reduce((n, p) => n + (p.items.find((i) => i.slug === item.slug)?.quantity ?? 0), 0)
        if (already + item.quantity > o.items.find((i) => i.slug === item.slug).quantity)
          fail('RETURN_QUANTITY_EXCEEDED', 409)
      }
      const file = await storage.statObject(r.videoPath, RETURN_BUCKET)
      if (!file || file.size !== r.videoBytes || file.contentType !== r.videoType || file.size > maxBytes)
        fail('RETURN_VIDEO_NOT_UPLOADED')
      let changed
      try {
        changed = await returnsRepo.submit(id, userId, {
          reason: input.reason,
          description: input.description.trim(),
          items: input.items.map(({ slug, quantity }) => ({ slug, quantity })),
          purchased: o.items,
          submittedAt: new Date(now()).toISOString(),
        })
      } catch (err) {
        if (!['RETURN_ALREADY_SUBMITTED', 'RETURN_WINDOW_CLOSED'].includes(err?.code)) throw err
        return recoverCommitted(id, userId, input, err)
      }
      if (!changed) fail('RETURN_ALREADY_SUBMITTED', 409)
      return view(changed)
    },
    async adminList({ status = 'requested', cursor } = {}) {
      if (!['requested', 'approved', 'resolved', 'rejected'].includes(status)) fail('INVALID_RETURN_FILTER')
      let after
      if (cursor) {
        if (typeof cursor !== 'string' || cursor.length > 256) fail('INVALID_RETURN_CURSOR')
        try {
          after = JSON.parse(Buffer.from(cursor, 'base64url').toString())
        } catch {
          fail('INVALID_RETURN_CURSOR')
        }
        if (
          !after ||
          typeof after.createdAt !== 'string' ||
          !Number.isFinite(Date.parse(after.createdAt)) ||
          !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+]00:00)$/.test(after.createdAt) ||
          !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(after.id)
        )
          fail('INVALID_RETURN_CURSOR')
      }
      const rows = await returnsRepo.list({ status, after, limit: 51 })
      const page = rows.slice(0, 50)
      const items = await Promise.all(
        page.map(async (r) => ({
          ...view(r),
          orderCode: r.orderCode ?? (await repo.getOrderById(r.orderId))?.code ?? null,
        })),
      )
      const last = page.at(-1)
      return {
        items,
        nextCursor:
          rows.length > 50
            ? Buffer.from(JSON.stringify({ createdAt: last.createdAt, id: last.id })).toString('base64url')
            : null,
      }
    },
    async resolve(id, adminId, input) {
      requestId(id)
      if (
        !['replacement', 'refund'].includes(input.resolution) ||
        typeof input.note !== 'string' ||
        input.note.trim().length < 3 ||
        input.note.length > 2000
      )
        fail('INVALID_RETURN_RESOLUTION')
      const r = await returnsRepo.change(id, 'approved', {
        status: 'resolved',
        resolution: input.resolution,
        resolutionNote: input.note.trim(),
        resolvedBy: adminId,
        resolvedAt: new Date(now()).toISOString(),
      })
      if (!r) {
        const committed = await returnsRepo.get(id)
        if (
          committed?.status === 'resolved' &&
          committed.resolution === input.resolution &&
          committed.resolutionNote === input.note.trim() &&
          committed.resolvedBy === adminId
        )
          return view(committed)
        fail('RETURN_RESOLUTION_CONFLICT', 409)
      }
      if (repo.appendAuditLog) {
        try {
          await repo.appendAuditLog([
            {
              actorId: adminId,
              actorRole: 'admin',
              entity: 'return',
              entityId: id,
              action: 'return_resolved',
              oldValue: { status: 'approved' },
              newValue: { status: 'resolved', resolution: input.resolution },
            },
          ])
        } catch {
          console.error('[audit] return resolution audit unavailable')
        }
      }
      return view(r)
    },
    async adminVideo(id) {
      requestId(id)
      const r = await returnsRepo.get(id)
      if (!r || r.status === 'uploading') throw notFound()
      return {
        url: await storage.signedUrl(r.videoPath, RETURN_BUCKET, {
          expiresIn: 300,
        }),
      }
    },
    async decide(id, adminId, input) {
      requestId(id)
      if (
        !['approved', 'rejected'].includes(input.status) ||
        typeof input.note !== 'string' ||
        input.note.trim().length < 3 ||
        input.note.length > 2000
      )
        fail('INVALID_RETURN_DECISION')
      const r = await returnsRepo.change(id, 'requested', {
        status: input.status,
        decisionNote: input.note.trim(),
        decidedBy: adminId,
        decidedAt: new Date(now()).toISOString(),
      })
      if (!r) {
        const committed = await returnsRepo.get(id)
        if (
          committed?.status === input.status &&
          committed.decisionNote === input.note.trim() &&
          committed.decidedBy === adminId
        )
          return view(committed)
        fail('RETURN_DECISION_CONFLICT', 409)
      }
      // Decision identity/time are durable in the request itself; global audit is supplemental.
      if (repo.appendAuditLog) {
        try {
          await repo.appendAuditLog([
            {
              actorId: adminId,
              actorRole: 'admin',
              entity: 'return',
              entityId: id,
              action: 'return_decision',
              oldValue: { status: 'requested' },
              newValue: { status: r.status },
            },
          ])
        } catch {
          console.error('[audit] return decision audit unavailable')
        }
      }
      return view(r)
    },
  }
}
