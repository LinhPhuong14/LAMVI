// Bộ hoạ tiết dân gian lơ lửng (mây, đường vân, nét khói) — tự vẽ, không lấy từ nguồn ngoài.
// Dùng bởi src/components/FloatingMotifs.jsx; quy tắc ở docs/knowledge/design-rules.md §6.

// Mỗi hoạ tiết: viewBox + các nét (path). Nét dùng currentColor, không tô.
export const MOTIFS = {
  // Mây cuộn: đuôi dài uốn vào một xoáy lớn, xoáy nhỏ phía trên
  'may-cuon': {
    viewBox: '0 0 240 110',
    paths: [
      'M8 78 C40 78 60 96 96 90 C132 84 118 34 150 30 C182 26 196 52 184 70 C174 86 150 84 148 68 C146 56 160 52 166 60',
      'M120 44 C112 22 134 8 152 14 C166 19 164 36 152 36 C144 36 142 28 148 26',
      'M184 70 C204 82 222 80 234 70',
    ],
  },
  // Mây đôi: hai xoáy đối xứng, đỉnh cong như đầu như ý
  'may-doi': {
    viewBox: '0 0 200 120',
    paths: [
      'M100 104 C70 104 44 88 44 64 C44 42 64 30 82 38 C96 44 94 62 82 64 C72 66 68 56 74 52',
      'M100 104 C130 104 156 88 156 64 C156 42 136 30 118 38 C104 44 106 62 118 64 C128 66 132 56 126 52',
      'M82 38 C84 18 116 18 118 38',
    ],
  },
  // Dải mây dài: hai cụm xoáy nối bằng dải lượn
  'may-dai': {
    viewBox: '0 0 420 80',
    paths: [
      'M4 50 C60 50 70 20 110 24 C140 27 138 52 118 52 C104 52 104 38 114 38',
      'M110 24 C170 14 190 58 250 50 C300 44 300 20 336 22 C360 24 362 46 344 48 C332 49 330 38 338 36',
      'M336 22 C372 20 396 34 416 30',
    ],
  },
  // Vân nước: hai cụm cung sóng lồng nhau
  'van-nuoc': {
    viewBox: '0 0 220 90',
    paths: [20, 32, 44].flatMap((r) => [
      `M${64 - r} 86 A${r} ${r} 0 0 1 ${64 + r} 86`,
      `M${150 - r} 86 A${r} ${r} 0 0 1 ${150 + r} 86`,
    ]),
  },
  // Đường vân: những nét lượn song song như vân gỗ, sợi dó
  'van-go': {
    viewBox: '0 0 260 120',
    paths: [
      'M0 18 C60 8 92 38 150 28 S228 8 260 20',
      'M0 40 C56 30 96 60 150 50 S226 30 260 42',
      'M0 62 C50 54 92 84 140 74 C170 68 184 58 208 62 C230 66 244 70 260 66',
      'M0 86 C54 78 98 106 146 96 S226 80 260 90',
      'M168 58 C176 50 194 50 198 58 C194 66 176 66 168 58 Z',
    ],
  },
  // Khói hương: hai sợi mảnh uốn lượn bay lên
  'khoi-huong': {
    viewBox: '0 0 80 220',
    smoke: true,
    paths: [
      'M40 218 C30 190 52 170 40 140 C28 110 54 92 44 62 C36 40 50 24 44 6',
      'M46 218 C58 196 36 176 50 150 C62 126 40 110 52 84 C60 68 50 56 56 42',
    ],
  },
  // Khói cuộn: sợi khói kết thúc bằng một vòng xoáy
  'khoi-cuon': {
    viewBox: '0 0 120 200',
    smoke: true,
    paths: ['M60 198 C48 170 72 150 58 120 C46 94 70 76 64 56 C58 38 36 38 38 54 C40 66 56 64 54 54'],
  },
}

// Bố cục theo phần: x/y là vị trí (%), w là rộng (px), dur/delay cho độ lệch pha, flip lật ngang.
// tone: 'paper' (nét sepia trên nền giấy) | 'dark' (nét hoè nhạt trên nền tối).
export const SECTION_MOTIFS = {
  // Dashboard tài khoản: mây và khói trôi sau các thẻ kính
  dash: [
    { m: 'may-dai', x: '18%', y: '8%', w: 420, dur: 34, delay: -8 },
    { m: 'may-cuon', x: '78%', y: '46%', w: 230, dur: 28, delay: -14, flip: true },
    { m: 'khoi-huong', x: '92%', y: '10%', w: 48, dur: 12, delay: -3 },
  ],
  hero: [
    { m: 'may-dai', x: '-4%', y: '78%', w: 380, dur: 30, delay: -6 },
    { m: 'khoi-huong', x: '71%', y: '4%', w: 46, dur: 11, delay: -2 },
    { m: 'khoi-cuon', x: '76%', y: '8%', w: 54, dur: 13, delay: -7 },
  ],
  story: [
    { m: 'may-cuon', x: '2%', y: '16%', w: 240, dur: 26, delay: -3, tone: 'dark' },
    { m: 'may-cuon', x: '80%', y: '52%', w: 210, dur: 30, delay: -12, tone: 'dark', flip: true },
    { m: 'khoi-huong', x: '90%', y: '12%', w: 46, dur: 12, delay: -4, tone: 'dark' },
  ],
  artisan: [
    { m: 'khoi-huong', x: '6%', y: '6%', w: 50, dur: 12, delay: -1 },
    { m: 'khoi-cuon', x: '26%', y: '2%', w: 56, dur: 14, delay: -8 },
    { m: 'van-go', x: '78%', y: '82%', w: 260, dur: 28, delay: -9 },
  ],
  products: [
    { m: 'may-doi', x: '-2%', y: '10%', w: 190, dur: 24, delay: -5 },
    { m: 'may-cuon', x: '84%', y: '4%', w: 200, dur: 28, delay: -14, flip: true },
  ],
  lookbook: [
    { m: 'may-dai', x: '-6%', y: '30%', w: 460, dur: 34, delay: -10, tone: 'dark' },
    { m: 'may-dai', x: '62%', y: '12%', w: 420, dur: 38, delay: -22, tone: 'dark', flip: true },
  ],
  process: [
    { m: 'van-nuoc', x: '2%', y: '64%', w: 220, dur: 22, delay: -4 },
    { m: 'van-nuoc', x: '82%', y: '8%', w: 200, dur: 26, delay: -13, flip: true },
  ],
  qr: [
    { m: 'may-cuon', x: '52%', y: '8%', w: 190, dur: 26, delay: -6 },
    { m: 'khoi-cuon', x: '92%', y: '40%', w: 52, dur: 13, delay: -3 },
  ],
  testimonials: [
    { m: 'may-doi', x: '-4%', y: '4%', w: 170, dur: 24, delay: -2 },
    { m: 'may-doi', x: '86%', y: '70%', w: 170, dur: 28, delay: -15, flip: true },
  ],
  faq: [
    { m: 'van-go', x: '-4%', y: '40%', w: 260, dur: 30, delay: -6 },
    { m: 'van-nuoc', x: '84%', y: '20%', w: 190, dur: 24, delay: -11 },
  ],
}
