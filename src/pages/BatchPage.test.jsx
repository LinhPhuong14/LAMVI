// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }) }
const batch = {
  code: 'L-01',
  title: 'Lô tháng 9',
  story: 'Làm ở Yên Thái',
  videoUrl: 'https://cdn.test/l01.mp4',
  producedOn: '2026-09-01',
}

describe('Trang QR lô đèn (US-005)', () => {
  it('AC-001: phát video lô, không cần đăng nhập', async () => {
    mockApi({ ...base, 'GET /batches/L-01': () => ({ body: { item: batch } }) })
    const { container } = renderAt('/lo/L-01')
    expect(await screen.findByRole('heading', { level: 1, name: 'Lô tháng 9' })).toBeInTheDocument()
    expect(container.querySelector('video').getAttribute('src')).toBe(batch.videoUrl)
    expect(screen.getByText('Mã lô: L-01')).toBeInTheDocument()
  })

  it('D-44: trang lô đặt noindex', async () => {
    mockApi({ ...base, 'GET /batches/L-01': () => ({ body: { item: batch } }) })
    renderAt('/lo/L-01')
    await screen.findByRole('heading', { level: 1 })
    expect(document.head.querySelector('meta[name="robots"]')?.content).toBe('noindex')
  })

  it('mã không có / chưa có video → thông báo chung', async () => {
    mockApi(base)
    renderAt('/en/lo/KHONG-CO')
    expect(await screen.findByRole('heading', { name: 'Lantern batch not found' })).toBeInTheDocument()
  })

  it('mã có ký tự đặc biệt được mã hoá khi gọi API', async () => {
    const fetchMock = mockApi(base)
    renderAt('/lo/a%3Fb')
    await screen.findByRole('heading', { level: 1 })
    expect(fetchMock.mock.calls.some(([u]) => String(u).startsWith('/api/batches/a%3Fb?lang='))).toBe(true)
  })
})
