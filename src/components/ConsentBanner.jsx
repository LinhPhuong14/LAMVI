import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { isEnabled } from '../analytics/index.js'
import { CONSENT_EVENT, getConsent, restoreConsent, setConsent } from '../analytics/consent.js'

// Banner xin đồng ý phân tích. Chỉ hiện khi GA được nhúng và khách chưa chọn (hoặc mở lại từ chân trang).
export default function ConsentBanner() {
  const { t, path } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    restoreConsent()
    // GA nhúng bởi script ngoài React → kiểm sau khi mount, không setState đồng bộ trong effect
    const timer = setTimeout(() => isEnabled() && getConsent() === null && setOpen(true), 0)
    const reopen = () => setOpen(true)
    window.addEventListener(CONSENT_EVENT, reopen)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(CONSENT_EVENT, reopen)
    }
  }, [])

  if (!open) return null
  const choose = (granted) => {
    setConsent(granted)
    setOpen(false)
  }
  return (
    <section className="consent-banner" role="dialog" aria-label={t('consent.title')}>
      <p>
        <strong>{t('consent.title')}</strong> {t('consent.body')}{' '}
        <Link to={path('/privacy')}>{t('consent.more')}</Link>
      </p>
      <div className="consent-actions">
        <button type="button" className="btn btn-small" onClick={() => choose(false)}>
          {t('consent.decline')}
        </button>
        <button type="button" className="btn btn-small btn-primary" onClick={() => choose(true)}>
          {t('consent.accept')}
        </button>
      </div>
    </section>
  )
}
