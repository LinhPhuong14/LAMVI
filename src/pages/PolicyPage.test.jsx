// @vitest-environment jsdom
// G-10: trang Chính sách riêng tư / đổi trả và link footer
import { describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }) }

describe('Trang chính sách', () => {
  it('/privacy hiện đủ mục, nêu GA, OpenAI và thời hạn xoá media', async () => {
    mockApi(base)
    renderAt('/privacy')
    expect(await screen.findByRole('heading', { level: 1, name: 'Chính sách riêng tư' })).toBeTruthy()
    expect(screen.getAllByText(/Google Analytics 4/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/OpenAI/).length).toBeGreaterThan(0)
    expect(screen.getByText(/30 ngày sau khi người nhận xác nhận/)).toBeTruthy()
  })

  it('/returns nêu 7 ngày, video khui hàng bắt buộc', async () => {
    mockApi(base)
    renderAt('/returns')
    expect(await screen.findByRole('heading', { level: 1, name: 'Chính sách đổi trả' })).toBeTruthy()
    expect(screen.getAllByText(/7 ngày/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Video khui hàng/).length).toBeGreaterThan(0)
  })

  it('bản en và zh có nội dung riêng', async () => {
    mockApi(base)
    renderAt('/en/privacy')
    expect(await screen.findByRole('heading', { level: 1, name: 'Privacy Policy' })).toBeTruthy()
  })

  it('footer trỏ tới hai trang, không còn href="#" cho đổi trả', async () => {
    mockApi(base)
    renderAt('/privacy')
    await screen.findByRole('heading', { level: 1, name: 'Chính sách riêng tư' })
    const link = screen.getAllByRole('link', { name: 'Chính sách đổi trả' })[0]
    expect(link.getAttribute('href')).toBe('/returns')
    expect(screen.getAllByRole('link', { name: 'Chính sách riêng tư' })[0].getAttribute('href')).toBe('/privacy')
  })
})
