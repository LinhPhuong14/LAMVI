// Kiểm thử độc lập createWeb thật (Vite middleware, như `npm run dev`) — D-49, BR-SEO-001
import { describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createWeb } from './ssr.js'

const config = { publicSiteUrl: 'https://moc.test' }

let app
async function getApp() {
  if (!app) {
    const repo = createMemoryRepo()
    app = createApp({ repo, config, web: await createWeb({ repo, config, dev: true }) })
  }
  return app
}

describe('createWeb (dev)', () => {
  it('trang công khai: 200 text/html, không X-Robots-Tag; lô/404/riêng tư: X-Robots-Tag noindex', async () => {
    const a = await getApp()
    const home = await request(a).get('/en')
    expect(home.status).toBe(200)
    expect(home.type).toBe('text/html')
    expect(home.headers['x-robots-tag']).toBeUndefined()
    expect(home.text).toContain('<html lang="en">')
    expect(home.text).toContain('window.__INITIAL_DATA__=')
    expect(home.text).not.toContain('<!--app-')

    for (const [url, status] of [
      ['/lo/DEMO-2026-01', 200],
      ['/khong-co', 404],
      ['/products/khong-co', 404],
      ['/login', 200],
      ['/en/account', 200],
      ['/admin/products', 200],
    ]) {
      const res = await request(a).get(url)
      expect(res.status, url).toBe(status)
      expect(res.headers['x-robots-tag'], url).toBe('noindex')
      expect(res.type, url).toBe('text/html')
    }
  }, 30000)

  it('/api/* vẫn JSON 404 khi có Vite middleware', async () => {
    const a = await getApp()
    for (const url of ['/api/khong-co', '/api/products/khong-co']) {
      const res = await request(a).get(url)
      expect(res.status).toBe(404)
      expect(res.type).toBe('application/json')
    }
  }, 30000)

  it.each(['/%', '/products/%E0%A4%A', '/lo/%zz', '/en/%'])('URL percent-encoding hỏng %s không làm 500', async (url) => {
    const a = await getApp()
    const res = await request(a).get(url)
    expect(res.status).toBeLessThan(500)
  }, 30000)
})

describe('renderPage: slug percent-encoding hỏng', () => {
  it.each(['/products/%E0%A4%A', '/en/products/%zz', '/lo/%zz', '/zh/lo/%E0%A4%A'])(
    '%s → 404 + noindex (không phải trang "đang tải" 200 không title)',
    async (url) => {
      const { readFileSync } = await import('node:fs')
      const { renderPage } = await import('./ssr.js')
      const { render } = await import('../src/entry-server.jsx')
      const template = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
      const r = await renderPage({ repo: createMemoryRepo(), config, template, render, url, pathname: url })
      expect(r.status).toBe(404)
      expect(r.noindex).toBe(true)
      expect(r.html).toMatch(/<title data-seo>/)
    },
  )
})
