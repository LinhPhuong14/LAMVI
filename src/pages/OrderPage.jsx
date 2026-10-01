import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useParams, useSearchParams } from 'react-router-dom'
import Seo from '../seo/Seo.jsx'
import { formatVnd } from '../lib/money.js'
import { formatDateTime as formatDate } from '../lib/date.js'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'

// Webhook payOS có thể đến chậm (US-002 AC-002): hỏi lại mỗi 3 giây, tối đa 2 phút
const POLL_MS = 3000
const POLL_MAX = 40

// C-11: 4 công đoạn hiển thị cho khách khi đang làm
function Stages({ order }) {
  const { t } = useI18n()
  const steps = t('process.steps')
  const reached = order.status === 'IN_PRODUCTION' ? order.productionStage : ['PACKED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED'].includes(order.status) ? 4 : 0
  if (['PENDING_PAYMENT', 'CANCELLED'].includes(order.status)) return null
  return (
    <ol className="order-stages">
      {steps.map((s, i) => (
        <li key={s.label} className={i + 1 <= reached ? 'is-done' : i + 1 === reached + 1 && order.status === 'IN_PRODUCTION' ? 'is-next' : ''}>
          <span className="order-stage-n">{i + 1}</span>
          {s.label}
        </li>
      ))}
    </ol>
  )
}

function Row({ label, children, strong }) {
  return (
    <div className={`summary-row ${strong ? 'is-total' : ''}`}>
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

// FR-ACC-002: chi tiết đơn của tôi — noindex
export default function OrderPage() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const { t, path, lang } = useI18n()
  const { user, authedApi } = useAuth()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading' })
  const [action, setAction] = useState({ pending: false, error: null })
  // Số lần hỏi lại khi chờ webhook; reloads: nạp lại sau thao tác lỗi
  const [polls, setPolls] = useState(0)
  const [reloads, setReloads] = useState(0)
  const returned = params.get('payment') === 'return'

  useEffect(() => {
    if (!user) return
    let alive = true
    authedApi(`/orders/${encodeURIComponent(id)}?lang=${lang}`)
      .then((res) => alive && setState({ status: 'ok', order: res.order }))
      .catch((err) => alive && setState((s) => (s.status === 'ok' ? s : { status: 'error', error: err.code ?? 'INTERNAL_ERROR' })))
    return () => {
      alive = false
    }
  }, [user, authedApi, id, lang, polls, reloads])

  // Quay về từ payOS mà chưa có webhook → hỏi lại định kỳ
  const pending = state.order?.status === 'PENDING_PAYMENT'
  useEffect(() => {
    if (!returned || !pending || polls >= POLL_MAX) return
    const timer = setTimeout(() => setPolls((n) => n + 1), POLL_MS)
    return () => clearTimeout(timer)
  }, [returned, pending, polls])

  if (!user) {
    return <Navigate to={`${path('/login')}?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  }

  async function run(fn) {
    setAction({ pending: true, error: null })
    try {
      await fn()
      setAction({ pending: false, error: null })
    } catch (err) {
      setAction({ pending: false, error: err.code ?? 'INTERNAL_ERROR' })
      setReloads((n) => n + 1)
    }
  }

  const onPay = () =>
    run(async () => {
      const res = await authedApi(`/orders/${encodeURIComponent(id)}/pay`, { method: 'POST' })
      window.location.assign(res.checkoutUrl)
    })

  const onCancel = () => {
    if (!window.confirm(t('orders.cancelConfirm'))) return
    run(async () => {
      const res = await authedApi(`/orders/${encodeURIComponent(id)}/cancel?lang=${lang}`, { method: 'POST' })
      setState({ status: 'ok', order: res.order })
    })
  }

  if (state.status !== 'ok') {
    return (
      <section className="page-section order">
        <Seo title={t('orders.title')} noindex />
        {state.status === 'loading' ? (
          <p>{t('account.loading')}</p>
        ) : (
          <p className="notice error" role="alert">
            {t(`errors.${state.error}`)}
          </p>
        )}
        <Link to={path('/account')}>{t('orders.backToAccount')}</Link>
      </section>
    )
  }

  const o = state.order
  const r = o.recipient
  return (
    <section className="page-section order">
      <Seo title={t('orders.orderTitle', { code: o.code })} noindex />
      <h1 className="page-title">{t('orders.orderTitle', { code: o.code })}</h1>
      <p className="order-meta">
        {formatDate(o.createdAt, lang)} · <span className={`order-status status-${o.status}`}>{t(`orderStatus.${o.status}`)}</span>
      </p>

      {params.get('placed') === '1' && o.status === 'CONFIRMED' && (
        <p className="notice success" role="status">
          {t('orders.placed')}
        </p>
      )}
      {pending && (
        <p className="notice" role="status">
          {!returned
            ? t('orders.pendingPayment', { time: formatDate(o.paymentExpiresAt, lang) })
            : polls >= POLL_MAX
              ? t('orders.waitingLong')
              : t('orders.waitingPayment')}
        </p>
      )}
      {returned && o.status === 'CONFIRMED' && o.paymentMethod === 'payos' && (
        <p className="notice success" role="status">
          {t('orders.paid')}
        </p>
      )}
      {params.get('payment') === 'cancel' && pending && <p className="notice">{t('orders.paymentCancelled')}</p>}
      {action.error && (
        <p className="notice error" role="alert">
          {t(`errors.${action.error}`)}
        </p>
      )}

      <Stages order={o} />
      {o.trackingCode && (
        <p>
          {t('orders.tracking')}: <strong>{o.trackingCode}</strong>
        </p>
      )}
      {o.status === 'CANCELLED' && (
        <p className="notice">
          {t(`orders.cancelReason.${o.cancelReason ?? 'admin'}`)}
          {o.paymentStatus === 'REFUND_PENDING' && ` ${t('orders.refundPending')}`}
          {o.paymentStatus === 'REFUNDED' && ` ${t('orders.refunded', { amount: formatVnd(o.refundedAmount) })}`}
        </p>
      )}

      <div className="account-card">
        <h2>{t('orders.items')}</h2>
        <ul className="summary-items">
          {o.items.map((i) => (
            <li key={i.slug}>
              <span>
                {i.name} × {i.quantity}
              </span>
              <span>{formatVnd(i.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <Row label={t('checkout.subtotal')}>{formatVnd(o.subtotal)}</Row>
        {o.discount > 0 && (
          <Row label={`${t('checkout.discount')}${o.couponCode ? ` (${o.couponCode})` : ''}`}>−{formatVnd(o.discount)}</Row>
        )}
        <Row label={t('checkout.shipping')}>{o.shippingFee === 0 ? t('checkout.free') : formatVnd(o.shippingFee)}</Row>
        <Row label={t('checkout.vat', { rate: 10 })}>{formatVnd(o.vat)}</Row>
        <Row label={t('checkout.total')} strong>
          {formatVnd(o.total)}
        </Row>
        <p className="field-hint">
          {t(`checkout.${o.paymentMethod}`)} · {t(`paymentStatus.${o.paymentStatus}`)}
        </p>
      </div>

      <div className="account-card">
        <h2>{t('checkout.recipient')}</h2>
        <p>
          <strong>{r.name}</strong> · {r.phone}
          <br />
          {[r.street, r.ward, r.district, r.province].join(', ')}
        </p>
        <p className="field-hint">{t(o.orderType === 'gift' ? 'checkout.gift' : 'checkout.self')}</p>
        {o.hasMessage && (
          <p className="field-hint">
            {t('orders.messageInfo', { lang: t(`locales.${o.qrLang}`) })}
          </p>
        )}
      </div>

      <div className="order-actions">
        {o.canPay && (
          <button type="button" className="btn btn-primary" onClick={onPay} disabled={action.pending}>
            {t('orders.pay')}
          </button>
        )}
        {o.canCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={action.pending}>
            {t('orders.cancel')}
          </button>
        )}
        <Link to={path('/account')} className="btn btn-ghost">
          {t('orders.backToAccount')}
        </Link>
      </div>
    </section>
  )
}

// Danh sách đơn trên trang tài khoản (FR-ACC-002)
export function OrderList() {
  const { t, path, lang } = useI18n()
  const { authedApi } = useAuth()
  const [items, setItems] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    authedApi(`/orders?lang=${lang}`)
      .then((res) => alive && setItems(res.items))
      .catch((err) => alive && setError(err.code ?? 'INTERNAL_ERROR'))
    return () => {
      alive = false
    }
  }, [authedApi, lang])
  // Phần phụ của trang tài khoản → không dùng role="alert" (tránh lấn thông báo chính)
  if (error) return <p className="notice error">{t(`errors.${error}`)}</p>
  if (!items) return <p>{t('account.loading')}</p>
  if (!items.length) return <p>{t('orders.empty')}</p>
  return (
    <ul className="order-list">
      {items.map((o) => (
        <li key={o.id}>
          <Link to={path(`/account/orders/${o.id}`)}>
            <strong>#{o.code}</strong> · {o.firstItemName} · {t('orders.itemCount', { n: o.itemCount })}
          </Link>
          <span className={`order-status status-${o.status}`}>{t(`orderStatus.${o.status}`)}</span>
          <span>{formatVnd(o.total)}</span>
          <small>{formatDate(o.createdAt, lang)}</small>
        </li>
      ))}
    </ul>
  )
}
