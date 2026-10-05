import { Link } from 'react-router-dom'
import { TiltCard } from './Effects'
import { Seal } from './Motifs'
import Price from './Price'
import ProductImage from './ProductImage'
import { Reveal } from './Reveal'
import { group, stamp } from '../lib/motion.js'
import { useI18n } from '../i18n/index.js'
import AddToCart from '../cart/AddToCart.jsx'

// Lưới thẻ sản phẩm dùng chung cho bộ sưu tập ở trang chủ và trang Cửa hàng (D-86).
// FR-CART-001; "Mua tặng/Mua cho mình" chọn ở bước thanh toán (FR-CHK-002, D-83).
export default function ProductCards({ items, className = '' }) {
  const { t, path } = useI18n()
  return (
    <Reveal className={`product-grid ${className}`.trim()} variants={group} margin="-8% 0px -8% 0px">
      {items.map((p, i) => (
        <TiltCard className={`product-card tone-${p.tone}`} key={p.slug} variants={stamp} custom={i}>
          {p.badge && <Seal className="product-badge lift">{p.badge}</Seal>}
          <div className="product-art worn">
            <div className="lift">
              <ProductImage image={p.image} size={112} tone={p.tone} name={p.name} swing />
            </div>
          </div>
          <div className="product-body">
            <h3>
              <Link to={path(`/products/${p.slug}`)} className="product-link">
                {p.name}
              </Link>
            </h3>
            <p className="product-desc">{p.description}</p>
            {p.stockLeft != null && <p className="stock-left">{t('cart.lowStock', { n: p.stockLeft })}</p>}
            <div className="product-foot">
              <Price amount={p.price} />
              <AddToCart slug={p.slug} soldOut={p.inStock === false} />
            </div>
          </div>
        </TiltCard>
      ))}
    </Reveal>
  )
}
