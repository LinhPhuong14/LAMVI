import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Field from '../components/Field'
import AddressSelect from '../components/AddressSelect'
import { Reveal } from '../components/Reveal'
import { Lotus } from '../components/Motifs'
import Seo from '../seo/Seo.jsx'
import { LOCALES, useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { useCart } from '../cart/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useApi } from '../api/useApi.js'
import { formatVnd } from '../lib/money.js'
import { track } from '../analytics/index.js'
import { checkoutRequestKey, clearCheckoutRequest, readCheckoutRequest } from './checkoutRequest.js'

// D-73 (Q-15): hạn link thanh toán payOS — chỉ để hiện cho khách, server mới là nguồn sự thật
const PAYMENT_MINUTES = 15

const EMPTY = {
  orderKind: 'self',
  hasMessage: false,
  messageText: '',
  qrLang: 'vi',
  recipientIsSelf: true,
  recipientName: '',
  recipientPhone: '',
  addressLine: '',
  provinceCode: '',
  wardCode: '',
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

/** Nhãn bước checkout: số trong ấn son + hoa sen, cùng kiểu eyebrow của các phần ở trang chủ. */
function StepLegend({ n, children }) {
  return (
    <legend>
      <span className="step-no" aria-hidden="true">
        {n}
      </span>
      <Lotus />
      {children}
    </legend>
  )
}

/** FR-CHK-001…008 (§12): checkout — noindex (BR-SEO-001), chỉ cho khách đã đăng nhập (D-36). */
export default function CheckoutPage() {
  const { t, lang, path } = useI18n()
  const site = useApi('/site', lang)
  const { user, authedApi } = useAuth()
  const { reload: reloadCart } = useCart()
  const navigate = useNavigate()

  const [form, setForm] = useState(EMPTY)
  const [couponInput, setCouponInput] = useState('')
  const [appliedCoupon, setAppliedCoupon] = useState('')
  const [quote, setQuote] = useState(null)
  const [quoteError, setQuoteError] = useState(null)
  const [quotePending, setQuotePending] = useState(true)
  const [quotedCoupon, setQuotedCoupon] = useState(null)
  const submitting = useRef(false)
  const retryLabel = t('checkout.retry')
  const [priceChanged, setPriceChanged] = useState(false)
  const { pending, error, fields, run } = useSubmit()
  // Tổng khách nhìn thấy lúc bấm Đặt hàng — server đối chiếu để phát hiện giá đổi giữa chừng (§12)
  const seenTotal = useRef(null)
  const checkoutForm = useRef(null)
  useEffect(() => {
    if (Object.keys(fields).length) checkoutForm.current?.querySelector('[aria-invalid="true"]')?.focus()
  }, [fields])

  // D-36 / FR-CHK-001: chưa đăng nhập → đăng nhập rồi quay lại
  useEffect(() => {
    if (!user) navigate(`${path('/login')}?next=${encodeURIComponent(path('/checkout'))}`, { replace: true })
  }, [user, navigate, path])

  // Feedback 08/10, 7.4: “Giao cho tôi” tự điền tên + số điện thoại từ hồ sơ (chỉ khi khách chưa gõ gì)
  useEffect(() => {
    if (!user) return undefined
    let alive = true
    authedApi('/me')
      .then(({ profile }) => {
        if (!alive || !profile) return
        setForm((f) => (f.recipientIsSelf && !f.recipientName && !f.recipientPhone ? { ...f, recipientName: profile.fullName ?? '', recipientPhone: profile.phone ?? '' } : f))
      })
      .catch(() => {}) // hồ sơ không tải được thì khách tự nhập, không chặn thanh toán
    return () => {
      alive = false
    }
  }, [user, authedApi])

  // Mỗi lần xin bảng giá tăng một số thứ tự; phản hồi của lần cũ về muộn sẽ bị bỏ, nếu không
  // khách bấm áp/bỏ mã liên tục có thể thấy bảng giá của lần trước.
  const quoteSeq = useRef(0)
  const loadQuote = useCallback(
    async (couponCode) => {
      const id = ++quoteSeq.current
      setQuotePending(true)
      try {
        const q = await authedApi('/checkout/quote', { method: 'POST', body: { couponCode }, lang })
        if (id !== quoteSeq.current) return
        setQuote(q)
        setQuotedCoupon(couponCode || '')
        setQuoteError(null)
        seenTotal.current = q.total
      } catch (err) {
        if (id === quoteSeq.current) setQuoteError(err.code ?? 'INTERNAL_ERROR')
      } finally {
        if (id === quoteSeq.current) setQuotePending(false)
      }
    },
    [authedApi, lang],
  )

  const refreshCheckout = useCallback(async () => {
    if (!user) return
    const key = readCheckoutRequest(user.id)
    if (!key) return loadQuote(appliedCoupon || undefined)
    const id = ++quoteSeq.current
    setQuotePending(true)
    try {
      const result = await authedApi(`/checkout/requests/${encodeURIComponent(key)}`, { lang })
      if (id !== quoteSeq.current) return
      clearCheckoutRequest(user.id)
      reloadCart?.()
      navigate(`${path(`/don-hang/${result.order.code}`)}?moi=1`, { replace: true })
    } catch (err) {
      if (id !== quoteSeq.current) return
      if (err.status === 404) {
        clearCheckoutRequest(user.id)
        return loadQuote(appliedCoupon || undefined)
      }
      setQuoteError(err.code ?? 'INTERNAL_ERROR')
      setQuotePending(false)
    }
  }, [user, authedApi, lang, appliedCoupon, loadQuote, reloadCart, navigate, path])

  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect
    refreshCheckout()
    return () => { quoteSeq.current += 1 }
  }, [refreshCheckout])

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
    if (submitting.current || pending || quotePending || quoteError || !quote?.items.length || quote.hasShortage || quotedCoupon !== appliedCoupon) return
    submitting.current = true
    const body = {
      ...form,
      hasMessage: form.orderKind === 'gift' ? true : form.hasMessage,
      qrLang: form.orderKind === 'gift' || form.hasMessage ? form.qrLang : undefined,
      couponCode: appliedCoupon || undefined,
      expectedTotal: seenTotal.current ?? undefined,
    }
    const res = await run(async () => {
      try {
        body.idempotencyKey = await checkoutRequestKey(user.id, body, quote.items)
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
    if (!res) { submitting.current = false; return }
    clearCheckoutRequest(user.id)
    setPriceChanged(false)
    reloadCart?.()
    // Feedback 08/10, 7.2: lời chúc chữ soạn ngay trong checkout, lưu ngay sau khi có mã đơn.
    // Lưu lỗi thì đơn vẫn đặt được; khách soạn lại ở trang đơn hàng (nhắc ở trang cảm ơn).
    const wishText = (form.orderKind === 'gift' || form.hasMessage) ? form.messageText.trim() : ''
    if (wishText) {
      await authedApi(`/orders/${encodeURIComponent(res.order.code)}/message`, { method: 'PUT', body: { text: wishText, textLang: form.qrLang } }).catch(() => {})
    }
    // payOS: chuyển sang trang thanh toán; COD: sang trang cảm ơn
    if (res.payment?.checkoutUrl) {
      window.location.assign(res.payment.checkoutUrl)
      return
    }
    navigate(`${path(`/don-hang/${res.order.code}`)}?moi=1`)
  }

  const hasMessage = form.orderKind === 'gift' || form.hasMessage
  const codBlocked = !form.recipientIsSelf
  // payOS chưa có khoá → vô hiệu lựa chọn kèm lý do (feedback 08/10, mục 30)
  const payosOff = site.status === 'ok' && site.data?.payosEnabled === false
  const noPayment = payosOff && codBlocked
  const submitBlocked = pending || noPayment || quotePending || Boolean(quoteError) || (quote ? quotedCoupon !== appliedCoupon || Boolean(quote.hasShortage) : true)

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
            <button type="button" onClick={refreshCheckout} disabled={quotePending}>{retryLabel}</button>
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

      <form id="checkout-form" ref={checkoutForm} className="form checkout-form" onSubmit={onSubmit} noValidate>
        <div className="checkout-main">
          {/* FR-CHK-002 (C-02) */}
          <Reveal as="fieldset" className="account-card">
            <StepLegend n={1}>{t('checkout.kindLegend')}</StepLegend>
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
                <Field
                  as="textarea"
                  rows={3}
                  maxLength={300}
                  label={t('checkout.messageText')}
                  value={form.messageText}
                  onChange={set('messageText')}
                  hint={t('checkout.messageTextHint', { n: form.messageText.length })}
                />
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
          </Reveal>

          {/* FR-CHK-004 (D-02, BR-SHP-001) */}
          <Reveal as="fieldset" className="account-card">
            <StepLegend n={2}>{t('checkout.recipientLegend')}</StepLegend>
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
            <AddressSelect
              provinceCode={form.provinceCode}
              wardCode={form.wardCode}
              errors={fields}
              onChange={(v) => setForm((f) => ({ ...f, ...v }))}
            />
            <Field as="textarea" rows={2} label={t('checkout.note')} value={form.note} onChange={set('note')} error={fields.note} />
          </Reveal>

          {/* FR-CHK-007 (D-35) */}
          <Reveal as="fieldset" className="account-card">
            <StepLegend n={3}>{t('checkout.paymentLegend')}</StepLegend>
            <label className={`check-row${payosOff ? ' is-disabled' : ''}`}>
              <input
                type="radio"
                name="paymentMethod"
                value="payos"
                disabled={payosOff}
                checked={form.paymentMethod === 'payos'}
                onChange={setBool('paymentMethod', 'payos')}
              />
              <span>
                {t('checkout.payos')}
                <small className="field-hint">{payosOff ? t('checkout.payosOff') : t('checkout.payosHint', { minutes: PAYMENT_MINUTES })}</small>
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
            {noPayment && <p className="notice error" role="alert">{t('checkout.giftNeedsPayos')}</p>}
            {fields.paymentMethod && <p className="field-error">{t(`errors.${fields.paymentMethod}`)}</p>}
          </Reveal>
        </div>

        {/* FR-CHK-006, FR-CHK-008 */}
        <aside className="checkout-aside">
          <div className="order-summary" aria-busy={quotePending}>
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
            <p className="sum-note">
              {t('checkout.totalNote')} {t('checkout.vatIncluded', { rate: Math.round(quote.vatRate * 100) })}:{' '}
              {formatVnd(quote.vatAmount)}
              {!quote.freeShipping && quote.freeShippingFrom > 0 && (
                <>
                  <br />
                  {t('checkout.freeShippingHint', { amount: formatVnd(quote.freeShippingFrom) })}
                </>
              )}
            </p>

            {quotePending && <p role="status">{t('checkout.loading')}</p>}
            {quoteError && <p className="notice error" role="alert">
              {t(`errors.${quoteError}`)} <button type="button" disabled={quotePending} onClick={refreshCheckout}>{retryLabel}</button>
            </p>}
            {quote.hasShortage && <p className="notice error" role="alert">{t('cart.hasShortage')}</p>}
            {priceChanged && (
              <p className="notice error" role="alert">
                {t('checkout.priceChanged')}
              </p>
            )}
            {error && error !== 'PRICE_CHANGED' && (
              <p className="notice error" role="alert">
                {t(`errors.${error}`)}
              </p>
            )}

            <button className="btn btn-primary btn-block" type="submit" disabled={submitBlocked}>
              {pending ? t('checkout.submitting') : t('checkout.submit')}
            </button>
          </div>
        </aside>
        {/* Feedback 08/10, 7.5: trên mobile, tổng tiền + nút Đặt hàng luôn nằm ở đáy màn hình */}
        {/* aria-hidden: lối tắt thị giác cho mobile; người dùng bàn phím/trình đọc màn hình dùng nút Đặt hàng thật ở trên */}
        <div className="checkout-bar" aria-hidden="true">
          <span>
            <small>{t('checkout.total')}</small>
            <strong>{formatVnd(quote.total)}</strong>
          </span>
          <button className="btn btn-primary" type="submit" form="checkout-form" tabIndex={-1} disabled={submitBlocked}>
            {pending ? t('checkout.submitting') : t('checkout.submit')}
          </button>
        </div>
      </form>
    </section>
  )
}
