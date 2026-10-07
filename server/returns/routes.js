import { Router } from 'express'
import { requireAuth, requireAdmin } from '../middleware/auth.js'
import { createReturnsService } from './service.js'
import { rateLimit } from '../middleware/rateLimit.js'
export function returnsRouter({ repo, returnsRepo, auth, storage, config = {} }) {
  const r = Router(),
    guard = requireAuth(auth),
    admin = requireAdmin(auth, repo)
  const service = createReturnsService({
    repo,
    returnsRepo,
    storage,
    maxBytes: (config.returnsVideoMaxMb ?? 0) * 1024 * 1024,
  })
  const limit = rateLimit({
    repo,
    salt: config.mayHashSalt,
    name: 'return-upload',
    max: 10,
    windowSec: 3600,
    keys: (req) => [`u:${req.user.id}`],
    enabled: config.rateLimit?.enabled !== false,
  })
  r.get('/orders/:code/returns', guard, async (req, res) =>
    res.json(await service.ownerList(req.params.code, req.user.id)),
  )
  r.post('/orders/:code/returns/upload', guard, limit, async (req, res) =>
    res.status(201).json(await service.upload(req.params.code, req.user.id, req.body ?? {})),
  )
  r.post('/returns/:id/submit', guard, limit, async (req, res) =>
    res.json({
      item: await service.submit(req.params.id, req.user.id, req.body ?? {}),
    }),
  )
  r.get('/admin/returns', admin, async (req, res) => res.json(await service.adminList(req.query)))
  r.post('/admin/returns/:id/resolve', admin, async (req, res) =>
    res.json({ item: await service.resolve(req.params.id, req.user.id, req.body ?? {}) }),
  )
  r.get('/admin/returns/:id/video', admin, async (req, res) => res.json(await service.adminVideo(req.params.id)))
  r.patch('/admin/returns/:id', admin, async (req, res) =>
    res.json({
      item: await service.decide(req.params.id, req.user.id, req.body ?? {}),
    }),
  )
  return r
}
