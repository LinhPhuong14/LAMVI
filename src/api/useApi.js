import { useContext, useEffect, useRef, useState } from 'react'
import { api, ApiError } from './client.js'
import { DataContext } from '../seo/context.js'

// Dữ liệu SSR nạp sẵn cho key này. Nhiều component có thể dùng chung một key khi hydrate
// (vd trang chủ và footer cùng /products) — AppShell xoá cache sau khi hydrate xong.
function fromInitial(store, key) {
  const hit = store?.get(key)
  if (!hit) return null
  return hit.error
    ? { status: 'error', error: new ApiError(hit.error.status, hit.error.code), key }
    : { status: 'ok', data: hit.data, key }
}

// Tải dữ liệu GET theo path + ngôn ngữ; trả { status: 'loading' | 'ok' | 'error', data, error }
export function useApi(path, lang) {
  const initial = useContext(DataContext)
  const key = `${path}|${lang}`
  const [state, setState] = useState(() => fromInitial(initial, key) ?? { status: 'loading', key: null })
  // Key đã có dữ liệu SSR lúc khởi tạo → lần effect đầu không gọi lại API
  const ssrKey = useRef(state.key)

  useEffect(() => {
    if (ssrKey.current === key) {
      ssrKey.current = null
      return
    }
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
