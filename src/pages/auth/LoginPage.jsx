import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../../components/Field'
import { useI18n } from '../../i18n/index.js'
import { useNoIndex } from '../../hooks/useNoIndex.js'
import { safeNext, useAuth } from '../../auth/context.js'
import { useSubmit } from '../../auth/useForm.js'

export default function LoginPage() {
  useNoIndex()
  const { t, path } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const { pending, error, run } = useSubmit()
  const next = safeNext(params.get('next'), path('/account'))

  async function onSubmit(e) {
    e.preventDefault()
    const ok = await run(() => login(form.email, form.password))
    if (ok) navigate(next, { replace: true })
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  return (
    <section className="page-section narrow">
      <h1 className="page-title">{t('auth.loginTitle')}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
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
      <div className="form-links">
        <Link to={path('/forgot-password')}>{t('auth.toForgot')}</Link>
        <Link to={{ pathname: path('/register'), search: params.get('next') ? `?next=${encodeURIComponent(next)}` : '' }}>
          {t('auth.toRegister')}
        </Link>
      </div>
    </section>
  )
}
