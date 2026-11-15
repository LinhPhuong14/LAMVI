// @vitest-environment jsdom
// D-148: thiết bị đã quét QR phong thư trước đây → lần quét sau được bỏ qua video giới thiệu
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { deviceScanned, markDeviceScanned } from './films.js'

const content = { template: 'web', recipientName: 'Linh', senderName: 'An', occasion: 'birthday', kind: 'text', message: ['Đoạn một.'], postscript: null, occasionData: null }
const open = (slug) => {
  mockApi({ 'POST /letters/open': () => ({ body: { item: content } }) })
  window.location.hash = '#' + 'A'.repeat(43)
  return renderAt(`/thu/${slug}`)
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  window.location.hash = ''
  localStorage.clear()
})

describe('D-148: đánh dấu thiết bị đã quét', () => {
  it('lần quét đầu: không có "Bỏ qua", nhưng thiết bị được đánh dấu ngay (chưa cần xem hết video)', async () => {
    expect(deviceScanned()).toBe(false)
    open('abcdefghij')
    expect(await screen.findByText('Tranh Đông Hồ trên đèn giấy dó')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Bỏ qua, vào phòng' })).toBeNull()
    expect(deviceScanned()).toBe(true)
  })

  it('lần quét sau (kể cả thư khác) → có "Bỏ qua" ngay ở màn chào, bấm vào là tới màn giới thiệu', async () => {
    markDeviceScanned()
    open('zzzzzzzzzz')
    fireEvent.click(await screen.findByRole('button', { name: 'Bỏ qua, vào phòng' }))
    expect(await screen.findByRole('button', { name: 'Bước vào' })).toBeTruthy()
  })

  it('token sai / 404 → không đánh dấu thiết bị', async () => {
    mockApi({})
    window.location.hash = '#ngan'
    renderAt('/thu/abcdefghij')
    expect(await screen.findByText('Không tìm thấy phong thư')).toBeTruthy()
    expect(deviceScanned()).toBe(false)
  })

  it('localStorage bị chặn → không ném lỗi, coi như chưa quét', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('denied', 'SecurityError')
    })
    expect(() => markDeviceScanned()).not.toThrow()
    expect(deviceScanned()).toBe(false)
  })
})
