// Khung thư dùng chung: banner, bố cục, nút bấm, preheader, chân thư (T-55).
import { describe, expect, it } from 'vitest'
import { MAIL_BANNER_PATH, orderMail, passwordChangedMail, recoveryMail } from './templates.js'
import { existsSync, statSync } from 'node:fs'

const SITE = 'https://lamvi.test'
const LINK = 'https://lamvi.test/reset-password#t=abc123'
const order = {
  code: 'LV2610-AAAAAAA',
  total: 920000,
  trackingCode: 'VN1',
  hasMessage: false,
  items: [{ slug: 'x', name: { vi: 'Đèn Nguyệt' }, quantity: 1, lineTotal: 920000 }],
}
const links = (html) => [...html.matchAll(/<a\s[^>]*href="([^"]*)"/g)].map((m) => m[1])
const all = () => [
  ['recovery', recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE })],
  ['changed', passwordChangedMail({ lang: 'vi', siteUrl: SITE })],
  ...['confirmed', 'payment_expired', 'shipped', 'cancelled', 'refunded'].map((k) => [k, orderMail({ kind: k, lang: 'vi', order, siteUrl: SITE, name: 'An' })]),
]

describe('Banner', () => {
  it('file banner có thật, là ảnh nhẹ (< 100 KB) để thư tải nhanh', () => {
    const file = new URL(`../../public${MAIL_BANNER_PATH}`, import.meta.url)
    expect(existsSync(file)).toBe(true)
    expect(statSync(file).size).toBeLessThan(100 * 1024)
  })

  it.each(all())('%s: banner ở địa chỉ tuyệt đối https của site, có alt, bề rộng 600, không vượt khung', (_, m) => {
    expect(m.html).toContain(`<img src="${SITE}${MAIL_BANNER_PATH}"`)
    expect(m.html).toMatch(/<img [^>]*alt="LAMVI — đèn giấy dó thủ công"/)
    expect(m.html).toMatch(/<img [^>]*width="600"/)
    expect(m.html).toContain('max-width:600px')
  })

  it('alt theo ngôn ngữ', () => {
    expect(recoveryMail({ lang: 'en', url: LINK, siteUrl: SITE }).html).toContain('alt="LAMVI — handmade giấy dó lanterns"')
    expect(recoveryMail({ lang: 'zh', url: LINK, siteUrl: SITE }).html).toContain('alt="LAMVI — 手工绵纸灯笼"')
  })

  it('không có siteUrl → banner chữ, không có thẻ img hỏng', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK }).html
    expect(html).not.toContain('<img')
    expect(html).toContain('LAMVI')
  })

  it('có màu nền chàm quanh banner để khi khách chặn ảnh vẫn thấy khung và chữ alt', () => {
    expect(recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html).toMatch(/bgcolor="#1a2735"/)
  })
})

describe('Bố cục', () => {
  it.each(all())('%s: bảng có role=presentation, doctype, lang, viewport, tiêu đề lớn', (_, m) => {
    expect(m.html.startsWith('<!doctype html>')).toBe(true)
    expect(m.html).toMatch(/<html lang="vi">/)
    expect(m.html).toContain('name="viewport"')
    expect(m.html).toContain('<h1')
    expect(m.html).toContain('role="presentation"')
    // thư điện tử không dùng <style>/<script>/JS: chỉ style nội tuyến
    expect(m.html).not.toMatch(/<(style|script|link)\b/i)
  })

  it('lang của html theo ngôn ngữ (zh → zh-Hans)', () => {
    expect(recoveryMail({ lang: 'zh', url: LINK, siteUrl: SITE }).html).toContain('<html lang="zh-Hans">')
    expect(recoveryMail({ lang: 'en', url: LINK, siteUrl: SITE }).html).toContain('<html lang="en">')
  })

  it('preheader ẩn có đoạn đầu của thư; cắt gọn khi quá dài', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html
    expect(html).toMatch(/display:none[^>]*>Bạn \(hoặc ai đó\)/)
    const long = orderMail({ kind: 'confirmed', lang: 'vi', order: { ...order, code: 'X'.repeat(300) }, siteUrl: SITE })
    // phần chữ thật của preheader (trước các ký tự đệm) không quá ~110 ký tự
    expect(long.html.match(/display:none[^>]*>([^<&]*)/)[1].length).toBeLessThanOrEqual(110)
  })

  it('nút bấm là bảng có nền (Outlook), link là địa chỉ đầy đủ; thêm dòng sao chép liên kết', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html
    expect(html).toMatch(/<td[^>]*bgcolor="#a3321f"[^>]*><a href="https:\/\/lamvi\.test\/reset-password#t=abc123"/)
    expect(html).toContain('Nếu nút không bấm được')
    expect(html.split('reset-password#t=abc123').length - 1).toBe(2) // nút + dòng sao chép
  })

  it('chỉ có đúng một liên kết bấm được ở mỗi thư có nút; chân thư KHÔNG có link', () => {
    for (const [name, m] of all()) {
      if (name === 'changed') expect(links(m.html), name).toEqual([]) // thư báo đổi mật khẩu: tuyệt đối không link (chống lừa đảo)
      else expect(links(m.html), name).toHaveLength(1)
    }
  })

  it('chân thư có thương hiệu và tên miền (dạng chữ), lời "thư tự động"', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html
    expect(html).toContain('lamvi.test')
    expect(html).toContain('Thư tự động từ LAMVI')
  })

  it('khối tóm tắt đơn chỉ ở thư xác nhận và đã gửi; có tổng tiền', () => {
    expect(orderMail({ kind: 'confirmed', lang: 'vi', order, siteUrl: SITE }).html).toContain('920.000')
    expect(orderMail({ kind: 'shipped', lang: 'vi', order, siteUrl: SITE }).html).toContain('Sản phẩm')
    for (const k of ['payment_expired', 'cancelled', 'refunded']) {
      expect(orderMail({ kind: k, lang: 'vi', order, siteUrl: SITE }).html, k).not.toContain('Sản phẩm')
    }
  })
})

describe('An toàn', () => {
  it('escape mọi chữ động (tên, mã vận đơn, siteUrl, url) trong HTML', () => {
    const evil = '"><script>alert(1)</script>'
    const m = orderMail({
      kind: 'shipped',
      lang: 'vi',
      order: { ...order, trackingCode: evil, items: [{ slug: 'x', name: evil, quantity: 1, lineTotal: 1 }] },
      siteUrl: 'https://lamvi.test/"><script>1</script>',
      name: evil,
    })
    expect(m.html).not.toMatch(/<script/i)
    const r = recoveryMail({ lang: 'vi', url: `https://x.vn/#t="><img src=x onerror=1>`, siteUrl: SITE })
    expect(r.html).not.toContain('<img src=x')
    expect(r.html).not.toContain('onerror=1>')
  })

  it('bản văn bản thuần luôn có link và không chứa thẻ HTML', () => {
    const r = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE })
    expect(r.text).toContain(LINK)
    expect(r.text).not.toMatch(/<[a-z]+[^>]*>/i)
  })

  it('đổi layout không làm đổi tiêu đề thư', () => {
    expect(recoveryMail({ lang: 'vi', url: LINK }).subject).toBe('Đặt lại mật khẩu LAMVI')
    expect(passwordChangedMail({ lang: 'en' }).subject).toBe('Your LAMVI password was changed')
  })
})
