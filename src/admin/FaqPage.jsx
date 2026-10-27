import { useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import PageHead from './PageHead.jsx'
import Split from './Split.jsx'
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

// G-07: FAQ lưu DB, Mây đọc cùng nguồn.
// Thứ tự hiển thị đổi bằng nút ↑ ↓ (dùng được bằng bàn phím, không cần kéo thả); công tắc bật/tắt hiển thị ngay trên hàng.
export default function FaqPage() {
  const list = useAdminList('/admin/faq')
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [filter, setFilter] = useState('all')

  const items = list.status === 'ok' ? [...list.items].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) : []
  const shown = items.filter((f) => filter === 'all' || (filter === 'on' ? f.isPublished : !f.isPublished))

  async function patch(f, body) {
    setActionError(null)
    try {
      await authedApi(`/admin/faq/${f.id}`, { method: 'PATCH', body })
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

  // Đổi chỗ hai mục liền kề: gán lại thứ tự theo vị trí mới của cả hai
  async function move(index, dir) {
    const a = items[index]
    const b = items[index + dir]
    if (!a || !b) return
    setActionError(null)
    try {
      await Promise.all([
        authedApi(`/admin/faq/${a.id}`, { method: 'PATCH', body: { sortOrder: index + dir } }),
        authedApi(`/admin/faq/${b.id}`, { method: 'PATCH', body: { sortOrder: index } }),
      ])
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

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
      <PageHead title={S.faq.title}>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </PageHead>
      <Split
        label={S.faq.title}
        aside={
          editing && (
            <FaqForm
              key={editing.id ?? 'new'}
              initial={editing}
              onCancel={() => setEditing(null)}
              onDone={() => {
                setEditing(null)
                list.reload()
              }}
            />
          )
        }
      >
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
          <>
            <div className="chip-row" role="group" aria-label={S.faq.colPublished}>
              {[['all', S.orders.chipAll], ['on', S.faq.shown], ['off', S.faq.hidden]].map(([k, l]) => (
                <button key={k} type="button" className={`chip${filter === k ? ' is-on' : ''}`} aria-pressed={filter === k} onClick={() => setFilter(k)}>
                  {l}
                  <b>{k === 'all' ? items.length : items.filter((f) => (k === 'on' ? f.isPublished : !f.isPublished)).length}</b>
                </button>
              ))}
            </div>
            <ol className="faq-admin-list">
              {shown.map((f) => {
                const i = items.indexOf(f)
                return (
                  <li key={f.id} className={editing?.id === f.id ? 'is-open' : undefined}>
                    <div className="faq-admin-order">
                      <button type="button" className="btn btn-small" onClick={() => move(i, -1)} disabled={i === 0 || filter !== 'all'} aria-label={`${S.faq.moveUp}: ${f.question?.vi}`}>
                        ↑
                      </button>
                      <button type="button" className="btn btn-small" onClick={() => move(i, 1)} disabled={i === items.length - 1 || filter !== 'all'} aria-label={`${S.faq.moveDown}: ${f.question?.vi}`}>
                        ↓
                      </button>
                    </div>
                    <div className="faq-admin-text">
                      <strong>{f.question?.vi}</strong>
                      <p>{f.answer?.vi}</p>
                    </div>
                    <label className="switch">
                      <input type="checkbox" role="switch" checked={Boolean(f.isPublished)} onChange={() => patch(f, { isPublished: !f.isPublished })} aria-label={`${f.question?.vi}: ${f.isPublished ? S.faq.shown : S.faq.hidden}`} />
                      <span className="switch-track" aria-hidden="true" />
                    </label>
                    <div className="admin-row-actions">
                      <button type="button" className="btn btn-small btn-primary" onClick={() => setEditing(f)}>
                        {S.common.edit}
                      </button>
                      <button type="button" className="btn btn-small btn-danger" onClick={() => remove(f)}>
                        {S.common.delete}
                      </button>
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </Split>
    </section>
  )
}
