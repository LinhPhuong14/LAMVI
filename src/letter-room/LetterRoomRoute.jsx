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
        background: "#f5f1e8",
        color: "#30433e",
      }}
    >
      Đang chuẩn bị một góc sáng…
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
