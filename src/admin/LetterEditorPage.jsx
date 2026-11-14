import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import PageHead from './PageHead.jsx'
import QrImage, { CopyLink } from './QrImage.jsx'
import LetterRoomPreview from './LetterRoomPreview.jsx'
import { demos, validateLetter } from '../letter-room/data.js'
import { LAMPS } from '../letter-web/themes.js'
import { OCCASIONS, OCCASION_LABELS, paragraphsOf } from '../letters/occasions.js'
import { S } from './strings.js'

const L = S.letters
const EMPTY = {
  recipientName: '',
  senderName: '',
  occasion: 'justBecause',
  template: 'room',
  lamp: '',
  kind: 'text',
  message: '',
  videoUrl: '',
  posterUrl: '',
  captionsUrl: '',
  postscript: '',
  od: { message: '', date: '', photos: '', label: '', places: '', icon: '' },
}

const lines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)

// Form (chuỗi phẳng) ↔ nội dung thư gửi server
function toForm(c) {
  if (!c) return EMPTY
  const od = c.occasionData ?? {}
  return {
    recipientName: c.recipientName ?? '',
    senderName: c.senderName ?? '',
    occasion: c.occasion ?? 'justBecause',
    template: c.template === 'web' ? 'web' : 'room',
    lamp: c.lamp ?? '',
    kind: c.kind ?? 'text',
    message: paragraphsOf(c.message).join('\n\n'),
    videoUrl: c.videoUrl ?? '',
    posterUrl: c.posterUrl ?? '',
    captionsUrl: c.captionsUrl ?? '',
    postscript: c.postscript ?? '',
    od: {
      message: od.message ?? '',
      date: od.date ?? '',
      photos: (od.photos ?? []).join('\n'),
      label: od.label ?? '',
      places: (od.places ?? []).join('\n'),
      icon: od.icon ?? '',
    },
  }
}

function toContent(f) {
  const od = { message: f.od.message }
  if (f.occasion === 'anniversary') Object.assign(od, { date: f.od.date, photos: lines(f.od.photos) })
  if (f.occasion === 'milestone') od.label = f.od.label
  if (f.occasion === 'longDistance') od.places = lines(f.od.places)
  if (f.occasion === 'justBecause') od.icon = f.od.icon
  const c = {
    recipientName: f.recipientName,
    senderName: f.senderName,
    occasion: f.occasion,
    template: f.template,
    lamp: f.template === 'web' && f.lamp ? f.lamp : null,
    kind: f.kind,
    message: f.message,
    postscript: f.postscript,
    occasionData: od,
  }
  if (f.kind === 'video') Object.assign(c, { videoUrl: f.videoUrl, posterUrl: f.posterUrl || null, captionsUrl: f.captionsUrl || null })
  return c
}

// Xem trước: cùng hình dạng dữ liệu mà người nhận sẽ nhận
function previewOf(f) {
  const c = toContent(f)
  const od = Object.fromEntries(Object.entries(c.occasionData).filter(([, v]) => (Array.isArray(v) ? v.length : v)))
  return { ...c, message: paragraphsOf(c.message), occasionData: Object.keys(od).length ? od : null, postscript: c.postscript || null }
}

/** D-134: admin soạn toàn bộ phong thư của một đơn, xem trước, xuất bản ra QR (D-138). */
export default function LetterEditorPage() {
  const { code } = useParams()
  const { authedApi } = useAuth()
  const [letter, setLetter] = useState(null)
  const [loaded, setLoaded] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [dirty, setDirty] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState(null)
  const [busy, setBusy] = useState(false)
  const path = `/admin/orders/${encodeURIComponent(code)}/letter`

  const load = useCallback(async () => {
    try {
      const r = await authedApi(path)
      setLetter(r.item)
      setForm(toForm(r.item?.content))
      setLoaded(true)
    } catch (err) {
      setMessage(err.status === 404 ? L.orderNotFound : L.errors.default)
      setLoaded(true)
    }
  }, [authedApi, path])

  useEffect(() => {
    // Đồng bộ với hệ thống ngoài (API); mọi setState trong load đều nằm sau `await`.
    // oxlint-disable-next-line react/set-state-in-effect
    load()
  }, [load])

  const preview = useMemo(() => previewOf(form), [form])
  // Thư chưa đủ để dựng Phòng thư (thiếu tên, nội dung…) → lý do hiện cạnh nút xem thử
  const previewError = useMemo(() => {
    try {
      validateLetter(preview)
      return preview.recipientName.trim() && preview.senderName.trim() ? null : L.previewNeedsNames
    } catch (e) {
      return e.message
    }
  }, [preview])
  const [roomOpen, setRoomOpen] = useState(false)
  const previewBtn = useRef(null)
  // Đóng xem thử → trả focus về nút đã mở
  const closeRoom = useCallback(() => {
    setRoomOpen(false)
    requestAnimationFrame(() => previewBtn.current?.focus())
  }, [])

  // Mẫu lời chúc của Phòng thư (letter-room): điền dịp, nội dung, điều bất ngờ; giữ tên đã gõ
  function applyTemplate(e) {
    const occasion = e.target.value
    const demo = demos[occasion]
    if (!demo) return
    const hasContent = form.message.trim() || Object.values(form.od).some((v) => v.trim())
    if (hasContent && !window.confirm(L.templateConfirm)) return
    setForm((f) => ({
      ...toForm({ ...demo, kind: 'text', recipientName: f.recipientName, senderName: f.senderName, template: f.template, lamp: f.lamp }),
      videoUrl: f.videoUrl,
      posterUrl: f.posterUrl,
      captionsUrl: f.captionsUrl,
      postscript: f.postscript,
    }))
    setDirty(true)
  }
  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }))
    setDirty(true)
  }
  const setOd = (k) => (e) => {
    setForm((f) => ({ ...f, od: { ...f.od, [k]: e.target.value } }))
    setDirty(true)
  }

  async function run(fn) {
    setBusy(true)
    setMessage(null)
    try {
      await fn()
    } catch (err) {
      if (err.fields) setErrors(err.fields)
      setMessage(L.errors[err.code] ?? L.errors.default)
    } finally {
      setBusy(false)
    }
  }

  const save = () =>
    run(async () => {
      const r = await authedApi(path, { method: 'PUT', body: { content: toContent(form) } })
      setLetter(r.item)
      setErrors({})
      setDirty(false)
      setMessage(L.saved)
    })

  const publish = () =>
    run(async () => {
      if (dirty) {
        const s = await authedApi(path, { method: 'PUT', body: { content: toContent(form) } })
        setLetter(s.item)
        setDirty(false)
      }
      const r = await authedApi(`${path}/publish`, { method: 'POST' })
      setLetter(r.item)
      setErrors({})
    })

  const unpublish = () => {
    if (!window.confirm(L.unpublishConfirm)) return
    run(async () => setLetter((await authedApi(`${path}/unpublish`, { method: 'POST' })).item))
  }
  const rotate = () => {
    if (!window.confirm(L.rotateConfirm)) return
    run(async () => setLetter((await authedApi(`${path}/rotate`, { method: 'POST' })).item))
  }

  const err = (k) => (errors[k] ? L.errors[errors[k]] ?? errors[k] : null)
  const published = letter?.status === 'published'

  return (
    <div className="admin-page letter-editor">
      <PageHead eyebrow={L.editorEyebrow} title={code}>
        <Link className="btn btn-small" to={`/admin/orders/${encodeURIComponent(code)}`}>
          {L.toOrder}
        </Link>
      </PageHead>
      {!loaded ? (
        <p role="status">…</p>
      ) : (
        <div className="letter-editor-grid">
          <form
            className="account-card letter-form"
            onSubmit={(e) => {
              e.preventDefault()
              save()
            }}
          >
            <p className="field-hint">
              {L.status}: <strong>{L.statuses[letter?.status ?? 'none']}</strong>
              {published && ` · ${letter.openedAt ? L.opened : L.notOpened}`}
            </p>
            <Field label={L.experience} as="select" value={form.template} onChange={set('template')} hint={L.experienceHint}>
              <option value="room">{L.experiences.room}</option>
              <option value="web">{L.experiences.web}</option>
            </Field>
            {form.template === 'web' && (
              <Field label={L.lamp} as="select" value={form.lamp} onChange={set('lamp')}>
                <option value="">{L.lampDefault}</option>
                {Object.entries(LAMPS).map(([slug, name]) => (
                  <option key={slug} value={slug}>
                    {name}
                  </option>
                ))}
              </Field>
            )}
            <Field label={L.template} as="select" value="" onChange={applyTemplate} hint={L.templateHint}>
              <option value="">{L.templatePick}</option>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </Field>
            <Field label={L.recipientName} value={form.recipientName} onChange={set('recipientName')} maxLength={60} required />
            {err('recipientName') && <span className="field-error">{err('recipientName')}</span>}
            <Field label={L.senderName} value={form.senderName} onChange={set('senderName')} maxLength={60} required />
            {err('senderName') && <span className="field-error">{err('senderName')}</span>}
            <Field label={L.occasion} as="select" value={form.occasion} onChange={set('occasion')}>
              {OCCASIONS.map((o) => (
                <option key={o} value={o}>
                  {OCCASION_LABELS[o]}
                </option>
              ))}
            </Field>
            <Field label={L.kind} as="select" value={form.kind} onChange={set('kind')}>
              <option value="text">{L.kinds.text}</option>
              <option value="video">{L.kinds.video}</option>
            </Field>
            {form.kind === 'video' && (
              <>
                <Field label={L.videoUrl} value={form.videoUrl} onChange={set('videoUrl')} hint={L.videoHint} maxLength={500} />
                {err('videoUrl') && <span className="field-error">{err('videoUrl')}</span>}
                <Field label={L.posterUrl} value={form.posterUrl} onChange={set('posterUrl')} maxLength={500} />
                <Field label={L.captionsUrl} value={form.captionsUrl} onChange={set('captionsUrl')} maxLength={500} />
              </>
            )}
            <Field label={L.message} as="textarea" rows={9} value={form.message} onChange={set('message')} hint={L.messageHint} />
            {err('message') && <span className="field-error">{err('message')}</span>}
            <Field label={L.postscript} value={form.postscript} onChange={set('postscript')} maxLength={400} />
            <fieldset className="letter-surprise">
              <legend>{L.surprise}</legend>
              <Field label={L.surpriseMessage} value={form.od.message} onChange={setOd('message')} maxLength={300} />
              {form.occasion === 'anniversary' && (
                <>
                  <Field label={L.surpriseDate} value={form.od.date} onChange={setOd('date')} maxLength={60} />
                  <Field label={L.surprisePhotos} as="textarea" rows={2} value={form.od.photos} onChange={setOd('photos')} />
                </>
              )}
              {form.occasion === 'milestone' && <Field label={L.surpriseLabel} value={form.od.label} onChange={setOd('label')} maxLength={60} />}
              {form.occasion === 'longDistance' && <Field label={L.surprisePlaces} as="textarea" rows={2} value={form.od.places} onChange={setOd('places')} />}
              {form.occasion === 'justBecause' && <Field label={L.surpriseIcon} value={form.od.icon} onChange={setOd('icon')} />}
            </fieldset>
            {message && (
              <p className="field-hint" role="status">
                {message}
              </p>
            )}
            {dirty && <p className="field-hint">{L.unsaved}</p>}
            <div className="letter-actions">
              <button type="submit" className="btn btn-small" disabled={busy}>
                {published ? L.saveLive : L.save}
              </button>
              {!published && (
                <button type="button" className="btn btn-primary btn-small" disabled={busy} onClick={publish}>
                  {L.publish}
                </button>
              )}
              {published && (
                <button type="button" className="btn btn-small" disabled={busy} onClick={unpublish}>
                  {L.unpublish}
                </button>
              )}
            </div>
          </form>

          <div className="letter-side">
            {letter?.url && (
              <section className="account-card" aria-label={L.qr}>
                <h2>{L.qr}</h2>
                <p className="field-hint">{L.qrHint}</p>
                <QrImage url={letter.url} fileName={`phong-thu-${code}`} />
                <Field label="Link" value={letter.url} readOnly onFocus={(e) => e.target.select()} />
                <div className="letter-actions">
                  <CopyLink url={letter.url} />
                  <button type="button" className="btn btn-small" disabled={busy} onClick={rotate}>
                    {L.rotate}
                  </button>
                </div>
              </section>
            )}
            <section aria-label={L.preview}>
              <h2 className="letter-preview-title">{L.preview}</h2>
              <p className="field-hint">{L.roomPreviewHint}</p>
              <button ref={previewBtn} type="button" className="btn btn-primary btn-small" disabled={Boolean(previewError)} onClick={() => setRoomOpen(true)}>
                {L.roomPreview}
              </button>
              {previewError && <p className="field-hint">{previewError}</p>}
            </section>
            {roomOpen && !previewError && <LetterRoomPreview letter={preview} onClose={closeRoom} />}
          </div>
        </div>
      )}
    </div>
  )
}
