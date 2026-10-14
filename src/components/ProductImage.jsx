import Lantern from './Lantern.jsx'

/**
 * Ảnh sản phẩm (G-23). Có ảnh thật thì dùng ảnh, chưa có thì vẽ hình minh hoạ đèn (G-33 —
 * hình minh hoạ không được trình bày như ảnh tư liệu, xem design-rules §7).
 *
 * @param {object} p
 * @param {{url: string, alt: string|null}|null} [p.image]
 * @param {number} p.size cạnh của khung vuông (px)
 * @param {string} [p.tone] tông màu cho hình minh hoạ
 * @param {string} [p.name] tên sản phẩm — dùng làm alt dự phòng khi chưa đặt chú thích ảnh
 * @param {boolean} [p.cutout] ưu tiên bản đèn đã tách nền `image.cutout` (thẻ nhỏ), không có thì ảnh thường
 * @param {boolean} [p.fill] ảnh thật phủ kín khung cha (trang chi tiết); hình minh hoạ vẫn theo `size`
 * @param {boolean} [p.priority] ảnh ở màn hình đầu (không lazy-load, tránh chậm LCP)
 */
export default function ProductImage({ image, size, tone = 'amber', name, priority = false, swing = false, fill = false, cutout = false }) {
  // Thẻ nhỏ: đèn đã tách nền (chỉ có với ảnh mặc định từ fanpage) đặt trên nền màu + quầng sáng; `size` là cạnh khung nên đèn cao ~1,35×
  if (cutout && image?.cutout) {
    const h = Math.round(size * 1.35)
    return <img className="lamp-cutout product-cutout" src={image.cutout} alt={image.alt ?? name ?? ''} width={Math.round(h * 0.44)} height={h} loading={priority ? 'eager' : 'lazy'} decoding="async" />
  }
  if (!image?.url) return <Lantern size={size} tone={tone} swing={swing} />
  return (
    <img
      className="product-photo"
      src={image.url}
      // alt rỗng khi không có chú thích và cũng không có tên → ảnh trang trí, trình đọc bỏ qua
      alt={image.alt ?? name ?? ''}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      // Ảnh vuông, cắt theo khung (CSS object-fit) để lưới sản phẩm không bị lệch
      style={fill ? { width: '100%', height: 'auto', aspectRatio: '1' } : { width: size, height: size }}
    />
  )
}
