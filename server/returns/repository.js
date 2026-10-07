import { randomUUID } from 'node:crypto'
import { HttpError } from '../errors.js'

const fromRow = (r) =>
  r && {
    id: r.id,
    orderId: r.order_id,
    orderCode: r.orders?.code ?? null,
    userId: r.user_id,
    reason: r.reason,
    description: r.description,
    items: r.items,
    status: r.status,
    videoPath: r.video_path,
    videoType: r.video_type,
    videoBytes: r.video_bytes,
    submittedAt: r.submitted_at,
    createdAt: r.created_at,
    decisionNote: r.decision_note,
    decidedAt: r.decided_at,
    decidedBy: r.decided_by,
    resolution: r.resolution,
    resolutionNote: r.resolution_note,
    resolvedAt: r.resolved_at,
    resolvedBy: r.resolved_by,
  }
const fields = {
  orderId: 'order_id',
  userId: 'user_id',
  videoPath: 'video_path',
  videoType: 'video_type',
  videoBytes: 'video_bytes',
  submittedAt: 'submitted_at',
  createdAt: 'created_at',
  decisionNote: 'decision_note',
  decidedAt: 'decided_at',
  decidedBy: 'decided_by',
  resolutionNote: 'resolution_note',
  resolvedAt: 'resolved_at',
  resolvedBy: 'resolved_by',
}
const toRow = (v) => Object.fromEntries(Object.entries(v).map(([k, x]) => [fields[k] ?? k, x]))
export function createSupabaseReturnsRepo(admin) {
  async function result(q) {
    const { data, error } = await q
    if (error) throw error
    return data
  }
  return {
    async submit(id, userId, input) {
      const { data, error } = await admin.rpc('submit_return_request', {
        p_id: id,
        p_user_id: userId,
        p_reason: input.reason,
        p_description: input.description,
        p_items: input.items,
      })
      if (error) {
        const code = [
          'RETURN_WINDOW_CLOSED',
          'RETURN_ALREADY_SUBMITTED',
          'RETURN_QUANTITY_EXCEEDED',
          'INVALID_RETURN_ITEMS',
          'INVALID_RETURN_REQUEST',
        ].find((c) => error.message?.includes(c))
        if (code) throw new HttpError(409, code)
        throw error
      }
      return fromRow(data)
    },
    async get(id) {
      return fromRow(await result(admin.from('return_requests').select('*').eq('id', id).maybeSingle()))
    },
    async list({ orderId, userId, status, after, limit = 50 } = {}) {
      let q = admin
        .from('return_requests')
        .select('*, orders(code)')
        .neq('status', 'uploading')
        .order('created_at', { ascending: false })
        .order('id', { ascending: false })
        .limit(Math.min(limit, 100))
      if (orderId) q = q.eq('order_id', orderId)
      if (userId) q = q.eq('user_id', userId)
      if (status) q = q.eq('status', status)
      if (after) q = q.or(`created_at.lt.${after.createdAt},and(created_at.eq.${after.createdAt},id.lt.${after.id})`)
      return (await result(q)).map(fromRow)
    },
    async create(v) {
      return fromRow(await result(admin.from('return_requests').insert(toRow(v)).select().single()))
    },
    async change(id, expected, patch) {
      return fromRow(
        await result(
          admin.from('return_requests').update(toRow(patch)).eq('id', id).eq('status', expected).select().maybeSingle(),
        ),
      )
    },
  }
}
export function createMemoryReturnsRepo() {
  const rows = new Map()
  return {
    async submit(id, userId, input) {
      const row = rows.get(id)
      if (!row || row.userId !== userId || row.status !== 'uploading')
        throw new HttpError(409, 'RETURN_ALREADY_SUBMITTED')
      for (const item of input.items) {
        const claimed = [...rows.values()]
          .filter((r) => r.orderId === row.orderId && ['requested', 'approved', 'resolved'].includes(r.status))
          .reduce((n, r) => n + (r.items.find((i) => i.slug === item.slug)?.quantity ?? 0), 0)
        if (claimed + item.quantity > input.purchased.find((i) => i.slug === item.slug).quantity)
          throw new HttpError(409, 'RETURN_QUANTITY_EXCEEDED')
      }
      Object.assign(row, {
        reason: input.reason,
        description: input.description,
        items: input.items,
        status: 'requested',
        submittedAt: input.submittedAt,
      })
      return structuredClone(row)
    },
    async get(id) {
      return structuredClone(rows.get(id) ?? null)
    },
    async list({ orderId, userId, status, after, limit = 50 } = {}) {
      return structuredClone(
        [...rows.values()]
          .filter(
            (r) =>
              r.status !== 'uploading' &&
              (!orderId || r.orderId === orderId) &&
              (!userId || r.userId === userId) &&
              (!status || r.status === status) &&
              (!after || r.createdAt < after.createdAt || (r.createdAt === after.createdAt && r.id < after.id)),
          )
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id))
          .slice(0, limit),
      )
    },
    async create(v) {
      const row = { id: randomUUID(), ...v }
      rows.set(row.id, row)
      return structuredClone(row)
    },
    async change(id, expected, patch) {
      const r = rows.get(id)
      if (!r || r.status !== expected) return null
      Object.assign(r, patch)
      return structuredClone(r)
    },
  }
}
