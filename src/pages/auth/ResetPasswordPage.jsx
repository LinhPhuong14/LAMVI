import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../../components/Field'
import { api } from '../../api/client.js'
import { useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import { useSubmit } from '../../auth/useForm.js'

// Link email của Supabase trả token khôi phục trong #hash (type=recovery)
function readRecoveryToken() {
  const params = new URLSearchParams(window.location.hash.slice(1))
  const token = params.get('access_token')
  if (token) {
    // Xoá token khỏi thanh địa chỉ/lịch sử
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  }
  return token && params.get('type') === 'recovery' ? token : null
}

export default function ResetPasswordPage() {
  const { t, path } = useI18n()
  const [token] = useState(readRecoveryToken)
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  async function onSubmit(e) {
    e.preventDefault()
    await run(async () => {
      await api('/auth/reset-password', { method: 'POST', body: { password }, token })
      setDone(true)
    })
  }

  let content
  if (done) {
    content = (
      <p className="notice success" role="status">
        {t('auth.resetDone')}
      </p>
    )
  } else if (!token || error === 'UNAUTHORIZED') {
    content = (
      <p className="notice error" role="alert">
        {t('auth.resetInvalid')}
      </p>
    )
  } else {
    content = (
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field
          label={t('auth.newPassword')}
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fields.password}
          hint={t('auth.passwordHint')}
        />
        {error && !fields.password && (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? t('auth.submitting') : t('auth.submitReset')}
        </button>
      </form>
    )
  }

  return (
    <AuthShell title={t('auth.resetTitle')} footer={<Link to={path('/login')}>{t('auth.toLogin')}</Link>}>
      {content}
    </AuthShell>
  )
}
