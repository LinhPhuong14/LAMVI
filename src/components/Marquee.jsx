const ITEMS = [
  'GIẤY DÓ THỦ CÔNG',
  'KỂ CHUYỆN BẰNG ÁNH SÁNG',
  'LÀM QUÀ TẶNG Ý NGHĨA',
  'MỖI LỜI CHÚC, MỘT KỶ NIỆM',
  'LÀNG NGHỀ TRĂM NĂM',
]

export default function Marquee() {
  const line = ITEMS.join('  ✦  ') + '  ✦  '
  return (
    <div className="marquee">
      <div className="marquee-track">
        <span>{line}</span>
        <span aria-hidden="true">{line}</span>
      </div>
    </div>
  )
}
