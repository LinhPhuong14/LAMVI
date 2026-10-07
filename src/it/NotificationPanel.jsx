import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'

import { notificationStrings as S } from './strings.js'
export default function NotificationPanel({ tick }) {
  const { authedApi } = useAuth()
  const [status, setStatus] = useState('dead')
  const [state, setState] = useState({ loading: true, items: [] })
  const [revision, setRevision] = useState(0)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => {
    let alive = true
    authedApi(`/it/notifications?status=${status}`)
      .then((data) => alive && setState({ items: data.items, loading: false }))
      .catch((failure) => alive && setState({ items: [], loading: false, error: failure }))
    return () => { alive = false }
  }, [authedApi, status, tick, revision])
  async function retry(id) {
    setPending(id); setError(null)
    try {
      await authedApi(`/it/notifications/${id}/retry`, { method: 'POST', body: {} })
      setRevision((value) => value + 1)
    } catch (failure) { setError(failure) }
    finally { setPending(null) }
  }
  return <section className="account-card it-card it-wide">
    <h2>{S.title}</h2>
    <p className="field-hint">{S.hint}</p>
    <label>{S.status} <select value={status} onChange={(event) => setStatus(event.target.value)}>
      {Object.entries(S.statuses).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select></label>
    {state.loading && <p role="status">{S.loading}</p>}
    {state.error?.code === 'NOT_FOUND' ? <p>{S.disabled}</p> : state.error ? <p className="notice error" role="alert">{S.loadError}</p> : null}
    {error && <p className="notice error" role="alert">{S.retryError}</p>}
    {!state.loading && !state.error && !state.items.length && <p>{S.empty}</p>}
    {state.items.length > 0 && <div className="table-scroll"><table><thead><tr><th>{S.event}</th><th>{S.attempts}</th><th>{S.time}</th><th>{S.error}</th><th>{S.action}</th></tr></thead>
      <tbody>{state.items.map((job) => <tr key={job.id}><td>{job.event}<br /><small>{job.order_id}</small></td><td>{job.attempts}</td>
        <td>{new Date(job.created_at).toLocaleString('vi-VN')}</td><td>{job.last_error ?? '—'}</td>
        <td>{status === 'dead' && <button type="button" className="btn btn-small btn-ghost" disabled={pending != null} onClick={() => retry(job.id)}>{pending === job.id ? S.retrying : S.retry}</button>}</td></tr>)}</tbody></table></div>}
  </section>
}
