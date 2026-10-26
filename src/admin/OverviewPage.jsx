import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { formatVnd } from '../lib/money.js'
import PageHead from './PageHead.jsx'
import { S } from './strings.js'

const DAY = 86400000
const startOfDay = (t) => new Date(new Date(t).setHours(0, 0, 0, 0)).getTime()
const counted = (o) => !['cancelled', 'pending_payment'].includes(o.status)

// Trang mặc định của admin: việc cần làm hôm nay trước, số liệu sau (docs/knowledge/dashboard-ux.md, B1)
export default function OverviewPage() {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [state, setState] = useState({ status: 'loading' })
  const [now] = useState(() => Date.now())

  useEffect(() => {
    let alive = true
    Promise.all([authedApi('/admin/orders'), authedApi('/admin/returns?status=requested').catch(() => ({ items: [] })), authedApi('/admin/batches').catch(() => ({ items: [] }))])
      .then(([o, r, b]) => alive && setState({ status: 'ok', orders: o.items, returns: r.items ?? [], batches: b.items ?? [] }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [authedApi])

  const view = useMemo(() => {
    if (state.status !== 'ok') return null
    const { orders, returns, batches } = state
    const today = startOfDay(now)
    const days = Array.from({ length: 7 }, (_, i) => today - (6 - i) * DAY)
    const sumDay = (from) => orders.filter((o) => counted(o) && startOfDay(o.createdAt) === from).reduce((a, o) => a + o.total, 0)
    const bars = days.map((d) => ({ d, v: sumDay(d) }))
    const prev = days.map((d) => sumDay(d - 7 * DAY)).reduce((a, b) => a + b, 0)
    const week = bars.reduce((a, b) => a + b.v, 0)
    const weekOrders = orders.filter((o) => counted(o) && startOfDay(o.createdAt) >= days[0])
    return {
      bars,
      week,
      prev,
      weekCount: weekOrders.length,
      avg: weekOrders.length ? Math.round(week / weekOrders.length) : 0,
      fresh: orders.filter((o) => o.status === 'confirmed'),
      cod: orders.filter((o) => o.paymentMethod === 'cod' && o.paymentStatus === 'pending' && ['shipped', 'delivered'].includes(o.status)),
      flagged: orders.filter((o) => o.paymentFlag),
      returns,
      draftBatches: batches.filter((b) => b.status !== 'video_published'),
      recent: [...orders].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)).slice(0, 6),
    }
  }, [state, now])

  const O = S.overview
  if (state.status === 'loading') return <p>{S.common.loading}</p>
  if (state.status === 'error')
    return (
      <p className="notice error" role="alert">
        {t(`errors.${state.error.code}`)}
      </p>
    )

  const max = Math.max(1, ...view.bars.map((b) => b.v))
  const delta = view.prev ? Math.round(((view.week - view.prev) / view.prev) * 100) : null
  const todo = [
    { key: 'fresh', n: view.fresh.length, to: '/admin/orders?loc=confirmed', label: O.fresh, hint: O.freshHint },
    { key: 'cod', n: view.cod.length, to: '/admin/orders?loc=cod', label: O.cod, hint: O.codHint },
    { key: 'returns', n: view.returns.length, to: '/admin/returns', label: O.returns, hint: O.returnsHint },
  ]

  return (
    <section className="overview">
      <PageHead title={O.title}>
        <div className="admin-actions">
          <Link to="/admin/coupons" className="btn btn-ghost btn-small">
            {O.newCoupon}
          </Link>
          <Link to="/admin/products" className="btn btn-ghost btn-small">
            {O.newProduct}
          </Link>
        </div>
      </PageHead>

      <h2 className="overview-h">{O.todoTitle}</h2>
      <ul className="todo-row">
        {todo.map((x) => (
          <li key={x.key} className={x.n ? 'todo has-work' : 'todo'}>
            <Link to={x.to}>
              <strong>{x.n}</strong>
              <span className="todo-label">{x.label}</span>
              <span className="todo-hint">{x.n ? x.hint : O.allClear}</span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="overview-cols">
        <div className="overview-panel">
          <h2 className="overview-h">{O.weekTitle}</h2>
          <div className="overview-kpis">
            <div>
              <strong>{formatVnd(view.week)}</strong>
              <span>{O.revenue}</span>
              {delta !== null && <em className={delta >= 0 ? 'up' : 'down'}>{`${delta >= 0 ? '+' : ''}${delta}% ${O.vsPrev}`}</em>}
            </div>
            <div>
              <strong>{view.weekCount}</strong>
              <span>{O.orders}</span>
            </div>
            <div>
              <strong>{formatVnd(view.avg)}</strong>
              <span>{O.avg}</span>
            </div>
          </div>
          <div className="bars" role="img" aria-label={O.chartLabel}>
            {view.bars.map((b) => (
              <div key={b.d} className="bar">
                <span className="bar-fill" style={{ height: `${Math.max(3, Math.round((b.v / max) * 100))}%` }} title={formatVnd(b.v)} />
                <small>{new Date(b.d).toLocaleDateString('vi-VN', { weekday: 'short' })}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="overview-panel">
          <h2 className="overview-h">{O.watchTitle}</h2>
          <ul className="watch">
            {view.flagged.length > 0 && (
              <li>
                <Link to="/admin/orders?loc=flag">{`${view.flagged.length} ${O.flagged}`}</Link>
              </li>
            )}
            {view.draftBatches.length > 0 && (
              <li>
                <Link to="/admin/batches">{`${view.draftBatches.length} ${O.draftBatches}`}</Link>
              </li>
            )}
            {view.flagged.length === 0 && view.draftBatches.length === 0 && <li className="field-hint">{O.watchNone}</li>}
          </ul>

          <h2 className="overview-h">{O.recentTitle}</h2>
          <ul className="recent">
            {view.recent.map((o) => (
              <li key={o.code}>
                <Link to={`/admin/orders/${o.code}`}>
                  <code>{o.code}</code>
                  <span>{o.recipientName}</span>
                  <span>{formatVnd(o.total)}</span>
                </Link>
              </li>
            ))}
            {view.recent.length === 0 && <li className="field-hint">{S.orders.empty}</li>}
          </ul>
        </div>
      </div>
    </section>
  )
}
