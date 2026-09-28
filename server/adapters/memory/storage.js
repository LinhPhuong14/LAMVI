import { randomBytes } from 'node:crypto'
import express from 'express'

// Storage bộ nhớ (T-04) — mô phỏng Supabase Storage signed upload URL cho dev/test.
// Có router riêng: PUT /api/dev-storage/upload/:token (tải lên), GET /api/dev-storage/o/* (đọc).
export function createMemoryStorage({ maxBytes = 500 * 1024 * 1024 } = {}) {
  const objects = new Map() // path → { bytes, contentType }
  const tokens = new Map() // token → { path, contentType }

  const router = express.Router()
  router.put('/dev-storage/upload/:token', express.raw({ type: () => true, limit: maxBytes }), (req, res) => {
    const t = tokens.get(req.params.token)
    if (!t) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Token tải lên không hợp lệ' } })
    tokens.delete(req.params.token)
    objects.set(t.path, { bytes: req.body, contentType: req.get('content-type') || t.contentType })
    res.json({ Key: t.path })
  })
  router.get(/^\/dev-storage\/o\/(.+)$/, (req, res) => {
    const o = objects.get(decodeURIComponent(req.params[0]))
    if (!o) return res.status(404).end()
    res.type(o.contentType).send(o.bytes)
  })

  return {
    router,
    objects,

    async createVideoUpload({ path, contentType }) {
      const token = randomBytes(16).toString('hex')
      tokens.set(token, { path, contentType })
      return { uploadUrl: `/api/dev-storage/upload/${token}`, headers: { 'Content-Type': contentType } }
    },

    async statObject(path) {
      const o = objects.get(path)
      return o ? { size: o.bytes?.length ?? 0, contentType: o.contentType } : null
    },

    publicUrl(path) {
      return `/api/dev-storage/o/${encodeURIComponent(path)}`
    },
  }
}
