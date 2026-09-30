import { useI18n } from '../i18n/index.js'

// §16: mốc hiển thị cho khách. delivery_failed và cancelled nằm ngoài dòng chảy chính.
const FLOW = ['confirmed', 'in_production', 'packed', 'shipped', 'delivered']

/** Nhãn trạng thái đơn. */
export function StatusBadge({ status }) {
  const { t } = useI18n()
  return <span className={`order-status order-status-${status}`}>{t(`orders.statuses.${status}`)}</span>
}

/** Thanh tiến độ 4 công đoạn + đã giao (C-11). Đơn chờ thanh toán/huỷ không hiện. */
export default function OrderProgress({ status }) {
  const { t } = useI18n()
  const at = FLOW.indexOf(status)
  if (at < 0) return null
  return (
    <ol className="order-flow">
      {FLOW.map((s, i) => (
        <li key={s} className={i <= at ? 'is-done' : ''} aria-current={i === at ? 'step' : undefined}>
          <span className="order-flow-dot" aria-hidden="true" />
          {t(`orders.statuses.${s}`)}
        </li>
      ))}
    </ol>
  )
}
