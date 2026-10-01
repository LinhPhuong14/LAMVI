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

export default function AnalyticsPage() {
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
      <PageHead title={A.title}>
        <div className="admin-actions">
          <span className="field-hint">{A.autoRefresh}</span>
          <button className="btn btn-small btn-ghost" type="button" onClick={refresh}>
            {A.refresh}
          </button>
        </div>
      </PageHead>
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
