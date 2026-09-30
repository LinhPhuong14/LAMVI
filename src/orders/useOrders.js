import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'

/** Danh sách đơn của tôi (FR-ACC-002). Trả { status, items, error, reload }. */
export function useMyOrders() {
  const { user, authedApi } = useAuth()
  const { lang } = useI18n()
  const [state, setState] = useState({ status: 'loading', items: [], error: null })

  const reload = useCallback(async () => {
    if (!user) return
    try {
      const r = await authedApi('/orders', { lang })
      setState({ status: 'ok', items: r.items, error: null })
    } catch (err) {
      setState({ status: 'error', items: [], error: err.code ?? 'INTERNAL_ERROR' })
    }
  }, [user, authedApi, lang])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong reload đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    reload()
  }, [reload])

  // Chưa đăng nhập thì chắc chắn không có đơn nào — suy ra khi render, không đặt state trong effect
  if (!user) return { status: 'ok', items: [], error: null, reload }
  return { ...state, reload }
}
