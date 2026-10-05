import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../../components/Field'
import { api } from '../../api/client.js'
import { useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import PasswordRules from '../../components/PasswordRules.jsx'
import { useSubmit } from '../../auth/useForm.js'

// T-49: link trong thư là /reset-password#t=<token một lần>. Fragment không gửi lên server, nên
// token không vào log hay header Referer; đọc xong xoá khỏi thanh địa chỉ/lịch sử.
function readResetToken() {
  const token = new URLSearchParams(window.location.hash.slice(1)).get('t')
  if (window.location.hash) window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
  return token || null
}

export default function ResetPasswordPage() {
  const { t, path } = useI18n()
  const [token] = useState(readResetToken)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [mismatch, setMismatch] = useState(false)
  const [done, setDone] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  async function onSubmit(e) {
    e.preventDefault()
    // Kiểm khớp ngay ở trình duyệt để khỏi tốn một lượt gọi; server vẫn kiểm lại (D-91)
    if (password !== confirm) {
      setMismatch(true)
      return
    }
    setMismatch(false)
    await run(async () => {
      await api('/auth/reset-password', { method: 'POST', body: { token, password, confirmPassword: confirm } })
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
  } else if (!token || error === 'INVALID_RESET_TOKEN') {
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
          toggle
          required
          value={password}
          onChange={(e) => {
            setPassword(e.target.value)
            setMismatch(false)
          }}
          error={fields.password}
        />
        <Field
          label={t('auth.confirmPassword')}
          type="password"
          autoComplete="new-password"
          toggle
          required
          value={confirm}
          onChange={(e) => {
            setConfirm(e.target.value)
            setMismatch(false)
          }}
          error={mismatch ? 'PASSWORD_MISMATCH' : fields.confirmPassword}
        />
        <PasswordRules password={password} confirm={confirm} />
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
