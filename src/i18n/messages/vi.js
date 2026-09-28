// Nguồn chuỗi giao diện tiếng Việt (mặc định). en/zh phải có cùng key (D-40: thiếu thì dùng vi).
// Các câu đánh dấu §31.3 là câu thay thế đề xuất — chờ PO/Marketing duyệt.
export default {
  meta: {
    title: 'Mộc — Đèn Giấy Dó Thủ Công',
    description:
      'Đèn giấy dó thủ công làm quà tặng, kèm lời chúc gắn mã QR và video hành trình làm đèn.',
  },
  nav: {
    story: 'Câu chuyện',
    artisan: 'Nghệ nhân',
    products: 'Sản phẩm',
    lookbook: 'Lookbook',
    qr: 'Trải nghiệm QR',
    faq: 'Hỏi đáp',
    cta: 'Đặt đèn',
    account: 'Tài khoản',
    login: 'Đăng nhập',
    language: 'Ngôn ngữ',
  },
  hero: {
    eyebrow: 'Giấy dó thủ công · Làng nghề trăm năm',
    title1: 'Mỗi chiếc đèn,',
    title2: 'một câu chuyện được thắp lên',
    sub: 'Đèn giấy dó thủ công dành tặng người thân — kèm theo hành trình đèn được làm ra và lời chúc của riêng bạn, mở ra chỉ bằng một lần quét mã.',
    explore: 'Khám phá bộ sưu tập',
    story: 'Nghe câu chuyện làng nghề',
    scroll: 'Cuộn xuống',
  },
  marquee: [
    'GIẤY DÓ THỦ CÔNG',
    'KỂ CHUYỆN BẰNG ÁNH SÁNG',
    'LÀM QUÀ TẶNG Ý NGHĨA',
    // §31.3: thay "LƯU GIỮ KÝ ỨC VĨNH VIỄN" (D-26)
    'MỖI LỜI CHÚC, MỘT KỶ NIỆM',
    'LÀNG NGHỀ TRĂM NĂM',
  ],
  story: {
    eyebrow: 'Di sản',
    title: 'Từ làng nghề giấy dó trăm năm',
    // §31.3 (mới phát hiện): bỏ ý "được lưu giữ theo cách bền bỉ" (D-26)
    text: 'Giấy dó từng dùng để chép sử, vẽ tranh Đông Hồ, lưu giữ ký ức của bao thế hệ. Chúng tôi mang chất liệu ấy trở lại trong hình hài một chiếc đèn — để câu chuyện của gia đình bạn được thắp lên từ chính chất liệu bền bỉ ấy.',
    statYears: 'năm nghề giấy dó',
    statArtisans: 'nghệ nhân đồng hành',
    // §31.3: thay "câu chuyện riêng mỗi đèn" (D-01, D-45)
    statStory: 'lời chúc riêng cho mỗi món quà',
  },
  artisan: {
    eyebrow: 'Người giữ lửa nghề',
    title: 'Bàn tay tạo nên ánh sáng',
    quote:
      '“Mỗi tờ giấy dó đều có tính khí riêng — ẩm quá thì rách, khô quá thì giòn. Phải quen tay hàng chục năm mới lên khung được một chiếc đèn tròn đều.”',
    name: 'Nghệ nhân Nguyễn Văn Tài',
    place: 'Làng Yên Thái, Hà Nội',
    years: 'năm trong nghề',
    made: 'chiếc đèn đã ra lò',
  },
  products: {
    eyebrow: 'Bộ sưu tập',
    title: 'Chọn lý do bạn thắp lên chiếc đèn này',
    gift: 'Mua tặng',
    self: 'Mua cho mình',
    giftCopy:
      'Kèm thiệp viết tay, hộp quà vải bố và thiệp cảm ơn có mã QR để người nhận xem lời chúc riêng của bạn.',
    // §31.3: đơn tự mua cũng có thiệp cảm ơn + QR và có thể thêm lời chúc (D-14, D-28)
    selfCopy:
      'Một góc ánh sáng ấm cho không gian sống — quét mã trên đèn để xem mẻ đèn được làm ra. Muốn gửi lời nhắn cho chính mình? Chỉ cần tích “Thêm lời chúc”.',
    viewDetail: 'Xem chi tiết',
    loading: 'Đang tải sản phẩm…',
    error: 'Không tải được sản phẩm. Vui lòng thử lại sau.',
    empty: 'Chưa có sản phẩm.',
    setBadge: 'Bộ sản phẩm',
    orderingSoon: 'Đặt hàng trực tuyến sẽ sớm ra mắt.',
    backToCollection: '← Về bộ sưu tập',
    notFound: 'Không tìm thấy sản phẩm.',
  },
  price: {
    // BR-PRC-003, D-03
    exclVat: 'chưa gồm VAT',
  },
  lookbook: {
    eyebrow: 'Lookbook',
    title: 'Sắc màu của ánh sáng thủ công',
    items: ['Hổ phách', 'Hoàng hôn', 'Bình minh', 'Trầm mộc', 'Lửa ấm'],
  },
  process: {
    eyebrow: 'Hành trình thủ công',
    // §31.3: thay "Theo dõi đèn của bạn từng bước" (D-01)
    title: 'Theo dõi đơn của bạn qua từng công đoạn',
    steps: [
      { label: 'Chọn giấy dó', note: 'Lọc từng tấm giấy dệt tay không tì vết' },
      { label: 'Lên khung tre', note: 'Vót nan, uốn khung theo dáng cổ truyền' },
      { label: 'Phơi nắng', note: 'Đợi nắng tự nhiên làm săn từng lớp giấy' },
      // §31.3: thay "Gắn mã riêng lưu câu chuyện của bạn" (D-01, D-43)
      { label: 'Đóng gói & khắc QR', note: 'Khắc mã mở video hành trình của mẻ đèn' },
    ],
  },
  qr: {
    eyebrow: 'Khoảnh khắc mở quà',
    title: 'Quét mã, thấy cả một câu chuyện',
    // §31.3: thay "Mỗi chiếc đèn mang một mã QR riêng … được lưu giữ lâu dài" (D-01, D-26, D-28)
    text: 'Mã QR trên thiệp cảm ơn mở ra lời chúc của bạn, còn mã khắc trên đèn mở ra video hành trình mẻ đèn được làm ra. Người nhận chỉ cần đưa điện thoại lên, không cần cài ứng dụng.',
    points: [
      // §31.3: thay "Video quá trình làm đèn của chính chiếc đèn này" (D-01)
      'Video quá trình làm ra mẻ đèn, xem lại bất cứ lúc nào',
      'Lời chúc bằng chữ, giọng nói hoặc video của người tặng',
      // §31.3: thay "Lưu lại vĩnh viễn trong sổ lưu niệm cá nhân" (D-12, D-26)
      'Lời chúc chữ được lưu mãi; giọng nói và video lưu 30 ngày kể từ khi người nhận xác nhận đã nhận quà, có thể tải về để giữ lâu dài',
    ],
    // D-45
    phoneCaption: 'Hành trình mẻ đèn của bạn',
    phoneFrom: 'Lời chúc từ Minh Anh',
    phoneMessage: '“Chúc chị luôn ấm áp như ánh đèn này. Em thương chị rất nhiều.”',
  },
  testimonials: {
    eyebrow: 'Người đã thắp đèn',
    title: 'Những câu chuyện được kể lại',
    // Q-23: chưa xác nhận là đánh giá thật — giữ nguyên nội dung cũ
    items: [
      {
        name: 'Thu Hà',
        context: 'Tặng mẹ nhân ngày 20/10',
        quote:
          '“Mẹ mình xem video làm đèn xong thì khóc luôn. Chưa món quà nào làm mẹ xúc động đến vậy.”',
      },
      {
        name: 'Minh Quân',
        context: 'Mua cho phòng khách nhà mình',
        quote:
          '“Ánh sáng ấm mà không chói, để bàn trà nhìn sang trọng hẳn. Video quy trình làm cũng rất chill để xem.”',
      },
      {
        name: 'Bảo Trân',
        context: 'Tặng bạn thân dịp tân gia',
        quote:
          '“Bạn mình quét mã xong nhắn lại ngay, bảo cảm động vì thấy cả quá trình đèn được làm cho riêng mình.”',
      },
    ],
  },
  faq: {
    eyebrow: 'Giải đáp',
    title: 'Những điều bạn có thể thắc mắc',
    loading: 'Đang tải câu hỏi…',
    error: 'Không tải được câu hỏi thường gặp.',
  },
  footer: {
    tagline: 'Đèn giấy dó thủ công — giữ lửa ký ức, thắp sáng yêu thương.',
    products: 'Sản phẩm',
    support: 'Hỗ trợ',
    faq: 'Câu hỏi thường gặp',
    returns: 'Chính sách đổi trả',
    tracking: 'Theo dõi đơn hàng',
    newsTitle: 'Nhận tin tức',
    newsText: 'Câu chuyện làng nghề và ưu đãi mới, gửi mỗi tháng một lần.',
    newsPlaceholder: 'Email của bạn',
    newsSubmit: 'Đăng ký',
    copyright: '© 2026 Mộc — Đèn giấy dó thủ công.',
  },
  batch: {
    eyebrow: 'Hành trình làm đèn',
    loading: 'Đang tải video…',
    notFoundTitle: 'Không tìm thấy lô đèn',
    errorTitle: 'Chưa tải được video',
    notFoundText: 'Mã QR này chưa có video hoặc không tồn tại. Vui lòng thử lại sau.',
    producedOn: 'Ngày làm: {date}',
    code: 'Mã lô: {code}',
    videoFallback: 'Trình duyệt không phát được video.',
    note: 'Video ghi lại quá trình làm cả lô đèn, trong đó có chiếc đèn của bạn.',
    toHome: 'Khám phá MỘC',
  },
  auth: {
    loginTitle: 'Đăng nhập',
    registerTitle: 'Tạo tài khoản',
    forgotTitle: 'Quên mật khẩu',
    resetTitle: 'Đặt mật khẩu mới',
    email: 'Email',
    password: 'Mật khẩu',
    newPassword: 'Mật khẩu mới',
    fullName: 'Họ và tên',
    phone: 'Số điện thoại (không bắt buộc)',
    preferredLocale: 'Ngôn ngữ ưa thích',
    submitLogin: 'Đăng nhập',
    submitRegister: 'Tạo tài khoản',
    submitForgot: 'Gửi email đặt lại',
    submitReset: 'Lưu mật khẩu mới',
    toRegister: 'Chưa có tài khoản? Tạo tài khoản',
    toLogin: 'Đã có tài khoản? Đăng nhập',
    toForgot: 'Quên mật khẩu?',
    forgotSent:
      'Nếu email này đã đăng ký, bạn sẽ nhận được thư hướng dẫn đặt lại mật khẩu.',
    registeredConfirm:
      'Đã tạo tài khoản. Vui lòng mở email để xác nhận, sau đó đăng nhập.',
    resetDone: 'Đã đổi mật khẩu. Vui lòng đăng nhập lại.',
    resetInvalid: 'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
    passwordHint: 'Tối thiểu 8 ký tự.',
    submitting: 'Đang xử lý…',
  },
  account: {
    title: 'Tài khoản của tôi',
    profile: 'Thông tin cá nhân',
    save: 'Lưu thay đổi',
    saved: 'Đã lưu.',
    logout: 'Đăng xuất',
    orders: 'Đơn hàng',
    ordersSoon: 'Danh sách đơn hàng sẽ hiển thị ở đây khi đặt hàng trực tuyến ra mắt.',
    loading: 'Đang tải…',
  },
  errors: {
    NETWORK_ERROR: 'Không kết nối được máy chủ. Vui lòng thử lại.',
    INTERNAL_ERROR: 'Có lỗi xảy ra. Vui lòng thử lại sau.',
    VALIDATION_ERROR: 'Vui lòng kiểm tra lại thông tin.',
    INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
    EMAIL_NOT_CONFIRMED: 'Email chưa được xác nhận. Vui lòng mở thư xác nhận trước khi đăng nhập.',
    EMAIL_TAKEN: 'Email này đã được đăng ký.',
    UNAUTHORIZED: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    RATE_LIMITED: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.',
    NOT_FOUND: 'Không tìm thấy.',
    INVALID_EMAIL: 'Email không hợp lệ.',
    PASSWORD_TOO_SHORT: 'Mật khẩu tối thiểu 8 ký tự.',
    PASSWORD_TOO_LONG: 'Mật khẩu quá dài.',
    REQUIRED: 'Vui lòng nhập trường này.',
    INVALID_PHONE: 'Số điện thoại Việt Nam không hợp lệ.',
    TOO_LONG: 'Nội dung quá dài.',
    INVALID_LOCALE: 'Ngôn ngữ không hợp lệ.',
  },
  notFound: {
    title: 'Không tìm thấy trang',
    back: 'Về trang chủ',
  },
  locales: { vi: 'Tiếng Việt', en: 'English', zh: '简体中文' },
}
