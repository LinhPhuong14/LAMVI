import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'
import PageHead from './PageHead.jsx'
import { ANALYTICS as A, S, fmt } from './strings.js'

const REFRESH_MS = 30_000
const num = (n) => n.toLocaleString('vi-VN')

// Biểu đồ cột thuần HTML/CSS: 30 phút, cột phải là phút hiện tại
function Chart({ perMinute }) {
  const cols = [...perMinute].sort((a, b) => b.minutesAgo - a.minutesAgo)
  const max = Math.max(1, ...cols.map((c) => c.users))
  return (
    <div className="ga-chart" role="img" aria-label={`${A.chart}: ${cols.map((c) => c.users).join(', ')}`}>
      {cols.map((c) => (
        <div key={c.minutesAgo} className="ga-col" title={`${c.minutesAgo === 0 ? A.now : fmt(A.minutesAgo, { n: c.minutesAgo })}: ${c.users}`}>
          <span style={{ height: `${(c.users / max) * 100}%` }} />
        </div>
      ))}
    </div>
  )
}

function Ranking({ title, rows }) {
  return (
    <section className="account-card it-card">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p>{A.empty}</p>
      ) : (
        <div className="it-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>{A.colName}</th>
                <th>{A.colUsers}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={`${i}:${r.name}`}>
                  <td>{r.name || '—'}</td>
                  <td>{num(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function RealtimePanel() {
  const { authedApi } = useAuth()
  const [tick, setTick] = useState(0)
  const [state, setState] = useState({ status: 'loading' })
  const refresh = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let alive = true
    authedApi('/admin/analytics/realtime')
      .then((data) => alive && setState({ status: 'ok', data }))
      // Lỗi khi làm mới: giữ số liệu cũ, chỉ hiện cảnh báo
      .catch((error) => alive && setState((s) => ({ status: 'error', error, data: s.data })))
    return () => {
      alive = false
    }
  }, [authedApi, tick])

  useEffect(() => {
    const id = setInterval(refresh, REFRESH_MS)
    return () => clearInterval(id)
  }, [refresh])

  const { data, error } = state
  const configured = data?.configured !== false

  return (
    <>
      <div className="admin-actions">
        <span className="field-hint">{A.autoRefresh}</span>
        <button className="btn btn-small btn-ghost" type="button" onClick={refresh}>
          {A.refresh}
        </button>
      </div>
      {state.status === 'loading' && <p>{S.common.loading}</p>}
      {error && (
        <p className="notice error" role="alert">
          {A.errors[error.code] ?? A.errors.default}
        </p>
      )}
      {data && !configured && (
        <section className="account-card">
          <h2>{A.notConfigured}</h2>
          <p>{A.setup}</p>
        </section>
      )}
      {data && configured && (
        <>
          <section className="account-card it-card">
            <div className="it-kpis">
              <div>
                <span>{A.activeUsers}</span>
                <strong>{num(data.activeUsers)}</strong>
              </div>
              <div>
                <span>{A.pageViews}</span>
                <strong>{num(data.pageViews)}</strong>
              </div>
            </div>
            <h3>{A.chart}</h3>
            <Chart perMinute={data.perMinute} />
            <p className="field-hint">
              {A.chartHint} {fmt(A.updated, { time: new Date(data.fetchedAt).toLocaleTimeString('vi-VN') })}
            </p>
          </section>
          <div className="it-grid">
            <div className="it-wide">
              <Ranking title={A.pages} rows={data.pages} />
            </div>
            <Ranking title={A.countries} rows={data.countries} />
            <Ranking title={A.devices} rows={data.devices} />
          </div>
        </>
      )}
    </>
  )
}

// Báo cáo theo kỳ: phễu mua hàng là biểu đồ chính vì trả lời "mất khách ở bước nào"
function PeriodPanel() {
  const { authedApi } = useAuth()
  const [days, setDays] = useState(7)
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let alive = true
    authedApi(`/admin/analytics/report?days=${days}`)
      .then((data) => alive && setState({ status: 'ok', data }))
      .catch((error) => alive && setState({ status: 'error', error }))
    return () => {
      alive = false
    }
  }, [authedApi, days])

  const { data, error } = state
  const funnel = data?.funnel ?? []
  const top = Math.max(1, ...funnel.map((f) => f.users))
  const dailyMax = Math.max(1, ...(data?.daily ?? []).map((d) => d.users))

  return (
    <>
      <div className="chip-row" role="group" aria-label={A.tabPeriod}>
        {[7, 28, 90].map((d) => (
          <button
            key={d}
            type="button"
            className={`chip${days === d ? ' is-on' : ''}`}
            aria-pressed={days === d}
            onClick={() => {
              setState({ status: 'loading' })
              setDays(d)
            }}
          >
            {A.periods[d]}
          </button>
        ))}
      </div>
      {state.status === 'loading' && <p>{S.common.loading}</p>}
      {error && (
        <p className="notice error" role="alert">
          {A.errors[error.code] ?? A.errors.default}
        </p>
      )}
      {data && data.configured === false && (
        <section className="account-card">
          <h2>{A.notConfigured}</h2>
          <p>{A.setup}</p>
        </section>
      )}
      {data && data.configured !== false && (
        <>
          <section className="account-card it-card">
            <h2>{A.funnelTitle}</h2>
            <p className="field-hint">{A.funnelHint}</p>
            {funnel.every((f) => f.users === 0) ? (
              <p>{A.noEvents}</p>
            ) : (
              <ol className="funnel">
                {funnel.map((f, i) => {
                  const prev = i === 0 ? null : funnel[i - 1].users
                  const rate = prev ? Math.round((f.users / prev) * 100) : null
                  return (
                    <li key={f.name}>
                      <div className="funnel-head">
                        <strong>{A.funnelSteps[f.name]}</strong>
                        <span>
                          {num(f.users)}
                          {rate !== null && <em>{` · ${rate}% ${A.vsPrev}`}</em>}
                        </span>
                      </div>
                      <div className="funnel-bar">
                        <span style={{ width: `${Math.max(2, Math.round((f.users / top) * 100))}%` }} />
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </section>
          <section className="account-card it-card">
            <div className="it-kpis">
              <div>
                <span>{A.users}</span>
                <strong>{num(data.users)}</strong>
              </div>
              <div>
                <span>{A.sessions}</span>
                <strong>{num(data.sessions)}</strong>
              </div>
              <div>
                <span>{A.pageViews}</span>
                <strong>{num(data.pageViews)}</strong>
              </div>
            </div>
            <h3>{A.dailyTitle}</h3>
            <div className="ga-chart" role="img" aria-label={`${A.dailyTitle}: ${data.daily.map((d) => d.users).join(', ')}`}>
              {data.daily.map((d) => (
                <div key={d.date} className="ga-col" title={`${d.date}: ${d.users}`}>
                  <span style={{ height: `${(d.users / dailyMax) * 100}%` }} />
                </div>
              ))}
            </div>
          </section>
          <Ranking title={A.channels} rows={data.channels} />
        </>
      )}
    </>
  )
}

export default function AnalyticsPage() {
  const [tab, setTab] = useState('realtime')
  return (
    <>
      <PageHead title={A.title} />
      <div className="chip-row" role="group" aria-label={A.title}>
        {[['realtime', A.tabRealtime], ['period', A.tabPeriod]].map(([k, l]) => (
          <button key={k} type="button" className={`chip${tab === k ? ' is-on' : ''}`} aria-pressed={tab === k} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'realtime' ? <RealtimePanel /> : <PeriodPanel />}
    </>
  )
}
