import { useEffect, useRef, useState } from "react";

export default function LetterReader({
  letter,
  onSurprise,
  getPaperRect,
  active = true,
  afterLetter,
}) {
  const ref = useRef(null),
    video = useRef(null);
  const [written, setWritten] = useState(false),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(false),
    [ended, setEnded] = useState(false);
  useEffect(() => {
    if (!active) video.current?.pause();
  }, [active]);
  useEffect(() => {
    const el = ref.current;
    el?.focus({ preventScroll: true });
    function grid() {
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
            opacity: 0.7,
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
    const timer = setTimeout(() => setWritten(true), reduced ? 0 : 1100);
    return () => {
      clearTimeout(timer);
      observer?.disconnect();
    };
  }, [getPaperRect]);
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
      tabIndex={-1}
      aria-label={`Lời chúc gửi ${letter.recipientName}`}
    >
      <div className="lr-letter-meta">
        MỘT LỜI THƯƠNG ĐƯỢC GIỮ LẠI<span aria-hidden="true">✧</span>
      </div>
      <h2 className="lr-dedication">
        Gửi {letter.recipientName},
        <svg viewBox="0 0 210 24" aria-hidden="true">
          <path
            d="M5 16C43 5 119 6 181 13M170 17Q192 12 204 15"
            pathLength="1"
          />
        </svg>
      </h2>
      <div
        className={`lr-letter-content ${written ? "visible" : ""}`}
        inert={!written}
        aria-hidden={!written}
      >
        {letter.kind === "text" ? (
          (Array.isArray(letter.message)
            ? letter.message
            : letter.message.split("\n\n")
          ).map((p, i) => <p key={i}>{p}</p>)
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
    </article>
  );
}
