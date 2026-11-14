import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HandwrittenTitle from '../letters/HandwrittenTitle.jsx'
import Envelope from './Envelope.jsx'
import Surprise from './Surprise.jsx'
import { reducedMotion } from './effects.js'
import { LAMPS, DEFAULT_LAMP, lampSrc, themeOf } from './themes.js'
import './web.css'

// dark → (bấm bật đèn) lighting → rising (phong bì trồi lên, xi bung, nắp mở) → unfolding (thư trồi khỏi phong bì) → reading
const NEXT = { lighting: 'rising', rising: 'unfolding', unfolding: 'reading' }
const TIMING = { lighting: 1000, rising: 1900, unfolding: 1200 }
const STATUS = {
  dark: 'Căn phòng còn tối. Bấm bật đèn để bắt đầu.',
  lighting: 'Đèn đang sáng dần.',
  rising: 'Một phong thư đang trồi lên.',
  unfolding: 'Lá thư đang mở ra.',
  reading: '',
}
// Đom đóm/bụi sáng quanh đèn — vị trí cố định theo chỉ số (không random để SSR/test ổn định)
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  delay: `${(i % 7) * 0.45}s`,
  size: `${2 + (i % 3)}px`,
}))

const hasValue = (v) => (Array.isArray(v) ? v.length > 0 : Boolean(v))

/**
 * Phong thư bản web 2D (D-140): trang sạch kiểu website tương tác — bấm bật đèn LAMVI, phong bì vintage
 * trồi lên và mở, lá thư trồi ra; tiêu đề viết tay (D-138), thân thư hiện dần từng chữ; điều bất ngờ theo dịp.
 * Cùng API với Phòng thư 3D: `letter` (hình dạng từ server), `afterLetter`, `preview`, `onExit`.
 *
 * @param {{ letter: object, afterLetter?: import('react').ReactNode, preview?: boolean, onExit?: () => void, children?: import('react').ReactNode }} p
 */
export default function LetterWeb({ letter, afterLetter, preview = false, onExit, children }) {
  const [reduced] = useState(reducedMotion)
  const [phase, setPhase] = useState('dark')
  const [titleDone, setTitleDone] = useState(false)
  const [revealAll, setRevealAll] = useState(reduced)
  const [surprise, setSurprise] = useState(false)
  const [playing, setPlaying] = useState(false)
  const readerRef = useRef(null)
  const surpriseBtn = useRef(null)
  const stageRef = useRef(null)
  const switchRef = useRef(null)
  const theme = themeOf(letter.occasion)
  const lamp = Object.hasOwn(LAMPS, letter.lamp) ? letter.lamp : DEFAULT_LAMP
  const d = letter.occasionData ?? {}

  const paragraphs = useMemo(() => {
    if (letter.kind !== 'text') return []
    const list = Array.isArray(letter.message) ? letter.message : String(letter.message ?? '').split(/\n\s*\n/)
    let i = 0
    return list.filter(Boolean).map((text) => ({ text, words: text.split(/\s+/).filter(Boolean).map((w) => ({ w, i: i++ })) }))
  }, [letter.kind, letter.message])
  const wordCount = paragraphs.reduce((n, p) => n + p.words.length, 0)
  // Hiệu ứng "text generate": thư dài mấy cũng xong trong ~4,5 giây
  const step = Math.min(0.07, 4.2 / Math.max(1, wordCount))

  useEffect(() => {
    const next = NEXT[phase]
    if (!next) return
    const t = setTimeout(() => setPhase(next), reduced ? 0 : TIMING[phase])
    return () => clearTimeout(t)
  }, [phase, reduced])

  useEffect(() => {
    if (phase !== 'reading') return
    // Không tự cuộn: lá thư nằm ngay dưới đèn, người nhận tự cuộn đọc
    readerRef.current?.focus({ preventScroll: true })
  }, [phase])

  // Sau khi tiêu đề viết xong, thân thư chạy hết thì bỏ nút "Hiện toàn bộ"
  useEffect(() => {
    if (!titleDone || revealAll) return
    const t = setTimeout(() => setRevealAll(true), (wordCount * step + 0.8) * 1000)
    return () => clearTimeout(t)
  }, [titleDone, revealAll, wordCount, step])

  // Nút bị gỡ sau khi bấm → đưa focus tới chỗ hợp lý để người dùng bàn phím không bị rơi về <body>
  const light = () => {
    if (phase !== 'dark') return
    setPhase('lighting')
    requestAnimationFrame(() => stageRef.current?.focus({ preventScroll: true }))
  }
  const restart = () => {
    setSurprise(false)
    setTitleDone(false)
    setRevealAll(reduced)
    setPlaying(false)
    setPhase('dark')
    requestAnimationFrame(() => switchRef.current?.focus())
  }
  const closeSurprise = useCallback(() => {
    setSurprise(false)
    requestAnimationFrame(() => surpriseBtn.current?.focus())
  }, [])

  const lit = phase !== 'dark'
  const showEnvelope = phase === 'rising' || phase === 'unfolding'
  const hasSurprise = Object.values(d).some(hasValue) || Boolean(letter.postscript)

  return (
    <main
      className={`lw-page lw-${phase}${lit ? ' is-lit' : ''}${preview ? ' is-preview' : ''}`}
      data-phase={phase}
      style={{ '--lw-paper': theme.paper, '--lw-accent': theme.accent, '--lw-accent2': theme.accent2, '--lw-seal': theme.seal }}
    >
      <div className="lw-bg" aria-hidden="true" />
      {/* Hai chùm spotlight chéo trôi chậm (theo "Spotlight" của Aceternity UI, đổi sang ánh vàng ấm) */}
      <div className="lw-spotlight" aria-hidden="true">
        <i />
        <i />
      </div>
      <header className="lw-top">
        <span className="lw-brand">LAMVI</span>
        <div className="lw-top-actions">
          {lit && (
            <button type="button" className="lw-chip" onClick={restart}>
              Xem lại từ đầu
            </button>
          )}
          {onExit && (
            <button type="button" className="lw-chip" onClick={onExit}>
              Đóng xem trước
            </button>
          )}
        </div>
      </header>
      <p className="lw-sr-only" role="status" aria-live="polite">
        {STATUS[phase]}
      </p>

      <section className="lw-stage" ref={stageRef} tabIndex={-1} aria-label="Đèn LAMVI và phong thư">
        <div className="lw-lamp-wrap">
          {/* Hiệu ứng "Lamp" (Aceternity UI): vạch sáng nở rộng, hai cánh ánh sáng hình nón đổ xuống, quầng mờ */}
          <div className="lw-beam" aria-hidden="true">
            <i className="lw-beam-l" />
            <i className="lw-beam-r" />
          </div>
          <div className="lw-halo" aria-hidden="true" />
          <div className="lw-sparks" aria-hidden="true">
            {SPARKS.map((s, i) => (
              <i key={i} style={{ left: s.left, top: s.top, animationDelay: s.delay, width: s.size, height: s.size }} />
            ))}
          </div>
          {/* Chạm vào đèn cũng bật được (chuột/cảm ứng); bàn phím dùng công tắc bên dưới */}
          <button type="button" className="lw-lamp" onClick={light} tabIndex={-1} aria-hidden="true" disabled={lit}>
            <img src={lampSrc(lamp)} alt="" decoding="async" />
          </button>
          <div className="lw-glow" aria-hidden="true" />
          <div className="lw-line" aria-hidden="true" />
        </div>
        <p className="lw-lamp-name">Đèn {LAMPS[lamp]}</p>

        {phase === 'dark' && (
          <button ref={switchRef} type="button" className="lw-switch" onClick={light}>
            <span className="lw-switch-track" aria-hidden="true">
              <span className="lw-switch-knob" />
            </span>
            Bật đèn
          </button>
        )}

        {showEnvelope && (
          <Envelope
            theme={theme}
            recipientName={letter.recipientName}
            senderName={letter.senderName}
            occasionLabel={theme.label}
            open={phase === 'unfolding'}
            out={phase === 'unfolding'}
          />
        )}
      </section>

      {phase === 'reading' && (
        <article className="lw-letter" ref={readerRef} tabIndex={-1} aria-label={`Lời chúc gửi ${letter.recipientName}`}>
          <img className="lw-letter-stamp" src={theme.stamp} alt="" aria-hidden="true" />
          <HandwrittenTitle as="h2" className="lw-dedication" text={`Gửi ${letter.recipientName},`} instant={reduced} onDone={() => setTitleDone(true)} />
          <div className={`lw-content${titleDone ? ' is-shown' : ''}`} inert={!titleDone} aria-hidden={!titleDone}>
            {letter.kind === 'text' ? (
              <>
                {titleDone && !revealAll && (
                  <button type="button" className="lw-skip" onClick={() => setRevealAll(true)}>
                    Hiện toàn bộ lá thư
                  </button>
                )}
                {paragraphs.map((p, pi) => (
                  <p key={pi} className={`lw-para${revealAll ? ' is-complete' : ''}`}>
                    <span className="lw-sr-only">{p.text}</span>
                    <span aria-hidden="true">
                      {p.words.map(({ w, i }) => (
                        <span key={i} className="lw-word" style={{ animationDelay: `${i * step}s` }}>
                          {w}{' '}
                        </span>
                      ))}
                    </span>
                  </p>
                ))}
              </>
            ) : (
              <div className="lw-video">
                {playing ? (
                  <video src={letter.videoUrl} poster={letter.posterUrl || undefined} controls autoPlay playsInline preload="metadata">
                    {letter.captionsUrl && <track kind="captions" src={letter.captionsUrl} srcLang="vi" label="Tiếng Việt" default />}
                  </video>
                ) : (
                  <button
                    type="button"
                    className="lw-video-poster"
                    onClick={() => setPlaying(true)}
                    style={letter.posterUrl ? { backgroundImage: `url(${letter.posterUrl})` } : undefined}
                  >
                    <span aria-hidden="true">▷</span> Xem lời nhắn
                  </button>
                )}
              </div>
            )}
            <div className="lw-signature">
              <span>Thương mến,</span>
              <strong>{letter.senderName}</strong>
            </div>
            {letter.postscript && <p className="lw-ps">{letter.postscript}</p>}
            {hasSurprise && (
              <button ref={surpriseBtn} type="button" className="lw-btn lw-btn-primary lw-surprise-trigger" onClick={() => setSurprise(true)}>
                <span aria-hidden="true">✧</span> {theme.surprise}
              </button>
            )}
            {afterLetter && <div className="lw-after">{afterLetter}</div>}
          </div>
        </article>
      )}

      {surprise && <Surprise letter={letter} theme={theme} onClose={closeSurprise} />}
      {children}
    </main>
  )
}
