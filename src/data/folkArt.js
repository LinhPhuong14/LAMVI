// Ảnh tư liệu (tranh Đông Hồ, tranh giấy dó thế kỷ 18) từ Wikimedia Commons — phạm vi công cộng hoặc CC0.
// File sinh bằng script xử lý ảnh (cùng lúc với public/images/folk/CREDITS.md); tên, alt, chú thích nằm ở i18n: gallery.items.<id>.
// Không dùng các ảnh này như ảnh sản phẩm hay ảnh nghệ nhân LAMVI (design-rules §7.2).
export const FOLK_ART = [
  {
    id: 'chuot-ruoc-den',
    widths: [
      480,
      960
    ],
    width: 960,
    height: 686,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Chu%E1%BB%99t_r%C6%B0%E1%BB%9Bc_%C4%91%C3%A8n.JPG'
  },
  {
    id: 'vinh-hoa',
    widths: [
      330
    ],
    width: 330,
    height: 441,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Vinh_hoa.JPG'
  },
  {
    id: 'giang-hoc-do',
    widths: [
      480,
      960
    ],
    width: 960,
    height: 2216,
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Picture_of_giving_lecture,_Doc_Loi_temple,_Nghe_An_province,_late_18th_century,_Do_(poonah)_paper_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05107.JPG'
  },
  {
    id: 'dam-cuoi-chuot',
    widths: [
      480,
      960
    ],
    width: 960,
    height: 725,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:%C4%90%C3%A1m_c%C6%B0%E1%BB%9Bi_chu%E1%BB%99t.JPG'
  },
  {
    id: 'ca-chep',
    widths: [
      330
    ],
    width: 330,
    height: 513,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Tranh_%C4%90%C3%B4ng_H%E1%BB%93_-_C%C3%A1_ch%C3%A9p.jpg'
  },
  {
    id: 'phu-quy',
    widths: [
      330
    ],
    width: 330,
    height: 440,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Ph%C3%BA_qu%C3%BD.JPG'
  },
  {
    id: 'ong-to-ba-nguyet',
    widths: [
      480,
      960
    ],
    width: 960,
    height: 730,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Tranh_%C3%94ng_T%C6%A1_-_B%C3%A0_Nguy%E1%BB%87t_d%C3%A2n_gian_%C4%90%C3%B4ng_H%E1%BB%93.jpg'
  },
  {
    id: 'lon-am-duong',
    widths: [
      480
    ],
    width: 480,
    height: 344,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:L%E1%BB%A3n_%C3%A2m_d%C6%B0%C6%A1ng.JPG'
  },
  {
    id: 'muc-dong-tha-dieu',
    widths: [
      330
    ],
    width: 330,
    height: 463,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:M%E1%BB%A5c_%C4%91%E1%BB%93ng_th%E1%BA%A3_di%E1%BB%81u.JPG'
  },
  {
    id: 'vinh-quy',
    widths: [
      480,
      960
    ],
    width: 960,
    height: 2290,
    license: 'CC0',
    source: 'https://commons.wikimedia.org/wiki/File:Triumphant_return_of_a_civil_mandarin,_Doc_Loi_temple,_Nghe_An_province,_late_18th_century,_Do_(poonah)_paper_-_Vietnam_National_Museum_of_Fine_Arts_-_Hanoi,_Vietnam_-_DSC05111.JPG'
  },
  {
    id: 'van-tu-giay-do-1904',
    widths: [
      330
    ],
    width: 330,
    height: 488,
    license: 'Public domain',
    source: 'https://commons.wikimedia.org/wiki/File:Annam_Indochina_Revenue_Indochine_1904,_12_cents_on_Document_on_D%C3%B3_Paper_gi%E1%BA%A5y_D%C3%B3_01.jpg'
  }
]

export const folkSrc = (id, width) => `/images/folk/${id}-${width}.webp`
