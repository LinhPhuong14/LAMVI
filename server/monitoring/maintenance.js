// D-54: chế độ bảo trì — lưu ở app_settings (key 'maintenance'), cache ngắn để nhiều server đồng bộ.
const KEY = 'maintenance'
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS']
// Vẫn cho phép khi bảo trì: đăng nhập (để IT vào tắt) và API IT [ASSUMPTION]
const ALLOWED = [/^\/api\/it(\/|$)/, /^\/api\/auth\/(login|refresh|logout)$/]

export function createMaintenance({ repo, ttlMs = 15_000, now = () => Date.now() }) {
  let cache = null
  let fetchedAt = 0

  async function get() {
    if (cache && now() - fetchedAt < ttlMs) return cache
    try {
      const s = await repo.getSetting(KEY)
      cache = { enabled: Boolean(s?.value?.enabled), updatedAt: s?.updatedAt ?? null, updatedBy: s?.updatedBy ?? null }
    } catch (err) {
      // Không đọc được cài đặt → không chặn web (fail-open), ghi log
      console.error('[maintenance] get', err?.message ?? err)
      cache ??= { enabled: false, updatedAt: null, updatedBy: null }
    }
    fetchedAt = now()
    return cache
  }

  async function set(enabled, userId) {
    const s = await repo.setSetting(KEY, { enabled: Boolean(enabled) }, userId)
    cache = { enabled: Boolean(s.value.enabled), updatedAt: s.updatedAt, updatedBy: s.updatedBy }
    fetchedAt = now()
    return cache
  }

  // API ghi trả 503 khi bảo trì; GET vẫn chạy
  async function apiGuard(req, res, next) {
    if (SAFE_METHODS.includes(req.method) || ALLOWED.some((re) => re.test(req.originalUrl.split('?')[0]))) return next()
    if (!(await get()).enabled) return next()
    res.set('Retry-After', '600')
    res.status(503).json({ error: { code: 'MAINTENANCE', message: 'Hệ thống đang bảo trì' } })
  }

  return { get, set, apiGuard }
}
