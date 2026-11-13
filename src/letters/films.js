import { CRAFT_FILMS } from '../data/craftFilms.js'

// D-138: hai video LAMVI mở đầu mỗi phong thư, xem hết mới vào phòng bật đèn.
// [ASSUMPTION] Thứ tự: giới thiệu đèn (tranh Đông Hồ trên đèn) → cách làm đèn (làng giấy dó).
export const INTRO_FILMS = [
  { key: 'culture', film: CRAFT_FILMS.dongho, kicker: 'Giới thiệu đèn LAMVI', title: 'Tranh Đông Hồ trên đèn giấy dó' },
  { key: 'craft', film: CRAFT_FILMS.paper, kicker: 'Cách làm đèn', title: 'Từ làng giấy dó đến chiếc đèn' },
]
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
