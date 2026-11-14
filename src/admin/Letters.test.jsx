// @vitest-environment jsdom
// D-134, D-135: soạn phong thư, thư viện QR, trang người nhận
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const session = { accessToken: 'a1', refreshToken: 'r1', expiresAt: 9999999999, user: { id: 'u1', email: 'admin@lamvi.test' } }
const me = () => ({ body: { profile: { id: 'u1', email: 'admin@lamvi.test', role: 'admin', preferredLocale: 'vi', fullName: 'A' } } })
const URL_QR = 'https://lamvi.test/thu/abcdefghij#' + 'A'.repeat(43)
const content = { recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: { message: 'Tuổi mới' } }

beforeEach(() => localStorage.setItem('moc.session', JSON.stringify(session)))
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  window.location.hash = ''
})

describe('Soạn phong thư', () => {
  it('lưu nháp gửi nội dung; xuất bản hiện QR + link', async () => {
    const calls = []
    mockApi({
      'GET /me': me,
      'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }),
      'PUT /admin/orders/LV-AAA/letter': (_u, init) => {
        calls.push(JSON.parse(init.body))
        return { body: { item: { status: 'draft', content: JSON.parse(init.body).content, url: null } } }
      },
      'POST /admin/orders/LV-AAA/letter/publish': () => ({ body: { item: { status: 'published', content, url: URL_QR } } }),
    })
    renderAt('/admin/orders/LV-AAA/letter')
    fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Linh' } })
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'An' } })
    fireEvent.change(screen.getByLabelText('Nội dung thư'), { target: { value: 'Đoạn một.\n\nĐoạn hai.' } })
    // Đủ tên + nội dung → mở được xem thử trong Phòng thư
    expect(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }).disabled).toBe(false)
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nháp' }))
    await waitFor(() => expect(calls).toHaveLength(1))
    expect(calls[0].content).toMatchObject({ recipientName: 'Linh', senderName: 'An', message: 'Đoạn một.\n\nĐoạn hai.' })
    fireEvent.click(screen.getByRole('button', { name: 'Xuất bản & tạo QR' }))
    expect(await screen.findByDisplayValue(URL_QR)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Tạo QR mới' })).toBeTruthy()
  })
})

describe('Soạn phong thư: mẫu Phòng thư + xem thử', () => {
  it('chọn mẫu theo dịp điền nội dung, giữ tên đã gõ; xem thử mở Phòng thư toàn màn hình', async () => {
    vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
    mockApi({ 'GET /me': me, 'GET /admin/orders/LV-AAA/letter': () => ({ body: { item: null } }) })
    renderAt('/admin/orders/LV-AAA/letter?fallback=1')
    fireEvent.change(await screen.findByLabelText('Tên người nhận'), { target: { value: 'Ngọc' } })
    // Chưa đủ dữ liệu → nút xem thử bị khoá
    expect(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }).disabled).toBe(true)
    fireEvent.change(screen.getByLabelText('Tên người gửi'), { target: { value: 'Minh' } })
    fireEvent.change(screen.getByLabelText('Mẫu lời chúc Phòng thư'), { target: { value: 'milestone' } })
    expect(screen.getByLabelText('Dịp').value).toBe('milestone')
    expect(screen.getByLabelText('Nội dung thư').value).toMatch(/^Có những ngày/)
    expect(screen.getByLabelText('Cột mốc (vd Đã tốt nghiệp)').value).toBe('Đã tốt nghiệp')
    expect(screen.getByLabelText('Tên người nhận').value).toBe('Ngọc')
    // Đã có nội dung: đổi mẫu phải xác nhận; huỷ thì giữ nguyên
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    fireEvent.change(screen.getByLabelText('Mẫu lời chúc Phòng thư'), { target: { value: 'birthday' } })
    expect(screen.getByLabelText('Dịp').value).toBe('milestone')

    fireEvent.click(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }))
    const dialog = await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    expect(dialog.parentElement).toBe(document.body)
    fireEvent.click(await screen.findByRole('button', { name: 'Chạm để bật đèn' }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Chạm vào phong bì để mở thư' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kéo mép giấy lên' }), { detail: 0 })
    expect(await screen.findByRole('heading', { level: 2, name: 'Gửi Ngọc,' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Xem lại cách làm đèn' })).toBeTruthy()
    // Nút ↻ của phòng đóng xem thử
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem trước' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Xem thử trong Phòng thư' }))
    await screen.findByRole('dialog', { name: 'Xem thử trong Phòng thư' })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Thư viện QR', () => {
  it('liệt kê QR cũ, lọc theo mã đơn/tên', async () => {
    mockApi({
      'GET /me': me,
      'GET /admin/letters': () => ({
        body: {
          items: [
            { orderCode: 'LV-AAA', status: 'published', recipientName: 'Linh', occasion: 'birthday', slug: 'abcdefghij', url: URL_QR, publishedAt: '2026-11-13T00:00:00Z', openedAt: null },
            { orderCode: 'LV-BBB', status: 'draft', recipientName: 'Minh', occasion: 'anniversary', slug: 'bbcdefghij', url: URL_QR.replace('abc', 'bbc'), publishedAt: null, openedAt: '2026-11-13T00:00:00Z' },
          ],
        },
      }),
    })
    renderAt('/admin/letters')
    expect(await screen.findByText('LV-AAA')).toBeTruthy()
    expect(screen.getByText('LV-BBB')).toBeTruthy()
    fireEvent.change(screen.getByLabelText('Tìm theo mã đơn hoặc tên người nhận'), { target: { value: 'minh' } })
    expect(screen.queryByText('LV-AAA')).toBeNull()
    expect(screen.getByRole('link', { name: 'Sửa thư' }).getAttribute('href')).toBe('/admin/orders/LV-BBB/letter')
  })
})

describe('Trang người nhận /thu/:slug', () => {
  const openApi = () => {
    const sent = []
    mockApi({
      'POST /letters/open': (_u, init) => {
        sent.push(JSON.parse(init.body))
        return { body: { item: content } }
      },
    })
    window.location.hash = '#' + 'A'.repeat(43)
    return sent
  }
  const video = () => document.querySelector('video.lt-intro-video')

  // Phòng thư (letter-room) ở chế độ 2D dự phòng (?fallback=1, jsdom không có WebGL) + giảm chuyển động
  // để các bước chuyển cảnh chỉ còn 25 ms
  const reduceMotion = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
  const lightSwitch = () => screen.queryByRole('button', { name: 'Chạm để bật đèn' })

  it('D-138: xem hết 2 video → Phòng thư: bật đèn → phong bì → thư → nút xem lại', async () => {
    reduceMotion()
    const sent = openApi()
    renderAt('/thu/abcdefghij?fallback=1')
    expect(await screen.findByText('Tranh Đông Hồ trên đèn giấy dó')).toBeTruthy()
    expect(sent).toEqual([{ slug: 'abcdefghij', token: 'A'.repeat(43) }])
    // Lần đầu: không có nút bỏ qua, chưa vào phòng
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
    expect(lightSwitch()).toBeNull()
    fireEvent.ended(video())
    expect(await screen.findByText('Từ làng giấy dó đến chiếc đèn')).toBeTruthy()
    expect(lightSwitch()).toBeNull()
    fireEvent.ended(video())
    fireEvent.click(await screen.findByRole('button', { name: 'Chạm để bật đèn' }, { timeout: 5000 }))
    fireEvent.click(await screen.findByRole('button', { name: 'Chạm vào phong bì để mở thư' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Kéo mép giấy lên' }), { detail: 0 })
    // Tiêu đề viết tay đúng tên người nhận, rồi nội dung thư
    expect(await screen.findByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
    expect(screen.getByText('Đoạn một.')).toBeTruthy()
    expect(screen.getByText('An', { selector: 'strong' })).toBeTruthy()
    // Không có menu lời chúc mẫu ở thư thật
    expect(screen.queryByText('Lời chúc mẫu')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Xem lại cách làm đèn' }))
    expect(screen.getByRole('dialog', { name: 'Từ làng giấy dó đến chiếc đèn' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng video' }))
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Lịch sử văn hoá' }))
    expect(screen.getByRole('dialog', { name: 'Tranh Đông Hồ trên đèn giấy dó' })).toBeTruthy()
    expect(screen.getByRole('link', { name: /truyện kể/ }).getAttribute('href')).toBe('/welcome')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    // Đã xem hết → lần sau được bỏ qua
    expect(localStorage.getItem('lv.letter.intro.abcdefghij')).toBe('1')
  })

  it('đã xem hết ở lần trước → có nút "Bỏ qua, vào phòng"', async () => {
    reduceMotion()
    localStorage.setItem('lv.letter.intro.abcdefghij', '1')
    openApi()
    renderAt('/thu/abcdefghij?fallback=1')
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(await screen.findByRole('button', { name: 'Chạm để bật đèn' }, { timeout: 5000 })).toBeTruthy()
    localStorage.removeItem('lv.letter.intro.abcdefghij')
  })

  it('video lỗi → hiện "Tiếp tục" để không kẹt ngoài lá thư', async () => {
    openApi()
    renderAt('/thu/abcdefghij')
    await screen.findByText('Tranh Đông Hồ trên đèn giấy dó')
    fireEvent.error(video())
    fireEvent.click(await screen.findByRole('button', { name: 'Tiếp tục' }))
    expect(await screen.findByText('Từ làng giấy dó đến chiếc đèn')).toBeTruthy()
  })

  it('không có token → "không tìm thấy", không gọi API', async () => {
    const f = mockApi({})
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(f.mock.calls.filter(([u]) => String(u).includes('/letters/open'))).toHaveLength(0)
  })
})
