import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { HTML_LANG, translate } from '../src/i18n/core.js'
import { classifyPath, dataKeysFor } from '../src/seo/routes.js'
import { buildHeadTags, renderHeadTags, safeJson } from '../src/seo/head.js'
import { HttpError } from './errors.js'
import { getPublicBatch, getPublicProduct, listPublicFaq, listPublicProducts } from './services/catalog.js'

const root = fileURLToPath(new URL('..', import.meta.url))

// Nạp sẵn dữ liệu giống lời gọi API của trang (key khớp useApi)
async function loadData(repo, route) {
  const out = {}
  for (const path of dataKeysFor(route)) {
    const key = `${path}|${route.lang}`
    try {
      let data
      if (path === '/products') data = await listPublicProducts(repo, route.lang)
      else if (path === '/faq') data = await listPublicFaq(repo, route.lang)
      else if (route.kind === 'product') data = await getPublicProduct(repo, route.slug, route.lang)
      else if (route.kind === 'batch') data = await getPublicBatch(repo, route.code, route.lang)
      out[key] = { data }
    } catch (err) {
      if (!(err instanceof HttpError)) console.error('[ssr]', err)
      const status = err instanceof HttpError ? err.status : 500
      out[key] = { error: { status, code: err instanceof HttpError ? err.code : 'INTERNAL_ERROR' } }
    }
  }
  return out
}

function fill(template, { lang, head, html, data }) {
  return template
    .replace('<html lang="vi">', `<html lang="${HTML_LANG[lang]}">`)
    .replace('<!--app-head-->', head)
    .replace('<!--app-html-->', html)
    .replace('<!--app-data-->', data ? `<script>window.__INITIAL_DATA__=${safeJson(data)}</script>` : '')
}

/**
 * Render một trang thành HTML đầy đủ. Trả { status, noindex, html }.
 * Tách riêng để test không cần Vite/dist.
 */
export async function renderPage({ repo, config, template, render, url, pathname }) {
  const route = classifyPath(pathname)
  const siteUrl = config.publicSiteUrl

  if (route.kind === 'private') {
    // Không SSR: nội dung phụ thuộc phiên đăng nhập ở trình duyệt
    const tags = buildHeadTags({ lang: route.lang, siteUrl, title: translate(route.lang, 'meta.title'), noindex: true })
    const head = renderHeadTags(tags, { noindex: true })
    return { status: 200, noindex: true, html: fill(template, { lang: route.lang, head, html: '', data: null }) }
  }

  const initialData = await loadData(repo, route)
  const { html, head: meta } = render(url, { initialData, siteUrl })
  const head = renderHeadTags(meta.tags, { noindex: meta.noindex })
  return {
    status: meta.status,
    noindex: meta.noindex,
    html: fill(template, { lang: route.lang, head, html, data: initialData }),
  }
}

/**
 * D-49: SSR trong Express cho trang công khai (§23.2). Trang riêng tư trả khung HTML + noindex.
 * dev: dùng Vite middleware (HMR); prod: dist/client + dist/server/entry-server.js.
 */
export async function createWeb({ repo, config, dev }) {
  const router = express.Router()
  let vite
  let prodTemplate
  let prodRender

  if (dev) {
    const { createServer } = await import('vite')
    vite = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
    router.use(vite.middlewares)
  } else {
    prodTemplate = readFileSync(`${root}/dist/client/index.html`, 'utf8')
    prodRender = (await import(`${root}/dist/server/entry-server.js`)).render
    router.use(express.static(`${root}/dist/client`, { index: false, maxAge: '1y', immutable: true }))
  }

  router.get(/.*/, async (req, res, next) => {
    try {
      let template = prodTemplate
      let render = prodRender
      if (dev) {
        template = await vite.transformIndexHtml(req.originalUrl, readFileSync(`${root}/index.html`, 'utf8'))
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render
      }
      const page = await renderPage({ repo, config, template, render, url: req.originalUrl, pathname: req.path })
      res.set('Content-Type', 'text/html; charset=utf-8')
      if (page.noindex) res.set('X-Robots-Tag', 'noindex')
      res.status(page.status).send(page.html)
    } catch (err) {
      vite?.ssrFixStacktrace(err)
      next(err)
    }
  })

  return router
}
