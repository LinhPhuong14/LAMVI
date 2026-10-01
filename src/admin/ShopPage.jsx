import { useEffect, useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import { S } from './strings.js'

const toInput = (v) => (v === null || v === undefined ? '' : String(v))
const toNumber = (v) => (v.trim() === '' ? null : Number(v))

// D-63, D-71: phí ship đồng giá + mức miễn phí; mức tối đa cho COD
export default function ShopPage() {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saved, setSaved] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  useEffect(() => {
    let alive = true
    authedApi('/admin/shop')
      .then(({ config }) => alive && setForm({ shippingFee: toInput(config.shippingFee), freeShippingFrom: toInput(config.freeShippingFrom), codMaxTotal: toInput(config.codMaxTotal) }))
      .catch((err) => alive && setLoadError(err.code))
    return () => {
      alive = false
    }
  }, [authedApi])

  async function onSubmit(e) {
    e.preventDefault()
    setSaved(false)
    const body = { shippingFee: Number(form.shippingFee), freeShippingFrom: toNumber(form.freeShippingFrom), codMaxTotal: toNumber(form.codMaxTotal) }
    if (await run(() => authedApi('/admin/shop', { method: 'PUT', body }))) setSaved(true)
  }

  const set = (k) => (e) => {
    setSaved(false)
    setForm({ ...form, [k]: e.target.value })
  }

  return (
    <section>
      <header className="admin-head">
        <h1>{S.shop.title}</h1>
      </header>
      {loadError && (
        <p className="notice error" role="alert">
          {t(`errors.${loadError}`)}
        </p>
      )}
      {!form && !loadError && <p>{S.common.loading}</p>}
      {form && (
        <form className="form admin-form" onSubmit={onSubmit} noValidate>
          <p className="field-hint">{S.shop.vatNote}</p>
          <Field label={S.shop.shippingFee} type="number" min="0" value={form.shippingFee} onChange={set('shippingFee')} error={fields.shippingFee} />
          <Field label={S.shop.freeShippingFrom} type="number" min="1" value={form.freeShippingFrom} onChange={set('freeShippingFrom')} error={fields.freeShippingFrom} hint={S.shop.freeHint} />
          <Field label={S.shop.codMaxTotal} type="number" min="1" value={form.codMaxTotal} onChange={set('codMaxTotal')} error={fields.codMaxTotal} hint={S.shop.codHint} />
          {error && !Object.keys(fields).length && (
            <p className="notice error" role="alert">
              {t(`errors.${error}`)}
            </p>
          )}
          {saved && (
            <p className="notice success" role="status">
              {S.common.saved}
            </p>
          )}
          <div className="admin-actions">
            <button className="btn btn-primary" type="submit" disabled={pending}>
              {pending ? S.common.saving : S.common.save}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
