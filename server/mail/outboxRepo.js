// Service-role only; the SQL trigger enqueues events in the order transaction.
export function createNotificationOutboxRepo(client) {
  const unwrap = ({ data, error }) => { if (error) throw error; return data }
  return {
    async list({ status = 'dead', limit = 50 } = {}) {
      return unwrap(await client.from('notification_jobs').select('id,order_id,event,status,attempts,next_attempt_at,lease_until,sent_at,last_error,created_at')
        .eq('status', status).order('created_at', { ascending: false }).limit(Math.min(100, limit)))
    },
    async retry(id, actorId) {
      return unwrap(await client.rpc('retry_notification_job', { p_id: id, p_actor_id: actorId }))
    },
    async claim({ orderId = null, limit = 5 } = {}) {
      return unwrap(await client.rpc('claim_notification_jobs', { p_order_id: orderId, p_limit: limit }))
    },
    async settle(job, values) {
      return unwrap(await client.from('notification_jobs').update(values)
        .eq('id', job.id).eq('lease_token', job.lease_token).eq('status', 'leased').select('id'))
    },
  }
}
