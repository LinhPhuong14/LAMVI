/**
 * Phong bì vintage 2D (D-140): giấy theo dịp, viền thư máy bay, tem tranh Đông Hồ, dấu bưu điện,
 * xi niêm phong khắc chữ cái đầu tên người gửi. Thuần trang trí (aria-hidden) — trạng thái do LetterWeb báo.
 * Thứ tự lớp: mặt sau → nắp (khi đã mở) → tờ thư → túi trước → nắp (khi đóng) → xi, tem.
 *
 * @param {{ theme: object, recipientName: string, senderName: string, occasionLabel: string, open: boolean, out: boolean }} p
 */
export default function Envelope({ theme, recipientName, senderName, occasionLabel, open, out }) {
  const initial = [...(senderName || 'L').trim()][0]?.toUpperCase() || 'L'
  return (
    <div className={`lw-env${open ? ' is-open' : ''}${out ? ' is-out' : ''}`} aria-hidden="true">
      <div className="lw-env-back" />
      <div className="lw-env-sheet">
        <span className="lw-env-sheet-title">Gửi {recipientName},</span>
        <i />
        <i />
        <i />
      </div>
      <div className="lw-env-front">
        <div className="lw-env-stripes" />
        <span className="lw-env-to">
          Gửi <b>{recipientName}</b>
        </span>
      </div>
      <div className="lw-env-flap" />
      <div className="lw-env-seal">
        <span>{initial}</span>
      </div>
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
          <textPath href="#lw-pm-arc">LAMVI · {occasionLabel.toUpperCase()} · GIẤY DÓ ·</textPath>
        </text>
        <text x="50" y="55" textAnchor="middle" className="lw-env-pm-year">
          {new Date().getFullYear()}
        </text>
      </svg>
    </div>
  )
}
