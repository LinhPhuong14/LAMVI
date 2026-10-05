import { Router } from 'express'
import { normalizeLang } from '../i18n.js'
import { getPublicBatch, getPublicCollection, listPublicCollections, getPublicProduct, listPublicFaq, listPublicProducts } from '../services/catalog.js'

// FR-CAT-001, G-07, FR-QR-006
export function catalogRouter({ repo }) {
  const r = Router()
  const lang = (req) => normalizeLang(req.query.lang)

  r.get('/products', async (req, res) => res.json(await listPublicProducts(repo, lang(req))))
  r.get('/products/:slug', async (req, res) => res.json(await getPublicProduct(repo, req.params.slug, lang(req))))
  r.get('/collections', async (req, res) => res.json(await listPublicCollections(repo, lang(req))))
  r.get('/collections/:slug', async (req, res) => res.json(await getPublicCollection(repo, req.params.slug, lang(req))))
  r.get('/faq', async (req, res) => res.json(await listPublicFaq(repo, lang(req))))
  r.get('/batches/:code', async (req, res) => res.json(await getPublicBatch(repo, req.params.code, lang(req))))

  return r
}
