// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const products = [
  { id: 'p1', slug: 'den-nguyet', kind: 'single', status: 'published', priceExclVat: 890000, name: { vi: 'Đèn Nguyệt' }, sortOrder: 1 },
  { id: 'p2', slug: 'den-an', kind: 'single', status: 'hidden', priceExclVat: 500000, name: { vi: 'Đèn Ẩn' }, sortOrder: 2 },
]

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

describe('Admin — phân quyền (D-38, D-48)', () => {
  it('chưa đăng nhập → trang đăng nhập với next=/admin/...', async () => {
    localStorage.clear()
    mockApi({})
    renderAt('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Đăng nhập' })).toBeInTheDocument()
  })

  it('không phải admin → báo không có quyền, không gọi API admin', async () => {
    const fetchMock = mockApi({ 'GET /me': me('customer') })
    renderAt('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(fetchMock.mock.calls.some(([u]) => String(u).includes('/api/admin/'))).toBe(false)
  })

  it('/admin → chuyển tới Đơn hàng; trang noindex', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/orders': () => ({ body: { items: [] } }) })
    renderAt('/admin')
    expect(await screen.findByRole('heading', { name: 'Đơn hàng' })).toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })
})

describe('Admin — sản phẩm (FR-CAT-004)', () => {
  it('liệt kê mọi trạng thái, gồm sản phẩm đã ẩn', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: products } }) })
    renderAt('/admin/products')
    const row = (await screen.findByText('Đèn Ẩn')).closest('tr')
    expect(within(row).getByText('Đã ẩn')).toBeInTheDocument()
    expect(within(row).getByText(/500\.000/)).toBeInTheDocument()
  })

  it('tạo sản phẩm: gửi giá dạng số, tên 3 ngôn ngữ; lỗi theo trường hiện ra', async () => {
    const posts = []
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/products': () => ({ body: { items: products } }),
      'POST /admin/products': (url, init) => {
        posts.push(JSON.parse(init.body))
        return posts.length === 1
          ? { status: 409, body: { error: { code: 'SLUG_TAKEN', fields: { slug: 'SLUG_TAKEN' } } } }
          : { status: 201, body: { item: { id: 'p3' } } }
      },
    })
    renderAt('/admin/products')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.change(screen.getByLabelText('Slug (đường dẫn)'), { target: { value: 'den-nguyet' } })
    fireEvent.change(screen.getByLabelText('Giá chưa VAT (VND)'), { target: { value: '750000' } })
    fireEvent.change(screen.getByLabelText('Tên sản phẩm — Tiếng Việt'), { target: { value: 'Đèn Mới' } })
    fireEvent.change(screen.getByLabelText('Tên sản phẩm — English'), { target: { value: 'New' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    expect(await screen.findByText('Slug đã được dùng.')).toBeInTheDocument()
    expect(posts[0]).toMatchObject({ slug: 'den-nguyet', priceExclVat: 750000, status: 'draft', name: { vi: 'Đèn Mới', en: 'New' } })

    fireEvent.change(screen.getByLabelText('Slug (đường dẫn)'), { target: { value: 'den-moi' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Lưu' })).not.toBeInTheDocument())
  })
})

describe('Admin — lô & video (FR-QR-007, D-46, D-47)', () => {
  const created = { id: 'b1', code: 'L-01', status: 'created', videoUrl: null, producedOn: '2026-10-01', title: { vi: 'Lô 1' } }
  const published = { ...created, id: 'b2', code: 'L-02', status: 'video_published', videoUrl: '/v.mp4' }

  it('lô đã xuất bản: không có nút xoá, mã lô khoá, có nút thay video, không có nút xuất bản', async () => {
    mockApi({ 'GET /me': me('admin'), 'GET /admin/batches': () => ({ body: { items: [created, published] } }) })
    renderAt('/admin/batches')
    const pubRow = (await screen.findByText('L-02')).closest('tr')
    expect(within(pubRow).queryByRole('button', { name: 'Xoá' })).toBeNull()
    expect(within(screen.getByText('L-01').closest('tr')).getByRole('button', { name: 'Xoá' })).toBeInTheDocument()

    fireEvent.click(within(pubRow).getByRole('button', { name: 'Sửa' }))
    expect(screen.getByLabelText('Mã lô (in trên QR khắc đèn)')).toBeDisabled()
    expect(screen.getByText('Thay video')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Xuất bản' })).toBeNull()
  })

  it('tải video: xin URL → PUT file → gắn vào lô → xuất bản', async () => {
    const calls = []
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [created] } }),
      'POST /admin/batches/b1/video-upload': (url, init) => {
        calls.push(['upload-url', JSON.parse(init.body)])
        return { status: 201, body: { path: 'b1/x.mp4', uploadUrl: 'https://storage.test/up?token=t', headers: { 'Content-Type': 'video/mp4' } } }
      },
      'POST /admin/batches/b1/video': (url, init) => {
        calls.push(['attach', JSON.parse(init.body)])
        return { body: { item: { ...created, videoUrl: 'https://cdn.test/b1/x.mp4', videoPath: 'b1/x.mp4' } } }
      },
      'POST /admin/batches/b1/publish': () => {
        calls.push(['publish'])
        return { body: { item: { ...created, status: 'video_published', videoUrl: 'https://cdn.test/b1/x.mp4' } } }
      },
    })
    // Giả lập XMLHttpRequest PUT thành công
    const sent = []
    class FakeXhr {
      upload = {}
      open(method, url) {
        sent.push({ method, url })
      }
      setRequestHeader() {}
      send(file) {
        sent.at(-1).file = file
        this.status = 200
        this.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 })
        this.onload()
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-01')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    expect(screen.getByRole('button', { name: 'Xuất bản' })).toBeDisabled()

    const file = new File(['abc'], 'lo.mp4', { type: 'video/mp4' })
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [file] } })
    expect(await screen.findByText('Đã tải video lên.')).toBeInTheDocument()
    expect(calls[0]).toEqual(['upload-url', { contentType: 'video/mp4', size: 3 }])
    expect(sent[0]).toMatchObject({ method: 'PUT', url: 'https://storage.test/up?token=t' })
    expect(calls[1]).toEqual(['attach', { path: 'b1/x.mp4' }])

    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }))
    expect(await screen.findByText(/Lô đã xuất bản/)).toBeInTheDocument()
    expect(calls.at(-1)).toEqual(['publish'])
  })
})
