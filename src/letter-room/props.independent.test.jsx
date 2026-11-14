// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import LetterRoom, { validateLetter } from './LetterRoom'
import { validateLetter as dataValidator } from './data'

const supplied = {
  recipientName: 'Ngọc Ánh',
  senderName: 'Minh',
  kind: 'text',
  occasion: 'encouragement',
  message: ['Lời nhắn riêng dành cho Ánh.', 'Cứ bước theo nhịp của mình nhé.'],
  occasionData: { message: 'Mình luôn ở đây.' },
}
function mount(props = {}, query = '') {
  return render(<MemoryRouter initialEntries={[`/phong-thu?fallback=1${query}`]}><LetterRoom {...props} /></MemoryRouter>)
}
async function open() {
  fireEvent.click(screen.getByRole('button', { name: /Chạm để bật đèn/ }))
  const tick=async()=>{await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})}
  await tick();await tick()
  fireEvent.click(screen.getByRole('button',{name:'Chạm vào phong bì để mở thư'}))
  await tick()
  fireEvent.click(screen.getByRole('button',{name:'Kéo mép giấy lên'}),{detail:0})
  await tick();await tick();await tick()
}

describe('independent embedded LetterRoom props', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 960 })
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 540 })
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true, addEventListener() {}, removeEventListener() {} })))
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('re-exports the shared validator with required-field validation intact', () => {
    expect(validateLetter).toBe(dataValidator)
    expect(validateLetter(supplied)).toEqual(supplied)
    expect(() => validateLetter({ ...supplied, kind: 'audio' })).toThrow()
    expect(() => validateLetter({ ...supplied, kind: 'video', videoUrl: 'javascript:bad' })).toThrow()
  })

  it('provided text, occasion and optional content win over every demo query', async () => {
    const letter = Object.freeze({ ...supplied, occasionData: Object.freeze({ ...supplied.occasionData }) })
    const { container } = mount({ letter }, '&occasion=birthday&kind=video&empty=1')
    expect(screen.queryByText('Lời chúc mẫu')).not.toBeInTheDocument()
    await open()
    expect(screen.getByRole('article', { name: 'Lời chúc gửi Ngọc Ánh' })).toBeInTheDocument()
    for (const paragraph of letter.message) expect(screen.getByText(paragraph)).toBeInTheDocument()
    expect(screen.getByText('Minh', { selector: 'strong' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Xem lời nhắn/ })).not.toBeInTheDocument()
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Mở khi cần/ }))
    await act(async()=>{await vi.advanceTimersByTimeAsync(2000)})
    fireEvent.click(screen.getByRole('button',{name:'Mở điều nhỏ dành cho bạn'}))
    expect(screen.getByText(letter.occasionData.message)).toBeVisible()
    expect(letter.occasionData).toEqual(supplied.occasionData)
  })

  it('provided video retains its own media and occasion rather than the demo', async () => {
    const letter = { ...supplied, kind: 'video', videoUrl: '/custom/private-message.webm', captionsUrl: '/custom/message.vtt' }
    const { container } = mount({ letter }, '&occasion=anniversary&kind=text&empty=1')
    await open()
    expect(container.querySelector('video')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Xem lời nhắn/ }))
    expect(container.querySelector('video')).toHaveAttribute('src', letter.videoUrl)
    expect(container.querySelector('track')).toHaveAttribute('src', letter.captionsUrl)
    expect(screen.getByRole('button', { name: /Mở khi cần/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Kéo kỷ niệm/ })).not.toBeInTheDocument()
  })

  it('onExit gives the header a close action and invokes the callback', () => {
    const onExit = vi.fn()
    mount({ letter: supplied, onExit, preview: true })
    expect(screen.queryByRole('button', { name: 'Bắt đầu lại' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Đóng xem trước' }))
    expect(onExit).toHaveBeenCalledTimes(1)
    expect(onExit).toHaveBeenCalledWith()
    expect(screen.getByRole('button', { name: /Chạm để bật đèn/ })).toBeInTheDocument()
  })

  it('preview without provided data hides the picker but still reads the selected demo', async () => {
    mount({ preview: true }, '&occasion=thankYou')
    expect(screen.queryByText('Lời chúc mẫu')).not.toBeInTheDocument()
    await open()
    expect(screen.getByRole('button', { name: /Lật góc thư/ })).toBeInTheDocument()
    expect(screen.queryByText('Lời chúc mẫu')).not.toBeInTheDocument()
  })

  it('renders afterLetter under the signature without changing provided content', async () => {
    const {container}=mount({letter:supplied,afterLetter:<button>Tiếp tục với món quà</button>})
    await open()
    const action=screen.getByRole('button',{name:'Tiếp tục với món quà'})
    const signature=container.querySelector('.lr-signature')
    expect(signature.compareDocumentPosition(action)&Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(action.closest('article')).toBe(screen.getByRole('article'))
  })
  it('default demo mode preserves its picker and restart control', () => {
    mount()
    expect(screen.getByText('Lời chúc mẫu')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Bắt đầu lại' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Đóng xem trước' })).not.toBeInTheDocument()
  })
})
