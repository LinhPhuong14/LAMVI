import { Router } from 'express'
import { requireIt } from '../middleware/auth.js'
import { HttpError } from '../errors.js'

export function notificationOperationsRouter({ repo, auth, outbox }) {
  const r = Router()
  r.use('/it/notifications', requireIt(auth, repo))
  r.get('/it/notifications', async (req, res) => {
    const status = req.query.status ?? 'dead'
    if (!['pending', 'leased', 'sent', 'dead'].includes(status)) throw new HttpError(400, 'VALIDATION_ERROR', 'Trạng thái không hợp lệ')
    res.json({ items: await outbox.list({ status, limit: 50 }) })
  })
  r.post('/it/notifications/:id/retry', async (req, res) => {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(req.params.id)) throw new HttpError(400, 'VALIDATION_ERROR', 'Mã không hợp lệ')
    if (!await outbox.retry(req.params.id, req.user.id)) throw new HttpError(409, 'NOTIFICATION_NOT_RETRYABLE', 'Chỉ thử lại thư lỗi trong cửa sổ an toàn của nhà cung cấp; cần đối soát thư cũ')
    res.json({ queued: true })
  })
  return r
}
