import { useEffect, useRef, useState } from 'react'
import { useI18n } from '../i18n/index.js'
import { useCart } from './context.js'
import { track } from '../analytics/index.js'

// Nút thêm vào giỏ (thẻ sản phẩm + trang chi tiết).
// Phản hồi thành công do bong bóng của Mây (CartBubble) đảm nhận; ở đây chỉ đổi nhãn nút "✓ Đã thêm" ngắn
// và báo lỗi tại chỗ. Không còn link "Xem giỏ hàng" chen vào thẻ sản phẩm (D-83).
// G-44, D-100: soldOut → nút khoá "Tạm hết hàng"
export default function AddToCart({ slug, quantity = 1, label, className = 'btn btn-small', soldOut = false }) {
  const { t } = useI18n()
  const { add, error } = useCart()
  const [state, setState] = useState(null) // null | 'pending' | 'added' | 'error'
  const timer = useRef(null)
  useEffect(() => () => clearTimeout(timer.current), [])

  if (soldOut) {
    return (
      <span className="add-to-cart">
        <button type="button" className={className} disabled>
          {t('cart.soldOut')}
        </button>
      </span>
    )
  }

  async function onClick() {
    clearTimeout(timer.current)
    setState('pending')
    const ok = await add(slug, quantity)
    setState(ok ? 'added' : 'error')
    if (ok) timer.current = setTimeout(() => setState(null), 1800)
    // FR-GA-001 §23.3 — chỉ gửi khi thêm thành công
    if (ok) track('add_to_cart', { item_id: slug, quantity, currency: 'VND' })
  }

  return (
    <span className="add-to-cart">
      <button
        type="button"
        className={`${className}${state === 'added' ? ' is-added' : ''}`}
        onClick={onClick}
        disabled={state === 'pending'}
      >
        {state === 'added' ? `✓ ${t('cart.addedShort')}` : (label ?? t('cart.add'))}
      </button>
      {/* Vùng thông báo cho trình đọc màn hình; nội dung chi tiết nằm ở bong bóng của Mây */}
      <span role="status" className="add-to-cart-status">
        {state === 'error' && <span className="field-error">{t(`errors.${error ?? 'INTERNAL_ERROR'}`)}</span>}
      </span>
    </span>
  )
}
