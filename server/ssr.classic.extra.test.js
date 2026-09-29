// Kiểm thử độc lập (T-11) cho SSR sau đổi giao diện cổ điển: ấn triện dọc thay dấu bưu điện.
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { JSDOM } from 'jsdom'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { renderPage } from './ssr.js'
import { render } from '../src/entry-server.jsx'

const config = { publicSiteUrl: 'https://moc.test' }
const root = new URL('..', import.meta.url).pathname
const template = readFileSync(`${root}index.html`, 'utf8')
const page = (url) => renderPage({ repo: createMemoryRepo(), config, template, render, url, pathname: url })

describe('SSR trang chủ — ấn triện dọc', () => {
  it.each(['/', '/en', '/zh'])('%s: có .hero-seal > .vseal (L/A/M/V/I, aria-hidden), không có postmark / story-cloud', async (url) => {
    const r = await page(url)
    expect(r.status).toBe(200)
    expect(r.html).not.toMatch(/postmark/i)
    expect(r.html).not.toContain('story-cloud')
    const doc = new JSDOM(r.html).window.document
    const seal = doc.querySelector('.hero-seal .vseal')
    expect(seal).not.toBeNull()
    expect(seal.getAttribute('aria-hidden')).toBe('true')
    expect([...seal.children].map((c) => c.textContent)).toEqual(['L', 'A', 'M', 'V', 'I'])
  })
})
