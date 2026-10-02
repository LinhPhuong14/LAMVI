import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { HTML_LANG, localePath, translate } from '../src/i18n/core.js'
import { classifyPath, dataKeysFor } from '../src/seo/routes.js'
import { buildHeadTags, normalizeSiteUrl, renderHeadTags, safeJson } from '../src/seo/head.js'
import { gaInlineScript, gaScriptSrc } from '../src/analytics/ga.js'
import { cspHash } from './middleware/security.js'
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

const escHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// FR-GA-001 (D-72): nhúng gtag.js khi có GA_MEASUREMENT_ID. Không nhúng ở trang nội bộ (/admin,
// /it) và trang bảo trì. ID đã được config.js kiểm định dạng G-XXXX nên an toàn khi nội suy.
function analyticsTags(measurementId) {
  if (!measurementId) return { html: '', hashes: [] }
  const inline = gaInlineScript(measurementId)
  return {
    html: [
      `<script async src="${escHtml(gaScriptSrc(measurementId))}"></script>`,
      `<script>${inline}</script>`,
    ].join('\n    '),
    hashes: [cspHash(inline)],
  }
}

// Không phân biệt hoa/thường — xem classifyPath
const isInternalPath = (pathname) => /^\/(admin|it)(\/|$)/i.test(pathname)

// Nội dung script nạp sẵn dữ liệu — tách ra để tính hash CSP trên đúng chuỗi được nhúng
const initialDataScript = (data) => `window.__INITIAL_DATA__=${safeJson(data)}`

// Trang bảo trì tĩnh (không hydrate)
export function maintenancePage(lang) {
  const t = (k) => escHtml(translate(lang, k))
  return `<!doctype html>
<html lang="${HTML_LANG[lang]}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${t('maintenance.title')}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f0e4; color: #3a2c22;
        font: 17px/1.6 'Be Vietnam Pro', system-ui, sans-serif; text-align: center; padding: 24px; }
      h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 2.4rem; margin: 0 0 12px; }
      .mark { letter-spacing: 0.08em; color: #6b4226; font-family: Georgia, serif; font-size: 1.4rem; }
    </style>
  </head>
  <body>
    <main>
      <p class="mark">LAMVI</p>
      <h1>${t('maintenance.title')}</h1>
      <p>${t('maintenance.text')}</p>
    </main>
  </body>
</html>
`
}

function fill(template, { lang, head, html, data, analytics = '' }) {
  // Dùng hàm thay thế: chuỗi thay thế sẽ diễn giải $&, $`, $' có trong nội dung DB
  return template
    .replace('<html lang="vi">', () => `<html lang="${HTML_LANG[lang]}">`)
    .replace('<!--app-head-->', () => (analytics ? `${analytics}\n    ${head}` : head))
    .replace('<!--app-html-->', () => html)
    .replace('<!--app-data-->', () => (data ? `<script>${initialDataScript(data)}</script>` : ''))
}

/**
 * Render một trang thành HTML đầy đủ. Trả { status, noindex, html }.
 * Tách riêng để test không cần Vite/dist.
 */
export async function renderPage({ repo, config, template, render, url, pathname, maintenance }) {
  const route = classifyPath(pathname)
  const siteUrl = normalizeSiteUrl(config.publicSiteUrl)
  const ga = isInternalPath(pathname) ? { html: '', hashes: [] } : analyticsTags(config.gaMeasurementId)

  // D-54: bảo trì → trang công khai trả 503 (trang tĩnh, không tải app); /login, /admin, /it vẫn vào được
  if (route.kind !== 'private' && maintenance && (await maintenance.get()).enabled) {
    return { status: 503, noindex: true, private: true, retryAfter: 600, scriptHashes: [], html: maintenancePage(route.lang) }
  }

  if (route.kind === 'private') {
    // Không SSR: nội dung phụ thuộc phiên đăng nhập ở trình duyệt
    const tags = buildHeadTags({ lang: route.lang, siteUrl, title: translate(route.lang, 'meta.title'), noindex: true })
    const head = renderHeadTags(tags, { noindex: true })
    return {
      status: 200,
      noindex: true,
      // Nội dung phụ thuộc phiên đăng nhập ở trình duyệt → CDN không được giữ bản dùng chung
      private: true,
      scriptHashes: ga.hashes,
      html: fill(template, { lang: route.lang, head, html: '', data: null, analytics: ga.html }),
    }
  }

  // Đường dẫn sản phẩm/lô có mã hoá hỏng → render trang 404 thay vì trang "đang tải"
  const renderUrl = route.kind === 'invalid' ? localePath(route.lang, '/__not-found') : url
  const initialData = route.kind === 'invalid' ? {} : await loadData(repo, route)
  const { html, head: meta } = render(renderUrl, { initialData, siteUrl })
  const head = renderHeadTags(meta.tags, { noindex: meta.noindex })
  return {
    status: meta.status,
    noindex: meta.noindex,
    private: false,
    scriptHashes: [...ga.hashes, cspHash(initialDataScript(initialData))],
    html: fill(template, { lang: route.lang, head, html, data: initialData, analytics: ga.html }),
  }
}

/**
 * D-49: SSR trong Express cho trang công khai (§23.2). Trang riêng tư trả khung HTML + noindex.
 * dev: dùng Vite middleware (HMR); prod: dist/client + dist/server/entry-server.js.
 */
export async function createWeb({ repo, config, dev, maintenance }) {
  const router = express.Router()
  // URL percent-encoding hỏng → 400, không để Vite/React ném 500
  router.use((req, res, next) => {
    try {
      decodeURIComponent(req.path)
      next()
    } catch {
      res.status(400).type('text/plain').send('Bad Request')
    }
  })

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
    // Chỉ /assets có tên băm nội dung mới cache vĩnh viễn; tệp khác (favicon…) giữ 1 giờ
    router.use(
      express.static(`${root}/dist/client`, {
        index: false,
        maxAge: '1h',
        setHeaders(res, file) {
          if (file.includes('/assets/')) res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
        },
      }),
    )
  }

  router.get(/.*/, async (req, res) => {
    try {
      let template = prodTemplate
      let render = prodRender
      if (dev) {
        template = await vite.transformIndexHtml(req.originalUrl, readFileSync(`${root}/index.html`, 'utf8'))
        render = (await vite.ssrLoadModule('/src/entry-server.jsx')).render
      }
      const page = await renderPage({ repo, config, template, render, url: req.originalUrl, pathname: req.path, maintenance })
      // CSP cho đúng các script nội tuyến của response này (hash, không nonce — response được CDN
      // chia sẻ). Ở dev không có setCsp vì CSP tắt.
      res.locals.setCsp?.(page.scriptHashes ?? [])
      res.set('Content-Type', 'text/html; charset=utf-8')
      // Quyết định theo "có phụ thuộc phiên đăng nhập hay không", KHÔNG theo noindex: trang lô
      // /lo/:code là trang công khai in trên đèn (noindex theo D-44) nhưng vẫn nên qua CDN.
      res.set('Cache-Control', page.private ? 'private, no-store' : 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
      if (page.noindex) res.set('X-Robots-Tag', 'noindex')
      if (page.retryAfter) res.set('Retry-After', String(page.retryAfter))
      res.status(page.status).send(page.html)
    } catch (err) {
      vite?.ssrFixStacktrace(err)
      console.error('[ssr]', err)
      // Trang HTML ngắn thay vì JSON thô; không lộ chi tiết lỗi
      res.status(500).type('html').send('<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>500</title><p>Có lỗi xảy ra. Vui lòng thử lại sau. / Something went wrong.</p>')
    }
  })

  return router
}
