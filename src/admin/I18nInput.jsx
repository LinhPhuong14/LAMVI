import { useId } from 'react'
import { useI18n } from '../i18n/index.js'
import { S } from './strings.js'

const LANGS = ['vi', 'en', 'zh']

// Nhập văn bản đa ngôn ngữ {vi, en, zh} (T-06)
export default function I18nInput({ label, value, onChange, error, multiline = false, required = false }) {
  const id = useId()
  const { t } = useI18n()
  const v = value ?? {}
  const Tag = multiline ? 'textarea' : 'input'
  return (
    <fieldset className="i18n-input" aria-invalid={error ? 'true' : undefined}>
      <legend>
        {label}
        {required && ' *'}
      </legend>
      {LANGS.map((l) => (
        <label key={l} htmlFor={`${id}-${l}`} className="i18n-row">
          <span className="i18n-lang">{l.toUpperCase()}</span>
          <Tag
            id={`${id}-${l}`}
            aria-label={`${label} — ${S.common.langs[l]}`}
            value={v[l] ?? ''}
            rows={multiline ? 3 : undefined}
            onChange={(e) => onChange({ ...v, [l]: e.target.value })}
          />
        </label>
      ))}
      {error && <span className="field-error">{t(`errors.${error}`)}</span>}
    </fieldset>
  )
}
