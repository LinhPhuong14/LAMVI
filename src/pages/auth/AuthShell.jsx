import { Link, useSearchParams } from 'react-router-dom'
import { Lotus, Seal } from '../../components/Motifs'
import { useI18n } from '../../i18n/index.js'
import Seo from '../../seo/Seo.jsx'

// Khung chung cho đăng nhập / đăng ký / quên / đặt lại mật khẩu (D-81, D-82).
// Sân khấu toàn màn hình: ảnh đèn lụa trên sông đêm làm nền, bên trái là lời dẫn kiểu tạp chí, bên phải là
// thẻ kính (Liquid Glass) chứa form. `tab` ('login' | 'register') hiện thanh chuyển đổi dạng viên thuốc.
export default function AuthShell({ eyebrow, title, lead, tab, children, footer }) {
  const { t, path } = useI18n()
  const [params] = useSearchParams()
  const next = params.get('next')
  const to = (p) => ({ pathname: path(p), search: next ? `?next=${encodeURIComponent(next)}` : '' })
  return (
    <section className="auth-stage">
      <Seo title={title} noindex />
      <div className="auth-stage-inner">
        <aside className="auth-aside" aria-hidden="true">
          {/* Ảnh riêng của trang auth (D-81), không dùng chung với landing */}
          <img
            className="auth-aside-photo"
            src="/images/auth/lantern-river-1024.webp"
            srcSet="/images/auth/lantern-river-640.webp 640w, /images/auth/lantern-river-1024.webp 1024w"
            sizes="100vw"
            width="1024"
            height="684"
            alt=""
            decoding="async"
          />
          <span className="auth-orb auth-orb-a" />
          <span className="auth-orb auth-orb-b" />
          <span className="auth-orb auth-orb-c" />
          <p className="auth-aside-note">
            <Lotus /> {t('auth.asideNote')}
          </p>
          <p className="auth-aside-title">
            <span>{t('auth.heroLine1')}</span>
            <em>{t('auth.heroLine2')}</em>
          </p>
          <p className="auth-aside-quote">{t('auth.heroLead')}</p>
          <Seal className="auth-aside-seal">LAMVI</Seal>
        </aside>
        <div className="auth-panel">
          {tab && (
            <nav className="auth-tabs" aria-label={t('auth.tabsLabel')}>
              <Link to={to('/login')} aria-current={tab === 'login' ? 'page' : undefined}>
                {t('auth.loginTitle')}
              </Link>
              <Link to={to('/register')} aria-current={tab === 'register' ? 'page' : undefined}>
                {t('auth.registerTitle')}
              </Link>
            </nav>
          )}
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
