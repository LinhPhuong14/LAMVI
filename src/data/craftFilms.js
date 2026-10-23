// Video làng nghề ở trang chủ (D-118), tự host trong public/videos/ → CDN Vercel phục vụ trực tiếp,
// không qua function. Tệp gốc ở Google Drive của nhóm (154–182 MB) được nén cho web bằng ffmpeg
// (720p H.264, `+faststart`, xem docs/knowledge/decisions.md T-89). Chữ ở i18n.

const film = (slug) => ({
  src: `/videos/${slug}-720.mp4`,
  poster: `/videos/${slug}-poster.webp`,
})

export const CRAFT_FILMS = {
  // "Tranh Đông Hồ 2.mp4" — khối Nghệ nhân (thay chân dung minh hoạ)
  dongho: film('tranh-dong-ho'),
  // "làng nghề giấy dó 2.mp4" — mục #films (cách làm đèn, công đoạn giấy dó)
  paper: film('lang-giay-do'),
  // Khung điện thoại mục QR (D-120): 7 đoạn ~2,6 s ghép từ hai video trên, cắt dọc 3:4 (bỏ dải phụ đề), 480×640, không tiếng
  journey: { src: '/videos/hanh-trinh-me-den.mp4', poster: '/videos/hanh-trinh-me-den-poster.webp' },
}
