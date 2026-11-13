// @vitest-environment jsdom
// Mẫu dữ liệu mặc định (data.js) không có thư video nào gán occasion đã có giao diện (chu/video
// đều occasion chưa làm) — các test dưới dùng wish tự tạo để khoá riêng hành vi [ASSUMPTION] ở
// §21.9: điểm chạm bất ngờ của thư VIDEO mở ngay khi đã bấm xem, không bắt xem hết (khác P.S.
// thường, vốn cố ý đợi `onEnded` — xem WishRoomPage.test.jsx cho nhánh đó).
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import LetterReader from './LetterReader.jsx'

const videoBirthdayWish = {
  recipientName: 'Test',
  senderName: 'Người gửi',
  kind: 'video',
  videoUrl: '/videos/test.mp4',
  occasion: 'birthday',
  occasionData: { wish: 'Chúc mừng sinh nhật!' },
}

describe('LetterReader — bất ngờ Cảnh E ở thư video', () => {
  it('chưa hiện trước khi bấm "Xem lời nhắn", hiện ngay khi bấm (không cần video kết thúc)', async () => {
    render(<LetterReader wish={videoBirthdayWish} rect={null} reducedMotion={true} postscriptOpen={false} onRequestPostscript={() => {}} />)

    const playBtn = await screen.findByRole('button', { name: /Xem lời nhắn/i })
    expect(screen.queryByRole('button', { name: 'Thổi nến' })).not.toBeInTheDocument()

    fireEvent.click(playBtn)

    // Video đang phát (chưa 'ended') nhưng bất ngờ Cảnh E đã mở — khác cơ chế P.S. thường
    expect(document.querySelector('video.wishroom-video')).toBeTruthy()
    expect(await screen.findByRole('button', { name: 'Thổi nến' })).toBeInTheDocument()
  })

  it('có hiệu ứng Cảnh E riêng thì không còn tab P.S. chung, dù wish.postscript có giá trị (tối đa 1 bất ngờ)', async () => {
    const wish = { ...videoBirthdayWish, postscript: 'Một câu tái bút nữa.' }
    render(<LetterReader wish={wish} rect={null} reducedMotion={true} postscriptOpen={false} onRequestPostscript={() => {}} />)

    fireEvent.click(await screen.findByRole('button', { name: /Xem lời nhắn/i }))

    expect(screen.queryByRole('button', { name: 'P.S.' })).not.toBeInTheDocument()
    expect(screen.queryByText('Một câu tái bút nữa.')).not.toBeInTheDocument()
  })
})
