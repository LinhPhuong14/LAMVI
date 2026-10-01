import { Link } from 'react-router-dom'
import { Lotus, Seal } from '../../components/Motifs'
import { useI18n } from '../../i18n/index.js'
import Seo from '../../seo/Seo.jsx'

// Khung chung cho đăng nhập / đăng ký / quên / đặt lại mật khẩu: thiếp thư hai nửa.
// Nửa trái là mảng chàm đêm (ấn son, câu ngắn, đèn trời); nửa phải là form trên giấy điệp.
export default function AuthShell({ eyebrow, title, lead, children, footer }) {
  const { t, path } = useI18n()
  return (
    <section className="page-section auth-shell">
      <Seo title={title} noindex />
      <div className="auth-card">
        <aside className="auth-aside" aria-hidden="true">
          <Link to={path('/')} className="auth-aside-mark" tabIndex={-1}>
            <Seal>LAMVI</Seal>
          </Link>
          <p className="auth-aside-quote">{t('auth.asideQuote')}</p>
          <p className="auth-aside-note">
            <Lotus /> {t('auth.asideNote')}
          </p>
        </aside>
        <div className="auth-main">
          {eyebrow && (
            <p className="eyebrow auth-eyebrow">
              <Lotus /> {eyebrow}
            </p>
          )}
          <h1 className="page-title">{title}</h1>
          {lead && <p className="auth-lead">{lead}</p>}
          {children}
          {footer && <div className="auth-footer">{footer}</div>}
        </div>
      </div>
    </section>
  )
}
