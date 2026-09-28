import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'

// Tải danh sách admin; reload() sau khi ghi
export function useAdminList(path) {
  const { authedApi } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let alive = true
    authedApi(path)
      .then((res) => alive && setState({ status: 'ok', items: res.items }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [authedApi, path, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}
