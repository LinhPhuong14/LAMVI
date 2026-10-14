import { Link } from 'react-router-dom'
import ProductImage from './ProductImage.jsx'
import { useI18n } from '../i18n/index.js'
import { storyParagraphs } from '../lib/story.js'

// Câu chuyện của một mẫu đèn — hiện ở trang lời chúc (QR trên thiệp cảm ơn) trước lời chúc của người tặng
export default function LampStory({ lamp }) {
  const { t, path } = useI18n()
  const paragraphs = storyParagraphs(lamp.story)
  return (
    <article className="lamp-story" aria-label={lamp.name}>
      <div className="lamp-story-art">
        <ProductImage image={lamp.image} size={160} tone={lamp.tone ?? 'amber'} name={lamp.name} />
      </div>
      <div className="lamp-story-body">
        <span className="eyebrow">{t('lampStory.eyebrow')}</span>
        <h2>{lamp.name}</h2>
        {paragraphs.length > 0 ? paragraphs.map((p, i) => <p key={i}>{p}</p>) : lamp.description && <p>{lamp.description}</p>}
        <Link to={path(`/products/${encodeURIComponent(lamp.slug)}`)} className="btn btn-ghost">
          {t('lampStory.view')}
        </Link>
      </div>
    </article>
  )
}
