// Sinh thẻ <head> cho SEO (FR-SEO-001, §23.2) — dùng chung cho SSR (chuỗi HTML) và client (DOM).
import { HTML_LANG, LOCALES, localePath } from '../i18n/core.js'

const OG_LOCALE = { vi: 'vi_VN', en: 'en_US', zh: 'zh_CN' }

// D-62: tên thương hiệu. G-23: ảnh chia sẻ mặc định (1200×630) khi trang không có ảnh riêng.
export const SITE_NAME = 'LAMVI'

/** Bỏ dấu "/" thừa ở cuối URL gốc — canonical/hreflang/sitemap nối thẳng đường dẫn vào sau. */
export const normalizeSiteUrl = (url) => String(url ?? '').replace(/\/+$/, '')
export const DEFAULT_OG_IMAGE = '/images/og/default.png'
export const OG_IMAGE_SIZE = { width: 1200, height: 630 }

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
export function buildHeadTags({
  lang,
  siteUrl,
  path,
  title,
  description,
  noindex = false,
  type = 'website',
  jsonLd,
  image,
}) {
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
  tags.push({ tag: 'meta', attrs: { property: 'og:site_name', content: SITE_NAME } })
  // G-23: ảnh chia sẻ — tuyệt đối hoá để Facebook/Zalo đọc được
  const ogImage = absoluteUrl(siteUrl, image ?? DEFAULT_OG_IMAGE)
  if (ogImage) {
    tags.push({ tag: 'meta', attrs: { property: 'og:image', content: ogImage } })
    tags.push({ tag: 'meta', attrs: { property: 'og:image:width', content: String(OG_IMAGE_SIZE.width) } })
    tags.push({ tag: 'meta', attrs: { property: 'og:image:height', content: String(OG_IMAGE_SIZE.height) } })
    tags.push({ tag: 'meta', attrs: { name: 'twitter:card', content: 'summary_large_image' } })
    tags.push({ tag: 'meta', attrs: { name: 'twitter:image', content: ogImage } })
  }
  if (title) tags.push({ tag: 'meta', attrs: { name: 'twitter:title', content: title } })
  if (description) tags.push({ tag: 'meta', attrs: { name: 'twitter:description', content: description } })
  if (jsonLd) {
    for (const block of [jsonLd].flat()) {
      if (block) tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, text: safeJson(block) })
    }
  }
  return tags
}

/** Đường dẫn tương đối → URL tuyệt đối; URL tuyệt đối giữ nguyên. */
export function absoluteUrl(siteUrl, url) {
  if (!url) return null
  if (/^https?:\/\//i.test(url)) return url
  if (!siteUrl) return null
  const base = normalizeSiteUrl(siteUrl)
  return `${base}${url.startsWith('/') ? '' : '/'}${url}`
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

// D-68 (thay D-50): JSON-LD sản phẩm — giá ĐÃ gồm VAT, valueAddedTaxIncluded=true (khớp cách hiển thị, BR-PRC-003)
export function productJsonLd(p, url, siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: p.name,
    description: p.description ?? undefined,
    // G-23: ảnh thật của sản phẩm nếu có; không có thì bỏ trường (không nhét ảnh OG chung vào)
    image: absoluteUrl(siteUrl, p.image?.url) ?? undefined,
    url,
    brand: { '@type': 'Brand', name: 'LAMVI' },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'VND',
      price: p.price,
      priceSpecification: {
        '@type': 'UnitPriceSpecification',
        price: p.price,
        priceCurrency: 'VND',
        valueAddedTaxIncluded: true,
      },
    },
  }
}

// §23.2 — dữ liệu có cấu trúc cấp trang chủ. Giúp Google hiểu thương hiệu và ô tìm kiếm trang web.
export function organizationJsonLd(siteUrl) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}/#organization`,
    name: SITE_NAME,
    url: siteUrl,
    logo: absoluteUrl(siteUrl, DEFAULT_OG_IMAGE),
  }
}

export function webSiteJsonLd(siteUrl, { lang, name, description }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}/#website`,
    url: `${siteUrl}${localePath(lang, '/')}`,
    name: name ?? SITE_NAME,
    description: description ?? undefined,
    inLanguage: HTML_LANG[lang],
    publisher: { '@id': `${siteUrl}/#organization` },
  }
}

/**
 * Đường dẫn phân cấp cho trang con (Google hiển thị thay cho URL trong kết quả tìm kiếm).
 * @param {Array<{name: string, path: string}>} crumbs path là đường dẫn chưa có tiền tố ngôn ngữ
 */
export function breadcrumbJsonLd(siteUrl, lang, crumbs) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${siteUrl}${localePath(lang, c.path)}`,
    })),
  }
}
