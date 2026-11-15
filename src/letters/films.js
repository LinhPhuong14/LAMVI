import { CRAFT_FILMS } from '../data/craftFilms.js'

// D-138: hai video LAMVI mở đầu mỗi phong thư, xem hết mới vào phòng bật đèn.
// [ASSUMPTION] Thứ tự: giới thiệu đèn (tranh Đông Hồ trên đèn) → cách làm đèn (làng giấy dó).
export const INTRO_FILMS = [
  { key: 'culture', film: CRAFT_FILMS.dongho, kicker: 'Giới thiệu đèn LAMVI', title: 'Tranh Đông Hồ trên đèn giấy dó' },
  { key: 'craft', film: CRAFT_FILMS.paper, kicker: 'Cách làm đèn', title: 'Từ làng giấy dó đến chiếc đèn' },
]
// D-150 (người dùng: "tắt 2 video trong phong thư, chỉ để lời chúc thôi, và cho phép xem dọc màn hình cũng được"):
// tắt hai video mở đầu + hai nút video cuối thư, bỏ yêu cầu xoay ngang. Giữ mã (D-138, D-145, D-146, D-148)
// để bật lại bằng cờ khi cần.
// D-151 ("bỏ màn giới thiệu vào đèn luôn"): tắt cả màn "LAMVI đem đến cho bạn…" (D-144) — mở QR là tới đèn.
export const LETTER_FLOW = Object.freeze({ introFilms: false, interlude: false, extras: false, requireLandscape: false })

export const filmByKey = (key) => INTRO_FILMS.find((f) => f.key === key)

// Nhớ người nhận đã xem hết phần mở đầu của thư này → lần sau cho "Bỏ qua". Lỗi storage thì coi như chưa xem.
const KEY = (slug) => `lv.letter.intro.${slug}`
export function introSeen(slug) {
  try {
    return localStorage.getItem(KEY(slug)) === '1'
  } catch {
    return false
  }
}
export function markIntroSeen(slug) {
  try {
    localStorage.setItem(KEY(slug), '1')
  } catch {
    /* chế độ riêng tư/chặn storage: bỏ qua */
  }
}

// D-148: đánh dấu THIẾT BỊ đã từng quét QR phong thư LAMVI (bất kỳ thư nào) → các lần quét sau được
// "Bỏ qua" video giới thiệu ngay từ đầu. Đặt ngay khi mở thư thành công (không cần xem hết video).
const DEVICE_KEY = 'lv.letter.device'
export function deviceScanned() {
  try {
    return localStorage.getItem(DEVICE_KEY) === '1'
  } catch {
    return false
  }
}
export function markDeviceScanned() {
  try {
    localStorage.setItem(DEVICE_KEY, '1')
  } catch {
    /* chế độ riêng tư/chặn storage: bỏ qua */
  }
}
