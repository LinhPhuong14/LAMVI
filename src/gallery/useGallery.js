import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'

/** Gallery đèn + chăn Đông Hồ của tôi (D-97). Trả { status, data, error }. */
export function useGallery(enabled = true) {
  const { user, authedApi } = useAuth()
  const { lang } = useI18n()
  const [state, setState] = useState({ status: 'loading', data: null, error: null })

  const load = useCallback(async () => {
    if (!user || !enabled) return
    try {
      setState({ status: 'ok', data: await authedApi('/gallery', { lang }), error: null })
    } catch (err) {
      setState({ status: 'error', data: null, error: err.code ?? 'INTERNAL_ERROR' })
    }
  }, [user, authedApi, lang, enabled])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  return state
}
