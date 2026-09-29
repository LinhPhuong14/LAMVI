// Ảnh tư liệu (tranh Đông Hồ, tranh giấy dó thế kỷ 18) từ Wikimedia Commons — phạm vi công cộng hoặc CC0.
// File sinh bằng script xử lý ảnh (cùng lúc với public/images/folk/CREDITS.md); tên, alt, chú thích nằm ở i18n: gallery.items.<id>.
// Không dùng các ảnh này như ảnh sản phẩm hay ảnh nghệ nhân MỘC (design-rules §7.2).
export const FOLK_ART = [
  {
    id: 'chuot-ruoc-den',
    width: 960,
    height: 686,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Chu%E1%BB%99t_r%C6%B0%E1%BB%9Bc_%C4%91%C3%A8n.JPG'
  },
  {
    id: 'dam-cuoi-chuot',
    width: 960,
    height: 725,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:%C4%90%C3%A1m_c%C6%B0%E1%BB%9Bi_chu%E1%BB%99t.JPG'
  }
]

export const folkSrc = (id, width) => `/images/folk/${id}-${width}.webp`
