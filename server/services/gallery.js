import { PUBLIC_PRODUCT_STATUSES, isBatchPublic } from '../domain/catalog.js'
import { localePath, pick } from '../i18n.js'

const GALLERY_ORDER_LIMIT = 200

/**
 * D-97: gallery đèn + chăn Đông Hồ của khách. Chỉ tính đơn đã giao (DELIVERED).
 * Sở hữu đủ đèn lẻ của một bộ sưu tập → mở phần thưởng cốt truyện của bộ đó. Mua nguyên bộ ("set")
 * tính là sở hữu mọi đèn lẻ của bộ `[ASSUMPTION]` (Q-05: thành phần bộ chưa chốt).
 * Câu chuyện (phần thưởng) chỉ nằm trong kết quả khi đủ điều kiện — server là nơi quyết định.
 */
export async function buildGallery(repo, userId, lang) {
  const [orders, products, collections, batches] = await Promise.all([
    repo.listOrdersByUser(userId, { limit: GALLERY_ORDER_LIMIT }),
    repo.listProducts({ statuses: PUBLIC_PRODUCT_STATUSES }),
    repo.listCollections({ statuses: PUBLIC_PRODUCT_STATUSES }),
    repo.listBatches(),
  ])
  const bySlug = new Map(products.map((p) => [p.slug, p]))
  const delivered = orders.filter((o) => o.status === 'delivered')
  // G-60: đơn chưa liên kết lô cụ thể → dùng lô công khai mới nhất
  const batch = batches.find(isBatchPublic) ?? null

  // slug -> lần nhận đầu tiên (đơn cũ nhất đã giao)
  const owned = new Map()
  const setOwnerOf = new Map()
  for (const o of [...delivered].sort((a, b) => String(a.deliveredAt ?? a.createdAt).localeCompare(String(b.deliveredAt ?? b.createdAt)))) {
    for (const it of o.items ?? []) {
      const p = bySlug.get(it.slug)
      if (!p) continue
      const entry = { order: o, quantity: it.quantity }
      if (p.kind === 'set') {
        if (p.collectionSlug && !setOwnerOf.has(p.collectionSlug)) setOwnerOf.set(p.collectionSlug, entry)
      } else if (!owned.has(p.slug)) owned.set(p.slug, entry)
    }
  }
  // Bộ "set" trao mọi đèn lẻ của bộ
  for (const [colSlug, entry] of setOwnerOf) {
    for (const p of products) if (p.collectionSlug === colSlug && p.kind === 'single' && !owned.has(p.slug)) owned.set(p.slug, { ...entry, viaSet: true })
  }

  const lampOf = (p, entry) => ({
    slug: p.slug,
    name: pick(p.name, lang),
    tone: p.tone,
    image: p.imageUrl ? { url: p.imageUrl, alt: pick(p.imageAlt, lang) } : null,
    collection: p.collectionSlug ?? null,
    orderCode: entry.order.code,
    receivedAt: entry.order.deliveredAt ?? entry.order.createdAt,
    viaSet: Boolean(entry.viaSet),
    greeting: entry.order.hasMessage
      ? {
          // Q-27: chỉ đơn "mua cho mình" mới mở được trang lời chúc từ gallery; quà tặng chỉ báo có/không
          path: entry.order.orderKind === 'self' && entry.order.qrToken ? localePath(lang, `/qr/${entry.order.qrToken}`) : null,
        }
      : null,
    batch: batch ? { code: batch.code, title: pick(batch.title, lang), path: localePath(lang, `/lo/${encodeURIComponent(batch.code)}`) } : null,
  })

  const lamps = [...owned].map(([slug, entry]) => lampOf(bySlug.get(slug), entry))

  const cols = collections.map((c) => {
    const singles = products.filter((p) => p.collectionSlug === c.slug && p.kind === 'single').sort((a, b) => a.pieceOrder - b.pieceOrder)
    const pieces = singles.map((p) => ({ slug: p.slug, name: pick(p.name, lang), tone: p.tone, owned: owned.has(p.slug) }))
    const complete = pieces.length > 0 && pieces.every((p) => p.owned)
    return {
      slug: c.slug,
      name: pick(c.name, lang),
      tone: c.tone,
      pieces,
      ownedCount: pieces.filter((p) => p.owned).length,
      complete,
      // D-97: phần thưởng chỉ lộ khi đủ bộ
      reward: complete ? { title: pick(c.storyTitle, lang), story: pick(c.story, lang) } : null,
    }
  }).filter((c) => c.pieces.length > 0)

  const total = cols.reduce((n, c) => n + c.pieces.length, 0)
  const unlocked = cols.reduce((n, c) => n + c.ownedCount, 0)
  return {
    lamps,
    collections: cols,
    quilt: {
      totalPieces: total,
      unlockedPieces: unlocked,
      completedCollections: cols.filter((c) => c.complete).length,
      totalCollections: cols.length,
      complete: cols.length > 0 && cols.every((c) => c.complete),
    },
  }
}
