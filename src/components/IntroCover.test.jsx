// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import IntroCover from './IntroCover.jsx'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import viMsg from '../i18n/messages/vi.js'
import { faqVi, productsVi } from '../test/fixtures.js'

describe('IntroCover', () => {
  it('render section.intro-cover có aria-label và một ảnh cover đúng thuộc tính', () => {
    const { container } = render(<IntroCover />)
    const sec = container.querySelector('section.intro-cover')
    expect(sec).toHaveAttribute('aria-label', viMsg.hero.coverAlt)
    expect(sec.querySelectorAll('img')).toHaveLength(1)
    const img = sec.querySelector('img')
    expect(img).toHaveAttribute('src', '/images/brand/cover-1672.webp')
    expect(img).toHaveAttribute('alt', viMsg.hero.coverAlt)
    expect(img).toHaveAttribute('sizes', '100vw')
    expect(img).toHaveAttribute('width', '1672')
    expect(img).toHaveAttribute('height', '800')
    expect(img.getAttribute('fetchpriority') ?? img.getAttribute('fetchPriority')).toBe('high')
    expect(sec.querySelector('video')).toBeNull()
  })

  it('srcSet 800/1280/1672', () => {
    const { container } = render(<IntroCover />)
    const srcset = container.querySelector('img').getAttribute('srcset')
    expect(srcset).toBe('/images/brand/cover-800.webp 800w, /images/brand/cover-1280.webp 1280w, /images/brand/cover-1672.webp 1672w')
  })

  it('trang chủ: ảnh cover là ảnh đầu tiên, đứng trước #hero', async () => {
    mockApi({ 'GET /products': () => ({ body: productsVi }), 'GET /faq': () => ({ body: faqVi }) })
    const { container } = renderAt('/')
    await screen.findAllByText('Đèn Nguyệt')
    const first = container.querySelector('main img, #root img') ?? container.querySelector('img')
    expect(first.closest('section.intro-cover')).not.toBeNull()
    const hero = container.querySelector('#hero')
    expect(first.compareDocumentPosition(hero) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(container.querySelectorAll('.intro-cover')).toHaveLength(1)
  })
})
