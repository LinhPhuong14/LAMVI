import { pick } from '../i18n.js'
import { presentStock } from './stock.js'
import { productImage } from './photos.js'

// D-39: chỉ sản phẩm Published được hiển thị và bán; Hidden/Draft coi như không tồn tại với khách
export const PUBLIC_PRODUCT_STATUSES = ['published']

// withStory: câu chuyện dài (G-108) chỉ nằm ở trang chi tiết — không đưa vào danh sách/giỏ/đơn cho nhẹ payload
export function presentProduct(p, lang, { withStory = false } = {}) {
  return {
    slug: p.slug,
    kind: p.kind,
    name: pick(p.name, lang),
    description: pick(p.description, lang),
    badge: pick(p.badge, lang),
    tone: p.tone,
    // D-96: thuộc bộ sưu tập nào (null = đèn lẻ)
    collection: p.collectionSlug ?? null,
    pieceOrder: p.pieceOrder ?? 0,
    // D-100: tồn kho (inStock=false → "tạm hết hàng"; stockLeft chỉ có khi sắp hết)
    ...presentStock(p),
    // Thông số (feedback 08/10, mục 8): chỉ trả khoá có nội dung, đã chọn ngôn ngữ
    specs: presentSpecs(p.specs, lang),
    ...(withStory ? { story: pick(p.story, lang) || null } : {}),
    // D-68 / T-09: giá niêm yết ĐÃ gồm VAT, số nguyên VND
    price: p.price,
    currency: 'VND',
    // G-23: ảnh thật của sản phẩm; chưa có thì frontend dùng hình minh hoạ SVG (G-33)
    image: productImage(p, lang),
  }
}

export function presentSpecs(specs, lang) {
  if (!specs || typeof specs !== 'object') return {}
  const out = {}
  for (const [k, v] of Object.entries(specs)) {
    const text = pick(v, lang)
    if (text) out[k] = text
  }
  return out
}

export function presentFaq(f, lang) {
  return { id: f.id, question: pick(f.question, lang), answer: pick(f.answer, lang) }
}

// Lô chỉ công khai khi video đã xuất bản [ASSUMPTION] (ba-spec §21.6)
export function isBatchPublic(b) {
  return b.status === 'video_published' && Boolean(b.videoUrl)
}

export function presentBatch(b, lang) {
  return {
    code: b.code,
    title: pick(b.title, lang),
    story: pick(b.story, lang),
    videoUrl: b.videoUrl,
    producedOn: b.producedOn,
  }
}

// D-96: bộ sưu tập công khai. `story` là phần thưởng (D-97) — không bao giờ nằm trong dữ liệu công khai.
export function presentCollection(c, products, lang) {
  const mine = products
    .filter((p) => p.collection === c.slug)
    .sort((a, b) => a.pieceOrder - b.pieceOrder)
  return {
    slug: c.slug,
    name: pick(c.name, lang),
    description: pick(c.description, lang),
    tone: c.tone,
    lamps: mine.filter((p) => p.kind === 'single'),
    set: mine.find((p) => p.kind === 'set') ?? null,
  }
}
