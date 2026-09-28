import { useEffect, useState } from 'react'
import { api } from './client.js'

// Tải dữ liệu GET theo path + ngôn ngữ; trả { status: 'loading' | 'ok' | 'error', data, error }
export function useApi(path, lang) {
  const [state, setState] = useState({ status: 'loading', key: null })
  const key = `${path}|${lang}`

  useEffect(() => {
    let alive = true
    api(path, { lang })
      .then((data) => alive && setState({ status: 'ok', data, key }))
      .catch((error) => alive && setState({ status: 'error', error, key }))
    return () => {
      alive = false
    }
  }, [path, lang, key])

  // Đổi path/lang → coi như đang tải lại cho tới khi có kết quả mới
  return state.key === key ? state : { status: 'loading' }
}
