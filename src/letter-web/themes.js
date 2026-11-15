// D-140: phong bì vintage theo dịp — giấy, viền thư máy bay, xi niêm phong, tem tranh Đông Hồ.
// Màu đất trầm (mù tạt, hồng đất, xanh rêu, vàng đồng…) để hợp brand guideline D-121.

export const OCCASION_THEMES = {
  birthday: {
    label: 'Sinh nhật',
    paper: '#f1dfb8',
    accent: '#c48a3a',
    accent2: '#7b4a2a',
    seal: '#9c4a2f',
    stamp: '/images/folk/vinh-hoa-330.webp',
    stampAlt: 'Tem tranh Đông Hồ Vinh hoa',
    surprise: 'Mở tấm thiệp sinh nhật',
  },
  anniversary: {
    label: 'Kỷ niệm',
    paper: '#f0d9cf',
    accent: '#b5655a',
    accent2: '#6e3b3b',
    seal: '#8e3b3b',
    stamp: '/images/folk/dam-cuoi-chuot-480.webp',
    stampAlt: 'Tem tranh Đông Hồ Đám cưới chuột',
    surprise: 'Mở kỷ niệm của chúng mình',
  },
  thankYou: {
    label: 'Cảm ơn',
    paper: '#e7e3cc',
    accent: '#7f8f5c',
    accent2: '#4f5b3a',
    seal: '#5e6b3f',
    stamp: '/images/folk/ca-chep-330.webp',
    stampAlt: 'Tem tranh Đông Hồ Cá chép',
    surprise: 'Một lời cảm ơn nữa',
  },
  milestone: {
    label: 'Cột mốc',
    paper: '#efe2c4',
    accent: '#b8923e',
    accent2: '#3f2a1a',
    seal: '#3f2a1a',
    stamp: '/images/folk/vinh-quy-480.webp',
    stampAlt: 'Tem tranh Đông Hồ Vinh quy bái tổ',
    surprise: 'Đóng dấu cột mốc',
  },
  encouragement: {
    label: 'Động viên',
    paper: '#f2dcc2',
    accent: '#c26f43',
    accent2: '#6b3a22',
    seal: '#a4542f',
    stamp: '/images/folk/muc-dong-tha-dieu-330.webp',
    stampAlt: 'Tem tranh Đông Hồ Mục đồng thả diều',
    surprise: 'Mở khi cần',
  },
  longDistance: {
    label: 'Gửi từ xa',
    paper: '#e3e1d4',
    accent: '#5d7c7a',
    accent2: '#8a5a3b',
    seal: '#4c6563',
    stamp: '/images/folk/chuot-ruoc-den-480.webp',
    stampAlt: 'Tem tranh Đông Hồ Chuột rước đèn',
    surprise: 'Mở hai ô cửa',
  },
  justBecause: {
    label: 'Tặng bất chợt',
    paper: '#e9dccf',
    accent: '#7c5b70',
    accent2: '#4a3442',
    seal: '#5e4255',
    stamp: '/images/folk/lon-am-duong-480.webp',
    stampAlt: 'Tem tranh Đông Hồ Lợn âm dương',
    surprise: 'Có một điều nhỏ nữa',
  },
}

export const themeOf = (occasion) => (Object.hasOwn(OCCASION_THEMES, occasion) ? OCCASION_THEMES[occasion] : OCCASION_THEMES.justBecause)

/** 5 mẫu đèn LAMVI (ảnh tách nền ở public/images/lamps, cùng bộ ảnh trên trang chủ LAMVI). */
export const LAMPS = {
  'tu-linh': 'Tứ Linh',
  'thu-hoach': 'Thu Hoạch',
  'phuc-loc-song-toan': 'Phúc Lộc Song Toàn',
  'tam-duong-khai-thai': 'Tam Dương Khai Thái',
  'lon-dan': 'Lợn Đàn',
}
export const DEFAULT_LAMP = 'tu-linh'
export const lampSrc = (slug) => `/images/lamps/${Object.hasOwn(LAMPS, slug) ? slug : DEFAULT_LAMP}-cutout.webp`
