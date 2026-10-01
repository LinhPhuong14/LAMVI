import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/index.js'
import { safeNext, useAuth } from '../../auth/context.js'
import AuthShell from './AuthShell'

function readSession() {
  if (typeof window === 'undefined') return null
  try {
    const raw = new URLSearchParams(window.location.hash.slice(1)).get('s')
    const { session, next } = JSON.parse(atob(raw.replace(/-/g, '+').replace(/_/g, '/')))
    return session?.accessToken ? { session, next } : null
  } catch {
    return null
  }
}

// D-78: server chuyển về đây kèm phiên trong fragment (#s=…); lưu phiên rồi vào tài khoản
export default function AuthCallbackPage() {
  const { t, path } = useI18n()
  const { acceptSession } = useAuth()
  const navigate = useNavigate()
  const [payload] = useState(readSession)

  useEffect(() => {
    if (!payload) return
    acceptSession(payload.session)
    window.history.replaceState(null, '', window.location.pathname)
    navigate(safeNext(payload.next, path('/account')), { replace: true })
  }, [payload, acceptSession, navigate, path])

  return (
    <AuthShell title={t('auth.loginTitle')}>
      {!payload ? (
        <>
          <p className="notice error" role="alert">
            {t('errors.GOOGLE_FAILED')}
          </p>
          <div className="auth-footer">
            <Link to={path('/login')}>{t('auth.toLogin')}</Link>
          </div>
        </>
      ) : (
        <p className="notice" role="status">
          {t('auth.submitting')}
        </p>
      )}
    </AuthShell>
  )
}
