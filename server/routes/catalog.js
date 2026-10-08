import { Router } from 'express'
import { normalizeLang } from '../i18n.js'
import { getPublicBatch, getPublicCollection, listPublicCollections, getPublicProduct, listPublicFaq, listPublicProducts } from '../services/catalog.js'

// FR-CAT-001, G-07, FR-QR-006
export function catalogRouter({ repo }) {
  const r = Router()
  const lang = (req) => normalizeLang(req.query.lang)

  // Dữ liệu công khai, không phụ thuộc người dùng → cho CDN cache ngắn (feedback 08/10, mục 22).
  // Chỉ đặt header khi thành công (lỗi giữ no-store mặc định của API). Admin sửa → tối đa ~1 phút là thấy.
  const cached = (load) => async (req, res) => {
    const body = await load(req)
    res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300')
    res.json(body)
  }

  r.get('/products', cached((req) => listPublicProducts(repo, lang(req))))
  r.get('/products/:slug', cached((req) => getPublicProduct(repo, req.params.slug, lang(req))))
  r.get('/collections', cached((req) => listPublicCollections(repo, lang(req))))
  r.get('/collections/:slug', cached((req) => getPublicCollection(repo, req.params.slug, lang(req))))
  r.get('/faq', cached((req) => listPublicFaq(repo, lang(req))))
  r.get('/batches/:code', async (req, res) => res.json(await getPublicBatch(repo, req.params.code, lang(req))))

  return r
}
