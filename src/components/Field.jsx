import { useId, useState } from 'react'
import { useI18n } from '../i18n/index.js'

// Trường form; error là mã lỗi (vd INVALID_EMAIL) — dịch qua errors.*
export default function Field({ label, error, hint, as = 'input', toggle = false, children, ...props }) {
  const id = useId()
  const [shown, setShown] = useState(false)
  const { t } = useI18n()
  const Tag = as
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {toggle ? (
        // Ô mật khẩu có nút hiện/ẩn (D-82)
        <div className="field-pw">
          <Tag id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props} type={shown ? 'text' : 'password'} />
          <button type="button" className="field-pw-toggle" aria-pressed={shown} onClick={() => setShown(!shown)}>
            {shown ? t('auth.hide') : t('auth.show')}
          </button>
        </div>
      ) : (
        <Tag id={id} aria-invalid={error ? 'true' : undefined} aria-describedby={describedBy} {...props}>
          {children}
        </Tag>
      )}
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
