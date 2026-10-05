import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import PasswordRules from '../../components/PasswordRules.jsx'
import Field from '../../components/Field'
import { api } from '../../api/client.js'
import { LOCALES, useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import GoogleButton from './GoogleButton'
import { safeNext, useAuth } from '../../auth/context.js'
import { useSubmit } from '../../auth/useForm.js'

// FR-ACC-001, D-36, D-42: đăng ký bằng email + mật khẩu
export default function RegisterPage() {
  const { t, lang, path } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ fullName: '', email: '', password: '', phone: '', preferredLocale: lang })
  const [confirmSent, setConfirmSent] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  async function onSubmit(e) {
    e.preventDefault()
    await run(async () => {
      const res = await api('/auth/register', { method: 'POST', body: form, lang })
      if (res.needsConfirmation) {
        setConfirmSent(true)
        return
      }
      await login(form.email, form.password)
      navigate(safeNext(params.get('next'), path('/account')), { replace: true })
    })
  }

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const loginLink = <Link to={path('/login')}>{t('auth.toLogin')}</Link>

  if (confirmSent) {
    return (
      <AuthShell title={t('auth.registerTitle')} footer={loginLink}>
        <p className="notice success" role="status">
          {t('auth.registeredConfirm')}
        </p>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      eyebrow={t('auth.registerEyebrow')}
      title={t('auth.registerTitle')}
      lead={t('auth.registerLead')}
      tab="register"
    >
      <GoogleButton next={params.get('next') ? safeNext(params.get('next'), undefined) : undefined} />
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t('auth.fullName')} autoComplete="name" required value={form.fullName} onChange={set('fullName')} error={fields.fullName} />
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fields.email} />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          toggle
          required
          value={form.password}
          onChange={set('password')}
          error={fields.password}
        />
        <PasswordRules password={form.password} />
        <Field label={t('auth.phone')} type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} error={fields.phone} />
        <Field
          as="select"
          label={t('auth.preferredLocale')}
          value={form.preferredLocale}
          onChange={set('preferredLocale')}
          error={fields.preferredLocale}
        >
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {t(`locales.${l}`)}
            </option>
          ))}
        </Field>
        {error && (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? t('auth.submitting') : t('auth.submitRegister')}
        </button>
      </form>
    </AuthShell>
  )
}
