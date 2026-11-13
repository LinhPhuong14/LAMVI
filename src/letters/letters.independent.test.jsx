// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) phía giao diện cho phong thư (D-134, D-135): trang người nhận, lá thư,
// trình soạn admin, thư viện QR. Bổ sung cho src/admin/Letters.test.jsx.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import LetterPaper from './LetterPaper.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const TOKEN = 'A'.repeat(43)
const URL_QR = `https://abcdefghij.thu.lamvi.test/#${TOKEN}`
const content = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.location.hash = ''
  localStorage.clear()
})

const openCalls = (f) => f.mock.calls.filter(([u]) => String(u).includes('/letters/open'))

describe('Trang người nhận /thu/:slug — trạng thái lỗi', () => {
  it('API 404 → màn "không tìm thấy" (không lộ lý do)', async () => {
    const f = mockApi({ 'POST /letters/open': () => ({ status: 404, body: { error: { code: 'NOT_FOUND' } } }) })
    window.location.hash = `#${TOKEN}`
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(openCalls(f)).toHaveLength(1)
  })

  it('API 500 / 429 → màn "chưa mở được", gợi ý tải lại', async () => {
    for (const status of [500, 429]) {
      mockApi({ 'POST /letters/open': () => ({ status, body: { error: { code: 'X' } } }) })
      window.location.hash = `#${TOKEN}`
      const { unmount } = renderAt('/thu/abcdefghij')
      expect(await screen.findByText('Chưa mở được phong thư')).toBeTruthy()
      unmount()
    }
  })

  it('mất mạng (fetch ném lỗi) → "chưa mở được", không treo ở "Đang mở…"', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('Failed to fetch')
    }))
    window.location.hash = `#${TOKEN}`
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Chưa mở được phong thư')).toBeTruthy()
    expect(screen.queryByText('Đang mở phong thư…')).toBeNull()
  })

  it('phản hồi 200 nhưng thiếu item → không vẽ thư rỗng', async () => {
    mockApi({ 'POST /letters/open': () => ({ body: {} }) })
    window.location.hash = `#${TOKEN}`
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Chưa mở được phong thư')).toBeTruthy()
  })

  it('hash chỉ có "#" → không gọi API', async () => {
    const f = mockApi({})
    window.location.hash = '#'
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(openCalls(f)).toHaveLength(0)
  })

  it('hash mã hoá hỏng (%E0%A4%A) → "không tìm thấy", không làm sập trang', async () => {
    const f = mockApi({})
    window.location.hash = '#%E0%A4%A'
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(openCalls(f)).toHaveLength(0)
  })

  it('token chỉ nằm trong body POST, không nằm trên URL gọi API', async () => {
    const f = mockApi({ 'POST /letters/open': () => ({ body: { item: content } }) })
    window.location.hash = `#${TOKEN}`
    renderAt('/thu/abcdefghij')
    await screen.findByRole('button', { name: 'Mở thư gửi Linh' })
    const [url, init] = openCalls(f)[0]
    expect(String(url)).not.toContain(TOKEN)
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body).token).toBe(TOKEN)
  })
})

describe('LetterPaper', () => {
  it('thư video: có video + poster + phụ đề; không có nút bất ngờ khi occasionData rỗng', () => {
    const { container } = render(
      <LetterPaper preview letter={{ ...content, kind: 'video', videoUrl: '/videos/a.mp4', posterUrl: '/images/p.jpg', captionsUrl: '/videos/a.vtt' }} />,
    )
    const v = container.querySelector('video')
    expect(v.getAttribute('src')).toBe('/videos/a.mp4')
    expect(v.getAttribute('poster')).toBe('/images/p.jpg')
    expect(container.querySelector('track').getAttribute('src')).toBe('/videos/a.vtt')
    expect(screen.queryByRole('button', { name: 'Thổi nến' })).toBeNull()
  })

  it('thư chữ mang videoUrl lạ → không vẽ video', () => {
    const { container } = render(<LetterPaper preview letter={{ ...content, videoUrl: '/videos/a.mp4' }} />)
    expect(container.querySelector('video')).toBeNull()
  })

  it('nội dung có thẻ HTML được hiển thị như chữ thường (không chèn HTML)', () => {
    const { container } = render(<LetterPaper preview letter={{ ...content, recipientName: '<img src=x onerror=alert(1)>', message: ['<b>đậm</b>'] }} />)
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
    expect(screen.getByText('<b>đậm</b>')).toBeTruthy()
  })

  it('kỷ niệm: mở bất ngờ thấy ngày + ảnh; xa cách: thấy hai nơi; bất chợt: biểu tượng', () => {
    const { unmount } = render(<LetterPaper preview letter={{ ...content, occasion: 'anniversary', occasionData: { date: '14/02/2020', photos: ['/images/a.jpg', '/images/b.jpg'] } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mở kỷ niệm' }))
    expect(screen.getByText('14/02/2020')).toBeTruthy()
    expect(screen.getAllByAltText('Ảnh kỷ niệm')).toHaveLength(2)
    unmount()

    const r2 = render(<LetterPaper preview letter={{ ...content, occasion: 'longDistance', occasionData: { places: ['Hà Nội', 'Paris'] } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Nhìn qua ô cửa' }))
    expect(screen.getByText('Hà Nội · Paris')).toBeTruthy()
    r2.unmount()

    render(<LetterPaper preview letter={{ ...content, occasion: 'justBecause', occasionData: { icon: '🌸', message: 'Vì em' } }} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vì sao lại tặng?' }))
    expect(screen.getByText('🌸')).toBeTruthy()
    expect(screen.getByText('Vì em')).toBeTruthy()
  })

  it('không phải preview: phong bì đóng tới khi chạm', () => {
    render(<LetterPaper letter={content} />)
    expect(screen.queryByText('Đoạn một.')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Mở thư gửi Linh' }))
    expect(screen.getByText('Đoạn một.')).toBeTruthy()
    expect(screen.getByText('— An')).toBeTruthy()
  })
})

describe('Trình soạn phong thư (admin)', () => {
  const letterPath = '/admin/orders/LV-AAA/letter'

  it('đổi dịp sang cột mốc: chỉ gửi nhãn cột mốc, không gửi ảnh/nơi chốn', async () => {
    const sent = []
    mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: { status: 'draft', content: { ...content, occasion: 'anniversary', occasionData: { photos: ['/images/a.jpg'], date: '1/1' } } } } }),
      [`PUT ${letterPath}`]: (_u, init) => {
        sent.push(JSON.parse(init.body).content)
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
    })
    renderAt(letterPath)
    fireEvent.change(await screen.findByLabelText('Dịp'), { target: { value: 'milestone' } })
    fireEvent.change(screen.getByLabelText('Cột mốc (vd Đã tốt nghiệp)'), { target: { value: 'Tốt nghiệp' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0].occasion).toBe('milestone')
    expect(sent[0].occasionData).toEqual({ message: '', label: 'Tốt nghiệp' })
  })

  it('server báo lỗi trường → hiện lỗi cạnh trường và thông báo chung', async () => {
    mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: null } }),
      [`PUT ${letterPath}`]: () => ({ status: 400, body: { error: { code: 'VALIDATION_ERROR', fields: { recipientName: 'TOO_LONG' } } } }),
    })
    renderAt(letterPath)
    fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Linh' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'An' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    expect(await screen.findByText('Quá dài')).toBeTruthy()
    expect(screen.getByText('Còn trường chưa hợp lệ.')).toBeTruthy()
  })

  it('xuất bản khi còn thay đổi chưa lưu: PUT trước rồi mới publish', async () => {
    const order = []
    mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: { status: 'draft', content, url: null } } }),
      [`PUT ${letterPath}`]: (_u, init) => {
        order.push('PUT')
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
      [`POST ${letterPath}/publish`]: () => {
        order.push('PUBLISH')
        return { body: { item: { status: 'published', content, url: URL_QR } } }
      },
    })
    renderAt(letterPath)
    fireEvent.change(await screen.findByLabelText('Tái bút (tuỳ chọn)'), { target: { value: 'PS mới' } })
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    expect(await screen.findByDisplayValue(URL_QR)).toBeTruthy()
    expect(order).toEqual(['PUT', 'PUBLISH'])
  })

  it('xuất bản lỗi ORDER_CANCELLED → hiện thông báo, không có QR', async () => {
    mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: { status: 'draft', content, url: null } } }),
      [`POST ${letterPath}/publish`]: () => ({ status: 409, body: { error: { code: 'ORDER_CANCELLED' } } }),
    })
    renderAt(letterPath)
    fireEvent.click(await screen.findByRole('button', { name: 'Xuất bản & tạo QR' }))
    expect(await screen.findByText('Đơn đã huỷ, không xuất bản được.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Tạo QR mới' })).toBeNull()
  })

  it('tạo QR mới / gỡ xuất bản: huỷ hộp xác nhận → không gọi API; đồng ý → gọi đúng endpoint', async () => {
    const posts = []
    const f = mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: { status: 'published', content, url: URL_QR, openedAt: null } } }),
      [`POST ${letterPath}/rotate`]: () => {
        posts.push('rotate')
        return { body: { item: { status: 'published', content, url: URL_QR.replace('abc', 'xyz') } } }
      },
      [`POST ${letterPath}/unpublish`]: () => {
        posts.push('unpublish')
        return { body: { item: { status: 'draft', content, url: null } } }
      },
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    renderAt(letterPath)
    fireEvent.click(await screen.findByRole('button', { name: 'Tạo QR mới' }))
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ xuất bản' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(f.mock.calls.filter(([, i]) => i?.method === 'POST')).toHaveLength(0)

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Tạo QR mới' }))
    expect(await screen.findByDisplayValue(URL_QR.replace('abc', 'xyz'))).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Gỡ xuất bản' }))
    await waitFor(() => expect(posts).toEqual(['rotate', 'unpublish']))
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Tạo QR mới' })).toBeNull())
    expect(screen.getByRole('button', { name: 'Xuất bản & tạo QR' })).toBeTruthy()
  })

  it('đơn không tồn tại → "Không tìm thấy đơn."', async () => {
    mockApi({ 'GET /me': me })
    renderAt('/admin/orders/LV-ZZZ/letter')
    expect(await screen.findByText('Không tìm thấy đơn.')).toBeTruthy()
  })

  it('xem trước không gọi API mở thư (không đánh dấu "đã mở")', async () => {
    const f = mockApi({
      'GET /me': me,
      [`GET ${letterPath}`]: () => ({ body: { item: { status: 'published', content, url: URL_QR } } }),
    })
    renderAt(letterPath)
    expect((await screen.findAllByText('Đoạn một.')).length).toBeGreaterThan(0)
    expect(openCalls(f)).toHaveLength(0)
  })
})

describe('Thư viện QR — trạng thái', () => {
  it('lỗi tải → thông báo lỗi', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ status: 500, body: { error: { code: 'X' } } }) })
    renderAt('/admin/letters')
    expect(await screen.findByRole('alert')).toBeTruthy()
  })

  it('rỗng → thông báo chưa có phong thư', async () => {
    mockApi({ 'GET /me': me, 'GET /admin/letters': () => ({ body: { items: [] } }) })
    renderAt('/admin/letters')
    expect(await screen.findByText('Chưa có phong thư nào được xuất bản.')).toBeTruthy()
  })

  it('mục không có url → không có nút sao chép link; đơn null → không có link sửa', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/letters': () => ({ body: { items: [{ orderCode: null, status: 'draft', recipientName: 'Lan', occasion: 'birthday', slug: 'cccccccccc', url: null }] } }),
    })
    renderAt('/admin/letters')
    expect(await screen.findByText(/Lan/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Sao chép link' })).toBeNull()
    expect(screen.queryByRole('link', { name: 'Sửa thư' })).toBeNull()
  })

  it('khách thường không vào được thư viện QR', async () => {
    const f = mockApi({ 'GET /me': () => ({ body: { profile: { id: 'u1', email: 'k@lamvi.test', role: 'customer', preferredLocale: 'vi', fullName: 'K' } } }) })
    renderAt('/admin/letters')
    await waitFor(() => expect(f).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 50))
    expect(f.mock.calls.filter(([u]) => String(u).includes('/admin/letters'))).toHaveLength(0)
  })
})
