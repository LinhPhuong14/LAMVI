import { HttpError } from '../errors.js'
import { PUBLIC_PRODUCT_STATUSES, presentProduct } from '../domain/catalog.js'

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
      maxQuantity: MAX_QTY,
    }
  }

  async function productsById() {
    return new Map((await repo.listProducts()).map((p) => [p.id, p]))
  }

  async function productBySlug(slug) {
    return repo.getProductBySlug(slug)
  }

  async function userLines(userId) {
    const map = await productsById()
    // Sản phẩm đã bị xoá khỏi DB thì bỏ khỏi giỏ (cascade trong Supabase; bộ nhớ lọc tại đây)
    return (await repo.getCart(userId)).filter((l) => map.has(l.productId)).map((l) => ({ product: map.get(l.productId), quantity: l.quantity }))
  }

  return {
    async get(userId, lang) {
      return present(await userLines(userId), lang)
    },

    // PUT: đặt số lượng. Thêm mới chỉ khi sản phẩm đang bán; dòng đã ẩn chỉ được giảm/xoá
    async setQuantity(userId, slug, quantity, lang) {
      validateQuantity(quantity)
      const product = await productBySlug(slug)
      const current = product ? (await repo.getCart(userId)).find((l) => l.productId === product.id) : null
      // Không tồn tại hoặc chưa/không còn bán và chưa có trong giỏ → cùng 404 (không dò được slug nháp — D-39)
      if (!product || (!isPublic(product) && !current)) {
        throw new HttpError(404, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn bán')
      }
      if (!isPublic(product) && quantity > current.quantity) {
        throw new HttpError(409, 'PRODUCT_UNAVAILABLE', 'Sản phẩm không còn bán')
      }
      if (!current && (await repo.getCart(userId)).length >= MAX_LINES) {
        throw new HttpError(409, 'CART_FULL', 'Giỏ đã đầy')
      }
      await repo.setCartItem(userId, product.id, quantity)
      return present(await userLines(userId), lang)
    },

    async remove(userId, slug, lang) {
      const product = await productBySlug(slug)
      if (product) await repo.removeCartItem(userId, product.id)
      return present(await userLines(userId), lang)
    },

    // D-59: gộp giỏ trình duyệt khi đăng nhập — cộng số lượng, tối đa 10; bỏ qua sản phẩm không còn bán
    async merge(userId, lines, lang) {
      const current = new Map((await repo.getCart(userId)).map((l) => [l.productId, l.quantity]))
      for (const line of lines) {
        const product = await productBySlug(line.slug)
        if (!product || !isPublic(product)) continue
        if (!current.has(product.id) && current.size >= MAX_LINES) continue
        const q = Math.min(MAX_QTY, (current.get(product.id) ?? 0) + line.quantity)
        current.set(product.id, q)
        await repo.setCartItem(userId, product.id, q)
      }
      return present(await userLines(userId), lang)
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
