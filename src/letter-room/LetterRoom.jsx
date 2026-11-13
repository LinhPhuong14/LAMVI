import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "@fontsource/instrument-sans/400.css";
import "@fontsource/instrument-sans/500.css";
import "@fontsource/spectral/vietnamese-400.css";
import "@fontsource/spectral/vietnamese-400-italic.css";
import "@fontsource/caveat/400.css";
import {
  demos,
  occasions,
  initialState,
  roomReducer,
  validateLetter,
} from "./data";
import "./room.css";

function Dedication() {
  return (
    <div className="lr-dedication">
      <svg viewBox="0 0 310 85" role="img" aria-label="Gửi bạn,">
        <g
          fill="none"
          stroke="currentColor"
          strokeWidth="2.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path
            pathLength="1"
            d="M53 28C75 3 14 8 18 48S65 69 62 40L39 43M82 34L75 55Q76 70 90 52L99 34L92 62Q96 67 104 54M83 21Q91 11 97 20Q102 26 94 27M116 34L107 63M118 23L119 24"
          />
          <path
            pathLength="1"
            d="M152 14L138 60Q157 30 169 39Q177 54 158 63Q144 69 143 56M179 47Q195 30 201 39L193 60Q195 67 204 57M196 40Q174 35 174 57Q176 68 190 57M185 75L187 76M216 41L208 64Q231 31 236 41L228 60Q230 67 240 56M255 60Q258 67 249 74"
          />
        </g>
      </svg>
    </div>
  );
}
function Surprise({ letter, onReveal }) {
  const [open, setOpen] = useState(false),
    [done, setDone] = useState(false),
    [photo, setPhoto] = useState(0);
  const d = letter.occasionData,
    type = letter.occasion;
  const labels = {
    birthday: "Mở chiếc thiệp nhỏ",
    anniversary: "Kéo kỷ niệm ra ánh sáng",
    thankYou: "Lật góc thư",
    milestone: "Đóng dấu cột mốc",
    encouragement: "Mở khi cần",
    longDistance: "Mở hai ô cửa",
    justBecause: "Chạm vào vầng trăng",
  };
  const hasData = Boolean(
    d.message || d.date || d.label || d.places || d.photos?.length,
  );
  if (!hasData && !letter.postscript) return null;
  return (
    <section
      className={`lr-surprise ${open ? "is-open" : ""}`}
      aria-label="Bất ngờ dành cho bạn"
    >
      {!open ? (
        <button
          className="lr-surprise-trigger"
          onClick={() => {
            setOpen(true);
            onReveal();
          }}
        >
          <span>{type === "justBecause" ? "☾" : "✧"}</span>
          {hasData ? labels[type] : "Một lời tái bút"}
          <span>↗</span>
        </button>
      ) : (
        <div className={`lr-gift lr-${type}`}>
          {type === "birthday" && hasData ? (
            <>
              <p className="lr-hand">Ước một điều đi.</p>
              <div className={`lr-cake ${done ? "blown" : ""}`}>
                <button
                  aria-label="Tắt nến"
                  onClick={() => setDone(true)}
                  disabled={done}
                >
                  <span className="lr-flame">♨</span>
                  <span className="lr-candle" />
                </button>
                <div className="lr-cake-tier" />
                <div className="lr-cake-base" />
                {done && <span className="lr-smoke">〰</span>}
              </div>
              {!done ? (
                <button className="lr-link" onClick={() => setDone(true)}>
                  Chạm để tắt nến
                </button>
              ) : (
                <p className="lr-ribbon">{d.message || letter.postscript}</p>
              )}
            </>
          ) : type === "anniversary" && hasData ? (
            <div
              className="lr-polaroid"
              onTouchStart={(e) => {
                e.currentTarget.dataset.x = e.touches[0].clientX;
              }}
              onTouchEnd={(e) => {
                if (
                  Math.abs(
                    e.changedTouches[0].clientX -
                      Number(e.currentTarget.dataset.x),
                  ) > 35
                )
                  setPhoto((p) => (p ? 0 : 1));
              }}
            >
              {d.photos?.length ? (
                <>
                  <img
                    src={d.photos[photo % d.photos.length]}
                    alt={`Kỷ niệm ${photo + 1}`}
                    onError={(e) => {
                      e.currentTarget.hidden = true;
                    }}
                  />
                  {d.photos.length > 1 && (
                    <button onClick={() => setPhoto((p) => (p ? 0 : 1))}>
                      Ảnh tiếp theo →
                    </button>
                  )}
                </>
              ) : (
                <span className="lr-paper-flower">✳</span>
              )}
              <p className="lr-hand">{d.date}</p>
              <p>{d.message}</p>
            </div>
          ) : type === "longDistance" && hasData ? (
            <>
              <div className="lr-windows">
                {(d.places || ["Nơi bạn", "Nơi mình"])
                  .slice(0, 2)
                  .map((p, i) => (
                    <div key={i}>
                      <span>☾</span>
                      <p>{p}</p>
                    </div>
                  ))}
              </div>
              <p>{d.message}</p>
            </>
          ) : (
            <>
              <div className="lr-surprise-symbol">
                {type === "milestone"
                  ? d.label
                  : type === "justBecause"
                    ? d.icon || "☾"
                    : type === "thankYou"
                      ? "↶"
                      : "✧"}
              </div>
              {type === "thankYou" && (
                <p className="lr-hand">Có một chuyện mình vẫn nhớ.</p>
              )}
              <p>{d.message || letter.postscript}</p>
            </>
          )}
        </div>
      )}
    </section>
  );
}
function Reader({ letter, onReveal, getPaperRect }) {
  const [written, setWritten] = useState(false),
    [playing, setPlaying] = useState(false),
    [error, setError] = useState(false),
    [ended, setEnded] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    ref.current?.focus({ preventScroll: true });
    if (
      !matchMedia("(prefers-reduced-motion: reduce)").matches &&
      ref.current?.animate
    ) {
      const origin = getPaperRect?.();
      const bounds = ref.current.getBoundingClientRect();
      if (origin)
        ref.current.animate(
          [
            {
              transform: `translate(${origin.left - bounds.left}px, ${origin.top - bounds.top}px) scale(${origin.width / bounds.width}, ${origin.height / bounds.height})`,
              opacity: 0.7,
            },
            { transform: "translate(0, 0) scale(1, 1)", opacity: 1 },
          ],
          {
            duration: 420,
            easing: "cubic-bezier(.2,.7,.2,1)",
            fill: "backwards",
          },
        );
    }
    const timer = setTimeout(
      () => setWritten(true),
      matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 1350,
    );
    return () => clearTimeout(timer);
  }, [getPaperRect]);
  return (
    <article
      ref={ref}
      tabIndex={-1}
      className="lr-reader"
      aria-label={`Lời chúc gửi ${letter.recipientName}`}
    >
      <div className="lr-letter-meta">
        MỘT LÁ THƯ DÀNH RIÊNG CHO BẠN <span>✧</span>
      </div>
      <Dedication />
      <p className="lr-recipient">{letter.recipientName} thân mến,</p>
      <div
        className={`lr-letter-content ${written ? "visible" : ""}`}
        aria-hidden={!written}
        inert={!written}
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
                <span>▷</span>Xem lời nhắn
              </button>
            ) : (
              <video
                src={letter.videoUrl}
                poster={letter.posterUrl}
                controls
                autoPlay
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
                Video chưa tải được. Bạn vẫn có thể mở món quà nhỏ bên dưới.{" "}
                <button
                  onClick={() => {
                    setPlaying(false);
                    setError(false);
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
        <div className={ended ? "lr-ended" : ""}>
          <Surprise letter={letter} onReveal={onReveal} />
        </div>
      </div>
      <div className="lr-letter-bottom">
        GẤP LẠI MỘT CHÚT THƯƠNG. GIỮ LẠI MỘT CHÚT SÁNG.
      </div>
    </article>
  );
}
export default function LetterRoom() {
  const [params, setParams] = useSearchParams();
  const key = Object.hasOwn(occasions, params.get("occasion"))
    ? params.get("occasion")
    : "justBecause";
  return (
    <Room
      key={`${key}-${params.get("kind")}-${params.get("fallback")}`}
      letter={validateLetter({
        ...demos[key],
        ...(params.get("kind") === "video" ? { kind: "video" } : {}),
        ...(params.get("empty") === "1"
          ? { occasionData: {}, postscript: undefined }
          : {}),
      })}
      fallback={params.get("fallback") === "1"}
      onSelect={(occasion) => setParams({ occasion })}
    />
  );
}
function Room({ letter, fallback, onSelect }) {
  const [state, dispatch] = useReducer(roomReducer, initialState),
    [failed, setFailed] = useState(fallback),
    [surprise, setSurprise] = useState(false);
  const host = useRef(null),
    scene = useRef(null),
    drag = useRef(null),
    stateRef = useRef(state),
    actionRef = useRef(null);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
  const reduced = useRef(false);
  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fallback) return;
    let cancelled = false;
    import("./scene")
      .then(({ createRoom }) => {
        if (cancelled) return;
        try {
          scene.current = createRoom(host.current, {
            recipientName: letter.recipientName,
            reduced: reduced.current,
            onAction: (type) => dispatch({ type }),
            onError: () => setFailed(true),
          });
          scene.current.setState(stateRef.current);
        } catch {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      scene.current?.dispose();
      scene.current = null;
    };
  }, [fallback, letter.recipientName]);
  useEffect(() => {
    scene.current?.setState({ ...state, surprise });
    const next = {
      lighting: ["LIT", 1000],
      approaching: ["READY", 900],
      extracting: ["READ", 420],
      returning: ["RETURNED", 380],
    }[state.phase];
    if (!next) return;
    const timer = setTimeout(
      () => dispatch({ type: next[0] }),
      reduced.current ? 25 : next[1],
    );
    return () => clearTimeout(timer);
  }, [state, surprise]);
  useEffect(() => {
    if (["lit", "ready"].includes(state.phase))
      actionRef.current?.focus({ preventScroll: true });
  }, [state.phase]);
  const getPaperRect = useCallback(
    () => (failed ? null : scene.current?.paperRect()),
    [failed],
  );
  const ready = state.phase === "ready",
    reading = state.phase === "reading",
    dark = state.phase === "dark";
  function start(e) {
    if (!ready || drag.current || e.button !== 0) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      point: scene.current?.project(e.clientX, e.clientY),
      value: 0,
      moved: false,
    };
  }
  function move(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const point = scene.current?.project(e.clientX, e.clientY);
    const amount =
      point && d.point ? (d.point.z - point.z) / 1.35 : (d.y - e.clientY) / 160;
    d.moved ||= Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7;
    d.value = Math.max(0, Math.min(1, amount));
    dispatch({ type: "DRAG", value: d.value });
  }
  function finish(e, cancel = false) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    if (!d.moved && !cancel) dispatch({ type: "OPEN" });
    else dispatch({ type: "RELEASE", cancel });
  }
  const action = dark
    ? "Chạm để bật đèn"
    : state.phase === "lit"
      ? "Chạm vào phong bì để mở thư"
      : ready
        ? "Kéo mép giấy lên"
        : null;
  return (
    <main
      className={`lr-page ${dark ? "lr-dark" : "lr-lit"} ${reading ? "lr-reading" : ""}`}
    >
      <header className="lr-header">
        <a href="/" className="lr-brand" aria-label="LAMVI trang chủ">
          LAMVI<span>®</span>
        </a>
        <span className="lr-header-caption">ÁNH SÁNG GIỮ LỜI THƯƠNG</span>
        <button
          className="lr-reset"
          onClick={() => window.location.reload()}
          aria-label="Bắt đầu lại"
        >
          ↻ <span>Bắt đầu lại</span>
        </button>
      </header>
      <section className="lr-intro">
        <div className="lr-eyebrow">
          <span /> MỘT MÓN QUÀ, MỘT LỜI NHẮN
        </div>
        <h1>
          Phòng thư <em>LAMVI</em>
          <span className="lr-title-star">✳</span>
        </h1>
        <p>
          Một góc sáng nhỏ.
          <br className="lr-mobile-break" /> Một lời thương dành riêng cho{" "}
          {letter.recipientName}.
        </p>
      </section>
      <div className="lr-stage-wrap">
        <div className="lr-side-note">
          GIẤY DÓ · ÁNH SÁNG · NHỮNG ĐIỀU THƯƠNG
        </div>
        <div
          className="lr-stage"
          ref={host}
          aria-label="Góc phòng có đèn giấy dó và phong bì"
        />
        {failed && (
          <div className={`lr-fallback ${dark ? "" : "is-lit"}`}>
            <div className="lr-wall" />
            <div className="lr-desk">
              <div className="lr-lamp" />
              <button
                className="lr-switch"
                aria-label="Bật đèn"
                disabled={!dark}
                onClick={() => dispatch({ type: "LIGHT" })}
              />
              <button
                className="lr-envelope"
                aria-label="Mở phong bì"
                disabled={state.phase !== "lit"}
                onClick={() => dispatch({ type: "APPROACH" })}
              >
                <span>Gửi {letter.recipientName}</span>
                <i />
              </button>
            </div>
          </div>
        )}
        {!reading && (
          <div
            className={`lr-action lr-action-${state.phase}`}
            aria-live="polite"
          >
            {action ? (
              <button
                ref={actionRef}
                className="lr-action-button"
                onClick={(e) => {
                  if (dark) dispatch({ type: "LIGHT" });
                  else if (state.phase === "lit")
                    dispatch({ type: "APPROACH" });
                  else if (ready && e.detail === 0) dispatch({ type: "OPEN" });
                }}
                onKeyDown={(e) => {
                  if (ready && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    dispatch({ type: "OPEN" });
                  }
                }}
                onPointerDown={start}
                onPointerMove={move}
                onPointerUp={(e) => finish(e)}
                onPointerCancel={(e) => finish(e, true)}
                onLostPointerCapture={(e) => finish(e, true)}
              >
                <span className="lr-action-icon">
                  {dark ? "⏻" : ready ? "↑" : "↗"}
                </span>
                {action}
                {ready && <small>hoặc chạm để mở</small>}
              </button>
            ) : (
              <span>
                {state.phase === "lighting"
                  ? "Một chút sáng, một chút ấm…"
                  : state.phase === "approaching"
                    ? "Có một lá thư dành cho bạn…"
                    : "Lời thương đang mở…"}
              </span>
            )}
          </div>
        )}
        {reading && (
          <Reader
            letter={letter}
            onReveal={() => setSurprise(true)}
            getPaperRect={getPaperRect}
          />
        )}
        <div className="lr-room-tag">
          <span className={dark ? "" : "on"} />
          {dark ? "GÓC NHỎ ĐANG NGỦ" : "ĐÈN ĐÃ SÁNG · THƯƠNG ĐÃ ĐẾN"}
        </div>
      </div>
      <footer className="lr-footer">
        <div className="lr-progress" aria-label="Tiến trình mở thư">
          {["Thắp sáng", "Mở thư", "Giữ điều thương"].map((s, i) => (
            <span
              key={s}
              className={
                i === 0 ||
                (i === 1 && !["dark", "lighting"].includes(state.phase)) ||
                (i === 2 && reading)
                  ? "active"
                  : ""
              }
            >
              <b>0{i + 1}</b>
              {s}
            </span>
          ))}
        </div>
        <p>Được gói bằng giấy. Được gửi bằng lòng.</p>
        <span className="lr-footer-flower">✳</span>
      </footer>
      <details className="lr-demo">
        <summary>
          Khám phá lời chúc mẫu <span>＋</span>
        </summary>
        <div>
          {Object.entries(occasions).map(([k, v]) => (
            <button
              key={k}
              aria-pressed={letter.occasion === k}
              onClick={() => onSelect(k)}
            >
              {v}
              {k === "longDistance" ? " · video" : ""}
            </button>
          ))}
        </div>
      </details>
    </main>
  );
}
