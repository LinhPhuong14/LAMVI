// Kiểm thử độc lập trang Cửa hàng /shop: SSR qua createWeb thật + sitemap (T-49, D-85)
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createWeb } from './ssr.js'
import { translate } from '../src/i18n/core.js'
import { products } from './data/seed.js'

const SITE = 'https://moc.test'
const config = { publicSiteUrl: SITE }
const HTML_LANG = { vi: 'vi', en: 'en', zh: 'zh-Hans' }
const URLS = { vi: '/shop', en: '/en/shop', zh: '/zh/shop' }
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

let app
async function getApp() {
  if (!app) {
    const repo = createMemoryRepo()
    app = createApp({ repo, config, web: await createWeb({ repo, config, dev: true }) })
  }
  return app
}

describe.each(['vi', 'en', 'zh'])('GET %s /shop (SSR qua web layer)', (lang) => {
  it('200, title/description/canonical/hreflang, tên sản phẩm trong HTML, không noindex, BreadcrumbList', async () => {
    const res = await request(await getApp()).get(URLS[lang])
    expect(res.status).toBe(200)
    expect(res.type).toBe('text/html')
    expect(res.headers['x-robots-tag']).toBeUndefined()
    const html = res.text
    expect(html).toContain(`<html lang="${HTML_LANG[lang]}">`)
    expect(html).toContain(`<title data-seo>${esc(translate(lang, 'meta.shopTitle'))}</title>`)
    expect(html).toContain(esc(translate(lang, 'meta.shopDescription')))
    expect(html).toMatch(/<meta name="description" content="[^"]+"/)
    expect(html).not.toMatch(/<meta name="robots"[^>]*noindex/)
    expect(html).toContain(`<link rel="canonical" href="${SITE}${URLS[lang]}" data-seo>`)
    for (const l of ['vi', 'en', 'zh']) {
      expect(html).toContain(`hreflang="${HTML_LANG[l]}" href="${SITE}${URLS[l]}"`)
    }
    expect(html).toContain(`hreflang="x-default" href="${SITE}/shop"`)
    for (const p of products.filter((x) => x.status === 'published' || x.status === undefined)) {
      expect(html, p.slug).toContain(esc(p.name[lang]))
    }
    expect(html).toContain('product-card')
    const lds = [...html.matchAll(/<script type="application\/ld\+json" data-seo>(.*?)<\/script>/gs)].map((m) => JSON.parse(m[1]))
    const bc = lds.find((j) => j['@type'] === 'BreadcrumbList')
    expect(bc).toBeTruthy()
    expect(bc.itemListElement).toHaveLength(2)
    expect(bc.itemListElement[1].name).toBe(translate(lang, 'nav.shop'))
    expect(JSON.stringify(bc)).toContain(`${SITE}${URLS[lang]}`)
  })
})

describe('sitemap có /shop', () => {
  it('3 ngôn ngữ, mỗi <url> có 4 alternate (vi, en, zh-Hans, x-default)', async () => {
    const res = await request(createApp({ repo: createMemoryRepo(), config })).get('/sitemap.xml')
    expect(res.status).toBe(200)
    const blocks = res.text.split('<url>').slice(1)
    for (const lang of ['vi', 'en', 'zh']) {
      const b = blocks.filter((x) => x.includes(`<loc>${SITE}${URLS[lang]}</loc>`))
      expect(b, lang).toHaveLength(1)
      const alts = [...b[0].matchAll(/<xhtml:link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)]
      expect(alts.map((a) => a[1])).toEqual(['vi', 'en', 'zh-Hans', 'x-default'])
      expect(alts.map((a) => a[2])).toEqual([`${SITE}/shop`, `${SITE}/en/shop`, `${SITE}/zh/shop`, `${SITE}/shop`])
    }
  })
})
