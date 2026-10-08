import { LOCALES } from '../i18n.js'

// Khung thư giao dịch dùng chung: banner, bố cục, chân thư doanh nghiệp (T-56).
// Thư điện tử không dùng được CSS hiện đại: dùng bảng, style nội tuyến, màu theo bảng màu web
// (design-rules §2.1). Nút bấm là bảng có nền để Outlook vẫn hiện đúng. Mọi chữ động đều qua esc().

export const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

const C = { diep: '#f4ede0', diepLight: '#fbf7ef', diepDeep: '#e9dfcb', than: '#2a211b', thanSoft: '#5a4b3e', son: '#a3321f', hoe: '#bf8a3a', hoeLight: '#e2c68f', chamDeep: '#1a2735' }
const SERIF = "Georgia,'Times New Roman',serif"
const SANS = "-apple-system,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif"
export const MAIL_BANNER_PATH = '/images/mail/banner.jpg'
const BANNER_ALT = { vi: 'LAMVI — đèn giấy dó thủ công', en: 'LAMVI — handmade giấy dó lanterns', zh: 'LAMVI — 手工绵纸灯笼' }
const htmlLang = (l) => (l === 'zh' ? 'zh-Hans' : l)
const lang3 = (l) => (LOCALES.includes(l) ? l : 'vi')
const cut = (str, n) => (str.length > n ? `${str.slice(0, n - 1)}…` : str)

const FOOT = {
  vi: {
    tagline: 'Đèn giấy dó thủ công — giữ lửa ký ức, thắp sáng yêu thương.',
    help: 'Cần hỗ trợ?',
    email: 'Email',
    phone: 'Hotline',
    hours: 'Giờ hỗ trợ',
    address: 'Địa chỉ',
    follow: 'Theo dõi LAMVI',
    reason: 'Bạn nhận được thư này vì có tài khoản hoặc đơn hàng tại LAMVI.',
    transactional: 'Đây là thư giao dịch liên quan đến tài khoản hoặc đơn hàng của bạn, không phải thư quảng cáo nên không có mục huỷ đăng ký.',
    noreply: 'Thư được gửi tự động — vui lòng không trả lời trực tiếp thư này.',
    noreplyHelp: 'Thư được gửi tự động; nếu cần hỗ trợ, hãy liên hệ theo thông tin phía trên.',
    rights: 'Bảo lưu mọi quyền.',
  },
  en: {
    tagline: 'Handmade giấy dó lanterns — keeping memories alight, lighting up love.',
    help: 'Need help?',
    email: 'Email',
    phone: 'Hotline',
    hours: 'Support hours',
    address: 'Address',
    follow: 'Follow LAMVI',
    reason: 'You are receiving this email because you have an account or an order at LAMVI.',
    transactional: 'This is a transactional email about your account or order, not marketing, so it has no unsubscribe option.',
    noreply: 'This email was sent automatically — please do not reply to it directly.',
    noreplyHelp: 'This email was sent automatically; if you need help, please use the contact details above.',
    rights: 'All rights reserved.',
  },
  zh: {
    tagline: '手工绵纸灯笼——守住记忆之光，点亮爱意。',
    help: '需要帮助？',
    email: '邮箱',
    phone: '热线',
    hours: '服务时间',
    address: '地址',
    follow: '关注 LAMVI',
    reason: '您收到此邮件，是因为您在 LAMVI 有账号或订单。',
    transactional: '这是与您的账号或订单相关的事务性邮件，不是营销邮件，因此没有退订选项。',
    noreply: '此邮件为系统自动发送——请勿直接回复。',
    noreplyHelp: '此邮件为系统自动发送；如需帮助，请通过上方联系方式与我们联系。',
    rights: '保留所有权利。',
  },
}

const clean = (v, max) =>
  typeof v === 'string' ? [...v].filter((ch) => ch >= ' ' && ch !== '\u007f').join('').trim().slice(0, max) : ''
const HTTPS_URL = /^https:\/\/[^\s"'<>\\]+$/i
const EMAIL = /^[^\s@<>"']+@[^\s@<>"']+\.[^\s@<>"']+$/
const PHONE = /^[0-9 .()+-]{6,24}$/

/**
 * Thông tin doanh nghiệp ở chân thư — chỉ hiện mục nào có giá trị hợp lệ, KHÔNG có giá trị mặc định bịa ra
 * (địa chỉ, hotline, MST là thông tin thật của công ty, do vận hành đặt ở biến môi trường).
 * @param {object} [raw] { name, legalName, address, supportEmail, phone, hours, facebookUrl, instagramUrl, tiktokUrl, zaloUrl, youtubeUrl }
 */
export function normalizeBrand(raw = {}) {
  const r = raw && typeof raw === 'object' ? raw : {}
  const social = [
    ['Facebook', r.facebookUrl],
    ['Instagram', r.instagramUrl],
    ['TikTok', r.tiktokUrl],
    ['Zalo', r.zaloUrl],
    ['YouTube', r.youtubeUrl],
  ]
    .map(([label, url]) => [label, clean(url, 300)])
    .filter(([, url]) => HTTPS_URL.test(url))
    .map(([label, url]) => ({ label, url }))
  const email = clean(r.supportEmail, 120)
  const phone = clean(r.phone, 24)
  return {
    name: clean(r.name, 60) || 'LAMVI',
    legalName: clean(r.legalName, 200),
    address: clean(r.address, 300),
    registration: clean(r.registration, 300),
    workshopAddress: clean(r.workshopAddress, 300),
    moitUrl: HTTPS_URL.test(clean(r.moitUrl, 300)) ? clean(r.moitUrl, 300) : '',
    supportEmail: EMAIL.test(email) ? email : '',
    phone: PHONE.test(phone) ? phone : '',
    hours: clean(r.hours, 120),
    social,
  }
}

const telHref = (phone) => `tel:${phone.replace(/[^0-9+]/g, '')}`

/** Phần chữ thuần của chân thư (bản text của thư). */
export function footerText({ lang, brand, siteUrl, year = new Date().getFullYear() }) {
  const l = lang3(lang)
  const f = FOOT[l]
  const b = normalizeBrand(brand)
  const lines = [`— ${b.name}`, f.tagline]
  const contact = []
  if (b.supportEmail) contact.push(`${f.email}: ${b.supportEmail}`)
  if (b.phone) contact.push(`${f.phone}: ${b.phone}`)
  if (b.hours) contact.push(`${f.hours}: ${b.hours}`)
  if (contact.length) lines.push('', `${f.help}`, ...contact)
  if (b.address) lines.push('', `${f.address}: ${b.address}`)
  if (siteUrl) lines.push('', siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, ''))
  lines.push('', f.reason, f.transactional, `© ${year} ${b.name}${b.legalName ? ` — ${b.legalName}` : ''}. ${f.rights}`)
  return lines.join('\n')
}

function footerHtml({ l, brand, siteUrl, allowLinks, year }) {
  const f = FOOT[l]
  const a = (href, label) =>
    allowLinks ? `<a href="${esc(href)}" target="_blank" style="color:${C.son};text-decoration:none;font-weight:600">${esc(label)}</a>` : `<span style="color:${C.than};font-weight:600">${esc(label)}</span>`
  const host = siteUrl ? siteUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '') : ''
  const small = `font:12px/1.6 ${SANS};color:${C.thanSoft}`

  const contact = []
  if (brand.supportEmail) contact.push(`${esc(f.email)}: ${a(`mailto:${brand.supportEmail}`, brand.supportEmail)}`)
  if (brand.phone) contact.push(`${esc(f.phone)}: ${a(telHref(brand.phone), brand.phone)}`)
  const contactBlock = contact.length
    ? `<p style="margin:0 0 4px;font:600 13px/1.6 ${SANS};color:${C.than}">${esc(f.help)}</p><p style="margin:0 0 4px;font:13px/1.7 ${SANS};color:${C.thanSoft}">${contact.join(' &nbsp;·&nbsp; ')}</p>${
        brand.hours ? `<p style="margin:0 0 4px;${small}">${esc(f.hours)}: ${esc(brand.hours)}</p>` : ''
      }`
    : ''
  const addressBlock = brand.address ? `<p style="margin:10px 0 0;${small}">${esc(f.address)}: ${esc(brand.address)}</p>` : ''
  const socialBlock =
    allowLinks && brand.social.length
      ? `<p style="margin:12px 0 0;font:600 12px/1.6 ${SANS};color:${C.thanSoft}">${esc(f.follow)}: ${brand.social
          .map((s) => `<a href="${esc(s.url)}" target="_blank" style="color:${C.son};text-decoration:none">${esc(s.label)}</a>`)
          .join(' &nbsp;·&nbsp; ')}</p>`
      : ''
  const hostBlock = host ? `<p style="margin:10px 0 0;${small}">${a(siteUrl, host)}</p>` : ''

  return `<tr><td bgcolor="${C.diep}" style="background:${C.diep};border-top:1px solid ${C.hoeLight};padding:26px 38px 28px">
      <p style="margin:0;font:700 18px/1.3 ${SERIF};letter-spacing:2px;color:${C.than}">${esc(brand.name)}</p>
      <p style="margin:4px 0 16px;font:13px/1.5 ${SERIF};font-style:italic;color:${C.thanSoft}">${esc(f.tagline)}</p>
      ${contactBlock}${addressBlock}${socialBlock}${hostBlock}
      <p style="margin:18px 0 0;padding-top:14px;border-top:1px dashed ${C.hoeLight};${small}">${esc(f.reason)}<br>${esc(f.transactional)}<br>${esc(brand.supportEmail || brand.phone ? f.noreplyHelp : f.noreply)}</p>
      <p style="margin:10px 0 0;font:11px/1.6 ${SANS};color:${C.thanSoft}">© ${year} ${esc(brand.name)}${brand.legalName ? ` — ${esc(brand.legalName)}` : ''}. ${esc(f.rights)}</p>
    </td></tr>`
}

/**
 * @param {object} p
 * @param {string} p.lang
 * @param {string} [p.siteUrl] có → hiện banner ảnh (ảnh phải ở địa chỉ https công khai); không → banner chữ
 * @param {object} [p.brand] thông tin doanh nghiệp (xem normalizeBrand)
 * @param {boolean} [p.allowLinks] false → chân thư chỉ có chữ, không liên kết (thư báo đổi mật khẩu: chống lừa đảo)
 * @param {string} [p.eyebrow] nhãn phân loại nhỏ phía trên tiêu đề
 * @param {string} p.title
 * @param {string[]} p.paragraphs
 * @param {string[]} [p.notes] lưu ý, hiện trong hộp có vạch son bên trái
 * @param {{title: string, meta?: [string,string][], lines: string[], totalLabel: string, totalValue: string}|null} [p.summary]
 * @param {{url: string, label: string}|null} [p.cta]
 * @param {string} [p.fallback] câu "nếu nút không bấm được, sao chép liên kết" (kèm cta)
 * @param {number} [p.year]
 */
export function layout({ lang, siteUrl, brand, allowLinks = true, eyebrow = '', title, paragraphs, notes = [], summary = null, cta = null, fallback = '', year = new Date().getFullYear() }) {
  const l = lang3(lang)
  const b = normalizeBrand(brand)
  const banner = siteUrl
    ? `<img src="${esc(siteUrl + MAIL_BANNER_PATH)}" width="600" alt="${esc(BANNER_ALT[l])}" style="display:block;width:100%;max-width:600px;height:auto;border:0;font:600 22px ${SERIF};color:${C.diepLight};text-align:center">`
    : `<div style="padding:34px 20px;text-align:center;font:700 34px ${SERIF};letter-spacing:4px;color:${C.diepLight}">${esc(b.name)}</div>`
  const preheader = cut(paragraphs[0] ?? title, 110)
  const row = (extra) => `padding:7px 0;border-bottom:1px dashed ${C.hoeLight};${extra ?? ''}`

  const summaryHtml = summary
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0 6px;background:#ffffff;border:1px solid ${C.hoeLight};border-radius:12px"><tr><td style="padding:18px 22px;font:15px/1.6 ${SANS};color:${C.than}">
        ${(summary.meta ?? []).map(([k, v]) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="${row('font-size:13px;color:' + C.thanSoft)}">${esc(k)}</td><td align="right" style="${row('font-weight:700;letter-spacing:.5px')}">${esc(v)}</td></tr></table>`).join('')}
        <div style="margin:12px 0 4px;font:600 12px/1.4 ${SANS};letter-spacing:1.5px;text-transform:uppercase;color:${C.hoe}">${esc(summary.title)}</div>
        ${summary.lines.map((x) => `<div style="${row()}">${esc(x)}</div>`).join('')}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:12px"><tr><td style="font:600 15px/1.4 ${SANS};color:${C.than}">${esc(summary.totalLabel)}</td><td align="right" style="font:700 19px/1.4 ${SERIF};color:${C.son}">${esc(summary.totalValue)}</td></tr></table>
      </td></tr></table>`
    : ''

  const notesHtml = notes
    .map(
      (n) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 14px"><tr><td width="4" bgcolor="${C.son}" style="background:${C.son};border-radius:4px"></td><td style="padding:10px 16px;background:${C.diep};border-radius:0 8px 8px 0;font:14px/1.6 ${SANS};color:${C.thanSoft}">${esc(n)}</td></tr></table>`,
    )
    .join('')

  const ctaHtml = cta
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0 8px"><tr><td align="center" bgcolor="${C.son}" style="border-radius:10px;background:${C.son}"><a href="${esc(cta.url)}" target="_blank" style="display:inline-block;padding:14px 32px;font:700 16px ${SANS};color:#ffffff;text-decoration:none;border-radius:10px">${esc(cta.label)}</a></td></tr></table>${
        fallback
          ? `<p style="margin:12px 0 0;font:13px/1.5 ${SANS};color:${C.thanSoft}">${esc(fallback)}<br><span style="word-break:break-all;color:${C.son}">${esc(cta.url)}</span></p>`
          : ''
      }`
    : ''

  return `<!doctype html>
<html lang="${htmlLang(l)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:${C.diepDeep};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all">${esc(preheader)}&#8199;&#847;&#8199;&#847;&#8199;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.diepDeep}" style="background:${C.diepDeep}"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:${C.diepLight};border-radius:16px;overflow:hidden;border:1px solid ${C.hoeLight}">
    <tr><td bgcolor="${C.chamDeep}" style="background:${C.chamDeep};line-height:0;font-size:0">${banner}</td></tr>
    <tr><td height="4" bgcolor="${C.son}" style="background:${C.son};height:4px;line-height:4px;font-size:4px">&nbsp;</td></tr>
    <tr><td style="padding:34px 38px 14px;font:16px/1.65 ${SANS};color:${C.than}">
      ${eyebrow ? `<div style="margin:0 0 10px;font:700 12px/1.4 ${SANS};letter-spacing:2px;text-transform:uppercase;color:${C.hoe}">${esc(eyebrow)}</div>` : ''}
      <h1 style="margin:0 0 18px;font:700 25px/1.3 ${SERIF};color:${C.than}">${esc(title)}</h1>
      ${paragraphs.map((p) => `<p style="margin:0 0 14px">${esc(p)}</p>`).join('')}
      ${notesHtml}
      ${summaryHtml}
      ${ctaHtml}
    </td></tr>
    <tr><td style="padding:0 0 0;line-height:0;font-size:0">&nbsp;</td></tr>
    ${footerHtml({ l, brand: b, siteUrl, allowLinks, year })}
  </table>
</td></tr></table>
</body></html>`
}
