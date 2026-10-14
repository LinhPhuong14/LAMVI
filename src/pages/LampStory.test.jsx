// @vitest-environment jsdom
// G-108, D-105: trang kể chuyện theo từng mẫu đèn — trang lời chúc (QR trên thiệp) + tab ở trang sản phẩm
import { beforeEach, describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import LampStory from '../components/LampStory.jsx'
import { storyParagraphs } from '../lib/story.js'
import { LocaleContext } from '../i18n/index.js'

const TOKEN = 'b'.repeat(64)
const base = { 'GET /products': () => ({ body: { items: [] } }) }
const lamp = (over = {}) => ({ slug: 'den-thu-hoach', name: 'Đèn Thu Hoạch', description: 'Gặt mùa xứng đáng', story: 'Đoạn một.\n\nĐoạn hai.\n\nĐoạn ba.', tone: 'amber', image: null, ...over })
const active = (over = {}) => ({ state: 'active', lang: 'vi', orderKind: 'gift', text: 'Chúc mừng sinh nhật!', textLang: 'vi', translations: {}, media: {}, mediaExpired: false, mediaExpiresAt: null, mediaDaysLeft: null, batch: null, lamps: [], ...over })

beforeEach(() => {
  window.gtag = undefined
  localStorage.setItem('moc.tour.done', '1')
})

describe('storyParagraphs', () => {
  it('tách theo dòng trống, bỏ đoạn rỗng và khoảng trắng thừa', () => {
    expect(storyParagraphs('A\n\n\n B \n\n')).toEqual(['A', 'B'])
    expect(storyParagraphs('Một dòng\nvẫn cùng đoạn')).toEqual(['Một dòng\nvẫn cùng đoạn'])
    expect(storyParagraphs(null)).toEqual([])
    expect(storyParagraphs('')).toEqual([])
  })
})

describe('<LampStory>', () => {
  const wrap = (ui) => render(<MemoryRouter><LocaleContext.Provider value="vi">{ui}</LocaleContext.Provider></MemoryRouter>)
  it('tên đèn là heading, mỗi đoạn một <p>, có link xem đèn', () => {
    wrap(<LampStory lamp={lamp()} />)
    expect(screen.getByRole('heading', { name: 'Đèn Thu Hoạch' })).toBeInTheDocument()
    expect(screen.getByText('Câu chuyện của chiếc đèn')).toBeInTheDocument()
    expect(['Đoạn một.', 'Đoạn hai.', 'Đoạn ba.'].map((t) => screen.getByText(t).tagName)).toEqual(['P', 'P', 'P'])
    expect(screen.getByRole('link', { name: 'Xem đèn này' }).getAttribute('href')).toBe('/products/den-thu-hoach')
  })
  it('chưa có câu chuyện → hiện mô tả ngắn thay vì để trống', () => {
    wrap(<LampStory lamp={lamp({ story: null })} />)
    expect(screen.getByText('Gặt mùa xứng đáng')).toBeInTheDocument()
  })
  it('slug có ký tự lạ được mã hoá trong link', () => {
    wrap(<LampStory lamp={lamp({ slug: 'a/b?x=1' })} />)
    expect(screen.getByRole('link', { name: 'Xem đèn này' }).getAttribute('href')).toBe('/products/a%2Fb%3Fx%3D1')
  })
})

describe('Trang lời chúc — câu chuyện trước lời chúc', () => {
  it('câu chuyện của từng mẫu đèn nằm TRƯỚC lời chúc của người tặng trong DOM', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ lamps: [lamp(), lamp({ slug: 'den-lon-dan', name: 'Đèn Lợn Đàn', story: 'Truyện lợn.' })] }) } }) })
    renderAt(`/qr/${TOKEN}`)
    const greeting = await screen.findByText('Chúc mừng sinh nhật!')
    const stories = screen.getAllByRole('article')
    expect(stories.map((a) => within(a).getByRole('heading').textContent)).toEqual(['Đèn Thu Hoạch', 'Đèn Lợn Đàn'])
    for (const s of stories) expect(s.compareDocumentPosition(greeting) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
  it('đơn không có lời chúc vẫn thấy câu chuyện của đèn', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ text: null, textLang: null, lamps: [lamp()] }) } }) })
    renderAt(`/qr/${TOKEN}`)
    expect(await screen.findByRole('heading', { name: 'Đèn Thu Hoạch' })).toBeInTheDocument()
    expect(screen.getByText('Cảm ơn bạn đã đón nhận món quà')).toBeInTheDocument()
  })
  it('không có lamps (API cũ/đơn không còn sản phẩm) → trang vẫn chạy bình thường', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { ...active(), lamps: undefined } } }) })
    renderAt(`/qr/${TOKEN}`)
    await screen.findByText('Chúc mừng sinh nhật!')
    expect(screen.queryByRole('article')).toBeNull()
  })
  it('chưa xác nhận nhận quà → chưa hiện câu chuyện', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: { state: 'greeting', lang: 'vi', orderKind: 'gift' } } }) })
    renderAt(`/qr/${TOKEN}`)
    await screen.findByRole('button', { name: 'Tôi đã nhận được quà' })
    expect(screen.queryByRole('article')).toBeNull()
  })
  it('bản en dùng chữ en cho nhãn và nút', async () => {
    mockApi({ ...base, [`GET /qr/${TOKEN}`]: () => ({ body: { item: active({ lang: 'en', lamps: [lamp()] }) } }) })
    renderAt(`/en/qr/${TOKEN}`)
    expect(await screen.findByText('The story of this lantern')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View this lantern' }).getAttribute('href')).toBe('/en/products/den-thu-hoach')
  })
})

describe('Trang sản phẩm — tab Câu chuyện', () => {
  const mk = (story) => ({ slug: 'den-a', kind: 'single', name: 'Đèn A', description: 'Mô tả đèn A', badge: null, tone: 'amber', price: 1400000, currency: 'VND', image: null, specs: {}, story })
  const api = (item) =>
    mockApi({
      'GET /products': () => ({ body: { items: [item] } }),
      'GET /products/den-a': () => ({ body: { item } }),
      'GET /shipping-policy': () => ({ body: { fee: 30000, freeFrom: 1000000 } }),
      'POST /cart/quote': () => ({ body: { items: [], subtotal: 0, itemCount: 0, currency: 'VND', hasUnavailable: false, maxQuantity: 10 } }),
      'GET /faq': () => ({ body: { items: [] } }),
    })
  it('có story → tab Câu chuyện nằm giữa Mô tả và Thông số, mỗi đoạn một <p>', async () => {
    api(mk('Một.\n\nHai.'))
    renderAt('/products/den-a')
    await screen.findByRole('tab', { name: 'Câu chuyện' })
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['Mô tả', 'Câu chuyện', 'Thông số', 'Giao hàng & đổi trả'])
    fireEvent.click(screen.getByRole('tab', { name: 'Câu chuyện' }))
    const panel = document.getElementById('pdp-panel-story')
    expect(panel.hidden).toBe(false)
    expect([...panel.querySelectorAll('p')].map((p) => p.textContent)).toEqual(['Một.', 'Hai.'])
  })
  it('không có story → không có tab (như trước)', async () => {
    api(mk(null))
    renderAt('/products/den-a')
    await screen.findByRole('tab', { name: 'Mô tả' })
    expect(screen.queryByRole('tab', { name: 'Câu chuyện' })).toBeNull()
    expect(document.getElementById('pdp-panel-story')).toBeNull()
  })
})
