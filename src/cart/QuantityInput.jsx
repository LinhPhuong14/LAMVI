import { useI18n } from '../i18n/index.js'
import { MAX_QTY } from './context.js'

// Chọn số lượng 1..10 (D-60)
export default function QuantityInput({ value, onChange, disabled = false, label }) {
  const { t } = useI18n()
  const set = (v) => onChange(Math.max(1, Math.min(MAX_QTY, v)))
  return (
    <span className="qty" role="group" aria-label={label ?? t('cart.quantity')}>
      <button type="button" onClick={() => set(value - 1)} disabled={disabled || value <= 1} aria-label={t('cart.decrease')}>
        −
      </button>
      <input
        type="number"
        min="1"
        max={MAX_QTY}
        value={value}
        disabled={disabled}
        aria-label={label ?? t('cart.quantity')}
        onChange={(e) => {
          const v = Number.parseInt(e.target.value, 10)
          if (Number.isInteger(v)) set(v)
        }}
      />
      <button type="button" onClick={() => set(value + 1)} disabled={disabled || value >= MAX_QTY} aria-label={t('cart.increase')}>
        +
      </button>
    </span>
  )
}
