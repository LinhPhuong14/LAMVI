import './returns.css'
import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { returnStrings } from './strings.js'
export default function ReturnRequest({ order }) {
  const { authedApi } = useAuth(),
    { lang } = useI18n(),
    s = returnStrings(lang)
  const [result, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [done, setDone] = useState(false)
  const uploadAttempt = useRef(null)
  const data = result?.orderCode === order.code ? result : null
  useEffect(() => {
    if (order.status !== 'delivered') return
    let alive = true
    authedApi(`/orders/${encodeURIComponent(order.code)}/returns`)
      .then((r) => alive && setData({ ...r, orderCode: order.code }))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [authedApi, order.code, order.status])
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget,
      f = new FormData(form),
      video = form.elements.namedItem('video')?.files?.[0]
    setBusy(true)
    setError(false)
    setDone(false)
    try {
      if (!video?.size || video.size > data.maxBytes) throw Error('size')
      const items = order.items
        .filter((i) => f.has(`item:${i.slug}`))
        .map((i) => ({ slug: i.slug, quantity: Number(f.get(`quantity:${i.slug}`)) }))
      if (!items.length) throw Error('items')
      let attempt = uploadAttempt.current
      if (!attempt || attempt.orderCode !== order.code) {
        const upload = await authedApi(`/orders/${encodeURIComponent(order.code)}/returns/upload`, {
          method: 'POST',
          body: { contentType: video.type, size: video.size },
        })
        attempt = { ...upload, orderCode: order.code, uploaded: false }
        uploadAttempt.current = attempt
      }
      if (!attempt.uploaded) {
        // A lost upload response can still mean the object was stored. Finalize verifies the real object.
        try {
          const response = await fetch(attempt.uploadUrl, { method: 'PUT', headers: attempt.headers, body: video })
          attempt.uploaded = response.ok
        } catch {
          attempt.uploaded = false
        }
      }
      const saved = await authedApi(`/returns/${attempt.id}/submit`, {
        method: 'POST',
        body: {
          reason: f.get('reason'),
          description: f.get('description'),
          continuousVideo: f.has('continuous'),
          items,
        },
      })
      setDone(true)
      setData({
        ...data,
        orderCode: order.code,
        items: [saved.item, ...data.items.filter((r) => r.id !== saved.item.id)],
      })
      uploadAttempt.current = null
      form.reset()
      // The accepted request stays visible even if the subsequent list refresh fails.
      try {
        setData({ ...(await authedApi(`/orders/${encodeURIComponent(order.code)}/returns`)), orderCode: order.code })
      } catch {
        /* Accepted response is authoritative. */
      }
    } catch {
      setError(true)
    } finally {
      setBusy(false)
    }
  }
  if (order.status !== 'delivered') return null
  return (
    <section className="account-card returns-panel">
      <h2>{s.title}</h2>
      {!data && !error && <p role="status">{s.loading}</p>}
      {error && (
        <p role="alert">
          {s.error}{' '}
          <button
            type="button"
            onClick={async () => {
              try {
                setData({
                  ...(await authedApi(`/orders/${encodeURIComponent(order.code)}/returns`)),
                  orderCode: order.code,
                })
                setError(false)
              } catch {
                setError(true)
              }
            }}
          >
            {s.retry}
          </button>
        </p>
      )}
      {done && <p role="status">{s.success}</p>}
      {data?.items.map((r) => (
        <div key={r.id}>
          <p>
            {s[r.status]} · {s[r.reason]}
          </p>
          {r.decisionNote && <p>{r.decisionNote}</p>}
          {r.resolutionNote && (
            <p>
              {s[r.resolution]} · {r.resolutionNote}
            </p>
          )}
        </div>
      ))}
      {data && !data.enabled && <p>{s.disabled}</p>}
      {data?.eligible && (
        <form onSubmit={submit}>
          <fieldset disabled={busy}>
            <legend>{s.title}</legend>
            {order.items.map((i) => (
              <div key={i.slug}>
                <label>
                  <input type="checkbox" name={`item:${i.slug}`} />
                  {i.name}
                </label>
                <input
                  aria-label={`${s.quantity}: ${i.name}`}
                  type="number"
                  name={`quantity:${i.slug}`}
                  min="1"
                  max={i.quantity}
                  defaultValue="1"
                />
              </div>
            ))}
            <label>
              {s.reason}
              <select name="reason" required>
                {['manufacturing_defect', 'shipping_damage', 'wrong_item'].map((r) => (
                  <option key={r} value={r}>
                    {s[r]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {s.description}
              <textarea name="description" required minLength={3} maxLength={2000} />
            </label>
            <label>
              {s.video}
              <input
                name="video"
                type="file"
                accept="video/mp4,video/webm,video/quicktime"
                onChange={() => {
                  uploadAttempt.current = null
                }}
                required
              />
            </label>
            <p>
              {s.limit}: {(data.maxBytes / 1024 / 1024).toLocaleString(lang, { maximumFractionDigits: 2 })} MB
            </p>
            <label>
              <input name="continuous" type="checkbox" required />
              {s.confirm}
            </label>
            <button className="btn btn-primary" type="submit">
              {busy ? s.loading : s.submit}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  )
}
