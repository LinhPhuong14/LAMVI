import { normalizeBrand } from './mail/layout.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const TEXT = {
  vi: {
    title: 'LAMVI đang gặp sự cố tạm thời',
    text: 'Chúng tôi đang khắc phục. Đơn hàng và dữ liệu của bạn không bị ảnh hưởng. Bạn vui lòng thử lại sau ít phút.',
    retry: 'Thử lại',
    contact: 'Cần hỗ trợ ngay?',
    hotline: 'Hotline',
  },
  en: {
    title: 'LAMVI is temporarily unavailable',
    text: 'We are fixing it. Your orders and data are not affected. Please try again in a few minutes.',
    retry: 'Try again',
    contact: 'Need help right now?',
    hotline: 'Hotline',
  },
  zh: {
    title: 'LAMVI 暂时无法访问',
    text: '我们正在修复，您的订单和数据不受影响。请几分钟后再试。',
    retry: '重试',
    contact: '需要立即协助？',
    hotline: '热线',
  },
}

/**
 * Trang lỗi 5xx có thương hiệu (feedback 08/10, mục 1.4): tiếng Việt, logo, hotline/Zalo/email nếu đã
 * cấu hình, nút thử lại. HTML tĩnh, không tải script nào nên dùng được cả khi app không khởi động được.
 * Nút "Thử lại" là liên kết (không dùng onclick) để vẫn chạy dưới CSP.
 */
export function errorPage({ lang = 'vi', brand } = {}) {
  const t = TEXT[lang] ?? TEXT.vi
  const b = normalizeBrand(brand)
  const contact = []
  if (b.phone) contact.push(`${esc(t.hotline)}: <a href="tel:${esc(b.phone.replace(/[^0-9+]/g, ''))}">${esc(b.phone)}</a>`)
  const zalo = b.social.find((s) => s.label === 'Zalo')
  if (zalo) contact.push(`<a href="${esc(zalo.url)}" rel="noopener noreferrer">Zalo</a>`)
  if (b.supportEmail) contact.push(`<a href="mailto:${esc(b.supportEmail)}">${esc(b.supportEmail)}</a>`)
  return `<!doctype html>
<html lang="${lang === 'zh' ? 'zh-Hans' : lang}">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex" />
    <title>${esc(t.title)}</title>
    <style>
      body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f0e4; color: #3a2c22;
        font: 17px/1.6 'Be Vietnam Pro', system-ui, sans-serif; text-align: center; padding: 24px; }
      main { max-width: 480px; }
      h1 { font-family: Georgia, serif; font-weight: 500; font-size: 2rem; margin: 0 0 12px; }
      .mark { letter-spacing: 0.08em; color: #6b4226; font-family: Georgia, serif; font-size: 1.4rem; margin: 0 0 8px; }
      .btn { display: inline-block; margin: 16px 0 24px; padding: 12px 28px; border-radius: 8px; background: #9c2f20; color: #fff; text-decoration: none; font-weight: 600; }
      .contact { font-size: 0.95rem; color: #6b4226; }
      .contact a { color: inherit; }
    </style>
  </head>
  <body>
    <main>
      <p class="mark">LAMVI</p>
      <h1>${esc(t.title)}</h1>
      <p>${esc(t.text)}</p>
      <a class="btn" href="">${esc(t.retry)}</a>
      ${contact.length ? `<p class="contact">${esc(t.contact)}<br />${contact.join(' · ')}</p>` : ''}
    </main>
  </body>
</html>
`
}
