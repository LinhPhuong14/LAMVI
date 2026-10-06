import { HttpError, notFound } from '../errors.js'
import {
  PUBLIC_PRODUCT_STATUSES,
  presentProduct,
  presentCollection,
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

// D-96: bộ sưu tập kèm đèn lẻ và bộ "set" (nếu có). Bộ không có đèn công khai nào thì ẩn.
export async function listPublicCollections(repo, lang) {
  let cols, products
  try {
    const result = await Promise.all([repo.listCollections({ statuses: PUBLIC_PRODUCT_STATUSES }), listPublicProducts(repo, lang)])
    cols = result[0]
    products = result[1].items
  } catch (err) {
    if (err.code !== 'CATALOG_NOT_READY') throw err
    console.error('[catalog] collections schema not ready; apply migration 011 and reload PostgREST schema')
    throw new HttpError(503, 'CATALOG_NOT_READY', 'Bộ sưu tập tạm thời chưa sẵn sàng. Bạn vẫn có thể xem các sản phẩm trong cửa hàng.')
  }
  return { items: cols.map((c) => presentCollection(c, products, lang)).filter((c) => c.lamps.length || c.set) }
}

export async function getPublicCollection(repo, slug, lang) {
  const { items } = await listPublicCollections(repo, lang)
  const item = items.find((c) => c.slug === slug)
  if (!item) throw notFound()
  return { item }
}
