// Ngày giờ hiển thị theo giờ Việt Nam (đơn hàng, thanh toán)
export function formatDateTime(iso, lang) {
  return new Intl.DateTimeFormat(lang === 'zh' ? 'zh-CN' : lang === 'en' ? 'en-GB' : 'vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(iso))
}
