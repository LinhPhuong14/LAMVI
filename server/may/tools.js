import { localePath } from '../i18n.js'
import { phoneKey } from './guard.js'
import { HttpError } from '../errors.js'
import { getPublicProduct, listPublicFaq, listPublicProducts } from '../services/catalog.js'
import { getShippingPolicy } from '../services/site.js'

// D-29, BR-AI-001: danh sách hàm backend duy nhất Mây được gọi. Chỉ đọc (BR-AI-006).
// get_policies: chính sách giao hàng/thanh toán/đổi trả/cách đặt hàng (trang /shipping, /payment, /returns).
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
      name: 'get_policies',
      description: 'Chính sách chính thức: phí và phạm vi giao hàng, hình thức thanh toán, đổi trả, huỷ đơn, các bước đặt hàng, liên hệ. Gọi khi khách hỏi ship, phí vận chuyển, thanh toán, đổi trả, cách đặt hàng.',
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
  // Thông số do admin nhập (kích thước, chất liệu, nguồn sáng…); thiếu thì Mây phải nói chưa có thông tin
  specs: p.specs ?? {},
  // G-108: câu chuyện/ý nghĩa artwork do admin nhập — nguồn duy nhất để Mây nói về ý nghĩa tranh
  story: p.story ? String(p.story).slice(0, 1500) : null,
  price: p.price,
  currency: 'VND',
  priceNote: 'VAT included (D-68)',
  inStock: p.inStock !== false,
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

// Sự thật về chính sách, lấy từ cùng nguồn với trang /shipping, /payment, /returns. Mọi con số Mây được nói đều phải
// nằm ở đây (BR-AI-003). Không hứa ngày giao cụ thể (prompt cấm).
async function policies(repo, { payosEnabled = false, returnsEnabled = false, contact = '' } = {}) {
  const { fee, freeFrom } = await getShippingPolicy(repo)
  return {
    delivery: {
      scope: 'Giao toàn quốc Việt Nam',
      flatFeeVnd: fee,
      freeShippingFromVnd: freeFrom,
      note: 'Phí vận chuyển đồng giá toàn quốc; miễn phí khi tổng tiền hàng tạm tính từ mức freeShippingFromVnd (bằng 0 nghĩa là không có mức miễn phí). LAMVI chưa cam kết thời gian giao cụ thể — không hứa ngày giao.',
    },
    payment: {
      methods: payosEnabled ? ['Thanh toán khi nhận hàng (COD)', 'Chuyển khoản / quét mã (payOS)'] : ['Thanh toán khi nhận hàng (COD)'],
      note: payosEnabled
        ? 'Đơn giao cho người khác phải thanh toán online.'
        : 'Hiện chỉ nhận thanh toán khi nhận hàng (COD): trả tiền mặt cho người giao hàng, không cần thanh toán trước, kể cả đơn tặng giao cho người khác. Chưa có thanh toán online.',
    },
    returns: {
      windowDays: 7,
      note: 'Trong 7 ngày kể từ khi đơn giao thành công. Chấp nhận khi lỗi sản xuất, vỡ/hỏng khi vận chuyển, giao sai hàng; không nhận đổi vì đổi ý (đặc biệt đèn có lời chúc cá nhân hoá). Kết quả: đổi sản phẩm hoặc hoàn tiền. Cần video khui hàng liên tục.',
      requestOnline: returnsEnabled ? 'Gửi yêu cầu ở trang chi tiết đơn hàng trong Tài khoản.' : 'Gửi yêu cầu qua trang Liên hệ hoặc email của cửa hàng.',
    },
    cancellation: 'Khách huỷ được đơn trước khi đơn được gửi đi (khi đơn còn ở bước chuẩn bị). Từ khi đã gửi đi thì không huỷ được.',
    orderingSteps: [
      'Chọn đèn trên trang Cửa hàng rồi bấm Thêm vào giỏ.',
      'Đăng nhập hoặc tạo tài khoản (bắt buộc để đặt hàng).',
      'Vào Giỏ hàng, bấm thanh toán: chọn Mua tặng hay Mua cho mình, nhập người nhận và địa chỉ, chọn hình thức thanh toán.',
      'Có thể thêm lời chúc (chữ, giọng nói hoặc video) gắn mã QR trên thiệp cảm ơn; soạn hoặc sửa lời chúc sau khi đặt, đến khi đèn được đóng gói.',
      'Theo dõi đơn trong Tài khoản, mục Đơn hàng.',
    ],
    contact: contact || null,
  }
}

export async function runTool(name, args, { repo, lang, user = null, phones = [], failKey = null, now = Date.now(), facts = {} }) {
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
    case 'get_policies':
      return policies(repo, facts)
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
