// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import OccasionSurprise from './OccasionSurprise.jsx'

describe('OccasionSurprise', () => {
  it('occasion chưa có giao diện (hoặc không xác định) → không render gì', () => {
    const { container } = render(<OccasionSurprise occasion="thankYou" data={{}} reducedMotion={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('kỷ niệm không có ảnh (occasionData.photos rỗng/thiếu) → rơi về thẻ ngày + câu chuyện ngắn (§Cảnh E mục 2)', () => {
    render(<OccasionSurprise occasion="anniversary" data={{ date: '01.01.2020', caption: 'Ngày đó mưa to.' }} reducedMotion={false} />)
    const card = screen.getByRole('button', { name: /Chạm để xem kỷ niệm/i })
    fireEvent.click(card)
    expect(screen.getByText('01.01.2020')).toBeInTheDocument()
    expect(screen.getByText('Ngày đó mưa to.')).toBeInTheDocument()
    // Không có ảnh thì không có nút đổi ảnh thứ hai
    expect(screen.queryByRole('button', { name: /Xem ảnh/i })).not.toBeInTheDocument()
  })

  it('giảm chuyển động: thổi nến bỏ qua giai đoạn khói tan, lộ lời chúc ngay (NFR-A11Y-001)', () => {
    render(<OccasionSurprise occasion="birthday" data={{ wish: 'Chúc mừng sinh nhật!' }} reducedMotion={true} />)
    fireEvent.click(screen.getByRole('button', { name: 'Thổi nến' }))
    // Nhảy thẳng tới trạng thái cuối — không còn gợi ý "Ước một điều đi.", lời chúc hiện ngay
    expect(screen.queryByText(/Ước một điều đi\./)).not.toBeInTheDocument()
    expect(screen.getByText('Chúc mừng sinh nhật!')).toBeInTheDocument()
    // Không dựng hiệu ứng khói (phần tử chỉ render khi !reducedMotion)
    expect(document.querySelector('.wishroom-smoke-ring')).toBeNull()
  })
})
