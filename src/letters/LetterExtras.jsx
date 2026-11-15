import { useRef, useState } from 'react'
import { FilmOverlay } from './IntroFilms.jsx'
import { filmByKey } from './films.js'

/** D-138: cuối lá thư — xem lại cách làm đèn và lịch sử văn hoá. */
export default function LetterExtras() {
  const [open, setOpen] = useState(null)
  const opener = useRef(null)
  const show = (key) => (e) => {
    opener.current = e.currentTarget
    setOpen(key)
  }
  // Đóng khung video → trả focus về nút đã mở
  const close = () => {
    setOpen(null)
    requestAnimationFrame(() => opener.current?.focus())
  }
  return (
    <div className="lt-after">
      <button type="button" className="lt-btn" onClick={show('craft')}>
        Xem lại cách làm đèn
      </button>
      <button type="button" className="lt-btn" onClick={show('culture')}>
        Lịch sử văn hoá
      </button>
      {open && (
        <FilmOverlay item={filmByKey(open)} onClose={close}>
          {open === 'culture' && (
            <a href="/welcome" target="_blank" rel="noopener">
              Đọc thêm truyện kể về giấy dó và tranh Đông Hồ
            </a>
          )}
        </FilmOverlay>
      )}
    </div>
  )
}
