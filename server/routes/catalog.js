import { Router } from 'express'
import { normalizeLang } from '../i18n.js'
import { notFound } from '../errors.js'
import {
  PUBLIC_PRODUCT_STATUSES,
  presentProduct,
  presentFaq,
  isBatchPublic,
  presentBatch,
} from '../domain/catalog.js'

// FR-CAT-001, G-07, FR-QR-006
export function catalogRouter({ repo }) {
  const r = Router()

  r.get('/products', async (req, res) => {
    const lang = normalizeLang(req.query.lang)
    const items = await repo.listProducts({ statuses: PUBLIC_PRODUCT_STATUSES })
    res.json({ items: items.map((p) => presentProduct(p, lang)) })
  })

  r.get('/products/:slug', async (req, res) => {
    const lang = normalizeLang(req.query.lang)
    const p = await repo.getProductBySlug(req.params.slug)
    if (!p || !PUBLIC_PRODUCT_STATUSES.includes(p.status)) throw notFound()
    res.json({ item: presentProduct(p, lang) })
  })

  r.get('/faq', async (req, res) => {
    const lang = normalizeLang(req.query.lang)
    const items = await repo.listFaq({ publishedOnly: true })
    res.json({ items: items.map((f) => presentFaq(f, lang)) })
  })

  // D-43: QR khắc trên đèn là mã chung của lô; trang công khai, không cần đăng nhập (US-005)
  r.get('/batches/:code', async (req, res) => {
    const lang = normalizeLang(req.query.lang)
    const b = await repo.getBatchByCode(req.params.code)
    if (!b || !isBatchPublic(b)) throw notFound()
    res.json({ item: presentBatch(b, lang) })
  })

  return r
}
