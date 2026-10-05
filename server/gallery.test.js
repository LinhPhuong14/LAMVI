import { beforeEach, describe, expect, it } from 'vitest'
import request from 'supertest'
import { createApp } from './app.js'
import { createMemoryRepo } from './adapters/memory/repo.js'
import { createMemoryAuth } from './adapters/memory/auth.js'
import { createMemoryStorage } from './adapters/memory/storage.js'

let app, repo, auth, tokens

async function login(email) {
  const { user } = await auth.signUp({ email, password: 'Gio-Hoa#Sen2026' })
  await repo.upsertProfile({ id: user.id, fullName: email, role: 'customer' })
  return { id: user.id, bearer: `Bearer ${(await auth.signIn({ email, password: 'Gio-Hoa#Sen2026' })).accessToken}` }
}

let n = 0
async function order(user, slugs, over = {}) {
  n += 1
  return repo.createOrder(
    {
      code: `LV2610-GAL${String(n).padStart(4, '0')}`,
      userId: user.id,
      status: 'delivered',
      orderKind: 'self',
      hasMessage: false,
      qrToken: `tok${n}`.padEnd(64, 'a'),
      deliveredAt: `2026-10-0${n}T10:00:00Z`,
      total: 1,
      ...over,
    },
    slugs.map((slug) => ({ slug, name: { vi: slug }, unitPrice: 1, quantity: 1, lineTotal: 1 })),
  )
}
const gallery = (lang = 'vi', t = tokens.a) => request(app).get(`/api/gallery?lang=${lang}`).set('Authorization', t.bearer)

beforeEach(async () => {
  n = 0
  repo = createMemoryRepo()
  auth = createMemoryAuth()
  app = createApp({ repo, auth, storage: createMemoryStorage(), config: { publicSiteUrl: 'https://moc.test' } })
  tokens = { a: await login('a@moc.test'), b: await login('b@moc.test') }
})

describe('Gallery đèn + chăn Đông Hồ (D-97)', () => {
  it('cần đăng nhập', async () => {
    expect((await request(app).get('/api/gallery')).status).toBe(401)
  })

  it('chưa mua gì: không đèn, chưa mảnh nào, không lộ cốt truyện', async () => {
    const res = await gallery()
    expect(res.status).toBe(200)
    expect(res.body.lamps).toEqual([])
    expect(res.body.quilt).toMatchObject({ unlockedPieces: 0, completedCollections: 0, complete: false, totalCollections: 2 })
    expect(JSON.stringify(res.body)).not.toContain('Chiều ba mươi')
    for (const c of res.body.collections) expect(c.reward).toBeNull()
  })

  it('chỉ tính đơn đã giao; đơn chưa giao / đã huỷ không mở mảnh', async () => {
    await order(tokens.a, ['den-nguyet'], { status: 'shipped' })
    await order(tokens.a, ['den-vong'], { status: 'cancelled' })
    expect((await gallery()).body.quilt.unlockedPieces).toBe(0)
    await order(tokens.a, ['den-nguyet'])
    const res = await gallery()
    expect(res.body.lamps.map((l) => l.slug)).toEqual(['den-nguyet'])
    expect(res.body.quilt.unlockedPieces).toBe(1)
  })

  it('mỗi đèn sở hữu = 1 mảnh; đủ bộ → phần thưởng của đúng bộ đó, bộ khác vẫn khoá', async () => {
    await order(tokens.a, ['den-nguyet', 'den-vong'])
    let res = await gallery()
    const sv = res.body.collections.find((c) => c.slug === 'sum-vay')
    expect(sv).toMatchObject({ ownedCount: 2, complete: false, reward: null })
    await order(tokens.a, ['den-tinh'])
    res = await gallery()
    const done = res.body.collections.find((c) => c.slug === 'sum-vay')
    expect(done.complete).toBe(true)
    expect(done.reward.story).toContain('Chiều ba mươi')
    expect(res.body.collections.find((c) => c.slug === 'hoi-lang').reward).toBeNull()
    expect(res.body.quilt).toMatchObject({ completedCollections: 1, complete: false })
  })

  it('đủ mọi bộ → quilt.complete', async () => {
    await order(tokens.a, ['den-nguyet', 'den-vong', 'den-tinh', 'den-hoi-xuan', 'den-hoi-ha', 'den-hoi-thu', 'den-hoi-dong'])
    const res = await gallery()
    expect(res.body.quilt).toMatchObject({ unlockedPieces: 7, totalPieces: 7, complete: true })
  })

  it('mua nguyên bộ (set) = sở hữu mọi đèn lẻ của bộ', async () => {
    await order(tokens.a, ['den-sum-vay'])
    const res = await gallery()
    expect(res.body.lamps.map((l) => l.slug).sort()).toEqual(['den-nguyet', 'den-tinh', 'den-vong'])
    expect(res.body.lamps.every((l) => l.viaSet)).toBe(true)
    expect(res.body.collections.find((c) => c.slug === 'sum-vay').complete).toBe(true)
  })

  it('đơn của người khác không tính; sản phẩm không có trong bộ nào bị bỏ qua', async () => {
    await order(tokens.b, ['den-nguyet', 'den-vong', 'den-tinh'])
    expect((await gallery()).body.quilt.unlockedPieces).toBe(0)
    expect((await gallery('vi', tokens.b)).body.quilt.completedCollections).toBe(1)
  })

  it('lời chúc: đơn mua cho mình có đường dẫn QR, quà tặng chỉ báo có lời chúc (Q-27)', async () => {
    await order(tokens.a, ['den-nguyet'], { hasMessage: true, orderKind: 'self' })
    await order(tokens.a, ['den-vong'], { hasMessage: true, orderKind: 'gift' })
    const res = await gallery('en')
    const self = res.body.lamps.find((l) => l.slug === 'den-nguyet')
    const gift = res.body.lamps.find((l) => l.slug === 'den-vong')
    expect(self.greeting.path).toMatch(/^\/en\/qr\/tok1/)
    expect(gift.greeting).toEqual({ path: null })
    expect(JSON.stringify(gift)).not.toContain('tok2')
  })

  it('ngôn ngữ: tên bộ và cốt truyện theo lang', async () => {
    await order(tokens.a, ['den-nguyet', 'den-vong', 'den-tinh'])
    const res = await gallery('en')
    const c = res.body.collections.find((x) => x.slug === 'sum-vay')
    expect(c.name).toBe('Sum Vay')
    expect(c.reward.title).toBe('The Tet Feast')
  })

  it('video lô: có khi tồn tại lô đã xuất bản', async () => {
    await order(tokens.a, ['den-nguyet'])
    await repo.createBatch({ code: 'LOT-1', title: { vi: 'Mẻ 1' }, status: 'video_published', videoUrl: 'https://x/y.mp4' })
    const lamp = (await gallery()).body.lamps[0]
    expect(lamp.batch.path).toBe(`/lo/${lamp.batch.code}`)
    // lô chưa xuất bản không bao giờ lộ
    await repo.createBatch({ code: 'DRAFT-1', title: { vi: 'Nháp' }, status: 'created' })
    expect(JSON.stringify((await gallery()).body)).not.toContain('DRAFT-1')
  })
})
