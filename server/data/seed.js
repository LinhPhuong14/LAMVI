// Dữ liệu khởi tạo — phải khớp supabase/seed.sql (T-04).
// Bản dịch en/zh do đội dev soạn, chờ PO duyệt (xem ba-spec §31.2 G-14).
// v0.42 (D-104): danh mục lấy từ tài liệu nhóm (Content Plan, báo cáo đồ án) — 5 đèn của bộ sưu tập đầu tiên.
// Giá 1.400.000 đ là trung điểm khoảng giá dự kiến 1.300.000–1.500.000 đ `[ASSUMPTION]` (D-104) — chưa phải giá đã kiểm chứng.

const PRICE = 1400000

// Thông số chung của 5 đèn (Content Plan 04/10 + báo cáo mục 1.3). Cân nặng và cách bảo quản chưa có dữ liệu.
const SPECS = {
  size: {
    vi: 'Thân đèn cao 20 cm, đường kính 12 cm; đế gỗ cao 5 cm, đường kính 12 cm',
    en: 'Lantern body 20 cm tall, 12 cm in diameter; wooden base 5 cm tall, 12 cm in diameter',
    zh: '灯身高 20 厘米、直径 12 厘米；木底座高 5 厘米、直径 12 厘米',
  },
  material: {
    vi: 'Giấy dó Dương Ổ – Phong Khê phủ điệp, artwork tranh dân gian Đông Hồ; đế gỗ',
    en: 'Dó paper from Duong O – Phong Khe, coated with điệp, artwork from Dong Ho folk painting; wooden base',
    zh: '杨坞—风溪手工纸，涂贝壳粉（điệp），图案取自东湖民间版画；木底座',
  },
  light: {
    vi: 'Đèn LED ánh sáng vàng ấm, dùng điện cắm trực tiếp',
    en: 'Warm-white LED, plugs directly into mains power',
    zh: '暖黄色 LED，直接插电使用',
  },
  leadTime: {
    vi: 'Trung bình 5–7 ngày làm việc',
    en: 'On average 5–7 working days',
    zh: '平均 5–7 个工作日',
  },
}

// D-96: bộ sưu tập. Nội dung do dev soạn từ Content Plan `[ASSUMPTION]` — PO/Marketing duyệt.
export const collections = [
  {
    id: '33333333-3333-4333-8333-0000000000a1',
    slug: 'bo-suu-tap-dau-tien',
    status: 'published',
    tone: 'amber',
    sortOrder: 1,
    name: { vi: 'Bộ sưu tập đầu tiên', en: 'The First Collection', zh: '首个系列' },
    description: {
      vi: 'Năm bức tranh, năm chiếc đèn giấy dó, năm câu chuyện đầu tiên của LAMVI.',
      en: 'Five paintings, five dó paper lanterns, the first five stories of LAMVI.',
      zh: '五幅画、五盏纸灯、LAMVI 的第一批五个故事。',
    },
    storyTitle: { vi: 'Từ một tờ giấy đến ánh sáng', en: 'From a sheet of paper to light', zh: '从一张纸到一束光' },
    story: {
      vi: 'Một tờ giấy đi qua bao nhiêu đôi tay trước khi thành ánh sáng? Giấy dó thủ công ở Dương Ổ – Phong Khê, lớp điệp và phần nghệ thuật Đông Hồ, rồi những chiếc đèn được hoàn thiện ở LAMVI. Đủ năm chiếc đèn là đủ năm câu chuyện: mùa gặt xứng đáng, bốn linh vật, phúc và lộc song toàn, tiếng gà gọi bình minh và đàn lợn quây quần.',
      en: 'How many hands does a sheet of paper pass through before it becomes light? Handmade dó paper from Duong O – Phong Khe, the điệp coating and the Dong Ho artwork, then lanterns finished at LAMVI. Five lanterns make five stories: a well-earned harvest, four sacred creatures, blessings and fortune together, roosters calling the dawn, and a gathered herd of pigs.',
      zh: '一张纸在变成光之前要经过多少双手？杨坞—风溪的手工纸、贝壳粉涂层与东湖版画，再由 LAMVI 完成灯的制作。集齐五盏灯，便是五个故事：当之无愧的丰收、四灵、福禄双全、雄鸡报晓与成群的猪。',
    },
  },
]

export const products = [
  {
    id: '11111111-1111-4111-8111-0000000000a1',
    slug: 'den-thu-hoach',
    collectionSlug: 'bo-suu-tap-dau-tien',
    pieceOrder: 1,
    kind: 'single',
    status: 'published',
    price: PRICE,
    tone: 'amber',
    sortOrder: 1,
    name: { vi: 'Đèn Thu Hoạch', en: 'Harvest Lantern (Thu Hoach)', zh: '丰收灯（Thu Hoạch）' },
    description: {
      vi: 'Gặt mùa xứng đáng — dành cho những hành trình được vun trồng bằng sự bền bỉ',
      en: 'A well-earned harvest — for journeys cultivated with perseverance',
      zh: '收获当之无愧的季节——献给用坚持耕耘的旅程',
    },
    specs: SPECS,
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-0000000000a2',
    slug: 'den-tu-linh',
    collectionSlug: 'bo-suu-tap-dau-tien',
    pieceOrder: 2,
    kind: 'single',
    status: 'published',
    price: PRICE,
    tone: 'dusk',
    sortOrder: 2,
    name: { vi: 'Đèn Tứ Linh', en: 'Four Sacred Creatures Lantern (Tu Linh)', zh: '四灵灯（Tứ Linh）' },
    description: {
      vi: 'Long, Lân, Quy, Phụng — bốn linh vật với nhiều chi tiết để khám phá khi lại gần',
      en: 'Dragon, Qilin, Turtle and Phoenix — four creatures with details to discover up close',
      zh: '龙、麟、龟、凤——四灵，近看有许多细节等你发现',
    },
    specs: SPECS,
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-0000000000a3',
    slug: 'den-phuc-loc-song-toan',
    collectionSlug: 'bo-suu-tap-dau-tien',
    pieceOrder: 3,
    kind: 'single',
    status: 'published',
    price: PRICE,
    tone: 'dawn',
    sortOrder: 3,
    name: { vi: 'Đèn Phúc Lộc Song Toàn', en: 'Blessings and Fortune Lantern (Phuc Loc Song Toan)', zh: '福禄双全灯（Phúc Lộc Song Toàn）' },
    description: {
      vi: 'Một món quà, hai lời chúc Phúc và Lộc',
      en: 'One gift, two wishes: Blessings and Fortune',
      zh: '一份礼物，两重祝福：福与禄',
    },
    specs: SPECS,
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-0000000000a4',
    slug: 'den-ga-tam-duong-khai-thai',
    collectionSlug: 'bo-suu-tap-dau-tien',
    pieceOrder: 4,
    kind: 'single',
    status: 'published',
    price: PRICE,
    tone: 'moss',
    sortOrder: 4,
    name: { vi: 'Đèn Gà Tam Dương Khai Thái', en: 'Rooster Lantern (Tam Duong Khai Thai)', zh: '三阳开泰雄鸡灯（Tam Dương Khai Thái）' },
    description: {
      vi: 'Hai chú gà trống cất tiếng gọi bình minh — lời chúc cho một khởi đầu thuận lợi',
      en: 'Two roosters calling the dawn — a wish for an auspicious beginning',
      zh: '两只雄鸡啼晓——祝愿一个顺遂的开端',
    },
    specs: SPECS,
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-0000000000a5',
    slug: 'den-lon-dan',
    collectionSlug: 'bo-suu-tap-dau-tien',
    pieceOrder: 5,
    kind: 'single',
    status: 'published',
    price: PRICE,
    tone: 'dusk',
    sortOrder: 5,
    name: { vi: 'Đèn Lợn Đàn', en: 'Pig Herd Lantern (Lon Dan)', zh: '猪群灯（Lợn Đàn）' },
    description: {
      vi: 'Đàn lợn quây quần với những vòng xoáy âm dương — mong ước sung túc và hòa hợp',
      en: 'A gathered herd of pigs with yin-yang swirls — a wish for plenty and harmony',
      zh: '成群的猪与阴阳漩涡——祈愿富足与和睦',
    },
    specs: SPECS,
    badge: null,
  },
]

export const faqEntries = [
  {
    id: '22222222-2222-4222-8222-000000000001',
    sortOrder: 1,
    isPublished: true,
    // §31.3: sửa "Vĩnh viễn" theo D-10, D-12, D-26
    question: {
      vi: 'Video và lời chúc lưu giữ được bao lâu?',
      en: 'How long are the videos and messages kept?',
      zh: '视频和祝福会保存多久？',
    },
    answer: {
      vi: 'Lời chúc dạng chữ được lưu vĩnh viễn. Lời chúc bằng giọng nói hoặc video được lưu 30 ngày kể từ khi người nhận bấm "Tôi đã nhận được quà" — hãy bấm "Tải về" để giữ lại. Video hành trình mẻ đèn (mở từ thiệp cảm ơn) được lưu vĩnh viễn.',
      en: 'Text messages are kept forever. Voice and video messages are kept for 30 days after the recipient taps "I have received my gift" — tap "Download" to keep a copy. The video of how the batch was made (opened from the thank-you card) is kept forever.',
      zh: '文字祝福永久保存。语音或视频祝福在收礼人点击“我已收到礼物”后保存 30 天——请点击“下载”保留副本。灯的制作视频（通过感谢卡打开）永久保存。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000002',
    sortOrder: 2,
    isPublished: true,
    // §31.3: sửa theo D-13 + BR-MSG-008 (D-41)
    question: {
      vi: 'Tôi có thể chỉnh sửa lời chúc sau khi đặt hàng không?',
      en: 'Can I edit my message after ordering?',
      zh: '下单后可以修改祝福吗？',
    },
    answer: {
      vi: 'Có. Bạn chỉnh sửa lời chúc trong trang tài khoản. Phần chữ được khóa khi đơn đã đóng gói (vì thiệp viết tay đã được viết); giọng nói và video sửa được cho đến khi đơn được gửi đi.',
      en: 'Yes. You can edit your message in your account. The text is locked once the order is packed (the handwritten card has been written); voice and video can be changed until the order ships.',
      zh: '可以。您可以在账户页面修改祝福。订单打包后文字将被锁定（手写卡片已写好）；语音和视频可修改至订单发货前。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000003',
    sortOrder: 3,
    isPublished: true,
    question: {
      vi: 'Người nhận có cần tải ứng dụng để xem không?',
      en: 'Does the recipient need to install an app?',
      zh: '收礼人需要安装应用吗？',
    },
    answer: {
      vi: 'Không cần. Chỉ cần quét mã bằng camera điện thoại, nội dung mở ngay trên trình duyệt.',
      en: 'No. Just scan the code with the phone camera and the content opens in the browser.',
      zh: '不需要。只需用手机相机扫码，内容即在浏览器中打开。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000004',
    sortOrder: 4,
    isPublished: true,
    question: {
      vi: 'Đèn giấy dó có dễ vỡ khi vận chuyển không?',
      en: 'Are dó paper lanterns fragile in shipping?',
      zh: '纸灯在运输中容易损坏吗？',
    },
    answer: {
      vi: 'Thân đèn giấy dó được giữ form bằng lớp lót bên trong và đặt trên đế gỗ; mỗi đèn được đóng gói trong hộp có lớp đệm chuyên dụng cho hàng thủ công dễ vỡ.',
      en: 'The dó paper body is held in shape by an inner liner and set on a wooden base; each lantern is packed in a padded box made for fragile handicrafts.',
      zh: '纸灯身由内衬定型，立于木底座上；每盏灯都装入专为易碎手工艺品设计的缓冲盒中。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000005',
    sortOrder: 5,
    isPublished: true,
    question: {
      vi: 'Thời gian hoàn thành một chiếc đèn đặt riêng là bao lâu?',
      en: 'How long does it take to make a lantern?',
      zh: '制作一盏灯需要多长时间？',
    },
    answer: {
      vi: 'Trung bình 5–7 ngày làm việc, tuỳ theo mẫu và khối lượng đơn tại xưởng vào thời điểm đặt hàng.',
      en: 'On average 5–7 working days, depending on the model and the workshop’s workload at the time of ordering.',
      zh: '平均 5–7 个工作日，视款式及下单时工坊的订单量而定。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000006',
    sortOrder: 6,
    isPublished: true,
    question: {
      vi: 'Giấy dó và giấy điệp có phải là một không?',
      en: 'Are dó paper and điệp paper the same thing?',
      zh: '桑皮纸（dó）和贝粉纸（điệp）是同一种纸吗？',
    },
    answer: {
      vi: 'Không hoàn toàn. Giấy dó là nền giấy thủ công; giấy điệp là giấy dó sau khi được phủ thêm lớp điệp trên bề mặt. Tranh Đông Hồ là một hệ thống rộng hơn, gắn với nền giấy, lớp điệp, màu sắc, bản khắc, kỹ thuật thực hiện và đề tài dân gian.',
      en: 'Not quite. Dó paper is the handmade base paper; điệp paper is dó paper with an extra điệp coating on its surface. Dong Ho painting is a wider system tied to the paper, the coating, colours, woodblocks, technique and folk subjects.',
      zh: '不完全是。dó 纸是手工纸基底；điệp 纸是在 dó 纸表面再涂一层贝壳粉（điệp）。东湖版画则是更大的体系，涵盖纸、涂层、颜色、雕版、技法与民间题材。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000007',
    sortOrder: 7,
    isPublished: true,
    question: {
      vi: 'Giấy và tranh trên đèn đến từ đâu?',
      en: 'Where do the paper and artwork on the lanterns come from?',
      zh: '灯上的纸和图案从哪里来？',
    },
    answer: {
      vi: 'Giấy dó được lấy trực tiếp từ cơ sở làm giấy tại Dương Ổ – Phong Khê, rồi đưa tới Đông Hồ để phủ điệp và thực hiện phần nghệ thuật. LAMVI hoàn thiện cấu trúc đèn, ánh sáng, đóng gói và trải nghiệm kể chuyện số.',
      en: 'The dó paper comes straight from a papermaking workshop in Duong O – Phong Khe, then goes to Dong Ho for the điệp coating and the artwork. LAMVI finishes the lantern structure, lighting, packaging and the digital storytelling.',
      zh: 'dó 纸直接取自杨坞—风溪的造纸作坊，再送到东湖涂贝壳粉并完成图案；LAMVI 负责灯的结构、光源、包装与数字叙事体验。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000008',
    sortOrder: 8,
    isPublished: true,
    question: {
      vi: 'Mã QR nằm ở đâu trên sản phẩm?',
      en: 'Where is the QR code on the product?',
      zh: '二维码在产品的什么位置？',
    },
    answer: {
      vi: 'LAMVI không đặt QR hay khắc lời nhắn lên đèn hoặc đế gỗ. Mã QR nằm trên thiệp cảm ơn đi kèm; quét mã sẽ mở lời chúc của người tặng và video hành trình mẻ đèn.',
      en: 'LAMVI does not place a QR code or engrave a message on the lantern or its wooden base. The QR code is on the accompanying thank-you card; scanning it opens the giver’s message and the video of how the batch was made.',
      zh: 'LAMVI 不会在灯身或木底座上放置二维码或刻字。二维码位于随附的感谢卡上；扫码即可打开送礼人的祝福和灯的制作视频。',
    },
  },
  {
    id: '22222222-2222-4222-8222-000000000009',
    sortOrder: 9,
    isPublished: true,
    question: {
      vi: 'Đèn có kích thước và nguồn sáng như thế nào?',
      en: 'What are the size and light source of the lantern?',
      zh: '灯的尺寸和光源是怎样的？',
    },
    answer: {
      vi: 'Thân đèn cao 20 cm, đường kính 12 cm, đặt trên đế gỗ cao 5 cm. Đèn dùng LED ánh sáng vàng ấm và cắm điện trực tiếp.',
      en: 'The lantern body is 20 cm tall and 12 cm in diameter, on a 5 cm wooden base. It uses a warm-white LED and plugs directly into mains power.',
      zh: '灯身高 20 厘米、直径 12 厘米，立于高 5 厘米的木底座上；使用暖黄色 LED，直接插电。',
    },
  },
]

// Chỉ dùng cho adapter bộ nhớ (dev/test). Lô thật do admin tạo — không có trong supabase/seed.sql.
export const demoBatches = [
  {
    id: '33333333-3333-4333-8333-000000000001',
    code: 'DEMO-2026-01',
    status: 'video_published',
    videoUrl: 'https://example.com/moc/batch-demo.mp4',
    producedOn: '2026-09-01',
    title: {
      vi: 'Lô đèn tháng 9/2026',
      en: 'September 2026 batch',
      zh: '2026年9月批次',
    },
    story: {
      vi: 'Lô đèn mẫu — nội dung thật do xưởng cung cấp khi có video.',
      en: 'Sample batch — real content to be provided by the workshop with the video.',
      zh: '示例批次——真实内容将由工坊随视频提供。',
    },
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    code: 'DEMO-2026-02',
    status: 'created',
    videoUrl: null,
    producedOn: '2026-09-20',
    title: { vi: 'Lô đèn chưa có video' },
    story: null,
  },
]
