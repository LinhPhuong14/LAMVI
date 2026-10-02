import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import ProductImage from '../components/ProductImage.jsx'
import { formatVnd } from '../lib/money.js'
import { useI18n } from '../i18n/index.js'
import { useCart } from './context.js'

const SHOW_MS = 6000

// Tooltip xác nhận thêm vào giỏ: mở ngay dưới nút Giỏ hàng trên navbar (D-83), cạnh huy hiệu số lượng.
// Thay cho dòng "Đã thêm vào giỏ — Xem giỏ hàng" chen vào thẻ sản phẩm: không làm xô bố cục thẻ, nằm đúng chỗ khách
// sẽ tìm giỏ hàng, có ảnh + tên món để xác nhận đúng món, có đường tới giỏ ngay trong tầm tay.
// Tự ẩn sau 6 giây; rê chuột / focus vào thì dừng đếm; Esc để đóng; thêm món khác thì bong bóng làm mới.
export default function CartBubble() {
  const { t, path } = useI18n()
  const { cart, lastAdded, dismissAdded } = useCart()
  const [paused, setPaused] = useState(false)
  const item = lastAdded ? cart?.items.find((i) => i.slug === lastAdded.slug) : null
  const visible = Boolean(item)

  useEffect(() => {
    if (!visible || paused) return undefined
    const id = setTimeout(dismissAdded, SHOW_MS)
    return () => clearTimeout(id)
  }, [visible, paused, lastAdded?.id, dismissAdded])

  useEffect(() => {
    if (!visible) return undefined
    const onKey = (e) => e.key === 'Escape' && dismissAdded()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible, dismissAdded])

  if (!visible) return null
  const name = item.product.name

  return (
    <div
      className="cart-bubble"
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <button type="button" className="cart-bubble-close" onClick={dismissAdded} aria-label={t('cart.bubbleClose')}>
        ×
      </button>
      <div className="cart-bubble-body">
        <span className="cart-bubble-thumb">
          <ProductImage image={item.product.image} size={52} tone={item.product.tone ?? undefined} name={name} />
        </span>
        <div>
          <p className="cart-bubble-title">{t('cart.bubbleAdded', { name: `“${name}”` })}</p>
          <p className="cart-bubble-sum">{t('cart.bubbleSummary', { n: cart.itemCount, total: formatVnd(cart.subtotal) })}</p>
        </div>
      </div>
      <div className="cart-bubble-actions">
        <Link to={path('/cart')} className="btn btn-small btn-primary" onClick={dismissAdded}>
          {t('cart.view')}
        </Link>
        <button type="button" className="btn btn-small btn-ghost" onClick={dismissAdded}>
          {t('cart.keepBrowsing')}
        </button>
      </div>
      {/* Thanh đếm ngược mảnh; dừng khi rê chuột */}
      <span
        key={lastAdded.id}
        className="cart-bubble-timer"
        aria-hidden="true"
        style={{ animationDuration: `${SHOW_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }}
      />
    </div>
  )
}
