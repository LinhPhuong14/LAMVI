import { localePath } from '../i18n.js'
import { phoneKey } from './guard.js'
import { HttpError } from '../errors.js'
import { getPublicProduct, listPublicFaq, listPublicProducts } from '../services/catalog.js'

// D-29, BR-AI-001: danh sách hàm backend duy nhất Mây được gọi. Chỉ đọc (BR-AI-006).
// Chưa có: get_policy (chưa có nội dung chính sách — G-10).
// FR-AI-004, BR-AI-002: get_my_orders / lookup_order chỉ trả đơn của người đã xác thực, không trả địa chỉ, SĐT.
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
  {
    type: 'function',
    function: {
      name: 'get_my_orders',
      description: 'Các đơn gần đây của khách đang đăng nhập: mã đơn, trạng thái, thanh toán, sản phẩm, tổng tiền. Chỉ dùng được khi khách đã đăng nhập.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function',
    function: {
      name: 'lookup_order',
      description: 'Tra một đơn theo mã đơn (dạng LV2610-XXXXXXX). Khách đăng nhập chỉ tra được đơn của mình; khách chưa đăng nhập phải đã đưa số điện thoại người nhận trong chat (server tự đối chiếu, đừng hỏi lại SĐT trong tham số).',
      parameters: {
        type: 'object',
        properties: { code: { type: 'string' } },
        required: ['code'],
        additionalProperties: false,
      },
    },
  },
]

// BR-AI-002, chống dò mã đơn: số lần tra tối đa mỗi giờ cho mỗi tài khoản / IP
export const LOOKUP_MAX_PER_HOUR = 8
const LOOKUP_WINDOW_SEC = 3600
const ORDER_CODE_RE = /^LV\d{4}-[A-Z0-9]{7}$/

// Chỉ trả trường cần cho câu trả lời (NFR-PRV-001)
const productForMay = (p, lang) => ({
  slug: p.slug,
  name: p.name,
  kind: p.kind,
  description: p.description,
  price: p.price,
  currency: 'VND',
  priceNote: 'VAT included (D-68)',
  url: localePath(lang, `/products/${encodeURIComponent(p.slug)}`),
})

// NFR-PRV-001, AC-004: không địa chỉ, không SĐT, không người nhận
function orderForMay(o, lang, now) {
  const pick = (v) => (v && typeof v === 'object' ? (v[lang] ?? v.vi ?? null) : (v ?? null))
  // BR-PAY-003: đơn payOS quá hạn thanh toán coi như đã huỷ, kể cả khi cron chưa quét
  const expired = o.status === 'pending_payment' && o.paymentExpiresAt && Date.parse(o.paymentExpiresAt) <= now
  return {
    code: o.code,
    status: expired ? 'cancelled' : o.status,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    total: o.total,
    currency: 'VND',
    createdAt: o.createdAt,
    items: (o.items ?? []).map((i) => ({ name: pick(i.name), quantity: i.quantity })),
  }
}

// Tra đơn: mọi trường hợp không xác thực được đều trả cùng một kết quả `not_found`
async function lookupOrder(args, { repo, lang, user, phones = [], failKey, now }) {
  const code = typeof args?.code === 'string' ? args.code.trim().toUpperCase() : ''
  if (!user && !phones.length) return { error: 'need_phone' }
  if (failKey && (await repo.incrementMayCounter(`lkp:${failKey}`, LOOKUP_WINDOW_SEC, now)) > LOOKUP_MAX_PER_HOUR) {
    return { error: 'too_many_attempts' }
  }
  const order = ORDER_CODE_RE.test(code) ? await repo.getOrderByCode(code) : null
  const ok = order && (user ? order.userId === user.id : phones.includes(phoneKey(order.recipientPhone)))
  return ok ? { order: orderForMay(order, lang, now) } : { error: 'not_found' }
}

export async function runTool(name, args, { repo, lang, user = null, phones = [], failKey = null, now = Date.now() }) {
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
    case 'get_my_orders': {
      if (!user) return { error: 'login_required' }
      const list = await repo.listOrdersByUser(user.id, { limit: 5 })
      return { orders: list.map((o) => orderForMay(o, lang, now)) }
    }
    case 'lookup_order':
      return lookupOrder(args, { repo, lang, user, phones, failKey, now })
    default:
      return { error: 'unknown_function' }
  }
}
