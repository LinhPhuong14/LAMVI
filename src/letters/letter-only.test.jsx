// @vitest-environment jsdom
// D-150: phong thư không còn hai video mở đầu / hai nút video cuối thư; xem dọc màn hình được
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { LETTER_FLOW } from './films.js'
import LetterRoomPreview from '../admin/LetterRoomPreview.jsx'

const content = { template: 'web', recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }
const reduced = () => vi.stubGlobal('matchMedia', (q) => ({ matches: q.includes('reduce') || q.includes('coarse'), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))
const portrait = () => {
  Object.defineProperty(window, 'innerWidth', { value: 390, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true })
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  window.location.hash = ''
  localStorage.clear()
  Object.defineProperty(window, 'innerWidth', { value: 1024, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: 768, configurable: true })
})

describe('D-150: chỉ còn lời chúc', () => {
  it('cờ mặc định: tắt video mở đầu, tắt nút video cuối thư, không bắt xoay ngang', () => {
    expect(LETTER_FLOW).toEqual({ introFilms: false, interlude: false, extras: false, requireLandscape: false })
  })

  it('/thu: không video, không màn giới thiệu (D-153) — vào thẳng đèn → lá thư; cuối thư không có nút video; điện thoại dọc không bị chặn', async () => {
    reduced()
    portrait()
    mockApi({ 'POST /letters/open': () => ({ body: { item: content } }) })
    window.location.hash = '#' + 'A'.repeat(43)
    renderAt('/thu/abcdefghij')
    expect(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bước vào' })).toBeNull()
    expect(document.querySelector('video')).toBeNull()
    expect(screen.queryByRole('dialog', { name: /xoay ngang/i })).toBeNull()
    fireEvent.click(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Xem lại cách làm đèn' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Lịch sử văn hoá' })).toBeNull()
    // D-158: cuối thư có hai video LAMVI (thẻ poster, bấm mới tải video)
    expect(await screen.findByText('Tranh Đông Hồ trên đèn giấy dó')).toBeTruthy()
  })

  it('demo /phong-thu xem dọc được', async () => {
    reduced()
    portrait()
    renderAt('/phong-thu?occasion=birthday')
    expect(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 })).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: /xoay ngang/i })).toBeNull()
  })

  it('admin xem thử: không có nút video cuối thư', async () => {
    reduced()
    render(<LetterRoomPreview letter={content} onClose={() => {}} />)
    fireEvent.click(await screen.findByRole('button', { name: 'Bật đèn' }, { timeout: 5000 }))
    expect(await screen.findByRole('heading', { level: 2, name: 'Gửi Linh,' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Xem lại cách làm đèn' })).toBeNull()
  })
})
