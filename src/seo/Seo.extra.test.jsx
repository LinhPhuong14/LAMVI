// @vitest-environment jsdom
// Kiểm thử độc lập: SSR → hydrate trên client (D-49), head sau khi client chạy (FR-SEO-001, BR-SEO-001)
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act } from '@testing-library/react'
import { hydrateRoot, createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import request from 'supertest'
import AppShell from '../AppShell.jsx'
import { createDataStore } from './context.js'
import { render as ssrRender } from '../entry-server.jsx'
import { classifyPath, dataKeysFor } from './routes.js'
import { buildHeadTags, renderHeadTags, safeJson } from './head.js'
import { HTML_LANG, translate } from '../i18n/core.js'
import { getPublicBatch, getPublicProduct, listPublicFaq, listPublicProducts } from '../../server/services/catalog.js'
import { createApp } from '../../server/app.js'
import { createMemoryRepo } from '../../server/adapters/memory/repo.js'
import { products } from '../../server/data/seed.js'

const SITE = 'http://localhost:3000'
const config = { publicSiteUrl: SITE }
const template = readFileSync(`${process.cwd()}/index.html`, 'utf8')

// server/ssr.js dùng fileURLToPath(import.meta.url) — không nạp được trong môi trường jsdom của Vitest.
// Tái hiện renderPage (cùng hàm con) để có HTML SSR y như server trả.
async function renderPage({ repo, url, pathname }) {
  const route = classifyPath(pathname)
  const fill = (head, html, data) =>
    template
      .replace('<html lang="vi">', `<html lang="${HTML_LANG[route.lang]}">`)
      .replace('<!--app-head-->', head)
      .replace('<!--app-html-->', html)
      .replace('<!--app-data-->', data ? `<script>window.__INITIAL_DATA__=${safeJson(data)}</script>` : '')
  if (route.kind === 'private') {
    const tags = buildHeadTags({ lang: route.lang, siteUrl: SITE, title: translate(route.lang, 'meta.title'), noindex: true })
    return { status: 200, noindex: true, html: fill(renderHeadTags(tags, { noindex: true }), '', null) }
  }
  const data = {}
  for (const path of dataKeysFor(route)) {
    try {
      let d
      if (path === '/products') d = await listPublicProducts(repo, route.lang)
      else if (path === '/faq') d = await listPublicFaq(repo, route.lang)
      else if (route.kind === 'product') d = await getPublicProduct(repo, route.slug, route.lang)
      else d = await getPublicBatch(repo, route.code, route.lang)
      data[`${path}|${route.lang}`] = { data: d }
    } catch (err) {
      data[`${path}|${route.lang}`] = { error: { status: err.status ?? 500, code: err.code ?? 'INTERNAL_ERROR' } }
    }
  }
  const { html, head } = ssrRender(url, { initialData: data, siteUrl: SITE })
  return { status: head.status, noindex: head.noindex, html: fill(renderHeadTags(head.tags, { noindex: head.noindex }), html, data) }
}

// fetch trên client đi qua API thật (adapter bộ nhớ) để dữ liệu khớp SSR
function stubFetchTo(repo) {
  const app = createApp({ repo, config })
  const fetchMock = vi.fn(async (input) => {
    const res = await request(app).get(String(input))
    return new Response(JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } })
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Dựng lại document từ HTML SSR (head + #root) như trình duyệt nhận được
async function ssrThenHydrate(url, { repo = createMemoryRepo(), hydrate = true } = {}) {
  const pathname = url.split(/[?#]/)[0]
  const page = await renderPage({ repo, url, pathname })
  const doc = new DOMParser().parseFromString(page.html, 'text/html')
  document.head.innerHTML = doc.head.innerHTML
  document.title = doc.title
  document.body.innerHTML = ''
  const root = document.createElement('div')
  root.id = 'root'
  root.innerHTML = doc.getElementById('root').innerHTML
  document.body.appendChild(root)
  const m = page.html.match(/<script>window\.__INITIAL_DATA__=(.*?)<\/script>/)
  const initialData = m ? JSON.parse(m[1]) : undefined
  window.history.replaceState(null, '', url)

  const fetchMock = stubFetchTo(repo)
  const recoverable = []
  const errors = []
  const errSpy = vi.spyOn(console, 'error').mockImplementation((...a) => errors.push(a.map(String).join(' ')))
  const app = (
<AppShell dataStore={createDataStore(initialData)} Router={BrowserRouter} />
  )
  let reactRoot
  await act(async () => {
    if (hydrate && root.hasChildNodes()) {
      reactRoot = hydrateRoot(root, app, { onRecoverableError: (e) => recoverable.push(String(e?.message ?? e)) })
    } else {
      reactRoot = createRoot(root)
      reactRoot.render(app)
    }
  })
  return { page, root, reactRoot, fetchMock, recoverable, errors, errSpy, initialData }
}

// Điều hướng BrowserRouter như nút back/forward: pushState + popstate
async function clientNavigate(to) {
  await act(async () => {
    window.history.pushState(null, '', to)
    window.dispatchEvent(new PopStateEvent('popstate', { state: null }))
  })
}

async function flush() {
  for (let i = 0; i < 5; i++) {
    await act(async () => {
      await new Promise((r) => setTimeout(r, 10))
    })
  }
}

const HYDRATION_RE = /hydrat|did not match|mismatch/i

let mounted = []
beforeEach(() => {
  mounted = []
})
afterEach(() => {
  for (const r of mounted) act(() => r.unmount())
  document.head.innerHTML = ''
  vi.restoreAllMocks()
})

const PUBLIC_URLS = [
  '/',
  '/en',
  '/zh',
  '/products/den-nguyet',
  '/en/products/den-vong',
  '/zh/products/den-sum-vay',
  '/lo/DEMO-2026-01',
  '/en/lo/DEMO-2026-01',
  '/khong-co-trang-nay',
  '/products/khong-co',
  '/lo/KHONG-CO',
]

describe('Hydrate HTML SSR (D-49)', () => {
  it.each(PUBLIC_URLS)('%s: hydrate không lệch, không gọi fetch ở lần đầu', async (url) => {
    const h = await ssrThenHydrate(url)
    mounted.push(h.reactRoot)
    await flush()
    expect(h.root.hasChildNodes()).toBe(true)
    expect(h.recoverable).toEqual([])
    expect(h.errors.filter((e) => HYDRATION_RE.test(e))).toEqual([])
    expect(h.fetchMock).not.toHaveBeenCalled()
  })

  it('sau hydrate, điều hướng sang trang khác rồi quay lại → gọi API lấy dữ liệu mới', async () => {
    const repo = createMemoryRepo()
    const h = await ssrThenHydrate('/products/den-nguyet', { repo })
    mounted.push(h.reactRoot)
    await flush()
    expect(h.fetchMock).not.toHaveBeenCalled()

    await clientNavigate('/products/den-vong')
    await flush()
    const urls1 = h.fetchMock.mock.calls.map((c) => String(c[0]))
    expect(urls1).toContain('/api/products/den-vong?lang=vi')
    expect(h.root.querySelector('h1').textContent).toBe('Đèn Vọng')

    // Đổi dữ liệu trong DB → quay lại trang cũ phải thấy dữ liệu mới (cache SSR đã xoá)
    const p = await repo.getProductBySlug('den-nguyet')
    await repo.updateProduct(p.id, { name: { vi: 'Đèn Nguyệt MỚI' } })
    h.fetchMock.mockClear()
    await clientNavigate('/products/den-nguyet')
    await flush()
    expect(h.fetchMock.mock.calls.map((c) => String(c[0]))).toContain('/api/products/den-nguyet?lang=vi')
    expect(h.root.querySelector('h1').textContent).toBe('Đèn Nguyệt MỚI')
  })

  it('trang riêng tư: khung rỗng → createRoot render, không lỗi hydrate', async () => {
    const h = await ssrThenHydrate('/login')
    mounted.push(h.reactRoot)
    await flush()
    expect(h.page.html).toContain('<div id="root"></div>')
    expect(h.initialData).toBeUndefined()
    expect(h.root.querySelector('form')).not.toBeNull()
    expect(h.errors.filter((e) => HYDRATION_RE.test(e))).toEqual([])
  })
})

const countHead = () => ({
  title: document.head.querySelectorAll('title').length,
  canonical: document.head.querySelectorAll('link[rel=canonical]').length,
  alternate: document.head.querySelectorAll('link[rel=alternate]').length,
  robots: document.head.querySelectorAll('meta[name=robots]').length,
  ld: document.head.querySelectorAll('script[type="application/ld+json"]').length,
})

describe('Head sau khi client chạy (FR-SEO-001, BR-SEO-001)', () => {
  it.each(['/', '/en', '/zh/products/den-vong'])('%s: đúng 1 title, 1 canonical, 4 alternate, 0 robots', async (url) => {
    const h = await ssrThenHydrate(url)
    mounted.push(h.reactRoot)
    await flush()
    expect(countHead()).toMatchObject({ title: 1, canonical: 1, alternate: 4, robots: 0 })
    const hreflangs = [...document.head.querySelectorAll('link[rel=alternate]')].map((l) => l.getAttribute('hreflang'))
    expect(hreflangs.sort()).toEqual(['en', 'vi', 'x-default', 'zh-Hans'])
  })

  it('canonical trên client không chứa query/hash (?intent=gift#x)', async () => {
    const h = await ssrThenHydrate('/en/products/den-vong?intent=gift#top')
    mounted.push(h.reactRoot)
    await flush()
    const href = document.head.querySelector('link[rel=canonical]').getAttribute('href')
    expect(href).not.toMatch(/[?#]/)
    expect(href.endsWith('/en/products/den-vong')).toBe(true)
  })

  it.each(['/lo/DEMO-2026-01', '/khong-co', '/products/khong-co'])(
    '%s (noindex): SSR có đúng 1 meta robots, sau hydrate vẫn đúng 1, không canonical/hreflang',
    async (url) => {
      const h = await ssrThenHydrate(url)
      mounted.push(h.reactRoot)
      expect((h.page.html.match(/name="robots"/g) ?? []).length).toBe(1)
      await flush()
      expect(countHead()).toMatchObject({ title: 1, canonical: 0, alternate: 0, robots: 1 })
    },
  )

  it('trang riêng tư (/en/login): sau khi client render vẫn đúng 1 meta robots', async () => {
    const h = await ssrThenHydrate('/en/login')
    mounted.push(h.reactRoot)
    expect((h.page.html.match(/name="robots"/g) ?? []).length).toBe(1)
    await flush()
    expect(countHead().robots).toBe(1)
    expect(countHead().title).toBe(1)
  })

  it('điều hướng từ trang noindex (lô) sang trang công khai → meta robots biến mất, có canonical', async () => {
    const h = await ssrThenHydrate('/lo/DEMO-2026-01')
    mounted.push(h.reactRoot)
    await flush()
    await clientNavigate('/products/den-nguyet')
    await flush()
    expect(countHead()).toMatchObject({ robots: 0, canonical: 1, alternate: 4, title: 1, ld: 1 })
  })

  it('điều hướng từ trang 404 sang trang chủ → không còn meta robots', async () => {
    const h = await ssrThenHydrate('/khong-co')
    mounted.push(h.reactRoot)
    await flush()
    await clientNavigate('/en')
    await flush()
    expect(countHead()).toMatchObject({ robots: 0, canonical: 1 })
    expect(document.documentElement.lang).toBe('en')
  })

  it('JSON-LD trên client khớp SSR (giá chưa VAT, không lặp)', async () => {
    const h = await ssrThenHydrate('/zh/products/den-nguyet')
    mounted.push(h.reactRoot)
    await flush()
    const scripts = document.head.querySelectorAll('script[type="application/ld+json"]')
    expect(scripts).toHaveLength(1)
    const ld = JSON.parse(scripts[0].textContent)
    expect(ld.name).toBe(products[0].name.zh)
    expect(ld.offers.price).toBe(products[0].priceExclVat)
    expect(ld.offers.priceSpecification.valueAddedTaxIncluded).toBe(false)
  })
})
