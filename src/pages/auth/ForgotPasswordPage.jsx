import { useState } from 'react'
import { Link } from 'react-router-dom'
import Field from '../../components/Field'
import { api } from '../../api/client.js'
import { useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import { useSubmit } from '../../auth/useForm.js'

export default function ForgotPasswordPage() {
  const { t, lang, path } = useI18n()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  async function onSubmit(e) {
    e.preventDefault()
    await run(async () => {
      await api('/auth/forgot-password', { method: 'POST', body: { email }, lang })
      setSent(true)
    })
  }

  return (
    <AuthShell
      title={t('auth.forgotTitle')}
      lead={t('auth.forgotLead')}
      footer={<Link to={path('/login')}>{t('auth.toLogin')}</Link>}
    >
      {sent ? (
        <p className="notice success" role="status">
          {t('auth.forgotSent')}
        </p>
      ) : (
        <form className="form" onSubmit={onSubmit} noValidate>
          <Field
            label={t('auth.email')}
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fields.email}
          />
          {error && !fields.email && (
            <p className="notice error" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? t('auth.submitting') : t('auth.submitForgot')}
          </button>
        </form>
      )}
    </AuthShell>
  )
}
