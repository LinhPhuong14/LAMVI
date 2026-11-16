import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context.js'
import PageHead from './PageHead.jsx'
import QrImage, { CopyLink } from './QrImage.jsx'
import { OCCASION_LABELS } from '../letters/occasions.js'
import { LAMPS } from '../letter-web/themes.js'
import { S } from './strings.js'

const L = S.letters
const date = (iso) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '—')

/** Thư viện QR phong thư: in lại đúng QR cũ khi thiệp bị mất, không sinh token mới. */
export default function LettersGalleryPage() {
  const { authedApi } = useAuth()
  const [state, setState] = useState({ status: 'loading', items: [] })
  const [q, setQ] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await authedApi('/admin/letters')
      setState({ status: 'ok', items: r.items ?? [] })
    } catch {
      setState({ status: 'error', items: [] })
    }
  }, [authedApi])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const items = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return state.items
    return state.items.filter((l) => `${l.orderCode ?? ''} ${l.label ?? ''} ${l.recipientName ?? ''}`.toLowerCase().includes(needle))
  }, [q, state.items])

  return (
    <div className="admin-page">
      <PageHead title={L.galleryTitle}>
        <input type="search" className="admin-search" placeholder={L.search} aria-label={L.search} value={q} onChange={(e) => setQ(e.target.value)} />
      </PageHead>
      <p className="field-hint">{L.galleryHint}</p>
      <p className="letter-actions">
        <Link className="btn btn-primary btn-small" to="/admin/letters/new">
          {L.createStandalone}
        </Link>
        <span className="field-hint">{L.createStandaloneHint}</span>
      </p>
      {state.status === 'loading' && <p role="status">…</p>}
      {state.status === 'error' && <p role="alert">{L.errors.default}</p>}
      {state.status === 'ok' && !items.length && <p>{L.galleryEmpty}</p>}
      <ul className="letter-gallery">
        {items.map((l) => (
          <li key={l.id ?? l.slug} className="account-card letter-card">
            {l.url && <QrImage url={l.url} size={140} fileName={`phong-thu-${l.orderCode ?? l.slug}`} />}
            <div className="letter-card-info">
              <strong>{l.orderCode ?? (l.label || L.standalone)}</strong>
              {!l.orderCode && l.label && <span>{L.standalone}</span>}
              <span>
                {l.recipientName ?? '—'} · {OCCASION_LABELS[l.occasion] ?? ''}
              </span>
              <span>
                {L.experienceShort[Object.hasOwn(L.experienceShort, l.template ?? '') ? l.template : 'web']}
                {l.template !== 'room' && Object.hasOwn(LAMPS, l.lamp ?? "") ? ` · ${L.lampPrefix} ${LAMPS[l.lamp]}` : ''}
                {l.template !== 'room' && Array.isArray(l.lamps) && l.lamps.length >= 2 ? ` +${l.lamps.length - 1}` : ''}
                {l.lang && l.lang !== 'vi' && Object.hasOwn(L.langShort, l.lang) ? ` · ${L.langShort[l.lang]}` : ''}
              </span>
              <span>
                {L.statuses[l.status] ?? l.status} · {l.openedAt ? L.opened : L.notOpened}
              </span>
              <span>
                {L.publishedAt}: {date(l.publishedAt)}
              </span>
              <div className="letter-actions">
                {l.url && <CopyLink url={l.url} />}
                {l.orderCode ? (
                  <Link className="btn btn-small" to={`/admin/orders/${encodeURIComponent(l.orderCode)}/letter`}>
                    {L.edit}
                  </Link>
                ) : (
                  l.id && (
                    <Link className="btn btn-small" to={`/admin/letters/${encodeURIComponent(l.id)}`}>
                      {L.edit}
                    </Link>
                  )
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
