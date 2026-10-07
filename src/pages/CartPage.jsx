import { Link, useNavigate } from 'react-router-dom'
import Lantern from '../components/Lantern'
import { Lotus } from '../components/Motifs'
import Price from '../components/Price'
import ProductImage from '../components/ProductImage'
import Seo from '../seo/Seo.jsx'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import QuantityInput from '../cart/QuantityInput.jsx'
import MayAvatar from '../may/MayAvatar.jsx'

// FR-CART-001 (§11): giỏ hàng — noindex (BR-SEO-001). Thiết kế lại ở D-83: đầu trang có 3 bước, danh sách
// món dạng thẻ kính, tóm tắt đơn dính bên phải, lời nhắn của Mây về những gì đi kèm món quà.
function Steps({ current = 0 }) {
  const { t } = useI18n()
  const steps = t('cart.steps')
  return (
    <ol className="cart-steps" aria-label={t('cart.stepsLabel')}>
      {steps.map((label, i) => (
        <li key={label} aria-current={i === current ? 'step' : undefined} className={i < current ? 'is-done' : ''}>
          <span className="cart-step-no">{i + 1}</span>
          {label}
        </li>
      ))}
    </ol>
  )
}

export default function CartPage() {
  const { t, path } = useI18n()
  const { user } = useAuth()
  const { cart, error, pendingLines = {}, lineErrors = {}, setQuantity, remove } = useCart()
  const navigate = useNavigate()

  // D-61 / FR-CHK-001: chưa đăng nhập → đăng nhập rồi quay lại giỏ (US-001 AC-003)
  function onCheckout() {
    if (!user) return navigate(`${path('/login')}?next=${encodeURIComponent(path('/cart'))}`)
    navigate(path('/checkout'))
  }

  const head = (
    <header className="cart-head">
      <Seo title={t('cart.title')} noindex />
      <p className="eyebrow">
        <Lotus /> {t('cart.eyebrow')}
      </p>
      <h1 className="page-title">{t('cart.title')}</h1>
    </header>
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
        <div className="cart-empty">
          <div className="cart-empty-art" aria-hidden="true">
            <Lantern size={120} tone="amber" swing />
          </div>
          <p className="cart-empty-title">{t('cart.empty')}</p>
          <p className="cart-empty-copy">{t('cart.emptyCopy')}</p>
          <Link to={path('/shop')} className="btn btn-primary">
            {t('cart.continue')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="page-section cart">
      {head}
      <Steps />
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {cart.hasUnavailable && <p className="notice error">{t('cart.hasUnavailable')}</p>}
      {cart.hasShortage && <p className="notice error" role="alert">{t('cart.hasShortage')}</p>}
      <div className="cart-layout">
        <div className="cart-main">
          <ul className="cart-lines">
            {cart.items.map((i) => (
              <li key={i.slug} aria-busy={Boolean(pendingLines[i.slug])} className={`cart-line ${i.available ? '' : 'is-unavailable'}`}>
                <span className="cart-line-art">
                  <ProductImage image={i.product.image} size={84} tone={i.product.tone ?? undefined} name={i.product.name ?? ''} />
                </span>
                <div className="cart-line-info">
                  {i.product.name ? (
                    <Link to={path(`/products/${i.slug}`)} className="product-link">
                      <strong>{i.product.name}</strong>
                    </Link>
                  ) : (
                    <strong>{t('cart.unavailableName')}</strong>
                  )}
                  {lineErrors[i.slug] && <span className="field-error" role="alert">{t(`errors.${lineErrors[i.slug]}`)}</span>}
                  {i.available ? <Price amount={i.product.price} /> : <span className="field-error">{t('cart.unavailable')}</span>}
                  {i.available && i.inStock === false && (
                    <span className="field-error">{i.stockLeft ? t('cart.shortage', { n: i.stockLeft }) : t('cart.soldOut')}</span>
                  )}
                </div>
                <QuantityInput
                  value={i.quantity}
                  disabled={!i.available || Boolean(pendingLines[i.slug])}
                  label={`${t('cart.quantity')} — ${i.product.name ?? t('cart.unavailableName')}`}
                  onChange={(q) => q !== i.quantity && setQuantity(i.slug, q)}
                />
                <div className="cart-line-total">
                  {i.available && <Price amount={i.lineTotal} />}
                  <button type="button" className="cart-remove" disabled={Boolean(pendingLines[i.slug])} onClick={() => remove(i.slug)}>
                    {t('cart.remove')}
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="field-hint">{t('cart.maxNote', { max: cart.maxQuantity })}</p>
          {/* Lời nhắn của Mây: những gì đi kèm mỗi món quà (không quảng cáo coupon — BR-AI-005) */}
          <aside className="cart-may">
            <MayAvatar size={44} />
            <div>
              <strong>{t('cart.mayTitle')}</strong>
              <ul>
                {t('cart.perks').map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
        <aside className="cart-summary" aria-label={t('cart.summary')}>
          <h2>{t('cart.summary')}</h2>
          <dl className="cart-rows">
            <div>
              <dt>{t('cart.subtotal')}</dt>
              <dd>
                <Price amount={cart.subtotal} className="product-price large" />
              </dd>
            </div>
            <div>
              <dt>{t('cart.shipping')}</dt>
              <dd className="cart-shipping">{t('cart.shippingAtCheckout')}</dd>
            </div>
          </dl>
          <p className="field-hint">{t('cart.shippingNote')}</p>
          {!user && <p className="field-hint">{t('cart.guestNote')}</p>}
          <button type="button" className="btn btn-primary" onClick={onCheckout} disabled={cart.itemCount === 0 || cart.hasShortage || Object.keys(pendingLines).length > 0}>
            {t('cart.checkout')}
          </button>
          <Link to={path('/shop')} className="cart-continue">
            {t('cart.continue')}
          </Link>
        </aside>
      </div>
    </section>
  )
}
