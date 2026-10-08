import { useContext, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Field from '../../components/Field'
import { useI18n } from '../../i18n/index.js'
import AuthShell from './AuthShell'
import GoogleButton from './GoogleButton'
import { safeNext, useAuth } from '../../auth/context.js'
import { landingPath } from '../../auth/landing.js'
import { useSubmit } from '../../auth/useForm.js'
import { CartContext } from '../../cart/context.js'
import Price from '../../components/Price'
import { track } from '../../analytics/index.js'

export default function LoginPage() {
  const { t, path } = useI18n()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form, setForm] = useState({ email: '', password: '' })
  const { pending, error, run } = useSubmit()
  const next = safeNext(params.get('next'), path('/account'))
  // Bị chuyển từ giỏ hàng/thanh toán sang đây (feedback 08/10, mục 3): giải thích lý do và nhắc giỏ hàng vẫn còn
  const fromCheckout = /^(\/(en|zh))?\/checkout\/?$/i.test(new URL(next, 'http://x').pathname)
  const cart = useContext(CartContext)?.cart
  // Phễu begin_checkout → login_view → purchase (đo độ rơi ở bước đăng nhập)
  useEffect(() => {
    if (fromCheckout) track('login_view', { source: 'checkout' })
  }, [fromCheckout])

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
      {fromCheckout && (
        <div className="notice login-checkout-note" role="note">
          <strong>{t('auth.checkoutNote')}</strong>
          <p>{t('auth.checkoutNoteSub')}</p>
          {cart?.itemCount > 0 && (
            <p className="login-cart-summary">
              {t('auth.cartSummary')}: {t('auth.cartItems', { n: cart.itemCount })} · {t('auth.cartTotal')} <Price amount={cart.subtotal} className="login-cart-total" />
            </p>
          )}
        </div>
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
