import { LOCALES, localePath } from '../i18n.js'

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const COPY = {
  vi: {
    recoverySubject: 'Đặt lại mật khẩu LAMVI',
    recoveryBody: 'Bạn (hoặc ai đó) vừa yêu cầu đặt lại mật khẩu cho tài khoản này. Liên kết có hiệu lực trong 1 giờ và chỉ dùng được một lần.',
    recoveryCta: 'Đặt lại mật khẩu',
    recoveryIgnore: 'Nếu không phải bạn, hãy bỏ qua thư này — mật khẩu của bạn không thay đổi.',
    changedSubject: 'Mật khẩu LAMVI đã được đổi',
    changedBody: 'Mật khẩu tài khoản của bạn vừa được thay đổi và mọi thiết bị đã bị đăng xuất.',
    changedWarn: 'Nếu không phải bạn, hãy dùng "Quên mật khẩu" ngay để lấy lại tài khoản.',
  },
  en: {
    recoverySubject: 'Reset your LAMVI password',
    recoveryBody: 'You (or someone else) asked to reset the password for this account. The link is valid for 1 hour and can be used once.',
    recoveryCta: 'Reset password',
    recoveryIgnore: 'If this was not you, ignore this email — your password is unchanged.',
    changedSubject: 'Your LAMVI password was changed',
    changedBody: 'The password of your account was just changed and all devices were signed out.',
    changedWarn: 'If this was not you, use "Forgot password" right away to recover your account.',
  },
  zh: {
    recoverySubject: '重置 LAMVI 密码',
    recoveryBody: '您（或他人）请求重置此账户的密码。链接 1 小时内有效，且只能使用一次。',
    recoveryCta: '重置密码',
    recoveryIgnore: '如果不是您本人操作，请忽略此邮件，密码不会改变。',
    changedSubject: '您的 LAMVI 密码已更改',
    changedBody: '您账户的密码刚刚被更改，所有设备已退出登录。',
    changedWarn: '如果不是您本人操作，请立即使用“忘记密码”找回账户。',
  },
}
const copy = (lang) => COPY[LOCALES.includes(lang) ? lang : 'vi']

// ---------- Khung thư dùng chung (banner + bố cục, T-56) ----------
// Thư điện tử không dùng được CSS hiện đại: dùng bảng, style nội tuyến, màu theo bảng màu web
// (design-rules §2.1). Nút bấm là bảng có nền để Outlook vẫn hiện đúng. Mọi chữ động đều qua esc().
const C = { diep: '#f4ede0', diepLight: '#fbf7ef', than: '#2a211b', thanSoft: '#5a4b3e', son: '#a3321f', hoe: '#bf8a3a', hoeLight: '#e2c68f', chamDeep: '#1a2735' }
const SERIF = "Georgia,'Times New Roman',serif"
const SANS_STACK = "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
export const MAIL_BANNER_PATH = '/images/mail/banner.jpg'
const BANNER_ALT = { vi: 'LAMVI — đèn giấy dó thủ công', en: 'LAMVI — handmade giấy dó lanterns', zh: 'LAMVI — 手工绵纸灯笼' }
const htmlLang = (l) => (l === 'zh' ? 'zh-Hans' : l)

const cut = (str, n) => (str.length > n ? `${str.slice(0, n - 1)}…` : str)

/**
 * @param {object} p
 * @param {string} p.lang
 * @param {string} [p.siteUrl] có → hiện banner ảnh (ảnh phải ở địa chỉ https công khai); không → banner chữ
 * @param {string} p.title tiêu đề lớn trong thư
 * @param {string[]} p.paragraphs
 * @param {{title: string, lines: string[], totalLabel: string, totalValue: string}|null} [p.summary]
 * @param {{url: string, label: string}|null} [p.cta]
 * @param {string} [p.fallback] câu "nếu nút không bấm được, sao chép liên kết" (kèm cta)
 * @param {string} p.footer
 */
function layout({ lang, siteUrl, title, paragraphs, summary = null, cta = null, fallback = '', footer }) {
  const l = LOCALES.includes(lang) ? lang : 'vi'
  const host = siteUrl ? siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') : 'LAMVI'
  const banner = siteUrl
    ? `<img src="${esc(siteUrl + MAIL_BANNER_PATH)}" width="600" alt="${esc(BANNER_ALT[l])}" style="display:block;width:100%;max-width:600px;height:auto;border:0;font:600 22px ${SERIF};color:${C.diepLight};text-align:center">`
    : `<div style="padding:34px 20px;text-align:center;font:700 34px ${SERIF};letter-spacing:4px;color:${C.diepLight}">LAMVI</div>`
  const preheader = cut(paragraphs[0] ?? title, 110)

  const summaryHtml = summary
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0 4px;background:${C.diep};border:1px solid ${C.hoeLight};border-radius:12px"><tr><td style="padding:16px 20px;font:15px/1.6 ${SANS_STACK};color:${C.than}">
        <div style="font-weight:600;margin-bottom:6px;color:${C.thanSoft}">${esc(summary.title)}</div>
        ${summary.lines.map((x) => `<div style="padding:3px 0;border-bottom:1px dashed ${C.hoeLight}">${esc(x)}</div>`).join('')}
        <div style="padding-top:10px;font-weight:700;font-size:16px">${esc(summary.totalLabel)}: <span style="color:${C.son}">${esc(summary.totalValue)}</span></div>
      </td></tr></table>`
    : ''

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px"><tr><td align="center" bgcolor="${C.son}" style="border-radius:10px;background:${C.son}"><a href="${esc(cta.url)}" target="_blank" style="display:inline-block;padding:14px 30px;font:600 16px ${SANS_STACK};color:#ffffff;text-decoration:none;border-radius:10px">${esc(cta.label)}</a></td></tr></table>${
        fallback
          ? `<p style="margin:12px 0 0;font:13px/1.5 ${SANS_STACK};color:${C.thanSoft}">${esc(fallback)}<br><span style="word-break:break-all;color:${C.son}">${esc(cta.url)}</span></p>`
          : ''
      }`
    : ''

  return `<!doctype html>
<html lang="${htmlLang(l)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.diep};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.diep}" style="background:${C.diep}"><tr><td align="center" style="padding:24px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.diepLight};border-radius:16px;overflow:hidden;border:1px solid ${C.hoeLight}">
    <tr><td bgcolor="${C.chamDeep}" style="background:${C.chamDeep};line-height:0;font-size:0">${banner}</td></tr>
    <tr><td style="padding:34px 38px 8px;font:16px/1.65 ${SANS_STACK};color:${C.than}">
      <h1 style="margin:0 0 16px;font:700 24px/1.3 ${SERIF};color:${C.than}">${esc(title)}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join('')}
      ${summaryHtml}
      ${ctaHtml}
    </td></tr>
    <tr><td style="padding:22px 38px 30px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px solid ${C.hoeLight};padding-top:16px;font:13px/1.6 ${SANS_STACK};color:${C.thanSoft}">
      ${esc(footer)}<br><strong style="color:${C.than};letter-spacing:1px">LAMVI</strong> · ${esc(host)}
    </td></tr></table></td></tr>
  </table>
</td></tr></table>
</body></html>`
}

const FOOTER_SYSTEM = {
  vi: 'Thư tự động từ LAMVI — vui lòng không trả lời thư này.',
  en: 'Automatic email from LAMVI — please do not reply.',
  zh: '此为 LAMVI 自动发送的邮件，请勿回复。',
}
const CTA_FALLBACK = {
  vi: 'Nếu nút không bấm được, hãy sao chép liên kết này vào trình duyệt:',
  en: 'If the button does not work, copy this link into your browser:',
  zh: '如果按钮无法点击，请将此链接复制到浏览器中打开：',
}
const footerOf = (lang) => FOOTER_SYSTEM[LOCALES.includes(lang) ? lang : 'vi']
const fallbackOf = (lang) => CTA_FALLBACK[LOCALES.includes(lang) ? lang : 'vi']

// `url` chứa token một lần trong fragment (#t=…) nên không vào log máy chủ/Referer
export function recoveryMail({ lang, url, siteUrl }) {
  const c = copy(lang)
  return {
    subject: c.recoverySubject,
    text: `${c.recoveryBody}\n\n${url}\n\n${c.recoveryIgnore}`,
    html: layout({
      lang,
      siteUrl,
      title: c.recoverySubject,
      paragraphs: [c.recoveryBody, c.recoveryIgnore],
      cta: { url, label: c.recoveryCta },
      fallback: fallbackOf(lang),
      footer: footerOf(lang),
    }),
  }
}

// Không có liên kết nào trong thư báo đổi mật khẩu: tránh bị nhầm với thư lừa đảo
export function passwordChangedMail({ lang, siteUrl }) {
  const c = copy(lang)
  return {
    subject: c.changedSubject,
    text: `${c.changedBody}\n\n${c.changedWarn}`,
    html: layout({ lang, siteUrl, title: c.changedSubject, paragraphs: [c.changedBody, c.changedWarn], footer: footerOf(lang) }),
  }
}

// ---------- Thông báo đơn hàng (§20, Q-24 → email, T-56) ----------

// Nội dung theo ngôn ngữ ưa thích của tài khoản người mua (D-41). {code}, {tracking} được thay lúc dựng.
const ORDER_COPY = {
  vi: {
    greeting: 'Chào {name},',
    items: 'Sản phẩm',
    total: 'Tổng thanh toán (đã gồm VAT)',
    cta: 'Xem đơn hàng',
    footer: 'Thư tự động từ LAMVI — vui lòng không trả lời thư này.',
    confirmed: { subject: 'LAMVI — Đã xác nhận đơn {code}', body: 'Cảm ơn bạn đã đặt hàng. Đơn {code} đã được xác nhận và sẽ sớm được làm.' },
    confirmedMessage: 'Đơn này có lời chúc: bạn có thể soạn hoặc sửa lời chúc ở trang đơn hàng — phần chữ sửa được đến khi đèn được đóng gói, giọng nói/video sửa được đến khi đơn được gửi đi.',
    payment_expired: { subject: 'LAMVI — Đơn {code} đã hết hạn thanh toán', body: 'Đơn {code} đã bị huỷ vì chưa được thanh toán trong thời hạn. Nếu bạn vẫn muốn đặt, hãy tạo đơn mới — giỏ hàng của bạn đã được giữ lại nếu còn sản phẩm.' },
    shipped: { subject: 'LAMVI — Đơn {code} đã được gửi đi', body: 'Đơn {code} đã được gửi đi và đang trên đường tới người nhận.' },
    tracking: 'Mã vận đơn: {tracking}',
    shippedMessage: 'Người nhận quét mã QR trên thiệp cảm ơn để mở lời chúc.',
    cancelled: { subject: 'LAMVI — Đơn {code} đã được huỷ', body: 'Đơn {code} đã được huỷ.' },
    cancelledRefund: 'Đơn đã được thanh toán nên LAMVI sẽ hoàn tiền cho bạn bằng chuyển khoản; chúng tôi sẽ báo khi đã hoàn xong.',
    refunded: { subject: 'LAMVI — Đã hoàn tiền đơn {code}', body: 'LAMVI đã hoàn tiền cho đơn {code}. Thời gian tiền về tài khoản tuỳ ngân hàng của bạn.' },
  },
  en: {
    greeting: 'Hello {name},',
    items: 'Items',
    total: 'Total (VAT included)',
    cta: 'View order',
    footer: 'Automatic email from LAMVI — please do not reply.',
    confirmed: { subject: 'LAMVI — Order {code} confirmed', body: 'Thank you for your order. Order {code} is confirmed and will be made soon.' },
    confirmedMessage: 'This order has a gift message: you can write or edit it on the order page — the text can be edited until the lantern is packed, the voice/video until the order ships.',
    payment_expired: { subject: 'LAMVI — Order {code} payment expired', body: 'Order {code} was cancelled because it was not paid in time. If you still want it, please place a new order — your cart is kept if the items are still available.' },
    shipped: { subject: 'LAMVI — Order {code} has shipped', body: 'Order {code} has shipped and is on its way to the recipient.' },
    tracking: 'Tracking code: {tracking}',
    shippedMessage: 'The recipient can scan the QR code on the thank-you card to open the gift message.',
    cancelled: { subject: 'LAMVI — Order {code} cancelled', body: 'Order {code} has been cancelled.' },
    cancelledRefund: 'The order was already paid, so LAMVI will refund you by bank transfer; we will let you know once it is done.',
    refunded: { subject: 'LAMVI — Order {code} refunded', body: 'LAMVI has refunded order {code}. How soon the money arrives depends on your bank.' },
  },
  zh: {
    greeting: '{name}，您好：',
    items: '商品',
    total: '应付总额（含增值税）',
    cta: '查看订单',
    footer: '此为 LAMVI 自动发送的邮件，请勿回复。',
    confirmed: { subject: 'LAMVI — 订单 {code} 已确认', body: '感谢您的订购。订单 {code} 已确认，我们将尽快制作。' },
    confirmedMessage: '此订单包含祝福：您可在订单页撰写或修改——文字在灯笼包装前可修改，语音/视频在订单发出前可修改。',
    payment_expired: { subject: 'LAMVI — 订单 {code} 支付已过期', body: '订单 {code} 因未在期限内付款已被取消。如仍需购买，请重新下单——若商品仍可购买，购物车已为您保留。' },
    shipped: { subject: 'LAMVI — 订单 {code} 已发货', body: '订单 {code} 已发出，正在送往收礼人的途中。' },
    tracking: '运单号：{tracking}',
    shippedMessage: '收礼人可扫描感谢卡上的二维码打开祝福。',
    cancelled: { subject: 'LAMVI — 订单 {code} 已取消', body: '订单 {code} 已取消。' },
    cancelledRefund: '订单已付款，LAMVI 将通过银行转账退款，完成后会通知您。',
    refunded: { subject: 'LAMVI — 订单 {code} 已退款', body: 'LAMVI 已为订单 {code} 退款，到账时间取决于您的银行。' },
  },
}
const orderCopy = (lang) => ORDER_COPY[LOCALES.includes(lang) ? lang : 'vi']
const fill = (str, vars) => str.replace(/\{(\w+)\}/g, (m, k) => vars[k] ?? m)
const vnd = (n) => `${new Intl.NumberFormat('vi-VN').format(n)} ₫`

export const ORDER_MAIL_KINDS = ['confirmed', 'payment_expired', 'shipped', 'cancelled', 'refunded']

/**
 * Thư thông báo đơn hàng. KHÔNG đưa token QR hay nội dung lời chúc vào thư (BR-QR-001, D-89);
 * chỉ có mã đơn, tên sản phẩm, tổng tiền, mã vận đơn và link tới trang đơn (cần đăng nhập).
 * @param {{kind: string, lang: string, order: object, siteUrl: string, name?: string}} p
 */
export function orderMail({ kind, lang, order, siteUrl, name }) {
  if (!ORDER_MAIL_KINDS.includes(kind)) throw new Error(`orderMail: kind không hợp lệ: ${kind}`)
  const l = LOCALES.includes(lang) ? lang : 'vi'
  const c = orderCopy(l)
  const vars = { code: order.code, tracking: order.trackingCode ?? '', name: name || '' }
  const url = `${siteUrl}${localePath(l, `/don-hang/${encodeURIComponent(order.code)}`)}`

  const paragraphs = [fill(c[kind].body, vars)]
  if (kind === 'confirmed' && order.hasMessage) paragraphs.push(c.confirmedMessage)
  if (kind === 'shipped') {
    if (order.trackingCode) paragraphs.push(fill(c.tracking, vars))
    if (order.hasMessage) paragraphs.push(c.shippedMessage)
  }
  // Đơn đã trả tiền mà bị huỷ → báo sẽ hoàn tiền (D-74)
  if (kind === 'cancelled' && order.paymentStatus === 'refund_pending') paragraphs.push(c.cancelledRefund)

  const lines = (order.items ?? []).map((i) => {
    const itemName = (i.name && typeof i.name === 'object' ? (i.name[l] ?? i.name.vi) : i.name) ?? i.slug
    return `${itemName} × ${i.quantity} — ${vnd(i.lineTotal)}`
  })
  const showSummary = kind === 'confirmed' || kind === 'shipped'
  const greeting = name ? fill(c.greeting, vars) : null

  const text = [
    greeting,
    ...paragraphs,
    ...(showSummary ? [`${c.items}:`, ...lines.map((x) => `- ${x}`), `${c.total}: ${vnd(order.total)}`] : []),
    `${c.cta}: ${url}`,
    c.footer,
  ]
    .filter(Boolean)
    .join('\n\n')

  const html = layout({
    lang: l,
    siteUrl,
    title: fill(c[kind].subject, vars).replace(/^LAMVI — /, ''),
    paragraphs: [...(greeting ? [greeting] : []), ...paragraphs],
    summary: showSummary ? { title: c.items, lines, totalLabel: c.total, totalValue: vnd(order.total) } : null,
    cta: { url, label: c.cta },
    fallback: fallbackOf(l),
    footer: c.footer,
  })

  return { subject: fill(c[kind].subject, vars), text, html }
}
