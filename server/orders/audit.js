// NFR-AUD-001: log thay đổi trạng thái đơn, coupon, hoàn tiền (ai, khi nào, giá trị cũ/mới)
// actor: { id, role } — role: 'customer' | 'admin' | 'it' | 'system'
export const SYSTEM = { id: null, role: 'system' }

const ORDER_KEYS = ['status', 'paymentStatus', 'productionStage', 'trackingCode', 'paidAmount', 'paymentRef', 'refundedAmount', 'refundNote', 'cancelReason', 'flags', 'codCollectedAt']

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

export function createAudit({ repo, now = () => Date.now() }) {
  // Ghi log không được làm hỏng thao tác đã thực hiện → chỉ ghi lỗi ra console
  async function log({ actor = SYSTEM, entity, entityId, action, oldValue = null, newValue = null }) {
    try {
      await repo.appendAudit({
        at: new Date(now()).toISOString(),
        actorId: actor.id ?? null,
        actorRole: actor.role ?? 'system',
        entity,
        entityId: String(entityId),
        action,
        oldValue,
        newValue,
      })
    } catch (err) {
      console.error('[audit]', entity, entityId, action, err?.message ?? err)
    }
  }

  // Ghi các trường đơn đã đổi giữa hai bản (before = null khi tạo đơn)
  async function orderChange(before, after, actor, action) {
    if (!after) return
    if (!before) {
      return log({ actor, entity: 'order', entityId: after.id, action, newValue: { status: after.status, paymentStatus: after.paymentStatus, total: after.total, couponCode: after.couponCode } })
    }
    const oldValue = {}
    const newValue = {}
    for (const k of ORDER_KEYS) {
      if (same(before[k], after[k])) continue
      oldValue[k] = before[k] ?? null
      newValue[k] = after[k] ?? null
    }
    if (Object.keys(newValue).length) await log({ actor, entity: 'order', entityId: after.id, action, oldValue, newValue })
  }

  return { log, orderChange }
}
