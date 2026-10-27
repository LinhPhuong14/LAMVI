import { useI18n } from '../i18n/index.js'

// Khối đầu trang chủ: ảnh cover fanpage chính thức của LAMVI, full chiều rộng, đúng tỉ lệ 2,09:1 (D-127).
// Ảnh đã có sẵn logo và câu giới thiệu nên không chồng chữ lên; chỉ có chuyển động zoom rất chậm.
export default function IntroCover() {
  const { t } = useI18n()
  return (
    <section className="intro-cover" aria-label={t('hero.coverAlt')}>
      <img
        src="/images/brand/cover-1672.webp"
        srcSet="/images/brand/cover-800.webp 800w, /images/brand/cover-1280.webp 1280w, /images/brand/cover-1672.webp 1672w"
        sizes="100vw"
        alt={t('hero.coverAlt')}
        width={1672}
        height={800}
        fetchPriority="high"
        decoding="async"
      />
    </section>
  )
}
