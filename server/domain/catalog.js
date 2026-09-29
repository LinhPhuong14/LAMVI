import { pick } from '../i18n.js'

// D-39: chỉ sản phẩm Published được hiển thị và bán; Hidden/Draft coi như không tồn tại với khách
export const PUBLIC_PRODUCT_STATUSES = ['published']

export function presentProduct(p, lang) {
  return {
    slug: p.slug,
    kind: p.kind,
    name: pick(p.name, lang),
    description: pick(p.description, lang),
    badge: pick(p.badge, lang),
    tone: p.tone,
    // D-68 / T-09: giá niêm yết ĐÃ gồm VAT, số nguyên VND
    price: p.price,
    currency: 'VND',
  }
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
