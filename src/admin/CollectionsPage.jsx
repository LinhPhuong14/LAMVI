import { useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import I18nInput from './I18nInput.jsx'
import { useAdminList } from './useAdminList.js'
import PageHead from './PageHead.jsx'
import { S, fmt } from './strings.js'

function CollectionForm({ initial, onDone, onCancel }) {
  const { authedApi } = useAuth()
  const [form, setForm] = useState({ slug: '', status: 'draft', tone: '', sortOrder: 0, name: {}, description: {}, storyTitle: {}, story: {}, ...initial })
  const { pending, error, fields, run } = useSubmit()
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })
  async function submit(e) {
    e.preventDefault()
    const body = { slug: form.slug, status: form.status, tone: form.tone || null, sortOrder: Number(form.sortOrder), name: form.name, description: form.description, storyTitle: form.storyTitle, story: form.story }
    const res = await run(() => authedApi(initial.id ? `/admin/collections/${initial.id}` : '/admin/collections', { method: initial.id ? 'PATCH' : 'POST', body }))
    if (res) onDone()
  }
  return <form className="form admin-form" onSubmit={submit} noValidate>
    <p className="field-hint">{S.collections.note}</p>
    <Field label={S.collections.slug} value={form.slug} onChange={set('slug')} disabled={Boolean(initial.id)} error={fields.slug} hint={S.collections.slugHint} />
    <Field as="select" label={S.products.status} value={form.status} onChange={set('status')} error={fields.status}>{Object.entries(S.products.statuses).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</Field>
    <Field as="select" label={S.products.tone} value={form.tone ?? ''} onChange={set('tone')} error={fields.tone}>{Object.entries(S.products.tones).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</Field>
    <Field label={S.common.sortOrder} type="number" value={form.sortOrder} onChange={set('sortOrder')} error={fields.sortOrder} />
    {[[ 'name', S.collections.name ], ['description', S.products.description], ['storyTitle', S.collections.storyTitle], ['story', S.collections.story]].map(([key, label]) => <I18nInput key={key} label={label} required={key === 'name'} multiline={key === 'story' || key === 'description'} value={form[key] ?? {}} onChange={(v) => setForm({ ...form, [key]: v })} error={fields[key]} />)}
    {error && <p className="notice error" role="alert">{fmt(S.collections.saveError, { error })}</p>}
    <div className="admin-actions"><button type="submit" className="btn btn-primary" disabled={pending}>{pending ? S.common.saving : S.common.save}</button><button type="button" className="btn btn-ghost" onClick={onCancel}>{S.common.cancel}</button></div>
  </form>
}

export default function CollectionsPage() {
  const list = useAdminList('/admin/collections')
  const { authedApi } = useAuth()
  const [editing, setEditing] = useState(null), [error, setError] = useState(null)
  async function remove(c) {
    if (!window.confirm(S.collections.confirmDelete)) return
    setError(null)
    try { await authedApi(`/admin/collections/${c.id}`, { method: 'DELETE' }); list.reload() } catch (e) { setError(e.code) }
  }
  return <section><PageHead title={S.collections.title}>{!editing && <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>{S.common.create}</button>}</PageHead>
    {editing && <CollectionForm key={editing.id ?? 'new'} initial={editing} onCancel={() => setEditing(null)} onDone={() => { setEditing(null); list.reload() }} />}
    {error && <p className="notice error" role="alert">{error === 'COLLECTION_IN_USE' ? S.collections.inUse : fmt(S.collections.deleteError, { error })}</p>}
    {list.status === 'loading' && <p>{S.common.loading}</p>}
    {list.status === 'error' && <p className="notice error" role="alert">{S.collections.loadError} <button type="button" onClick={list.reload}>{S.collections.retry}</button></p>}
    {list.status === 'ok' && (!list.items.length ? <p>{S.collections.empty}</p> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{S.products.colName}</th><th>Slug</th><th>{S.products.status}</th><th>{S.collections.actions}</th></tr></thead><tbody>{list.items.map((c) => <tr key={c.id}><td>{c.name.vi}</td><td>{c.slug}</td><td>{S.products.statuses[c.status]}</td><td><button type="button" className="btn btn-small" onClick={() => setEditing(c)}>{S.common.edit}</button> <button type="button" className="btn btn-small btn-danger" onClick={() => remove(c)}>{S.common.delete}</button></td></tr>)}</tbody></table></div>)}
  </section>
}
