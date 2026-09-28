import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../../components/Field'
import { api } from '../../api/client.js'
import { LOCALES, useI18n } from '../../i18n/index.js'
import { useNoIndex } from '../../hooks/useNoIndex.js'
import { safeNext, useAuth } from '../../auth/context.js'
import { useSubmit } from '../../auth/useForm.js'

// FR-ACC-001, D-36, D-42: đăng ký bằng email + mật khẩu
export default function RegisterPage() {
  useNoIndex()
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

  if (confirmSent) {
    return (
      <section className="page-section narrow">
        <h1 className="page-title">{t('auth.registerTitle')}</h1>
        <p className="notice success" role="status">
          {t('auth.registeredConfirm')}
        </p>
        <div className="form-links">
          <Link to={path('/login')}>{t('auth.toLogin')}</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-section narrow">
      <h1 className="page-title">{t('auth.registerTitle')}</h1>
      <form className="form" onSubmit={onSubmit} noValidate>
        <Field label={t('auth.fullName')} autoComplete="name" required value={form.fullName} onChange={set('fullName')} error={fields.fullName} />
        <Field label={t('auth.email')} type="email" autoComplete="email" required value={form.email} onChange={set('email')} error={fields.email} />
        <Field
          label={t('auth.password')}
          type="password"
          autoComplete="new-password"
          required
          value={form.password}
          onChange={set('password')}
          error={fields.password}
          hint={t('auth.passwordHint')}
        />
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
      <div className="form-links">
        <Link to={path('/login')}>{t('auth.toLogin')}</Link>
      </div>
    </section>
  )
}
