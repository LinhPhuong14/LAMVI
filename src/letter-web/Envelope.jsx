import { letterText } from './i18n.js'
/**
 * Phong bì vintage 2D (D-140): giấy theo dịp, viền thư máy bay, tem tranh Đông Hồ, dấu bưu điện,
 * xi niêm phong khắc chữ cái đầu tên người gửi. Thuần trang trí (aria-hidden) — trạng thái do LetterWeb báo.
 * Thứ tự lớp: mặt sau → nắp (khi đã mở) → tờ thư → túi trước → nắp (khi đóng) → xi, tem.
 *
 * @param {{ T?: object, theme: object, recipientName: string, senderName: string, business?: { name?: string, logoUrl?: string } | null, occasionLabel: string, open: boolean, out: boolean }} p
 */
export default function Envelope({ T = letterText('vi'), theme, recipientName, senderName, business = null, occasionLabel, open, out }) {
  const initial = [...(senderName || 'L').trim()][0]?.toUpperCase() || 'L'
  return (
    <div className={`lw-env${open ? ' is-open' : ''}${out ? ' is-out' : ''}`} aria-hidden="true">
      <div className="lw-env-back" />
      <div className="lw-env-sheet">
        <span className="lw-env-sheet-title">{T.dedication(recipientName)}</span>
        <i />
        <i />
        <i />
      </div>
      <div className="lw-env-front">
        <div className="lw-env-stripes" />
        <span className="lw-env-to">
          {T.envelopeTo} <b>{String(recipientName ?? '').trim() || T.recipientFallback}</b>
        </span>
      </div>
      <div className="lw-env-flap" />
      {/* D-154: thư doanh nghiệp — logo trên con dấu niêm phong, tên ở góc trên trái như thư công ty */}
      <div className={`lw-env-seal${business?.logoUrl ? ' has-logo' : ''}`}>{business?.logoUrl ? <img src={business.logoUrl} alt="" /> : <span>{initial}</span>}</div>
      {business?.name && <span className="lw-env-from">{business.name}</span>}
      <figure className="lw-env-stamp">
        <img src={theme.stamp} alt="" loading="eager" decoding="async" />
      </figure>
      <svg className="lw-env-postmark" viewBox="0 0 100 100">
        <defs>
          <path id="lw-pm-arc" d="M50 50 m-36 0 a36 36 0 1 1 72 0 a36 36 0 1 1 -72 0" />
        </defs>
        <circle cx="50" cy="50" r="44" />
        <circle cx="50" cy="50" r="28" />
        <text>
          <textPath href="#lw-pm-arc">LAMVI · {occasionLabel.toUpperCase()} · {T.postmark} ·</textPath>
        </text>
        <text x="50" y="55" textAnchor="middle" className="lw-env-pm-year">
          {new Date().getFullYear()}
        </text>
      </svg>
    </div>
  )
}
