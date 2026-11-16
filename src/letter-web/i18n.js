// D-157: ngôn ngữ của phong thư (admin chọn khi tạo thư) — chữ giao diện người nhận thấy:
// lời mời bật đèn, phong bì, lời đề tặng, chữ ký, điều bất ngờ… Nội dung thư do admin tự viết.
// Độc lập với ngôn ngữ của web (người nhận có thể chưa từng vào web LAMVI).

export const LETTER_LANGS = ['vi', 'en', 'zh']
export const letterLang = (lang) => (LETTER_LANGS.includes(lang) ? lang : 'vi')
/** Thuộc tính lang của HTML (khớp HTML_LANG của web, T-07). */
export const LETTER_HTML_LANG = { vi: 'vi', en: 'en', zh: 'zh-Hans' }

const name = (n) => String(n ?? '').trim()

const DICT = {
  vi: {
    status: {
      dark: 'Căn phòng còn tối. Hãy cùng thắp sáng chiếc đèn của bạn: bấm Bật đèn.',
      lighting: 'Đèn đang sáng dần.',
      rising: 'Một phong thư đang trồi lên.',
      unfolding: 'Lá thư đang mở ra.',
      reading: '',
    },
    replay: 'Xem lại từ đầu',
    closePreview: 'Đóng xem trước',
    stage: 'Đèn LAMVI và phong thư',
    lampName: (lamp) => `Đèn ${lamp}`,
    invite: 'Hãy cùng thắp sáng chiếc đèn của bạn',
    lightOn: 'Bật đèn',
    dedication: (n) => `Gửi ${name(n) || 'bạn'},`,
    letterLabel: (n) => `Lời chúc gửi ${name(n) || 'bạn'}`,
    envelopeTo: 'Gửi',
    recipientFallback: 'bạn',
    revealAll: 'Hiện toàn bộ lá thư',
    watch: 'Xem lời nhắn',
    captions: 'Tiếng Việt',
    regards: 'Thương mến,',
    logoAlt: 'Logo doanh nghiệp',
    postmark: 'GIẤY DÓ',
    blow: 'Ước một điều rồi thổi nến',
    back: 'Quay lại lá thư',
    surpriseFallback: 'Một chút thương, dành riêng cho bạn.',
    photoAlt: (i) => `Kỷ niệm ${i}`,
    films: {
      heading: 'Xem tiếp câu chuyện của LAMVI',
      close: 'Đóng',
      play: 'Xem video',
      culture: { kicker: 'Giới thiệu đèn LAMVI', title: 'Tranh Đông Hồ trên đèn giấy dó' },
      craft: { kicker: 'Cách làm đèn', title: 'Từ làng giấy dó đến chiếc đèn' },
    },
    occasions: {},
  },
  en: {
    status: {
      dark: 'The room is still dark. Let’s light up your lamp: press Turn on the lamp.',
      lighting: 'The lamp is slowly lighting up.',
      rising: 'An envelope is rising.',
      unfolding: 'The letter is unfolding.',
      reading: '',
    },
    replay: 'Watch again',
    closePreview: 'Close preview',
    stage: 'LAMVI lamp and envelope',
    lampName: (lamp) => `${lamp} lamp`,
    invite: 'Let’s light up your lamp',
    lightOn: 'Turn on the lamp',
    dedication: (n) => (name(n) ? `Dear ${name(n)},` : 'Dear friend,'),
    letterLabel: (n) => `A letter for ${name(n) || 'you'}`,
    envelopeTo: 'To',
    recipientFallback: 'you',
    revealAll: 'Show the whole letter',
    watch: 'Watch the message',
    captions: 'English',
    regards: 'Best regards,',
    logoAlt: 'Company logo',
    postmark: 'DÓ PAPER',
    blow: 'Make a wish, then blow out the candles',
    back: 'Back to the letter',
    surpriseFallback: 'A little love, just for you.',
    photoAlt: (i) => `Memory ${i}`,
    films: {
      heading: 'Continue the LAMVI story',
      close: 'Close',
      play: 'Play video',
      culture: { kicker: 'About LAMVI lamps', title: 'Đông Hồ folk paintings on dó-paper lamps' },
      craft: { kicker: 'How the lamp is made', title: 'From the dó-paper village to your lamp' },
    },
    occasions: {
      birthday: { label: 'Birthday', surprise: 'Open the birthday card', artworkAlt: 'An apricot-blossom cake on a ceramic stand with a warm gold ribbon' },
      anniversary: { label: 'Anniversary', surprise: 'Open our memories', artworkAlt: 'Two cups of tea beside a flower sprig and an entwined silk ribbon' },
      thankYou: { label: 'Thank you', surprise: 'One more thank-you', artworkAlt: 'A bouquet of white lotus wrapped in paper with a small envelope' },
      milestone: { label: 'Milestone', surprise: 'Stamp the milestone', artworkAlt: 'A golden paper crane rising from paper steps and a laurel sprig' },
      encouragement: { label: 'Encouragement', surprise: 'Open when you need it', artworkAlt: 'A green sprout growing from a clay pot under the sun' },
      longDistance: { label: 'From afar', surprise: 'Open the two windows', artworkAlt: 'Two lit windows joined by a paper plane' },
      justBecause: { label: 'Just because', surprise: 'One more little thing', artworkAlt: 'A small envelope opening to a flower and a golden star' },
    },
  },
  zh: {
    status: {
      dark: '房间还很暗。一起点亮你的灯吧：请按“开灯”。',
      lighting: '灯正在慢慢亮起。',
      rising: '一封信正在升起。',
      unfolding: '信纸正在展开。',
      reading: '',
    },
    replay: '从头再看',
    closePreview: '关闭预览',
    stage: 'LAMVI 灯与信封',
    lampName: (lamp) => `${lamp} 灯`,
    invite: '一起点亮你的灯吧',
    lightOn: '开灯',
    dedication: (n) => `亲爱的${name(n) || '你'}：`,
    letterLabel: (n) => `写给${name(n) || '你'}的信`,
    envelopeTo: '致',
    recipientFallback: '你',
    revealAll: '显示整封信',
    watch: '观看留言',
    captions: '中文',
    regards: '祝好，',
    logoAlt: '企业标志',
    postmark: 'DÓ 纸',
    blow: '许个愿，再吹灭蜡烛',
    back: '回到信上',
    surpriseFallback: '一点心意，只为你。',
    photoAlt: (i) => `回忆 ${i}`,
    films: {
      heading: '继续了解 LAMVI 的故事',
      close: '关闭',
      play: '播放视频',
      culture: { kicker: '认识 LAMVI 灯', title: '越南东湖民间画上的 dó 纸灯' },
      craft: { kicker: '灯的制作', title: '从 dó 纸村到你的灯' },
    },
    occasions: {
      birthday: { label: '生日', surprise: '打开生日贺卡', artworkAlt: '陶瓷底座上的杏花蛋糕，系着暖金色丝带' },
      anniversary: { label: '纪念日', surprise: '打开我们的回忆', artworkAlt: '两杯茶，旁边是一枝花和缠绕的丝带' },
      thankYou: { label: '感谢', surprise: '再说一声谢谢', artworkAlt: '纸包的白莲花束和一个小信封' },
      milestone: { label: '里程碑', surprise: '盖上里程碑印章', artworkAlt: '金色纸鹤从纸阶梯和月桂枝间飞起' },
      encouragement: { label: '鼓励', surprise: '需要时打开', artworkAlt: '阳光下从陶盆中长出的绿芽' },
      longDistance: { label: '远方来信', surprise: '打开两扇窗', artworkAlt: '两扇亮灯的窗户由一架纸飞机相连' },
      justBecause: { label: '随心之礼', surprise: '还有一件小事', artworkAlt: '小信封里开出一朵花和一颗金色的星' },
    },
  },
}

/** Bộ chữ của phong thư theo ngôn ngữ (ngôn ngữ lạ → tiếng Việt). */
export const letterText = (lang) => DICT[letterLang(lang)]

/** Theme theo dịp đã dịch nhãn/tiêu đề bất ngờ/mô tả ảnh (tiếng Việt giữ nguyên theme gốc). */
export function localizeTheme(theme, occasion, lang) {
  const map = DICT[letterLang(lang)].occasions
  return Object.hasOwn(map, occasion) ? { ...theme, ...map[occasion] } : theme
}
