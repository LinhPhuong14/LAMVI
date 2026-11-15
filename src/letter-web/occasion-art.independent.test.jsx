// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import Surprise from './Surprise.jsx'
import { OCCASION_THEMES } from './themes.js'

const { play, stop } = vi.hoisted(() => ({ play: vi.fn(), stop: vi.fn() }))
vi.mock('./effects.js', () => ({ playOccasion: play }))

afterEach(() => {
  vi.clearAllMocks()
})

function open(occasion, occasionData = {}, postscript) {
  play.mockReturnValue(stop)
  const onClose = vi.fn()
  const result = render(<Surprise letter={{ occasion, occasionData, postscript }} theme={OCCASION_THEMES[occasion]} onClose={onClose} />)
  return { ...result, onClose, dialog: screen.getByRole('dialog') }
}

const subjects = [
  ['birthday', /Bánh kem/],
  ['anniversary', /Hai tách trà/],
  ['thankYou', /Bó sen trắng/],
  ['milestone', /Hạc giấy vàng/],
  ['encouragement', /Mầm xanh/],
  ['longDistance', /Hai ô cửa/],
  ['justBecause', /Phong thư nhỏ/],
]

describe('Minh hoạ bảy dịp — kiểm thử độc lập', () => {
  it.each(subjects)('%s có ảnh đúng nội dung, hai cỡ và kích thước giữ chỗ', (occasion, subject) => {
    const { dialog } = open(occasion)
    const art = within(dialog).getByRole('img', { name: subject })
    expect(art).toHaveAttribute('src', `/images/occasions/${occasion}-960.webp`)
    expect(art).toHaveAttribute('srcset', `/images/occasions/${occasion}-480.webp 480w, /images/occasions/${occasion}-960.webp 960w`)
    expect(art.getAttribute('sizes')).toMatch(/max-width: 480px/)
    expect(art).toHaveAttribute('width', '960')
    expect(art).toHaveAttribute('height', '640')
    expect(art).toHaveAttribute('decoding', 'async')
    expect(within(dialog).getByRole('button', { name: 'Quay lại lá thư' })).toBeVisible()
  })

  it('sinh nhật giữ ảnh khi thổi nến, hiện lời chúc đúng lúc và chuyển focus về nút quay lại', async () => {
    const { dialog, unmount } = open('birthday', { message: 'Tuổi mới thật an lành.' }, 'Hẹn gặp ở nhà nhé.')
    const art = within(dialog).getByRole('img', { name: /Bánh kem/ })
    const blow = within(dialog).getByRole('button', { name: 'Ước một điều rồi thổi nến' })
    expect(blow).toHaveFocus()
    expect(within(dialog).queryByRole('status')).not.toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
    expect(dialog.querySelectorAll('.lw-candle')).toHaveLength(3)
    expect(dialog.querySelector('.lw-cake')).not.toHaveClass('is-blown')
    fireEvent.click(blow)
    expect(within(dialog).getByRole('status')).toHaveTextContent('Tuổi mới thật an lành.')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Hẹn gặp ở nhà nhé.')
    expect(art).toBeVisible()
    expect(dialog.querySelector('.lw-cake')).toHaveClass('is-blown')
    expect(within(dialog).queryByRole('button', { name: 'Ước một điều rồi thổi nến' })).not.toBeInTheDocument()
    expect(play).toHaveBeenCalledOnce()
    expect(play).toHaveBeenCalledWith('birthday', { icon: undefined })
    await waitFor(() => expect(within(dialog).getByRole('button', { name: 'Quay lại lá thư' })).toHaveFocus())
    unmount()
    expect(stop).toHaveBeenCalledOnce()
  })

  it('ảnh kỷ niệm cá nhân và ngày vẫn xuất hiện cạnh minh hoạ', () => {
    const { dialog } = open('anniversary', { date: '14.02.2020', photos: ['/images/memory-a.webp', '/images/memory-b.webp'], message: 'Mình vẫn bên nhau.' })
    expect(within(dialog).getByRole('img', { name: /Hai tách trà/ })).toBeVisible()
    expect(within(dialog).getByRole('img', { name: 'Kỷ niệm 1' })).toHaveAttribute('src', '/images/memory-a.webp')
    expect(within(dialog).getByRole('img', { name: 'Kỷ niệm 2' })).toHaveAttribute('src', '/images/memory-b.webp')
    expect(within(dialog).getByText('14.02.2020')).toBeVisible()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Mình vẫn bên nhau.')
  })

  it.each([
    ['milestone', { label: 'Đã tốt nghiệp' }, ['Đã tốt nghiệp']],
    ['longDistance', { places: ['Hà Nội', 'Đà Nẵng'] }, ['Hà Nội', 'Đà Nẵng']],
    ['justBecause', { icon: '🌙' }, ['🌙']],
  ])('%s giữ dữ liệu cá nhân và đóng được bằng bàn phím hoặc nút', (occasion, data, texts) => {
    const { dialog, onClose } = open(occasion, { ...data, message: 'Một lời thương riêng.' }, 'Nhớ giữ sức khoẻ.')
    for (const text of texts) expect(within(dialog).getByText(text)).toBeVisible()
    expect(within(dialog).getByRole('status')).toHaveTextContent('Một lời thương riêng.')
    expect(within(dialog).getByRole('status')).toHaveTextContent('Nhớ giữ sức khoẻ.')
    expect(within(dialog).getByRole('button', { name: 'Quay lại lá thư' })).toHaveFocus()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Quay lại lá thư' }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
