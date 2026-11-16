import { useState } from 'react'
import { CRAFT_FILMS } from '../data/craftFilms.js'
import { pickFilmSrc } from '../lib/filmSrc.js'
import { letterText } from './i18n.js'

// D-158: cuối lá thư (sau khi chữ viết xong) — hai video LAMVI: tranh Đông Hồ trên đèn, làng giấy dó làm đèn.
// Xem ngay trong tờ thư (poster → bấm mới tải video), mỗi lúc một video; chữ theo ngôn ngữ thư (D-157).
const FILMS = [
  { key: 'culture', film: CRAFT_FILMS.dongho },
  { key: 'craft', film: CRAFT_FILMS.paper },
]

export default function LetterFilms({ T = letterText('vi') }) {
  const [playing, setPlaying] = useState(null)
  return (
    <section className="lw-films" aria-label={T.films.heading}>
      <p className="lw-films-heading">{T.films.heading}</p>
      <div className="lw-films-list">
        {FILMS.map(({ key, film }) => {
          const t = T.films[key]
          return (
            <figure key={key} className="lw-film">
              {playing === key ? (
                <video src={pickFilmSrc(film)} poster={film.poster} controls autoPlay playsInline preload="metadata" aria-label={t.title} />
              ) : (
                <button type="button" className="lw-film-poster" onClick={() => setPlaying(key)} style={{ backgroundImage: `url(${film.poster})` }} aria-label={`${T.films.play}: ${t.title}`}>
                  <span className="lw-film-play" aria-hidden="true">
                    ▶
                  </span>
                </button>
              )}
              <figcaption>
                <span>{t.kicker}</span>
                {t.title}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </section>
  )
}
