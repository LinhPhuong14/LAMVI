import { useApi } from '../api/useApi.js'
import { useI18n } from '../i18n/index.js'
import { formatVnd } from '../lib/money.js'

// Phí ship công khai ngay từ trang sản phẩm/giỏ hàng (feedback 08/10, 7.1). Lỗi tải → không hiện gì.
export default function ShippingNote({ className = 'field-hint' }) {
  const { t, lang } = useI18n()
  const res = useApi('/shipping-policy', lang)
  if (res.status !== 'ok') return null
  const { fee, freeFrom } = res.data
  if (!(fee > 0)) return <p className={className}>{t('shippingNote.free')}</p>
  if (!(freeFrom > 0)) return <p className={className}>{t('shippingNote.flat', { fee: formatVnd(fee) })}</p>
  return <p className={className}>{t('shippingNote.tiered', { fee: formatVnd(fee), from: formatVnd(freeFrom) })}</p>
}
