// Dữ liệu mẫu cục bộ cho prototype "Phòng thư LAMVI" (yêu cầu §4, §Cảnh E) — KHÔNG gọi API thật.
// Cấu trúc khớp đặc tả: recipientName, senderName, kind ('text'|'video'), message|videoUrl, cùng
// các trường tuỳ chọn posterUrl/captionsUrl/postscript/occasion/occasionData.
//
// Đổi lời chúc hiển thị: sửa các object dưới đây, hoặc truyền `?mau=<key>` trên URL trang để xem
// thử mẫu khác — key hợp lệ: chu, video, sinhnhat, kyniem, batchot (xem getSampleWish bên dưới).

/**
 * @typedef {Object} WishLetter
 * @property {string} recipientName
 * @property {string} senderName
 * @property {'text'|'video'} kind
 * @property {string} [message]      - bắt buộc khi kind === 'text'
 * @property {string} [videoUrl]     - bắt buộc khi kind === 'video'
 * @property {string} [posterUrl]
 * @property {string} [captionsUrl]
 * @property {string} [postscript]   - bỏ qua nếu `occasion` đã có hiệu ứng riêng (§Cảnh E, quy tắc chung mục 2)
 * @property {Occasion} [occasion]
 * @property {Object} [occasionData] - tuỳ theo occasion, xem OccasionSurprise.jsx
 */

/** @typedef {'birthday'|'anniversary'|'thankYou'|'milestone'|'encouragement'|'longDistance'|'justBecause'} Occasion */

// Chỉ 3 occasion đầu có giao diện riêng (đợt 1 theo yêu cầu); occasion khác chỉ là nhãn dữ liệu,
// chưa có hiệu ứng — rơi về lời chúc chính hoặc mẩu P.S. thường (quy tắc chung mục 2).
export const IMPLEMENTED_OCCASIONS = ['birthday', 'anniversary', 'justBecause']

/** @type {WishLetter} */
export const SAMPLE_TEXT_WISH = {
  recipientName: 'Linh',
  senderName: 'Minh',
  kind: 'text',
  // Không lặp lại "Linh ơi," ở đầu — dòng chào đã do <InkGreeting> vẽ riêng (§Cảnh D)
  message: `Đèn này chị chọn mãi mới ra, vì cái ánh vàng của nó giống hệt góc bếp nhà ngoại hồi hai đứa mình còn
bé — tối nào cũng ngồi đó nghe bà kể chuyện, ngoài cửa thì mưa rích rích suốt canh.

Giờ Linh ở xa, chị chỉ mong mỗi tối mở đèn lên là thấy đỡ lạnh hơn một chút, thấy nhà gần hơn một
chút. Giấy dó mỏng vậy mà giữ ánh sáng ấm ghê, có lẽ vì được gấp bằng tay, qua bao nhiêu công đoạn
phơi, bồi, miết nếp — không vội được.

Chúc Linh năm nay nhiều sức khoẻ, làm gì cũng thuận, và nhớ ăn uống đầy đủ, đừng thức khuya như
hồi sinh viên nữa. Có đèn này rồi, mai mốt rảnh thì bật lên, gọi video cho chị xem ánh đèn với.

Thương Linh nhiều.`,
  postscript: 'À, vỏ hộp chị để dành lại rồi, lần sau về nhà nhớ mang qua chị gấp hạc giấy cho xem.',
  // Chủ đề khớp nội dung (Linh ở xa) nhưng chưa có giao diện riêng — vẫn hiện P.S. như cũ (đúng
  // quy tắc chung mục 2: thiếu hiệu ứng thì rơi về P.S. hoặc kết ở lời chúc chính).
  occasion: 'longDistance',
}

/** @type {WishLetter} */
export const SAMPLE_VIDEO_WISH = {
  recipientName: 'Bà Tư',
  senderName: 'Các con, các cháu',
  kind: 'video',
  videoUrl: '/videos/hanh-trinh-me-den.mp4',
  posterUrl: '/videos/hanh-trinh-me-den-poster.webp',
  captionsUrl: '/videos/hanh-trinh-me-den.vi.vtt',
  postscript: 'Mấy đứa nhỏ đòi ghi thêm: "Bà ơi con nhớ bà, Tết này con về sớm!"',
  occasion: 'thankYou', // cũng chưa có giao diện riêng, xem ghi chú ở SAMPLE_TEXT_WISH
}

/** @type {WishLetter} — Cảnh E, mục 1 (Sinh nhật) */
export const SAMPLE_BIRTHDAY_WISH = {
  recipientName: 'Hân',
  senderName: 'Thu',
  kind: 'text',
  message: `Hai mốt tuổi rồi đó Hân ơi, nhanh thật.

Cái đèn này chị mua vì màu gỗ của nó hợp với cái bàn học cũ của em, chị nhớ hồi đó em hay kê sách
lên đó học bài tới khuya. Giờ thì dùng để đọc truyện cũng được, học bài cũng được, miễn là đừng
quên ngủ là chị mừng rồi.

Sinh nhật vui vẻ, mong năm nay mọi thứ với em đều nhẹ nhàng hơn năm ngoái một chút.`,
  occasion: 'birthday',
  occasionData: {
    wish: 'Tuổi 21, mong cậu có nhiều buổi sáng thức dậy vì háo hức, chứ không phải vì báo thức.',
  },
}

/** @type {WishLetter} — Cảnh E, mục 2 (Kỷ niệm) */
export const SAMPLE_ANNIVERSARY_WISH = {
  recipientName: 'Vy',
  senderName: 'Khoa',
  kind: 'text',
  message: `Vy ơi,

Hai năm rồi đó. Anh vẫn nhớ cái hôm mưa to, hai đứa đứng trú ở mái hiên đó, chẳng ai mang theo áo
mưa, cuối cùng ngồi nói chuyện tới lúc tạnh hẳn mới về.

Đèn này để trên bàn, tối nào rảnh thì bật lên ngồi nhìn một lát cũng được.`,
  occasion: 'anniversary',
  occasionData: {
    photos: [
      { url: '/images/scene/golden-clouds-640.webp', label: 'Ngày ấy', date: '14.02.2024', caption: 'Hôm đó hai đứa trú mưa ở đây.' },
      { url: '/images/scene/dawn-lake-640.webp', label: 'Bây giờ', date: 'Hôm nay', caption: 'Giờ vẫn hay đi ngang qua chỗ cũ.' },
    ],
  },
}

/** @type {WishLetter} — Cảnh E, mục 7 (Tặng bất chợt) */
export const SAMPLE_JUSTBECAUSE_WISH = {
  recipientName: 'Chi',
  senderName: 'Bình',
  kind: 'text',
  message: `Chi ơi,

Không có dịp gì đặc biệt cả, đi ngang qua thấy cái đèn này là nhớ tới Chi liền nên mua thôi.

Để ý kỹ chụp đèn một chút nhé.`,
  occasion: 'justBecause',
  occasionData: {
    shape: 'cat',
    shapeLabel: 'hình con mèo',
    note: 'Thấy cái đèn này giống màu con mèo hay nằm trước cửa nhà cậu, nên tớ mua.',
  },
}

const SAMPLES = {
  chu: SAMPLE_TEXT_WISH,
  video: SAMPLE_VIDEO_WISH,
  sinhnhat: SAMPLE_BIRTHDAY_WISH,
  kyniem: SAMPLE_ANNIVERSARY_WISH,
  batchot: SAMPLE_JUSTBECAUSE_WISH,
}

export function getSampleWish(key) {
  return SAMPLES[key] ?? SAMPLE_TEXT_WISH
}
