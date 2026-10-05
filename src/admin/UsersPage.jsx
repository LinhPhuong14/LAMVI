import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import PageHead from './PageHead.jsx'
import { S, fmt } from './strings.js'

const ROLES = ['customer', 'admin', 'it']
const date = (iso) => (iso ? new Date(iso).toLocaleString('vi-VN') : '—')

// Vai trò và id của người đang đăng nhập, chỉ để ẩn/hiện nút — quyền thật do server kiểm (D-38, D-51)
function useMe() {
  const { authedApi } = useAuth()
  const [me, setMe] = useState(null)
  useEffect(() => {
    let alive = true
    authedApi('/me')
      .then((r) => alive && setMe(r.profile))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [authedApi])
  return me
}

function StatusPill({ locked }) {
  return <span className={`status ${locked ? 'status-draft' : 'status-published'}`}>{locked ? S.users.status.locked : S.users.status.active}</span>
}

// G-19: chi tiết, khoá/mở khoá, đổi vai trò (chỉ IT)
function UserDetail({ id }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const me = useMe()
  const [state, setState] = useState({ status: 'loading' })
  const [reason, setReason] = useState('')
  const [role, setRole] = useState('customer')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await authedApi(`/admin/users/${encodeURIComponent(id)}`)
      setState({ status: 'ok', ...r })
      setRole(r.item.role)
    } catch (err) {
      setState({ status: 'error', error: err.code })
    }
  }, [authedApi, id])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  async function act(path, options, confirmText) {
    if (confirmText && !window.confirm(confirmText)) return
    setBusy(true)
    setError(null)
    try {
      await authedApi(`/admin/users/${encodeURIComponent(id)}${path}`, options)
      setReason('')
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

  const u = state.item
  const isSelf = me?.id === u.id
  const isIt = me?.role === 'it'
  // Admin chỉ đụng được khách hàng; admin/it khác thuộc quyền IT (server cũng kiểm)
  const canLock = me && !isSelf && (isIt || u.role === 'customer')

  return (
    <section>
      <Link to="/admin/users" className="back-link">
        {S.users.back}
      </Link>
      <PageHead title={u.fullName || u.email || u.id} eyebrow={S.users.title}>
        <StatusPill locked={u.locked} />
      </PageHead>
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}

      <div className="admin-cols">
        <div className="account-card">
          <dl className="it-system">
            <dt>{S.users.colEmail}</dt>
            <dd>{u.email ?? '—'}</dd>
            <dt>{S.users.colPhone}</dt>
            <dd>{u.phone ?? '—'}</dd>
            <dt>{S.users.colRole}</dt>
            <dd>{S.users.roles[u.role]}</dd>
            <dt>{S.users.locale}</dt>
            <dd>{S.common.langs[u.preferredLocale] ?? u.preferredLocale}</dd>
            <dt>{S.users.colCreated}</dt>
            <dd>{date(u.createdAt)}</dd>
            {u.locked && (
              <>
                <dt>{S.users.lockedAt}</dt>
                <dd>{date(u.lockedAt)}</dd>
                <dt>{S.users.lockedReason}</dt>
                <dd>{u.lockedReason ?? '—'}</dd>
              </>
            )}
          </dl>
        </div>

        <div className="account-card">
          {isSelf && <p className="field-hint">{S.users.self}</p>}
          {me && !isSelf && !canLock && <p className="field-hint">{S.users.needIt}</p>}
          {canLock && (
            <>
              {!u.locked && <Field label={S.users.reason} value={reason} maxLength={300} onChange={(e) => setReason(e.target.value)} />}
              <p className="field-hint">{S.users.lockHint}</p>
              {u.locked ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => act('/unlock', { method: 'POST', body: {} }, fmt(S.users.unlockConfirm, { email: u.email ?? u.id }))}
                >
                  {S.users.unlock}
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() => act('/lock', { method: 'POST', body: { reason: reason.trim() || undefined } }, fmt(S.users.lockConfirm, { email: u.email ?? u.id }))}
                >
                  {S.users.lock}
                </button>
              )}
            </>
          )}
          {isIt && !isSelf && (
            <div style={{ marginTop: 24 }}>
              <Field as="select" label={S.users.role} value={role} onChange={(e) => setRole(e.target.value)} hint={S.users.roleHint}>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {S.users.roles[r]}
                  </option>
                ))}
              </Field>
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy || role === u.role}
                onClick={() =>
                  act('', { method: 'PATCH', body: { role } }, fmt(S.users.roleConfirm, { email: u.email ?? u.id, role: S.users.roles[role] }))
                }
              >
                {S.users.apply}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="account-card">
        <h2>{S.users.orders}</h2>
        {state.orders.length === 0 ? (
          <p className="field-hint">{S.users.ordersEmpty}</p>
        ) : (
          <table className="admin-table">
            <tbody>
              {state.orders.map((o) => (
                <tr key={o.code}>
                  <td>
                    <Link to={`/admin/orders/${o.code}`}>
                      <code>{o.code}</code>
                    </Link>
                  </td>
                  <td>{date(o.createdAt)}</td>
                  <td>{formatVnd(o.total)}</td>
                  <td>{t(`orders.statuses.${o.status}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* NFR-AUD-001 */}
      <div className="account-card">
        <h2>{S.users.audit}</h2>
        {state.audit.length === 0 ? (
          <p className="field-hint">{S.users.auditEmpty}</p>
        ) : (
          <table className="admin-table">
            <tbody>
              {state.audit.map((e) => (
                <tr key={e.id}>
                  <td>{date(e.at)}</td>
                  <td>{e.actorRole}</td>
                  <td>{S.users.auditActions[e.action] ?? e.action}</td>
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

// Danh sách người dùng: tìm, lọc vai trò/trạng thái, phân trang
export default function UsersPage() {
  const { id } = useParams()
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [applied, setApplied] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading' })

  const query = new URLSearchParams()
  if (applied) query.set('q', applied)
  if (role) query.set('role', role)
  if (status) query.set('status', status)
  if (page > 1) query.set('page', String(page))
  const qs = query.toString()

  useEffect(() => {
    if (id) return
    let alive = true
    authedApi(`/admin/users${qs ? `?${qs}` : ''}`)
      .then((r) => alive && setState({ status: 'ok', ...r }))
      .catch((err) => alive && setState({ status: 'error', error: err.code }))
    return () => {
      alive = false
    }
  }, [authedApi, qs, id])

  if (id) return <UserDetail id={id} />

  const pages = state.status === 'ok' ? Math.max(1, Math.ceil(state.total / state.pageSize)) : 1
  const submit = (e) => {
    e.preventDefault()
    setPage(1)
    setApplied(q.trim())
  }

  return (
    <section>
      <PageHead title={S.users.title} />
      <form className="admin-grid" onSubmit={submit} role="search">
        <Field label={S.users.search} value={q} onChange={(e) => setQ(e.target.value)} maxLength={100} />
        <Field
          as="select"
          label={S.users.colRole}
          value={role}
          onChange={(e) => {
            setPage(1)
            setRole(e.target.value)
          }}
        >
          <option value="">{S.users.allRoles}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {S.users.roles[r]}
            </option>
          ))}
        </Field>
        <Field
          as="select"
          label={S.users.colStatus}
          value={status}
          onChange={(e) => {
            setPage(1)
            setStatus(e.target.value)
          }}
        >
          <option value="">{S.users.allStatus}</option>
          <option value="active">{S.users.status.active}</option>
          <option value="locked">{S.users.status.locked}</option>
        </Field>
        <button type="submit" className="btn btn-small">
          {S.users.searchBtn}
        </button>
      </form>

      {state.status === 'loading' && <p>{S.common.loading}</p>}
      {state.status === 'error' && (
        <p className="notice error" role="alert">
          {t(`errors.${state.error}`)}
        </p>
      )}
      {state.status === 'ok' &&
        (state.items.length === 0 ? (
          <p>{S.users.empty}</p>
        ) : (
          <>
            <p className="field-hint">{fmt(S.users.total, { n: state.total })}</p>
            <div className="admin-panel">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>{S.users.colName}</th>
                    <th>{S.users.colEmail}</th>
                    <th>{S.users.colPhone}</th>
                    <th>{S.users.colRole}</th>
                    <th>{S.users.colOrders}</th>
                    <th>{S.users.colStatus}</th>
                    <th>{S.users.colCreated}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {state.items.map((u) => (
                    <tr key={u.id}>
                      <td>{u.fullName ?? '—'}</td>
                      <td>{u.email ?? '—'}</td>
                      <td>{u.phone ?? '—'}</td>
                      <td>{S.users.roles[u.role]}</td>
                      <td>{u.orderCount}</td>
                      <td>
                        <StatusPill locked={u.locked} />
                      </td>
                      <td>{date(u.createdAt)}</td>
                      <td className="admin-row-actions">
                        <Link to={`/admin/users/${u.id}`} className="btn btn-small">
                          {S.users.detail}
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {pages > 1 && (
              <nav className="admin-pager" aria-label={fmt(S.users.page, { page, pages })}>
                <button type="button" className="btn btn-small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  {S.users.prev}
                </button>
                <span>{fmt(S.users.page, { page, pages })}</span>
                <button type="button" className="btn btn-small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                  {S.users.next}
                </button>
              </nav>
            )}
          </>
        ))}
    </section>
  )
}
