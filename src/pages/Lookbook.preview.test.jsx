// @vitest-environment jsdom
// LookbookCard (trang chủ) dùng usePreview: rê chuột hiện khung phóng to ảnh đèn thật (D-124)
import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import { faqVi, productsVi } from '../test/fixtures.js'

const hoverMedia = (hover) =>
  vi.stubGlobal('matchMedia', (query) => ({ matches: hover && query === '(hover: hover)', media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }))

async function cards() {
  mockApi({ 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) })
  renderAt('/')
  await screen.findAllByText('Đèn Nguyệt')
  return [...document.querySelectorAll('.lookbook-card')]
}

afterEach(() => vi.unstubAllGlobals())

describe('LookbookCard + usePreview', () => {
  it('có chuột: rê chuột hiện tooltip với tên đèn và ảnh thật; rời thì ẩn', async () => {
    hoverMedia(true)
    const list = await cards()
    expect(list.length).toBeGreaterThan(0)
    fireEvent.mouseEnter(list[0])
    const tip = await screen.findByRole('tooltip')
    expect(tip).toHaveClass('hover-preview')
    expect(tip).toHaveTextContent(list[0].querySelector('.lookbook-caption').textContent)
    expect(tip.querySelector('img').getAttribute('src')).toMatch(/^\/images\/lamps\/.+\.jpg$/)
    fireEvent.mouseLeave(list[0])
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('cảm ứng (không hover: hover): không hiện tooltip', async () => {
    hoverMedia(false)
    const list = await cards()
    fireEvent.mouseEnter(list[0])
    fireEvent.focus(list[0])
    expect(document.querySelector('.hover-preview')).toBeNull()
  })
})
