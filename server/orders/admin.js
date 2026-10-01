import { HttpError, notFound } from '../errors.js'
import { isBatchPublic } from '../domain/catalog.js'
import { CANCELLABLE, ORDER_STATUSES, STAGES } from './domain.js'

// FR-ORD-002: admin cập nhật trạng thái đơn, công đoạn (§16), lô (§21.6), vận đơn (§17), COD, hoàn tiền (D-70)
export const ADMIN_ACTIONS = ['start_production', 'set_stage', 'pack', 'ship', 'deliver', 'delivery_failed', 'cancel', 'cod_collected', 'refund', 'set_tracking']

const TRACKING_RE = /^[A-Za-z0-9-]{4,40}$/

export function createAdminOrderService({ repo, orders, now = () => Date.now() }) {
  const iso = () => new Date(now()).toISOString()
  const conflict = (code, msg, fields) => new HttpError(409, code, msg, fields)

  async function load(id) {
    const order = typeof id === 'string' && id.length <= 64 ? await repo.getOrderById(id) : null
    if (!order) throw notFound()
    return order
  }

  async function present(order) {
    const batches = new Map((await repo.listBatches()).map((b) => [b.id, b]))
    const profile = await repo.getProfile(order.userId)
    return {
      ...order,
      buyer: { id: order.userId, fullName: profile?.fullName ?? null, phone: profile?.phone ?? null },
      items: order.items.map((i) => {
        const b = i.batchId ? batches.get(i.batchId) : null
        return { ...i, batch: b ? { id: b.id, code: b.code, published: isBatchPublic(b) } : null }
      }),
    }
  }

  // Cập nhật có điều kiện + ghi nhật ký người thực hiện (NFR-AUD-001)
  async function transitionBy(actor, action, order, from, patch) {
    const updated = await repo.updateOrder(order.id, patch, from)
    if (!updated) throw conflict('ORDER_STATE_CHANGED', 'Trạng thái đơn vừa thay đổi, tải lại trang')
    await orders.audit.orderChange(order, updated, actor, action)
    return updated
  }

  const requireStatus = (order, list) => {
    if (!list.includes(order.status)) throw conflict('INVALID_TRANSITION', 'Không chuyển được từ trạng thái hiện tại')
  }

  function parseTracking(v) {
    const t = typeof v === 'string' ? v.trim() : ''
    if (!TRACKING_RE.test(t)) throw new HttpError(400, 'VALIDATION_ERROR', 'Mã vận đơn không hợp lệ', { trackingCode: 'INVALID' })
    return t
  }

  return {
    async list({ status, flagged } = {}) {
      if (status !== undefined && !ORDER_STATUSES.includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ', { status: 'INVALID' })
      // Đơn quá hạn được dọn bởi tác vụ định kỳ (server/index.js) và khi mở chi tiết đơn
      let items = await repo.listOrders({ status })
      if (flagged) items = items.filter((o) => o.flags.length || o.paymentStatus === 'REFUND_PENDING')
      return { items: items.map(({ items: lines, ...o }) => ({ ...o, itemCount: lines.reduce((s, i) => s + i.quantity, 0) })) }
    },

    async get(id) {
      const order = await orders.reconcile(await load(id))
      return { item: await present(order), history: await repo.listAudit({ entity: 'order', entityId: order.id }) }
    },

    async act(id, action, body = {}, actor) {
      if (!ADMIN_ACTIONS.includes(action)) throw new HttpError(400, 'VALIDATION_ERROR', 'Thao tác không hợp lệ', { action: 'INVALID' })
      const transition = (o, from, patch) => transitionBy(actor, action, o, from, patch)
      let order = await orders.reconcile(await load(id), { force: true })
      switch (action) {
        case 'start_production':
          requireStatus(order, ['CONFIRMED'])
          order = await transition(order, ['CONFIRMED'], { status: 'IN_PRODUCTION', productionStage: 1 })
          break
        case 'set_stage': {
          requireStatus(order, ['IN_PRODUCTION'])
          if (!STAGES.includes(body.stage)) throw new HttpError(400, 'VALIDATION_ERROR', 'Công đoạn không hợp lệ', { stage: 'INVALID' })
          order = await transition(order, ['IN_PRODUCTION'], { productionStage: body.stage })
          break
        }
        case 'pack':
          // BR-MSG-008: khoá phần chữ lời chúc khi PACKED
          requireStatus(order, ['IN_PRODUCTION'])
          order = await transition(order, ['IN_PRODUCTION'], { status: 'PACKED' })
          break
        case 'ship': {
          requireStatus(order, ['PACKED'])
          const trackingCode = parseTracking(body.trackingCode)
          // BR-ORD-002: mọi dòng hàng đã gán lô có video xuất bản
          const batches = new Map((await repo.listBatches()).map((b) => [b.id, b]))
          const missing = order.items.filter((i) => !i.batchId || !batches.get(i.batchId) || !isBatchPublic(batches.get(i.batchId)))
          if (missing.length) throw conflict('BATCH_NOT_PUBLISHED', 'Còn dòng hàng chưa gán lô đã xuất bản video', { items: missing.map((i) => i.id).join(',') })
          order = await transition(order, ['PACKED'], { status: 'SHIPPED', trackingCode })
          break
        }
        case 'set_tracking':
          requireStatus(order, ['SHIPPED', 'DELIVERY_FAILED'])
          order = await transition(order, [order.status], { trackingCode: parseTracking(body.trackingCode) })
          break
        case 'deliver':
          requireStatus(order, ['SHIPPED'])
          order = await transition(order, ['SHIPPED'], { status: 'DELIVERED' })
          break
        case 'delivery_failed':
          requireStatus(order, ['SHIPPED'])
          order = await transition(order, ['SHIPPED'], { status: 'DELIVERY_FAILED' })
          break
        case 'cancel':
          requireStatus(order, CANCELLABLE)
          if (order.status === 'PENDING_PAYMENT') {
            order = await orders.cancelPending(order, 'admin', actor)
          } else {
            order = await orders.cancelPaidOrConfirmed(order, 'admin', actor)
            if (order.status !== 'CANCELLED') throw conflict('ORDER_STATE_CHANGED', 'Trạng thái đơn vừa thay đổi, tải lại trang')
          }
          break
        case 'cod_collected':
          if (order.paymentMethod !== 'cod' || order.paymentStatus !== 'COD_PENDING') throw conflict('INVALID_TRANSITION', 'Không phải đơn COD chờ thu')
          requireStatus(order, ['SHIPPED', 'DELIVERED'])
          order = await transition(order, [order.status], { paymentStatus: 'COD_COLLECTED', codCollectedAt: iso() })
          break
        case 'refund': {
          // D-70: admin chuyển khoản thủ công rồi ghi nhận ở đây
          if (order.paymentStatus !== 'REFUND_PENDING') throw conflict('INVALID_TRANSITION', 'Đơn không chờ hoàn tiền')
          const max = order.paidAmount ?? order.total
          if (!Number.isInteger(body.amount) || body.amount < 1 || body.amount > max) {
            throw new HttpError(400, 'VALIDATION_ERROR', 'Số tiền hoàn không hợp lệ', { amount: 'INVALID' })
          }
          const note = typeof body.note === 'string' ? body.note.trim() : ''
          if (!note || note.length > 500) throw new HttpError(400, 'VALIDATION_ERROR', 'Cần ghi chú hoàn tiền', { note: note ? 'TOO_LONG' : 'REQUIRED' })
          order = await transition(order, [order.status], { paymentStatus: 'REFUNDED', refundedAmount: body.amount, refundNote: note, refundedAt: iso() })
          break
        }
      }
      return { item: await present(order) }
    },

    // Gán lô cho dòng hàng (§21.6) — trước khi gửi hàng
    async assignBatch(id, itemId, batchId, actor) {
      const order = await load(id)
      if (!['CONFIRMED', 'IN_PRODUCTION', 'PACKED'].includes(order.status)) throw conflict('INVALID_TRANSITION', 'Chỉ gán lô trước khi gửi hàng')
      if (!order.items.some((i) => i.id === itemId)) throw notFound()
      if (batchId !== null) {
        const b = typeof batchId === 'string' && batchId.length <= 64 ? await repo.getBatchById(batchId) : null
        if (!b) throw new HttpError(400, 'VALIDATION_ERROR', 'Lô không tồn tại', { batchId: 'INVALID' })
      }
      const before = order.items.find((i) => i.id === itemId).batchId ?? null
      await repo.updateOrderItem(order.id, itemId, { batchId })
      if (before !== batchId) await orders.audit.log({ actor, entity: 'order', entityId: order.id, action: 'assign_batch', oldValue: { itemId, batchId: before }, newValue: { itemId, batchId } })
      return { item: await present(await load(id)) }
    },
  }
}
