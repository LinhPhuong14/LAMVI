import { HttpError, notFound } from '../errors.js'
import { RepoError } from '../adapters/repoErrors.js'
import { PUBLIC_PRODUCT_STATUSES, presentProduct } from '../domain/catalog.js'
import { codAllowed, loadShopConfig, priceOrder } from './pricing.js'
import { couponProblem, normalizeCouponCode, presentCouponForCustomer } from './coupons.js'
import { SYSTEM, createAudit } from './audit.js'
import { PAYMENT_TTL_MS, canCustomerCancel, presentOrder, presentOrderSummary, validateCheckout } from './domain.js'

const COUPON_ERRORS = ['COUPON_INVALID', 'COUPON_USED_UP', 'COUPON_USER_LIMIT']

function assertValid(errors) {
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ', errors)
}

// Checkout + đơn hàng + thanh toán (§12–§16). payments: adapter payOS (thật hoặc giả lập)
export function createOrderService({
  repo,
  payments,
  publicSiteUrl = 'http://localhost:5173',
  now = () => Date.now(),
  reconcileIntervalMs = 10_000,
  linkWaitTries = 25,
  linkWaitMs = 200,
  audit = createAudit({ repo, now }),
}) {
  const iso = (ms = now()) => new Date(ms).toISOString()

  // Cập nhật có điều kiện + ghi nhật ký (NFR-AUD-001)
  async function update(order, patch, from, actor, action) {
    const updated = await repo.updateOrder(order.id, patch, from)
    if (updated) await audit.orderChange(order, updated, actor, action)
    return updated
  }
  const lastCheck = new Map() // orderId → lần hỏi payOS gần nhất

  async function cartLines(userId) {
    const products = new Map((await repo.listProducts()).map((p) => [p.id, p]))
    const lines = []
    let unavailable = 0
    for (const l of await repo.getCart(userId)) {
      const p = products.get(l.productId)
      if (!p) continue
      if (PUBLIC_PRODUCT_STATUSES.includes(p.status)) lines.push({ product: p, quantity: l.quantity })
      else unavailable += 1
    }
    return { lines, unavailable }
  }

  // Tính lại toàn bộ ở server (§12: không tin giá từ trình duyệt)
  async function compute(userId, { couponCode, recipientType }) {
    const { lines, unavailable } = await cartLines(userId)
    const shop = await loadShopConfig(repo)
    const priceLines = lines.map((l) => ({ productId: l.product.id, unitPrice: l.product.priceExclVat, quantity: l.quantity }))
    const subtotal = priceLines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)
    const code = normalizeCouponCode(couponCode)
    let coupon = null
    let problem = null
    if (code) {
      coupon = code.length <= 30 ? await repo.getCouponByCode(code) : null
      const uses = coupon ? await repo.countCouponUses(coupon.id, userId) : { total: 0, byUser: 0 }
      problem = couponProblem(coupon, { now: iso(), lines: priceLines, subtotal, uses })
      if (problem) coupon = null
    }
    const pricing = priceOrder({ lines: priceLines, coupon, shop })
    const cod = codAllowed({ recipientType: recipientType ?? 'self', total: pricing.total, shop })
    return { lines, priceLines, unavailable, shop, coupon, problem, pricing, cod }
  }

  const localePrefix = (lang) => (lang === 'vi' ? '' : `/${lang}`)
  const orderUrl = (order, lang, payment) => `${publicSiteUrl}${localePrefix(lang)}/account/orders/${order.id}?payment=${payment}`

  // --- Thanh toán
  // Tiền về cho đơn: xác nhận nếu khớp; lệch số tiền hoặc đơn đã huỷ → gắn cờ cho admin hoàn tiền (D-41, D-70)
  async function applyPaid(order, { amount, reference }, attempt = 0) {
    const paid = { paidAt: iso(), paidAmount: amount, paymentRef: reference }
    if (order.status === 'PENDING_PAYMENT') {
      const patch =
        amount === order.total
          ? { status: 'CONFIRMED', paymentStatus: 'PAID', ...paid }
          : // BR-PAY-001: lệch số tiền → không xác nhận; huỷ đơn để admin hoàn tiền [ASSUMPTION]
            { status: 'CANCELLED', cancelReason: 'payment_mismatch', cancelledAt: iso(), paymentStatus: 'REFUND_PENDING', flags: [...order.flags, 'AMOUNT_MISMATCH'], ...paid }
      const updated = await update(order, patch, ['PENDING_PAYMENT'], SYSTEM, amount === order.total ? 'payment_confirmed' : 'payment_mismatch')
      if (updated) return updated
      // Trạng thái vừa đổi (vd hết hạn cùng lúc) → đọc lại và xử lý theo trạng thái mới
      const fresh = await repo.getOrderById(order.id)
      return attempt < 2 && fresh ? applyPaid(fresh, { amount, reference }, attempt + 1) : fresh
    }
    if (order.status === 'CANCELLED' && !['PAID', 'REFUND_PENDING', 'REFUNDED'].includes(order.paymentStatus)) {
      // D-41: thanh toán sau khi đơn hết hạn/huỷ → ghi nhận, admin hoàn tiền thủ công
      return (
        (await update(order, { paymentStatus: 'REFUND_PENDING', flags: [...order.flags, 'PAID_AFTER_CANCEL'], ...paid }, ['CANCELLED'], SYSTEM, 'paid_after_cancel')) ?? order
      )
    }
    return order // đã ghi nhận trước đó
  }

  async function recordAndApply(order, { amount, reference, payload }) {
    const isNew = await repo.recordPaymentEvent({ provider: payments?.name ?? 'payos', reference, orderCode: order.code, payload })
    if (!isNew) return order // BR-PAY-002
    try {
      return await applyPaid(order, { amount, reference })
    } catch (err) {
      // Cho phép payOS gửi lại
      await repo.deletePaymentEvent(payments?.name ?? 'payos', reference).catch(() => {})
      throw err
    }
  }

  async function cancelPending(order, reason, actor = SYSTEM) {
    const updated = await update(
      order,
      { status: 'CANCELLED', paymentStatus: reason === 'payment_expired' ? 'EXPIRED' : 'CANCELLED', cancelReason: reason, cancelledAt: iso() },
      ['PENDING_PAYMENT'],
      actor,
      'cancel',
    )
    if (updated && payments) payments.cancelPaymentLink(order.code).catch((err) => console.error('[payos] cancel', order.code, err?.message ?? err))
    return updated ?? (await repo.getOrderById(order.id))
  }

  const expired = (order, t) => Boolean(order.paymentExpiresAt) && t >= Date.parse(order.paymentExpiresAt)

  // §15.1: webhook chậm → chủ động hỏi payOS; quá hạn mà chưa trả → huỷ, trả lượt coupon (BR-PAY-003)
  async function reconcile(order, opts) {
    const result = await reconcileOnce(order, opts)
    if (result?.status !== 'PENDING_PAYMENT') lastCheck.delete(order.id)
    return result
  }

  async function reconcileOnce(order, { force = false } = {}) {
    if (order.status !== 'PENDING_PAYMENT') return order
    const t = now()
    if (!payments) return expired(order, t) ? cancelPending(order, 'payment_expired') : order
    const isExpired = expired(order, t)
    if (!force && !isExpired && t - (lastCheck.get(order.id) ?? 0) < reconcileIntervalMs) return order
    lastCheck.set(order.id, t)
    let p = null
    try {
      p = await payments.getPayment(order.code)
    } catch (err) {
      console.error('[payos] get', order.code, err?.message ?? err)
    }
    if (p?.status === 'PAID') {
      return recordAndApply(order, { amount: p.amountPaid, reference: p.reference ?? `poll-${order.code}`, payload: { source: 'poll', ...p } })
    }
    if (isExpired) return cancelPending(order, 'payment_expired')
    return order
  }

  // Gửi lại cùng clientKey (bấm đúp / mạng chập chờn) → trả đơn đã tạo
  async function replay(order, lang) {
    // Lần trước lỗi tạo link payOS → báo lỗi như lần đầu; trình duyệt tạo khoá mới để thử lại
    if (order.status === 'CANCELLED' && order.cancelReason === 'payment_error') {
      throw new HttpError(502, 'PAYMENT_UNAVAILABLE', 'Không tạo được link thanh toán')
    }
    // Request kia còn đang tạo link payOS → chờ một chút
    let o = order
    for (let i = 0; i < linkWaitTries && o.status === 'PENDING_PAYMENT' && !o.checkoutUrl; i += 1) {
      await new Promise((r) => setTimeout(r, linkWaitMs))
      o = (await repo.getOrderById(o.id)) ?? o
    }
    return { order: presentOrder(o, lang), checkoutUrl: o.status === 'PENDING_PAYMENT' ? o.checkoutUrl : null }
  }

  async function ownOrder(userId, id) {
    const order = typeof id === 'string' && id.length <= 64 ? await repo.getOrderById(id) : null
    if (!order || order.userId !== userId) throw notFound()
    return order
  }

  return {
    // POST /checkout/quote — bảng giá cho bước checkout (FR-CHK-008)
    async quote(userId, { couponCode, recipientType }, lang) {
      const c = await compute(userId, { couponCode, recipientType })
      return {
        items: c.lines.map(({ product, quantity }) => {
          const p = presentProduct(product, lang)
          return { slug: p.slug, name: p.name, tone: p.tone, unitPrice: p.priceExclVat, quantity, lineTotal: p.priceExclVat * quantity }
        }),
        hasUnavailable: c.unavailable > 0,
        pricing: c.pricing,
        coupon: c.coupon ? presentCouponForCustomer(c.coupon) : null,
        couponError: c.problem,
        cod: c.cod,
        payosAvailable: Boolean(payments),
        shop: { shippingFee: c.shop.shippingFee, freeShippingFrom: c.shop.freeShippingFrom },
      }
    },

    // POST /orders — tạo đơn (§12, BR-CPN-002, BR-PAY-004)
    async create(userId, body, lang) {
      const { errors, values } = validateCheckout(body)
      assertValid(errors)
      const existing = await repo.getOrderByClientKey(userId, values.clientKey)
      if (existing) return replay(existing, lang)

      const c = await compute(userId, values)
      if (!c.lines.length) throw new HttpError(409, 'CART_EMPTY', 'Giỏ hàng trống')
      if (c.unavailable) throw new HttpError(409, 'CART_HAS_UNAVAILABLE', 'Giỏ có sản phẩm không còn bán')
      if (values.couponCode && c.problem) throw new HttpError(409, c.problem.code, 'Coupon không dùng được', { couponCode: c.problem.code })
      if (values.paymentMethod === 'payos' && !payments) throw new HttpError(409, 'PAYOS_UNAVAILABLE', 'Chưa bật thanh toán payOS', { paymentMethod: 'PAYOS_UNAVAILABLE' })
      if (values.paymentMethod === 'cod' && !c.cod.allowed) throw new HttpError(409, c.cod.reason, 'Không dùng được COD', { paymentMethod: c.cod.reason })
      // D-41: giá/coupon đổi so với lúc khách xem → yêu cầu xác nhận lại
      if (c.pricing.total !== values.expectedTotal) throw new HttpError(409, 'PRICE_CHANGED', 'Giá đã thay đổi')

      const payos = values.paymentMethod === 'payos'
      const order = {
        userId,
        clientKey: values.clientKey,
        // §16: COD bỏ qua PENDING_PAYMENT
        status: payos ? 'PENDING_PAYMENT' : 'CONFIRMED',
        paymentStatus: payos ? 'PENDING' : 'COD_PENDING',
        paymentExpiresAt: payos ? iso(now() + PAYMENT_TTL_MS) : null,
        orderType: values.orderType,
        hasMessage: values.hasMessage,
        qrLang: values.qrLang,
        recipientType: values.recipientType,
        recipient: values.recipient,
        paymentMethod: values.paymentMethod,
        couponId: c.coupon?.id ?? null,
        couponCode: c.coupon?.code ?? null,
        subtotal: c.pricing.subtotal,
        discount: c.pricing.discount,
        shippingFee: c.pricing.shippingFee,
        vat: c.pricing.vat,
        total: c.pricing.total,
        flags: [],
      }
      // BR-PRC-002: chốt giá và tên sản phẩm
      const items = c.lines.map(({ product, quantity }) => ({
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        unitPrice: product.priceExclVat,
        quantity,
        lineTotal: product.priceExclVat * quantity,
      }))

      let created
      try {
        created = await repo.createOrder(order, items)
      } catch (err) {
        if (err instanceof RepoError && COUPON_ERRORS.includes(err.code)) {
          throw new HttpError(409, err.code, 'Coupon không dùng được', { couponCode: err.code })
        }
        if (err instanceof RepoError && err.code === 'CONFLICT') {
          const dup = await repo.getOrderByClientKey(userId, values.clientKey)
          if (dup) return replay(dup, lang)
        }
        throw err
      }

      await audit.orderChange(null, created, { id: userId, role: 'customer' }, 'create')
      let result = created
      if (payos) {
        try {
          const link = await payments.createPaymentLink({
            orderCode: created.code,
            amount: created.total,
            description: `MOC ${created.code}`,
            items: [{ name: `Don hang ${created.code}`, quantity: 1, price: created.total }],
            returnUrl: orderUrl(created, lang, 'return'),
            cancelUrl: orderUrl(created, lang, 'cancel'),
            expiredAt: Math.floor(Date.parse(created.paymentExpiresAt) / 1000),
          })
          result = (await repo.updateOrder(created.id, { checkoutUrl: link.checkoutUrl, paymentLinkId: link.paymentLinkId }, ['PENDING_PAYMENT'])) ?? created
        } catch (err) {
          console.error('[payos] create', created.code, err?.message ?? err)
          await update(created, { status: 'CANCELLED', paymentStatus: 'CANCELLED', cancelReason: 'payment_error', cancelledAt: iso() }, ['PENDING_PAYMENT'], SYSTEM, 'cancel')
          throw new HttpError(502, 'PAYMENT_UNAVAILABLE', 'Không tạo được link thanh toán')
        }
      }
      // Đơn đã tạo → bỏ các dòng đã mua khỏi giỏ [ASSUMPTION]
      for (const i of items) await repo.removeCartItem(userId, i.productId)
      return { order: presentOrder(result, lang), checkoutUrl: payos ? result.checkoutUrl : null }
    },

    async list(userId, lang) {
      const orders = await repo.listOrdersByUser(userId)
      const out = []
      for (const o of orders) out.push(presentOrderSummary(o.status === 'PENDING_PAYMENT' ? await reconcile(o) : o, lang))
      return { items: out }
    },

    async get(userId, id, lang) {
      const order = await reconcile(await ownOrder(userId, id))
      return { order: presentOrder(order, lang) }
    },

    // BR-ORD-001: người mua huỷ trước SHIPPED
    async cancel(userId, id, lang) {
      let order = await reconcile(await ownOrder(userId, id), { force: true })
      if (!canCustomerCancel(order)) throw new HttpError(409, 'ORDER_NOT_CANCELLABLE', 'Đơn không huỷ được nữa')
      const actor = { id: userId, role: 'customer' }
      if (order.status === 'PENDING_PAYMENT') order = await cancelPending(order, 'customer', actor)
      else order = await cancelPaidOrConfirmed(order, 'customer', actor)
      if (order.status !== 'CANCELLED') throw new HttpError(409, 'ORDER_NOT_CANCELLABLE', 'Đơn không huỷ được nữa')
      return { order: presentOrder(order, lang) }
    },

    // Mở lại link thanh toán khi đơn còn chờ
    async pay(userId, id) {
      const order = await reconcile(await ownOrder(userId, id), { force: true })
      if (order.status !== 'PENDING_PAYMENT' || !order.checkoutUrl) throw new HttpError(409, 'ORDER_NOT_PAYABLE', 'Đơn không còn chờ thanh toán')
      return { checkoutUrl: order.checkoutUrl }
    },

    // POST /payments/payos/webhook (BR-PAY-001, BR-PAY-002)
    async handleWebhook(body) {
      if (!payments) throw notFound()
      const data = payments.verifyWebhook(body)
      if (!data) throw new HttpError(400, 'INVALID_SIGNATURE', 'Chữ ký không hợp lệ')
      if (body.code !== '00' || (data.code !== undefined && data.code !== '00')) return { ok: true }
      const orderCode = Number(data.orderCode)
      const order = Number.isSafeInteger(orderCode) ? await repo.getOrderByCode(orderCode) : null
      // payOS gửi webhook thử khi đăng ký URL → không có đơn, vẫn trả 200
      if (!order || !Number.isInteger(data.amount)) return { ok: true }
      const reference = typeof data.reference === 'string' && data.reference ? data.reference : `${orderCode}-${data.transactionDateTime ?? ''}`
      await recordAndApply(order, { amount: data.amount, reference, payload: data })
      return { ok: true }
    },

    // Chạy định kỳ: huỷ đơn payOS quá hạn (BR-PAY-003)
    async sweepExpired() {
      const orders = await repo.listExpiredPendingOrders(iso())
      let cancelled = 0
      for (const o of orders) {
        try {
          const r = await reconcile(o, { force: true })
          if (r?.status === 'CANCELLED') cancelled += 1
        } catch (err) {
          console.error('[orders] sweep', o.code, err?.message ?? err)
        }
      }
      return { checked: orders.length, cancelled }
    },

    reconcile,
    audit,
    cancelPending,
    cancelPaidOrConfirmed,
  }

  // Huỷ đơn đã xác nhận: đã trả payOS → chờ hoàn tiền (D-70, Q-20 còn mở về số tiền); COD → huỷ
  async function cancelPaidOrConfirmed(order, reason, actor = SYSTEM) {
    const paymentStatus = order.paymentStatus === 'PAID' ? 'REFUND_PENDING' : order.paymentMethod === 'cod' ? 'CANCELLED' : order.paymentStatus
    return (
      (await update(order, { status: 'CANCELLED', paymentStatus, cancelReason: reason, cancelledAt: iso() }, [order.status], actor, 'cancel')) ??
      (await repo.getOrderById(order.id))
    )
  }
}
