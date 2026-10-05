import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../../components/Field'
import { useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import GoogleButton from './GoogleButton'
import { safeNext, useAuth } from '../../auth/context.js'
import { landingPath } from '../../auth/landing.js'
import { useSubmit } from '../../auth/useForm.js'

export default function LoginPage() {
  const { t, path } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const { pending, error, run } = useSubmit()
  const next = safeNext(params.get('next'), path('/account'))

  async function onSubmit(e) {
    e.preventDefault()
    const session = await run(() => login(form.email, form.password))
    if (!session) return
    // Có ?next (vd đang đi tới /checkout hay /admin/orders) thì tôn trọng; không có thì admin/IT vào thẳng /admin
    navigate(params.get('next') ? next : await landingPath(session.accessToken, next), { replace: true })
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const urlError = params.get('error')

  return (
    <AuthShell
      eyebrow={t('auth.loginEyebrow')}
      title={t('auth.loginTitle')}
      lead={t('auth.loginLead')}
      tab="login"
      footer={<Link to={path('/forgot-password')}>{t('auth.toForgot')}</Link>}
    >
      {urlError && (
        <p className="notice error" role="alert">
          {t(`errors.${urlError}`)}
        </p>
      )}
      <GoogleButton next={params.get('next') ? next : undefined} />
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          toggle
          required
          value={form.password}
          onChange={set('password')}
        />
        {error && (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? t('auth.submitting') : t('auth.submitLogin')}
        </button>
      </form>
    </AuthShell>
  )
}
