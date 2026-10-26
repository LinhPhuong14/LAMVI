// Hình minh hoạ thật (ảnh đèn tách nền, tranh Đông Hồ — public/images/folk, lamps) đặt cạnh tiêu đề trang con (D-123).
// Chỉ trang trí → aria-hidden; ẩn ở màn hình hẹp (CSS); chuyển động nhẹ bằng CSS, tắt khi giảm chuyển động.
const LAMPS = ['thu-hoach', 'tu-linh', 'phuc-loc-song-toan']
const FOLK = { vinh: 'vinh-quy-480', ong: 'ong-to-ba-nguyet-480', chuot: 'chuot-ruoc-den-480', giang: 'giang-hoc-do-480' }

export default function PageArt({ kind = 'lamps', folk = 'vinh' }) {
  if (kind === 'folk') {
    return (
      <div className="page-art page-art-folk" aria-hidden="true">
        <figure className="page-art-print">
          <img src={`/images/folk/${FOLK[folk] ?? FOLK.vinh}.webp`} alt="" width={300} loading="lazy" decoding="async" />
        </figure>
      </div>
    )
  }
  return (
    <div className="page-art page-art-lamps" aria-hidden="true">
      {LAMPS.map((n, i) => (
        <img key={n} className={`page-art-lamp l${i}`} src={`/images/lamps/${n}-cutout.webp`} alt="" width={90} height={210} loading="lazy" decoding="async" />
      ))}
    </div>
  )
}
