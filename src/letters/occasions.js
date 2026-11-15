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

/** Nội dung thư dạng mảng đoạn (thư có thể lưu chuỗi hoặc mảng). */
export const paragraphsOf = (message) =>
  Array.isArray(message) ? message.filter(Boolean) : typeof message === 'string' ? message.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : []
