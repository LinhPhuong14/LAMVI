// @vitest-environment jsdom
// Kiểm thử độc lập G-108 / D-105: XSS, zh, ảnh, trạng thái chuẩn bị, ký tự đặc biệt
import { beforeEach, describe, expect, it } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'

const TOKEN = 'c'.repeat(64)
const EVIL = '<img src=x onerror="window.__pwned=1"><script>window.__pwned=1</script>'
const base = { 'GET /products': () => ({ body: { items: [] } }) }
const lamp = (over = {}) => ({ slug: 'den-a', name: 'Đèn A', description: 'Mô tả A', story: 'Đoạn một.\n\nĐoạn hai.', tone: 'amber', image: null, ...over })
const active = (over = {}) => ({ state: 'active', lang: 'vi', orderKind: 'gift', text: 'Chúc bạn bình an', textLang: 'vi', translations: {}, media: {}, mediaExpired: false, mediaExpiresAt: null, mediaDaysLeft: null, batch: null, lamps: [], ...over })

beforeEach(() => {
  window.gtag = undefined
  delete window.__pwned
  localStorage.setItem('moc.tour.done', '1')
})

describe('Trang QR — render câu chuyện an toàn', () => {
  it('HTML/script trong tên, mô tả, câu chuyện chỉ hiện dạng chữ', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ lamps: [lamp({ name: EVIL, story: `${EVIL}\n\n${EVIL}` })] }) } }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    await screen.findByText('Chúc bạn bình an')
    const art = container.querySelector('.lamp-story')
    expect(art.querySelectorAll('script')).toHaveLength(0)
    expect(art.querySelectorAll('.lamp-story-body img')).toHaveLength(0)
    expect(art.textContent).toContain('<script>')
    expect(window.__pwned).toBeUndefined()
  })

  it('zh: nhãn tiếng Trung, link /zh/products/...', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ lang: 'zh', lamps: [lamp({ story: '第一段。\n\n第二段。' })] }) } }) })
    const { container } = renderAt(`/zh/qr/${TOKEN}`)
    await screen.findByText('第一段。')
    expect(container.querySelector('.lamp-story a').getAttribute('href')).toBe('/zh/products/den-a')
    expect(container.querySelector('.lamp-story .eyebrow').textContent).not.toBe('lampStory.eyebrow')
  })

  it('có ảnh: render <img> với alt do API trả', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ lamps: [lamp({ image: { url: 'https://img.test/a.jpg', alt: 'Đèn A trên bàn' } })] }) } }) })
    renderAt(`/qr/${TOKEN}`)
    const img = await screen.findByAltText('Đèn A trên bàn')
    expect(img.getAttribute('src')).toContain('img.test/a.jpg')
  })

  it('đang chuẩn bị: không hiện câu chuyện dù API lỡ trả lamps', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'preparing', lang: 'vi', lamps: [lamp()] } } }) })
    const { container } = renderAt(`/qr/${TOKEN}`)
    await screen.findByRole('heading', { level: 1 })
    expect(container.querySelector('.lamp-story')).toBeNull()
  })
})
