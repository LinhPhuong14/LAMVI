import { HttpError } from '../errors.js'
import { PUBLIC_PRODUCT_STATUSES, presentProduct } from '../domain/catalog.js'
import { hasStock } from '../domain/stock.js'

// D-60: tối đa 10 mỗi dòng. Số dòng tối đa để chặn lạm dụng [ASSUMPTION]
export const MAX_QTY = 10
export const MAX_LINES = 50

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function parseLine(line) {
  const slug = typeof line?.slug === 'string' ? line.slug : ''
  const quantity = line?.quantity
  if (!SLUG_RE.test(slug) || slug.length > 80) return null
  if (!Number.isInteger(quantity) || quantity < 1) return null
  return { slug, quantity: Math.min(quantity, MAX_QTY) }
}

export function validateQuantity(q) {
  if (!Number.isInteger(q) || q < 1 || q > MAX_QTY) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Số lượng không hợp lệ', { quantity: 'INVALID_QUANTITY' })
  }
}

// FR-CART-001, §11: giỏ luôn tính theo giá hiện hành ở server (không tin giá từ trình duyệt — §12)
export function createCartService({ repo }) {
  const isPublic = (p) => PUBLIC_PRODUCT_STATUSES.includes(p.status)

  // Dòng giỏ → hiển thị. Sản phẩm bị ẩn/nháp: cảnh báo, không tính vào tạm tính (D-41)
  // hideUnavailableNames: giỏ vãng lai — không trả tên/ảnh sản phẩm đã ẩn (D-39), chỉ báo "không còn bán"
  function present(lines, lang, { hideUnavailableNames = false } = {}) {
    const items = lines.map(({ product, quantity }) => {
      const available = isPublic(product)
      const p = presentProduct(product, lang)
      const hideName = !available && hideUnavailableNames
      return {
        slug: product.slug,
        quantity,
        available,
        // G-44: không đủ hàng cho số lượng trong giỏ; stockLeft chỉ báo khi thiếu (không lộ số tồn khi đủ)
        inStock: !available || hasStock(product, quantity),
        stockLeft: available && !hasStock(product, quantity) ? Math.max(0, product.stock) : null,
        product: {
          name: hideName ? null : p.name,
          kind: hideName ? null : p.kind,
          tone: hideName ? null : p.tone,
          badge: hideName ? null : p.badge,
          image: hideName ? null : (p.image ?? null),
          price: available ? p.price : null,
        },
        lineTotal: available ? p.price * quantity : null,
      }
    })
    return {
      items,
      subtotal: items.reduce((s, i) => s + (i.lineTotal ?? 0), 0),
      currency: 'VND',
      itemCount: items.filter((i) => i.available).reduce((s, i) => s + i.quantity, 0),
      hasUnavailable: items.some((i) => !i.available),
      hasShortage: items.some((i) => !i.inStock),
      maxQuantity: MAX_QTY,
    }
  }

  async function productsById(ids) {
    return new Map((await repo.getProductsByIds(ids)).map((p) => [p.id, p]))
  }

  async function productBySlug(slug) {
    return repo.getProductBySlug(slug)
  }

  async function userLines(userId) {
    const rows = await repo.getCart(userId)
    const map = await productsById(rows.map((row) => row.productId))
    // Sản phẩm đã bị xoá khỏi DB thì bỏ khỏi giỏ (cascade trong Supabase; bộ nhớ lọc tại đây)
    return rows.filter((l) => map.has(l.productId)).map((l) => ({ product: map.get(l.productId), quantity: l.quantity }))
  }

  async function mutate(userId, mode, lines, lang) {
    let rows
    try { rows = await repo.mutateCart(userId, mode, lines) } catch (error) {
      if (error.code === 'PRODUCT_UNAVAILABLE' || error.code === 'PRODUCT_UNAVAILABLE_INCREASE') throw new HttpError(error.code === 'PRODUCT_UNAVAILABLE' ? 404 : 409, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn bán')
      if (error.code === 'OUT_OF_STOCK') throw new HttpError(409, 'OUT_OF_STOCK', 'Sản phẩm không đủ hàng', { quantity: 'OUT_OF_STOCK' }, { stockLeft: Number(error.field) || 0 })
      if (error.code === 'CART_FULL') throw new HttpError(409, 'CART_FULL', 'Giỏ đã đầy')
      throw error
    }
    const products = await productsById(rows.map((row) => row.productId))
    return present(rows.filter((row) => products.has(row.productId)).map((row) => ({ product: products.get(row.productId), quantity: row.quantity })), lang)
  }

  return {
    async get(userId, lang) {
      return present(await userLines(userId), lang)
    },

    // PUT: đặt số lượng. Thêm mới chỉ khi sản phẩm đang bán; dòng đã ẩn chỉ được giảm/xoá
    async setQuantity(userId, slug, quantity, lang) {
      validateQuantity(quantity)
      return mutate(userId, 'set', [{ slug, quantity }], lang)
    },

    async remove(userId, slug, lang) {
      return mutate(userId, 'remove', [{ slug }], lang)
    },

    // D-59: merge increments under the same customer lock as checkout (G-32).
    async merge(userId, lines, lang) {
      return mutate(userId, 'merge', lines, lang)
    },

    // Giỏ của khách vãng lai (lưu trình duyệt): server tính giá, bỏ dòng không tồn tại
    async quote(lines, lang) {
      const merged = new Map()
      for (const l of lines) merged.set(l.slug, Math.min(MAX_QTY, (merged.get(l.slug) ?? 0) + l.quantity))
      const out = []
      for (const [slug, quantity] of merged) {
        const product = await productBySlug(slug)
        // D-39: sản phẩm nháp coi như không tồn tại với khách; sản phẩm đã ẩn vẫn báo để khách xoá (§11)
        if (product && product.status !== 'draft') out.push({ product, quantity })
      }
      return present(out.slice(0, MAX_LINES), lang, { hideUnavailableNames: true })
    },
  }
}
