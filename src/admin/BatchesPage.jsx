import { useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import { uploadFile } from './uploadFile.js'
import PageHead from './PageHead.jsx'
import { S, fmt } from './strings.js'

const isPublished = (b) => b.status === 'video_published'

function BatchForm({ initial, onSaved, onCancel }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({
    code: initial?.code ?? '',
    producedOn: initial?.producedOn ?? '',
    title: initial?.title ?? {},
    story: initial?.story ?? {},
  }))
  const { pending, error, fields, run } = useSubmit()
  const locked = initial?.id && isPublished(initial)

  async function onSubmit(e) {
    e.preventDefault()
    const body = { ...form }
    if (locked) delete body.code // D-47: mã lô đã khắc không đổi
    const res = await run(() =>
      initial?.id
        ? authedApi(`/admin/batches/${initial.id}`, { method: 'PATCH', body })
        : authedApi('/admin/batches', { method: 'POST', body }),
    )
    if (res) onSaved(res.item)
  }

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate>
      <div className="admin-grid">
        <Field
          label={S.batches.code}
          value={form.code}
          onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
          error={fields.code}
          hint={S.batches.codeHint}
          disabled={locked}
        />
        <Field label={S.batches.producedOn} type="date" value={form.producedOn ?? ''} onChange={(e) => setForm({ ...form, producedOn: e.target.value })} error={fields.producedOn} />
      </div>
      <I18nInput label={S.batches.batchTitle} value={form.title} onChange={(v) => setForm({ ...form, title: v })} error={fields.title} />
      <I18nInput label={S.batches.story} multiline value={form.story} onChange={(v) => setForm({ ...form, story: v })} error={fields.story} />
      {error && !Object.keys(fields).length && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      <div className="admin-actions">
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? S.common.saving : S.common.save}
        </button>
        <button className="btn btn-ghost" type="button" onClick={onCancel}>
          {S.common.cancel}
        </button>
      </div>
    </form>
  )
}

// D-46: tải video lên Storage; D-47: thay được, không gỡ
function VideoPanel({ batch, onChange }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [progress, setProgress] = useState(null)
  const [error, setError] = useState(null)
  const [done, setDone] = useState(false)

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    setDone(false)
    setProgress(0)
    try {
      const up = await authedApi(`/admin/batches/${batch.id}/video-upload`, {
        method: 'POST',
        body: { contentType: file.type, size: file.size },
      })
      await uploadFile(up.uploadUrl, file, up.headers, setProgress)
      const res = await authedApi(`/admin/batches/${batch.id}/video`, { method: 'POST', body: { path: up.path } })
      setDone(true)
      onChange(res.item)
    } catch (err) {
      setError(err.fields ? Object.values(err.fields)[0] : err.code)
    } finally {
      setProgress(null)
    }
  }

  async function publish() {
    if (!window.confirm(S.batches.publishConfirm)) return
    setError(null)
    try {
      const res = await authedApi(`/admin/batches/${batch.id}/publish`, { method: 'POST' })
      onChange(res.item)
    } catch (err) {
      setError(err.code)
    }
  }

  const qrUrl = `${window.location.origin}/lo/${encodeURIComponent(batch.code)}`
  return (
    <div className="account-card admin-video">
      <h2>{S.batches.video}</h2>
      {batch.videoUrl ? (
        <video className="batch-video" src={batch.videoUrl} controls preload="metadata" />
      ) : (
        <p>{S.batches.noVideo}</p>
      )}
      <label className="btn btn-ghost file-btn">
        {batch.videoUrl ? S.batches.replaceVideo : S.batches.chooseVideo}
        <input type="file" accept="video/mp4,video/webm,video/quicktime" onChange={onFile} disabled={progress !== null} hidden />
      </label>
      {progress !== null && <p role="status">{fmt(S.batches.uploading, { percent: progress })}</p>}
      {done && <p className="notice success">{S.batches.uploaded}</p>}
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
      {isPublished(batch) ? (
        <p className="notice">{fmt(S.batches.published, { url: qrUrl })}</p>
      ) : (
        <button className="btn btn-primary" type="button" onClick={publish} disabled={!batch.videoUrl}>
          {S.batches.publish}
        </button>
      )}
    </div>
  )
}

// FR-QR-007
export default function BatchesPage() {
  const list = useAdminList('/admin/batches')
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function remove(b) {
    if (!window.confirm(S.common.confirmDelete)) return
    setActionError(null)
    try {
      await authedApi(`/admin/batches/${b.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

  const update = (item) => {
    setEditing(item)
    list.reload()
  }

  return (
    <section>
      <PageHead title={S.batches.title}>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </PageHead>
      {editing && (
        <>
          <BatchForm key={`${editing.id ?? 'new'}-${editing.status}`} initial={editing} onSaved={update} onCancel={() => setEditing(null)} />
          {editing.id && <VideoPanel key={editing.id} batch={editing} onChange={update} />}
        </>
      )}
      {actionError && (
        <p className="notice error" role="alert">
          {t(`errors.${actionError}`)}
        </p>
      )}
      {list.status === 'loading' && <p>{S.common.loading}</p>}
      {list.status === 'error' && (
        <p className="notice error" role="alert">
          {t(`errors.${list.error.code}`)}
        </p>
      )}
      {list.status === 'ok' && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{S.batches.colCode}</th>
              <th>{S.batches.colDate}</th>
              <th>{S.batches.colVideo}</th>
              <th>{S.batches.colStatus}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((b) => (
              <tr key={b.id}>
                <td>
                  <code>{b.code}</code>
                </td>
                <td>{b.producedOn ?? '—'}</td>
                <td>{b.videoUrl ? S.batches.hasVideo : '—'}</td>
                <td>
                  <span className={`status status-${b.status}`}>{S.batches.statuses[b.status]}</span>
                </td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(b)}>
                    {S.common.edit}
                  </button>
                  {!isPublished(b) && (
                    <button type="button" className="btn btn-small btn-danger" onClick={() => remove(b)}>
                      {S.common.delete}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
