import TitleInk from "./TitleInk";
import LamviWishes from "./LamviWishes";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function LetterReader({
  letter,
  onSurprise,
  getPaperRect,
  active = true,
  afterLetter,
}) {
  const ref = useRef(null),
    video = useRef(null);
  const reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [revealAll, setRevealAll] = useState(reduced);
  const [scrollHint, setScrollHint] = useState(false);
  const [hintReady, setHintReady] = useState(reduced);
  const paragraphs = useMemo(() => {
    if (letter.kind !== "text") return [];
    const segmenter = typeof Intl.Segmenter === "function" ? new Intl.Segmenter("vi", { granularity: "grapheme" }) : null;
    let index = 0;
    return (Array.isArray(letter.message) ? letter.message : letter.message.split("\n\n"))
      .map(text => ({ text, words: text.split(/(\s+)/).map(word => ({
        space: /^\s+$/.test(word), text: word,
        glyphs: (segmenter ? Array.from(segmenter.segment(word), ({segment}) => segment) : Array.from(word.normalize("NFC"))).map(segment => ({text: segment, index: index++})),
      })) }));
  }, [letter.kind, letter.message]);
  const glyphCount = paragraphs.reduce((sum, p) => sum + p.words.reduce((n, w) => n + w.glyphs.length, 0), 0);
  // Even a long letter finishes in six seconds; controls never wait for the ink.
  const inkStep = Math.min(.024, 5.7 / Math.max(1, glyphCount));
  const [written, setWritten] = useState(reduced),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(false),
    [ended, setEnded] = useState(false);
  const markWritten = useCallback(() => setWritten(true), []);
  useEffect(() => {
    if (!written || !active) return;
    const timer = setTimeout(() => setHintReady(true), 550);
    return () => clearTimeout(timer);
  }, [written, active]);
  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  useEffect(() => {
    const el = ref.current;
    el?.focus({ preventScroll: true });
    function grid() {
      requestAnimationFrame(() => {if(el) setScrollHint(el.scrollHeight > el.clientHeight + 32 && el.scrollTop + el.clientHeight < el.scrollHeight - 32);});
      el?.style.setProperty(
        "--paper-grid",
        `${el.getBoundingClientRect().width / 32}px`,
      );
    }
    grid();
    const observer =
      typeof ResizeObserver === "function" ? new ResizeObserver(grid) : null;
    observer?.observe(el);
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const origin = getPaperRect?.(),
      bounds = el.getBoundingClientRect();
    if (!reduced && origin && el.animate) {
      const scale = origin.width / bounds.width;
      el.animate(
        [
          {
            transform: `translate(${origin.left - bounds.left}px,${origin.top - bounds.top}px) scale(${scale})`,
            height: `${origin.height / Math.max(0.01, scale)}px`,
            opacity: 1,
          },
          {
            transform: "translate(0,0) scale(1)",
            height: `${bounds.height}px`,
            opacity: 1,
          },
        ],
        {
          duration: 420,
          easing: "cubic-bezier(.2,.7,.2,1)",
          fill: "backwards",
        },
      );
    }

    return () => {
      observer?.disconnect();
    };
  }, [getPaperRect]);
  useEffect(() => {
    if (reduced || !written || revealAll || !active) return;
    const timer = setTimeout(() => setRevealAll(true), 6000);
    return () => clearTimeout(timer);
  }, [written, revealAll, active, reduced]);
  const surpriseText = {
    birthday: "Mở tấm thiệp nhỏ",
    anniversary: "Mở kỷ niệm của chúng mình",
    justBecause: "Có một điều nhỏ nữa",
    thankYou: "Lật góc thư",
    milestone: "Đóng dấu cột mốc",
    encouragement: "Mở khi cần",
    longDistance: "Mở hai ô cửa",
  }[letter.occasion];
  return (
    <article
      className="lr-reader"
      ref={ref}
      onScroll={e => {const el=e.currentTarget;setScrollHint(el.scrollTop + el.clientHeight < el.scrollHeight - 32);}}
      tabIndex={-1}
      aria-label={`Lời chúc gửi ${letter.recipientName}`}
    >
      <div className="lr-letter-meta">
        MỘT LỜI THƯƠNG ĐƯỢC GIỮ LẠI<span aria-hidden="true">✧</span>
      </div>
      <TitleInk name={letter.recipientName} active={active} reduced={reduced} onReady={markWritten} />
      <div
        className={`lr-letter-content ${written ? "visible" : ""}`}
        inert={!written}
        aria-hidden={!written}
      >
        {letter.kind === "text" ? (
          <>
            {paragraphs.map((paragraph, i) => <p key={i} className={`lr-body-ink ${revealAll || reduced ? "is-complete" : ""}`} style={{animationPlayState: active ? "running" : "paused"}}>
              <span className="lr-sr-only">{paragraph.text}</span>
              <span aria-hidden="true" className="lr-body-ink-visual">
                {paragraph.words.map((word, w) => word.space ? word.text : <span className="lr-body-ink-word" key={w} style={{"--word-delay": `${word.glyphs[0]?.index * inkStep}s`, animationPlayState: active ? "running" : "paused"}}>
                  {word.glyphs.map(glyph => <span className="lr-body-ink-glyph" key={glyph.index} style={{"--body-ink-delay": `${glyph.index * inkStep}s`, animationPlayState: active ? "running" : "paused"}}>{glyph.text}</span>)}
                </span>)}
              </span>
            </p>)}
          </>
        ) : (
          <div className="lr-video">
            {!playing ? (
              <button
                className="lr-video-poster"
                onClick={() => setPlaying(true)}
                style={
                  letter.posterUrl
                    ? { backgroundImage: `url(${letter.posterUrl})` }
                    : undefined
                }
              >
                <span aria-hidden="true">▷</span>Xem lời nhắn
              </button>
            ) : (
              <video
                ref={video}
                src={letter.videoUrl}
                poster={letter.posterUrl}
                autoPlay
                controls
                playsInline
                preload="metadata"
                onEnded={() => setEnded(true)}
                onError={() => setError(true)}
              >
                {letter.captionsUrl && (
                  <track
                    kind="captions"
                    src={letter.captionsUrl}
                    srcLang="vi"
                    label="Tiếng Việt"
                    default
                  />
                )}
              </video>
            )}
            {error && (
              <p role="status">
                Video chưa tải được. Bạn vẫn có thể mở tấm thiệp bên dưới.{" "}
                <button
                  onClick={() => {
                    setError(false);
                    setPlaying(false);
                  }}
                >
                  Thử lại
                </button>
              </p>
            )}
          </div>
        )}
        <div className="lr-signature">
          <span>Thương mến,</span>
          <strong>{letter.senderName}</strong>
        </div>
        {!revealAll && !reduced && letter.kind === "text" && <button className="lr-body-ink-skip" onClick={() => setRevealAll(true)}>Hiện toàn bộ lá thư</button>}
        <LamviWishes occasion={letter.occasion} />
        {(Object.keys(letter.occasionData).length > 0 || letter.postscript) && (
          <button
            className={`lr-surprise-trigger ${ended ? "is-highlighted" : ""}`}
            onClick={onSurprise}
          >
            <span aria-hidden="true">✧</span>
            {surpriseText}
            <span aria-hidden="true">↗</span>
          </button>
        )}
        {afterLetter}
      </div>
      {written && hintReady && scrollHint && <span className="lr-reader-scroll-cue" aria-hidden="true">Cuộn để đọc tiếp ↓</span>}
    </article>
  );
}
