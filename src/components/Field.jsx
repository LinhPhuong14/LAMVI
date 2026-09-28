import { useId } from 'react'
import { useI18n } from '../i18n/index.js'

// Trường form; error là mã lỗi (vd INVALID_EMAIL) — dịch qua errors.*
export default function Field({ label, error, hint, as = 'input', children, ...props }) {
  const id = useId()
  const { t } = useI18n()
  const Tag = as
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <Tag id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>
        {children}
      </Tag>
      {error ? (
        <span id={`${id}-err`} className="field-error">
          {t(`errors.${error}`)}
        </span>
      ) : (
        hint && (
          <span id={`${id}-hint`} className="field-hint">
            {hint}
          </span>
        )
      )}
    </div>
  )
}
