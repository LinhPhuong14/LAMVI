// Khung thư dùng chung: banner, bố cục, nút bấm, preheader, chân thư (T-56).
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

  it('liên kết: nút + tên miền ở chân thư; thư báo đổi mật khẩu tuyệt đối không có link (chống lừa đảo)', () => {
    for (const [name, m] of all()) {
      if (name === 'changed') expect(links(m.html), name).toEqual([])
      else {
        expect(links(m.html), name).toHaveLength(2)
        expect(links(m.html)[1], name).toBe(SITE)
      }
    }
  })

  it('chân thư luôn có thương hiệu, khẩu hiệu, lý do nhận thư, ghi chú thư giao dịch, bản quyền', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html
    expect(html).toContain('lamvi.test')
    expect(html).toContain('Đèn giấy dó thủ công — giữ lửa ký ức')
    expect(html).toContain('Bạn nhận được thư này vì có tài khoản hoặc đơn hàng tại LAMVI')
    expect(html).toContain('không phải thư quảng cáo')
    expect(html).toContain(`© ${new Date().getFullYear()} LAMVI`)
    expect(html).toContain('vui lòng không trả lời trực tiếp') // chưa có thông tin hỗ trợ → báo không trả lời
  })

  it('bản en/zh có chân thư dịch', () => {
    expect(recoveryMail({ lang: 'en', url: LINK, siteUrl: SITE }).html).toContain('This is a transactional email')
    expect(recoveryMail({ lang: 'zh', url: LINK, siteUrl: SITE }).html).toContain('这是与您的账号或订单相关的事务性邮件')
  })

  it('có nhãn phân loại (eyebrow), vạch son dưới banner và hộp lưu ý', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE }).html
    expect(html).toContain('Bảo mật tài khoản')
    expect(html).toMatch(/<td height="4" bgcolor="#a3321f"/)
    expect(html).toMatch(/<td width="4" bgcolor="#a3321f"[^>]*><\/td><td[^>]*>Nếu không phải bạn/) // lưu ý nằm trong hộp có vạch
    expect(orderMail({ kind: 'shipped', lang: 'en', order, siteUrl: SITE }).html).toContain('Your order')
  })

  it('khối đơn hàng: mã đơn, danh sách, tổng tiền màu son', () => {
    const html = orderMail({ kind: 'confirmed', lang: 'vi', order, siteUrl: SITE }).html
    expect(html).toContain('Mã đơn')
    expect(html).toContain('LV2610-AAAAAAA')
    expect(html).toMatch(/color:#a3321f">920\.000/)
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

describe('Thông tin doanh nghiệp ở chân thư (biến môi trường, không bịa)', () => {
  const brand = {
    name: 'LAMVI',
    legalName: 'Công ty TNHH Đèn Giấy Dó LAMVI — MST 0123456789',
    address: '12 Hàng Bông, Hoàn Kiếm, Hà Nội',
    supportEmail: 'hotro@lamvi.com.vn',
    phone: '1900 1234',
    hours: '8:00–18:00, thứ Hai–thứ Bảy',
    facebookUrl: 'https://facebook.com/lamvi',
    instagramUrl: 'https://instagram.com/lamvi',
    tiktokUrl: 'https://tiktok.com/@lamvi',
  }

  it('hiện đủ: hỗ trợ (email, hotline, giờ), địa chỉ, mạng xã hội, pháp nhân', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE, brand }).html
    expect(html).toContain('Cần hỗ trợ?')
    expect(html).toContain('href="mailto:hotro@lamvi.com.vn"')
    expect(html).toContain('href="tel:19001234"')
    expect(html).toContain('8:00–18:00, thứ Hai–thứ Bảy')
    expect(html).toContain('12 Hàng Bông, Hoàn Kiếm, Hà Nội')
    for (const u of ['https://facebook.com/lamvi', 'https://instagram.com/lamvi', 'https://tiktok.com/@lamvi']) expect(html).toContain(`href="${u}"`)
    expect(html).toContain('Công ty TNHH Đèn Giấy Dó LAMVI — MST 0123456789')
    // có kênh hỗ trợ → không còn câu "đừng trả lời"
    expect(html).toContain('nếu cần hỗ trợ, hãy liên hệ theo thông tin phía trên')
    expect(html).not.toContain('vui lòng không trả lời trực tiếp')
  })

  it('bản text cũng có thông tin liên hệ', () => {
    const m = recoveryMail({ lang: 'en', url: LINK, siteUrl: SITE, brand })
    expect(m.text).toContain('Email: hotro@lamvi.com.vn')
    expect(m.text).toContain('Hotline: 1900 1234')
    expect(m.text).toContain('Address: 12 Hàng Bông')
    expect(m.text).toContain(LINK)
  })

  it('chỉ hiện mục có giá trị: thiếu gì bỏ đó, không có chỗ trống hay chữ "undefined/null"', () => {
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE, brand: { supportEmail: 'hotro@lamvi.com.vn' } }).html
    expect(html).toContain('mailto:hotro@lamvi.com.vn')
    expect(html).not.toContain('Hotline')
    expect(html).not.toContain('Địa chỉ')
    expect(html).not.toContain('Theo dõi LAMVI')
    expect(html).not.toMatch(/undefined|null|\[object/)
    const text = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE, brand: {} }).text
    expect(text).not.toMatch(/undefined|null/)
  })

  it('thư báo đổi mật khẩu: thông tin liên hệ hiện dạng chữ, KHÔNG phải liên kết', () => {
    const html = passwordChangedMail({ lang: 'vi', siteUrl: SITE, brand }).html
    expect(html).toContain('hotro@lamvi.com.vn')
    expect(html).toContain('1900 1234')
    expect(links(html)).toEqual([])
    expect(html).not.toContain('facebook.com') // mạng xã hội chỉ có dạng link nên bỏ hẳn
    expect(html).not.toContain('mailto:')
  })

  it('giá trị không hợp lệ bị bỏ: URL không phải https, email/điện thoại sai, ký tự điều khiển', () => {
    const bad = {
      supportEmail: 'khong-phai-email',
      phone: 'abc<script>',
      facebookUrl: 'javascript:alert(1)',
      instagramUrl: 'http://khong-https.vn',
      tiktokUrl: 'https://ok.vn/"><script>x</script>',
      address: 'Hà Nội\u0000\u0007',
    }
    const html = recoveryMail({ lang: 'vi', url: LINK, siteUrl: SITE, brand: bad }).html
    expect(html).not.toContain('mailto:')
    expect(html).not.toContain('tel:')
    expect(html).not.toContain('javascript:')
    expect(html).not.toContain('khong-https.vn')
    expect(html).not.toMatch(/<script/i)
    expect(html).toContain('Địa chỉ: Hà Nội') // ký tự điều khiển bị bỏ, phần chữ còn
    expect(html).not.toContain('\u0000')
  })

  it('escape HTML trong tên, địa chỉ, giờ hỗ trợ', () => {
    const html = recoveryMail({
      lang: 'vi',
      url: LINK,
      siteUrl: SITE,
      brand: { name: '<b>X</b>', address: '<img src=x onerror=1>', hours: '"><i>', supportEmail: 'a@b.vn' },
    }).html
    expect(html).not.toContain('<b>X</b>')
    expect(html).not.toContain('<img src=x')
    expect(html).not.toContain('"><i>')
    expect(html).toContain('&lt;b&gt;X&lt;/b&gt;')
  })

  it('thư đơn hàng cũng có chân thư doanh nghiệp', () => {
    const html = orderMail({ kind: 'shipped', lang: 'vi', order, siteUrl: SITE, brand }).html
    expect(html).toContain('hotro@lamvi.com.vn')
    expect(html).toContain('Theo dõi LAMVI')
  })
})
