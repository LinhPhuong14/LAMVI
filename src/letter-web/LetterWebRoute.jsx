import { lazy, Suspense, useSyncExternalStore } from 'react'
import { useSearchParams } from 'react-router-dom'
import { demos } from '../letter-room/data.js'
import { LAMPS, OCCASION_THEMES } from './themes.js'
import RotateGate from '../letters/RotateGate.jsx'
import { LETTER_FLOW } from '../letters/films.js'

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
  // D-154: ?business=1 — xem mẫu thư doanh nghiệp gửi tặng khách hàng (logo mẫu, không phải doanh nghiệp thật)
  const business = params.get('business') === '1'
  const letter = {
    ...demos[occasion],
    kind: 'text',
    lamp,
    postscript: occasion === 'thankYou' ? 'P.S. Nhớ uống đủ nước nhé.' : undefined,
    business: business ? { name: 'An Phát Holdings', logoUrl: '/images/brand/demo-business-logo.svg' } : null,
  }
  const keep = (extra) => setParams({ occasion, ...(lamp ? { lamp } : {}), ...(business ? { business: '1' } : {}), ...extra })
  const placeholder = (
    <main role="status" aria-busy="true" style={{ minHeight: '100svh', display: 'grid', placeItems: 'center', background: '#140d07', color: '#f6efe2' }}>
      Đang thắp đèn…
    </main>
  )
  if (!mounted) return placeholder
  return (
    // D-146: bản demo cũng bắt buộc xoay ngang trên điện thoại
    <RotateGate enabled={LETTER_FLOW.requireLandscape}>
      <Suspense fallback={placeholder}>
        <LetterWeb key={`${occasion}-${lamp}-${business}`} letter={letter}>
          <details className="lw-demo">
            <summary>Lời chúc mẫu</summary>
            <div>
              {Object.entries(OCCASION_THEMES).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={k === occasion} onClick={() => keep({ occasion: k })}>
                  {t.label}
                </button>
              ))}
            </div>
            <div>
              {Object.entries(LAMPS).map(([k, name]) => (
                <button key={k} type="button" aria-pressed={k === (lamp ?? 'tu-linh')} onClick={() => keep({ lamp: k })}>
                  {name}
                </button>
              ))}
            </div>
            <div>
              <button type="button" aria-pressed={business} onClick={() => setParams({ occasion, ...(lamp ? { lamp } : {}), ...(business ? {} : { business: '1' }) })}>
                Thư doanh nghiệp (logo)
              </button>
            </div>
          </details>
        </LetterWeb>
      </Suspense>
    </RotateGate>
  )
}
