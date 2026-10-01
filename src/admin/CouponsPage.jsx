import { useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import { formatVnd } from '../lib/money.js'
import { formatDateTime } from '../lib/date.js'
import { useAdminList } from './useAdminList.js'
import { S } from './strings.js'

const toInput = (v) => (v === null || v === undefined ? '' : String(v))
const toNumber = (v) => (String(v).trim() === '' ? null : Number(v))
// datetime-local (giờ trình duyệt của admin) ↔ ISO
const toLocalInput = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
}
const fromLocalInput = (v) => (v ? new Date(v).toISOString() : null)

function couponValueText(c) {
  if (c.type === 'percent') return `${c.value}%${c.maxDiscount ? ` (${S.coupons.maxShort.replace('{amount}', formatVnd(c.maxDiscount))})` : ''}`
  if (c.type === 'amount') return formatVnd(c.value)
  return S.coupons.types.free_shipping
}

function CouponForm({ initial, products, onDone, onCancel }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({
    code: initial?.code ?? '',
    status: initial?.status ?? 'active',
    type: initial?.type ?? 'percent',
    value: toInput(initial?.value ?? ''),
    maxDiscount: toInput(initial?.maxDiscount),
    minOrder: toInput(initial?.minOrder),
    startsAt: toLocalInput(initial?.startsAt),
    endsAt: toLocalInput(initial?.endsAt),
    usageLimit: toInput(initial?.usageLimit),
    perUserLimit: toInput(initial?.perUserLimit),
    productIds: initial?.productIds ?? null,
    note: initial?.note ?? '',
  }))
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function onSubmit(e) {
    e.preventDefault()
    const body = {
      code: form.code,
      status: form.status,
      type: form.type,
      value: form.type === 'free_shipping' ? 0 : toNumber(form.value),
      maxDiscount: form.type === 'percent' ? toNumber(form.maxDiscount) : null,
      minOrder: toNumber(form.minOrder),
      startsAt: fromLocalInput(form.startsAt),
      endsAt: fromLocalInput(form.endsAt),
      usageLimit: toNumber(form.usageLimit),
      perUserLimit: toNumber(form.perUserLimit),
      productIds: form.productIds,
      note: form.note,
    }
    const res = await run(() =>
      initial?.id ? authedApi(`/admin/coupons/${initial.id}`, { method: 'PATCH', body }) : authedApi('/admin/coupons', { method: 'POST', body }),
    )
    if (res) onDone()
  }

  const toggleProduct = (id) => {
    const cur = form.productIds ?? []
    setForm({ ...form, productIds: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] })
  }

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate>
      <p className="field-hint">{S.coupons.rules}</p>
      <div className="admin-grid">
        <Field label={S.coupons.code} value={form.code} onChange={set('code')} error={fields.code} hint={S.coupons.codeHint} />
        <Field as="select" label={S.coupons.status} value={form.status} onChange={set('status')} error={fields.status}>
          {Object.entries(S.coupons.statuses).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Field>
        <Field as="select" label={S.coupons.type} value={form.type} onChange={set('type')} error={fields.type}>
          {Object.entries(S.coupons.types).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Field>
        {form.type !== 'free_shipping' && (
          <Field label={S.coupons.value} type="number" min="1" value={form.value} onChange={set('value')} error={fields.value} hint={S.coupons.valueHint[form.type]} />
        )}
        {form.type === 'percent' && (
          <Field label={S.coupons.maxDiscount} type="number" min="1" value={form.maxDiscount} onChange={set('maxDiscount')} error={fields.maxDiscount} hint={S.coupons.optional} />
        )}
        <Field label={S.coupons.minOrder} type="number" min="0" value={form.minOrder} onChange={set('minOrder')} error={fields.minOrder} hint={S.coupons.optional} />
        <Field label={S.coupons.startsAt} type="datetime-local" value={form.startsAt} onChange={set('startsAt')} error={fields.startsAt} />
        <Field label={S.coupons.endsAt} type="datetime-local" value={form.endsAt} onChange={set('endsAt')} error={fields.endsAt} />
        <Field label={S.coupons.usageLimit} type="number" min="1" value={form.usageLimit} onChange={set('usageLimit')} error={fields.usageLimit} hint={S.coupons.optional} />
        <Field label={S.coupons.perUserLimit} type="number" min="1" value={form.perUserLimit} onChange={set('perUserLimit')} error={fields.perUserLimit} hint={S.coupons.optional} />
      </div>
      <fieldset className="admin-scope">
        <legend>{S.coupons.scope}</legend>
        <label className="checkbox">
          <input type="radio" checked={!form.productIds} onChange={() => setForm({ ...form, productIds: null })} />
          {S.coupons.scopeAll}
        </label>
        <label className="checkbox">
          <input type="radio" checked={Boolean(form.productIds)} onChange={() => setForm({ ...form, productIds: form.productIds ?? [] })} />
          {S.coupons.scopeProducts}
        </label>
        {form.productIds && (
          <div className="admin-scope-products">
            {products.map((p) => (
              <label key={p.id} className="checkbox">
                <input type="checkbox" checked={form.productIds.includes(p.id)} onChange={() => toggleProduct(p.id)} />
                {p.name?.vi}
              </label>
            ))}
          </div>
        )}
        {fields.productIds && <span className="field-error">{t(`errors.${fields.productIds}`)}</span>}
      </fieldset>
      <Field label={S.coupons.note} value={form.note} onChange={set('note')} error={fields.note} />
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

// FR-CPN-001/002 (D-65…D-68)
export default function CouponsPage() {
  const list = useAdminList('/admin/coupons')
  const products = useAdminList('/admin/products')
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [editing, setEditing] = useState(null)
  const [actionError, setActionError] = useState(null)

  async function remove(c) {
    if (!window.confirm(S.common.confirmDelete)) return
    setActionError(null)
    try {
      await authedApi(`/admin/coupons/${c.id}`, { method: 'DELETE' })
      list.reload()
    } catch (err) {
      setActionError(err.code)
    }
  }

  const window_ = (c) =>
    c.startsAt || c.endsAt ? `${c.startsAt ? formatDateTime(c.startsAt, 'vi') : '…'} → ${c.endsAt ? formatDateTime(c.endsAt, 'vi') : '…'}` : '—'

  return (
    <section>
      <header className="admin-head">
        <h1>{S.coupons.title}</h1>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </header>
      {editing && (
        <CouponForm
          key={editing.id ?? 'new'}
          initial={editing}
          products={products.items ?? []}
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
      {list.status === 'ok' && !list.items.length && <p>{S.common.empty}</p>}
      {list.status === 'ok' && list.items.length > 0 && (
        <table className="admin-table">
          <thead>
            <tr>
              <th>{S.coupons.code}</th>
              <th>{S.coupons.colValue}</th>
              <th>{S.coupons.status}</th>
              <th>{S.coupons.colUsed}</th>
              <th>{S.coupons.colWindow}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.items.map((c) => (
              <tr key={c.id}>
                <td>
                  <strong>{c.code}</strong>
                  {c.productIds && <small> · {S.coupons.scopeProducts}</small>}
                </td>
                <td>{couponValueText(c)}</td>
                <td>{S.coupons.statuses[c.status]}</td>
                <td>
                  {c.used}
                  {c.usageLimit ? ` / ${c.usageLimit}` : ''}
                </td>
                <td>{window_(c)}</td>
                <td className="admin-row-actions">
                  <button type="button" className="btn btn-small" onClick={() => setEditing(c)}>
                    {S.common.edit}
                  </button>
                  <button type="button" className="btn btn-small btn-danger" onClick={() => remove(c)}>
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
