import { randomBytes } from 'node:crypto'
import express from 'express'
import { BATCH_VIDEO_BUCKET } from '../supabase/storage.js'

// Storage bộ nhớ (T-04) — mô phỏng Supabase Storage signed upload URL cho dev/test.
// Có router riêng: PUT /api/dev-storage/upload/:token (tải lên), GET /api/dev-storage/o/* (đọc).
export function createMemoryStorage({ maxBytes = 500 * 1024 * 1024, defaultBucket = BATCH_VIDEO_BUCKET } = {}) {
  // Khoá theo `bucket/path` để hai bucket không đụng nhau (giống Supabase)
  const objects = new Map() // key → { bytes, contentType }
  const tokens = new Map() // token → { key, contentType }
  const keyOf = (path, bucket = defaultBucket) => `${bucket}/${path}`

  const router = express.Router()
  router.put('/dev-storage/upload/:token', express.raw({ type: () => true, limit: maxBytes }), (req, res) => {
    const t = tokens.get(req.params.token)
    if (!t) return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Token tải lên không hợp lệ' } })
    tokens.delete(req.params.token)
    objects.set(t.key, { bytes: req.body, contentType: req.get('content-type') || t.contentType })
    res.json({ Key: t.key })
  })
  router.get(/^\/dev-storage\/o\/(.+)$/, (req, res) => {
    const o = objects.get(decodeURIComponent(req.params[0]))
    if (!o) return res.status(404).end()
    res.type(o.contentType).send(o.bytes)
  })

  return {
    router,
    objects,
    // Cho test đọc object mà không cần biết cách đặt khoá `bucket/path`
    getObject: (path, bucket) => objects.get(keyOf(path, bucket)),

    async ping() {
      return true
    },

    async createUpload({ path, contentType, bucket }) {
      const token = randomBytes(16).toString('hex')
      tokens.set(token, { key: keyOf(path, bucket), contentType })
      return { uploadUrl: `/api/dev-storage/upload/${token}`, headers: { 'Content-Type': contentType } }
    },

    // Video lô dùng bucket mặc định của adapter (batch-videos)
    createVideoUpload({ path, contentType }) {
      return this.createUpload({ path, contentType })
    },

    async statObject(path, bucket) {
      const o = objects.get(keyOf(path, bucket))
      return o ? { size: o.bytes?.length ?? 0, contentType: o.contentType } : null
    },

    async removeObject(path, bucket) {
      objects.delete(keyOf(path, bucket))
    },

    async signedUrl(path, bucket, { download } = {}) {
      return `/api/dev-storage/o/${encodeURIComponent(keyOf(path, bucket))}${download ? `?download=${encodeURIComponent(download)}` : ''}`
    },

    publicUrl(path, bucket) {
      return `/api/dev-storage/o/${encodeURIComponent(keyOf(path, bucket))}`
    },
  }
}
