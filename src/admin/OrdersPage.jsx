import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { useAdminList } from './useAdminList.js'
import PageHead from './PageHead.jsx'
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

// FR-QR-001, D-28: mã QR của đơn để in lên thiệp cảm ơn. Dựng ở trình duyệt, không gửi URL đi đâu.
function GiftCard({ order }) {
  const [png, setPng] = useState(null)
  const [copied, setCopied] = useState(false)
  const url = order.qrUrl
  useEffect(() => {
    if (!url) return
    let alive = true
    import('qrcode')
      .then((m) => m.default.toDataURL(url, { margin: 2, width: 320, errorCorrectionLevel: 'M' }))
      .then((d) => alive && setPng(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [url])

  if (!url) return null
  const m = order.message
  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      /* trình duyệt chặn clipboard: admin vẫn chọn tay được ở ô liên kết */
    }
  }

  return (
    <div className="account-card">
      <h2>{S.orders.gift}</h2>
      <p className="field-hint">{S.orders.giftHint}</p>
      {m ? (
        <>
          <Row label={S.orders.giftState}>{S.orders.giftStates[m.state] ?? m.state}</Row>
          <Row label={S.orders.giftText}>{m.hasText ? S.faq.yes : S.faq.no}</Row>
          {m.hasText && m.textLang && <Row label={S.orders.giftTextLang}>{S.common.langs[m.textLang]}</Row>}
          <Row label={S.orders.giftVoice}>{m.hasVoice ? S.faq.yes : S.faq.no}</Row>
          <Row label={S.orders.giftVideo}>{m.hasVideo ? S.faq.yes : S.faq.no}</Row>
          <Row label={S.orders.giftConfirmed}>{m.confirmedAt ? date(m.confirmedAt) : S.orders.giftNotConfirmed}</Row>
          {m.mediaDeleted && <p className="field-hint">{S.orders.giftMediaDeleted}</p>}
        </>
      ) : (
        <p className="field-hint">{S.orders.giftNone}</p>
      )}
      <h3>{S.orders.qrImage}</h3>
      {png && <img src={png} alt={S.orders.qrImage} width="160" height="160" />}
      <Field label={S.orders.qrLink} value={url} readOnly onFocus={(e) => e.target.select()} hint={S.orders.qrPrivate} />
      <button type="button" className="btn btn-small" onClick={copy}>
        {copied ? S.orders.qrCopied : S.orders.qrCopy}
      </button>
    </div>
  )
}

// FR-ORD-002: chi tiết một đơn + đổi trạng thái theo đúng luồng §16
function OrderDetail({ code, onChanged }) {
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
      onChanged?.()
    } catch (err) {
      setError(err.code)
    } finally {
      setBusy(false)
    }
  }

  // D-114: chuyển nhanh một bước bằng nút (cùng API /status, có xác nhận)
  async function quickMove(to) {
    if (!window.confirm(fmt(S.orders.statusConfirm, { code, status: label.status(to) }))) return
    setBusy(true)
    setError(null)
    try {
      await authedApi(`/admin/orders/${encodeURIComponent(code)}/status`, {
        method: 'POST',
        body: { status: to, trackingCode: tracking || null },
      })
      await load()
      onChanged?.()
    } catch (err) {
      setError(err.code)
    } finally {
      setBusy(false)
    }
  }

  // D-114: ghi nhận đã thu tiền COD
  async function codCollected() {
    if (!window.confirm(fmt(S.orders.codConfirm, { code }))) return
    setBusy(true)
    setError(null)
    try {
      await authedApi(`/admin/orders/${encodeURIComponent(code)}/cod-collected`, { method: 'POST', body: {} })
      await load()
      onChanged?.()
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
      onChanged?.()
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
      <PageHead title={o.code} eyebrow={S.orders.title}>
        <span className={`order-status order-status-${o.status}`}>{label.status(o.status)}</span>
      </PageHead>

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
          {(o.paymentStatus === 'refund_pending' || (o.status === 'cancelled' && o.paymentStatus === 'paid' && o.paymentFlag === 'PAID_AFTER_CANCEL')) && (
            <>
              <p className="field-hint">{S.orders.refundHint}</p>
              <button type="button" className="btn btn-small" onClick={refund} disabled={busy}>
                {S.orders.refund}
              </button>
            </>
          )}
        </div>
      </div>

      <GiftCard order={o} />

      {o.paymentMethod === 'cod' && o.paymentStatus === 'pending' && ['shipped', 'delivered'].includes(o.status) && (
        <div className="account-card">
          <h2>{S.orders.codTitle}</h2>
          <p className="field-hint">{S.orders.codPending}</p>
          <button type="button" className="btn btn-primary" onClick={codCollected} disabled={busy}>
            {S.orders.codCollect}
          </button>
        </div>
      )}

      {o.nextStatuses.length > 0 && (
        <div className="account-card">
          <h2>{S.orders.quickTitle}</h2>
          <p className="field-hint">{S.orders.quickHint}</p>
          <div className="admin-actions">
            {o.nextStatuses.map((st) => (
              <button
                key={st}
                type="button"
                className={`btn ${st === 'cancelled' || st === 'delivery_failed' ? 'btn-ghost' : 'btn-secondary'}`}
                onClick={() => quickMove(st)}
                disabled={busy}
              >
                {fmt(S.orders.quickBtn, { status: label.status(st) })}
              </button>
            ))}
          </div>
        </div>
      )}

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

// FR-ORD-002: danh sách đơn. Chip trạng thái kèm số lượng, tìm kiếm, một nút chuyển bước kế tiếp trên mỗi hàng;
// mở một đơn thì chi tiết hiện bên phải, danh sách vẫn ở bên trái (docs/knowledge/dashboard-ux.md, B2)
const STATUSES = ['pending_payment', 'confirmed', 'in_production', 'packed', 'shipped', 'delivered', 'delivery_failed', 'cancelled']
const isCodOpen = (o) => o.paymentMethod === 'cod' && o.paymentStatus === 'pending' && ['shipped', 'delivered'].includes(o.status)
const normalize = (v) => String(v ?? '').toLowerCase()

export default function OrdersPage() {
  const { code } = useParams()
  const { t } = useI18n()
  const { authedApi } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const label = useStatusLabel()
  const [chip, setChip] = useState(params.get('loc') ?? 'all')
  const [q, setQ] = useState('')
  const [moveError, setMoveError] = useState(null)
  const list = useAdminList('/admin/orders')

  const items = list.status === 'ok' ? list.items : []
  const count = (c) =>
    c === 'all' ? items.length : c === 'cod' ? items.filter(isCodOpen).length : c === 'flag' ? items.filter((o) => o.paymentFlag).length : items.filter((o) => o.status === c).length
  const needle = normalize(q).trim()
  const shown = items.filter((o) => {
    const inChip = chip === 'all' || (chip === 'cod' ? isCodOpen(o) : chip === 'flag' ? Boolean(o.paymentFlag) : o.status === chip)
    return inChip && (!needle || [o.code, o.recipientName, o.recipientPhone].some((v) => normalize(v).includes(needle)))
  })
  const chips = [['all', S.orders.chipAll], ...STATUSES.map((s) => [s, label.status(s)]), ['cod', S.orders.chipCod], ['flag', S.orders.chipFlag]]

  // Một nút chuyển sang bước kế tiếp thuận chiều (không phải huỷ / giao thất bại); bước khác mở chi tiết
  const forward = (o) => o.nextStatuses.find((s) => !['cancelled', 'delivery_failed'].includes(s))
  async function move(o) {
    const to = forward(o)
    if (!to || !window.confirm(fmt(S.orders.statusConfirm, { code: o.code, status: label.status(to) }))) return
    setMoveError(null)
    try {
      await authedApi(`/admin/orders/${encodeURIComponent(o.code)}/status`, { method: 'POST', body: { status: to, trackingCode: null } })
      list.reload()
    } catch (err) {
      setMoveError(err.code)
    }
  }

  return (
    <section className={`orders-split${code ? ' has-detail' : ''}`}>
      <div className="orders-list">
        <PageHead title={S.orders.title} />
        <input
          type="search"
          className="admin-search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={S.orders.search}
          aria-label={S.orders.search}
        />
        <div className="chip-row" role="group" aria-label={S.orders.colStatus}>
          {chips.filter(([key]) => key === 'all' || key === chip || count(key) > 0).map(([key, text]) => (
            <button key={key} type="button" className={`chip${chip === key ? ' is-on' : ''}`} aria-pressed={chip === key} onClick={() => setChip(key)}>
              {text}
              <b>{count(key)}</b>
            </button>
          ))}
        </div>
        {moveError && (
          <p className="notice error" role="alert">
            {t(`errors.${moveError}`)}
          </p>
        )}
        {list.status === 'loading' && <p>{S.common.loading}</p>}
        {list.status === 'error' && (
          <p className="notice error" role="alert">
            {t(`errors.${list.error.code}`)}
          </p>
        )}
        {list.status === 'ok' &&
          (shown.length === 0 ? (
            <p>{S.orders.empty}</p>
          ) : (
            <div className="admin-panel">
              <table className="admin-table orders-table">
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
                  {shown.map((o) => {
                    const to = forward(o)
                    return (
                      <tr key={o.code} className={`${o.code === code ? 'is-open' : ''}${o.status === 'confirmed' ? ' is-new' : ''}`.trim()} onClick={() => navigate(`/admin/orders/${o.code}`)}>
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
                        <td className="admin-row-actions" onClick={(e) => e.stopPropagation()}>
                          {to && (
                            <button type="button" className="btn btn-small btn-primary" onClick={() => move(o)}>
                              {fmt(S.orders.quickBtn, { status: label.status(to) })}
                            </button>
                          )}
                          <Link to={`/admin/orders/${o.code}`} className="btn btn-small">
                            {S.orders.detail}
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
      {code && (
        <aside className="orders-detail" aria-label={code}>
          <OrderDetail code={code} key={code} onChanged={list.reload} />
        </aside>
      )}
    </section>
  )
}
