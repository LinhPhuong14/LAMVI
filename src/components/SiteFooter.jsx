import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import { Seal } from './Motifs'
import { Reveal } from './Reveal'
import { BrandHover } from './Effects'
import { group } from '../lib/motion.js'
import { openConsent } from '../analytics/consent.js'

export default function SiteFooter() {
  const { t, lang, path } = useI18n()
  const products = useApi('/products', lang)
  const site = useApi('/site', lang)
  const business = site.status === 'ok' ? site.data : null
  const home = (hash) => ({ pathname: path('/'), hash })

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Seal className="seal-lg">LAMVI</Seal>
          <p>{t('footer.tagline')}</p>
          {business?.legalName && <p>{business.legalName}</p>}
          {business?.registration && <p>{business.registration}</p>}
          {business?.address && <p>{business.address}</p>}
          {business?.moitUrl && (
            <p>
              <a href={business.moitUrl} target="_blank" rel="noopener noreferrer">
                {t('footer.moit')}
              </a>
            </p>
          )}
          {business?.social?.length > 0 && <div className="social-links">
            {business.social.map(({ label, url }) => <a key={label} href={url} target="_blank" rel="noopener noreferrer">{label}</a>)}
          </div>}
        </div>
        <div className="footer-col">
          <h3>{t('footer.products')}</h3>
          {products.status === 'ok' &&
            products.data.items.map((p) => (
              <Link key={p.slug} to={path(`/products/${p.slug}`)}>
                {p.name}
              </Link>
            ))}
        </div>
        <div className="footer-col">
          <h3>{t('footer.support')}</h3>
          <Link to={home('#faq')}>{t('footer.faq')}</Link>
          <Link to={path('/contact')}>{t('footer.contact')}</Link>
          <Link to={path('/returns')}>{t('footer.returns')}</Link>
          <Link to={path('/shipping')}>{t('footer.shipping')}</Link>
          <Link to={path('/payment')}>{t('footer.payment')}</Link>
          <Link to={path('/terms')}>{t('footer.terms')}</Link>
          <Link to={path('/privacy')}>{t('footer.privacy')}</Link>
          <button type="button" className="link-button" onClick={openConsent}>{t('consent.settings')}</button>
          <Link to={path('/account?tab=orders')}>{t('footer.tracking')}</Link>
          {business?.supportEmail && <a href={`mailto:${business.supportEmail}`}>{business.supportEmail}</a>}
          {business?.phone && <a href={`tel:${business.phone.replace(/[^0-9+]/g, '')}`}>{business.phone}</a>}
          {business?.zalo && <a href={business.zalo} target="_blank" rel="noopener noreferrer">Zalo</a>}
          {business?.hours && <p>{business.hours}</p>}
        </div>
        <div className="footer-col footer-news">
          <h3>{t('footer.newsTitle')}</h3>
          <p>{t('footer.newsUnavailable')}</p>
          {/* Feedback 08/10, mục 13: chưa có đăng ký nhận tin → bỏ form, dẫn tới kênh mạng xã hội */}
          {business?.social?.length > 0 && (
            <p className="footer-social">
              {business.social.map((x) => (
                <a key={x.label} href={x.url} target="_blank" rel="noopener noreferrer">{x.label}</a>
              ))}
            </p>
          )}
        </div>
      </div>
      <Reveal className="footer-brandmark" variants={group} margin="0px">
        <BrandHover text="LAMVI" />
      </Reveal>
      <div className="footer-bottom">
        <span>{t('footer.copyright')}</span>
      </div>
    </footer>
  )
}
