// Sinh thẻ <head> cho SEO (FR-SEO-001, §23.2) — dùng chung cho SSR (chuỗi HTML) và client (DOM).
import { HTML_LANG, LOCALES, localePath } from '../i18n/core.js'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', zh: 'zh_CN' }

// Chống thoát khỏi <script> khi nhúng JSON vào HTML
export function safeJson(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029')
}

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])

/**
 * @param {object} p
 * @param {string} p.lang    vi | en | zh
 * @param {string} p.siteUrl gốc URL, vd https://moc.vn
 * @param {string} [p.path]  đường dẫn không có tiền tố ngôn ngữ, vd /products/den-nguyet
 * @param {string} [p.title]
 * @param {string} [p.description]
 * @param {boolean} [p.noindex]
 * @param {string} [p.type]  og:type
 * @param {object} [p.jsonLd]
 */
export function buildHeadTags({ lang, siteUrl, path, title, description, noindex = false, type = 'website', jsonLd }) {
  const tags = []
  if (title) tags.push({ tag: 'title', text: title })
  if (description) tags.push({ tag: 'meta', attrs: { name: 'description', content: description } })
  // BR-SEO-001: trang noindex không cần canonical/hreflang. Meta robots do useNoIndex (client)
  // và server (SSR, theo collector.noindex) chèn — không sinh ở đây để khỏi trùng.
  if (noindex) return tags
  if (path) {
    const url = (l) => `${siteUrl}${localePath(l, path)}`
    tags.push({ tag: 'link', attrs: { rel: 'canonical', href: url(lang) } })
    // §23.2: URL riêng mỗi ngôn ngữ + hreflang (D-37)
    for (const l of LOCALES) tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: HTML_LANG[l], href: url(l) } })
    tags.push({ tag: 'link', attrs: { rel: 'alternate', hreflang: 'x-default', href: url('vi') } })
    tags.push({ tag: 'meta', attrs: { property: 'og:url', content: url(lang) } })
  }
  if (title) tags.push({ tag: 'meta', attrs: { property: 'og:title', content: title } })
  if (description) tags.push({ tag: 'meta', attrs: { property: 'og:description', content: description } })
  tags.push({ tag: 'meta', attrs: { property: 'og:type', content: type } })
  tags.push({ tag: 'meta', attrs: { property: 'og:locale', content: OG_LOCALE[lang] } })
  if (jsonLd) tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: safeJson(jsonLd) })
  return tags
}

// SSR: thẻ → chuỗi HTML (đánh dấu data-seo để client thay thế)
export function renderHeadTags(tags, { noindex = false } = {}) {
  const all = noindex ? [...tags, { tag: 'meta', attrs: { name: 'robots', content: 'noindex' } }] : tags
  return all
    .map(({ tag, attrs = {}, text }) => {
      const a = Object.entries({ ...attrs, 'data-seo': '' })
        .map(([k, v]) => (v === '' ? ` ${k}` : ` ${k}="${esc(v)}"`))
        .join('')
      if (tag === 'meta' || tag === 'link') return `<${tag}${a}>`
      // text của script ld+json đã qua safeJson; title cần escape
      return `<${tag}${a}>${tag === 'script' ? text : esc(text)}</${tag}>`
    })
    .join('\n    ')
}

// Client: thay các thẻ data-seo hiện có bằng thẻ mới
export function applyHeadTags(doc, tags) {
  doc.head.querySelectorAll('[data-seo]').forEach((el) => el.remove())
  for (const { tag, attrs = {}, text } of tags) {
    if (tag === 'title') {
      doc.title = text
      continue
    }
    const el = doc.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    el.setAttribute('data-seo', '')
    if (text) el.textContent = tag === 'script' ? JSON.stringify(JSON.parse(text)) : text
    doc.head.appendChild(el)
  }
}

// D-50: JSON-LD sản phẩm — giá chưa VAT, ghi rõ valueAddedTaxIncluded=false (khớp cách hiển thị, BR-PRC-003)
export function productJsonLd(p, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? undefined,
    url,
    brand: { '@type': 'Brand', name: 'LAMVI' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'VND',
      price: p.priceExclVat,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: p.priceExclVat,
        priceCurrency: 'VND',
        valueAddedTaxIncluded: false,
      },
    },
  }
}
