import { lazy, Suspense, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { demos } from '../letter-room/data.js'
import { LAMPS, OCCASION_THEMES } from './themes.js'

const LetterWeb = lazy(() => import('./LetterWeb.jsx'))
const subscribe = () => () => {}

/** Bản demo phong thư web 2D (D-140) ở /phong-thu/web — bảy lời chúc mẫu, đổi đèn bằng ?lamp=. */
export default function LetterWebRoute() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
  const [params, setParams] = useSearchParams()
  const occasion = Object.hasOwn(demos, params.get('occasion')) ? params.get('occasion') : 'birthday'
  const lamp = Object.hasOwn(LAMPS, params.get('lamp')) ? params.get('lamp') : undefined
  const letter = { ...demos[occasion], kind: 'text', lamp, postscript: occasion === 'thankYou' ? 'P.S. Nhớ uống đủ nước nhé.' : undefined }
  const placeholder = (
    <main role="status" aria-busy="true" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#140d07', color: '#f6efe2' }}>
      Đang thắp đèn…
    </main>
  )
  if (!mounted) return placeholder
  return (
    <Suspense fallback={placeholder}>
      <LetterWeb key={`${occasion}-${lamp}`} letter={letter}>
        <details className="lw-demo">
          <summary>Lời chúc mẫu</summary>
          <div>
            {Object.entries(OCCASION_THEMES).map(([k, t]) => (
              <button key={k} type="button" aria-pressed={k === occasion} onClick={() => setParams({ occasion: k, ...(lamp ? { lamp } : {}) })}>
                {t.label}
              </button>
            ))}
          </div>
          <div>
            {Object.entries(LAMPS).map(([k, name]) => (
              <button key={k} type="button" aria-pressed={k === (lamp ?? 'tu-linh')} onClick={() => setParams({ occasion, lamp: k })}>
                {name}
              </button>
            ))}
          </div>
        </details>
      </LetterWeb>
    </Suspense>
  )
}
