import { useSyncExternalStore } from "react";

const landscapeSnapshot = () => window.innerWidth > window.innerHeight;
function subscribe(listener) {
  window.addEventListener("resize", listener);
  window.addEventListener("orientationchange", listener);
  return () => {
    window.removeEventListener("resize", listener);
    window.removeEventListener("orientationchange", listener);
  };
}
export default function OrientationGate({ children }) {
  const landscape = useSyncExternalStore(
    subscribe,
    landscapeSnapshot,
    () => false,
  );
  return (
    <div
      className={`lr-orientation-shell ${landscape ? "is-landscape" : "is-portrait"}`}
    >
      <div className="lr-viewport" inert={!landscape} aria-hidden={!landscape}>
        {children(landscape)}
      </div>
      <section
        className={`lr-rotate-overlay ${landscape ? "is-dismissed" : ""}`}
        aria-hidden={landscape}
        aria-label="Hướng dẫn xoay ngang màn hình"
        role="status"
      >
        <div className="lr-rotate-content">
          <svg
            viewBox="0 0 120 100"
            width="120"
            height="100"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            aria-hidden="true"
          >
            <rect x="42" y="15" width="35" height="68" rx="5" />
            <path d="M55 22h9M56 75h8M29 49C15 31 27 12 42 9M33 8l10 1-3 10M91 49c14 18 2 37-13 40M87 90l-10-1 3-10" />
          </svg>
          <p className="lr-rotate-eyebrow">PHÒNG THƯ LAMVI</p>
          <h1>Xoay ngang một chút nhé.</h1>
          <p>
            Một góc phòng nhỏ đang đợi bạn.
            <br />
            Quay ngang điện thoại để bước vào.
          </p>
          <span className="lr-rotate-note">
            Căn phòng sẽ mở khi màn hình nằm ngang.
          </span>
        </div>
      </section>
    </div>
  );
}
