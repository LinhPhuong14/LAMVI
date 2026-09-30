import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { useCart } from './context.js'
import { track } from '../analytics/index.js'

// Nút thêm vào giỏ (thẻ sản phẩm + trang chi tiết)
export default function AddToCart({ slug, quantity = 1, label, className = 'btn btn-small', showLink = true }) {
  const { t, path } = useI18n()
  const { add, error } = useCart()
  const [state, setState] = useState(null) // null | 'pending' | 'added' | 'error'

  async function onClick() {
    setState('pending')
    const ok = await add(slug, quantity)
    setState(ok ? 'added' : 'error')
    // FR-GA-001 §23.3 — chỉ gửi khi thêm thành công
    if (ok) track('add_to_cart', { item_id: slug, quantity, currency: 'VND' })
  }

  return (
    <span className="add-to-cart">
      <button type="button" className={className} onClick={onClick} disabled={state === 'pending'}>
        {label ?? t('cart.add')}
      </button>
      <span role="status" className="add-to-cart-status">
        {state === 'added' && (
          <>
            {t('cart.added')}{' '}
            {showLink && <Link to={path('/cart')}>{t('cart.view')}</Link>}
          </>
        )}
        {state === 'error' && <span className="field-error">{t(`errors.${error ?? 'INTERNAL_ERROR'}`)}</span>}
      </span>
    </span>
  )
}
