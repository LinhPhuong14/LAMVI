import { Link } from 'react-router-dom'
import { useI18n } from '../i18n/index.js'
import { useApi } from '../api/useApi.js'
import { Seal } from './Motifs'
import { Reveal } from './Reveal'
import { BrandHover } from './Effects'
import { group } from '../lib/motion.js'

export default function SiteFooter() {
  const { t, lang, path } = useI18n()
  const products = useApi('/products', lang)
  const home = (hash) => ({ pathname: path('/'), hash })

  return (
    <footer className="footer">
      <div className="footer-grid">
        <div className="footer-brand">
          <Seal className="seal-lg">LAMVI</Seal>
          <p>{t('footer.tagline')}</p>
          <div className="social-links">
            <a href="#" aria-label="Facebook">
              Facebook
            </a>
            <a href="#" aria-label="Instagram">
              Instagram
            </a>
            <a href="#" aria-label="TikTok">
              TikTok
            </a>
          </div>
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
          {/* G-10: chưa có trang chính sách đổi trả và theo dõi đơn */}
          <a href="#">{t('footer.returns')}</a>
          <a href="#">{t('footer.tracking')}</a>
        </div>
        <div className="footer-col footer-news">
          <h3>{t('footer.newsTitle')}</h3>
          <p>{t('footer.newsText')}</p>
          {/* G-11: newsletter chưa có backend — giữ hay bỏ form chờ PO (§30 P2) */}
          <form className="news-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder={t('footer.newsPlaceholder')}
              aria-label={t('footer.newsPlaceholder')}
              required
            />
            <button type="submit" className="btn btn-small">
              {t('footer.newsSubmit')}
            </button>
          </form>
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
