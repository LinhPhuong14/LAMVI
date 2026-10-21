import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { buildCsp } from './middleware/security.js'
import { renderPage } from './ssr.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { render } from '../src/entry-server.jsx'

describe('mascot Mây — CSP và SSR', () => {
  it("img-src 'self' cho phép /images/may/*", () => {
    expect(buildCsp({ gaEnabled: false })).toMatch(/img-src [^;]*'self'/)
  })
  it('SSR trang chủ: Mây QR trong aria-hidden, không focus được', async () => {
    const root = new URL('..', import.meta.url).pathname
    const r = await renderPage({
      repo: createMemoryRepo(), config: { publicSiteUrl: 'https://moc.test' },
      template: readFileSync(`${root}index.html`, 'utf8'), render, url: '/', pathname: '/',
    })
    expect(r.status).toBe(200)
    const wrap = new JSDOM(r.html).window.document.querySelector('.phone-may')
    expect(wrap.getAttribute('aria-hidden')).toBe('true')
    const img = wrap.querySelector('img')
    expect(img.getAttribute('src')).toBe('/images/may/qr.webp')
    expect(img.getAttribute('alt')).toBe('')
    expect(wrap.querySelectorAll('a,button,input,[tabindex]').length).toBe(0)
  })
})
