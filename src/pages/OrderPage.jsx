import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Reveal } from '../components/Reveal'
import Seo from '../seo/Seo.jsx'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import { formatVnd } from '../lib/money.js'
import OrderProgress, { StatusBadge } from '../orders/OrderStatus.jsx'
import { track } from '../analytics/index.js'

function Row({ label, children }) {
  return (
    <div className="sum-row">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

/**
 * Chi tiết một đơn (FR-ACC-002) kiêm trang cảm ơn sau khi đặt (§12). noindex (BR-SEO-001).
 * `?moi=1` là lần đầu vào sau khi đặt xong; `?huy=1` là khi khách bấm huỷ trên trang payOS.
 */
export default function OrderPage() {
  const { code } = useParams()
  const { t, lang, path } = useI18n()
  const { user, authedApi } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const isNew = params.get('moi') === '1'

  const [order, setOrder] = useState(null)
  const [error, setError] = useState(null)
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!user) navigate(`${path('/login')}?next=${encodeURIComponent(path(`/don-hang/${code}`))}`, { replace: true })
  }, [user, navigate, path, code])

  const load = useCallback(async () => {
    try {
      const r = await authedApi(`/orders/${encodeURIComponent(code)}`, { lang })
      setOrder(r.item)
      setError(null)
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
    }
  }, [authedApi, code, lang])

  useEffect(() => {
    if (!user) return
    // Đồng bộ với hệ thống ngoài (gọi API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [user, load])

  // FR-GA-001 §23.3: purchase — chỉ gửi một lần, khi vừa đặt xong
  const tracked = useRef(false)
  useEffect(() => {
    if (!isNew || !order || tracked.current) return
    tracked.current = true
    track('purchase', {
      transaction_id: order.code,
      value: order.total,
      currency: 'VND',
      shipping: order.shippingFee,
      payment_method: order.paymentMethod,
    })
  }, [isNew, order])

  // Đơn chờ thanh toán: hỏi lại server sau khi quay về từ payOS (webhook có thể về chậm — §15.1)
  useEffect(() => {
    if (order?.status !== 'pending_payment') return
    const id = setInterval(load, 5000)
    return () => clearInterval(id)
  }, [order?.status, load])

  // Lấy lại liên kết thanh toán: lần tạo đơn có thể gặp lỗi cổng, hoặc khách đã đóng tab payOS
  const [paying, setPaying] = useState(false)
  async function payNow() {
    setPaying(true)
    setError(null)
    try {
      const r = await authedApi(`/orders/${encodeURIComponent(code)}/payment`, { method: 'POST', body: {}, lang })
      if (r.payment?.checkoutUrl) window.location.assign(r.payment.checkoutUrl)
      else setError('PAYMENT_GATEWAY_ERROR')
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
      load()
    } finally {
      setPaying(false)
    }
  }

  async function cancel() {
    if (!window.confirm(t('orders.cancelConfirm'))) return
    setCancelling(true)
    try {
      const r = await authedApi(`/orders/${encodeURIComponent(code)}/cancel`, { method: 'POST', body: {}, lang })
      setOrder(r.item)
      track('cancel_order', { transaction_id: code, value: r.item.total, currency: 'VND' })
    } catch (err) {
      setError(err.code ?? 'INTERNAL_ERROR')
    } finally {
      setCancelling(false)
    }
  }

  if (!user) return null

  const head = <Seo title={t('orders.detailTitle', { code })} noindex status={error === 'NOT_FOUND' ? 404 : undefined} />

  if (error && !order) {
    return (
      <section className="page-section medium">
        {head}
        <h1 className="page-title">{t('orders.detailTitle', { code })}</h1>
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
        <Link to={`${path('/account')}?tab=orders`} className="btn btn-ghost">
          {t('orders.title')}
        </Link>
      </section>
    )
  }

  if (!order) {
    return (
      <section className="page-section medium">
        {head}
        <p>{t('orders.loading')}</p>
      </section>
    )
  }

  const canCancel = ['pending_payment', 'confirmed', 'in_production', 'packed'].includes(order.status)

  return (
    <section className="page-section medium order-page">
      {head}
      {isNew && (
        <Reveal as="div" className="account-card order-thanks">
          <h1 className="page-title">{t('orders.thanksTitle')}</h1>
          <p>{t('orders.thanksText', { code: order.code })}</p>
          {order.hasMessage && <p className="field-hint">{t('orders.thanksMessage')}</p>}
        </Reveal>
      )}
      {!isNew && <h1 className="page-title">{t('orders.detailTitle', { code: order.code })}</h1>}

      <Reveal as="div" className="account-card">
        <div className="order-head">
          <StatusBadge status={order.status} />
          <span className="field-hint">
            {t('orders.placedAt')}: {new Date(order.createdAt).toLocaleDateString(lang === 'zh' ? 'zh-Hans' : lang)}
          </span>
        </div>
        <OrderProgress status={order.status} />

        {order.status === 'pending_payment' && (
          <>
            <p className="notice" role="status">
              {t('orders.awaitingPayment')}{' '}
              {order.paymentExpiresAt &&
                t('orders.payExpires', { time: new Date(order.paymentExpiresAt).toLocaleTimeString() })}
            </p>
            {order.paymentMethod === 'payos' && (
              <button type="button" className="btn btn-primary" onClick={payNow} disabled={paying}>
                {t('orders.payNow')}
              </button>
            )}
          </>
        )}
        {order.paymentStatus === 'expired' && <p className="notice">{t('orders.payExpired')}</p>}
        {error && (
          <p className="notice error" role="alert">
            {t(`errors.${error}`)}
          </p>
        )}

        <h2>{t('orders.items')}</h2>
        <ul className="sum-items">
          {order.items.map((i) => (
            <li key={i.slug}>
              <span>
                <Link to={path(`/products/${i.slug}`)} className="product-link">
                  {i.name}
                </Link>{' '}
                <small>
                  {t('orders.quantity')} {i.quantity}
                </small>
              </span>
              <span>{formatVnd(i.lineTotal)}</span>
            </li>
          ))}
        </ul>

        <Row label={t('checkout.subtotal')}>{formatVnd(order.subtotal)}</Row>
        {order.discount > 0 && (
          <Row label={`${t('checkout.discount')}${order.couponCode ? ` (${order.couponCode})` : ''}`}>
            −{formatVnd(order.discount)}
          </Row>
        )}
        <Row label={t('checkout.shipping')}>
          {order.shippingFee ? formatVnd(order.shippingFee) : t('checkout.shippingFree')}
        </Row>
        <div className="sum-row sum-total">
          <span>{t('checkout.total')}</span>
          <span>{formatVnd(order.total)}</span>
        </div>
        <p className="sum-note">
          {t('checkout.totalNote')} {t('checkout.vatIncluded', { rate: Math.round(order.vatRate * 100) })}:{' '}
          {formatVnd(order.vatAmount)}
        </p>

        <h2>{t('orders.recipient')}</h2>
        <p>
          {order.recipientName} · {order.recipientPhone}
          <br />
          {[order.addressLine, order.ward, order.district, order.province].filter(Boolean).join(', ')}
        </p>

        <h2>{t('orders.payment')}</h2>
        <p>
          {t(`orders.methods.${order.paymentMethod}`)} — {t(`orders.paymentStatuses.${order.paymentStatus}`)}
        </p>
        {order.trackingCode && (
          <p>
            {t('orders.tracking')}: <code>{order.trackingCode}</code>
          </p>
        )}

        {canCancel && (
          <button type="button" className="btn btn-ghost" onClick={cancel} disabled={cancelling}>
            {cancelling ? t('orders.cancelling') : t('orders.cancel')}
          </button>
        )}
      </Reveal>

      <Link to={`${path('/account')}?tab=orders`} className="back-link">
        ← {t('orders.title')}
      </Link>
    </section>
  )
}
