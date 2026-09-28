import { useI18n } from '../i18n/index.js'

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

const formatVnd = (amount) => vnd.format(amount)

// BR-PRC-003: mọi nơi hiển thị giá phải có chú thích "chưa gồm VAT"
export default function Price({ amount, className = 'product-price' }) {
  const { t } = useI18n()
  return (
    <span className="price">
      <span className={className}>{formatVnd(amount)}</span>
      <small className="price-note">{t('price.exclVat')}</small>
    </span>
  )
}
