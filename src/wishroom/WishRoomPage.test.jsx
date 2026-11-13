// @vitest-environment jsdom
// jsdom không cài WebGL → trang luôn rơi về lối 2D (Fallback2D) ở đây, đúng nhánh yêu cầu §4
// "Nếu WebGL không khởi tạo được, vẫn cho người nhận bật đèn và mở thư qua giao diện 2D".
import { afterEach } from 'vitest'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import WishRoomPage from './WishRoomPage.jsx'

function renderAt(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/phong-thu" element={<WishRoomPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

function setReducedMotion(reduce) {
  window.matchMedia = (query) => ({
    matches: /prefers-reduced-motion/.test(query) ? reduce : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
  })
}

afterEach(() => setReducedMotion(false))

describe('WishRoomPage — lối 2D (mẫu thư chữ)', () => {
  it('đi hết luồng bật đèn → chạm phong bì → mở thư → đọc nội dung', async () => {
    renderAt('/phong-thu')
    const lightBtn = await screen.findByRole('button', { name: /Chạm để bật đèn/i })
    fireEvent.click(lightBtn)

    const envelopeBtn = await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i })
    fireEvent.click(envelopeBtn)

    const openBtn = await screen.findByRole('button', { name: /Chạm để kéo thư ra/i })
    fireEvent.click(openBtn)

    await screen.findByText(/Linh ơi,/)
    await screen.findByText(/Thương Linh nhiều\./)
    expect(screen.getByText(/— Minh/)).toBeInTheDocument()
  })

  it('hướng dẫn là <button> focus được — Enter/Space kích hoạt mặc định của trình duyệt, không cần JS riêng', async () => {
    renderAt('/phong-thu')
    const lightBtn = await screen.findByRole('button', { name: /Chạm để bật đèn/i })
    expect(lightBtn.tagName).toBe('BUTTON')
    lightBtn.focus()
    expect(document.activeElement).toBe(lightBtn)
    fireEvent.click(lightBtn) // tương đương Enter/Space trên <button> thật ở trình duyệt
    await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i })
  })

  it('tái bút hiện sau khi thư chữ hiện đủ, chạm P.S. để lộ câu cuối', async () => {
    renderAt('/phong-thu')
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để bật đèn/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để kéo thư ra/i }))
    await screen.findByText(/Thương Linh nhiều\./)

    const psTab = await screen.findByRole('button', { name: 'P.S.' })
    fireEvent.click(psTab)
    await screen.findByText(/lần sau về nhà nhớ mang qua chị gấp hạc giấy/)
  })

  it('giảm chuyển động: nội dung hiện ngay, không cần chờ hoạt ảnh nét mực', async () => {
    setReducedMotion(true)
    renderAt('/phong-thu')
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để bật đèn/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để kéo thư ra/i }))
    // Không cần waitFor dài — nội dung phải có ngay vì giảm chuyển động bỏ timer của InkGreeting
    expect(await screen.findByText(/Thương Linh nhiều\./)).toBeInTheDocument()
  })
})

describe('WishRoomPage — Cảnh E (bất ngờ theo dịp)', () => {
  async function openLetter(path) {
    renderAt(path)
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để bật đèn/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để kéo thư ra/i }))
  }

  it('sinh nhật: thổi nến mới lộ lời chúc, không còn tab P.S. chung', async () => {
    await openLetter('/phong-thu?mau=sinhnhat')
    await screen.findByText(/Ước một điều đi\./)
    expect(screen.queryByText(/mong cậu có nhiều buổi sáng thức dậy/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'P.S.' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Thổi nến' }))
    await screen.findByText(/mong cậu có nhiều buổi sáng thức dậy/)
  })

  it('kỷ niệm: kéo ảnh ra mới thấy chú thích, đổi được sang ảnh thứ hai', async () => {
    await openLetter('/phong-thu?mau=kyniem')
    const pullBtn = await screen.findByRole('button', { name: /Kéo ảnh ra/i })
    expect(screen.queryByText(/trú mưa ở đây/)).not.toBeInTheDocument()
    fireEvent.click(pullBtn)

    await screen.findByText(/trú mưa ở đây/)
    fireEvent.click(screen.getByRole('button', { name: /Xem ảnh Bây giờ/i }))
    await screen.findByText(/vẫn hay đi ngang qua chỗ cũ/)
  })

  it('tặng bất chợt: chạm hình mới lộ lý do tặng', async () => {
    await openLetter('/phong-thu?mau=batchot')
    const shapeBtn = await screen.findByRole('button', { name: /có hình con mèo/i })
    fireEvent.click(shapeBtn)
    await screen.findByText(/giống màu con mèo hay nằm trước cửa nhà cậu/)
  })
})

describe('WishRoomPage — mẫu thư video (?mau=video)', () => {
  it('hiện nút "Xem lời nhắn", không có tái bút trước khi video kết thúc', async () => {
    renderAt('/phong-thu?mau=video')
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để bật đèn/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm vào phong bì để mở thư/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Chạm để kéo thư ra/i }))

    const playBtn = await screen.findByRole('button', { name: /Xem lời nhắn/i })
    expect(screen.queryByRole('button', { name: 'P.S.' })).not.toBeInTheDocument()
    fireEvent.click(playBtn)
    const video = await waitFor(() => document.querySelector('video.wishroom-video'))
    expect(video).toBeTruthy()
    // Tái bút chỉ mở khi video đã kết thúc (§Cảnh D)
    expect(screen.queryByRole('button', { name: 'P.S.' })).not.toBeInTheDocument()
    act(() => {
      video.dispatchEvent(new Event('ended'))
    })
    await screen.findByRole('button', { name: 'P.S.' })
  })
})
