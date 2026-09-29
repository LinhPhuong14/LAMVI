import { Router } from 'express'
import { HttpError } from '../errors.js'
import { normalizeLang } from '../i18n.js'
import { bearerToken, requireAdmin, requireAuth } from '../middleware/auth.js'
import { MAY_SETTING_KEY, loadMayConfig, validateMayConfig } from '../may/config.js'

const SESSION_RE = /^[A-Za-z0-9-]{8,64}$/

// Lịch sử do trình duyệt gửi (khách vãng lai không lưu server — BR-AI-008); chỉ giữ dạng hợp lệ
function cleanHistory(h) {
  if (!Array.isArray(h)) return []
  return h
    .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 1000) }))
}

// FR-AI-001…007
export function mayRouter({ repo, auth, may }) {
  const r = Router()

  r.post('/may/chat', async (req, res) => {
    const b = req.body && typeof req.body === 'object' ? req.body : {}
    // Đăng nhập là tuỳ chọn: có token hợp lệ → hạn mức theo tài khoản + lưu lịch sử
    const token = bearerToken(req)
    const user = token ? await auth.getUser(token) : null
    if (token && !user) throw new HttpError(401, 'UNAUTHORIZED', 'Phiên hết hạn')
    if (!user && !(typeof b.sessionId === 'string' && SESSION_RE.test(b.sessionId))) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Thiếu sessionId', { sessionId: 'INVALID' })
    }
    const reply = await may.chat({
      message: b.message,
      lang: normalizeLang(b.lang ?? req.query.lang),
      sessionId: typeof b.sessionId === 'string' ? b.sessionId.slice(0, 64) : 'user',
      history: cleanHistory(b.history),
      user,
      ip: req.ip ?? '',
    })
    res.json({ reply })
  })

  // FR-ACC-004: xem lịch sử chat của chính mình
  r.get('/may/history', requireAuth(auth), async (req, res) => {
    const items = await repo.listChatMessages(req.user.id, { limit: 100 })
    res.json({ items: items.map(({ role, kind, content, lang, createdAt }) => ({ role, kind, content, lang, createdAt })) })
  })

  // FR-AI-007: cấu hình Mây (admin, IT)
  const admin = requireAdmin(auth, repo)
  r.get('/admin/may/config', admin, async (req, res) => {
    res.json({ config: await loadMayConfig(repo) })
  })
  r.put('/admin/may/config', admin, async (req, res) => {
    const current = await loadMayConfig(repo)
    const { errors, values } = validateMayConfig(req.body && typeof req.body === 'object' ? req.body : {}, current)
    if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
    await repo.setSetting(MAY_SETTING_KEY, values, req.user.id)
    if (values.openaiEnabled !== current.openaiEnabled) {
      console.warn(`[may] OpenAI ${values.openaiEnabled ? 'BẬT' : 'TẮT'} bởi ${req.user.email} (I-14)`)
    }
    res.json({ config: values })
  })
  r.get('/admin/may/usage', admin, async (req, res) => {
    res.json(await may.usage())
  })

  return r
}
