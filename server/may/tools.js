import { localePath } from '../i18n.js'
import { HttpError } from '../errors.js'
import { getPublicProduct, listPublicFaq, listPublicProducts } from '../services/catalog.js'

// D-29, BR-AI-001: danh sách hàm backend duy nhất Mây được gọi. Chỉ đọc (BR-AI-006).
// Chưa có: get_policy (chưa có nội dung chính sách — G-10), get_my_orders / lookup_order (chưa có đơn — FR-AI-004).
export const MAY_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_products',
      description: 'Danh sách sản phẩm đang bán: tên, mô tả, giá bán đã gồm VAT (VND), đường dẫn.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product',
      description: 'Chi tiết một sản phẩm theo slug (lấy slug từ get_products).',
      parameters: {
        type: 'object',
        properties: { slug: { type: 'string' } },
        required: ['slug'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_faq',
      description: 'Các câu hỏi thường gặp và câu trả lời chính thức (lưu giữ lời chúc, sửa lời chúc, vận chuyển, thời gian làm đèn…).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]

// Chỉ trả trường cần cho câu trả lời (NFR-PRV-001)
const productForMay = (p, lang) => ({
  slug: p.slug,
  name: p.name,
  kind: p.kind,
  description: p.description,
  price: p.price,
  currency: 'VND',
  priceNote: 'excl. VAT',
  url: localePath(lang, `/products/${encodeURIComponent(p.slug)}`),
})

export async function runTool(name, args, { repo, lang }) {
  switch (name) {
    case 'get_products': {
      const { items } = await listPublicProducts(repo, lang)
      return { products: items.map((p) => productForMay(p, lang)) }
    }
    case 'get_product': {
      try {
        const { item } = await getPublicProduct(repo, String(args?.slug ?? ''), lang)
        return { product: productForMay(item, lang) }
      } catch (err) {
        if (err instanceof HttpError && err.status === 404) return { error: 'not_found' }
        throw err
      }
    }
    case 'get_faq': {
      const { items } = await listPublicFaq(repo, lang)
      return { faq: items.map((f) => ({ question: f.question, answer: f.answer })) }
    }
    default:
      return { error: 'unknown_function' }
  }
}
