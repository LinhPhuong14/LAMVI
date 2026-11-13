// Bảy dịp của Phòng thư (khớp server/domain/letter.js và src/letter-room/data.js)
export const OCCASION_LABELS = {
  birthday: 'Sinh nhật',
  anniversary: 'Kỷ niệm',
  thankYou: 'Cảm ơn',
  milestone: 'Cột mốc',
  encouragement: 'Động viên',
  longDistance: 'Gửi từ xa',
  justBecause: 'Tặng bất chợt',
}
export const OCCASIONS = Object.keys(OCCASION_LABELS)

// Lời mở đầu bất ngờ theo dịp (hiện trên nút mở điều bất ngờ)
export const SURPRISE_CUE = {
  birthday: 'Thổi nến',
  anniversary: 'Mở kỷ niệm',
  thankYou: 'Một lời cảm ơn nữa',
  milestone: 'Mở huy hiệu',
  encouragement: 'Mở lời động viên',
  longDistance: 'Nhìn qua ô cửa',
  justBecause: 'Vì sao lại tặng?',
}

/** Nội dung thư dạng mảng đoạn (thư có thể lưu chuỗi hoặc mảng). */
export const paragraphsOf = (message) =>
  Array.isArray(message) ? message.filter(Boolean) : typeof message === 'string' ? message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : []
