// D-147: tên người nhận/người gửi có thể bỏ trống — chữ thay thế khi hiển thị
export const RECIPIENT_FALLBACK = 'bạn'
export const SENDER_FALLBACK = 'Một người thương bạn'

export const recipientOf = (letter) => String(letter?.recipientName ?? '').trim() || RECIPIENT_FALLBACK
export const senderOf = (letter) => String(letter?.senderName ?? '').trim()

/** Phòng thư 3D (src/letter-room) luôn cần hai tên — điền chữ thay thế khi bỏ trống. */
export const withNameFallbacks = (letter) => ({ ...letter, recipientName: recipientOf(letter), senderName: senderOf(letter) || SENDER_FALLBACK })
