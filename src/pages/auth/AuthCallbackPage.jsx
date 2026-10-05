import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useI18n } from '../../i18n/index.js'
import { safeNext, useAuth } from '../../auth/context.js'
import { landingPath } from '../../auth/landing.js'
import AuthShell from './AuthShell'

// D-78, T-49: sau khi Google xác nhận, server đã đặt cookie phiên HttpOnly và chuyển về đây (không
// có token trên URL). Trang đổi cookie lấy access token rồi vào tài khoản.
export default function AuthCallbackPage() {
  const { t, path } = useI18n()
  const { refreshSession } = useAuth()
  const navigate = useNavigate()
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    const next = new URLSearchParams(window.location.search).get('next')
    refreshSession().then(
      async (session) => {
        // Có ?next thì tôn trọng; không có thì admin/IT vào thẳng /admin
        const target = next ? safeNext(next, path('/account')) : await landingPath(session.accessToken, path('/account'))
        navigate(target, { replace: true })
      },
      () => setFailed(true),
    )
  }, [refreshSession, navigate, path])

  return (
    <AuthShell title={t('auth.loginTitle')}>
      {failed ? (
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
