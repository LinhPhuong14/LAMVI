import { useI18n } from '../i18n/index.js'
import { formatVnd } from '../lib/money.js'

// BR-PRC-003 (D-68): giá niêm yết là giá đã gồm VAT; mọi nơi hiển thị giá đều ghi rõ điều đó
export default function Price({ amount, className = 'product-price' }) {
  const { t } = useI18n()
  return (
    <span className="price">
      <span className={className}>{formatVnd(amount)}</span>
      <small className="price-note">{t('price.inclVat')}</small>
    </span>
  )
}
