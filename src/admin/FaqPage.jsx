import { useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import { S } from './strings.js'

function FaqForm({ initial, onDone, onCancel }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({
    question: initial?.question ?? {},
    answer: initial?.answer ?? {},
    isPublished: initial?.isPublished ?? true,
    sortOrder: initial?.sortOrder ?? 0,
  }))
  const { pending, error, fields, run } = useSubmit()

  async function onSubmit(e) {
    e.preventDefault()
    const body = { ...form, sortOrder: Number(form.sortOrder) || 0 }
    const res = await run(() =>
      initial?.id
        ? authedApi(`/admin/faq/${initial.id}`, { method: 'PATCH', body })
        : authedApi('/admin/faq', { method: 'POST', body }),
    )
    if (res) onDone()
  }

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate>
      <p className="field-hint">{S.faq.note}</p>
      <I18nInput label={S.faq.question} required value={form.question} onChange={(v) => setForm({ ...form, question: v })} error={fields.question} />
      <I18nInput label={S.faq.answer} required multiline value={form.answer} onChange={(v) => setForm({ ...form, answer: v })} error={fields.answer} />
      <div className="admin-grid">
        <Field label={S.common.sortOrder} type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} error={fields.sortOrder} />
        <label className="checkbox">
          <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} />
          {S.faq.published}
        </label>
      </div>
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

// G-07: FAQ lưu DB, Mây đọc cùng nguồn
export default function FaqPage() {
  const list = useAdminList('/admin/faq')
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function remove(f) {
    if (!window.confirm(S.common.confirmDelete)) return
    setActionError(null)
    try {
      await authedApi(`/admin/faq/${f.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

  return (
    <section>
      <header className="admin-head">
        <h1>{S.faq.title}</h1>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </header>
      {editing && (
        <FaqForm
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
              <th>{S.faq.colQuestion}</th>
              <th>{S.faq.colPublished}</th>
              <th>{S.common.sortOrder}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((f) => (
              <tr key={f.id}>
                <td>{f.question?.vi}</td>
                <td>{f.isPublished ? S.faq.yes : S.faq.no}</td>
                <td>{f.sortOrder}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(f)}>
                    {S.common.edit}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => remove(f)}>
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
