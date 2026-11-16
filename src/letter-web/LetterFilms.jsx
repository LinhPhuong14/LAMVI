import { OUTRO_FILMS } from './outroFilms.js'
import { letterText } from './i18n.js'

/**
 * D-159, D-161: thẻ mời nhỏ "Xem tiếp câu chuyện của LAMVI" — hiện 5 giây sau khi thư viết xong,
 * không che lá thư. Bấm "Xem câu chuyện" → outro (màn lời dẫn → hai phim → màn kết, LetterOutro).
 */
export default function LetterFilms({ T = letterText('vi'), onOpen, onClose }) {
  const t = T.films
  return (
    <aside className="lw-films" aria-label={t.heading}>
      <div className="lw-films-thumbs" aria-hidden="true">
        {OUTRO_FILMS.map(({ key, film }) => (
          <img key={key} src={film.poster} alt="" decoding="async" />
        ))}
        <span className="lw-films-thumb-play">▶</span>
      </div>
      <div className="lw-films-body">
        <p className="lw-films-heading">{t.heading}</p>
        <p className="lw-films-sub">{t.teaserSub}</p>
        <button type="button" className="lw-btn lw-btn-primary lw-films-cta" onClick={onOpen}>
          <span aria-hidden="true">▶</span> {t.cta}
        </button>
      </div>
      <button type="button" className="lw-films-close" onClick={onClose} aria-label={t.close}>
        ×
      </button>
    </aside>
  )
}
