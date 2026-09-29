import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { useAdminList } from './useAdminList.js'
import { S, fmt } from './strings.js'

// Nhãn trạng thái dùng chung với phía khách (i18n) để hai bên không lệch chữ
const useStatusLabel = () => {
  const { t } = useI18n()
  return {
    status: (s) => t(`orders.statuses.${s}`),
    payment: (s) => t(`orders.paymentStatuses.${s}`),
    method: (m) => t(`orders.methods.${m}`),
  }
}

const date = (iso) => new Date(iso).toLocaleString('vi-VN')

function Row({ label, children }) {
  return (
    <div className="sum-row">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

// FR-ORD-002: chi tiết một đơn + đổi trạng thái theo đúng luồng §16
function OrderDetail({ code }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const label = useStatusLabel()
  const [state, setState] = useState({ status: 'loading' })
  const [next, setNext] = useState('')
  const [tracking, setTracking] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await authedApi(`/admin/orders/${encodeURIComponent(code)}`)
      setState({ status: 'ok', item: r.item, audit: r.audit })
      setTracking(r.item.trackingCode ?? '')
      setNext(r.item.nextStatuses[0] ?? '')
    } catch (err) {
      setState({ status: 'error', error: err.code })
    }
  }, [authedApi, code])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  async function applyStatus() {
    if (!next) return
    if (!window.confirm(fmt(S.orders.statusConfirm, { code, status: label.status(next) }))) return
    setBusy(true)
    setError(null)
    try {
      await authedApi(`/admin/orders/${encodeURIComponent(code)}/status`, {
        method: 'POST',
        body: { status: next, trackingCode: tracking || null },
      })
      await load()
    } catch (err) {
      setError(err.code)
    } finally {
      setBusy(false)
    }
  }

  async function refund() {
    if (!window.confirm(fmt(S.orders.refundConfirm, { code }))) return
    setBusy(true)
    setError(null)
    try {
      await authedApi(`/admin/orders/${encodeURIComponent(code)}/refund`, { method: 'POST', body: {} })
      await load()
    } catch (err) {
      setError(err.code)
    } finally {
      setBusy(false)
    }
  }

  if (state.status === 'loading') return <p>{S.common.loading}</p>
  if (state.status === 'error')
    return (
      <p className="notice error" role="alert">
        {t(`errors.${state.error}`)}
      </p>
    )

  const o = state.item
  return (
    <section>
      <Link to="/admin/orders" className="back-link">
        {S.orders.back}
      </Link>
      <header className="admin-head">
        <h1>{o.code}</h1>
        <span className={`order-status order-status-${o.status}`}>{label.status(o.status)}</span>
      </header>

      {o.paymentFlag && (
        <p className="notice error" role="alert">
          <strong>{S.orders.flag}:</strong> {S.orders.flags[o.paymentFlag] ?? o.paymentFlag}
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="admin-cols">
        <div className="account-card">
          <h2>{S.orders.items}</h2>
          <ul className="sum-items">
            {o.items.map((i) => (
              <li key={i.slug}>
                <span>
                  {i.name} <small>× {i.quantity}</small>
                </span>
                <span>{formatVnd(i.lineTotal)}</span>
              </li>
            ))}
          </ul>
          <Row label={S.orders.subtotal}>{formatVnd(o.subtotal)}</Row>
          {o.discount > 0 && (
            <Row label={`${S.orders.discount}${o.couponCode ? ` (${o.couponCode})` : ''}`}>−{formatVnd(o.discount)}</Row>
          )}
          <Row label={S.orders.shipping}>{formatVnd(o.shippingFee)}</Row>
          <div className="sum-row sum-total">
            <span>{S.orders.total}</span>
            <span>{formatVnd(o.total)}</span>
          </div>
          <p className="field-hint">
            {S.orders.vat} ({Math.round(o.vatRate * 100)}%): {formatVnd(o.vatAmount)}
          </p>
        </div>

        <div className="account-card">
          <h2>{S.orders.recipient}</h2>
          <p>
            {o.recipientName} · {o.recipientPhone}
            <br />
            {[o.addressLine, o.ward, o.district, o.province].filter(Boolean).join(', ')}
          </p>
          <Row label={S.orders.kind}>{S.orders.kinds[o.orderKind]}</Row>
          <Row label={S.orders.hasMessage}>{o.hasMessage ? S.faq.yes : S.faq.no}</Row>
          {o.qrLang && <Row label={S.orders.qrLang}>{S.common.langs[o.qrLang]}</Row>}
          {o.note && (
            <p>
              <strong>{S.orders.note}:</strong> {o.note}
            </p>
          )}

          <h2>{S.orders.payment}</h2>
          <Row label={label.method(o.paymentMethod)}>{label.payment(o.paymentStatus)}</Row>
          {o.paymentStatus === 'refund_pending' && (
            <>
              <p className="field-hint">{S.orders.refundHint}</p>
              <button type="button" className="btn btn-small" onClick={refund} disabled={busy}>
                {S.orders.refund}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="account-card">
        <h2>{S.orders.nextStatus}</h2>
        {o.nextStatuses.length === 0 ? (
          <p className="field-hint">{S.orders.noNext}</p>
        ) : (
          <div className="admin-grid">
            <Field as="select" label={S.orders.nextStatus} value={next} onChange={(e) => setNext(e.target.value)}>
              {o.nextStatuses.map((s) => (
                <option key={s} value={s}>
                  {label.status(s)}
                </option>
              ))}
            </Field>
            <Field
              label={S.orders.trackingCode}
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              hint={S.orders.trackingHint}
            />
          </div>
        )}
        {o.nextStatuses.length > 0 && (
          <button type="button" className="btn btn-primary" onClick={applyStatus} disabled={busy || !next}>
            {S.orders.apply}
          </button>
        )}
      </div>

      {/* NFR-AUD-001 */}
      <div className="account-card">
        <h2>{S.orders.audit}</h2>
        {state.audit.length === 0 ? (
          <p className="field-hint">{S.orders.auditEmpty}</p>
        ) : (
          <table className="admin-table">
            <tbody>
              {state.audit.map((e) => (
                <tr key={e.id}>
                  <td>{date(e.at)}</td>
                  <td>{e.actorRole}</td>
                  <td>{e.action}</td>
                  <td>
                    <code>{JSON.stringify(e.newValue)}</code>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  )
}

// FR-ORD-002: danh sách đơn, lọc theo trạng thái
export default function OrdersPage() {
  const { code } = useParams()
  const { t } = useI18n()
  const label = useStatusLabel()
  const [status, setStatus] = useState('')
  const list = useAdminList(status ? `/admin/orders?status=${status}` : '/admin/orders')

  if (code) return <OrderDetail code={code} />

  const STATUSES = [
    'pending_payment',
    'confirmed',
    'in_production',
    'packed',
    'shipped',
    'delivered',
    'delivery_failed',
    'cancelled',
  ]

  return (
    <section>
      <header className="admin-head">
        <h1>{S.orders.title}</h1>
        <Field as="select" label={S.orders.colStatus} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">{S.orders.all}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {label.status(s)}
            </option>
          ))}
        </Field>
      </header>
      {list.status === 'loading' && <p>{S.common.loading}</p>}
      {list.status === 'error' && (
        <p className="notice error" role="alert">
          {t(`errors.${list.error.code}`)}
        </p>
      )}
      {list.status === 'ok' &&
        (list.items.length === 0 ? (
          <p>{S.orders.empty}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>{S.orders.colCode}</th>
                <th>{S.orders.colDate}</th>
                <th>{S.orders.colRecipient}</th>
                <th>{S.orders.colTotal}</th>
                <th>{S.orders.colStatus}</th>
                <th>{S.orders.colPayment}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.items.map((o) => (
                <tr key={o.code}>
                  <td>
                    <code>{o.code}</code>
                    {o.paymentFlag && <span className="status status-draft"> ⚑</span>}
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>{o.recipientName}</td>
                  <td>{formatVnd(o.total)}</td>
                  <td>
                    <span className={`order-status order-status-${o.status}`}>{label.status(o.status)}</span>
                  </td>
                  <td>{label.payment(o.paymentStatus)}</td>
                  <td className="admin-row-actions">
                    <Link to={`/admin/orders/${o.code}`} className="btn btn-small">
                      {S.orders.detail}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
    </section>
  )
}
