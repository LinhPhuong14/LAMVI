// Checkout, đơn hàng và thanh toán (§12, §15, §16). Server là nơi duy nhất tính tiền (BR-PRC-001).
import { createHash, randomBytes } from 'node:crypto'
import { HttpError } from '../errors.js'
import { PUBLIC_PRODUCT_STATUSES, presentProduct } from '../domain/catalog.js'
import { hasStock } from '../domain/stock.js'
import { PRICING_SETTING_KEY, normalizePricingConfig, quoteOrder } from '../domain/pricing.js'
import { couponRejectReason, normalizeCouponCode, toPricingCoupon } from '../domain/coupon.js'
import {
  canAdminMove,
  canCustomerCancel,
  generateOrderCode,
  generatePayosOrderCode,
} from '../domain/order.js'

// D-73 (Q-15): hạn link thanh toán payOS
export const PAYMENT_WINDOW_MS = 15 * 60 * 1000

// Mã lỗi coupon → thông báo cho khách nằm ở i18n (errors.*)
const COUPON_ERRORS = new Set([
  'COUPON_NOT_FOUND',
  'COUPON_INACTIVE',
  'COUPON_NOT_STARTED',
  'COUPON_EXPIRED',
  'COUPON_USED_UP',
  'COUPON_USER_LIMIT',
  'COUPON_MIN_ORDER',
  'COUPON_NOT_APPLICABLE',
])

export function createOrderService({ repo, payos = null, now = () => new Date(), notify = async () => false }) {
  const isPublic = (p) => PUBLIC_PRODUCT_STATUSES.includes(p.status)

  async function pricingConfig() {
    const setting = await repo.getSetting(PRICING_SETTING_KEY)
    return normalizePricingConfig(setting?.value)
  }

  /** Dòng hàng từ giỏ của khách; sản phẩm đã ẩn/xoá thì không cho đặt (D-39). */
  async function cartLines(userId) {
    const cart = await repo.getCart(userId)
    const products = new Map((await repo.getProductsByIds(cart.map((item) => item.productId))).map((p) => [p.id, p]))
    const lines = []
    for (const { productId, quantity } of cart) {
      const product = products.get(productId)
      if (!product) continue
      // G-44: `short` = tồn kho không đủ cho số lượng trong giỏ (chỉ báo; giữ chỗ nguyên tử ở createOrder)
      lines.push({ product, quantity, available: isPublic(product), short: isPublic(product) && !hasStock(product, quantity) })
    }
    return lines
  }

  /**
   * Tìm và kiểm tra coupon. Trả { coupon, error }. Không ném lỗi để trang checkout hiện được
   * bảng giá kèm lý do coupon không dùng được.
   */
  async function resolveCoupon(code, { userId, subtotal, productIds }) {
    const normalized = normalizeCouponCode(code)
    if (!normalized) return { coupon: null, error: null }
    const coupon = await repo.getCouponByCode(normalized)
    const userUses = coupon ? await repo.countCouponUsesByUser(coupon.id, userId) : 0
    const reason = couponRejectReason(coupon, { subtotal, userUses, now: now(), productIds })
    return reason ? { coupon: null, error: reason } : { coupon, error: null }
  }

  /**
   * Bảng giá của giỏ hiện tại (FR-CHK-008). Dùng cho cả trang checkout và lúc tạo đơn —
   * một nguồn duy nhất nên số tiền khách thấy luôn bằng số tiền được ghi vào đơn.
   */
  async function quoteCart(userId, { couponCode, lang = 'vi' } = {}) {
    const lines = await cartLines(userId)
    const usable = lines.filter((l) => l.available)
    const config = await pricingConfig()
    const items = usable.map((l) => ({ productId: l.product.id, unitPrice: l.product.price, quantity: l.quantity }))
    const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0)
    const productIds = usable.map((l) => l.product.id)

    const { coupon, error: couponError } = await resolveCoupon(couponCode, { userId, subtotal, productIds })
    const quote = quoteOrder({ items, coupon: toPricingCoupon(coupon), config })

    return {
      quote,
      coupon,
      couponError,
      lines,
      hasUnavailable: lines.some((l) => !l.available),
      view: {
        items: usable.map((l) => {
          const p = presentProduct(l.product, lang)
          return { slug: p.slug, name: p.name, image: p.image, unitPrice: l.product.price, quantity: l.quantity, lineTotal: l.product.price * l.quantity }
        }),
        subtotal: quote.subtotal,
        discount: quote.discount,
        shippingFee: quote.shippingFee,
        freeShipping: quote.freeShipping,
        total: quote.total,
        vatAmount: quote.vatAmount,
        vatRate: quote.vatRate,
        currency: 'VND',
        couponCode: coupon?.code ?? null,
        couponError,
        hasUnavailable: lines.some((l) => !l.available),
        hasShortage: lines.some((l) => l.short),
        freeShippingFrom: config.freeShippingFrom,
      },
    }
  }

  const outOfStock = (product) =>
    new HttpError(409, 'OUT_OF_STOCK', 'Sản phẩm không đủ hàng', { slug: 'OUT_OF_STOCK' }, { slug: product?.slug ?? null })

  /** Mã đơn duy nhất; thử lại vài lần phòng khi trùng (xác suất rất thấp). */
  async function uniqueOrderCode() {
    for (let i = 0; i < 5; i += 1) {
      const code = generateOrderCode(now())
      if (!(await repo.getOrderByCode(code))) return code
    }
    throw new HttpError(500, 'INTERNAL_ERROR', 'Không sinh được mã đơn')
  }

  /**
   * Mã gửi payOS cũng là cột UNIQUE: trong cùng mili-giây chỉ có 1000 hậu tố ngẫu nhiên, nên vẫn
   * phải kiểm trùng như mã đơn hiển thị.
   */
  async function uniquePayosOrderCode(at) {
    for (let i = 0; i < 5; i += 1) {
      const code = generatePayosOrderCode(at)
      if (!(await repo.getOrderByPayosCode(code))) return code
    }
    throw new HttpError(500, 'INTERNAL_ERROR', 'Không sinh được mã thanh toán')
  }

  /**
   * Tạo đơn từ giỏ (§12 bước "Tạo đơn"). Kiểm tra lại giá và coupon ngay lúc tạo (BR-CPN-002):
   * khách xác nhận bảng giá nào thì phải ra đúng bảng giá đó, lệch thì trả 409 kèm bảng giá mới.
   */
  // Hash normalized business inputs, never client prices as authoritative pricing.
  // The key belongs to a user and survives the cart being consumed at commit.
  async function createOrder(args) {
    const { userId, checkout, expectedTotal, idempotencyKey } = args
    if (idempotencyKey == null) return createOrderOnce(args)
    if (typeof idempotencyKey !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(idempotencyKey)) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', { idempotencyKey: 'INVALID' })
    }
    const key = idempotencyKey.toLowerCase()
    const business = Object.fromEntries(Object.keys(checkout).sort().filter((field) => !['province', 'ward', 'district'].includes(field)).map((field) => [field, checkout[field]]))
    business.couponCode = normalizeCouponCode(checkout.couponCode) || null
    const fingerprint = createHash('sha256').update(JSON.stringify({ checkout: business, expectedTotal: expectedTotal ?? null })).digest('hex')
    const replay = async () => {
      const existing = await repo.getOrderByCheckoutKey(userId, key)
      if (!existing) return null
      if (existing.checkoutFingerprint !== fingerprint) throw new HttpError(409, 'CHECKOUT_KEY_CONFLICT', 'Yêu cầu đặt hàng đã thay đổi')
      return { order: existing, payment: null, replayed: true }
    }
    const existing = await replay()
    if (existing) return existing
    try {
      return await createOrderOnce({ ...args, idempotencyKey: key, checkoutFingerprint: fingerprint })
    } catch (err) {
      // A concurrent request may have consumed the cart, or the RPC response may have
      // been lost AFTER commit. Read the durable key; never compensate stock/coupon.
      const committed = await replay().catch((lookupError) => {
        if (lookupError.code === 'CHECKOUT_KEY_CONFLICT') throw lookupError
        return null
      })
      if (committed) return committed
      throw err
    }
  }

  async function createOrderOnce({ userId, checkout, expectedTotal, lang = 'vi', siteUrl, idempotencyKey, checkoutFingerprint }) {
    // Replays do not depend on current gateway availability or create new links.
    if (checkout.paymentMethod === 'payos' && !payos) throw new HttpError(503, 'PAYMENT_UNAVAILABLE', 'Thanh toán trực tuyến chưa sẵn sàng')
    const { quote, coupon, couponError, lines } = await quoteCart(userId, { couponCode: checkout.couponCode, lang })

    if (!lines.length) throw new HttpError(409, 'CART_EMPTY', 'Giỏ hàng trống')
    if (lines.some((l) => !l.available)) {
      throw new HttpError(409, 'CART_HAS_UNAVAILABLE', 'Giỏ có sản phẩm không còn bán')
    }
    // G-44, D-100: báo sớm sản phẩm nào không đủ hàng (kiểm chính thức là giữ chỗ nguyên tử bên dưới)
    const shortLine = lines.find((l) => l.short)
    if (shortLine) throw outOfStock(shortLine.product)
    if (checkout.couponCode && couponError) throw new HttpError(409, couponError, 'Mã giảm giá không dùng được')
    // §12: giá đổi giữa chừng → hiện bảng giá mới, yêu cầu xác nhận lại (D-41)
    if (Number.isInteger(expectedTotal) && expectedTotal !== quote.total) {
      throw new HttpError(409, 'PRICE_CHANGED', 'Giá đã thay đổi', undefined, { quote: quote })
    }

    // Repository owns one transaction: stock, coupon, order and item snapshots.
    // Never compensate a failed RPC from the service: it may have committed before
    // the connection failed, and a second release would corrupt inventory.
    try {
      const isCod = checkout.paymentMethod === 'cod'
      const createdAt = now()
      const order = {
        code: await uniqueOrderCode(),
        checkoutIdempotencyKey: idempotencyKey ?? null,
        checkoutFingerprint: checkoutFingerprint ?? null,
        userId,
        // §16: đơn COD chuyển CONFIRMED ngay khi tạo (D-41)
        status: isCod ? 'confirmed' : 'pending_payment',
        ...checkout,
        paymentStatus: 'pending',
        paymentExpiresAt: isCod ? null : new Date(createdAt.getTime() + PAYMENT_WINDOW_MS).toISOString(),
        payosOrderCode: isCod ? null : await uniquePayosOrderCode(createdAt),
        subtotal: quote.subtotal,
        discount: quote.discount,
        shippingFee: quote.shippingFee,
        total: quote.total,
        vatAmount: quote.vatAmount,
        vatRate: quote.vatRate,
        couponId: coupon?.id ?? null,
        couponCode: coupon?.code ?? null,
        // BR-QR-001: token QR ngẫu nhiên 256 bit, không chứa dữ liệu đọc được
        qrToken: randomBytes(32).toString('hex'),
      }
      const items = lines.map(({ product, quantity }) => ({
        productId: product.id,
        slug: product.slug,
        name: product.name,
        unitPrice: product.price,
        quantity,
        lineTotal: product.price * quantity,
      }))

      const created = await repo.createOrder(
        order,
        items,
        coupon ? { couponId: coupon.id, userId, coupon } : null,
        { now: createdAt, fromCart: true },
      )

      if (created.checkoutReplayed) return { order: created, payment: null, replayed: true }

      // The repository consumed the cart in the same transaction.

      await audit({
        actorId: userId,
        actorRole: 'customer',
        entity: 'order',
        entityId: created.id,
        action: 'create',
        newValue: { code: created.code, status: created.status, total: created.total, couponCode: created.couponCode },
      })

      let payment = null
      if (!isCod) payment = await startPayosPayment(created, { siteUrl })
      // §20: đơn COD được xác nhận ngay (D-41) → báo luôn. Đơn payOS báo khi đã trả tiền (webhook).
      if (isCod) await notify('confirmed', created)
      return { order: created, payment }
    } catch (err) {
      if (err.code === 'CHECKOUT_KEY_CONFLICT') throw new HttpError(409, err.code, 'Yêu cầu đặt hàng đã thay đổi')
      if (err.code === 'OUT_OF_STOCK') throw outOfStock({ slug: err.field })
      if (err.code === 'CART_EMPTY' || err.code === 'CART_HAS_UNAVAILABLE' || COUPON_ERRORS.has(err.code)) {
        throw new HttpError(409, err.code, 'Giỏ hàng hoặc mã giảm giá vừa thay đổi')
      }
      if (err.code === 'PRICE_CHANGED') {
        const { view } = await quoteCart(userId, { couponCode: checkout.couponCode, lang })
        throw new HttpError(409, err.code, 'Giá đã thay đổi', undefined, { quote: view })
      }
      throw err
    }
  }

  /**
   * Lấy lại link thanh toán cho đơn đang chờ trả tiền (FR-PAY-001). Dùng khi lần tạo đơn gặp lỗi
   * cổng, hoặc khách đóng tab thanh toán rồi quay lại — nếu không có thì đơn kẹt tới lúc hết hạn.
   */
  async function paymentLinkFor(order, { siteUrl }) {
    const fresh = await expireIfDue(order)
    if (fresh.status !== 'pending_payment') throw new HttpError(409, 'ORDER_NOT_PAYABLE', 'Đơn không ở trạng thái chờ thanh toán')
    if (!payos) throw new HttpError(503, 'PAYMENT_UNAVAILABLE', 'Thanh toán trực tuyến chưa sẵn sàng')
    const payment = await startPayosPayment(fresh, { siteUrl })
    if (payment?.error) throw new HttpError(502, payment.error, 'Chưa tạo được liên kết thanh toán')
    return payment
  }

  /** Tạo link thanh toán payOS. Cổng lỗi không được làm mất đơn — đơn vẫn ở PENDING_PAYMENT. */
  async function startPayosPayment(order, { siteUrl }) {
    if (!payos) return null
    try {
      const link = await payos.createPaymentLink({
        orderCode: order.payosOrderCode,
        amount: order.total,
        // payOS giới hạn 25 ký tự cho mô tả
        description: order.code.slice(0, 25),
        returnUrl: `${siteUrl}/don-hang/${order.code}`,
        cancelUrl: `${siteUrl}/don-hang/${order.code}?huy=1`,
        expiredAt: Date.parse(order.paymentExpiresAt),
      })
      return { checkoutUrl: link.checkoutUrl, qrCode: link.qrCode, expiresAt: order.paymentExpiresAt }
    } catch (err) {
      console.error('[payos] không tạo được link thanh toán', err)
      return { error: 'PAYMENT_GATEWAY_ERROR', expiresAt: order.paymentExpiresAt }
    }
  }

  const audit = (entry) => repo.appendAuditLog([entry]).catch((err) => console.error('[audit]', err))

  /**
   * Xử lý webhook payOS đã xác minh chữ ký (BR-PAY-001/002). Idempotent theo mã giao dịch:
   * lần hai không đổi gì.
   */
  async function applyPayosWebhook({ orderCode, amount, paid, reference }, attempt = 0) {
    const retryChanged = () => {
      if (attempt >= 2) throw new HttpError(503, 'PAYMENT_RETRY_REQUIRED', 'Trạng thái thanh toán đang thay đổi; vui lòng thử lại')
      return applyPayosWebhook({ orderCode, amount, paid, reference }, attempt + 1)
    }
    const found = await repo.getOrderByPayosCode(orderCode)
    if (!found) return { handled: false, reason: 'ORDER_NOT_FOUND' }
    if (!paid) return { handled: false, reason: 'NOT_PAID' }
    // Quá hạn mà cron chưa chạy: huỷ trước rồi mới xử lý, để kết quả không phụ thuộc lịch chạy
    // (§15.1 — trả tiền sau khi đơn hết hạn thì gắn cờ hoàn tiền tay, dù cron đã chạy hay chưa)
    const order = await expireIfDue(found)
    // BR-PAY-002: đã ghi nhận rồi thì thôi
    if (['paid', 'refund_pending', 'refunded'].includes(order.paymentStatus)) return { handled: true, idempotent: true, order }

    // §15.1: số tiền lệch → không xác nhận đơn, gắn cờ cho admin
    if (amount !== order.total) {
      const flagged = await repo.updateOrderIfStatus(order.id, order.status, { paymentFlag: 'AMOUNT_MISMATCH' }, order.paymentStatus)
      if (!flagged) return retryChanged()
      await audit({
        actorRole: 'system',
        entity: 'order',
        entityId: order.id,
        action: 'payment_amount_mismatch',
        oldValue: { total: order.total },
        newValue: { amount, reference },
      })
      return { handled: false, reason: 'AMOUNT_MISMATCH' }
    }

    // §15.1: trả tiền sau khi đơn đã huỷ/hết hạn → ghi nhận PAID, gắn cờ hoàn tiền thủ công
    if (order.status === 'cancelled') {
      const recorded = await repo.updateOrderIfStatus(order.id, 'cancelled', { paymentStatus: 'paid', paymentFlag: 'PAID_AFTER_CANCEL' }, order.paymentStatus)
      if (!recorded) return retryChanged()
      await audit({
        actorRole: 'system',
        entity: 'order',
        entityId: order.id,
        action: 'paid_after_cancel',
        newValue: { amount, reference },
      })
      return { handled: true, reason: 'PAID_AFTER_CANCEL' }
    }

    // Khoá lạc quan: chỉ chuyển khi đơn vẫn đang chờ thanh toán
    const updated = await repo.updateOrderIfStatus(order.id, 'pending_payment', {
      status: 'confirmed',
      paymentStatus: 'paid',
      paymentExpiresAt: null,
      // Gỡ cờ lệch tiền của lần chuyển trước, nếu có — lần này đã đúng số tiền
      paymentFlag: null,
    })
    if (!updated) return retryChanged()
    await audit({
      actorRole: 'system',
      entity: 'order',
      entityId: order.id,
      action: 'status',
      oldValue: { status: 'pending_payment' },
      newValue: { status: 'confirmed', paymentStatus: 'paid', reference },
    })
    // Chỉ tới đây khi chuyển trạng thái thành công → webhook gửi lại không sinh thư thứ hai
    await notify('confirmed', updated)
    return { handled: true, order: updated }
  }

  /**
   * BR-PAY-003 cho MỘT đơn. Gọi khi khách xem đơn, để trạng thái hiển thị luôn đúng kể cả khi
   * cron chưa chạy (trên serverless không có tiến trình nền — xem deploy-vercel.md).
   */
  async function expireIfDue(order) {
    if (order.status !== 'pending_payment' || !order.paymentExpiresAt) return order
    if (Date.parse(order.paymentExpiresAt) > now().getTime()) return order
    return (await cancelExpired(order)) ?? (await repo.getOrderById(order.id)) ?? order
  }

  async function cancelExpired(order) {
    const updated = await repo.updateOrderIfStatus(order.id, 'pending_payment', {
      status: 'cancelled',
      paymentStatus: 'expired',
      cancelledAt: now().toISOString(),
      cancelReason: 'PAYMENT_EXPIRED',
    })
    if (!updated) return null
    if (payos && order.payosOrderCode) {
      await payos.cancelPaymentLink(order.payosOrderCode, 'Hết hạn thanh toán').catch(() => {})
    }
    await audit({
      actorRole: 'system',
      entity: 'order',
      entityId: order.id,
      action: 'status',
      oldValue: { status: 'pending_payment' },
      newValue: { status: 'cancelled', reason: 'PAYMENT_EXPIRED' },
    })
    await notify('payment_expired', updated)
    return updated
  }

  /** BR-PAY-003: quét toàn bộ đơn payOS quá hạn → CANCELLED, trả lượt coupon. */
  async function expirePendingOrders() {
    const expired = await repo.listExpiredPendingOrders(now().toISOString())
    const results = []
    for (const order of expired) {
      const updated = await cancelExpired(order)
      if (updated) results.push(updated)
    }
    return results
  }

  /** BR-ORD-001 / D-06: khách huỷ đơn khi còn trước SHIPPED. */
  async function cancelByCustomer(order, userId, reason) {
    if (order.userId !== userId) throw new HttpError(404, 'NOT_FOUND', 'Không tìm thấy đơn')
    if (order.status === 'cancelled') return order
    if (!canCustomerCancel(order.status)) throw new HttpError(409, 'ORDER_NOT_CANCELLABLE', 'Đơn không huỷ được nữa')

    const updated = await repo.updateOrderIfStatus(order.id, order.status, {
      status: 'cancelled',
      cancelledAt: now().toISOString(),
      cancelReason: typeof reason === 'string' ? reason.slice(0, 300) : null,
      // Đơn đã trả tiền: chờ admin hoàn tay (Q-16 → D-74)
      paymentStatus: order.paymentStatus === 'paid' ? 'refund_pending' : 'cancelled',
    })
    if (!updated) throw new HttpError(409, 'ORDER_NOT_CANCELLABLE', 'Trạng thái đơn vừa thay đổi')
    if (payos && order.payosOrderCode && order.paymentStatus === 'pending') {
      await payos.cancelPaymentLink(order.payosOrderCode, 'Khách huỷ đơn').catch(() => {})
    }
    await audit({
      actorId: userId,
      actorRole: 'customer',
      entity: 'order',
      entityId: order.id,
      action: 'status',
      oldValue: { status: order.status },
      newValue: { status: 'cancelled', reason: updated.cancelReason },
    })
    await notify('cancelled', updated)
    return updated
  }

  /** FR-ORD-002: admin đổi trạng thái theo đúng luồng §16. */
  async function setStatusByAdmin(order, adminId, next, { trackingCode } = {}) {
    if (!canAdminMove(order.status, next)) {
      throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Không chuyển được sang trạng thái này')
    }
    const values = { status: next }
    if (next === 'cancelled') {
      values.cancelledAt = now().toISOString()
      values.cancelReason = 'ADMIN'
      if (order.paymentStatus === 'paid') values.paymentStatus = 'refund_pending'
      else if (order.paymentStatus === 'pending') values.paymentStatus = 'cancelled'
    }
    if (trackingCode !== undefined) values.trackingCode = trackingCode
    // D-75: mốc "giao thành công" để tính hạn xoá media khi không ai xác nhận
    if (next === 'delivered') values.deliveredAt = now().toISOString()

    const updated = await repo.updateOrderIfStatus(order.id, order.status, values)
    if (!updated) throw new HttpError(409, 'INVALID_STATUS_TRANSITION', 'Trạng thái đơn vừa thay đổi')
    if (next === 'cancelled') {
      // Link thanh toán còn sống tới 15 phút: không huỷ thì khách vẫn trả được vào đơn đã huỷ
      if (payos && order.payosOrderCode && order.paymentStatus === 'pending') {
        await payos.cancelPaymentLink(order.payosOrderCode, 'Admin huỷ đơn').catch(() => {})
      }
    }
    await audit({
      actorId: adminId,
      actorRole: 'admin',
      entity: 'order',
      entityId: order.id,
      action: 'status',
      oldValue: { status: order.status },
      newValue: values,
    })
    // §20: "đã gửi" (kèm mã vận đơn) và "bị huỷ" báo ngay cho người mua
    if (next === 'shipped') await notify('shipped', updated)
    else if (next === 'cancelled') await notify('cancelled', updated)
    return updated
  }

  /** D-74 (Q-16): hoàn tiền thủ công — admin chuyển khoản tay rồi ghi nhận trên web. */
  async function markRefunded(order, adminId, note) {
    const paidAfterCancel = order.status === 'cancelled' && order.paymentStatus === 'paid' && order.paymentFlag === 'PAID_AFTER_CANCEL'
    if (order.paymentStatus !== 'refund_pending' && !paidAfterCancel) {
      throw new HttpError(409, 'REFUND_NOT_PENDING', 'Đơn không ở trạng thái chờ hoàn tiền')
    }
    const updated = await repo.updateOrderIfStatus(order.id, order.status, { paymentStatus: 'refunded' }, order.paymentStatus, paidAfterCancel ? 'PAID_AFTER_CANCEL' : undefined)
    if (!updated) throw new HttpError(409, 'REFUND_NOT_PENDING', 'Trạng thái hoàn tiền vừa thay đổi')
    await audit({
      actorId: adminId,
      actorRole: 'admin',
      entity: 'order',
      entityId: order.id,
      action: 'refund',
      oldValue: { paymentStatus: order.paymentStatus },
      newValue: { paymentStatus: 'refunded', note: typeof note === 'string' ? note.slice(0, 300) : null },
    })
    await notify('refunded', updated)
    return updated
  }

  return {
    quoteCart,
    createOrder,
    applyPayosWebhook,
    expireIfDue,
    expirePendingOrders,
    paymentLinkFor,
    cancelByCustomer,
    setStatusByAdmin,
    markRefunded,
    pricingConfig,
    COUPON_ERRORS,
  }
}
