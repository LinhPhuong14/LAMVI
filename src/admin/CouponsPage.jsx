import { useState } from 'react'
import Field from '../components/Field'
import { formatVnd } from '../lib/money.js'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import { useAdminList } from './useAdminList.js'
import PageHead from './PageHead.jsx'
import { S } from './strings.js'

const EMPTY = {
  code: '',
  type: 'percent',
  value: '',
  maxDiscount: '',
  minOrder: '',
  usageLimit: '',
  perUserLimit: 1,
  startsAt: '',
  endsAt: '',
  status: 'active',
}

// '' → null (xoá giới hạn); số → số nguyên
const num = (v) => (v === '' || v === null ? null : Number(v))
// <input type="datetime-local"> dùng giờ địa phương, API dùng ISO
const toIso = (v) => (v ? new Date(v).toISOString() : null)
const toLocal = (iso) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function toBody(form) {
  const body = {
    code: form.code,
    type: form.type,
    minOrder: num(form.minOrder),
    usageLimit: num(form.usageLimit),
    perUserLimit: num(form.perUserLimit),
    startsAt: toIso(form.startsAt),
    endsAt: toIso(form.endsAt),
    status: form.status,
  }
  // free_shipping không có giá trị giảm và không có trần giảm
  if (form.type !== 'free_shipping') body.value = num(form.value)
  body.maxDiscount = form.type === 'percent' ? num(form.maxDiscount) : null
  return body
}

function CouponForm({ initial, onDone, onCancel }) {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(() => ({
    ...EMPTY,
    ...initial,
    value: initial?.value ?? '',
    maxDiscount: initial?.maxDiscount ?? '',
    minOrder: initial?.minOrder ?? '',
    usageLimit: initial?.usageLimit ?? '',
    perUserLimit: initial?.perUserLimit ?? 1,
    startsAt: toLocal(initial?.startsAt),
    endsAt: toLocal(initial?.endsAt),
  }))
  const { pending, error, fields, run } = useSubmit()
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  const valueHint = {
    percent: S.coupons.valuePercentHint,
    amount: S.coupons.valueAmountHint,
    free_shipping: S.coupons.valueFreeShipHint,
  }[form.type]

  async function onSubmit(e) {
    e.preventDefault()
    const body = toBody(form)
    const res = await run(() =>
      initial?.id
        ? authedApi(`/admin/coupons/${initial.id}`, { method: 'PATCH', body })
        : authedApi('/admin/coupons', { method: 'POST', body }),
    )
    if (res) onDone()
  }

  return (
    <form className="form admin-form" onSubmit={onSubmit} noValidate>
      <div className="admin-grid">
        <Field label={S.coupons.code} value={form.code} onChange={set('code')} error={fields.code} hint={S.coupons.codeHint} />
        <Field as="select" label={S.coupons.type} value={form.type} onChange={set('type')} error={fields.type}>
          {Object.entries(S.coupons.types).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Field>
        {form.type !== 'free_shipping' && (
          <Field
            label={S.coupons.value}
            type="number"
            min="1"
            value={form.value}
            onChange={set('value')}
            error={fields.value}
            hint={valueHint}
          />
        )}
        {form.type === 'percent' && (
          <Field
            label={S.coupons.maxDiscount}
            type="number"
            min="1"
            step="1000"
            value={form.maxDiscount}
            onChange={set('maxDiscount')}
            error={fields.maxDiscount}
            hint={S.coupons.maxDiscountHint}
          />
        )}
        <Field
          label={S.coupons.minOrder}
          type="number"
          min="0"
          step="1000"
          value={form.minOrder}
          onChange={set('minOrder')}
          error={fields.minOrder}
        />
        <Field
          label={S.coupons.usageLimit}
          type="number"
          min="1"
          value={form.usageLimit}
          onChange={set('usageLimit')}
          error={fields.usageLimit}
          hint={S.coupons.usageLimitHint}
        />
        <Field
          label={S.coupons.perUserLimit}
          type="number"
          min="1"
          value={form.perUserLimit}
          onChange={set('perUserLimit')}
          error={fields.perUserLimit}
        />
        <Field
          label={S.coupons.startsAt}
          type="datetime-local"
          value={form.startsAt}
          onChange={set('startsAt')}
          error={fields.startsAt}
        />
        <Field
          label={S.coupons.endsAt}
          type="datetime-local"
          value={form.endsAt}
          onChange={set('endsAt')}
          error={fields.endsAt}
          hint={S.coupons.endsAtHint}
        />
        <Field as="select" label={S.coupons.status} value={form.status} onChange={set('status')} error={fields.status}>
          {Object.entries(S.coupons.statuses).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </Field>
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

const period = (c) => {
  const f = (iso) => (iso ? new Date(iso).toLocaleDateString('vi-VN') : '…')
  return c.startsAt || c.endsAt ? `${f(c.startsAt)} → ${f(c.endsAt)}` : '—'
}

const valueLabel = (c) =>
  c.type === 'percent' ? `${c.value}%` : c.type === 'amount' ? formatVnd(c.value) : S.coupons.types.free_shipping

// FR-CPN-001 (§14)
export default function CouponsPage() {
  const list = useAdminList('/admin/coupons')
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

  return (
    <section>
      <PageHead title={S.coupons.title}>
        {!editing && (
          <button className="btn btn-primary" type="button" onClick={() => setEditing({})}>
            {S.common.create}
          </button>
        )}
      </PageHead>
      <p className="field-hint">{S.coupons.note}</p>
      {editing && (
        <CouponForm
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
      {list.status === 'ok' &&
        (list.items.length === 0 ? (
          <p>{S.coupons.empty}</p>
        ) : (
          <div className="admin-panel">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>{S.coupons.colCode}</th>
                  <th>{S.coupons.colType}</th>
                  <th>{S.coupons.colValue}</th>
                  <th>{S.coupons.colUsed}</th>
                  <th>{S.coupons.colPeriod}</th>
                  <th>{S.coupons.colStatus}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.items.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <code>{c.code}</code>
                    </td>
                    <td>{S.coupons.types[c.type]}</td>
                    <td>{valueLabel(c)}</td>
                    <td>
                      {c.usedCount}
                      {c.usageLimit ? ` / ${c.usageLimit}` : ` / ${S.coupons.unlimited}`}
                    </td>
                    <td>{period(c)}</td>
                    <td>
                      <span className={`status status-${c.status === 'active' ? 'published' : 'hidden'}`}>
                        {S.coupons.statuses[c.status]}
                      </span>
                    </td>
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
          </div>
        ))}
    </section>
  )
}
