import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Lantern from '../components/Lantern'
import Price from '../components/Price'
import Seo from '../seo/Seo.jsx'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import QuantityInput from '../cart/QuantityInput.jsx'

// FR-CART-001 (§11): giỏ hàng — noindex (BR-SEO-001)
export default function CartPage() {
  const { t, path } = useI18n()
  const { user } = useAuth()
  const { cart, error, setQuantity, remove } = useCart()
  const navigate = useNavigate()
  const [soon, setSoon] = useState(false)

  // D-61: chưa đăng nhập → đăng nhập rồi quay lại giỏ (US-001 AC-003); đã đăng nhập → báo sắp ra mắt
  function onCheckout() {
    if (!user) return navigate(`${path('/login')}?next=${encodeURIComponent(path('/cart'))}`)
    setSoon(true)
  }

  const head = (
    <>
      <Seo title={t('cart.title')} noindex />
      <h1 className="page-title">{t('cart.title')}</h1>
    </>
  )

  if (!cart) {
    return (
      <section className="page-section cart">
        {head}
        {error ? (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        ) : (
          <p>{t('cart.loading')}</p>
        )}
      </section>
    )
  }

  if (!cart.items.length) {
    return (
      <section className="page-section cart">
        {head}
        <p>{t('cart.empty')}</p>
        <Link to={{ pathname: path('/'), hash: '#products' }} className="btn btn-primary">
          {t('cart.continue')}
        </Link>
      </section>
    )
  }

  return (
    <section className="page-section cart">
      {head}
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {cart.hasUnavailable && <p className="notice error">{t('cart.hasUnavailable')}</p>}
      <ul className="cart-lines">
        {cart.items.map((i) => (
          <li key={i.slug} className={`cart-line ${i.available ? '' : 'is-unavailable'}`}>
            <Lantern size={64} tone={i.product.tone ?? undefined} />
            <div className="cart-line-info">
              {i.product.name ? (
                <Link to={path(`/products/${i.slug}`)} className="product-link">
                  <strong>{i.product.name}</strong>
                </Link>
              ) : (
                <strong>{t('cart.unavailableName')}</strong>
              )}
              {i.available ? <Price amount={i.product.priceExclVat} /> : <span className="field-error">{t('cart.unavailable')}</span>}
            </div>
            <QuantityInput
              value={i.quantity}
              disabled={!i.available}
              label={`${t('cart.quantity')} — ${i.product.name ?? t('cart.unavailableName')}`}
              onChange={(q) => q !== i.quantity && setQuantity(i.slug, q)}
            />
            <div className="cart-line-total">
              {i.available && <Price amount={i.lineTotalExclVat} />}
              <button type="button" className="btn btn-small btn-ghost" onClick={() => remove(i.slug)}>
                {t('cart.remove')}
              </button>
            </div>
          </li>
        ))}
      </ul>
      <p className="field-hint">{t('cart.maxNote', { max: cart.maxQuantity })}</p>
      <div className="cart-summary account-card">
        <div className="cart-subtotal">
          <span>{t('cart.subtotal')}</span>
          <Price amount={cart.subtotalExclVat} className="product-price large" />
        </div>
        <p className="field-hint">{t('cart.shippingNote')}</p>
        {!user && <p className="field-hint">{t('cart.guestNote')}</p>}
        <button type="button" className="btn btn-primary" onClick={onCheckout} disabled={cart.itemCount === 0}>
          {t('cart.checkout')}
        </button>
        {soon && (
          <p className="notice" role="status">
            {t('cart.checkoutSoon')}
          </p>
        )}
      </div>
    </section>
  )
}
