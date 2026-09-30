import { useState } from 'react'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import PageHead from './PageHead.jsx'
import { S, fmt } from './strings.js'
import { uploadFile } from './uploadFile.js'

const EMPTY = { slug: '', kind: 'single', status: 'draft', price: '', tone: '', sortOrder: 0, name: {}, description: {}, badge: {}, imageAlt: {} }

// Giới hạn phía client chỉ để báo sớm; server mới là nơi quyết định (MAX_IMAGE_MB)
const MAX_IMAGE_MB = 5
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'

// G-23: tải/đổi/gỡ ảnh sản phẩm. Trình duyệt tải thẳng lên Storage bằng signed URL (T-12, D-46).
function ImagePanel({ product, onChange }) {
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
    if (file.size > MAX_IMAGE_MB * 1024 * 1024) return setError('IMAGE_TOO_LARGE')
    setProgress(0)
    try {
      const up = await authedApi(`/admin/products/${product.id}/image-upload`, {
        method: 'POST',
        body: { contentType: file.type, size: file.size },
      })
      await uploadFile(up.uploadUrl, file, up.headers, setProgress)
      const res = await authedApi(`/admin/products/${product.id}/image`, { method: 'POST', body: { path: up.path } })
      setDone(true)
      onChange(res.item)
    } catch (err) {
      setError(err.fields ? Object.values(err.fields)[0] : err.code)
    } finally {
      setProgress(null)
    }
  }

  async function removeImage() {
    if (!window.confirm(S.products.confirmRemoveImage)) return
    setError(null)
    setDone(false)
    try {
      const res = await authedApi(`/admin/products/${product.id}/image`, { method: 'DELETE' })
      onChange(res.item)
    } catch (err) {
      setError(err.code)
    }
  }

  return (
    <div className="admin-image">
      <h3>{S.products.image}</h3>
      {product.imageUrl ? (
        <img className="admin-image-preview" src={product.imageUrl} alt={product.imageAlt?.vi ?? product.name?.vi ?? ''} />
      ) : (
        <p className="field-hint">{S.products.noImage}</p>
      )}
      <p className="field-hint">{fmt(S.products.imageHint, { mb: MAX_IMAGE_MB })}</p>
      <div className="admin-actions">
        <label className="btn btn-ghost file-btn">
          {product.imageUrl ? S.products.replaceImage : S.products.chooseImage}
          <input type="file" accept={IMAGE_ACCEPT} onChange={onFile} disabled={progress !== null} hidden />
        </label>
        {product.imageUrl && (
          <button type="button" className="btn btn-small btn-danger" onClick={removeImage} disabled={progress !== null}>
            {S.products.removeImage}
          </button>
        )}
      </div>
      {progress !== null && <p role="status">{fmt(S.products.uploadingImage, { percent: progress })}</p>}
      {done && <p className="notice success">{S.products.imageSaved}</p>}
      {error && (
        <p className="notice error" role="alert">
          {t(`errors.${error}`)}
        </p>
      )}
    </div>
  )
}

function toBody(form) {
  return {
    ...form,
    price: form.price === '' ? undefined : Number(form.price),
    sortOrder: Number(form.sortOrder) || 0,
    tone: form.tone || null,
  }
}

function ProductForm({ initial, onDone, onCancel, onImageChange }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, tone: initial?.tone ?? '', name: initial?.name ?? {}, description: initial?.description ?? {}, badge: initial?.badge ?? {}, imageAlt: initial?.imageAlt ?? {} }))
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    const { id, ...rest } = form
    const body = toBody(rest)
    delete body.createdAt
    delete body.updatedAt
    const res = await run(() =>
      id ? authedApi(`/admin/products/${id}`, { method: 'PATCH', body }) : authedApi('/admin/products', { method: 'POST', body }),
    )
    if (res) onDone()
  }

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate>
      <div className="admin-grid">
        <Field label={S.products.slug} value={form.slug} onChange={set('slug')} error={fields.slug} hint={S.products.slugHint} />
        <Field label={S.products.price} type="number" min="0" step="1000" value={form.price} onChange={set('price')} error={fields.price} />
        <Field as="select" label={S.products.kind} value={form.kind} onChange={set('kind')} error={fields.kind}>
          {Object.entries(S.products.kinds).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Field>
        <Field as="select" label={S.products.status} value={form.status} onChange={set('status')} error={fields.status} hint={S.products.statusHint}>
          {Object.entries(S.products.statuses).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Field>
        <Field as="select" label={S.products.tone} value={form.tone} onChange={set('tone')} error={fields.tone}>
          {Object.entries(S.products.tones).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Field>
        <Field label={S.common.sortOrder} type="number" value={form.sortOrder} onChange={set('sortOrder')} error={fields.sortOrder} />
      </div>
      <p className="field-hint">{S.common.viRequiredHint}</p>
      <I18nInput label={S.products.name} required value={form.name} onChange={(v) => setForm({ ...form, name: v })} error={fields.name} />
      <I18nInput label={S.products.description} multiline value={form.description} onChange={(v) => setForm({ ...form, description: v })} error={fields.description} />
      <I18nInput label={S.products.badge} value={form.badge} onChange={(v) => setForm({ ...form, badge: v })} error={fields.badge} />
      <I18nInput
        label={S.products.imageAlt}
        value={form.imageAlt}
        onChange={(v) => setForm({ ...form, imageAlt: v })}
        error={fields.imageAlt}
      />
      <p className="field-hint">{S.products.imageAltHint}</p>
      {/* Ảnh cần id sản phẩm để đặt đường dẫn trong Storage → chỉ tải được sau khi đã lưu */}
      {initial?.id ? (
        <ImagePanel product={initial} onChange={onImageChange} />
      ) : (
        <p className="field-hint">{S.products.saveFirst}</p>
      )}
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

// FR-CAT-004
export default function ProductsPage() {
  const list = useAdminList('/admin/products')
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(null) // null | {} (mới) | product
  const [actionError, setActionError] = useState(null)

  async function remove(p) {
    if (!window.confirm(S.common.confirmDelete)) return
    setActionError(null)
    try {
      await authedApi(`/admin/products/${p.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

  return (
    <section>
      <PageHead title={S.products.title}>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </PageHead>
      {editing && (
        <ProductForm
          key={editing.id ?? 'new'}
          initial={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
            list.reload()
          }}
          onImageChange={(item) => {
            setEditing(item)
            list.reload()
          }}
        />
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
              <th>{S.products.colName}</th>
              <th>{S.products.slug}</th>
              <th>{S.products.colPrice}</th>
              <th>{S.products.colStatus}</th>
              <th>{S.products.colImage}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((p) => (
              <tr key={p.id}>
                <td>{p.name?.vi}</td>
                <td>
                  <code>{p.slug}</code>
                </td>
                <td>{formatVnd(p.price)}</td>
                <td>
                  <span className={`status status-${p.status}`}>{S.products.statuses[p.status]}</span>
                </td>
                <td>{p.imageUrl ? S.products.hasImage : '—'}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(p)}>
                    {S.common.edit}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => remove(p)}>
                    {S.common.delete}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
