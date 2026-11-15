// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho D-142: soạn phong thư lẻ (không gắn đơn) + thư viện QR.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const ID = '11111111-2222-4333-8444-555555555555'
const URL_QR = 'https://lamvi.test/thu/abcdefghij#' + 'A'.repeat(43)
const content = { template: 'web', recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

async function fillNew() {
  fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Linh' } })
  fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'An' } })
  fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Đoạn một.' } })
  fireEvent.change(screen.getByLabelText('Ghi chú nội bộ (tuỳ chọn)'), { target: { value: 'Khách quen' } })
}

describe('Soạn thư lẻ', () => {
  it('/admin/letters/new không gọi GET; lưu lần đầu POST (kèm label) rồi chuyển sang /admin/letters/<id> và lần sau PUT', async () => {
    const calls = []
    let stored = null
    const fetchMock = mockApi({
      'GET /me': me,
      'POST /admin/letters': (_u, init) => {
        calls.push(['POST', JSON.parse(init.body)])
        stored = { id: ID, orderId: null, label: JSON.parse(init.body).label, status: 'draft', content: JSON.parse(init.body).content, url: null }
        return { status: 201, body: { item: stored } }
      },
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: stored } }),
      [`PUT /admin/letters/${ID}`]: (_u, init) => {
        calls.push(['PUT', JSON.parse(init.body)])
        stored = { ...stored, label: JSON.parse(init.body).label, content: JSON.parse(init.body).content }
        return { body: { item: stored } }
      },
    })
    renderAt('/admin/letters/new')
    await fillNew()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/admin/letters/new'))).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0][0]).toBe('POST')
    expect(calls[0][1]).toMatchObject({ label: 'Khách quen', content: { recipientName: 'Linh', senderName: 'An' } })
    // Sau khi chuyển địa chỉ, form nạp lại từ server: label vẫn còn
    await waitFor(() => expect(fetchMock.mock.calls.some(([u, i]) => String(u).endsWith(`/admin/letters/${ID}`) && (!i?.method || i.method === 'GET'))).toBe(true))
    await waitFor(() => expect(screen.getByLabelText('Ghi chú nội bộ (tuỳ chọn)').value).toBe('Khách quen'))
    fireEvent.change(screen.getByLabelText('Ghi chú nội bộ (tuỳ chọn)'), { target: { value: 'Khách quen 2' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(2))
    expect(calls[1]).toEqual(['PUT', expect.objectContaining({ label: 'Khách quen 2' })])
  })

  it('xuất bản thư mới lỗi sau khi POST thành công → bấm lại không tạo thư trùng', async () => {
    let posts = 0
    let publishes = 0
    let stored = null
    mockApi({
      'GET /me': me,
      'POST /admin/letters': (_u, init) => {
        posts++
        stored = { id: ID, orderId: null, label: null, status: 'draft', content: JSON.parse(init.body).content, url: null }
        return { status: 201, body: { item: stored } }
      },
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: stored } }),
      [`POST /admin/letters/${ID}/publish`]: () => {
        publishes++
        if (publishes === 1) return { status: 500, body: { error: { code: 'INTERNAL' } } }
        return { body: { item: { ...stored, status: 'published', url: URL_QR } } }
      },
    })
    renderAt('/admin/letters/new')
    await fillNew()
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    await waitFor(() => expect(publishes).toBe(1), { timeout: 5000 })
    // Trang được dựng lại ở /admin/letters/<id> (RouteLoader key=pathname) → chờ nút mới sẵn sàng
    await waitFor(() => expect(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }).disabled).toBe(false), { timeout: 5000 })
    await waitFor(() => expect(screen.getByLabelText('Tên người nhận').value).toBe('Linh'), { timeout: 5000 })
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    expect(await screen.findByDisplayValue(URL_QR, {}, { timeout: 5000 })).toBeTruthy()
    expect(posts).toBe(1)
    expect(publishes).toBe(2)
  })

  // Đã sửa (T-11, trước đây BUG): src/admin/LetterEditorPage.jsx — publish trên thư mới navigate() sang /admin/letters/<id>
  // trước khi POST publish; đổi `path` làm load() chạy lại (GET). Nếu GET về sau publish, setLetter(bản nháp)
  // ghi đè kết quả xuất bản: QR/link biến mất, trạng thái hiện "nháp" dù server đã xuất bản.
  it('xuất bản thư mới: GET nạp lại sau khi chuyển địa chỉ trả về chậm không ghi đè trạng thái đã xuất bản', async () => {
    let stored = null
    let releaseGet
    mockApi({
      'GET /me': me,
      'POST /admin/letters': (_u, init) => {
        stored = { id: ID, orderId: null, label: null, status: 'draft', content: JSON.parse(init.body).content, url: null }
        return { status: 201, body: { item: stored } }
      },
      // GET (bản nháp) trả về sau khi publish đã xong
      [`GET /admin/letters/${ID}`]: () => {
        const snapshot = { ...stored }
        return new Promise((res) => (releaseGet = () => res({ body: { item: snapshot } })))
      },
      // Server thật: xuất bản ghi vào kho → GET sau đó trả bản đã xuất bản
      [`POST /admin/letters/${ID}/publish`]: () => {
        stored = { ...stored, status: 'published', url: URL_QR }
        return { body: { item: stored } }
      },
    })
    renderAt('/admin/letters/new')
    await fillNew()
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    // Đã sửa: chỉ chuyển địa chỉ (và GET nạp lại) SAU khi publish xong
    await waitFor(() => expect(releaseGet).toBeTypeOf('function'))
    releaseGet()
    expect(await screen.findByDisplayValue(URL_QR)).toBeTruthy()
    await new Promise((r) => setTimeout(r, 50))
    // BUG nếu bản nháp cũ ghi đè: QR biến mất, trạng thái về "nháp"
    expect(screen.queryByDisplayValue(URL_QR)).toBeTruthy()
  })

  // BUG (T-11): src/admin/LetterEditorPage.jsx:212-218 + src/routes.jsx (RouteLoader key={pathname} bọc cả /admin):
  // navigate() sang /admin/letters/<id> dựng lại toàn bộ trang trước khi POST publish trả về → lỗi xuất bản
  // (vd LETTER_INVALID/500) rơi vào component đã unmount, admin không thấy thông báo lỗi nào.
  it('xuất bản thư mới bị server từ chối → hiện thông báo lỗi', async () => {
    let stored = null
    mockApi({
      'GET /me': me,
      'POST /admin/letters': (_u, init) => {
        stored = { id: ID, orderId: null, label: null, status: 'draft', content: JSON.parse(init.body).content, url: null }
        return { status: 201, body: { item: stored } }
      },
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: stored } }),
      [`POST /admin/letters/${ID}/publish`]: () => ({ status: 500, body: { error: { code: 'INTERNAL' } } }),
    })
    renderAt('/admin/letters/new')
    await fillNew()
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    await waitFor(() => expect(screen.getByLabelText('Tên người nhận').value).toBe('Linh'), { timeout: 5000 })
    await new Promise((r) => setTimeout(r, 100))
    expect(screen.queryAllByRole('status').filter((n) => n.textContent.trim().length > 1).length).toBeGreaterThan(0)
  })

  it('/admin/letters/<id> của thư lẻ hiện ô ghi chú; thư của đơn không có ô ghi chú', async () => {
    mockApi({
      'GET /me': me,
      [`GET /admin/letters/${ID}`]: () => ({ body: { item: { id: ID, orderId: null, label: 'Sự kiện', status: 'draft', content, url: null } } }),
      'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }),
    })
    const { unmount } = renderAt(`/admin/letters/${ID}`)
    expect((await screen.findByLabelText('Ghi chú nội bộ (tuỳ chọn)')).value).toBe('Sự kiện')
    expect(screen.getByRole('link', { name: 'Về thư viện QR' }).getAttribute('href')).toBe('/admin/letters')
    unmount()
    renderAt('/admin/orders/LV-AAA/letter')
    await screen.findByLabelText('Tên người nhận')
    expect(screen.queryByLabelText('Ghi chú nội bộ (tuỳ chọn)')).toBeNull()
  })

  it('id không tồn tại → báo không tìm thấy phong thư', async () => {
    mockApi({ 'GET /me': me })
    renderAt(`/admin/letters/${ID}`)
    expect(await screen.findByText('Không tìm thấy phong thư.')).toBeTruthy()
  })
})

describe('Thư viện QR có thư lẻ', () => {
  const items = [
    { id: 'o1', label: null, orderCode: 'LV-AAA', status: 'published', recipientName: 'Linh', occasion: 'birthday', slug: 'abcdefghij', url: URL_QR, publishedAt: '2026-11-13T00:00:00Z', openedAt: null },
    { id: ID, label: 'Cô Mai', orderCode: null, status: 'draft', recipientName: 'Mai', occasion: null, slug: null, url: null, publishedAt: null, openedAt: null },
    { id: '22222222-2222-4333-8444-555555555555', label: null, orderCode: null, status: 'draft', recipientName: null, occasion: null, slug: null, url: null, publishedAt: null, openedAt: null },
  ]

  it('nút tạo mới, hiện label/“Thư lẻ”, link sửa theo id, tìm theo label', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items } }) })
    renderAt('/admin/letters')
    expect((await screen.findByRole('link', { name: 'Tạo phong thư mới' })).getAttribute('href')).toBe('/admin/letters/new')
    expect(await screen.findByText('Cô Mai')).toBeTruthy()
    expect(screen.getAllByText('Thư lẻ (không gắn đơn)').length).toBe(2)
    const hrefs = screen.getAllByRole('link', { name: 'Sửa thư' }).map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual(['/admin/orders/LV-AAA/letter', `/admin/letters/${ID}`, '/admin/letters/22222222-2222-4333-8444-555555555555'])
  })

  it('tìm theo label (một thư lẻ nháp duy nhất)', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items: items.slice(0, 2) } }) })
    renderAt('/admin/letters')
    await screen.findByText('Cô Mai')
    fireEvent.change(screen.getByLabelText('Tìm theo mã đơn, ghi chú hoặc tên người nhận'), { target: { value: 'cô mai' } })
    expect(screen.queryByText('LV-AAA')).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Sửa thư' }).map((a) => a.getAttribute('href'))).toEqual([`/admin/letters/${ID}`])
  })

  // BUG (T-11): src/admin/LettersGalleryPage.jsx:57 key={l.slug} — hai thư lẻ nháp cùng slug null → lọc 'cô mai'
  // còn lại HAI thẻ "Cô Mai" (thẻ cũ không bị gỡ) thay vì một.
  it('tìm theo label khi có nhiều thư lẻ nháp: chỉ còn đúng một thẻ', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items } }) })
    renderAt('/admin/letters')
    await screen.findByText('Cô Mai')
    fireEvent.change(screen.getByLabelText('Tìm theo mã đơn, ghi chú hoặc tên người nhận'), { target: { value: 'cô mai' } })
    expect(screen.getAllByRole('link', { name: 'Sửa thư' }).map((a) => a.getAttribute('href'))).toEqual([`/admin/letters/${ID}`])
  })

  // BUG (T-11): src/admin/LettersGalleryPage.jsx:57 dùng key={l.slug}; nhiều thư lẻ nháp đều slug null → trùng key,
  // React cảnh báo và có thể dựng sai thẻ khi lọc/cập nhật.
  it('không trùng React key khi có nhiều thư lẻ nháp (slug null)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items } }) })
    renderAt('/admin/letters')
    await screen.findByText('Cô Mai')
    expect(errSpy.mock.calls.flat().join(' ')).not.toMatch(/same key/i)
  })
})
