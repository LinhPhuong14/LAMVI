import { orderMail } from './templates.js'

// No process queue or background promise: each invocation awaits a bounded leased batch.
export function createNotificationWorker({ outbox, repo, mailer, siteUrl, brand = null, now = () => new Date() }) {
  return async function run({ orderId = null, limit = 5 } = {}) {
    if (!mailer) return { claimed: 0, sent: 0, deferred: true }
    const jobs = await outbox.claim({ orderId, limit: Math.min(5, Math.max(1, limit)) })
    const result = { claimed: jobs.length, sent: 0, failed: 0 }
    await Promise.all(jobs.map(async (job) => {
      try {
        if (job.attempts > 6 || (job.delivery_started_at && now().getTime() - Date.parse(job.delivery_started_at) >= 23 * 3600_000)) {
          await outbox.settle(job, { status: 'dead', lease_until: null, last_error: 'RETRY_EXHAUSTED', ...(job.delivery_started_at && now().getTime() - Date.parse(job.delivery_started_at) >= 23 * 3600_000 ? { delivery_payload: null } : {}) })
          result.failed++
          return
        }
        const order = await repo.getOrderById(job.order_id)
        const profile = order && await repo.getProfile(order.userId)
        if (!order || !profile?.email) {
          await outbox.settle(job, { status: 'dead', last_error: !order ? 'ORDER_MISSING' : 'RECIPIENT_MISSING', lease_until: null })
          result.failed++
          return
        }
        // Immutable template inputs captured by the trigger; never persist QR/greeting/addresses.
        const mail = orderMail({ kind: job.event, order: { ...order, ...job.snapshot }, lang: profile.preferredLocale,
          name: profile.fullName, siteUrl, brand })
        const payload = job.delivery_payload ?? { to: profile.email, ...mail, idempotencyKey: `LAMVI-order-${job.id}` }
        if (!job.delivery_payload) {
          const owned = await outbox.settle(job, { delivery_payload: payload, delivery_started_at: now().toISOString() })
          if (!owned?.length) { result.failed++; return }
        }
        const accepted = await mailer.send(payload)
        await outbox.settle(job, { status: 'sent', sent_at: now().toISOString(), lease_until: null,
          provider_message_id: typeof accepted?.id === 'string' ? accepted.id.slice(0, 200) : null, last_error: null, delivery_payload: null })
        result.sent++
      } catch (error) {
        // Network/timeout/ack loss are uncertain: retry with the SAME provider idempotency key.
        // Other providers can duplicate delivery; sent means provider accepted, not delivered.
        const permanent = error?.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status)
        const exhausted = job.attempts >= 6 || (job.delivery_started_at && now().getTime() - Date.parse(job.delivery_started_at) >= 23 * 3600_000)
        await outbox.settle(job, { status: permanent || exhausted ? 'dead' : 'pending', lease_until: null,
          next_attempt_at: new Date(now().getTime() + Math.min(3600, 30 * 2 ** (job.attempts - 1)) * 1000).toISOString(),
          last_error: permanent ? 'PROVIDER_REJECTED' : exhausted ? 'RETRY_EXHAUSTED' : 'DELIVERY_UNCERTAIN' })
        result.failed++
      }
    }))
    result.saturated = jobs.length >= Math.min(5, Math.max(1, limit))
    return result
  }
}
