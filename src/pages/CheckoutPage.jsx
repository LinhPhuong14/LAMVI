import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import Price from '../components/Price'
import Seo from '../seo/Seo.jsx'
import { formatVnd } from '../lib/money.js'
import { LOCALES, useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'

const EMPTY_RECIPIENT = { name: '', phone: '', province: '', district: '', ward: '', street: '' }

function newKey() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function Row({ label, children, strong }) {
  return (
    <div className={`summary-row ${strong ? 'is-total' : ''}`}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

// §12 Checkout (FR-CHK-001…008): một trang, server tính giá (BR-PRC-001), noindex (BR-SEO-001)
export default function CheckoutPage() {
  const { t, path, lang } = useI18n()
  const { user, authedApi } = useAuth()
  const { reload } = useCart()
  const navigate = useNavigate()
  const location = useLocation()

  const [orderType, setOrderType] = useState('gift')
  const [addMessage, setAddMessage] = useState(false)
  const [qrLang, setQrLang] = useState(lang)
  const [recipientType, setRecipientType] = useState('self')
  const [recipient, setRecipient] = useState(EMPTY_RECIPIENT)
  const [couponInput, setCouponInput] = useState('')
  const [couponCode, setCouponCode] = useState('')
  const [chosenMethod, setPaymentMethod] = useState('payos')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [submit, setSubmit] = useState({ pending: false, error: null, fields: {} })
  const [priceChanged, setPriceChanged] = useState(false)
  // Một khoá cho mỗi lần đặt — bấm hai lần không tạo hai đơn
  const clientKey = useRef(newKey())
  const prefilled = useRef(false)

  const hasMessage = orderType === 'gift' || addMessage

  // Tăng để tính lại bảng giá (vd sau khi server báo giá đổi)
  const [quoteTick, setQuoteTick] = useState(0)
  const reloadQuote = () => setQuoteTick((n) => n + 1)

  // Bảng giá luôn lấy từ server; kết quả của lần gọi cũ bị bỏ
  useEffect(() => {
    if (!user) return
    let alive = true
    authedApi(`/checkout/quote?lang=${lang}`, { method: 'POST', body: { couponCode: couponCode || null, recipientType } })
      .then((q) => {
        if (!alive) return
        setQuote(q)
        setQuoteError(null)
      })
      .catch((err) => alive && setQuoteError(err.code ?? 'INTERNAL_ERROR'))
    return () => {
      alive = false
    }
  }, [user, authedApi, lang, couponCode, recipientType, quoteTick])

  // Người nhận = bản thân → điền sẵn tên/SĐT từ hồ sơ
  useEffect(() => {
    if (!user || prefilled.current) return
    prefilled.current = true
    authedApi('/me')
      .then(({ profile }) =>
        setRecipient((r) => ({ ...r, name: r.name || profile.fullName || '', phone: r.phone || profile.phone || '' })),
      )
      .catch(() => {})
  }, [user, authedApi])

  // BR-PAY-004 / D-71: COD không dùng được → chuyển sang payOS
  const codAllowed = quote?.cod.allowed ?? true
  const payosAvailable = quote?.payosAvailable ?? true
  const paymentMethod =
    chosenMethod === 'cod' && !codAllowed && payosAvailable ? 'payos' : chosenMethod === 'payos' && !payosAvailable && codAllowed ? 'cod' : chosenMethod

  const fieldErrors = submit.fields
  const recipientError = (k) => fieldErrors[`recipient.${k}`]
  const canSubmit = quote && quote.items.length > 0 && !quote.hasUnavailable && !submit.pending && (paymentMethod === 'cod' ? codAllowed : payosAvailable)

  const couponMessage = useMemo(() => {
    if (!couponCode || !quote) return null
    if (quote.coupon) return { ok: true, text: t('checkout.couponApplied', { code: quote.coupon.code }) }
    if (quote.couponError) return { ok: false, text: t(`errors.${quote.couponError.code}`, { min: formatVnd(quote.couponError.minOrder ?? 0) }) }
    return null
  }, [couponCode, quote, t])

  if (!user) {
    // FR-CHK-001, US-001 AC-003: đăng nhập rồi quay lại checkout
    return <Navigate to={`${path('/login')}?next=${encodeURIComponent(location.pathname)}`} replace />
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (!quote) return
    setPriceChanged(false)
    setSubmit({ pending: true, error: null, fields: {} })
    try {
      const res = await authedApi(`/orders?lang=${lang}`, {
        method: 'POST',
        body: {
          orderType,
          addMessage,
          qrLang: hasMessage ? qrLang : undefined,
          recipientType,
          recipient,
          paymentMethod,
          couponCode: couponCode || null,
          clientKey: clientKey.current,
          expectedTotal: quote.pricing.total,
        },
      })
      reload()
      if (res.checkoutUrl) {
        window.location.assign(res.checkoutUrl)
        return
      }
      // Đơn payOS chưa có link (hiếm) → trang đơn có nút "Thanh toán" khi link sẵn sàng
      navigate(path(`/account/orders/${res.order.id}?placed=1`))
    } catch (err) {
      const code = err.code ?? 'INTERNAL_ERROR'
      setSubmit({ pending: false, error: code, fields: err.fields ?? {} })
      // D-41: giá/coupon đổi → hiện bảng giá mới, khách xác nhận lại
      if (code === 'PRICE_CHANGED' || code.startsWith('COUPON_') || code.startsWith('COD_') || code.startsWith('CART_')) {
        if (code === 'PRICE_CHANGED') setPriceChanged(true)
        reloadQuote()
      }
      if (code === 'PAYMENT_UNAVAILABLE') clientKey.current = newKey()
    }
  }

  const head = (
    <>
      <Seo title={t('checkout.title')} noindex />
      <h1 className="page-title">{t('checkout.title')}</h1>
    </>
  )

  if (!quote) {
    return (
      <section className="page-section checkout">
        {head}
        {quoteError ? (
          <p className="notice error" role="alert">
            {t(`errors.${quoteError}`)}
          </p>
        ) : (
          <p>{t('checkout.loading')}</p>
        )}
      </section>
    )
  }

  if (!quote.items.length) {
    return (
      <section className="page-section checkout">
        {head}
        <p>{t('cart.empty')}</p>
        <Link to={path('/cart')} className="btn btn-primary">
          {t('checkout.backToCart')}
        </Link>
      </section>
    )
  }

  const setR = (k) => (e) => setRecipient({ ...recipient, [k]: e.target.value })
  const p = quote.pricing

  return (
    <section className="page-section checkout">
      {head}
      <form className="checkout-grid" onSubmit={onSubmit} noValidate>
        <div className="checkout-main">
          <fieldset className="account-card">
            <legend>{t('checkout.orderType')}</legend>
            <label className="choice">
              <input type="radio" name="orderType" value="gift" checked={orderType === 'gift'} onChange={() => setOrderType('gift')} />
              <span>
                <strong>{t('checkout.gift')}</strong>
                <small>{t('checkout.giftHint')}</small>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="orderType" value="self" checked={orderType === 'self'} onChange={() => setOrderType('self')} />
              <span>
                <strong>{t('checkout.self')}</strong>
              </span>
            </label>
            {orderType === 'self' && (
              <label className="choice choice-inline">
                <input type="checkbox" checked={addMessage} onChange={(e) => setAddMessage(e.target.checked)} />
                <span>{t('checkout.addMessage')}</span>
              </label>
            )}
            {hasMessage && (
              <>
                <Field
                  as="select"
                  label={t('checkout.qrLang')}
                  hint={t('checkout.qrLangHint')}
                  value={qrLang}
                  onChange={(e) => setQrLang(e.target.value)}
                  error={fieldErrors.qrLang}
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {t(`locales.${l}`)}
                    </option>
                  ))}
                </Field>
                <p className="field-hint">{t('checkout.messageLater')}</p>
              </>
            )}
          </fieldset>

          <fieldset className="account-card">
            <legend>{t('checkout.recipient')}</legend>
            <div className="choice-row">
              <label className="choice choice-inline">
                <input type="radio" name="recipientType" checked={recipientType === 'self'} onChange={() => setRecipientType('self')} />
                <span>{t('checkout.recipientSelf')}</span>
              </label>
              <label className="choice choice-inline">
                <input type="radio" name="recipientType" checked={recipientType === 'other'} onChange={() => setRecipientType('other')} />
                <span>{t('checkout.recipientOther')}</span>
              </label>
            </div>
            <div className="form-grid">
              <Field label={t('checkout.name')} value={recipient.name} onChange={setR('name')} error={recipientError('name')} autoComplete="name" />
              <Field label={t('checkout.phone')} type="tel" value={recipient.phone} onChange={setR('phone')} error={recipientError('phone')} autoComplete="tel" />
              <Field label={t('checkout.province')} value={recipient.province} onChange={setR('province')} error={recipientError('province')} />
              <Field label={t('checkout.district')} value={recipient.district} onChange={setR('district')} error={recipientError('district')} />
              <Field label={t('checkout.ward')} value={recipient.ward} onChange={setR('ward')} error={recipientError('ward')} />
              <Field label={t('checkout.street')} value={recipient.street} onChange={setR('street')} error={recipientError('street')} autoComplete="street-address" />
            </div>
            <p className="field-hint">{t('checkout.vnOnly')}</p>
          </fieldset>

          <fieldset className="account-card">
            <legend>{t('checkout.payment')}</legend>
            <label className={`choice ${payosAvailable ? '' : 'is-disabled'}`}>
              <input type="radio" name="paymentMethod" checked={paymentMethod === 'payos'} disabled={!payosAvailable} onChange={() => setPaymentMethod('payos')} />
              <span>
                <strong>{t('checkout.payos')}</strong>
                <small>{payosAvailable ? t('checkout.payosHint') : t('errors.PAYOS_UNAVAILABLE')}</small>
              </span>
            </label>
            <label className={`choice ${codAllowed ? '' : 'is-disabled'}`}>
              <input type="radio" name="paymentMethod" checked={paymentMethod === 'cod'} disabled={!codAllowed} onChange={() => setPaymentMethod('cod')} />
              <span>
                <strong>{t('checkout.cod')}</strong>
                <small>{codAllowed ? t('checkout.codHint') : t(`errors.${quote.cod.reason}`)}</small>
              </span>
            </label>
          </fieldset>
        </div>

        <aside className="checkout-summary account-card">
          <h2>{t('checkout.summary')}</h2>
          <ul className="summary-items">
            {quote.items.map((i) => (
              <li key={i.slug}>
                <span>
                  {i.name} × {i.quantity}
                </span>
                <span>{formatVnd(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <div className="coupon-box">
            <Field
              label={t('checkout.coupon')}
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              error={fieldErrors.couponCode}
              autoComplete="off"
            />
            <div className="coupon-actions">
              <button type="button" className="btn btn-small" onClick={() => setCouponCode(couponInput.trim())} disabled={!couponInput.trim()}>
                {t('checkout.applyCoupon')}
              </button>
              {couponCode && (
                <button
                  type="button"
                  className="btn btn-small btn-ghost"
                  onClick={() => {
                    setCouponCode('')
                    setCouponInput('')
                  }}
                >
                  {t('checkout.removeCoupon')}
                </button>
              )}
            </div>
            {couponMessage && (
              <p className={couponMessage.ok ? 'field-hint' : 'field-error'} role="status">
                {couponMessage.text}
              </p>
            )}
          </div>
          <Row label={t('checkout.subtotal')}>
            <Price amount={p.subtotal} />
          </Row>
          {p.discount > 0 && <Row label={t('checkout.discount')}>−{formatVnd(p.discount)}</Row>}
          <Row label={t('checkout.shipping')}>
            {p.shippingFee === 0 ? t('checkout.free') : formatVnd(p.shippingFee)}
          </Row>
          {p.shippingFee > 0 && quote.shop.freeShippingFrom !== null && (
            <p className="field-hint">{t('checkout.freeShippingFrom', { amount: formatVnd(quote.shop.freeShippingFrom) })}</p>
          )}
          <Row label={t('checkout.vat', { rate: Math.round(p.vatRate * 100) })}>{formatVnd(p.vat)}</Row>
          <Row label={t('checkout.total')} strong>
            {formatVnd(p.total)}
          </Row>
          {priceChanged && (
            <p className="notice" role="alert">
              {t('checkout.priceChanged')}
            </p>
          )}
          {submit.error && !priceChanged && (
            <p className="notice error" role="alert">
              {t(`errors.${submit.error}`)}
            </p>
          )}
          {quote.hasUnavailable && (
            <p className="notice error">
              {t('checkout.hasUnavailable')} <Link to={path('/cart')}>{t('checkout.backToCart')}</Link>
            </p>
          )}
          <button type="submit" className="btn btn-primary" disabled={!canSubmit}>
            {submit.pending ? t('checkout.placing') : paymentMethod === 'payos' ? t('checkout.placePayos') : t('checkout.placeCod')}
          </button>
        </aside>
      </form>
    </section>
  )
}
