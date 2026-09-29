import { useEffect, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import { LOCALES, useI18n } from '../i18n/index.js'
import Seo from '../seo/Seo.jsx'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'

function ProfileForm({ profile, onSaved, initiallySaved = false }) {
  const { t } = useI18n()
  const { authedApi } = useAuth()
  const [form, setForm] = useState({
    fullName: profile.fullName ?? '',
    phone: profile.phone ?? '',
    preferredLocale: profile.preferredLocale,
  })
  const [saved, setSaved] = useState(initiallySaved)
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => {
    setSaved(false)
    setForm({ ...form, [k]: e.target.value })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const res = await run(() => authedApi('/me', { method: 'PATCH', body: form }))
    if (res) {
      setSaved(true)
      onSaved(res.profile)
    }
  }

  return (
    <form className="form" onSubmit={onSubmit} noValidate>
      <Field label={t('auth.email')} value={profile.email} readOnly disabled />
      <Field label={t('auth.fullName')} value={form.fullName} onChange={set('fullName')} error={fields.fullName} />
      <Field label={t('auth.phone')} type="tel" value={form.phone} onChange={set('phone')} error={fields.phone} />
      <Field as="select" label={t('auth.preferredLocale')} value={form.preferredLocale} onChange={set('preferredLocale')}>
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {t(`locales.${l}`)}
          </option>
        ))}
      </Field>
      {error && !Object.keys(fields).length && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {saved && (
        <p className="notice success" role="status">
          {t('account.saved')}
        </p>
      )}
      <button className="btn btn-primary" type="submit" disabled={pending}>
        {pending ? t('auth.submitting') : t('account.save')}
      </button>
    </form>
  )
}

// FR-ACC-004: lịch sử chat với Mây (D-19)
function MayHistory() {
  const { t } = useI18n()
  const { authedApi } = useAuth()
  const [items, setItems] = useState(null)
  useEffect(() => {
    let alive = true
    authedApi('/may/history')
      .then((res) => alive && setItems(res.items))
      .catch(() => alive && setItems([]))
    return () => {
      alive = false
    }
  }, [authedApi])
  return (
    <div className="account-card">
      <h2>{t('accountMay.title')}</h2>
      {items === null && <p>{t('account.loading')}</p>}
      {items?.length === 0 && <p>{t('accountMay.empty')}</p>}
      {items?.length > 0 && (
        <ol className="may-list may-history">
          {items.map((m, i) => (
            <li key={i} className={`may-msg may-${m.role} may-kind-${m.kind}`}>
              {m.content}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

// FR-ACC-001/002: trang tài khoản (dashboard); đơn hàng làm ở giai đoạn sau
export default function AccountPage() {
  const { t, path } = useI18n()
  const { user, authedApi, logout } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    if (!user) return
    let alive = true
    authedApi('/me')
      .then((res) => alive && setState({ status: 'ok', profile: res.profile }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [user, authedApi])

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search)
    return <Navigate to={`${path('/login')}?next=${next}`} replace />
  }

  async function onLogout() {
    await logout()
    navigate(path('/'), { replace: true })
  }

  return (
    <section className="page-section narrow account">
        <Seo title={t('account.title')} noindex />
      <h1 className="page-title">{t('account.title')}</h1>
      <div className="account-card">
        <h2>{t('account.profile')}</h2>
        {state.status === 'loading' && <p>{t('account.loading')}</p>}
        {state.status === 'error' && (
          <p className="notice error" role="alert">
            {t(`errors.${state.error.code}`)}
          </p>
        )}
        {state.status === 'ok' && (
          <ProfileForm
            // Đổi key sau khi lưu để form hiển thị giá trị server đã chuẩn hoá (vd SĐT)
            key={`${state.profile.fullName}|${state.profile.phone}|${state.profile.preferredLocale}`}
            profile={state.profile}
            onSaved={(profile) => setState({ status: 'ok', profile, saved: true })}
            initiallySaved={state.saved}
          />
        )}
      </div>
      <div className="account-card">
        <h2>{t('account.orders')}</h2>
        <p>{t('account.ordersSoon')}</p>
      </div>
      <MayHistory />
      <button className="btn btn-ghost" type="button" onClick={onLogout}>
        {t('account.logout')}
      </button>
    </section>
  )
}
