// @vitest-environment jsdom
// Kiểm thử độc lập (T-11): chăn Đông Hồ (D-97) và Cửa hàng/bộ sưu tập (D-96) — edge case UI
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'an@example.com' } }
const profile = { id: 'u1', email: 'an@example.com', fullName: 'An', phone: null, preferredLocale: 'vi', role: 'customer' }
const emptyCart = { items: [], subtotal: 0, itemCount: 0, hasUnavailable: false, maxQuantity: 10 }
const SEEN = 'moc.quilt.seen.u1'

const piece = (slug, name, owned) => ({ slug, name, tone: 'amber', owned })
const lampRow = (slug, name, collection) => ({ slug, name, tone: 'amber', image: null, collection, orderCode: 'LV2610-AAAAAAA', receivedAt: '2026-10-01T00:00:00Z', viaSet: false, greeting: null, batch: null })

const colSum = (owned) => ({
  slug: 'sum-vay', name: 'Sum Vầy', tone: 'amber',
  pieces: [piece('den-a', 'Đèn A', owned), piece('den-b', 'Đèn B', owned)],
  ownedCount: owned ? 2 : 0, complete: owned,
  reward: owned ? { title: 'Mâm cơm ngày Tết', story: 'Chiều ba mươi cả nhà quây quần.' } : null,
})
const colHoi = (owned) => ({
  slug: 'hoi-lang', name: 'Hội Làng', tone: 'dusk',
  pieces: [piece('den-c', 'Đèn C', owned)],
  ownedCount: owned ? 1 : 0, complete: owned,
  reward: owned ? { title: 'Đêm hội đình làng', story: 'Trống hội vang lên.' } : null,
})
const lampsOf = (cols) => cols.flatMap((c) => c.pieces.filter((p) => p.owned).map((p) => lampRow(p.slug, p.name, c.slug)))
const galOf = (cols) => {
  const total = cols.reduce((s, c) => s + c.pieces.length, 0)
  const un = cols.reduce((s, c) => s + c.ownedCount, 0)
  return { lamps: lampsOf(cols), collections: cols, quilt: { totalPieces: total, unlockedPieces: un, completedCollections: cols.filter((c) => c.complete).length, totalCollections: cols.length, complete: cols.every((c) => c.complete) } }
}

const base = (g) => ({
  'GET /products': () => ({ body: { items: [] } }),
  'GET /collections': () => ({ body: { items: [] } }),
  'GET /me': () => ({ body: { profile } }),
  'GET /may/history': () => ({ body: { items: [] } }),
  'GET /cart': () => ({ body: emptyCart }),
  'GET /orders': () => ({ body: { items: [] } }),
  'GET /gallery': () => ({ body: g }),
})
const seenSet = () => new Set(JSON.parse(localStorage.getItem(SEEN) ?? '[]'))
const patchLi = (name) => screen.getByText(name, { selector: '.quilt-patch-name' }).closest('li')

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('moc.session', JSON.stringify(session))
})
afterEach(() => vi.restoreAllMocks())

describe('Quilt: hiệu ứng chỉ cho mảnh mới', () => {
  it('mảnh đã ở seen không có is-new; mảnh mới có is-new', async () => {
    localStorage.setItem(SEEN, JSON.stringify(['p:den-a']))
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    expect(patchLi('Đèn A').className).not.toContain('is-new')
    expect(patchLi('Đèn B').className).toContain('is-new')
    expect(patchLi('Đèn A').className).toContain('is-on')
  })

  it('mảnh khoá không có is-new; hiện ???', async () => {
    mockApi(base(galOf([colSum(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    for (const li of document.querySelectorAll('.quilt-patch')) {
      expect(li.className).toContain('is-off')
      expect(li.className).not.toContain('is-new')
    }
    expect(screen.getAllByText('???').length).toBe(2)
    expect(document.body.textContent).not.toContain('Chiều ba mươi')
  })

  it('chưa đủ bộ: không có dialog dù đã có mảnh mới; không lộ story trong DOM', async () => {
    mockApi(base(galOf([{ ...colSum(false), pieces: [piece('den-a', 'Đèn A', true), piece('den-b', 'Đèn B', false)], ownedCount: 1 }, colHoi(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    await new Promise((r) => setTimeout(r, 1700))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.body.textContent).not.toContain('Chiều ba mươi')
    expect(screen.queryByRole('button', { name: 'Đọc cốt truyện' })).toBeNull()
  })
})

describe('Quilt: localStorage lỗi', () => {
  it('getItem/setItem của khoá seen ném lỗi: trang vẫn render, phần thưởng vẫn mở và đóng được', async () => {
    const realGet = Storage.prototype.getItem
    const realSet = Storage.prototype.setItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) {
      if (String(k).startsWith('moc.quilt')) throw new Error('denied')
      return realGet.call(this, k)
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
      if (String(k).startsWith('moc.quilt')) throw new Error('quota')
      return realSet.call(this, k, v)
    })
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    expect(await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })).toBeTruthy()
    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thu vào chăn' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.getByRole('heading', { name: 'Chăn Đông Hồ' })).toBeTruthy()
  })

  it('seen là JSON hỏng / không phải mảng: coi như chưa xem, không vỡ', async () => {
    localStorage.setItem(SEEN, '{not json')
    mockApi(base(galOf([colSum(false)])))
    renderAt('/account?tab=gallery')
    expect(await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })).toBeTruthy()
    cleanupSeen()
    localStorage.setItem(SEEN, '{"a":1}')
  })
})
function cleanupSeen() {
  localStorage.removeItem(SEEN)
}

describe('Quilt: phần thưởng', () => {
  it('modal portal ra body, focus vào nút đóng, đóng ghi c:<slug> và p:<slug>', async () => {
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    const dialog = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(dialog.closest('.gallery')).toBeNull()
    expect(dialog.parentElement).toBe(document.body)
    const close = within(dialog).getByRole('button', { name: 'Thu vào chăn' })
    await waitFor(() => expect(document.activeElement).toBe(close))
    // các mảnh mới đã được ghi nhớ trước khi mở phần thưởng
    expect(seenSet().has('p:den-a')).toBe(true)
    expect(seenSet().has('c:sum-vay')).toBe(false)
    fireEvent.click(close)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect([...seenSet()]).toEqual(expect.arrayContaining(['p:den-a', 'p:den-b', 'c:sum-vay']))
    expect(seenSet().has('finale')).toBe(false)
  })

  it('Esc đóng phần thưởng lần đầu và vẫn ghi nhớ c:<slug>', async () => {
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('dialog', {}, { timeout: 4000 })
    fireEvent.keyDown(window, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(seenSet().has('c:sum-vay')).toBe(true)
  })

  it('phím khác Esc không đóng', async () => {
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('dialog', {}, { timeout: 4000 })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('xem lại (replay) không ghi thêm vào seen', async () => {
    const all = ['p:den-a', 'p:den-b', 'c:sum-vay']
    localStorage.setItem(SEEN, JSON.stringify(all))
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    fireEvent.click(screen.getByRole('button', { name: 'Đọc cốt truyện' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Mâm cơm ngày Tết' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Thu vào chăn' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect([...seenSet()].sort()).toEqual([...all].sort())
  })

  it('seen theo từng người dùng: khoá của user khác không ảnh hưởng', async () => {
    localStorage.setItem('moc.quilt.seen.u2', JSON.stringify(['p:den-a', 'p:den-b', 'c:sum-vay']))
    mockApi(base(galOf([colSum(true), colHoi(false)])))
    renderAt('/account?tab=gallery')
    expect(await screen.findByRole('dialog', {}, { timeout: 4000 })).toBeTruthy()
  })

  it('hoàn tất chăn: sau khi đóng phần thưởng của bộ cuối mới mở finale; đóng finale ghi finale', async () => {
    // bộ Sum Vầy đã xem; bộ Hội Làng mới đủ → hoàn tất chăn
    localStorage.setItem(SEEN, JSON.stringify(['p:den-a', 'p:den-b', 'c:sum-vay']))
    mockApi(base(galOf([colSum(true), colHoi(true)])))
    renderAt('/account?tab=gallery')
    const first = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(within(first).getByRole('heading', { name: 'Đêm hội đình làng' })).toBeTruthy()
    expect(seenSet().has('finale')).toBe(false)
    fireEvent.click(within(first).getByRole('button', { name: 'Thu vào chăn' }))
    // phần thưởng bộ cuối đóng xong → finale
    await waitFor(() => {
      const d = screen.getByRole('dialog')
      expect(within(d).queryByRole('heading', { name: 'Đêm hội đình làng' })).toBeNull()
    }, { timeout: 3000 })
    const finale = screen.getByRole('dialog')
    expect(seenSet().has('c:hoi-lang')).toBe(true)
    fireEvent.click(within(finale).getByRole('button', { name: 'Cất tấm chăn' }))
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(seenSet().has('finale')).toBe(true)
    // nút xem lại finale có mặt khi chăn hoàn chỉnh
    expect(screen.getByRole('button', { name: 'Xem đoạn kết' })).toBeTruthy()
  })

  it('hai bộ cùng mới: lần lượt từng modal, bộ đầu trước', async () => {
    mockApi(base(galOf([colSum(true), colHoi(true)])))
    renderAt('/account?tab=gallery')
    const d1 = await screen.findByRole('dialog', {}, { timeout: 4000 })
    expect(within(d1).getByRole('heading', { name: 'Mâm cơm ngày Tết' })).toBeTruthy()
    fireEvent.click(within(d1).getByRole('button'))
    await waitFor(() => expect(screen.getByRole('dialog').getAttribute('aria-label')).toBe('Đêm hội đình làng'), { timeout: 3000 })
    expect(document.querySelectorAll('[role="dialog"]').length).toBe(1)
  })

  it('đã xem hết kể cả finale: không modal tự bật, nút xem lại finale mở được', async () => {
    localStorage.setItem(SEEN, JSON.stringify(['p:den-a', 'p:den-b', 'p:den-c', 'c:sum-vay', 'c:hoi-lang', 'finale']))
    mockApi(base(galOf([colSum(true), colHoi(true)])))
    renderAt('/account?tab=gallery')
    await screen.findByRole('heading', { name: 'Chăn Đông Hồ' })
    await new Promise((r) => setTimeout(r, 1700))
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.querySelectorAll('.quilt-patch.is-new').length).toBe(0)
  })
})

describe('Cửa hàng khi /collections lỗi', () => {
  const lamp = (slug, name) => ({ slug, name, kind: 'single', description: `Mô tả ${name}`, price: 800000, currency: 'VND', tone: 'amber', badge: null, image: null, collection: 'sum-vay', pieceOrder: 1 })
  for (const [label, resp] of [
    ['500', { status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }],
    ['404', { status: 404, body: { error: { code: 'NOT_FOUND' } } }],
  ]) {
    it(`${label}: vẫn liệt kê mọi đèn, không có mục Bộ sưu tập`, async () => {
      mockApi({ ...base(galOf([])), 'GET /products': () => ({ body: { items: [lamp('den-a', 'Đèn A'), { ...lamp('den-le', 'Đèn Lẻ'), collection: null }] } }), 'GET /collections': () => resp })
      renderAt('/shop')
      const shop = within(document.querySelector('.shop') ?? (await screen.findByRole('link', { name: 'Đèn A' })).closest('main'))
      expect(await shop.findByRole('link', { name: 'Đèn A' })).toBeTruthy()
      expect(shop.getByRole('link', { name: 'Đèn Lẻ' })).toBeTruthy()
      expect(screen.queryByRole('heading', { level: 2, name: 'Bộ sưu tập' })).toBeNull()
    })
  }

  it('bộ sưu tập rỗng: không có mục Bộ sưu tập, đèn thuộc bộ vẫn hiện', async () => {
    mockApi({ ...base(galOf([])), 'GET /products': () => ({ body: { items: [lamp('den-a', 'Đèn A')] } }) })
    renderAt('/shop')
    expect((await screen.findAllByRole('link', { name: 'Đèn A' })).length).toBeGreaterThan(0)
    expect(screen.queryByRole('heading', { level: 2, name: 'Bộ sưu tập' })).toBeNull()
  })
})
