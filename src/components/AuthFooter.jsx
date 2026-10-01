import { useI18n } from '../i18n/index.js'

// Chân trang tối giản cho các trang auth (D-80)
export default function AuthFooter() {
  const { t } = useI18n()
  return (
    <footer className="auth-foot">
      <span>© {new Date().getFullYear()} LAMVI</span>
      <span aria-hidden="true">·</span>
      <span>{t('auth.asideNote')}</span>
    </footer>
  )
}
