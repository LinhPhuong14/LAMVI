import './returns.css'
import { useEffect, useState } from 'react'
import { useAuth } from '../auth/context.js'
import { useI18n } from '../i18n/index.js'
import { returnStrings } from './strings.js'
export default function ReturnRequest({ order }) {
  const { authedApi } = useAuth(),
    { lang } = useI18n(),
    s = returnStrings(lang)
  const [data, setData] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false),
    [done, setDone] = useState(false)
  useEffect(() => {
    let alive = true
    authedApi(`/orders/${encodeURIComponent(order.code)}/returns`)
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true))
    return () => {
      alive = false
    }
  }, [authedApi, order.code])
  async function submit(e) {
    e.preventDefault()
    const form = e.currentTarget,
      f = new FormData(form),
      video = f.get('video')
    setBusy(true)
    setError(false)
    try {
      if (!video?.size || video.size > data.maxBytes) throw Error('size')
      const upload = await authedApi(`/orders/${encodeURIComponent(order.code)}/returns/upload`, {
        method: 'POST',
        body: { contentType: video.type, size: video.size },
      })
      const response = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: upload.headers,
        body: video,
      })
      if (!response.ok) throw Error('upload')
      const items = order.items
        .filter((i) => f.has(`item:${i.slug}`))
        .map((i) => ({
          slug: i.slug,
          quantity: Number(f.get(`quantity:${i.slug}`)),
        }))
      await authedApi(`/returns/${upload.id}/submit`, {
        method: 'POST',
        body: {
          reason: f.get('reason'),
          description: f.get('description'),
          continuousVideo: f.has('continuous'),
          items,
        },
      })
      setDone(true)
      setData(await authedApi(`/orders/${encodeURIComponent(order.code)}/returns`))
      form.reset()
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
      {error && <p role="alert">{s.error}</p>}
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
                  aria-label={i.name}
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
              <input name="video" type="file" accept="video/mp4,video/webm,video/quicktime" required />
            </label>
            <p>
              {s.limit}: {Math.floor(data.maxBytes / 1024 / 1024)} MB
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
