import '../returns/returns.css'
import { S, fmt } from './strings.js'
import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import { returnStrings } from '../returns/strings.js'
import PageHead from './PageHead.jsx'

const STATUSES = ['requested', 'approved', 'resolved', 'rejected']
const DAY = 86400000
const when = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '')

// Số ngày còn lại trước khi video bị xoá (D-109: 90 ngày sau khi xử lý xong). Yêu cầu chưa xử lý xong thì chưa tính.
function daysLeft(r, now) {
  const end = r.status === 'resolved' ? r.resolvedAt : r.status === 'rejected' ? r.decidedAt : null
  if (!end) return null
  return Math.max(0, 90 - Math.floor((now - new Date(end).getTime()) / DAY))
}

// Chi tiết một yêu cầu: video khui hàng phát ngay, quyết định bằng hai nút rõ ràng (docs/knowledge/dashboard-ux.md, B3)
function Detail({ r, labels, busy, onSave, now }) {
  const { authedApi } = useAuth()
  const [video, setVideo] = useState({ status: r.videoPurged ? 'purged' : 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (r.videoPurged) return undefined
    let alive = true
    authedApi(`/admin/returns/${r.id}/video`)
      .then((v) => alive && setVideo({ status: 'ok', url: v.url }))
      .catch(() => alive && setVideo({ status: 'error' }))
    return () => {
      alive = false
    }
  }, [authedApi, r.id, r.videoPurged, attempt])

  const approved = r.status === 'approved'
  const left = daysLeft(r, now)

  return (
    <article className="returns-detail" aria-label={labels[r.reason]}>
      <header>
        <h2>{labels[r.reason]}</h2>
        <span className={`order-status returns-status-${r.status}`}>{labels[r.status]}</span>
      </header>
      <p className="returns-meta">
        {r.orderCode && <Link to={`/admin/orders/${encodeURIComponent(r.orderCode)}`}>{r.orderCode}</Link>} · {when(r.submittedAt)}
      </p>

      <div className="returns-video">
        {video.status === 'purged' && <p className="field-hint">{S.returns.videoPurged}</p>}
        {video.status === 'loading' && <p role="status">{S.common.loading}</p>}
        {video.status === 'error' && (
          <div role="alert">
            <p>{S.returns.videoError}</p>
            <button type="button" className="btn btn-small" onClick={() => {
                setVideo({ status: 'loading' })
                setAttempt((n) => n + 1)
              }}>
              {S.returns.retry}
            </button>
          </div>
        )}
        {video.status === 'ok' && <video aria-label={S.returns.video} controls preload="metadata" src={video.url} />}
        {left !== null && video.status !== 'purged' && <p className="field-hint">{fmt(S.returns.purgeIn, { n: left })}</p>}
      </div>

      {r.description && <p className="returns-desc">{r.description}</p>}
      <ul className="returns-items">
        {r.items.map((i) => (
          <li key={i.slug}>
            {i.slug} × {i.quantity}
          </li>
        ))}
      </ul>

      {r.decisionNote && (
        <p className="returns-note">
          <strong>{S.returns.decision}:</strong> {r.decisionNote} · {when(r.decidedAt)}
        </p>
      )}
      {r.resolutionNote && (
        <p className="returns-note">
          <strong>{S.returns.outcomes[r.resolution]}:</strong> {r.resolutionNote} · {when(r.resolvedAt)}
        </p>
      )}

      {['requested', 'approved'].includes(r.status) && (
        <form onSubmit={(e) => onSave(e, r)} className="returns-form">
          <fieldset disabled={busy}>
            <label>
              {S.returns.reason}
              <textarea name="note" required minLength={3} maxLength={2000} />
            </label>
            <div className="returns-actions">
              {(approved ? ['replacement', 'refund'] : ['approved', 'rejected']).map((x, i) => (
                <button
                  key={x}
                  type="submit"
                  name={approved ? 'resolution' : 'status'}
                  value={x}
                  className={`btn ${i === 0 ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {busy ? S.common.saving : approved ? S.returns.outcomes[x] : x === 'approved' ? S.returns.approve : S.returns.reject}
                </button>
              ))}
            </div>
          </fieldset>
        </form>
      )}
    </article>
  )
}

export default function ReturnsPage() {
  const { authedApi } = useAuth()
  const labels = returnStrings('vi')
  const [status, setStatus] = useState('requested')
  const [items, setItems] = useState([])
  const [next, setNext] = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())

  const fetchPage = useCallback((cursor) => authedApi(`/admin/returns?${new URLSearchParams({ status, ...(cursor ? { cursor } : {}) })}`), [authedApi, status])

  const reload = useCallback(async () => {
    const r = await fetchPage(null)
    setItems(r.items)
    setNext(r.nextCursor ?? null)
    setSelected((cur) => (r.items.some((x) => x.id === cur) ? cur : (r.items[0]?.id ?? null)))
  }, [fetchPage])

  useEffect(() => {
    let alive = true
    fetchPage(null)
      .then((r) => {
        if (!alive) return
        setItems(r.items)
        setNext(r.nextCursor ?? null)
        setSelected(r.items[0]?.id ?? null)
      })
      .catch(() => alive && setError(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [fetchPage])

  async function more() {
    setLoading(true)
    try {
      const r = await fetchPage(next)
      setItems((cur) => [...cur, ...r.items])
      setNext(r.nextCursor ?? null)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function retry() {
    setLoading(true)
    setError(false)
    try {
      await reload()
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  async function save(e, r) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const choice = e.nativeEvent.submitter?.value
    const resolution = r.status === 'approved'
    setBusy(true)
    setError(false)
    try {
      await authedApi(`/admin/returns/${r.id}${resolution ? '/resolve' : ''}`, {
        method: resolution ? 'POST' : 'PATCH',
        body: resolution ? { resolution: choice, note: f.get('note') } : { status: choice, note: f.get('note') },
      })
      await reload()
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }

  const current = items.find((x) => x.id === selected)

  return (
    <section className={`returns-panel returns-split${current ? ' has-detail' : ''}`}>
      <div className="returns-list">
        <PageHead title={S.returns.title} />
        <p className="field-hint">{S.returns.note}</p>
        <div className="chip-row" role="group" aria-label={S.returns.filter}>
          {STATUSES.map((x) => (
            <button
              key={x}
              type="button"
              className={`chip${status === x ? ' is-on' : ''}`}
              aria-pressed={status === x}
              onClick={() => {
                if (x === status) return
                setLoading(true)
                setError(false)
                setItems([])
                setSelected(null)
                setStatus(x)
              }}
            >
              {labels[x]}
            </button>
          ))}
        </div>
        {error && (
          <div role="alert">
            <p>{S.returns.error}</p>
            <button type="button" className="btn btn-small" onClick={retry}>
              {S.returns.retry}
            </button>
          </div>
        )}
        {loading && <p role="status">{S.common.loading}</p>}
        {!loading && !error && !items.length && <p>{S.returns.empty}</p>}
        <ul className="returns-cards">
          {items.map((r) => (
            <li key={r.id}>
              <button type="button" className={`returns-card${r.id === selected ? ' is-open' : ''}`} aria-pressed={r.id === selected} onClick={() => setSelected(r.id)}>
                <strong>{labels[r.reason]}</strong>
                <span>{r.orderCode}</span>
                <small>{when(r.submittedAt)}</small>
                {r.videoPurged ? <em>{S.returns.videoGone}</em> : <em>{S.returns.hasVideo}</em>}
              </button>
            </li>
          ))}
        </ul>
        {next && (
          <button type="button" className="btn btn-ghost" disabled={loading} onClick={more}>
            {S.returns.more}
          </button>
        )}
      </div>
      {current && (
        <aside className="returns-aside">
          <Detail key={current.id + current.status} r={current} labels={labels} busy={busy} onSave={save} now={now} />
        </aside>
      )}
    </section>
  )
}
