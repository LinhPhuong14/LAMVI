import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "@fontsource/itim/vietnamese-400.css";
import "@fontsource/itim/latin-400.css";
import {
  demos,
  occasions,
  initialState,
  roomReducer,
  validateLetter,
  PHASE_TIMINGS,
  shotForPhase,
} from "./data";
import OrientationGate from "./OrientationGate";
import LetterReader from "./LetterReader";
import "./room.css";
// The embedding API intentionally re-exports the shared validator.
// oxlint-disable-next-line react/only-export-components
export { validateLetter };
export function Handwritten({ text, delay = 0 }) {
  let index = 0;
  return (
    <span className="lr-ink">
      <span className="lr-sr-only">{text}</span>
      <span aria-hidden="true">
        {Array.from(
          new Intl.Segmenter("vi", { granularity: "grapheme" }).segment(text),
          ({ segment }) => (
            <span
              className="lr-glyph"
              key={index}
              style={{ "--ink-delay": `${delay + index++ * 0.022}s` }}
            >
              {segment}
            </span>
          ),
        )}
      </span>
    </span>
  );
}
export default function LetterRoom({
  letter: suppliedLetter,
  onExit,
  preview = false,
  afterLetter,
} = {}) {
  const [params, setParams] = useSearchParams(),
    key = Object.hasOwn(occasions, params.get("occasion"))
      ? params.get("occasion")
      : "birthday";
  const letter = validateLetter(
    suppliedLetter || {
      ...demos[key],
      ...(params.get("kind") === "video" ? { kind: "video" } : {}),
      ...(params.get("empty") === "1"
        ? { occasionData: {}, postscript: undefined }
        : {}),
    },
  );
  return (
    <OrientationGate>
      {(active) => (
        <Room
          key={`${key}-${letter.recipientName}-${letter.kind}-${params.get("fallback")}`}
          active={active}
          letter={letter}
          fallback={params.get("fallback") === "1"}
          onSelect={(occasion) => setParams({ occasion })}
          onExit={onExit}
          preview={preview || Boolean(suppliedLetter)}
          afterLetter={afterLetter}
          legacyAssets={params.get("assets") === "legacy"}
        />
      )}
    </OrientationGate>
  );
}
function Cue({
  point,
  label,
  hint,
  idle,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onKeyDown,
  icon = "·",
  width,
  height,
  disabled,
}) {
  const x = Math.max(25, Math.min(width - 25, point.x)),
    y = Math.max(25, Math.min(height - 25, point.y));
  return (
    <button
      className={`lr-object-cue ${idle ? "show-label" : ""} ${x > width * 0.6 ? "label-left" : ""}`}
      aria-label={label}
      style={{ left: x, top: y }}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onKeyDown={onKeyDown}
      disabled={disabled}
    >
      <span className="lr-cue-dot" aria-hidden="true">
        {icon}
      </span>
      <span className="lr-cue-label" aria-hidden="true">
        {hint || label}
      </span>
    </button>
  );
}
function FinalNote({ letter, point, width, height }) {
  const d = letter.occasionData,
    [photo, setPhoto] = useState(0);
  return (
    <section
      className="lr-final-note"
      role="status"
      style={{
        left: Math.max(16, Math.min(width - 286, point.x - 135)),
        top: Math.max(20, Math.min(height - 115, point.y + 35)),
      }}
    >
      {letter.occasion === "anniversary" && (
        <>
          {d.photos?.length ? (
            <>
              <img
                src={d.photos[photo % d.photos.length]}
                alt={`Kỷ niệm ${photo + 1}`}
              />
              {d.photos.length > 1 && (
                <button onClick={() => setPhoto((p) => p + 1)}>
                  Ảnh tiếp theo →
                </button>
              )}
            </>
          ) : null}
          <strong>{d.date}</strong>
        </>
      )}
      {letter.occasion === "milestone" && <strong>{d.label}</strong>}
      {letter.occasion === "longDistance" && (
        <strong>{d.places?.join(" • ")}</strong>
      )}
      <p>
        {d.message ||
          letter.postscript ||
          "Một chút thương, dành riêng cho bạn."}
      </p>
    </section>
  );
}
function Room({
  letter,
  fallback,
  onSelect,
  onExit,
  preview,
  afterLetter,
  active,
  legacyAssets,
}) {
  const [state, dispatch] = useReducer(roomReducer, initialState),
    [failed, setFailed] = useState(fallback),
    [sceneReady, setSceneReady] = useState(fallback),
    [view, setView] = useState({ stable: true, anchors: {} }),
    [size, setSize] = useState({ width: 960, height: 540 }),
    [idlePhase, setIdlePhase] = useState(null),
    [sound, setSound] = useState(false);
  const host = useRef(null),
    scene = useRef(null),
    stateRef = useRef(state),
    reduced = useRef(false),
    transition = useRef({ phase: null, remaining: 0 }),
    drag = useRef(null),
    pointerHandler = useRef(null),
    audio = useRef(null),
    soundRef = useRef(false);
  useEffect(() => {
    stateRef.current = state;
    soundRef.current = sound;
  }, [state, sound]);
  const clickSound = useCallback(() => {
    if (!soundRef.current || !audio.current) return;
    try {
      const c = audio.current,
        o = c.createOscillator(),
        g = c.createGain();
      o.type = "square";
      o.frequency.setValueAtTime(1300, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(180, c.currentTime + 0.04);
      g.gain.setValueAtTime(0.025, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.045);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.05);
    } catch {}
  }, []);
  const perform = useCallback(
    (type) => {
      if (
        ["LIGHT", "APPROACH", "OPEN", "BLOW", "REVEAL"].includes(type) &&
        scene.current?.canInteract === false
      )
        return;
      if (type === "LIGHT") clickSound();
      dispatch({ type });
    },
    [clickSound],
  );
  useEffect(() => {
    const resize = () => {
      const r = host.current?.getBoundingClientRect();
      if (r?.width) setSize({ width: r.width, height: r.height });
    };
    resize();
    const ro =
      typeof ResizeObserver === "function" ? new ResizeObserver(resize) : null;
    if (host.current) ro?.observe(host.current);
    return () => ro?.disconnect();
  }, []);
  useEffect(() => {
    reduced.current = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (fallback || !active || scene.current) return;
    let cancelled = false;
    import("./scene")
      .then(({ createRoom }) => {
        if (cancelled) return;
        try {
          scene.current = createRoom(host.current, {
            recipientName: letter.recipientName,
            occasion: letter.occasion,
            legacyAssets,
            reduced: reduced.current,
            onAction: perform,
            onReady: () => setSceneReady(true),
            onError: () => {
              setFailed(true);
              setSceneReady(true);
            },
            onFrame: setView,
            onPaperPointer: (type, event) =>
              pointerHandler.current?.(type, event),
          });
          scene.current.setState(stateRef.current);
        } catch {
          setFailed(true);
          setSceneReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setSceneReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    active,
    fallback,
    letter.recipientName,
    letter.occasion,
    perform,
    legacyAssets,
  ]);
  useEffect(
    () => () => {
      scene.current?.dispose();
      scene.current = null;
      audio.current?.close();
    },
    [],
  );
  useEffect(() => {
    scene.current?.setState({ ...state, paused: !active });
  }, [state, active]);
  useEffect(() => {
    const next = PHASE_TIMINGS[state.phase];
    if (!next) {
      transition.current = { phase: state.phase, remaining: 0 };
      return;
    }
    if (transition.current.phase !== state.phase)
      transition.current = {
        phase: state.phase,
        remaining: reduced.current ? 25 : next[1],
      };
    if (!active) return;
    const remaining = transition.current.remaining,
      start = performance.now();
    const timer = setTimeout(() => dispatch({ type: next[0] }), remaining);
    return () => {
      clearTimeout(timer);
      transition.current.remaining = Math.max(
        0,
        remaining - (performance.now() - start),
      );
    };
  }, [state.phase, active]);
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setIdlePhase(state.phase), 3200);
    return () => clearTimeout(timer);
  }, [state.phase, active]);
  function start(e) {
    if (state.phase !== "ready" || drag.current || (e.button ?? 0) !== 0)
      return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      point: scene.current?.project(e.clientX, e.clientY),
      moved: false,
    };
  }
  function move(e) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    d.moved ||= Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7;
    const p = scene.current?.project(e.clientX, e.clientY);
    dispatch({
      type: "DRAG",
      value: p && d.point ? (d.point.z - p.z) / 1.35 : (d.y - e.clientY) / 120,
    });
  }
  function finish(e, cancel = false) {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (e.currentTarget.hasPointerCapture?.(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId);
    dispatch({ type: !d.moved && !cancel ? "OPEN" : "RELEASE", cancel });
  }
  useEffect(() => {
    pointerHandler.current = (type, e) =>
      type === "start"
        ? start(e)
        : type === "move"
          ? move(e)
          : finish(e, type === "cancel");
  });
  const getPaperRect = useCallback(
    () => (failed ? null : scene.current?.paperRect()),
    [failed],
  );
  const point = (name) =>
    view.anchors[name] || {
      x:
        size.width *
        {
          switch: 0.35,
          envelope: 0.66,
          paper: 0.57,
          card: 0.58,
          candle: 0.55,
          lamp: 0.4,
        }[name],
      y:
        size.height *
        {
          switch: 0.66,
          envelope: 0.56,
          paper: 0.4,
          card: 0.56,
          candle: 0.46,
          lamp: 0.42,
        }[name],
    };
  const idle = active && idlePhase === state.phase;
  const cueProps = {
    width: size.width,
    height: size.height,
    disabled: !failed && !view.stable,
    idle,
  };
  const cue =
    state.phase === "dark"
      ? { name: "switch", label: "Chạm để bật đèn", type: "LIGHT", icon: "⏻" }
      : state.phase === "envelope"
        ? {
            name: "envelope",
            label: "Chạm vào phong bì để mở thư",
            type: "APPROACH",
            icon: "↗",
          }
        : state.phase === "ready"
          ? {
              name: "paper",
              label: "Kéo mép giấy lên",
              type: "OPEN",
              icon: "↑",
            }
          : state.phase === "surprise"
            ? {
                name:
                  letter.occasion === "justBecause"
                    ? "lamp"
                    : letter.occasion === "birthday"
                      ? "candle"
                      : "card",
                label:
                  letter.occasion === "birthday"
                    ? "Chạm để tắt nến"
                    : letter.occasion === "justBecause"
                      ? "Chạm vào hình trên đèn"
                      : "Mở điều nhỏ dành cho bạn",
                type: letter.occasion === "birthday" ? "BLOW" : "REVEAL",
                icon: letter.occasion === "birthday" ? "·" : "✧",
              }
            : null;
  function toggleSound() {
    if (!sound) {
      try {
        const A = window.AudioContext || window.webkitAudioContext;
        if (A) {
          audio.current ||= new A();
          audio.current.resume();
        }
      } catch {}
    }
    setSound((x) => !x);
  }
  return (
    <main
      className={`lr-page lr-pov lr-game ${sceneReady ? "lr-scene-ready" : ""} ${state.phase === "dark" ? "lr-dark" : "lr-lit"} ${state.phase === "reading" ? "lr-reading" : ""} lr-phase-${state.phase}`}
      data-phase={state.phase}
      data-camera={shotForPhase(state.phase, letter.occasion)}
    >
      <h1 className="lr-sr-only">Phòng thư LAMVI</h1>
      <div className="lr-stage-wrap">
        <div
          className="lr-stage"
          ref={host}
          aria-label="Căn phòng LAMVI với đèn giấy dó và phong thư"
        />
        <div className="lr-atmosphere" aria-hidden="true" />
        <div className="lr-game-controls">
          <span className="lr-game-brand">LAMVI</span>
          <div>
            <button
              aria-label={sound ? "Tắt âm thanh" : "Bật âm thanh"}
              aria-pressed={sound}
              onClick={toggleSound}
            >
              {sound ? "♪" : "♩"}
            </button>
            <button
              aria-label={onExit ? "Đóng xem trước" : "Bắt đầu lại"}
              onClick={() => (onExit ? onExit() : window.location.reload())}
            >
              ↻
            </button>
          </div>
        </div>
        {failed && (
          <div
            className={`lr-fallback ${state.phase === "dark" ? "" : "is-lit"} ${!["dark", "lighting", "lit", "envelope"].includes(state.phase) ? "lr-fallback-letter" : ""}`}
            aria-label="Cảnh 2D dự phòng"
          >
            <div className="lr-wall" />
            <div className="lr-desk">
              <div className="lr-lamp" />
              <div className="lr-envelope">
                <span>Gửi {letter.recipientName}</span>
                <i />
                <div className="lr-fallback-sheet" />
              </div>
            </div>
          </div>
        )}
        {cue && (
          <Cue
            {...cueProps}
            point={point(cue.name)}
            label={cue.label}
            hint={state.phase === "envelope" ? "Chạm để đưa thư lại gần" : state.phase === "surprise" && letter.occasion === "birthday" ? "Ước một điều đi." : undefined}
            idle={idle || state.phase === "surprise"}
            icon={cue.icon}
            onClick={(e) => {
              if (state.phase !== "ready" || e.detail === 0) perform(cue.type);
            }}
            onPointerDown={state.phase === "ready" ? start : undefined}
            onPointerMove={state.phase === "ready" ? move : undefined}
            onPointerUp={state.phase === "ready" ? (e) => finish(e) : undefined}
            onPointerCancel={
              state.phase === "ready" ? (e) => finish(e, true) : undefined
            }
            onKeyDown={(e) => {
              if (
                state.phase === "ready" &&
                (e.key === "Enter" || e.key === " ")
              ) {
                e.preventDefault();
                perform("OPEN");
              }
            }}
          />
        )}
        {state.phase === "reading" && (
          <LetterReader
            letter={letter}
            getPaperRect={getPaperRect}
            active={active}
            afterLetter={afterLetter}
            onSurprise={() => dispatch({ type: "SURPRISE" })}
          />
        )}
        {["celebrating", "celebrated"].includes(state.phase) && (
          <FinalNote
            letter={letter}
            point={point("card")}
            width={size.width}
            height={size.height}
          />
        )}
        {!preview && (
          <details className="lr-demo">
            <summary>Lời chúc mẫu</summary>
            <div>
              {Object.entries(occasions).map(([k, v]) => (
                <button
                  key={k}
                  aria-pressed={letter.occasion === k}
                  onClick={() => onSelect(k)}
                >
                  {v}
                </button>
              ))}
            </div>
          </details>
        )}
      </div>
    </main>
  );
}
