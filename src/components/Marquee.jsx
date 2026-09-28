import { Lotus } from './Motifs'

const ITEMS = [
  'GIẤY DÓ THỦ CÔNG',
  'KỂ CHUYỆN BẰNG ÁNH SÁNG',
  'LÀM QUÀ TẶNG Ý NGHĨA',
  'MỖI LỜI CHÚC, MỘT KỶ NIỆM',
  'LÀNG NGHỀ TRĂM NĂM',
]

function Line({ hidden }) {
  return (
    <span className="marquee-line" aria-hidden={hidden || undefined}>
      {ITEMS.map((item) => (
        <span className="marquee-item" key={item}>
          {item}
          <Lotus />
        </span>
      ))}
    </span>
  )
}

export default function Marquee() {
  return (
    <div className="marquee">
      <div className="marquee-track">
        <Line />
        <Line hidden />
      </div>
    </div>
  )
}
