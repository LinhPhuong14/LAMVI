import { Router } from 'express'
import { HTML_LANG, LOCALES, localePath } from '../../src/i18n/core.js'
import { PUBLIC_PRODUCT_STATUSES } from '../domain/catalog.js'

const xml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c])

// §23.2: sitemap (URL mỗi ngôn ngữ + hreflang) và robots.txt
export function seoRouter({ repo, config }) {
  const r = Router()
  const site = () => config.publicSiteUrl

  r.get('/sitemap.xml', async (req, res) => {
    // Chỉ trang công khai được index: trang chủ + sản phẩm Published (D-39). Trang lô noindex (D-44)
    const products = await repo.listProducts({ statuses: PUBLIC_PRODUCT_STATUSES })
    const pages = [{ path: '/' }, ...products.map((p) => ({ path: `/products/${encodeURIComponent(p.slug)}`, lastmod: p.updatedAt }))]
    const urls = pages.flatMap(({ path, lastmod }) =>
      LOCALES.map((lang) => {
        const alternates = [
          ...LOCALES.map((l) => `    <xhtml:link rel="alternate" hreflang="${HTML_LANG[l]}" href="${xml(site() + localePath(l, path))}"/>`),
          `    <xhtml:link rel="alternate" hreflang="x-default" href="${xml(site() + localePath('vi', path))}"/>`,
        ]
        return [
          '  <url>',
          `    <loc>${xml(site() + localePath(lang, path))}</loc>`,
          ...(lastmod && !Number.isNaN(Date.parse(lastmod)) ? [`    <lastmod>${xml(new Date(lastmod).toISOString())}</lastmod>`] : []),
          ...alternates,
          '  </url>',
        ].join('\n')
      }),
    )
    res.type('application/xml').send(
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>\n`,
    )
  })

  r.get('/robots.txt', (req, res) => {
    // Trang riêng tư dùng noindex (không Disallow để bot đọc được noindex); chỉ chặn API và admin
    // /admin$ + /admin/ để không chặn nhầm đường dẫn khác bắt đầu bằng "/admin"
    res.type('text/plain').send(`User-agent: *\nDisallow: /api/\nDisallow: /admin$\nDisallow: /admin/\n\nSitemap: ${site()}/sitemap.xml\n`)
  })

  return r
}
