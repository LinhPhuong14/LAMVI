import '../returns/returns.css'
import { S } from './strings.js'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import { returnStrings } from '../returns/strings.js'
export default function ReturnsPage() {
  const { authedApi } = useAuth(),
    labels = returnStrings('vi')
  const [data, setData] = useState({ items: [], nextCursor: null }),
    [error, setError] = useState(false)
  const [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('requested'),
    [cursors, setCursors] = useState([null]),
    [page, setPage] = useState(0)
  const cursor = cursors[page]
  const load = useCallback(async () => {
    const params = new URLSearchParams({ status })
    if (cursor) params.set('cursor', cursor)
    return authedApi(`/admin/returns?${params}`)
  }, [authedApi, status, cursor])
  useEffect(() => {
    let alive = true
    load()
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [load])
  async function retry() {
    setLoading(true)
    setError(false)
    try {
      setData(await load())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }
  async function video(id) {
    try {
      const r = await authedApi(`/admin/returns/${id}/video`)
      window.open(r.url, '_blank', 'noopener,noreferrer')
    } catch {
      setError(true)
    }
  }
  async function save(e, r) {
    e.preventDefault()
    setBusy(true)
    setError(false)
    const f = new FormData(e.currentTarget)
    try {
      const resolution = r.status === 'approved'
      await authedApi(`/admin/returns/${r.id}${resolution ? '/resolve' : ''}`, {
        method: resolution ? 'POST' : 'PATCH',
        body: resolution
          ? { resolution: f.get('resolution'), note: f.get('note') }
          : { status: f.get('status'), note: f.get('note') },
      })
      setData(await load())
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="returns-panel">
      <h1>{S.returns.title}</h1>
      <p>{S.returns.note}</p>
      <label>
        {S.returns.filter}
        <select
          value={status}
          onChange={(e) => {
            setLoading(true)
            setError(false)
            setStatus(e.target.value)
            setPage(0)
            setCursors([null])
          }}
        >
          {['requested', 'approved', 'resolved', 'rejected'].map((x) => (
            <option key={x} value={x}>
              {labels[x]}
            </option>
          ))}
        </select>
      </label>
      {loading && <p role="status">{S.common.loading}</p>}
      {error && (
        <div role="alert">
          <p>{S.returns.error}</p>
          <button type="button" onClick={retry}>
            {S.returns.retry}
          </button>
        </div>
      )}
      {!loading && !error && !data.items.length && <p>{S.returns.empty}</p>}
      {!loading &&
        data.items.map((r) => (
          <article className="account-card" key={r.id}>
            <h2>{labels[r.reason]}</h2>
            {r.orderCode && <Link to={`/admin/orders/${encodeURIComponent(r.orderCode)}`}>{r.orderCode}</Link>}
            <p>{r.description}</p>
            <p>
              {labels[r.status]} · {r.submittedAt && new Date(r.submittedAt).toLocaleString('vi-VN')}
            </p>
            <ul>
              {r.items.map((i) => (
                <li key={i.slug}>
                  {i.slug} × {i.quantity}
                </li>
              ))}
            </ul>
            <button type="button" className="btn btn-secondary" onClick={() => video(r.id)}>
              {S.returns.video}
            </button>
            {r.decisionNote && (
              <p>
                {r.decisionNote} · {r.decidedAt && new Date(r.decidedAt).toLocaleString('vi-VN')}
              </p>
            )}
            {r.resolutionNote && (
              <p>
                {S.returns.outcomes[r.resolution]} · {r.resolutionNote} ·{' '}
                {r.resolvedAt && new Date(r.resolvedAt).toLocaleString('vi-VN')}
              </p>
            )}
            {['requested', 'approved'].includes(r.status) && (
              <form onSubmit={(e) => save(e, r)}>
                <fieldset disabled={busy}>
                  <label>
                    {r.status === 'approved' ? S.returns.outcome : S.returns.decision}
                    <select name={r.status === 'approved' ? 'resolution' : 'status'}>
                      {(r.status === 'approved' ? ['replacement', 'refund'] : ['approved', 'rejected']).map((x) => (
                        <option key={x} value={x}>
                          {r.status === 'approved' ? S.returns.outcomes[x] : labels[x]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {S.returns.reason}
                    <textarea name="note" required minLength={3} maxLength={2000} />
                  </label>
                  <button className="btn btn-primary" type="submit">
                    {busy ? S.common.saving : S.returns.save}
                  </button>
                </fieldset>
              </form>
            )}
          </article>
        ))}
      <nav aria-label={S.returns.pages}>
        <button
          type="button"
          disabled={loading || page === 0}
          onClick={() => {
            setLoading(true)
            setError(false)
            setPage((p) => p - 1)
          }}
        >
          {S.returns.previous}
        </button>
        <button
          type="button"
          disabled={loading || !data.nextCursor}
          onClick={() => {
            setLoading(true)
            setError(false)
            setCursors((c) => [...c.slice(0, page + 1), data.nextCursor])
            setPage((p) => p + 1)
          }}
        >
          {S.returns.next}
        </button>
      </nav>
    </section>
  )
}
