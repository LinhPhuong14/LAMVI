// Kiểm thử độc lập (T-11): SSR thanh điều hướng đáy — đúng 1 thanh, không phụ thuộc window
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { renderPage } from './ssr.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { render } from '../src/entry-server.jsx'

const root = new URL('..', import.meta.url).pathname
const run = (u) =>
  renderPage({ repo: createMemoryRepo(), config: { publicSiteUrl: 'https://moc.test' }, template: readFileSync(`${root}index.html`, 'utf8'), render, url: u, pathname: u })

describe('SSR thanh đáy', () => {
  it.each([['/', '/shop', 'Trang chủ'], ['/en/shop', '/en/shop', 'Home']])('%s: đúng 1 nav.tabbar, has-tabbar 1 lần', async (u, _active) => {
    expect(typeof window).toBe('undefined')
    const r = await run(u)
    expect(r.status).toBe(200)
    expect(r.html.match(/<nav class="tabbar"/g)?.length).toBe(1)
    expect(r.html.match(/page has-tabbar/g)?.length).toBe(1)
    expect(r.html).toMatch(/class="tabbar-item[^"]*"[^>]*href="\/(en\/)?cart"|href="\/(en\/)?cart"[^>]*class="tabbar-item/)
  }, 30000)
  it.each(['/cart', '/en/cart', '/zh/checkout', '/en/products/khong-co', '/login', '/en/login', '/en/account'])('%s: không có thanh đáy', async (u) => {
    const r = await run(u)
    expect(r.html).not.toContain('class="tabbar"')
  }, 30000)
  it('trang 404 không có thanh đáy', async () => {
    const r = await run('/khong-co')
    expect(r.status).toBe(404)
    expect(r.html).not.toContain('class="tabbar"')
  }, 30000)
})
