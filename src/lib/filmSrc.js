// Bản video nhẹ cho điện thoại (T-103): màn hẹp, bật tiết kiệm dữ liệu hoặc mạng ≤ 3G thì dùng bản 360p (~4 đến 6 MB)
// thay bản 720p (15 đến 20 MB). Chỉ gọi ở client; SSR luôn render bản đầy đủ để hydrate không lệch.
export function wantsLiteFilm() {
  if (typeof window === 'undefined') return false
  const c = navigator.connection
  if (c?.saveData || ['slow-2g', '2g', '3g'].includes(c?.effectiveType)) return true
  return Boolean(window.matchMedia?.('(max-width: 800px)').matches)
}

export function pickFilmSrc(film) {
  return film.srcLite && wantsLiteFilm() ? film.srcLite : film.src
}
