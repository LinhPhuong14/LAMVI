import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import LocaleProvider from '../i18n/LocaleProvider.jsx'
import { useI18n } from '../i18n/index.js'
import { useAuth } from '../auth/context.js'
import Seo from '../seo/Seo.jsx'
import { S, fmt, formatDuration } from './strings.js'

const REFRESH_MS = 30_000
const pct = (x) => `${(x * 100).toFixed(x > 0 && x < 0.001 ? 2 : 1)}%`
const ms = (x) => (x == null ? '—' : `${x} ms`)
const time = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—')

// Tải một endpoint IT, tự làm mới theo `tick`
function useItData(path, tick) {
  const { authedApi } = useAuth()
  const [state, setState] = useState({ status: 'loading' })
  useEffect(() => {
    let alive = true
    authedApi(path)
      .then((data) => alive && setState({ status: 'ok', data }))
      .catch((error) => alive && setState((s) => ({ ...s, status: s.data ? 'ok' : 'error', error })))
    return () => {
      alive = false
    }
  }, [authedApi, path, tick])
  return state
}

function ErrorNote({ error }) {
  const { t } = useI18n()
  return (
    <p className="notice error" role="alert">
      {t(`errors.${error?.code ?? 'INTERNAL_ERROR'}`)}
    </p>
  )
}

function HealthPanel({ health }) {
  const { checks, system, status } = health
  return (
    <section className="account-card it-card">
      <h2>{S.health.title}</h2>
      <p className={`it-overall it-${status}`} role="status">
        {S.health.overall[status]}
      </p>
      {system.dataMode === 'memory' && <p className="notice">{S.health.memoryMode}</p>}
      <ul className="it-checks">
        {checks.map((c) => (
          <li key={c.name} className={`it-check it-${c.status}`}>
            <strong>{S.health.checks[c.name] ?? c.name}</strong>
            <span className={`status status-${c.status}`}>{S.health.status[c.status]}</span>
            {c.latencyMs != null && <small>{fmt(S.health.latency, { ms: c.latencyMs })}</small>}
            {c.status === 'not_integrated' && <small>{c.configured ? S.health.configured : S.health.notConfigured}</small>}
            {c.budgetUsd != null && (
              <small>
                {fmt(S.health.budget, {
                  cost: (c.costUsd ?? 0).toFixed(2),
                  budget: c.budgetUsd,
                  pct: c.budgetPct == null ? '—' : Math.round(c.budgetPct * 100),
                })}
              </small>
            )}
            {c.message && <small className="field-error">{c.message}</small>}
          </li>
        ))}
      </ul>
      <h3>{S.health.system}</h3>
      <dl className="it-system">
        <dt>{S.health.version}</dt>
        <dd>{system.version}</dd>
        <dt>{S.health.commit}</dt>
        <dd>{system.commit ?? '—'}</dd>
        <dt>{S.health.node}</dt>
        <dd>{system.node}</dd>
        <dt>{S.health.env}</dt>
        <dd>{system.env}</dd>
        <dt>{S.health.uptime}</dt>
        <dd>{formatDuration(system.uptimeSec)}</dd>
        <dt>{S.health.startedAt}</dt>
        <dd>{time(system.startedAt)}</dd>
        <dt>{S.health.memory}</dt>
        <dd>
          {system.memoryMb.rss} MB / {system.memoryMb.heapUsed} MB
        </dd>
      </dl>
    </section>
  )
}

// D-54
function MaintenancePanel({ state, onChanged }) {
  const { authedApi } = useAuth()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)

  async function toggle() {
    const next = !state.enabled
    if (!window.confirm(next ? S.maintenance.confirmOn : S.maintenance.confirmOff)) return
    setPending(true)
    setError(null)
    try {
      onChanged(await authedApi('/it/maintenance', { method: 'PUT', body: { enabled: next } }))
    } catch (err) {
      setError(err)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className={`account-card it-card ${state.enabled ? 'it-maintenance-on' : ''}`}>
      <h2>{S.maintenance.title}</h2>
      <p role="status">
        <strong>{state.enabled ? S.maintenance.on : S.maintenance.off}</strong>
      </p>
      <p className="field-hint">{S.maintenance.hint}</p>
      {state.updatedAt && <p className="field-hint">{fmt(S.maintenance.changedAt, { time: time(state.updatedAt) })}</p>}
      {error && <ErrorNote error={error} />}
      <button className={`btn ${state.enabled ? 'btn-primary' : 'btn-danger'}`} type="button" onClick={toggle} disabled={pending}>
        {state.enabled ? S.maintenance.turnOff : S.maintenance.turnOn}
      </button>
    </section>
  )
}

function MetricsPanel({ range, setRange, tick }) {
  const res = useItData(`/it/metrics?range=${range}`, tick)
  return (
    <section className="account-card it-card it-wide">
      <header className="admin-head">
        <h2>{S.metrics.title}</h2>
        <div className="it-ranges" role="group" aria-label={S.metrics.title}>
          {Object.entries(S.metrics.ranges).map(([k, label]) => (
            <button key={k} type="button" className={`btn btn-small ${k === range ? '' : 'btn-ghost'}`} aria-pressed={k === range} onClick={() => setRange(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>
      {res.status === 'loading' && <p>{S.loading}</p>}
      {res.status === 'error' && <ErrorNote error={res.error} />}
      {res.status === 'ok' && (
        <>
          <div className="it-kpis">
            <div>
              <span>{S.metrics.total}</span>
              <strong>{res.data.totals.count.toLocaleString('vi-VN')}</strong>
            </div>
            <div>
              <span>{S.metrics.errorRate}</span>
              <strong>{pct(res.data.totals.errorRate)}</strong>
            </div>
            <div>
              <span>{S.metrics.p95}</span>
              <strong>{ms(res.data.totals.p95Ms)}</strong>
            </div>
            <div>
              <span>{S.metrics.avg}</span>
              <strong>{ms(res.data.totals.avgMs)}</strong>
            </div>
          </div>
          {res.data.routes.length === 0 ? (
            <p>{S.metrics.empty}</p>
          ) : (
            <div className="it-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{S.metrics.cols.route}</th>
                    <th>{S.metrics.cols.count}</th>
                    <th>{S.metrics.cols.s4xx}</th>
                    <th>{S.metrics.cols.s5xx}</th>
                    <th>{S.metrics.cols.errorRate}</th>
                    <th>{S.metrics.cols.p50}</th>
                    <th>{S.metrics.cols.p95}</th>
                    <th>{S.metrics.cols.max}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.data.routes.map((r) => (
                    <tr key={`${r.method} ${r.route}`} className={r.s5xx ? 'it-row-error' : ''}>
                      <td>
                        <code>
                          {r.method} {r.route}
                        </code>
                      </td>
                      <td>{r.count}</td>
                      <td>{r.s4xx}</td>
                      <td>{r.s5xx}</td>
                      <td>{pct(r.errorRate)}</td>
                      <td>{ms(r.p50Ms)}</td>
                      <td>{ms(r.p95Ms)}</td>
                      <td>{ms(r.maxMs)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="field-hint">{S.metrics.note}</p>
        </>
      )}
    </section>
  )
}

function ErrorsPanel({ range, tick }) {
  const res = useItData(`/it/errors?range=${range}`, tick)
  return (
    <section className="account-card it-card it-wide">
      <h2>{S.errors.title}</h2>
      {res.status === 'loading' && <p>{S.loading}</p>}
      {res.status === 'error' && <ErrorNote error={res.error} />}
      {res.status === 'ok' &&
        (res.data.items.length === 0 ? (
          <p>{S.errors.empty}</p>
        ) : (
          <div className="it-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{S.errors.cols.at}</th>
                  <th>{S.errors.cols.route}</th>
                  <th>{S.errors.cols.path}</th>
                  <th>{S.errors.cols.status}</th>
                  <th>{S.errors.cols.code}</th>
                  <th>{S.errors.cols.message}</th>
                </tr>
              </thead>
              <tbody>
                {res.data.items.map((e, i) => (
                  <tr key={`${e.at}-${i}`}>
                    <td>{time(e.at)}</td>
                    <td>
                      <code>
                        {e.method} {e.route}
                      </code>
                    </td>
                    <td>
                      <code>{e.path}</code>
                    </td>
                    <td>{e.status}</td>
                    <td>{e.code ?? '—'}</td>
                    <td>{e.message ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
    </section>
  )
}

function Dashboard() {
  const [tick, setTick] = useState(0)
  const [range, setRange] = useState('24h')
  const [maintenance, setMaintenance] = useState(null)
  const health = useItData('/it/health', tick)
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  const maint = maintenance ?? (health.status === 'ok' ? health.data.maintenance : null)

  return (
    <main className="admin-main it-main">
      <header className="admin-head">
        <h1>{S.title}</h1>
        <div className="admin-actions">
          <span className="field-hint">{S.autoRefresh}</span>
          <button className="btn btn-small" type="button" onClick={refresh}>
            {S.refresh}
          </button>
        </div>
      </header>
      <div className="it-grid">
        {health.status === 'loading' && <p>{S.loading}</p>}
        {health.status === 'error' && <ErrorNote error={health.error} />}
        {health.status === 'ok' && <HealthPanel health={health.data} />}
        {maint && <MaintenancePanel state={maint} onChanged={setMaintenance} />}
        <MetricsPanel range={range} setRange={setRange} tick={tick} />
        <ErrorsPanel range={range} tick={tick} />
      </div>
    </main>
  )
}

function Gate() {
  const { user, authedApi } = useAuth()
  const location = useLocation()
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    if (!user) return
    let alive = true
    // Chỉ để hiển thị; server kiểm tra quyền ở mọi API /it (D-51)
    authedApi('/me')
      .then((res) => alive && setState({ status: res.profile.role === 'it' ? 'ok' : 'forbidden' }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [user, authedApi])

  const seo = <Seo title={S.title} noindex />
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />
  if (state.status === 'loading') {
    return (
      <p className="admin-main">
        {seo}
        {S.loading}
      </p>
    )
  }
  if (state.status !== 'ok') {
    return (
      <section className="admin-main">
        {seo}
        <h1>{S.forbiddenTitle}</h1>
        <p>{S.forbiddenText}</p>
      </section>
    )
  }
  return (
    <div className="admin">
      {seo}
      <aside className="admin-nav">
        <span className="nav-mark">LAMVI</span>
        <strong>{S.title}</strong>
        <nav>
          <Link to="/admin">{S.nav.admin}</Link>
        </nav>
        <a href="/" className="admin-back">
          {S.nav.site}
        </a>
      </aside>
      <Dashboard />
    </div>
  )
}

// D-51: /it chỉ tiếng Việt, không tiền tố ngôn ngữ
export default function ItDashboard() {
  return (
    <LocaleProvider lang="vi">
      <Gate />
    </LocaleProvider>
  )
}
