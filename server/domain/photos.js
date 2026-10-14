import { pick } from '../i18n.js'

// Ảnh 5 đèn của bộ sưu tập đầu tiên lấy từ fanpage chính thức của LAMVI (G-116, public/images/lamps/CREDITS.md).
// Chỉ là ảnh MẶC ĐỊNH khi admin chưa tải ảnh riêng cho sản phẩm; ảnh admin tải lên luôn được ưu tiên.
const LAMP_PHOTOS = {
  'den-thu-hoach': 'thu-hoach',
  'den-tu-linh': 'tu-linh',
  'den-phuc-loc-song-toan': 'phuc-loc-song-toan',
  'den-ga-tam-duong-khai-thai': 'tam-duong-khai-thai',
  'den-lon-dan': 'lon-dan',
}

export function lampPhotoUrl(slug) {
  const f = Object.hasOwn(LAMP_PHOTOS, slug) ? LAMP_PHOTOS[slug] : null
  return f ? `/images/lamps/${f}.jpg` : null
}

export function lampCutoutUrl(slug) {
  const f = Object.hasOwn(LAMP_PHOTOS, slug) ? LAMP_PHOTOS[slug] : null
  return f ? `/images/lamps/${f}-cutout.webp` : null
}

/**
 * Ảnh hiển thị của sản phẩm: ảnh admin tải lên → ảnh fanpage mặc định (kèm `cutout` — đèn đã tách nền, để
 * giữ quầng sáng/hiệu ứng ở thẻ nhỏ; D-107) → null (frontend vẽ hình minh hoạ).
 */
export function productImage(p, lang) {
  if (p.imageUrl) return { url: p.imageUrl, alt: pick(p.imageAlt, lang) }
  const url = lampPhotoUrl(p.slug)
  return url ? { url, alt: pick(p.name, lang), cutout: lampCutoutUrl(p.slug) } : null
}
