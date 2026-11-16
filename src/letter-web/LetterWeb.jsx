import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HandwrittenTitle from '../letters/HandwrittenTitle.jsx'
import Envelope from './Envelope.jsx'
import Surprise from './Surprise.jsx'
import LetterFilms from './LetterFilms.jsx'
import LetterOutro from './LetterOutro.jsx'
import { reducedMotion } from './effects.js'
import { senderOf } from '../letters/names.js'
import { LAMPS, arcLayout, lampSrc, lampsOf, occasionKey, themeOf } from './themes.js'
import { LETTER_HTML_LANG, letterLang, letterText, localizeTheme } from './i18n.js'
// Font viết tay có bộ dấu tiếng Việt (OFL-1.1): Dancing Script cho lời đề tặng/chữ ký, Patrick Hand cho thân thư
import '@fontsource/dancing-script/latin-700.css'
import '@fontsource/dancing-script/vietnamese-700.css'
import '@fontsource/patrick-hand/latin-400.css'
import '@fontsource/patrick-hand/vietnamese-400.css'
import './web.css'

// dark → (bấm bật đèn) lighting → rising (phong bì trồi lên, xi bung, nắp mở) → unfolding (thư trồi khỏi phong bì) → reading
const NEXT = { lighting: 'rising', rising: 'unfolding', unfolding: 'reading' }
const TIMING = { lighting: 1000, rising: 1900, unfolding: 1200 }
const FILMS_DELAY = 5000
// D-162: bề rộng cụm đèn (bội số chiều cao) theo số đèn — các đèn chồng mép nhẹ lên nhau
const ARC_WIDTH = { 2: 1.0, 3: 1.3, 4: 1.65, 5: 2.05 }
// Đom đóm/bụi sáng quanh đèn — vị trí cố định theo chỉ số (không random để SSR/test ổn định)
const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  top: `${(i * 53 + 7) % 100}%`,
  delay: `${(i % 7) * 0.45}s`,
  size: `${2 + (i % 3)}px`,
}))
// Khi đọc thư: đốm sáng (bokeh) bay lên khắp trang + sparkle lấp lánh quanh tờ thư (theo "Sparkles" của Aceternity UI, CSS thuần)
const MOTES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 41 + 5) % 100}%`,
  size: `${3 + ((i * 7) % 8)}px`,
  dur: `${10 + ((i * 5) % 9)}s`,
  delay: `${-((i * 1.7) % 14).toFixed(1)}s`,
  sway: `${((i % 5) - 2) * 18}px`,
}))
const SPARKLES = Array.from({ length: 16 }, (_, i) => {
  // Rải quanh viền tờ thư: lần lượt cạnh trên, phải, dưới, trái
  const t = ((i * 29) % 100) / 100
  const side = i % 4
  const pos = [
    { left: `${t * 100}%`, top: '-10px' },
    { left: 'calc(100% + 4px)', top: `${t * 100}%` },
    { left: `${t * 100}%`, top: 'calc(100% + 4px)' },
    { left: '-14px', top: `${t * 100}%` },
  ][side]
  return { ...pos, size: `${10 + ((i * 5) % 11)}px`, delay: `${((i * 0.37) % 3).toFixed(2)}s`, dur: `${2.2 + ((i * 3) % 7) * 0.25}s` }
})

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
  // D-159: thẻ video LAMVI — 'wait' (chưa tới lúc) → 'shown' → 'closed'
  const [films, setFilms] = useState('wait')
  // D-161: outro câu chuyện LAMVI (màn lời dẫn → hai phim → màn kết)
  const [outro, setOutro] = useState(false)
  const readerRef = useRef(null)
  const surpriseBtn = useRef(null)
  const stageRef = useRef(null)
  const switchRef = useRef(null)
  // D-157: ngôn ngữ của thư (vi/en/zh) — chữ giao diện theo ngôn ngữ admin chọn
  const lang = letterLang(letter.lang)
  const T = letterText(lang)
  const theme = localizeTheme(themeOf(letter.occasion), occasionKey(letter.occasion), lang)
  // D-162: một đèn hoặc nhiều đèn xếp trên cung parabol (đèn đầu tiên ở giữa)
  const lamps = lampsOf(letter)
  const lamp = lamps[0]
  const multi = lamps.length > 1
  const layout = arcLayout(lamps)
  const d = letter.occasionData ?? {}
  // D-147: bỏ trống tên → "Gửi bạn,", chữ ký chỉ còn "Thương mến,"
  const sender = senderOf(letter)
  // D-154: thư doanh nghiệp — logo + tên (đồng thương hiệu với LAMVI)
  const biz = letter.business && (letter.business.logoUrl || letter.business.name) ? letter.business : null

  const paragraphs = useMemo(() => {
    if (letter.kind !== 'text') return []
    const list = Array.isArray(letter.message) ? letter.message : String(letter.message ?? '').split(/\n\s*\n/)
    let i = 0
    return list.map((t) => String(t).trim()).filter(Boolean).map((text) => ({ text, words: text.split(/\s+/).filter(Boolean).map((w) => ({ w, i: i++ })) }))
  }, [letter.kind, letter.message])
  // Handwriting reveal: mực chảy trái → phải từng chữ, nhịp theo số ký tự (như đang viết);
  // thư dài mấy cũng viết xong trong ~7 giây, có nút "Hiện toàn bộ" để bỏ qua
  const { timing, total } = useMemo(() => {
    // Ngân sách tính cả nhịp ngắt giữa các đoạn (6 ký tự mỗi đoạn)
    const units = paragraphs.reduce((n, p) => n + 6 + p.words.reduce((m, { w }) => m + [...w].length + 1, 0), 0)
    // Trừ 0,2 s cho nét cuối (thời lượng tối thiểu của một chữ) để chữ cuối viết xong trong 7 s
    const perChar = Math.min(0.055, 6.8 / Math.max(1, units))
    const timing = []
    let at = 0
    for (const p of paragraphs) {
      for (const { w, i } of p.words) {
        const len = [...w].length
        timing[i] = { delay: at, dur: Math.min(0.9, Math.max(0.2, len * perChar * 1.6), Math.max(0.2, 7 - at)) }
        at += (len + 1) * perChar
      }
      at += perChar * 6 // ngắt hơi giữa hai đoạn
    }
    return { timing, total: at }
  }, [paragraphs])

  // Chữ Trung viết tay: chỉ tải font Ma Shan Zheng (OFL-1.1, chia nhỏ theo unicode-range) cho thư tiếng Trung
  useEffect(() => {
    if (lang === 'zh') import('@fontsource/ma-shan-zheng/400.css').catch(() => {})
  }, [lang])

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
    const t = setTimeout(() => setRevealAll(true), (total + 1) * 1000)
    return () => clearTimeout(t)
  }, [titleDone, revealAll, total])

  // D-159: thư viết xong (thư video: vừa mở ra) → đợi 5 giây rồi mới hiện thẻ "Xem tiếp câu chuyện của LAMVI"
  const letterDone = phase === 'reading' && titleDone && (revealAll || letter.kind !== 'text')
  useEffect(() => {
    if (!letterDone || films !== 'wait') return
    const t = setTimeout(() => setFilms('shown'), FILMS_DELAY)
    return () => clearTimeout(t)
  }, [letterDone, films])

  // D-155: tờ thư tự cuộn theo dòng chữ đang hiện ra (handwriting reveal) để người nhận không phải tự kéo.
  // Người nhận tự cuộn/chạm/bấm phím trong tờ thư → dừng tự cuộn (tôn trọng thao tác của họ).
  useEffect(() => {
    if (!titleDone || revealAll || reduced || letter.kind !== 'text') return
    const box = readerRef.current
    if (!box) return
    let manual = false
    const stop = () => {
      manual = true
    }
    box.addEventListener('wheel', stop, { passive: true })
    box.addEventListener('touchmove', stop, { passive: true })
    box.addEventListener('keydown', stop)
    const start = performance.now()
    const id = setInterval(() => {
      if (manual) return
      const elapsed = (performance.now() - start) / 1000
      // chữ cuối cùng đã bắt đầu viết
      let lo = 0
      let hi = timing.length - 1
      let idx = -1
      while (lo <= hi) {
        const mid = (lo + hi) >> 1
        if (timing[mid].delay <= elapsed) {
          idx = mid
          lo = mid + 1
        } else hi = mid - 1
      }
      if (idx < 0) return
      const word = box.querySelector(`.lw-word[data-i="${idx}"]`)
      if (!word) return
      const wr = word.getBoundingClientRect()
      const br = box.getBoundingClientRect()
      // Giữ dòng đang viết ở khoảng 60% chiều cao khung; chỉ cuộn xuống
      const target = box.scrollTop + (wr.bottom - br.top) - box.clientHeight * 0.6
      if (target > box.scrollTop + 4) box.scrollTo({ top: target, behavior: 'smooth' })
    }, 250)
    return () => {
      clearInterval(id)
      box.removeEventListener('wheel', stop)
      box.removeEventListener('touchmove', stop)
      box.removeEventListener('keydown', stop)
    }
  }, [titleDone, revealAll, reduced, letter.kind, timing])

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
    setFilms('wait')
    setOutro(false)
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
      lang={LETTER_HTML_LANG[lang]}
      style={{ '--lw-paper': theme.paper, '--lw-accent': theme.accent, '--lw-accent2': theme.accent2, '--lw-seal': theme.seal }}
    >
      <div className="lw-bg" aria-hidden="true" />
      {/* Hai chùm spotlight chéo trôi chậm (theo "Spotlight" của Aceternity UI, đổi sang ánh vàng ấm) */}
      <div className="lw-spotlight" aria-hidden="true">
        <i />
        <i />
      </div>
      {/* D-161: outro mở → phần trang phía sau inert (không Tab ra ngoài hộp thoại) */}
      <header className="lw-top" inert={outro || undefined}>
        <span className="lw-brands">
          <span className="lw-brand">LAMVI</span>
        </span>
        <div className="lw-top-actions">
          {lit && (
            <button type="button" className="lw-chip" onClick={restart}>
              {T.replay}
            </button>
          )}
          {onExit && (
            <button type="button" className="lw-chip" onClick={onExit}>
              {T.closePreview}
            </button>
          )}
        </div>
      </header>
      <p className="lw-sr-only" role="status" aria-live="polite">
        {T.status[phase]}
      </p>

      <section className="lw-stage" ref={stageRef} tabIndex={-1} aria-label={T.stage} inert={outro || undefined}>
        <div className={`lw-lamp-wrap${multi ? ' is-multi' : ''}`} style={multi ? { '--wf': ARC_WIDTH[lamps.length] } : undefined}>
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
          {layout.map(({ slug, t, depth }) => (
            <button
              key={slug}
              type="button"
              className="lw-lamp"
              onClick={light}
              tabIndex={-1}
              aria-hidden="true"
              disabled={lit}
              // Nhiều đèn: vị trí trên cung (t), đèn giữa đứng trước, thắp lần lượt từ giữa ra hai bên
              style={multi ? { '--t': t, '--t2': t * t, '--d': `${depth * 0.35}s`, zIndex: 10 - depth } : undefined}
            >
              <img src={lampSrc(slug)} alt="" decoding="async" />
            </button>
          ))}
          <div className="lw-glow" aria-hidden="true" />
          <div className="lw-line" aria-hidden="true" />
        </div>
        <p className="lw-lamp-name">{multi ? lamps.map((l) => LAMPS[l]).join(' · ') : T.lampName(LAMPS[lamp])}</p>

        {phase === 'dark' && (
          // D-144: lời mời bật đèn (chữ viết tay, sáng nhẹ)
          <p className="lw-invite" aria-hidden="true">
            {T.invite}
          </p>
        )}
        {phase === 'dark' && (
          <button ref={switchRef} type="button" className="lw-switch" onClick={light}>
            <span className="lw-switch-track" aria-hidden="true">
              <span className="lw-switch-knob" />
            </span>
            {T.lightOn}
          </button>
        )}

        {showEnvelope && (
          <Envelope
            theme={theme}
            recipientName={letter.recipientName}
            senderName={letter.senderName}
            business={biz}
            T={T}
            occasionLabel={theme.label}
            open={phase === 'unfolding'}
            out={phase === 'unfolding'}
          />
        )}
      </section>

      {phase === 'reading' && !reduced && (
        <div className="lw-motes" aria-hidden="true">
          {MOTES.map((m, i) => (
            <i key={i} style={{ left: m.left, width: m.size, height: m.size, animationDuration: m.dur, animationDelay: m.delay, '--sway': m.sway }} />
          ))}
        </div>
      )}

      {phase === 'reading' && (
        // D-149: khung giữ tờ thư vừa một màn hình — tờ thư cuộn bên trong, sparkle nằm ở khung (không bị cắt)
        <div className="lw-letter-frame" inert={outro || undefined}>
          {!reduced && (
            <div className="lw-letter-sparkles" aria-hidden="true">
              {SPARKLES.map((s, i) => (
                <i key={i} style={{ left: s.left, top: s.top, width: s.size, height: s.size, animationDelay: s.delay, animationDuration: s.dur }} />
              ))}
            </div>
          )}
          <article className="lw-letter" ref={readerRef} tabIndex={-1} aria-label={T.letterLabel(letter.recipientName)}>
            <img className="lw-letter-stamp" src={theme.stamp} alt="" aria-hidden="true" />
            {biz && (
              <header className="lw-letterhead">
                {biz.logoUrl && <img src={biz.logoUrl} alt={biz.name || T.logoAlt} />}
                {biz.name && !biz.logoUrl && <span>{biz.name}</span>}
              </header>
            )}
            <HandwrittenTitle as="h2" className="lw-dedication" text={T.dedication(letter.recipientName)} instant={reduced} onDone={() => setTitleDone(true)} />
            <div className={`lw-content${titleDone ? ' is-shown' : ''}`} inert={!titleDone} aria-hidden={!titleDone}>
              {letter.kind === 'text' ? (
                <>
                  {titleDone && !revealAll && (
                    <button type="button" className="lw-skip" onClick={() => setRevealAll(true)}>
                      {T.revealAll}
                    </button>
                  )}
                  {paragraphs.map((p, pi) => (
                    <p key={pi} className={`lw-para${revealAll ? ' is-complete' : ''}`}>
                      <span className="lw-sr-only">{p.text}</span>
                      <span aria-hidden="true">
                        {p.words.map(({ w, i }) => (
                          <span key={i} data-i={i} className="lw-word" style={{ animationDelay: `${timing[i].delay.toFixed(2)}s`, animationDuration: `${timing[i].dur.toFixed(2)}s` }}>
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
                      {letter.captionsUrl && <track kind="captions" src={letter.captionsUrl} srcLang={lang} label={T.captions} default />}
                    </video>
                  ) : (
                    <button
                      type="button"
                      className="lw-video-poster"
                      onClick={() => setPlaying(true)}
                      style={letter.posterUrl ? { backgroundImage: `url(${letter.posterUrl})` } : undefined}
                    >
                      <span aria-hidden="true">▷</span> {T.watch}
                    </button>
                  )}
                </div>
              )}
              <div className="lw-signature">
                {/* D-163: lời kết thân mật (mặc định) hoặc trang trọng */}
                <span>{letter.closing === 'formal' ? T.regardsFormal : T.regards}</span>
                {sender && <strong>{sender}</strong>}
                {biz?.name && (sender ? <em className="lw-signature-org">{biz.name}</em> : <strong>{biz.name}</strong>)}
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
        </div>
      )}

      {films === 'shown' && !surprise && !outro && (
        <LetterFilms
          T={T}
          onOpen={() => {
            // Thư video đang phát → tạm dừng, tránh hai tiếng chồng nhau
            readerRef.current?.querySelector('.lw-video video')?.pause?.()
            setFilms('closed')
            setOutro(true)
          }}
          onClose={() => {
            setFilms('closed')
            requestAnimationFrame(() => readerRef.current?.focus({ preventScroll: true }))
          }}
        />
      )}
      {outro && (
        <LetterOutro
          T={T}
          lang={lang}
          lamp={lamp}
          onClose={() => {
            setOutro(false)
            requestAnimationFrame(() => readerRef.current?.focus({ preventScroll: true }))
          }}
        />
      )}
      {surprise && <Surprise letter={letter} theme={theme} T={T} onClose={closeSurprise} />}
      {children}
    </main>
  )
}
