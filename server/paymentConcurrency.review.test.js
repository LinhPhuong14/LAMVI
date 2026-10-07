// Independent T-11 QA for bounded webhook retries and financial CAS protection.
import { describe, expect, it, vi } from 'vitest'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createOrderService } from './orders/service.js'

const fixture = (over = {}) => ({ id: 'payment-review', code: 'LV-REVIEW', payosOrderCode: 123456,
  status: 'pending_payment', paymentStatus: 'pending', paymentExpiresAt: '2030-01-01T00:00:00Z', total: 123000,
  items: [], ...over })
const paid = { orderCode: 123456, amount: 123000, paid: true, reference: 'verified-transfer' }
describe('independent payment CAS QA', () => {
  it('continual contention returns retryable503 rather than acknowledging unpaid order', async () => {
    const repo = createMemoryRepo({ orders: [fixture()] })
    repo.updateOrderIfStatus = vi.fn(async () => null)
    const notify = vi.fn()
    const service = createOrderService({ repo, notify, now: () => new Date('2026-10-07') })
    await expect(service.applyPayosWebhook(paid)).rejects.toMatchObject({ status: 503, code: 'PAYMENT_RETRY_REQUIRED' })
    expect(repo.updateOrderIfStatus).toHaveBeenCalledTimes(3)
    expect((await repo.getOrderByPayosCode(123456)).paymentStatus).toBe('pending')
    expect(notify).not.toHaveBeenCalled()
  })
  it('a refund committing while late-payment CAS waits cannot be overwritten', async () => {
    const repo = createMemoryRepo({ orders: [fixture({ status: 'cancelled', paymentStatus: 'expired' })] })
    const update = repo.updateOrderIfStatus.bind(repo)
    let raced = false
    repo.updateOrderIfStatus = vi.fn(async (...args) => {
      if (!raced) { raced = true; await repo.updateOrder('payment-review', { paymentStatus: 'refunded' }) }
      return update(...args)
    })
    const service = createOrderService({ repo })
    const result = await service.applyPayosWebhook(paid)
    expect(result.idempotent).toBe(true)
    expect(result.order.paymentStatus).toBe('refunded')
    expect((await repo.getOrderByPayosCode(123456)).paymentStatus).toBe('refunded')
  })
  it('manual late-payment refund rejects a stale flag snapshot instead of overwriting a changed flag', async () => {
    const order = fixture({ status: 'cancelled', paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' })
    const repo = createMemoryRepo({ orders: [order] })
    await repo.updateOrder(order.id, { paymentFlag: 'AMOUNT_MISMATCH' })
    const notify = vi.fn()
    const service = createOrderService({ repo, notify })
    await expect(service.markRefunded(order, 'admin', 'Bank transfer')).rejects.toMatchObject({ status: 409 })
    expect((await repo.getOrderById(order.id)).paymentStatus).toBe('paid')
    expect(notify).not.toHaveBeenCalled()
  })

})
