import lamp from '../assets/landing/lamp.jpg'
import mucDong from '../assets/landing/mucDong.jpg'
import papermaking from '../assets/landing/papermaking.jpg'
import pleated from '../assets/landing/pleated.jpg'
import woodblock from '../assets/landing/woodblock.jpg'

export const images = { lamp, papermaking, mucDong, pleated, woodblock }

export const navLinks = [
  { href: '#collection', label: 'Exhibitions' },
  { href: '#story', label: 'Folio & Artifacts' },
  { href: '#heritage', label: 'Craft Heritage' },
  { href: '#bespoke', label: 'Atelier' },
]

export const heroMeta = [
  { label: 'Chất liệu chính', value: 'Vỏ cây Dướng & Vụn Điệp tự nhiên' },
  { label: 'Kỹ thuật tạo tác', value: 'Liềm seo thủ công & Mộc bản cổ' },
  { label: 'Cội nguồn di sản', value: 'Làng Dương Ổ & Đông Hồ, Bắc Ninh' },
]

// Bộ lọc ảnh theo nhiệt độ màu toàn cục
export const kelvinModes = {
  warm: { label: '2700K Nến Ấm', filter: 'sepia(0.3) saturate(1.2)' },
  moon: { label: '3500K Ánh Trăng', filter: 'sepia(0.05) saturate(0.95)' },
}

export const artifacts = [
  {
    id: 1,
    edition: 'Ấn bản I / 99',
    material: 'Gỗ Teak & Điệp',
    image: images.mucDong,
    alt: 'Tranh Mục Đồng Thổi Sáo lồng trong khung đèn LAMVI',
    fit: 'object-contain',
    glow: 'bg-secondary-container/10',
    title: 'Mục Đồng Cung Đình',
    desc: 'Tiếng sáo thanh bình dẫn lối tâm hồn về chốn an nhiên. Bản mộc khắc gỗ thị kinh điển in thủ công trên nền điệp lấp lánh.',
    specs: [
      ['Kích thước', '32 x 18 x 56 cm'],
      ['Chế tác mộc bản', 'Nghệ nhân Đông Hồ'],
      ['Sắc tố tự nhiên', 'Than lá tre & Hoa hòe'],
    ],
  },
  {
    id: 2,
    edition: 'Ấn bản II / 50',
    material: 'Gỗ Mun Sừng',
    image: images.lamp,
    alt: 'Đèn điêu khắc Dó hình thoi Vinh Hoa Phú Quý',
    fit: 'object-cover',
    glow: 'bg-secondary-container/15',
    title: 'Vinh Hoa Phú Quý',
    desc: 'Cấu trúc thoi dẹt mô phỏng lồng chim truyền thống, tỏa sáng dịu êm qua 4 lớp giấy Dó bóc tay không tì vết.',
    specs: [
      ['Kích thước', '28 x 28 x 68 cm'],
      ['Khung kết cấu', 'Gỗ gõ đỏ liên kết mộng'],
      ['Quang thông', '850 lm • Dimmer vô cấp'],
    ],
  },
  {
    id: 3,
    edition: 'Ấn bản III / 30',
    material: 'Giấy Dó Xếp Nếp',
    image: images.pleated,
    alt: 'Đèn giấy Dó xếp nếp Tố Nữ Tứ Bình đặt trên bệ bê tông, ánh sáng hổ phách làm hiện rõ thớ sợi vỏ cây',
    fit: 'object-cover',
    glow: 'bg-secondary-container/15',
    title: 'Tố Nữ Tứ Bình',
    desc: 'Thiết kế gấp xếp origami đương đại tôn vinh nhịp điệu thanh tú của bốn nàng tố nữ gảy đàn, thổi sáo qua ánh hoàng hôn.',
    specs: [
      ['Kích thước', '24 x 24 x 45 cm'],
      ['Kỹ nghệ gấp', 'Bespoke Pleating Dó'],
      ['Nguồn sáng', 'LED OLED không tỏa nhiệt'],
    ],
  },
]

export const journeySteps = [
  {
    place: 'Dương Ổ',
    title: 'Bóc Vỏ & Giã Dó',
    desc: 'Vỏ cây dướng được tuyển lựa, ngâm vôi cẩn mật và giã dập hàng ngàn chày tạo độ dẻo dai.',
  },
  {
    place: 'Phong Khê',
    title: 'Đãi Liềm Seo',
    desc: 'Múc từng phên giấy trong bể nước mát, xếp chồng ép ráo và phơi khô trên vách đất nung.',
  },
  {
    place: 'Đông Hồ',
    title: 'Khắc Mộc Bản',
    desc: 'Tạc từng thớ gỗ thị dẻo dai, chuẩn bị từng bản khắc riêng cho từng tầng sắc màu tự nhiên.',
  },
  {
    place: 'Điệp & Sắc Son',
    title: 'In Ấn Cổ Truyền',
    desc: 'Nghiền vỏ sò biển quét lớp nền điệp óng ánh, ấn từng lớp son chu sa và mực đen rơm nếp.',
  },
  {
    place: 'LAMVI Atelier',
    title: 'Quang Học Hiện Đại',
    desc: 'Bảo tồn sợi giấy trong màng bảo vệ vi khí hậu và gắn kết hệ quang học LED phổ mặt trời.',
  },
  {
    place: 'Không Gian Việt',
    title: 'Ánh Sáng Thức Giấc',
    desc: 'Mỗi tác phẩm hiện diện như một mảnh linh hồn đất nước thắp sáng chốn dung thân thanh tao.',
  },
]

export const hotspots = [
  {
    label: 'Chú bé thổi sáo',
    position: 'top-[32%] left-[52%]',
    title: 'Tiếng Sáo & Hồn Nhiên Dân Tộc',
    desc: 'Chú bé chăn trâu cởi trần, đầu để chỏm, ngồi vắt vẻo trên lưng trâu say sưa thổi sáo. Không có yên cương trói buộc, đứa trẻ và con trâu hòa vào một. Đây là triết lý Đạo học thâm trầm về sự tự do, vô vi và an bình nội tại của người Việt qua ngàn năm dâu bể.',
  },
  {
    label: 'Con trâu làng',
    position: 'top-[62%] left-[45%]',
    title: 'Con Trâu Làng Nghểnh Cổ Thưởng Nhạc',
    desc: 'Hình tượng con trâu được nhân cách hóa với đôi mắt hiền từ, tai vểnh lên đón từng nhịp sáo. Con trâu không cúi đầu cặm cụi kéo cày mà ngẩng cao đầu thưởng thức nghệ thuật, thể hiện ước vọng về một cuộc sống no đủ, thư thái của nền văn minh lúa nước.',
  },
  {
    label: 'Lớp nền điệp',
    position: 'top-[18%] left-[25%]',
    title: 'Chất Điệp Óng Ánh Trên Giấy Dó',
    desc: 'Vỏ sò điệp biển được nghiền mịn thành bột, hòa cùng hồ nếp nấu chín rồi quét lên phên giấy Dó bằng chổi lá thông. Từng vệt chổi điệp tạo nên bề mặt gân lấp lánh như vảy cá dưới ánh nắng, lớp nền độc bản duy nhất trong lịch sử hội họa thế giới.',
  },
  {
    label: 'Con dấu triện son',
    position: 'bottom-[8%] right-[14%]',
    title: 'Triện Khắc Gỗ Mộc Bản Nguyên Gốc',
    desc: 'Con dấu son chu sa mang tên dòng họ nghệ nhân Đông Hồ gìn giữ mộc bản qua hơn ba thế kỷ. Ấn triện này xác lập tính nguyên bản và khẳng định tác phẩm được in thủ công bằng tay theo đúng phương pháp cổ truyền từ thế kỷ 17.',
  },
]

// Câu hỏi gợi ý: `short` là nhãn trên pill, `q` là câu hỏi đầy đủ
export const suggestedQuestions = [
  {
    q: 'Tại sao giấy Dó có thể bền bỉ hơn 500 năm không mục nát?',
    short: 'Tại sao giấy Dó bền bỉ hơn 500 năm không mục nát?',
  },
  {
    q: 'Ý nghĩa của sắc son chu sa và màu điệp trong tranh Đông Hồ?',
    short: 'Ý nghĩa của sắc son chu sa và màu điệp?',
  },
  {
    q: 'Cách bài trí đèn LAMVI để mang năng lượng an tĩnh vào gian phòng?',
    short: 'Cách bài trí đèn LAMVI mang năng lượng an tĩnh?',
  },
]

export const knowledgeBase = {
  [suggestedQuestions[0].q]: [
    'Độ bền huyền thoại của giấy Dó bắt nguồn từ cấu trúc xơ sợi dài tự nhiên của vỏ cây Dướng (Rhamnoneuron balansae). Khác với giấy công nghiệp hiện đại dùng axit để tẩy trắng bột gỗ, giấy Dó được xử lý hoàn toàn bằng nước vôi tôi tự nhiên, giữ độ pH trung tính vĩnh viễn (pH ≈ 7.0 - 7.5).',
    'Nhờ vậy, giấy không bị ố vàng, không giòn gãy và miễn nhiễm trước các loại mọt, nấm mốc. Các sắc phong triều Lê, triều Nguyễn lưu giữ hàng trăm năm tại các đình làng Việt Nam chính là minh chứng sống động nhất cho sức sống bất diệt của chất liệu này.',
  ],
  [suggestedQuestions[1].q]: [
    'Màu sắc trong tranh Đông Hồ hoàn toàn được chiết xuất từ thiên nhiên: Sắc đỏ son từ khoáng vật chu sa hoặc sỏi son núi Thiên Thai tượng trưng cho vận khí cát tường; màu trắng điệp óng ánh lấy từ vỏ sò biển thể hiện vẻ thanh khiết; màu vàng hoa hòe nở rộ biểu đạt ấm no; màu xanh rỉ đồng gợi nhắc đồng nội và màu đen làm từ tro than rơm nếp dẻo thơm.',
  ],
  [suggestedQuestions[2].q]: [
    "Đèn LAMVI thích hợp nhất khi được đặt tại góc thiền, bàn trà đạo, thư phòng hoặc lối vào sảnh (Huyền quan). Sợi giấy Dó có khả năng tán xạ ánh sáng đa hướng, xóa tan mọi bóng đổ gắt gỏng, mang lại cảm giác 'ấm trong như ngọc' giúp hạ nhịp tim và dẫn dắt tâm trí bước vào trạng thái tĩnh tại sau một ngày bận rộn.",
  ],
}

export const recipients = ['Tri Kỷ Đồng Điệu', 'Song Thân Tri Ân', 'Đối Tác Ngoại Giao', 'Tân Gia Điền Trạch']

export const occasions = [
  { value: 'Tết Nguyên Đán Ất Tỵ 2025', label: 'Tết Cổ Truyền — Khởi Sự Như Ý' },
  { value: 'Quà Tặng Ngoại Giao Văn Hóa', label: 'Ngoại Giao — Hồn Cốt Dân Tộc' },
  { value: 'Kỷ Niệm Ngày Tri Ân', label: 'Kỷ Niệm Tri Ân Đời Người' },
  { value: 'Khai Trương Hưng Gia Vượng Khí', label: 'Khai Trương Đại Cát' },
]

export const DEFAULT_INSCRIPTION = 'Tâm An Vạn Sự Tường • Ánh Sáng Tri Kỷ'

export const giftStats = [
  { value: '100%', label: 'Nguyên Liệu Tự Nhiên' },
  { value: 'CRI 98', label: 'Chỉ Số Hoàn Màu Bảo Tàng' },
  { value: '500+ Năm', label: 'Tuổi Thọ Sợi Giấy Dó' },
]

export const giftFeatures = [
  {
    icon: 'inventory_2',
    title: 'Hộp Lụa Khâu Tay',
    desc: 'Gỗ tần bì bọc lụa tơ tằm Vạn Phúc tự nhiên, bảo vệ đèn khỏi ẩm ướt và chấn động.',
  },
  {
    icon: 'verified',
    title: 'Chứng Thư Giấy Dó',
    desc: 'Đánh số thứ tự phiên bản giới hạn, dấu triện son chu sa của nghệ nhân làng nghề.',
  },
]

export const footerLinks = [
  {
    heading: 'Lưu Trữ Tác Phẩm',
    links: [
      { href: '#collection', label: 'Archive Folio' },
      { href: '#heritage', label: 'Craft Villages' },
      { href: '#story', label: 'Dó Paper Preservation' },
    ],
  },
  {
    heading: 'Liên Hệ & Khảo Cứu',
    links: [
      { href: '#bespoke', label: 'Inquiry Folio' },
      { href: '#inquire', label: 'Colophon & Terms' },
      { href: '#inquire', label: 'Press Inquiries' },
    ],
  },
]
