import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { formatVnd } from '../lib/money.js'
import { formatDateTime } from '../lib/date.js'
import { useAdminList } from './useAdminList.js'
import { S } from './strings.js'

const STATUSES = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED']

// FR-ORD-002: danh sách đơn
export function OrdersList() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const flagged = params.get('flagged') === '1'
  const query = flagged ? '?flagged=1' : status ? `?status=${status}` : ''
  const list = useAdminList(`/admin/orders${query}`)

  return (
    <section>
      <header className="admin-head">
        <h1>{S.orders.title}</h1>
      </header>
      <div className="admin-filters">
        <button type="button" className={`btn btn-small ${!status && !flagged ? 'btn-primary' : ''}`} onClick={() => setParams({})}>
          {S.orders.filterAll}
        </button>
        <button type="button" className={`btn btn-small ${flagged ? 'btn-primary' : ''}`} onClick={() => setParams({ flagged: '1' })}>
          {S.orders.filterFlagged}
        </button>
        {STATUSES.map((s) => (
          <button key={s} type="button" className={`btn btn-small ${status === s ? 'btn-primary' : ''}`} onClick={() => setParams({ status: s })}>
            {t(`orderStatus.${s}`)}
          </button>
        ))}
      </div>
      {list.status === 'loading' && <p>{S.common.loading}</p>}
      {list.status === 'error' && (
        <p className="notice error" role="alert">
          {t(`errors.${list.error.code}`)}
        </p>
      )}
      {list.status === 'ok' && !list.items.length && <p>{S.common.empty}</p>}
      {list.status === 'ok' && list.items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{S.orders.colCode}</th>
              <th>{S.orders.colDate}</th>
              <th>{S.orders.colRecipient}</th>
              <th>{S.orders.colTotal}</th>
              <th>{S.orders.colStatus}</th>
              <th>{S.orders.colPayment}</th>
            </tr>
          </thead>
          <tbody>
            {list.items.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link to={`/admin/orders/${o.id}`}>#{o.code}</Link>
                  {o.flags.length > 0 && <span className="admin-flag"> ⚠</span>}
                </td>
                <td>{formatDateTime(o.createdAt, 'vi')}</td>
                <td>{o.recipient.name}</td>
                <td>{formatVnd(o.total)}</td>
                <td>{t(`orderStatus.${o.status}`)}</td>
                <td>
                  {t(`checkout.${o.paymentMethod}`)} · {t(`paymentStatus.${o.paymentStatus}`)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

function Row({ label, children }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <span>{children}</span>
    </div>
  )
}

// Chi tiết đơn + thao tác chuyển trạng thái (§16)
export function OrderDetail() {
  const { id } = useParams()
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [order, setOrder] = useState(null)
  const [history, setHistory] = useState([])
  const [batches, setBatches] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [action, setAction] = useState({ pending: false, error: null, fields: {} })
  const [stage, setStage] = useState(1)
  const [tracking, setTracking] = useState('')
  const [refund, setRefund] = useState({ amount: '', note: '' })

  useEffect(() => {
    let alive = true
    Promise.all([authedApi(`/admin/orders/${encodeURIComponent(id)}`), authedApi('/admin/batches')])
      .then(([o, b]) => {
        if (!alive) return
        setOrder(o.item)
        setHistory(o.history ?? [])
        setBatches(b.items)
        setStage(o.item.productionStage ?? 1)
        setTracking(o.item.trackingCode ?? '')
        setRefund({ amount: String(o.item.paidAmount ?? o.item.total), note: '' })
      })
      .catch((err) => alive && setLoadError(err.code))
    return () => {
      alive = false
    }
  }, [authedApi, id])

  async function call(fn) {
    setAction({ pending: true, error: null, fields: {} })
    try {
      const res = await fn()
      setOrder(res.item)
      // Tải lại lịch sử sau mỗi thao tác
      authedApi(`/admin/orders/${encodeURIComponent(id)}`)
        .then((r) => setHistory(r.history ?? []))
        .catch(() => {})
      setAction({ pending: false, error: null, fields: {} })
    } catch (err) {
      setAction({ pending: false, error: err.code ?? 'INTERNAL_ERROR', fields: err.fields ?? {} })
    }
  }
  const act = (name, body = {}) => call(() => authedApi(`/admin/orders/${order.id}/actions/${name}`, { method: 'POST', body }))
  const setBatch = (itemId, batchId) =>
    call(() => authedApi(`/admin/orders/${order.id}/items/${itemId}/batch`, { method: 'PUT', body: { batchId: batchId || null } }))

  if (loadError) {
    return (
      <p className="notice error" role="alert">
        {t(`errors.${loadError}`)}
      </p>
    )
  }
  if (!order) return <p>{S.common.loading}</p>

  const o = order
  const r = o.recipient
  const A = S.orders.actions
  const btn = (name, body, cls = '') => (
    <button type="button" className={`btn btn-small ${cls}`} disabled={action.pending} onClick={() => act(name, body)}>
      {A[name]}
    </button>
  )
  const canAssign = ['CONFIRMED', 'IN_PRODUCTION', 'PACKED'].includes(o.status)
  const cancellable = ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED'].includes(o.status)

  return (
    <section className="admin-order">
      <Link to="/admin/orders">{S.orders.back}</Link>
      <header className="admin-head">
        <h1>{S.orders.detail.replace('{code}', o.code)}</h1>
        <span className={`order-status status-${o.status}`}>
          {t(`orderStatus.${o.status}`)}
          {o.status === 'IN_PRODUCTION' && ` · ${S.orders.stage} ${o.productionStage}/4`}
        </span>
      </header>
      <p className="field-hint">
        {formatDateTime(o.createdAt, 'vi')} · {S.orders.type[o.orderType]} ·{' '}
        {o.hasMessage ? S.orders.message.replace('{lang}', t(`locales.${o.qrLang}`)) : S.orders.noMessage}
      </p>
      {o.flags.map((f) => (
        <p key={f} className="notice error">
          {S.orders.flags[f] ?? f}
        </p>
      ))}
      {action.error && (
        <p className="notice error" role="alert">
          {t(`errors.${action.error}`)}
        </p>
      )}

      <div className="admin-order-grid">
        <div className="account-card">
          <h2>{S.orders.items}</h2>
          <table className="admin-table">
            <tbody>
              {o.items.map((i) => (
                <tr key={i.id}>
                  <td>
                    {i.productName?.vi} × {i.quantity}
                    <br />
                    <small>{formatVnd(i.lineTotal)}</small>
                  </td>
                  <td>
                    <label className="sr-only" htmlFor={`batch-${i.id}`}>
                      {S.orders.batch}
                    </label>
                    <select id={`batch-${i.id}`} value={i.batchId ?? ''} disabled={!canAssign || action.pending} onChange={(e) => setBatch(i.id, e.target.value)}>
                      <option value="">{S.orders.noBatch}</option>
                      {batches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code}
                          {b.status !== 'video_published' ? ` ${S.orders.batchUnpublished}` : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Row label={t('checkout.subtotal')}>{formatVnd(o.subtotal)}</Row>
          {o.discount > 0 && <Row label={`${t('checkout.discount')} (${o.couponCode})`}>−{formatVnd(o.discount)}</Row>}
          <Row label={t('checkout.shipping')}>{formatVnd(o.shippingFee)}</Row>
          <Row label={t('checkout.vat', { rate: 10 })}>{formatVnd(o.vat)}</Row>
          <Row label={t('checkout.total')}>
            <strong>{formatVnd(o.total)}</strong>
          </Row>
          <p className="field-hint">
            {t(`checkout.${o.paymentMethod}`)} · {t(`paymentStatus.${o.paymentStatus}`)}
          </p>
          {o.paidAt && (
            <p className="field-hint">
              {S.orders.paidInfo.replace('{amount}', formatVnd(o.paidAmount)).replace('{at}', formatDateTime(o.paidAt, 'vi')).replace('{ref}', o.paymentRef ?? '—')}
            </p>
          )}
          {o.paymentStatus === 'REFUNDED' && (
            <p className="field-hint">{S.orders.refundDone.replace('{amount}', formatVnd(o.refundedAmount)).replace('{note}', o.refundNote)}</p>
          )}
        </div>

        <div className="account-card">
          <h2>{S.orders.recipient}</h2>
          <p>
            <strong>{r.name}</strong> · {r.phone}
            <br />
            {[r.street, r.ward, r.district, r.province].join(', ')}
          </p>
          <h2>{S.orders.buyer}</h2>
          <p>
            {o.buyer.fullName ?? '—'}
            {o.buyer.phone ? ` · ${o.buyer.phone}` : ''}
          </p>
          {o.trackingCode && (
            <p>
              {S.orders.tracking}: <strong>{o.trackingCode}</strong>
            </p>
          )}
        </div>
      </div>

      <div className="account-card admin-order-actions">
        {o.status === 'CONFIRMED' && btn('start_production', {}, 'btn-primary')}
        {o.status === 'IN_PRODUCTION' && (
          <>
            <Field as="select" label={S.orders.stage} value={stage} onChange={(e) => setStage(Number(e.target.value))}>
              {t('process.steps').map((s, i) => (
                <option key={s.label} value={i + 1}>
                  {i + 1}. {s.label}
                </option>
              ))}
            </Field>
            {btn('set_stage', { stage })}
            {btn('pack', {}, 'btn-primary')}
          </>
        )}
        {(o.status === 'PACKED' || o.status === 'SHIPPED' || o.status === 'DELIVERY_FAILED') && (
          <>
            <Field label={S.orders.tracking} value={tracking} onChange={(e) => setTracking(e.target.value)} error={action.fields.trackingCode} />
            {o.status === 'PACKED' ? (
              <>
                {btn('ship', { trackingCode: tracking }, 'btn-primary')}
                <p className="field-hint">{S.orders.shipHint}</p>
              </>
            ) : (
              btn('set_tracking', { trackingCode: tracking })
            )}
          </>
        )}
        {o.status === 'SHIPPED' && (
          <>
            {btn('deliver', {}, 'btn-primary')}
            {btn('delivery_failed')}
          </>
        )}
        {o.paymentMethod === 'cod' && o.paymentStatus === 'COD_PENDING' && ['SHIPPED', 'DELIVERED'].includes(o.status) && btn('cod_collected')}
        {o.paymentStatus === 'REFUND_PENDING' && (
          <div className="admin-refund">
            <Field label={S.orders.refundAmount} type="number" value={refund.amount} onChange={(e) => setRefund({ ...refund, amount: e.target.value })} error={action.fields.amount} />
            <Field label={S.orders.refundNote} value={refund.note} onChange={(e) => setRefund({ ...refund, note: e.target.value })} error={action.fields.note} />
            {btn('refund', { amount: Number(refund.amount), note: refund.note }, 'btn-primary')}
          </div>
        )}
        {cancellable && (
          <button
            type="button"
            className="btn btn-small btn-danger"
            disabled={action.pending}
            onClick={() => window.confirm(S.orders.confirmCancel) && act('cancel')}
          >
            {A.cancel}
          </button>
        )}
      </div>
      <div className="account-card">
        <h2>{S.orders.history}</h2>
        <table className="admin-table admin-history">
          <thead>
            <tr>
              <th>{S.orders.historyCols.at}</th>
              <th>{S.orders.historyCols.who}</th>
              <th>{S.orders.historyCols.action}</th>
              <th>{S.orders.historyCols.change}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{formatDateTime(h.at, 'vi')}</td>
                <td>{S.orders.roles[h.actorRole] ?? h.actorRole}</td>
                <td>{S.orders.events[h.action] ?? A[h.action] ?? h.action}</td>
                <td>
                  <code>{Object.keys(h.newValue ?? {}).map((k) => `${k}: ${JSON.stringify(h.oldValue?.[k] ?? null)} → ${JSON.stringify(h.newValue[k])}`).join('; ')}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
