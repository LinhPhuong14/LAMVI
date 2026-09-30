import { useEffect, useState } from 'react'
import Field from '../components/Field'
import { useAuth } from '../auth/context.js'
import { useSubmit } from '../auth/useForm.js'
import { useI18n } from '../i18n/index.js'
import I18nInput from './I18nInput.jsx'
import PageHead from './PageHead.jsx'
import { S, fmt } from './strings.js'

const LANGS = ['vi', 'en', 'zh']
const GROUPS = ['sick', 'tired', 'resting', 'unknown', 'unknownNoChannel']
const LIMITS = ['guestPerSession', 'guestPerDayIp', 'userPerDay', 'maxChars']

// Câu thông báo: mảng ↔ textarea mỗi dòng một câu
const toLines = (arr) => (arr ?? []).join('\n')
const fromLines = (s) => s.split('\n').map((x) => x.trim()).filter(Boolean)

function Usage({ usage }) {
  const pct = usage.budgetPct == null ? '—' : Math.round(usage.budgetPct * 100)
  return (
    <div className="account-card">
      <h2>{S.may.usageTitle}</h2>
      <p>{fmt(S.may.usage, { cost: usage.costUsd.toFixed(2), budget: usage.budgetUsd, pct, requests: usage.requests })}</p>
      {!usage.openaiConfigured && <p className="notice">{S.may.notConfigured}</p>}
      {usage.alert === 'warning' && <p className="notice error">{S.may.alertWarning}</p>}
      {usage.alert === 'exhausted' && <p className="notice error">{S.may.alertExhausted}</p>}
    </div>
  )
}

// FR-AI-007
export default function MayConfigPage() {
  const { authedApi } = useAuth()
  const { t } = useI18n()
  const [form, setForm] = useState(null)
  const [usage, setUsage] = useState(null)
  const [loadError, setLoadError] = useState(null)
  const [saved, setSaved] = useState(false)
  const { pending, error, fields, run } = useSubmit()

  useEffect(() => {
    let alive = true
    Promise.all([authedApi('/admin/may/config'), authedApi('/admin/may/usage')])
      .then(([c, u]) => {
        if (!alive) return
        const cfg = c.config
        setForm({
          ...cfg,
          monthlyBudgetUsd: String(cfg.monthlyBudgetUsd),
          limits: Object.fromEntries(LIMITS.map((k) => [k, String(cfg.limits[k])])),
          lines: Object.fromEntries(GROUPS.map((g) => [g, Object.fromEntries(LANGS.map((l) => [l, toLines(cfg.messages[g][l])]))])),
        })
        setUsage(u)
      })
      .catch((err) => alive && setLoadError(err.code))
    return () => {
      alive = false
    }
  }, [authedApi])

  if (loadError) {
    return (
      <p className="notice error" role="alert">
        {t(`errors.${loadError}`)}
      </p>
    )
  }
  if (!form) return <p>{S.common.loading}</p>

  const set = (patch) => {
    setSaved(false)
    setForm({ ...form, ...patch })
  }

  async function onSubmit(e) {
    e.preventDefault()
    const body = {
      openaiEnabled: form.openaiEnabled,
      monthlyBudgetUsd: Number(form.monthlyBudgetUsd),
      supportChannel: form.supportChannel,
      limits: Object.fromEntries(LIMITS.map((k) => [k, Number(form.limits[k])])),
      messages: Object.fromEntries(GROUPS.map((g) => [g, Object.fromEntries(LANGS.map((l) => [l, fromLines(form.lines[g][l])]))])),
    }
    const res = await run(() => authedApi('/admin/may/config', { method: 'PUT', body }))
    if (res) setSaved(true)
  }

  return (
    <section>
      <PageHead title={S.may.title} />
      {usage && <Usage usage={usage} />}
      <form className="form admin-form" onSubmit={onSubmit} noValidate>
        <label className="checkbox">
          <input type="checkbox" checked={form.openaiEnabled} onChange={(e) => set({ openaiEnabled: e.target.checked })} />
          {S.may.openai}
        </label>
        <p className="field-hint">{S.may.openaiHint}</p>
        {fields.openaiEnabled && <span className="field-error">{t(`errors.${fields.openaiEnabled}`)}</span>}
        <Field
          label={S.may.budget}
          type="number"
          min="0"
          step="1"
          value={form.monthlyBudgetUsd}
          onChange={(e) => set({ monthlyBudgetUsd: e.target.value })}
          error={fields.monthlyBudgetUsd}
          hint={S.may.budgetHint}
        />
        <I18nInput label={S.may.channel} value={form.supportChannel} onChange={(v) => set({ supportChannel: v })} error={fields.supportChannel} />
        <p className="field-hint">{S.may.channelHint}</p>
        <fieldset className="i18n-input">
          <legend>{S.may.limits}</legend>
          <div className="admin-grid">
            {LIMITS.map((k) => (
              <Field
                key={k}
                label={S.may[k]}
                type="number"
                min="0"
                value={form.limits[k]}
                onChange={(e) => set({ limits: { ...form.limits, [k]: e.target.value } })}
              />
            ))}
          </div>
          {fields.limits && <span className="field-error">{t(`errors.${fields.limits}`)}</span>}
        </fieldset>
        <fieldset className="i18n-input">
          <legend>{S.may.messages}</legend>
          {GROUPS.map((g) => (
            <div key={g} className="may-group">
              <strong>{S.may.groups[g]}</strong>
              {LANGS.map((l) => (
                <label key={l} className="i18n-row">
                  <span className="i18n-lang">{l.toUpperCase()}</span>
                  <textarea
                    rows={2}
                    aria-label={`${S.may.groups[g]} — ${S.common.langs[l]}`}
                    value={form.lines[g][l]}
                    onChange={(e) => set({ lines: { ...form.lines, [g]: { ...form.lines[g], [l]: e.target.value } } })}
                  />
                </label>
              ))}
            </div>
          ))}
          {fields.messages && <span className="field-error">{t(`errors.${fields.messages}`)}</span>}
        </fieldset>
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
    </section>
  )
}
