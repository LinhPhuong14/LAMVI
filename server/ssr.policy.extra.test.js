// Kiểm thử độc lập (T-11) cho G-10: SSR /privacy, /returns ở ba ngôn ngữ (tách khỏi PolicyPage.extra.test.jsx vì cần môi trường node)
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'
import vi from '../src/i18n/messages/vi.js'
import en from '../src/i18n/messages/en.js'
import zh from '../src/i18n/messages/zh.js'

const SITE = 'https://moc.test'
const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const ssr = (url) => renderPage({ repo: createMemoryRepo(), config: { publicSiteUrl: SITE }, template, render, url, pathname: url })
const mods = { vi, en, zh }
const pol = (l) => (mods[l].default ?? mods[l]).policy

describe('SSR trang chính sách', () => {
  const cases = [
    ['/privacy', 'vi', 'Chính sách riêng tư', '/privacy'],
    ['/returns', 'vi', 'Chính sách đổi trả', '/returns'],
    ['/en/returns', 'en', 'Return Policy', '/en/returns'],
    ['/en/privacy', 'en', 'Privacy Policy', '/en/privacy'],
    ['/zh/privacy', 'zh-Hans', '隐私政策', '/zh/privacy'],
    ['/zh/returns', 'zh-Hans', '退换货政策', '/zh/returns'],
  ]
  it.each(cases)('%s → 200, h1, title/description/canonical/hreflang, không noindex', async (url, lang, h1, canon) => {
    const r = await ssr(url)
    expect(r.status).toBe(200)
    expect(r.noindex).toBe(false)
    const doc = new JSDOM(r.html).window.document
    expect(doc.documentElement.lang).toBe(lang)
    expect(doc.querySelectorAll('h1')).toHaveLength(1)
    expect(doc.querySelector('h1').textContent).toBe(h1)
    expect(doc.querySelectorAll('title')).toHaveLength(1)
    expect(doc.title).toContain(h1)
    const key = url.endsWith('privacy') ? 'privacy' : 'returns'
    const l = lang === 'zh-Hans' ? 'zh' : lang
    expect(doc.querySelector('meta[name="description"]').getAttribute('content')).toBe(pol(l)[key].description)
    expect(doc.querySelector('link[rel="canonical"]').getAttribute('href')).toBe(SITE + canon)
    expect(doc.querySelector('meta[name="robots"]')).toBeNull()
    const alts = Object.fromEntries([...doc.querySelectorAll('link[rel="alternate"]')].map((a) => [a.getAttribute('hreflang'), a.getAttribute('href')]))
    expect(alts).toEqual({
      vi: `${SITE}/${key}`,
      en: `${SITE}/en/${key}`,
      'zh-Hans': `${SITE}/zh/${key}`,
      'x-default': `${SITE}/${key}`,
    })
    expect(doc.querySelectorAll('h2').length).toBeGreaterThanOrEqual(pol(l)[key].sections.length)
  })
  it('footer SSR có link đúng theo ngôn ngữ', async () => {
    const doc = new JSDOM((await ssr('/zh/privacy')).html).window.document
    const hrefs = [...doc.querySelectorAll('footer a')].map((a) => a.getAttribute('href'))
    expect(hrefs).toContain('/zh/privacy')
    expect(hrefs).toContain('/zh/returns')
  })
})
