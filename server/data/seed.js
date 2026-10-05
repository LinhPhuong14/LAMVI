// Dữ liệu khởi tạo — phải khớp supabase/seed.sql (T-04).
// Bản dịch en/zh do đội dev soạn, chờ PO duyệt (xem ba-spec §31.2 G-14).

// D-96: bộ sưu tập. Nội dung mẫu `[ASSUMPTION]` — PO thay bằng nội dung thật (tên, câu chuyện).
export const collections = [
  {
    id: '33333333-3333-4333-8333-000000000001',
    slug: 'sum-vay',
    status: 'published',
    tone: 'amber',
    sortOrder: 1,
    name: { vi: 'Sum Vầy', en: 'Sum Vay', zh: '团圆' },
    description: {
      vi: 'Những chiếc đèn cho bữa cơm đoàn viên: mỗi đèn một dáng, cùng toả một ánh sáng ấm.',
      en: 'Lanterns for the reunion table: each with its own shape, all sharing one warm glow.',
      zh: '献给团圆饭桌的灯笼：每盏形态各异，共享一束暖光。',
    },
    storyTitle: { vi: 'Mâm cơm ngày Tết', en: 'The Tet Feast', zh: '年夜饭' },
    story: {
      vi: 'Chiều ba mươi, cả nhà quây quanh mâm cơm. Ngọn đèn đầu tiên thắp lên là để gọi người đi xa về, ngọn thứ hai để nhớ người đã khuất, ngọn thứ ba để chúc cho năm mới. Khi đủ ba ngọn, căn nhà không còn góc tối nào nữa.',
      en: 'On the last evening of the year the family gathers around the table. The first lantern is lit to call home those who are far away, the second to remember those who are gone, the third to wish the new year well. With all three lit, no corner of the house is dark.',
      zh: '除夕傍晚，全家围坐在饭桌旁。第一盏灯唤远行的人归来，第二盏灯怀念逝去的亲人，第三盏灯祝福新的一年。三盏齐亮，屋里再无暗角。',
    },
  },
  {
    id: '33333333-3333-4333-8333-000000000002',
    slug: 'hoi-lang',
    status: 'published',
    tone: 'dusk',
    sortOrder: 2,
    name: { vi: 'Hội Làng', en: 'Village Festival', zh: '村庄庙会' },
    description: {
      vi: 'Bốn mùa hội làng thu vào bốn chiếc đèn: xuân, hạ, thu, đông.',
      en: 'The four seasons of the village festival in four lanterns: spring, summer, autumn, winter.',
      zh: '四季庙会，收进四盏灯：春、夏、秋、冬。',
    },
    storyTitle: { vi: 'Đêm hội đình làng', en: 'Night of the Village Festival', zh: '庙会之夜' },
    story: {
      vi: 'Trống hội vang lên từ sân đình. Xuân rước kiệu, hạ thả diều, thu rước đèn, đông quây lửa kể chuyện. Bốn mùa gom lại thành một đêm hội mà ai đi xa cũng nhớ.',
      en: 'Festival drums sound from the communal-house yard. Spring carries the palanquin, summer flies kites, autumn parades lanterns, winter gathers round the fire to tell stories. Four seasons become one festival night that every traveller remembers.',
      zh: '鼓声从亭院传来。春天抬轿，夏天放风筝，秋天提灯游行，冬天围火讲古。四季汇成一个远行人都会记得的庙会之夜。',
    },
  },
]

export const products = [
  {
    id: '11111111-1111-4111-8111-000000000001',
    slug: 'den-nguyet',
    collectionSlug: 'sum-vay',
    pieceOrder: 1,
    kind: 'single',
    status: 'published',
    price: 890000,
    tone: 'amber',
    sortOrder: 1,
    name: { vi: 'Đèn Nguyệt', en: 'Nguyet Lantern', zh: '月灯' },
    description: {
      vi: 'Dáng tròn đầy, ánh sáng dịu như trăng rằm',
      en: 'A full, round shape with light as soft as the full moon',
      zh: '圆润饱满，光线柔和如满月',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000002',
    slug: 'den-vong',
    collectionSlug: 'sum-vay',
    pieceOrder: 2,
    kind: 'single',
    status: 'published',
    price: 1050000,
    tone: 'dusk',
    sortOrder: 2,
    name: { vi: 'Đèn Vọng', en: 'Vong Lantern', zh: '望灯' },
    description: {
      vi: 'Thân thon cao, gợi nhớ mái đình làng cổ',
      en: 'Tall and slender, recalling the roofs of old village temples',
      zh: '修长挺拔，令人想起古村亭阁的屋檐',
    },
    badge: { vi: 'Bán chạy', en: 'Best seller', zh: '畅销' },
  },
  {
    id: '11111111-1111-4111-8111-000000000003',
    slug: 'den-sum-vay',
    // Q-05: thành phần bộ và giá lẻ từng đèn chưa được chốt — chưa khai báo thành phần
    collectionSlug: 'sum-vay',
    pieceOrder: 0,
    kind: 'set',
    status: 'published',
    price: 1680000,
    tone: 'dawn',
    sortOrder: 3,
    name: { vi: 'Đèn Sum Vầy', en: 'Sum Vay Lantern Set', zh: '团圆灯组' },
    description: {
      vi: 'Bộ ba kích cỡ, dành tặng cả gia đình',
      en: 'A set of three sizes, made for the whole family',
      zh: '三种尺寸一组，献给全家人',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000004',
    slug: 'den-tinh',
    collectionSlug: 'sum-vay',
    pieceOrder: 3,
    kind: 'single',
    status: 'published',
    price: 760000,
    tone: 'moss',
    sortOrder: 4,
    name: { vi: 'Đèn Tịnh', en: 'Tinh Lantern', zh: '静灯' },
    description: {
      vi: 'Dáng nhỏ gọn, ánh sáng lặng như đêm không gió',
      en: 'Small and compact, with a light as still as a windless night',
      zh: '小巧玲珑，光线静如无风之夜',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000005',
    slug: 'den-hoi-xuan',
    collectionSlug: 'hoi-lang',
    pieceOrder: 1,
    kind: 'single',
    status: 'published',
    price: 820000,
    tone: 'dawn',
    sortOrder: 5,
    name: { vi: 'Đèn Xuân', en: 'Xuan Lantern', zh: '春灯' },
    description: {
      vi: 'Sắc hồng đào của ngày hội đầu năm',
      en: 'The peach-pink of the first festival of the year',
      zh: '年初庙会的桃红色',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000006',
    slug: 'den-hoi-ha',
    collectionSlug: 'hoi-lang',
    pieceOrder: 2,
    kind: 'single',
    status: 'published',
    price: 820000,
    tone: 'amber',
    sortOrder: 6,
    name: { vi: 'Đèn Hạ', en: 'Ha Lantern', zh: '夏灯' },
    description: {
      vi: 'Vàng nắng của mùa thả diều',
      en: 'The sunny yellow of kite-flying season',
      zh: '放风筝季节的阳光黄',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000007',
    slug: 'den-hoi-thu',
    collectionSlug: 'hoi-lang',
    pieceOrder: 3,
    kind: 'single',
    status: 'published',
    price: 840000,
    tone: 'dusk',
    sortOrder: 7,
    name: { vi: 'Đèn Thu', en: 'Thu Lantern', zh: '秋灯' },
    description: {
      vi: 'Tím chiều của đêm rước đèn',
      en: 'The dusk purple of the lantern parade night',
      zh: '提灯游行之夜的暮紫',
    },
    badge: null,
  },
  {
    id: '11111111-1111-4111-8111-000000000008',
    slug: 'den-hoi-dong',
    collectionSlug: 'hoi-lang',
    pieceOrder: 4,
    kind: 'single',
    status: 'published',
    price: 840000,
    tone: 'moss',
    sortOrder: 8,
    name: { vi: 'Đèn Đông', en: 'Dong Lantern', zh: '冬灯' },
    description: {
      vi: 'Xanh rêu của bếp lửa mùa đông',
      en: 'The moss green of the winter hearth',
      zh: '冬日炉火旁的苔绿',
    },
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
      vi: 'Lời chúc dạng chữ được lưu vĩnh viễn. Lời chúc bằng giọng nói hoặc video được lưu 30 ngày kể từ khi người nhận bấm "Tôi đã nhận được quà" — hãy bấm "Tải về" để giữ lại. Video quá trình làm đèn (quét mã QR trên đèn) được lưu vĩnh viễn.',
      en: 'Text messages are kept forever. Voice and video messages are kept for 30 days after the recipient taps "I have received my gift" — tap "Download" to keep a copy. The lantern-making video (scan the QR code on the lantern) is kept forever.',
      zh: '文字祝福永久保存。语音或视频祝福在收礼人点击“我已收到礼物”后保存 30 天——请点击“下载”保留副本。灯的制作视频（扫描灯上的二维码）永久保存。',
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
      vi: 'Khung tre và giấy dó được gia cố, đóng gói trong hộp có lớp đệm chuyên dụng cho hàng thủ công dễ vỡ.',
      en: 'The bamboo frame and dó paper are reinforced and packed in a padded box made for fragile handicrafts.',
      zh: '竹架和纸面经过加固，并装入专为易碎手工艺品设计的缓冲盒中。',
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
      vi: 'Lô đèn được làm tại làng Yên Thái từ giấy dó xeo tay.',
      en: 'This batch was made in Yen Thai village from hand-made dó paper.',
      zh: '本批次灯由安泰村手工抄造的纸制成。',
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
