import { lazy, Suspense, useSyncExternalStore } from "react";
const subscribe = () => () => {};
const LetterRoom = lazy(() => import("./LetterRoom"));

// Render the same placeholder on the server and first client pass. The room is
// browser-only; renderToString cannot await a lazy Suspense boundary.
export default function LetterRoomRoute() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const placeholder = (
    <main
      role="status"
      aria-busy="true"
      style={{
        minHeight: "100svh",
        display: "grid",
        placeItems: "center",
        background: "#000",
        color: "#f4e8cf",
        font: '12px/1.6 "Be Vietnam Pro", sans-serif',
      }}
    >
      Đang chuẩn bị phòng thư…
    </main>
  );
  return mounted ? (
    <Suspense fallback={placeholder}>
      <LetterRoom />
    </Suspense>
  ) : (
    placeholder
  );
}
