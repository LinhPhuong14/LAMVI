// @vitest-environment jsdom
import { readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import vi_ from '../i18n/messages/vi.js'
import en from '../i18n/messages/en.js'
import zh from '../i18n/messages/zh.js'
import { formatVnd } from '../lib/money.js'

// Kiểm thử độc lập bổ sung cho giao diện admin (D-38, D-46, D-47, D-48, BR-SEO-001)
const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@moc.test' } }
const me = (role) => () => ({ body: { profile: { id: 'u1', email: 'admin@moc.test', role, preferredLocale: 'vi', fullName: 'A' } } })
const products = [{ id: 'p1', slug: 'den-nguyet', kind: 'single', status: 'published', price: 890000, name: { vi: 'Đèn Nguyệt' }, sortOrder: 1 }]
const faq = [{ id: 'f1', question: { vi: 'Hỏi 1?' }, answer: { vi: 'Đáp 1' }, isPublished: true, sortOrder: 1 }]
const created = { id: 'b1', code: 'L-01', status: 'created', videoUrl: null, producedOn: '2026-10-01', title: { vi: 'Lô 1' } }
const published = { ...created, id: 'b2', code: 'L-02', status: 'video_published', videoUrl: '/v.mp4' }

const adminCalls = (fetchMock) => fetchMock.mock.calls.filter(([u]) => String(u).includes('/api/admin/'))
const callsTo = (fetchMock, method, path) =>
  fetchMock.mock.calls.filter(([u, init = {}]) => (init.method || 'GET') === method && new URL(u, 'http://x').pathname === `/api${path}`)

beforeEach(() => {
  localStorage.setItem('moc.session', JSON.stringify(session))
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('Phân quyền & SEO', () => {
  it.each(['/admin/products', '/admin/faq', '/admin/batches'])('khách thường ở %s thấy "Không có quyền truy cập", noindex, không gọi API admin', async (path) => {
    const fetchMock = mockApi({ 'GET /me': me('customer') })
    renderAt(path)
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
    expect(adminCalls(fetchMock)).toHaveLength(0)
    expect(screen.queryByRole('link', { name: 'Lô đèn' })).toBeNull()
  })

  it('/me lỗi (500) → không hiện giao diện admin', async () => {
    const fetchMock = mockApi({ 'GET /me': () => ({ status: 500, body: { error: { code: 'INTERNAL_ERROR' } } }) })
    renderAt('/admin/batches')
    expect(await screen.findByRole('heading', { name: 'Không có quyền truy cập' })).toBeInTheDocument()
    expect(adminCalls(fetchMock)).toHaveLength(0)
  })

  it.each(['/admin/faq', '/admin/batches'])('admin ở %s: trang noindex', async (path) => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/faq': () => ({ body: { items: faq } }),
      'GET /admin/batches': () => ({ body: { items: [created] } }),
    })
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    await screen.findByRole('link', { name: 'Lô đèn' })
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it.each(['/en/admin', '/en/admin/products', '/zh/admin/batches'])('%s không phải trang admin (D-48)', async (path) => {
    const fetchMock = mockApi({ 'GET /me': me('admin'), 'GET /admin/products': () => ({ body: { items: products } }) })
    renderAt(path)
    expect(await screen.findByRole('heading', { level: 1 })).toBeInTheDocument()
    expect(screen.queryByText('Quản trị LAMVI')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Sản phẩm' })).toBeNull()
    expect(adminCalls(fetchMock)).toHaveLength(0)
  })

  it('giao diện admin tiếng Việt kể cả khi hồ sơ chọn en', async () => {
    mockApi({
      'GET /me': () => ({ body: { profile: { id: 'u1', role: 'admin', preferredLocale: 'en' } } }),
      'GET /admin/products': () => ({ body: { items: products } }),
    })
    renderAt('/admin/products')
    expect(await screen.findByRole('heading', { name: 'Sản phẩm' })).toBeInTheDocument()
    expect(await screen.findByText('890.000 ₫', { normalizer: (s) => s.replace(/\s/g, ' ') })).toBeInTheDocument()
  })
})

describe('Xoá có hỏi xác nhận', () => {
  const cases = [
    ['/admin/products', 'GET /admin/products', { items: products }, 'Đèn Nguyệt', 'DELETE', '/admin/products/p1'],
    ['/admin/faq', 'GET /admin/faq', { items: faq }, 'Hỏi 1?', 'DELETE', '/admin/faq/f1'],
    ['/admin/batches', 'GET /admin/batches', { items: [created] }, 'L-01', 'DELETE', '/admin/batches/b1'],
  ]

  it.each(cases)('%s: huỷ confirm → không gọi API xoá', async (path, listKey, listBody, text, method, delPath) => {
    const fetchMock = mockApi({ 'GET /me': me('admin'), [listKey]: () => ({ body: listBody }), [`${method} ${delPath}`]: () => ({ status: 204 }) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(path)
    fireEvent.click(within((await screen.findByText(text)).closest('tr')).getByRole('button', { name: 'Xoá' }))
    expect(confirm).toHaveBeenCalledWith('Xoá mục này? Không thể hoàn tác.')
    expect(callsTo(fetchMock, method, delPath)).toHaveLength(0)
  })

  it.each(cases)('%s: đồng ý → gọi DELETE rồi tải lại danh sách', async (path, listKey, listBody, text, method, delPath) => {
    const fetchMock = mockApi({ 'GET /me': me('admin'), [listKey]: () => ({ body: listBody }), [`${method} ${delPath}`]: () => ({ status: 204 }) })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt(path)
    fireEvent.click(within((await screen.findByText(text)).closest('tr')).getByRole('button', { name: 'Xoá' }))
    await waitFor(() => expect(callsTo(fetchMock, method, delPath)).toHaveLength(1))
    const [, listPath] = listKey.split(' ')
    await waitFor(() => expect(callsTo(fetchMock, 'GET', listPath).length).toBeGreaterThanOrEqual(2))
  })

  it('xoá lô bị server từ chối (BATCH_PUBLISHED) → hiện thông báo', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [created] } }),
      'DELETE /admin/batches/b1': () => ({ status: 409, body: { error: { code: 'BATCH_PUBLISHED', message: 'x' } } }),
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-01')).closest('tr')).getByRole('button', { name: 'Xoá' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Lô đã xuất bản — không xoá được.')
  })

  it('huỷ confirm xuất bản → không gọi publish', async () => {
    const withVideo = { ...created, videoUrl: '/v.mp4' }
    const fetchMock = mockApi({ 'GET /me': me('admin'), 'GET /admin/batches': () => ({ body: { items: [withVideo] } }) })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-01')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản' }))
    expect(confirm).toHaveBeenCalled()
    expect(callsTo(fetchMock, 'POST', '/admin/batches/b1/publish')).toHaveLength(0)
  })
})

describe('Tải video (D-46)', () => {
  function failingXhr(mode) {
    class FakeXhr {
      upload = {}
      open() {}
      setRequestHeader() {}
      send() {
        if (mode === 'error') this.onerror()
        else {
          this.status = 403
          this.onload()
        }
      }
    }
    vi.stubGlobal('XMLHttpRequest', FakeXhr)
  }

  it.each(['status', 'error'])('PUT thất bại (%s) → UPLOAD_FAILED, không gọi bước gắn video', async (mode) => {
    const fetchMock = mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [created] } }),
      'POST /admin/batches/b1/video-upload': () => ({ status: 201, body: { path: 'b1/x.mp4', uploadUrl: 'https://storage.test/up', headers: {} } }),
      'POST /admin/batches/b1/video': () => ({ body: { item: created } }),
    })
    failingXhr(mode)
    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-01')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['abc'], 'a.mp4', { type: 'video/mp4' })] } })
    expect(await screen.findByText('Tải video lên thất bại. Vui lòng thử lại.')).toBeInTheDocument()
    expect(callsTo(fetchMock, 'POST', '/admin/batches/b1/video')).toHaveLength(0)
    expect(screen.queryByText('Đã tải video lên.')).toBeNull()
    // Nút chọn file dùng lại được
    expect(document.querySelector('input[type="file"]')).not.toBeDisabled()
  })

  it('server từ chối xin URL (VIDEO_TOO_LARGE) → hiện lỗi, không PUT', async () => {
    const put = vi.fn()
    vi.stubGlobal(
      'XMLHttpRequest',
      class {
        upload = {}
        open = put
        setRequestHeader() {}
        send() {}
      },
    )
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [created] } }),
      'POST /admin/batches/b1/video-upload': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', fields: { size: 'VIDEO_TOO_LARGE' } } },
      }),
    })
    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-01')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.change(document.querySelector('input[type="file"]'), { target: { files: [new File(['abc'], 'a.mkv', { type: 'video/x-matroska' })] } })
    expect(await screen.findByText('Video vượt quá dung lượng cho phép.')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
  })
})

describe('Lỗi theo trường hiện đúng chỗ', () => {
  it('form lô: code/producedOn/title hiện dưới trường tương ứng', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [] } }),
      'POST /admin/batches': () => ({
        status: 400,
        body: { error: { code: 'VALIDATION_ERROR', fields: { code: 'INVALID_BATCH_CODE', producedOn: 'INVALID_DATE', title: 'VI_REQUIRED' } } },
      }),
    })
    renderAt('/admin/batches')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    const code = screen.getByLabelText('Mã lô (in trên QR khắc đèn)')
    fireEvent.change(code, { target: { value: 'l 1' } })
    expect(code).toHaveValue('L 1') // tự viết hoa
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(code).toHaveAttribute('aria-invalid', 'true'))
    expect(code).toHaveAccessibleDescription('Mã lô chỉ gồm chữ in hoa, số và gạch nối.')
    expect(screen.getByLabelText('Ngày làm')).toHaveAccessibleDescription('Ngày không hợp lệ.')
    const titleSet = screen.getByRole('group', { name: 'Tiêu đề' })
    expect(within(titleSet).getByText('Cần có bản tiếng Việt.')).toBeInTheDocument()
    // Không hiện thêm thông báo chung khi đã có lỗi theo trường
    expect(screen.queryByText('Vui lòng kiểm tra lại thông tin.')).toBeNull()
  })

  it('form lô: đổi mã lô đã xuất bản — không gửi code', async () => {
    const bodies = []
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/batches': () => ({ body: { items: [published] } }),
      'PATCH /admin/batches/b2': (u, init) => (bodies.push(JSON.parse(init.body)), { body: { item: published } }),
    })
    renderAt('/admin/batches')
    fireEvent.click(within((await screen.findByText('L-02')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(bodies).toHaveLength(1))
    expect(bodies[0]).not.toHaveProperty('code')
    expect(bodies[0]).not.toHaveProperty('status')
    expect(bodies[0]).not.toHaveProperty('videoUrl')
  })

  it('form FAQ: lỗi question/answer hiện trong nhóm tương ứng', async () => {
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/faq': () => ({ body: { items: [] } }),
      'POST /admin/faq': () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { question: 'REQUIRED', answer: 'TOO_LONG' } } } }),
    })
    renderAt('/admin/faq')
    fireEvent.click(await screen.findByRole('button', { name: 'Thêm mới' }))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    const q = await screen.findByRole('group', { name: /Câu hỏi/ })
    expect(within(q).getByText('Vui lòng nhập trường này.')).toBeInTheDocument()
    expect(within(screen.getByRole('group', { name: /Trả lời/ })).getByText('Nội dung quá dài.')).toBeInTheDocument()
  })

  it('form sản phẩm: sửa không gửi id/createdAt/updatedAt; lỗi giá hiện dưới ô giá', async () => {
    const bodies = []
    const p = { ...products[0], createdAt: '2026-01-01', updatedAt: '2026-01-02' }
    mockApi({
      'GET /me': me('admin'),
      'GET /admin/products': () => ({ body: { items: [p] } }),
      'PATCH /admin/products/p1': (u, init) => (
        bodies.push(JSON.parse(init.body)), { status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { price: 'INVALID_PRICE' } } } }
      ),
    })
    renderAt('/admin/products')
    fireEvent.click(within((await screen.findByText('Đèn Nguyệt')).closest('tr')).getByRole('button', { name: 'Sửa' }))
    fireEvent.change(screen.getByLabelText('Giá bán đã gồm VAT (VND)'), { target: { value: '-5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu' }))
    await waitFor(() => expect(screen.getByLabelText('Giá bán đã gồm VAT (VND)')).toHaveAccessibleDescription('Giá phải là số nguyên VND, không âm.'))
    expect(bodies[0]).not.toHaveProperty('id')
    expect(bodies[0]).not.toHaveProperty('createdAt')
    expect(bodies[0]).not.toHaveProperty('updatedAt')
    expect(bodies[0].price).toBe(-5)
  })
})

describe('Mã nguồn & bản dịch', () => {
  const VN = /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i
  const dir = resolve(process.cwd(), 'src/admin')

  it('không còn chuỗi tiếng Việt cứng trong src/admin/*.jsx (ngoài strings.js, trừ tên thương hiệu MỘC)', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.jsx') && !f.includes('.test.'))
    expect(files.length).toBeGreaterThanOrEqual(5)
    const offenders = []
    for (const f of files) {
      const src = readFileSync(join(dir, f), 'utf8')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1')
        .replace(/MỘC/g, '')
      src.split('\n').forEach((line, i) => VN.test(line) && offenders.push(`${f}:${i + 1}: ${line.trim()}`))
    }
    expect(offenders).toEqual([])
  })

  it('mọi mã lỗi errors.* của tiếng Việt có ở en và zh', () => {
    const keys = Object.keys(vi_.errors)
    for (const code of ['SLUG_TAKEN', 'BATCH_CODE_LOCKED', 'BATCH_PUBLISHED', 'VIDEO_REQUIRED', 'UPLOAD_FAILED', 'INVALID_VIDEO_TYPE', 'VIDEO_TOO_LARGE', 'VIDEO_NOT_UPLOADED', 'INVALID_DATE', 'VI_REQUIRED', 'FORBIDDEN']) {
      expect(keys).toContain(code)
    }
    expect(Object.keys(en.errors).sort()).toEqual([...keys].sort())
    expect(Object.keys(zh.errors).sort()).toEqual([...keys].sort())
  })

  it('formatVnd: số nguyên VND, không phần thập phân', () => {
    const norm = (s) => s.replace(/\s/g, ' ')
    expect(norm(formatVnd(890000))).toBe('890.000 ₫')
    expect(norm(formatVnd(0))).toBe('0 ₫')
    expect(norm(formatVnd(1_000_000_000))).toBe('1.000.000.000 ₫')
  })
})
