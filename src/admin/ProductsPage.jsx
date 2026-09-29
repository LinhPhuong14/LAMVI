import { useState } from 'react'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import { S } from './strings.js'

const EMPTY = { slug: '', kind: 'single', status: 'draft', price: '', tone: '', sortOrder: 0, name: {}, description: {}, badge: {} }

function toBody(form) {
  return {
    ...form,
    price: form.price === '' ? undefined : Number(form.price),
    sortOrder: Number(form.sortOrder) || 0,
    tone: form.tone || null,
  }
}

function ProductForm({ initial, onDone, onCancel }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({ ...EMPTY, ...initial, tone: initial?.tone ?? '', name: initial?.name ?? {}, description: initial?.description ?? {}, badge: initial?.badge ?? {} }))
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
      <header className="admin-head">
        <h1>{S.products.title}</h1>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </header>
      {editing && (
        <ProductForm
          key={editing.id ?? 'new'}
          initial={editing}
          onCancel={() => setEditing(null)}
          onDone={() => {
            setEditing(null)
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
