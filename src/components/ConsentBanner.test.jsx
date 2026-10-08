// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const base = { 'GET /products': () => ({ body: { items: [] } }), 'GET /site': () => ({ body: { name: 'LAMVI' } }) }

afterEach(() => {
  delete window.gtag
  localStorage.clear()
})

describe('Banner đồng ý cookie (feedback mục 24)', () => {
  it('không hiện khi GA không được nhúng', async () => {
    mockApi(base)
    renderAt('/')
    await screen.findByRole('button', { name: 'Menu' })
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.queryByRole('dialog', { name: /Cookie/ })).toBeNull()
  })

  it('hiện khi chưa chọn; Đồng ý → consent update granted và nhớ lựa chọn', async () => {
    window.gtag = vi.fn()
    mockApi(base)
    renderAt('/')
    const dialog = await screen.findByRole('dialog', { name: /Cookie/ })
    expect(dialog).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Đồng ý' }))
    expect(window.gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'granted', ad_storage: 'denied' }))
    expect(localStorage.getItem('lamvi.consent')).toBe('granted')
    await waitFor(() => expect(screen.queryByRole('dialog', { name: /Cookie/ })).toBeNull())
  })

  it('Từ chối → denied và không hỏi lại', async () => {
    window.gtag = vi.fn()
    mockApi(base)
    renderAt('/')
    await screen.findByRole('dialog', { name: /Cookie/ })
    fireEvent.click(screen.getByRole('button', { name: 'Từ chối' }))
    expect(window.gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'denied' }))
    expect(localStorage.getItem('lamvi.consent')).toBe('denied')
  })

  it('đã chọn thì không hiện lại; nút Cài đặt cookie ở chân trang mở lại', async () => {
    window.gtag = vi.fn()
    localStorage.setItem('lamvi.consent', 'granted')
    mockApi(base)
    renderAt('/')
    fireEvent.click(await screen.findByRole('button', { name: 'Cài đặt cookie' }))
    expect(await screen.findByRole('dialog', { name: /Cookie/ })).toBeTruthy()
    expect(window.gtag).toHaveBeenCalledWith('consent', 'update', expect.objectContaining({ analytics_storage: 'granted' }))
  })
})
