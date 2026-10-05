import { Router } from 'express'
import { HttpError, notFound } from '../errors.js'
import { requireAdmin } from '../middleware/auth.js'

const body = (req) => (req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {})
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const USER_ROLES = ['customer', 'admin', 'it']
const PAGE_SIZE = 20

const present = (p, orderCount) => ({
  id: p.id,
  email: p.email ?? null,
  fullName: p.fullName ?? null,
  phone: p.phone ?? null,
  role: p.role,
  preferredLocale: p.preferredLocale,
  createdAt: p.createdAt,
  locked: Boolean(p.lockedAt),
  lockedAt: p.lockedAt ?? null,
  lockedReason: p.lockedReason ?? null,
  ...(orderCount === undefined ? {} : { orderCount }),
})

/**
 * Quản lý người dùng trong admin (G-19, §7 trạng thái "bị khoá", §3.2).
 * - Admin và IT: xem, tìm, khoá/mở khoá khách hàng.
 * - Chỉ IT: đổi vai trò, khoá/mở khoá admin và IT (D-38, D-51).
 * - Không ai tự khoá hay tự đổi vai trò của chính mình (tránh tự khoá mình ra, mất quyền IT cuối cùng).
 * Mọi thay đổi ghi audit_log (NFR-AUD-001).
 */
export function adminUsersRouter({ repo, auth }) {
  const r = Router()
  r.use('/admin/users', requireAdmin(auth, repo))

  const itRemains = async () => (await repo.listProfiles({ role: 'it', locked: false, limit: 1 })).total > 0

  const target = async (req) => {
    if (!UUID_RE.test(req.params.id)) throw notFound()
    const p = await repo.getProfile(req.params.id)
    if (!p) throw notFound()
    return p
  }

  async function logUser(req, id, action, oldValue, newValue) {
    if (!repo.appendAuditLog) return
    try {
      await repo.appendAuditLog([{ actorId: req.user.id, actorRole: req.role, entity: 'user', entityId: id, action, oldValue, newValue }])
    } catch (err) {
      console.error('[audit]', err)
    }
  }

  // Admin chỉ được đụng vào khách hàng; admin/it khác thuộc quyền IT
  function assertCanManage(req, p) {
    if (p.id === req.user.id) throw new HttpError(409, 'CANNOT_MANAGE_SELF', 'Không thể tự thao tác lên tài khoản của mình')
    if (req.role !== 'it' && p.role !== 'customer') throw new HttpError(403, 'FORBIDDEN', 'Không có quyền')
  }

  r.get('/admin/users', async (req, res) => {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const role = USER_ROLES.includes(req.query.role) ? req.query.role : undefined
    const locked = req.query.status === 'locked' ? true : req.query.status === 'active' ? false : undefined
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined
    const { items, total } = await repo.listProfiles({ q, role, locked, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE })
    const counts = await repo.countOrdersByUsers(items.map((p) => p.id))
    res.json({ items: items.map((p) => present(p, counts[p.id] ?? 0)), total, page, pageSize: PAGE_SIZE })
  })

  r.get('/admin/users/:id', async (req, res) => {
    const p = await target(req)
    const orders = await repo.listOrdersByUser(p.id, { limit: 20 })
    // Số đơn thật (danh sách đơn ở đây chỉ lấy 20 đơn gần nhất)
    const counts = await repo.countOrdersByUsers([p.id])
    res.json({
      item: present(p, counts[p.id] ?? orders.length),
      orders: orders.map((o) => ({ code: o.code, status: o.status, total: o.total, paymentMethod: o.paymentMethod, createdAt: o.createdAt })),
      audit: await repo.listAuditLog({ entity: 'user', entityId: p.id, limit: 50 }),
    })
  })

  r.post('/admin/users/:id/lock', async (req, res) => {
    const p = await target(req)
    assertCanManage(req, p)
    if (p.lockedAt) return res.json({ item: present(p) })
    // Cắt theo ký tự (không theo đơn vị UTF-16) để không tách đôi emoji
    const reason = typeof body(req).reason === 'string' ? [...body(req).reason.trim()].slice(0, 300).join('') || null : null
    const item = await repo.lockProfile(p.id, { lockedAt: new Date().toISOString(), lockedReason: reason })
    // Người khác vừa khoá trước một nhịp → coi như đã xong, không ghi nhật ký lần hai
    if (!item) return res.json({ item: present(await repo.getProfile(p.id)) })
    if (p.role === 'it' && !(await itRemains())) {
      await repo.unlockProfile(p.id)
      throw new HttpError(409, 'LAST_IT', 'Phải còn ít nhất một tài khoản IT đang hoạt động')
    }
    await logUser(req, p.id, 'lock', { locked: false }, { locked: true, reason })
    res.json({ item: present(item) })
  })

  r.post('/admin/users/:id/unlock', async (req, res) => {
    const p = await target(req)
    assertCanManage(req, p)
    if (!p.lockedAt) return res.json({ item: present(p) })
    const item = await repo.unlockProfile(p.id)
    if (!item) return res.json({ item: present(await repo.getProfile(p.id)) })
    await logUser(req, p.id, 'unlock', { locked: true }, { locked: false })
    res.json({ item: present(item) })
  })

  // D-38, D-51: chỉ IT cấp/đổi vai trò
  r.patch('/admin/users/:id', async (req, res) => {
    const p = await target(req)
    if (req.role !== 'it') throw new HttpError(403, 'FORBIDDEN', 'Không có quyền')
    if (p.id === req.user.id) throw new HttpError(409, 'CANNOT_MANAGE_SELF', 'Không thể tự đổi vai trò của mình')
    const { role } = body(req)
    if (!USER_ROLES.includes(role)) throw new HttpError(400, 'VALIDATION_ERROR', 'Vai trò không hợp lệ', { role: 'INVALID' })
    if (role === p.role) return res.json({ item: present(p) })
    const item = await repo.updateProfileAdmin(p.id, { role })
    // Hạ quyền một IT: không có giao dịch nhiều dòng nên kiểm lại SAU khi ghi, nếu không còn IT nào
    // (hai IT hạ quyền nhau cùng lúc) thì hoàn tác — bất biến "luôn còn ít nhất một IT hoạt động"
    if (p.role === 'it' && role !== 'it' && !(await itRemains())) {
      await repo.updateProfileAdmin(p.id, { role: p.role })
      throw new HttpError(409, 'LAST_IT', 'Phải còn ít nhất một tài khoản IT đang hoạt động')
    }
    await logUser(req, p.id, 'role', { role: p.role }, { role })
    res.json({ item: present(item) })
  })

  return r
}
