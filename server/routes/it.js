import { Router } from 'express'
import { HttpError } from '../errors.js'
import { requireIt } from '../middleware/auth.js'
import { runHealthChecks } from '../monitoring/health.js'
import { RANGES } from '../monitoring/metrics.js'

const rangeOf = (req) => (Object.hasOwn(RANGES, req.query.range) ? req.query.range : '24h')

// D-51, D-52: dashboard IT — sức khoẻ, số liệu API, lỗi gần đây, chế độ bảo trì (D-54)
export function itRouter({ repo, auth, storage, config, metrics, maintenance }) {
  const r = Router()
  r.use('/it', requireIt(auth, repo))

  r.get('/it/health', async (req, res) => {
    const health = await runHealthChecks({ repo, auth, storage, config })
    res.json({ ...health, maintenance: await maintenance.get() })
  })

  r.get('/it/metrics', async (req, res) => {
    res.json(await metrics.summary(rangeOf(req)))
  })

  r.get('/it/errors', async (req, res) => {
    res.json({ items: await metrics.recentErrors(rangeOf(req)) })
  })

  r.put('/it/maintenance', async (req, res) => {
    const enabled = req.body?.enabled
    if (typeof enabled !== 'boolean') {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { enabled: 'INVALID' })
    }
    const state = await maintenance.set(enabled, req.user.id)
    console.warn(`[maintenance] ${enabled ? 'BẬT' : 'TẮT'} bởi ${req.user.email}`)
    res.json(state)
  })

  return r
}
