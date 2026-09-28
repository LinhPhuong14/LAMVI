import { notFound } from '../errors.js'
import {
  PUBLIC_PRODUCT_STATUSES,
  presentProduct,
  presentFaq,
  isBatchPublic,
  presentBatch,
} from '../domain/catalog.js'

// Truy vấn công khai dùng chung cho API (routes/catalog.js) và SSR (ssr/loaders.js)
export async function listPublicProducts(repo, lang) {
  const items = await repo.listProducts({ statuses: PUBLIC_PRODUCT_STATUSES })
  return { items: items.map((p) => presentProduct(p, lang)) }
}

export async function getPublicProduct(repo, slug, lang) {
  const p = await repo.getProductBySlug(slug)
  if (!p || !PUBLIC_PRODUCT_STATUSES.includes(p.status)) throw notFound()
  return { item: presentProduct(p, lang) }
}

export async function listPublicFaq(repo, lang) {
  const items = await repo.listFaq({ publishedOnly: true })
  return { items: items.map((f) => presentFaq(f, lang)) }
}

// D-43: QR khắc trên đèn là mã chung của lô; trang công khai, không cần đăng nhập (US-005)
export async function getPublicBatch(repo, code, lang) {
  const b = await repo.getBatchByCode(code)
  if (!b || !isBatchPublic(b)) throw notFound()
  return { item: presentBatch(b, lang) }
}
