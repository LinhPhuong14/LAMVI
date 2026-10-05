// @vitest-environment jsdom
// Kiểm thử độc lập (T-11) cho G-10: trang /privacy, /returns — nội dung, ba ngôn ngữ, SSR, footer, sitemap
import { readFileSync } from 'node:fs'
import { URL as NodeURL } from 'node:url'
import { beforeAll, describe, expect, it,  } from 'vitest'
import { screen } from '@testing-library/react'
import { mockApi, renderAt } from '../test/renderApp.jsx'
import vi from '../i18n/messages/vi.js'
import en from '../i18n/messages/en.js'
import zh from '../i18n/messages/zh.js'

const mods = { vi, en, zh }
const pol = (l) => (mods[l].default ?? mods[l]).policy
const base = { 'GET /products': () => ({ body: { items: [] } }) }
const flat = (l, k) => JSON.stringify(pol(l)[k])

describe('Chính sách — đủ khoá ba ngôn ngữ', () => {
  for (const kind of ['privacy', 'returns']) {
    it(`${kind}: cùng số mục, cùng số ý, không rỗng`, () => {
      const v = pol('vi')[kind]
      for (const l of ['en', 'zh']) {
        const o = pol(l)[kind]
        for (const f of ['title', 'description', 'intro']) expect(typeof o[f] === 'string' && o[f].length > 0, `${l}.${f}`).toBe(true)
        expect(o.sections.length, l).toBe(v.sections.length)
        o.sections.forEach((s, i) => {
          expect(s.h && s.h.length, `${l} h${i}`).toBeGreaterThan(0)
          expect(s.items.length, `${l} mục ${i}`).toBe(v.sections[i].items.length)
          s.items.forEach((it) => expect(it.trim().length).toBeGreaterThan(0))
        })
      }
    })
  }
  it('updated/back có ở cả ba ngôn ngữ và tiêu đề khác nhau', () => {
    for (const l of ['vi', 'en', 'zh']) expect(pol(l).updated && pol(l).back).toBeTruthy()
    expect(new Set(['vi', 'en', 'zh'].map((l) => pol(l).privacy.title)).size).toBe(3)
    expect(new Set(['vi', 'en', 'zh'].map((l) => pol(l).returns.title)).size).toBe(3)
  })
})

describe('Chính sách — khớp spec', () => {
  it('đổi trả: 7 ngày từ lúc đơn đã giao, video khui hàng bắt buộc, không bịa email/SĐT/URL liên hệ', () => {
    expect(flat('vi', 'returns')).toMatch(/7 ngày kể từ ngày đơn được ghi nhận là đã giao/)
    expect(flat('en', 'returns')).toMatch(/7 days from the day your order is recorded as delivered/)
    expect(flat('zh', 'returns')).toMatch(/7 天/)
    for (const l of ['vi', 'en', 'zh']) {
      const all = flat(l, 'returns') + flat(l, 'privacy')
      expect(all, l).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/)
      expect(all, l).not.toMatch(/\+?\d[\d .-]{8,}\d/)
      expect(all, l).not.toMatch(/https?:\/\//)
    }
  })
  it('riêng tư: GA4 không banner (D-72), OpenAI, 30 ngày sau xác nhận / 90 ngày sau giao (D-26, D-75)', () => {
    for (const l of ['vi', 'en', 'zh']) {
      const s = flat(l, 'privacy')
      expect(s, l).toMatch(/Google Analytics 4/)
      expect(s, l).toMatch(/OpenAI/)
      expect(s, l).toMatch(/30/)
      expect(s, l).toMatch(/90/)
    }
  })
  it('không hứa điều chưa có: nêu rõ gửi đổi trả trực tuyến đang hoàn thiện', () => {
    expect(flat('vi', 'returns')).toMatch(/đang được hoàn thiện/)
    expect(flat('en', 'returns')).toMatch(/still being finished/)
    expect(flat('zh', 'returns')).toMatch(/仍在完善/)
  })
})

describe('Chính sách — render ba ngôn ngữ, không rơi về tiếng Việt', () => {
  it.each([
    ['/privacy', 'Chính sách riêng tư', 'vi', 7],
    ['/returns', 'Chính sách đổi trả', 'vi', 5],
    ['/en/privacy', 'Privacy Policy', 'en', 7],
    ['/en/returns', 'Return Policy', 'en', 5],
    ['/zh/privacy', '隐私政策', 'zh', 7],
    ['/zh/returns', '退换货政策', 'zh', 5],
  ])('%s', async (url, h1, l, n) => {
    mockApi(base)
    const { container } = renderAt(url)
    expect(await screen.findByRole('heading', { level: 1, name: h1 })).toBeTruthy()
    expect(container.querySelectorAll('.policy-block h2')).toHaveLength(n)
    const text = container.querySelector('.policy-page').textContent
    if (l !== 'vi') expect(text.replaceAll('Mây', '')).not.toMatch(/[ăâêôơưđ]|Chính sách/)
    const back = container.querySelector('.policy-page a.btn')
    expect(back.textContent).toBe(pol(l).back)
    expect(back.getAttribute('href')).toBe(l === 'vi' ? '/' : `/${l}`)
  })
})

describe('Footer — link theo ngôn ngữ', () => {
  it.each([
    ['/privacy', '', 'Chính sách riêng tư', 'Chính sách đổi trả'],
    ['/en/privacy', '/en', 'Privacy Policy', 'Returns policy'],
    ['/zh/privacy', '/zh', '隐私政策', '退换政策'],
  ])('%s', async (url, pre, priv, ret) => {
    mockApi(base)
    renderAt(url)
    await screen.findByRole('heading', { level: 1, name: priv })
    expect(screen.getAllByRole('link', { name: priv }).some((a) => a.getAttribute('href') === `${pre}/privacy`)).toBe(true)
    expect(screen.getAllByRole('link', { name: ret }).some((a) => a.getAttribute('href') === `${pre}/returns`)).toBe(true)
    const dead = [...document.querySelectorAll('footer a[href="#"]')].map((a) => a.textContent.trim()).filter((x) => ![ 'Facebook', 'Instagram', 'TikTok' ].includes(x))
    expect(dead).toEqual([]) // chỉ link mạng xã hội còn href="#"
  })
})

