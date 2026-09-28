import { useCallback, useMemo, useRef, useState } from 'react'
import { api, ApiError } from '../api/client.js'
import { AuthContext, loadSession, saveSession } from './context.js'

const pickSession = (s) => ({ accessToken: s.accessToken, refreshToken: s.refreshToken, expiresAt: s.expiresAt, user: s.user })

export default function AuthProvider({ children }) {
  const [session, setSession] = useState(loadSession)
  const sessionRef = useRef(session)
  const refreshing = useRef(null)

  const update = useCallback((next) => {
    sessionRef.current = next
    saveSession(next)
    setSession(next)
  }, [])

  const login = useCallback(
    async (email, password) => {
      const s = await api('/auth/login', { method: 'POST', body: { email, password } })
      update(pickSession(s))
      return s
    },
    [update],
  )

  // Gộp các lần refresh đồng thời thành một
  const refresh = useCallback(() => {
    const current = sessionRef.current
    if (!current?.refreshToken) {
      if (current) update(null)
      return Promise.reject(new ApiError(401, 'UNAUTHORIZED'))
    }
    refreshing.current ??= api('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } })
      .then((s) => {
        update(pickSession(s))
        return s
      })
      .catch((err) => {
        // Chỉ xoá phiên khi refresh token bị từ chối; lỗi mạng/5xx giữ phiên để thử lại sau
        if (err.status === 400 || err.status === 401) update(null)
        throw err
      })
      .finally(() => {
        refreshing.current = null
      })
    return refreshing.current
  }, [update])

  // Gọi API có đăng nhập; token hết hạn → refresh một lần rồi thử lại
  const authedApi = useCallback(
    async (path, opts = {}) => {
      const token = sessionRef.current?.accessToken
      if (!token) throw new ApiError(401, 'UNAUTHORIZED')
      try {
        return await api(path, { ...opts, token })
      } catch (err) {
        if (err.status !== 401) throw err
        const s = await refresh()
        return api(path, { ...opts, token: s.accessToken })
      }
    },
    [refresh],
  )

  const logout = useCallback(async () => {
    const token = sessionRef.current?.accessToken
    update(null)
    if (token) await api('/auth/logout', { method: 'POST', token }).catch(() => {})
  }, [update])

  const value = useMemo(
    () => ({ session, user: session?.user ?? null, login, logout, authedApi }),
    [session, login, logout, authedApi],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
