import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import Seo from '../seo/Seo.jsx'
import { LOCALES, useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import { useSubmit } from '../auth/useForm.js'
import { formatVnd } from '../lib/money.js'
import { track } from '../analytics/index.js'

// D-73 (Q-15): hạn link thanh toán payOS — chỉ để hiện cho khách, server mới là nguồn sự thật
const PAYMENT_MINUTES = 15

const EMPTY = {
  orderKind: 'self',
  hasMessage: false,
  qrLang: 'vi',
  recipientIsSelf: true,
  recipientName: '',
  recipientPhone: '',
  addressLine: '',
  ward: '',
  district: '',
  province: '',
  note: '',
  paymentMethod: 'cod',
}

function Row({ label, children, strong = false }) {
  return (
    <div className={`sum-row${strong ? ' sum-total' : ''}`}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

/** FR-CHK-001…008 (§12): checkout — noindex (BR-SEO-001), chỉ cho khách đã đăng nhập (D-36). */
export default function CheckoutPage() {
  const { t, lang, path } = useI18n()
  const { user, authedApi } = useAuth()
  const { reload: reloadCart } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [priceChanged, setPriceChanged] = useState(false)
  const { pending, error, fields, run } = useSubmit()
  // Tổng khách nhìn thấy lúc bấm Đặt hàng — server đối chiếu để phát hiện giá đổi giữa chừng (§12)
  const seenTotal = useRef(null)

  // D-36 / FR-CHK-001: chưa đăng nhập → đăng nhập rồi quay lại
  useEffect(() => {
    if (!user) navigate(`${path('/login')}?next=${encodeURIComponent(path('/checkout'))}`, { replace: true })
  }, [user, navigate, path])

  // Mỗi lần xin bảng giá tăng một số thứ tự; phản hồi của lần cũ về muộn sẽ bị bỏ, nếu không
  // khách bấm áp/bỏ mã liên tục có thể thấy bảng giá của lần trước.
  const quoteSeq = useRef(0)
  const loadQuote = useCallback(
    async (couponCode) => {
      const id = ++quoteSeq.current
      try {
        const q = await authedApi('/checkout/quote', { method: 'POST', body: { couponCode }, lang })
        if (id !== quoteSeq.current) return
        setQuote(q)
        setQuoteError(null)
        seenTotal.current = q.total
      } catch (err) {
        if (id === quoteSeq.current) setQuoteError(err.code ?? 'INTERNAL_ERROR')
      }
    },
    [authedApi, lang],
  )

  useEffect(() => {
    if (!user) return
    // Đồng bộ với hệ thống ngoài (gọi API); mọi setState trong loadQuote đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    loadQuote(appliedCoupon || undefined)
  }, [user, appliedCoupon, loadQuote])

  // FR-GA-001 §23.3: begin_checkout khi bảng giá đầu tiên hiện ra
  const tracked = useRef(false)
  useEffect(() => {
    if (quote && quote.items.length && !tracked.current) {
      tracked.current = true
      track('begin_checkout', { value: quote.total, currency: 'VND', item_count: quote.items.length })
    }
  }, [quote])

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))
  const setBool = (k, v) => () => setForm((f) => ({ ...f, [k]: v }))

  // BR-PAY-004: đơn giao người khác không chọn COD được — tự chuyển sang payOS khi khách đổi
  function setRecipientIsSelf(v) {
    setForm((f) => ({ ...f, recipientIsSelf: v, paymentMethod: v ? f.paymentMethod : 'payos' }))
  }

  // BR-MSG-002: đơn tặng luôn có lời chúc
  function setOrderKind(kind) {
    setForm((f) => ({ ...f, orderKind: kind, hasMessage: kind === 'gift' ? true : f.hasMessage }))
  }

  async function onSubmit(e) {
    e.preventDefault()
    const body = {
      ...form,
      hasMessage: form.orderKind === 'gift' ? true : form.hasMessage,
      qrLang: form.orderKind === 'gift' || form.hasMessage ? form.qrLang : undefined,
      couponCode: appliedCoupon || undefined,
      expectedTotal: seenTotal.current ?? undefined,
    }
    const res = await run(async () => {
      try {
        return await authedApi('/orders', { method: 'POST', body, lang })
      } catch (err) {
        // §12 (D-41): giá đổi giữa chừng → server trả kèm bảng giá mới; hiện ngay và bắt xác nhận lại
        if (err.code === 'PRICE_CHANGED') {
          setPriceChanged(true)
          // Nạp lại bảng giá đầy đủ (kèm tên và đơn giá từng dòng), không chỉ số tiền trong lỗi
          await loadQuote(appliedCoupon || undefined)
        }
        throw err
      }
    })
    if (!res) return
    setPriceChanged(false)
    reloadCart?.()
    // payOS: chuyển sang trang thanh toán; COD: sang trang cảm ơn
    if (res.payment?.checkoutUrl) {
      window.location.assign(res.payment.checkoutUrl)
      return
    }
    navigate(`${path(`/don-hang/${res.order.code}`)}?moi=1`)
  }

  const hasMessage = form.orderKind === 'gift' || form.hasMessage
  const codBlocked = !form.recipientIsSelf

  if (!user) return null

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
        <p>{t('checkout.emptyCart')}</p>
        <Link to={path('/cart')} className="btn btn-primary">
          {t('checkout.backToCart')}
        </Link>
      </section>
    )
  }

  return (
    <section className="page-section checkout">
      {head}
      <Link to={path('/cart')} className="back-link">
        {t('checkout.backToCart')}
      </Link>

      <form className="form checkout-form" onSubmit={onSubmit} noValidate>
        <div className="checkout-main">
          {/* FR-CHK-002 (C-02) */}
          <fieldset className="account-card">
            <legend>{t('checkout.kindLegend')}</legend>
            <div className="choice-row">
              {['gift', 'self'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`btn btn-choice${form.orderKind === k ? ' is-active' : ''}`}
                  aria-pressed={form.orderKind === k}
                  onClick={() => setOrderKind(k)}
                >
                  {t(k === 'gift' ? 'checkout.kindGift' : 'checkout.kindSelf')}
                </button>
              ))}
            </div>
            {/* FR-CHK-003 (D-14): ô "Thêm lời chúc" chỉ cho đơn tự mua */}
            {form.orderKind === 'self' ? (
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={form.hasMessage}
                  onChange={(e) => setForm((f) => ({ ...f, hasMessage: e.target.checked }))}
                />
                <span>{t('checkout.addMessage')}</span>
              </label>
            ) : (
              <p className="field-hint">{t('checkout.giftMessageNote')}</p>
            )}
            {hasMessage && (
              <>
                <p className="field-hint">{t('checkout.addMessageHint')}</p>
                {/* FR-CHK-005 (D-24) */}
                <Field
                  as="select"
                  label={t('checkout.qrLang')}
                  value={form.qrLang}
                  onChange={set('qrLang')}
                  error={fields.qrLang}
                  hint={t('checkout.qrLangHint')}
                >
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {t(`locales.${l}`)}
                    </option>
                  ))}
                </Field>
              </>
            )}
          </fieldset>

          {/* FR-CHK-004 (D-02, BR-SHP-001) */}
          <fieldset className="account-card">
            <legend>{t('checkout.recipientLegend')}</legend>
            <div className="choice-row">
              <button
                type="button"
                className={`btn btn-choice${form.recipientIsSelf ? ' is-active' : ''}`}
                aria-pressed={form.recipientIsSelf}
                onClick={() => setRecipientIsSelf(true)}
              >
                {t('checkout.recipientSelf')}
              </button>
              <button
                type="button"
                className={`btn btn-choice${form.recipientIsSelf ? '' : ' is-active'}`}
                aria-pressed={!form.recipientIsSelf}
                onClick={() => setRecipientIsSelf(false)}
              >
                {t('checkout.recipientOther')}
              </button>
            </div>
            <div className="admin-grid">
              <Field
                label={t('checkout.recipientName')}
                value={form.recipientName}
                onChange={set('recipientName')}
                error={fields.recipientName}
                autoComplete="name"
              />
              <Field
                label={t('checkout.recipientPhone')}
                type="tel"
                value={form.recipientPhone}
                onChange={set('recipientPhone')}
                error={fields.recipientPhone}
                autoComplete="tel"
              />
            </div>
            <Field
              label={t('checkout.addressLine')}
              value={form.addressLine}
              onChange={set('addressLine')}
              error={fields.addressLine}
              autoComplete="street-address"
            />
            <div className="admin-grid">
              <Field label={t('checkout.ward')} value={form.ward} onChange={set('ward')} error={fields.ward} />
              <Field label={t('checkout.district')} value={form.district} onChange={set('district')} error={fields.district} />
              <Field
                label={t('checkout.province')}
                value={form.province}
                onChange={set('province')}
                error={fields.province}
                autoComplete="address-level1"
              />
            </div>
            <Field as="textarea" rows={2} label={t('checkout.note')} value={form.note} onChange={set('note')} error={fields.note} />
          </fieldset>

          {/* FR-CHK-007 (D-35) */}
          <fieldset className="account-card">
            <legend>{t('checkout.paymentLegend')}</legend>
            <label className="check-row">
              <input
                type="radio"
                name="paymentMethod"
                value="payos"
                checked={form.paymentMethod === 'payos'}
                onChange={setBool('paymentMethod', 'payos')}
              />
              <span>
                {t('checkout.payos')}
                <small className="field-hint">{t('checkout.payosHint', { minutes: PAYMENT_MINUTES })}</small>
              </span>
            </label>
            <label className={`check-row${codBlocked ? ' is-disabled' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                disabled={codBlocked}
                checked={form.paymentMethod === 'cod'}
                onChange={setBool('paymentMethod', 'cod')}
              />
              <span>
                {t('checkout.cod')}
                {/* BR-PAY-004 */}
                <small className="field-hint">{codBlocked ? t('checkout.codBlocked') : t('checkout.codHint')}</small>
              </span>
            </label>
            {fields.paymentMethod && <p className="field-error">{t(`errors.${fields.paymentMethod}`)}</p>}
          </fieldset>
        </div>

        {/* FR-CHK-006, FR-CHK-008 */}
        <aside className="checkout-aside">
          <div className="account-card">
            <h2>{t('checkout.summary')}</h2>
            <ul className="sum-items">
              {quote.items.map((i) => (
                <li key={i.slug}>
                  <span>
                    {i.name} <small>× {i.quantity}</small>
                  </span>
                  <span>{formatVnd(i.lineTotal)}</span>
                </li>
              ))}
            </ul>

            <div className="coupon-row">
              <Field
                label={t('checkout.couponLegend')}
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('checkout.couponPlaceholder')}
                error={quote.couponError ?? undefined}
              />
              {quote.couponCode ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-small"
                  onClick={() => {
                    setCouponInput('')
                    setAppliedCoupon('')
                  }}
                >
                  {t('checkout.couponRemove')}
                </button>
              ) : (
                <button type="button" className="btn btn-ghost btn-small" onClick={() => setAppliedCoupon(couponInput.trim())}>
                  {t('checkout.couponApply')}
                </button>
              )}
            </div>
            {quote.couponCode && (
              <p className="notice success">{t('checkout.couponApplied', { code: quote.couponCode })}</p>
            )}

            <Row label={t('checkout.subtotal')}>{formatVnd(quote.subtotal)}</Row>
            {quote.discount > 0 && <Row label={t('checkout.discount')}>−{formatVnd(quote.discount)}</Row>}
            <Row label={t('checkout.shipping')}>
              {quote.freeShipping ? t('checkout.shippingFree') : formatVnd(quote.shippingFee)}
            </Row>
            <Row label={t('checkout.total')} strong>
              {formatVnd(quote.total)}
            </Row>
            {/* D-68: giá đã gồm VAT — tách dòng VAT cho minh bạch hoá đơn */}
            <p className="field-hint">
              {t('checkout.totalNote')} {t('checkout.vatIncluded', { rate: Math.round(quote.vatRate * 100) })}:{' '}
              {formatVnd(quote.vatAmount)}
            </p>
            {!quote.freeShipping && quote.freeShippingFrom > 0 && (
              <p className="field-hint">{t('checkout.freeShippingHint', { amount: formatVnd(quote.freeShippingFrom) })}</p>
            )}

            {priceChanged && (
              <p className="notice error" role="alert">
                {t('checkout.priceChanged')}
              </p>
            )}
            {error && error !== 'PRICE_CHANGED' && !Object.keys(fields).length && (
              <p className="notice error" role="alert">
                {t(`errors.${error}`)}
              </p>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={pending}>
              {pending ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </div>
        </aside>
      </form>
    </section>
  )
}
