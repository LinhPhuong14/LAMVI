# Quyết định kỹ thuật (T-xx)

Quyết định nghiệp vụ nằm ở Phụ lục A của [`ba-spec.md`](../ba-spec.md) (`D-xx`). File này chỉ chứa quyết định kỹ thuật. Mỗi mục: bối cảnh → quyết định → hệ quả. Không xóa mục cũ; nếu thay, đánh dấu **Bị thay bởi T-yy**.

| ID | Ngày | Quyết định | Trạng thái |
|---|---|---|---|
| T-01 | 2026-09-28 | Frontend: React 19 + Vite, định tuyến bằng `react-router-dom` | Hiệu lực |
| T-02 | 2026-09-28 | Backend: Node + Express 5 trong cùng repo (`server/`), API dưới `/api` | Hiệu lực (từ T-15: cùng server với web) |
| T-03 | 2026-09-28 | Dữ liệu và xác thực: Supabase (Postgres + Supabase Auth) | Hiệu lực |
| T-04 | 2026-09-28 | Truy cập dữ liệu qua adapter (repository + auth provider); có bản Supabase và bản bộ nhớ | Hiệu lực |
| T-05 | 2026-09-28 | Frontend chỉ gọi API Express, không gọi Supabase trực tiếp | Hiệu lực |
| T-06 | 2026-09-28 | Nội dung đa ngôn ngữ lưu dạng `jsonb` `{vi, en, zh}`; giao diện dùng file thông điệp trong `src/i18n/` | Hiệu lực |
| T-07 | 2026-09-28 | Mã ngôn ngữ trong code/URL: `vi`, `en`, `zh` (thuộc tính `lang` HTML: `vi`, `en`, `zh-Hans`) | Hiệu lực |
| T-08 | 2026-09-28 | Test: Vitest (server: môi trường node + supertest; frontend: jsdom + Testing Library) | Hiệu lực |
| T-09 | 2026-09-28 | Tiền: số nguyên VND, không dùng số thực; định dạng bằng `Intl.NumberFormat('vi-VN')` | Hiệu lực |
| T-10 | 2026-09-28 | Token phiên lưu ở `localStorage` phía trình duyệt, gửi qua header `Authorization: Bearer` | Hiệu lực |
| T-11 | 2026-09-28 | Mỗi tính năng phải có subagent kiểm thử độc lập trước khi commit | Hiệu lực |
| T-12 | 2026-09-28 | Video lô: server cấp signed upload URL của Supabase Storage, trình duyệt PUT thẳng (không đi qua Express) | Hiệu lực |
| T-13 | 2026-09-28 | Adapter storage (Supabase + bộ nhớ); bộ nhớ tự phục vụ `/api/dev-storage/*` cho dev/test | Hiệu lực |
| T-14 | 2026-09-28 | Chuỗi giao diện admin ở `src/admin/strings.js` (chỉ vi, D-48); mã lỗi vẫn ở `src/i18n/messages/*` | Hiệu lực |
| T-15 | 2026-09-28 | SSR (D-49): một Express phục vụ web + API; dev dùng Vite middleware (cổng 5173), prod dùng `dist/client` + `dist/server/entry-server.js` | Hiệu lực |
| T-16 | 2026-09-28 | Head/SEO khai báo bằng `<Seo>`; SSR thu thập qua `HeadContext`, client thay thẻ `[data-seo]`; meta robots chỉ do `useNoIndex` (client) và server (SSR) chèn | Hiệu lực |
| T-18 | 2026-09-28 | Giám sát: middleware đếm mọi request, gộp theo phút trong bộ nhớ, flush 60 giây vào `api_metrics` qua RPC `record_api_metrics` (cộng dồn nguyên tử) | Hiệu lực |
| T-19 | 2026-09-28 | Nhãn route chụp lúc `writeHead` (còn `req.route`/`req.baseUrl`); lỗi từ errorHandler dùng `req.route` còn sót + tiền tố `/api` | Hiệu lực |
| T-20 | 2026-09-28 | Phân quyền theo vai trò bằng `requireRole(auth, repo, roles)`; `ADMIN_ROLES = ['admin','it']`, `IT_ROLES = ['it']` | Hiệu lực |
| T-29 | 2026-09-28 | Mây gọi OpenAI Chat Completions bằng `fetch` (không thêm SDK); adapter `server/adapters/openai.js`, test dùng client giả `{ complete() }` | Hiệu lực |
| T-30 | 2026-09-28 | Luật của Mây thực thi ở server, không dựa vào prompt: danh sách tool cố định chỉ đọc, che PII, kiểm tra số (BR-AI-003), hạn mức, ngân sách, timeout | Hiệu lực |
| T-31 | 2026-09-28 | Cấu hình Mây lưu `app_settings` key `may`, gộp với mặc định trong `server/may/config.js` | Hiệu lực |
| T-32 | 2026-09-29 | Giỏ hàng: server luôn tính giá (`server/cart/service.js#present`); giỏ vãng lai lưu `localStorage` `moc.cart` và lấy giá qua `POST /api/cart/quote`; `CartProvider` nằm trong `LocaleLayout`, chỉ đọc storage trong effect (không lệch hydrate) | Hiệu lực |
| T-17 | 2026-09-28 | Dữ liệu SSR truyền qua `window.__INITIAL_DATA__` (key `useApi`: `path\|lang`); `useApi` dùng khi hydrate, `AppShell` xoá sau hydrate | Hiệu lực |
| T-21 | 2026-09-28 | Font tự host bằng `@fontsource` (Fraunces Variable soft + italic, Be Vietnam Pro 400/500/600), preload 6 file woff2 chính trong `index.html`; bỏ Google Fonts | Hiệu lực |
| T-22 | 2026-09-28 | Motion: `LazyMotion features={domAnimation} strict` ở `LocaleLayout` → chỉ dùng `m.*`; xuất hiện/biến mất theo `useViewState` (IntersectionObserver, `below`/`in`/`above`); animation lặp (đung đưa, marquee, hạt lửa) bằng CSS | Hiệu lực |
| T-26 | 2026-09-29 | Cân lại bảng màu theo bột màu tự nhiên của tranh Đông Hồ: nền giấy điệp nhạt hơn, son là điểm nhấn duy nhất, hoè ngả đồng, lá/hồng chỉ trong minh hoạ; tỉ lệ 70/20/7/3; mọi cặp chữ đạt WCAG AA | Hiệu lực |
| T-27 | 2026-09-29 | Ảnh tư liệu thật (tranh Đông Hồ, tranh giấy dó thế kỷ 18) từ Wikimedia Commons, chỉ public domain/CC0; WebP 480/960 ở `public/images/folk/`; nguồn ghi ở `CREDITS.md` + `src/data/folkArt.js`; hiển thị như tranh treo có chú thích, không như ảnh sản phẩm | Hiệu lực — chờ `[LEGAL]` §31.4 |
| T-28 | 2026-09-29 | Hoạ tiết lơ lửng (mây, đường vân, nét khói) tự vẽ thành bộ preset SVG (`src/data/motifs.js`) thay vì tải ngoài — Commons không có SVG hoạ tiết Việt dùng được (chỉ có biểu trưng hành chính); CSS transform/opacity + scroll-driven parallax khi hỗ trợ | Thay bởi T-36 (ảnh thật) |
| T-25 | 2026-09-29 | Bỏ phong cách "viền đen dày + bóng đổ cứng" (neo-brutalism). Dùng nét mảnh sepia, khung viền đôi, góc hoa văn triện, bóng mềm, mảng màu phẳng có hoa văn chìm — tham khảo nguyên tắc trình bày của các trang bảo tàng/di sản Trung Quốc, dịch sang hoạ tiết Việt | Hiệu lực |
| T-24 | 2026-09-28 | Hiệu ứng lấy ý tưởng từ Aceternity UI nhưng tự viết lại (không chép code — trang của họ ghi "All Rights Reserved"; không dùng Tailwind). Hiệu ứng theo con trỏ chỉ bật khi `useFinePointer()` và không giảm chuyển động | Hiệu lực |
| T-23 | 2026-09-28 | Giao diện "Đông Hồ cổ": token màu ở `src/index.css` (giữ bí danh tên cũ cho `pages.css`); texture giấy/mực là SVG nội tuyến, vẽ trên nền tĩnh — không dùng lớp phủ cố định có `mix-blend-mode`/`backdrop-filter` | Hiệu lực |
| T-33 | 2026-09-29 | Deploy Vercel: một Function `api/index.js` re-export Express `app` (web SSR + API), `vercel.json` rewrite `/(.*)→/api`, `includeFiles: dist/**`, `outputDirectory: public`; bắt buộc Supabase; upload video qua signed URL. Chi tiết: `deploy-vercel.md` | Hiệu lực |
| T-34 | 2026-09-29 | Dashboard tài khoản thanh thoát theo nguyên tắc dashboard Trung Quốc (khoảng trắng, nét 1px, một điểm nhấn son) | Hiệu lực |
| T-35 | 2026-09-29 | Dashboard kính mờ, nền ảnh thật, giao diện tối trong phạm vi `.dash` | Hiệu lực |
| T-36 | 2026-09-29 | Cảnh nền ảnh thật CC0 (`Scene`) cho trang chủ và các trang công khai, thay hoạ tiết SVG T-28 | Hiệu lực |
| T-44 | 2026-10-01 | Đăng nhập Google bằng OAuth 2.0 authorization code trực tiếp với Google (không dùng provider Google của Supabase); khung auth hai nửa `AuthShell` | Hiệu lực |
| T-45 | 2026-10-01 | Token bo góc `--r-*`, kính mờ `--g-*`, chuyển trang bằng `PageTransition` (AnimatePresence, trang thoát đóng băng router context) | Hiệu lực |
| T-46 | 2026-10-01 | Header kính mờ (ngoại lệ có chủ đích của quy tắc "dính không blur"), `AuthHeader`/`AuthFooter` riêng cho trang auth, nền auth bằng CSS, ảnh phong cảnh phủ mảng navy | Hiệu lực |

---

### T-02 — Express trong cùng repo
- **Bối cảnh**: repo chỉ có SPA; spec yêu cầu logic phía server (tính giá, webhook payOS, quyền dữ liệu của Mây — NFR-SEC-003).
- **Quyết định**: `server/` chạy Express 5, `createApp(deps)` nhận adapter qua tham số để test được. Vite dev proxy `/api` → `http://localhost:8787`.
- **Hệ quả**: mọi quy tắc nghiệp vụ (BR-*) nằm ở server; frontend chỉ hiển thị.

### T-03 / T-04 — Supabase qua adapter
- **Bối cảnh**: người dùng chọn Supabase; môi trường test/CI không có Supabase.
- **Quyết định**: `server/adapters/supabase/*` dùng `@supabase/supabase-js` với service role key (chỉ ở server). `server/adapters/memory/*` cùng interface, nạp dữ liệu từ `server/data/seed.js`. `server/index.js` chọn Supabase khi có đủ `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` (hoặc tên cũ `SUPABASE_ANON_KEY`), `SUPABASE_SECRET_KEY` (hoặc `SUPABASE_SERVICE_ROLE_KEY`); nếu thiếu → bộ nhớ và in cảnh báo.
- **Hệ quả**: schema ở `supabase/migrations/*.sql`, seed SQL ở `supabase/seed.sql` phải khớp `server/data/seed.js`. Thêm phương thức repository thì phải thêm cho **cả hai** adapter.

### T-05 — Frontend không gọi Supabase trực tiếp
- **Bối cảnh**: BR-AI-001/002 và NFR-SEC-003 yêu cầu backend kiểm quyền; muốn một bề mặt API duy nhất.
- **Hệ quả**: không đưa key Supabase vào bundle frontend. Supabase Auth được bọc bởi `/api/auth/*`.

### T-06 / T-07 — Đa ngôn ngữ
- Cột văn bản của thực thể: `jsonb` `{ "vi": "...", "en": "...", "zh": "..." }`. Server trả về chuỗi đã chọn theo `?lang=`; thiếu bản dịch → `vi` (D-40).
- URL: `/` (vi), `/en/…`, `/zh/…` (D-37).

### T-10 — Lưu token
- Đơn giản, đủ cho giai đoạn nền tảng. Cần xem lại (cookie httpOnly) trước go-live — rủi ro XSS.

### T-12 — Tải video lô bằng signed upload URL
- **Bối cảnh**: video có thể vài trăm MB; đi qua Express tốn bộ nhớ/thời gian và vướng giới hạn body. T-05 cấm đưa key Supabase vào frontend.
- **Quyết định**: `POST /api/admin/batches/:id/video-upload` → server gọi `createSignedUploadUrl(path)` → trình duyệt `PUT` file lên URL đó (XHR để có %). Sau đó `POST /api/admin/batches/:id/video { path }` → server `info(path)` kiểm tra file có thật, đúng dung lượng rồi mới gắn `video_url`.
- **Hệ quả**: mỗi lần tải là một đường dẫn mới `<batchId>/<timestamp>-<rand>.<ext>`; video cũ không bị ghi đè (D-10). Chưa thử với Supabase thật (G-22). Bucket `batch-videos` tạo bằng migration, đặt giới hạn file ≥ `MAX_VIDEO_MB`.

### T-33 — Deploy Vercel
- **Bối cảnh**: D-49 chọn một server Express cho web + API; Vercel chỉ có hàm serverless.
- **Quyết định**: giữ nguyên Express, bọc bằng `api/index.js`; `server/index.js` export `app` và bỏ `listen` khi `VERCEL` (SSR đọc `dist/**` nên phải `includeFiles`; `outputDirectory: public` để CDN không trả `index.html` rỗng cho `/`).
- **Hệ quả**: không adapter bộ nhớ ở môi trường Vercel; số liệu API có thể thiếu do flush theo timer (G-35). Quy tắc và biến môi trường: `deploy-vercel.md`.

### T-15 / T-16 / T-17 — SSR
- **Bối cảnh**: §23.2 yêu cầu HTML render sẵn; D-49 chọn SSR trong Express để dữ liệu admin sửa hiện ngay.
- **Quyết định**:
  - `server/ssr.js#renderPage` phân loại đường dẫn (`src/seo/routes.js`): trang công khai → nạp dữ liệu bằng `server/services/catalog.js` (cùng hàm với API) → `render()` của `src/entry-server.jsx` → chèn vào `index.html` (`<!--app-head-->`, `<!--app-html-->`, `<!--app-data-->`). Trang riêng tư → khung HTML rỗng + noindex.
  - `src/main.jsx`: `#root` có nội dung → `hydrateRoot`, rỗng → `createRoot`.
  - Mỗi trang render `<Seo>`; trang con thắng. `status` trong `<Seo>` thành mã HTTP khi SSR.
- **Hệ quả / quy tắc khi thêm trang**:
  - Trang công khai mới: thêm vào `classifyPath` + `dataKeysFor` (mọi `useApi` của trang phải có key tương ứng, nếu không sẽ lệch hydrate), render `<Seo path=…>`.
  - Trang riêng tư mới: thêm vào `PRIVATE` trong `src/seo/routes.js`, render `<Seo noindex>`.
  - Không đọc `window`/`localStorage` trong lúc render của trang công khai (chỉ trong effect).
  - Không dùng `import … from 'react-router'` trong code chạy SSR — dùng `react-router-dom` để cùng một context.

### T-18 / T-19 — Số liệu API
- `server/monitoring/metrics.js`: `createMetrics({ repo, classify })` → `middleware`, `flush`, `summary(range)`, `recentErrors(range)`, `start/stop`. `server/index.js` gọi `start()` và `stop()` (flush) khi SIGTERM/SIGINT.
- Dashboard đọc dữ liệu đã lưu + phần chưa flush, nên số liệu thấy ngay.
- Flush lỗi → bỏ lô đó và ghi log (tránh bộ nhớ phình) — chấp nhận mất tối đa 1 phút số liệu.
- Thêm route mới không cần làm gì thêm: nhãn tự lấy từ mẫu route Express.

### T-29 / T-30 — AI Mây
- Luồng một lượt (`server/may/service.js#chat`): kiểm tra độ dài → hạn mức (`incrementMayCounter`) → cờ OpenAI/khoá/ngân sách (offline nếu không đạt) → vòng gọi OpenAI + tool (≤ 4 vòng, `AbortController` 15 giây) → ghi chi phí → kiểm tra số → lưu lịch sử nếu đã đăng nhập.
- Thêm tool mới: khai báo trong `MAY_TOOLS` và `runTool` (`server/may/tools.js`); chỉ trả trường cần thiết, không có thao tác ghi (BR-AI-006). Khi làm đơn hàng: thêm `get_my_orders` (dùng `user` của phiên, không nhận user từ model) và `lookup_order` có chống dò.
- Frontend: `src/may/May.jsx` (nút + tour, lazy-load khung chat, error boundary). Tour chỉ tự bật ở trang chủ.

### T-21 / T-22 / T-23 — Giao diện dân gian cổ + motion
- **Bối cảnh**: khách hàng yêu cầu web "nghệ thuật dân gian, cổ xưa, hoài niệm", motion tốt (cả xuất hiện và biến mất), hiệu năng tốt. Google Fonts chặn render và làm LCP chậm (~1,5 s đo local).
- **Quyết định**:
  - T-21: `src/main.jsx` import CSS của `@fontsource`; `index.html` preload font tiêu đề (Fraunces latin + vietnamese, thường + nghiêng) và thân bài (Be Vietnam Pro 400) qua đường dẫn `/node_modules/...` — Vite đổi sang file có hash khi build. Bỏ preload → chữ nhảy khi đổi font (CLS ~0,04).
  - T-22: `src/lib/motion.js#useViewState(ref, margin)` trả `'below' | 'in' | 'above'`; `<Reveal>` truyền trạng thái cho con `m.*` cùng tên biến thể. Biến mất đi theo hướng cuộn (trên → lui lên, dưới → lui xuống). Không có IntersectionObserver → `'in'`. `CountUp` render giá trị thật khi SSR, chỉ đếm ở client; dùng `useReducedMotionConfig` (theo `MotionConfig`), không dùng `useReducedMotion` (chỉ đọc thiết bị một lần).
  - T-23: texture (sợi dó, vết ố, mực mòn) là data-URI SVG trong biến CSS `--tex-*`; viền tối quanh khung nhìn là một gradient tĩnh `position: fixed` không blend.
- **Hệ quả / quy tắc**:
  - Component dưới `LocaleLayout` dùng `m.div`… — `motion.div` sẽ throw vì `strict`.
  - Thêm khối cần hiệu ứng: bọc `<Reveal variants={group}>`, con dùng `variants={rise|ink|stamp}`. Hiệu ứng lặp mới: viết bằng CSS keyframes transform/opacity; `pages.css` đã tắt mọi animation CSS khi `prefers-reduced-motion`.
  - Nội dung trong `Reveal` có `opacity: 0` trong HTML SSR tới khi JS chạy (như trước khi đổi giao diện) — xem G-34.

### T-24 — Hiệu ứng tham khảo Aceternity UI
- **Bối cảnh**: người dùng yêu cầu tham khảo Aceternity UI (ui.aceternity.com). Bộ đó là component copy-paste dựa trên Tailwind + framer-motion, bản quyền "All Rights Reserved" của Aceternity Labs.
- **Quyết định**: chỉ lấy ý tưởng, tự viết bằng CSS thuần + `m.*`, ở `src/components/Effects.jsx` và `HomePage.jsx`:

  | Ý tưởng Aceternity | Ở MỘC |
  |---|---|
  | Lamp Effect | `LampHead` — đèn treo rọi nón sáng xuống tiêu đề lookbook |
  | Spotlight / Following Pointer | `PointerGlow` — quầng đèn theo con trỏ ở hero |
  | 3D Card + Card Spotlight | `TiltCard` — thẻ sản phẩm |
  | Text Generate Effect | `InkWords` — lời nghệ nhân |
  | Tracing Beam / Timeline | `ProcessTimeline` — sợi chỉ đỏ theo cuộn, bước đã qua có `is-lit` |
  | Moving Border | class `.thread` — nút chính |
  | Focus Cards | CSS `:has()` trong lookbook |
  | Sparkles / Shooting Stars | `SkyLanterns` — đèn trời |
  | Text Hover Effect | `BrandHover` — chữ MỘC ở footer |

- **Hệ quả**:
  - Hiệu ứng theo con trỏ không gắn handler trên thiết bị cảm ứng hoặc khi giảm chuyển động; cập nhật qua motion value, không re-render.
  - Thẻ có `TiltCard` không được `overflow: hidden` (làm phẳng lớp 3D).
  - `.thread` cần `@property` (Chrome/Edge, Safari 16.4+, Firefox 128+); trình duyệt cũ thấy viền đứng yên.
  - Màn hình đầu dùng animation CSS thay framer để chữ tiêu đề không bị `opacity: 0` trong HTML SSR (giảm G-34).

### T-25 — Phong cách cổ điển (thay neo-brutalism)
- **Bối cảnh**: người dùng nhận xét các khối viền đen dày + bóng đổ cứng "chưa cổ điển", yêu cầu tham khảo web văn hoá dân gian Trung Quốc.
- **Nguồn đã xem** (chụp màn hình ngày 2026-09-29): Cố Cung (dpm.org.cn), Cố Cung Danh Hoạ Ký (minghuaji.dpm.org.cn), Số hoá văn vật Cố Cung (digicol.dpm.org.cn), Đôn Hoàng số (e-dunhuang.com), Hoa Tây Tử (huaxizi.com), Bảo tàng Lịch sử Thiểm Tây (sxhm.com). Không truy cập được: ihchina.cn, szmuseum.com (lỗi upstream), chnmuseum.cn (quá thời gian).
- **Nguyên tắc rút ra → áp dụng ở MỘC** (không dùng chữ Hán, rồng, mái cung điện Trung Hoa):
  - Không viền dày/bóng cứng → token `--hair`, `--hair-soft`; `--print`/`--print-lg` là bóng mềm.
  - Khung viền đôi mảnh + góc hồi văn (Danh Hoạ Ký) → `--corner-*` (góc triện) cho thiếp thư testimonials; `border: 3px double` cho nav, marquee, FAQ.
  - Khung góc lõm (Hoa Tây Tử) → `.product-art::after` khoét 4 góc như ô hộc cửa bức bàn.
  - Mái cong làm đường chuyển (Thiểm Tây) → mái đình Việt: nóc phẳng, mặt nguyệt, đầu đao (`--roof-mask`, có bản riêng cho màn hẹp).
  - Logo dọc + dấu son (Đôn Hoàng) → `VerticalSeal` (ấn triện dọc) ở hero thay dấu bưu điện.
  - Mảng màu phẳng có hoa văn chìm (Cố Cung) → `--pat-cloud` trên nền chàm.
  - Tab gạch chân, cột ngăn bằng nét chấm → tab Mua tặng/Mua cho mình, số liệu, công đoạn.
  - Nút như ấn son: góc 3px, đường chỉ sáng bên trong bằng `box-shadow: inset`.
- **Hệ quả**: không thêm lại `border: 2px solid var(--than)` hay bóng lệch cứng; khung mới dùng `--hair` + góc triện.

### T-26 — Cân lại bảng màu
- **Bối cảnh**: nhiều màu mạnh ngang nhau (son, hoè, chàm, lá, hồng cá hồi); nền giấy quá vàng sẽ lấn màu tranh thật khi thêm ảnh tư liệu.
- **Quyết định**: token mới ở `src/index.css` (bảng và tỉ lệ ở [`design-rules.md`](design-rules.md) §2). Đã đo tương phản: mọi cặp chữ ≥ 4,5:1; `--sepia` làm đậm thành `#7a5d3c` để dùng cho chữ nhỏ. Bỏ màu viết cứng `#3a2a1e`, `#e9876b` → `--than-2`, `--hong`; các `rgba()` theo màu cũ đổi theo màu mới.

### T-27 — Ảnh tư liệu
- **Nguồn**: Wikimedia Commons, tải bằng API có User-Agent riêng, kích thước chuẩn (1280) để tránh bị giới hạn tần suất. Chỉ nhận `Public domain`/`CC0`; loại ảnh có trẻ em nhận diện được.
- **Xử lý**: `sharp` → WebP 480/960 (chỉ các cỡ ≤ ảnh nguồn, danh sách `widths`), không chỉnh màu, không cắt; tải bản thu nhỏ cỡ chuẩn từ `thumb.wikimedia.org` (file gốc bị 429, Retry-After 600s); script ở ngoài repo, kết quả + `CREDITS.md` trong `public/images/folk/`.
- **Hiển thị**: `FolkGallery` (phần Di sản) — khung tranh bồi trên vách chàm, tên + nguồn dưới mỗi tranh, ghi chú "không phải ảnh sản phẩm". `alt`/chú thích qua i18n.
- **Hệ quả**: thêm ảnh mới phải cập nhật `CREDITS.md` và `folkArt.js`; không dùng ảnh tư liệu ở vị trí sản phẩm/nghệ nhân.

### T-34 — Dashboard tài khoản thanh thoát (tham khảo dashboard Trung Quốc)
- **Bối cảnh**: bản dashboard tab dọc đầu tiên (thanh bên chàm, khung tranh bồi, bóng đổ) bị nhận xét "chưa đủ thanh thoát, thanh lịch"; người dùng yêu cầu tham khảo dashboard Trung Quốc.
- **Nguồn tham khảo** (mức nguyên tắc): hệ thiết kế Ant Design, TDesign, Arco (bố cục thanh bên + nội dung, dải số liệu tổng quan); bài viết về 留白 (khoảng trắng) và phong cách 新中式 trên woshipm.com.
- **Nguyên tắc rút ra → áp dụng**: nền sáng, nhiều khoảng trắng; mọi đường kẻ 1px cùng một độ đậm (`--dash-line`); bỏ bóng đổ và khung trang trí trong dashboard; một điểm nhấn son (vạch tab chọn, vạch trước tiêu đề mục, nút chính); số liệu chữ mảnh cỡ lớn trên dải ngăn bằng nét dọc; nhãn ngắn một dòng. Không dùng chữ Hán, hoạ tiết cung đình (như T-25).
- **Hệ quả**: chi tiết ở [`design-rules.md`](design-rules.md) §12. Trang công khai giữ phong cách T-25.
- **Bổ sung (v0.13)**: theo yêu cầu người dùng "bo các góc và thêm nhiều hình ảnh minh hoạ cho sinh động" — thẻ bo 20px, nút viên; thêm minh hoạ SVG tự vẽ (`DashArt.jsx`). Không dùng ảnh tư liệu Wikimedia vì còn chờ `[LEGAL]` Q-36 và không được đặt ở vị trí gây hiểu lầm (design-rules §7.2).

### T-35 — Dashboard kính mờ, nền mây khói, giao diện tối
- **Bối cảnh**: người dùng yêu cầu "beauty glassmorphism hơn một chút", nền có dải màu như mây khói lơ lửng hoặc đèn lồng bay lên khi mới vào, và dark mode (D-65).
- **Quyết định**:
  - Kính mờ bằng `backdrop-filter` chỉ trên thẻ cuộn cùng trang; phần tử dính dùng nền trong không làm mờ (tránh vẽ lại liên tục khi cuộn — design-rules §9). Nền phía sau là gradient + dải khói mờ trôi bằng `transform` (lớp compositor).
  - Đèn trời chạy **một lượt** (`animation-iteration-count: 1`, `forwards`) để không tốn tài nguyên sau khi vào trang.
  - Giao diện tối chỉ trong phạm vi `.dash` bằng `data-theme` + đổi token CSS; lựa chọn lưu `localStorage` (`moc.dashTheme`), mặc định `prefers-color-scheme`. Không làm dark mode toàn site ở bước này vì trang công khai có nhiều màu minh hoạ cố định.
- **Hệ quả**: bí danh màu cũ phải khai báo lại trong phạm vi tối (biến tính ở `:root` không tự đổi). Minh hoạ SVG nét mực cần nền sáng phía sau ở chế độ tối.
- **Bổ sung (v0.15)**: người dùng yêu cầu "tìm asset trên mạng/Canva chứ không tự vẽ SVG ở background". Nền và cảnh đầu trang chuyển sang ảnh thật CC0 tìm qua Openverse (rawpixel, StockSnap). Xử lý ảnh bằng Pillow: đèn trời tách nền trời trắng theo khoảng cách màu; khói nền đen → alpha theo độ sáng (giữ màu), làm mờ mép; nén WebP (tổng ~250 KB, lớn nhất 148 KB). Không dùng Canva: giấy phép Canva cấm dùng phần tử riêng lẻ ngoài thiết kế Canva, và phiên làm việc không có kết nối Canva. Biểu tượng nhỏ trong thẻ (hộp quà, phong thư, 4 công đoạn) vẫn là SVG vì là biểu tượng, không phải nền.

### T-36 — Cảnh nền ảnh thật cho trang công khai (thay hoạ tiết T-28)
- **Bối cảnh**: người dùng muốn nền là ảnh thật tìm trên mạng (không tự vẽ SVG), thêm vào trang chủ và các trang khác, cùng chủ đề với dashboard nhưng ảnh khác (D-66).
- **Quyết định**: component `Scene` + bộ ảnh `public/images/scene` (Openverse, CC0: rawpixel, StockSnap, WordPress Photo Directory). Gỡ `FloatingMotifs`/`motifs.js` (T-28 hết hiệu lực). Trang khác: `LocaleLayout` chọn cảnh theo đường dẫn (`pageScene`), 404 tự đặt khung đêm. Đèn trời ở lookbook đổi từ khối CSS sang ảnh đèn thật tách nền.
- **Hiệu năng**: WebP 640/1280 + `srcset`, lazy; hero `eager` với `fetchpriority="low"` để không tranh LCP; ảnh trang chủ < 600 KB. Mask + opacity tĩnh; chỉ khói/đèn chuyển động bằng `transform`.
- **Dashboard mobile**: thanh tab cố định ở đáy — phần tử `fixed` nên không dùng `backdrop-filter` (§9).


### T-37 — Security headers và CSP dùng hash (không dùng nonce)
- **Bối cảnh**: chuẩn bị chạy thật, cần header bảo mật cho mọi response. Bản đầu dùng nonce sinh mỗi request.
- **Vấn đề phát hiện khi kiểm thử**: trang công khai đặt `s-maxage=60` để CDN Vercel giữ bản dùng chung (xem T-39). Nonce nằm trong **cả** header CSP lẫn thân HTML, nên CDN phát lại đúng một nonce cho mọi khách trong suốt thời gian cache — nonce dùng lại thì không còn tác dụng gì so với `unsafe-inline`.
- **Quyết định**: CSP cho script nội tuyến do SSR sinh (`gtag`, `window.__INITIAL_DATA__`) dùng **hash `sha256`** tính trên đúng nội dung của từng response (`cspHash` ở `server/middleware/security.js`, `renderPage` trả `scriptHashes`). Hash công khai theo thiết kế và luôn khớp bản được cache.
- **Chi tiết khác**: `style-src` buộc có `'unsafe-inline'` vì React/framer-motion đặt style nội tuyến trên phần tử. CSP chỉ bật khi `NODE_ENV=production` (dev Vite chèn script nội tuyến riêng). HSTS chỉ gửi khi request qua HTTPS. Host ngoài (GA, Supabase) mở **đúng host**, không dùng `*`.
- **Hệ quả**: thêm script nội tuyến mới ở SSR thì phải thêm hash của nó vào `page.scriptHashes`, nếu không trình duyệt sẽ chặn im lặng.

### T-38 — Chống dò/spam đếm trong DB (G-20)
- **Bối cảnh**: trên Vercel mỗi request có thể rơi vào một tiến trình khác, nên bộ đếm trong bộ nhớ tiến trình vô dụng.
- **Quyết định**: dùng lại `repo.incrementMayCounter(key, ttl)` (đã có cho hạn mức Mây) làm bộ đếm có hạn dùng, tăng nguyên tử trong DB. Cửa sổ trượt theo **khối**: mỗi khối một khoá, hết khối khoá tự hết hạn.
- **Riêng tư**: khoá đếm là `rl:<tên>:<băm(giá trị, MAY_HASH_SALT)>:<khối>` — không lưu IP hay email thô (NFR-PRV-002).
- **Đếm theo cả IP và email** với đăng nhập/đăng ký/quên mật khẩu: chỉ đếm theo IP thì đổi IP là dò tiếp được; chỉ đếm theo email thì quét nhiều email từ một IP vẫn lọt.
- **Hệ quả**: `TRUST_PROXY=1` là bắt buộc trên Vercel, nếu không mọi request mang IP của hạ tầng và một người bị chặn sẽ chặn cả site. `RATE_LIMIT=0` chỉ dùng cho test tự động.

### T-39 — Cache CDN theo "có phụ thuộc phiên đăng nhập hay không"
- **Quyết định**: trang SSR công khai (`/`, sản phẩm, **và trang lô `/lo/:code`**) trả `public, max-age=0, s-maxage=60, stale-while-revalidate=300`; trang phụ thuộc phiên (giỏ, checkout, tài khoản, chi tiết đơn, admin, IT) trả `private, no-store`; `/api/*` luôn `no-store`.
- **Lý do không dùng `noindex` làm tiêu chí**: trang lô là trang công khai in trên đèn, `noindex` chỉ vì D-44 không muốn nó lên kết quả tìm kiếm — nó vẫn nên qua CDN vì bị quét rất nhiều.
- **Hệ quả**: nếu sau này SSR render nội dung theo phiên đăng nhập (ví dụ tên khách trên trang chủ) thì **phải** bỏ `s-maxage` cùng lúc, nếu không nội dung của một khách sẽ bị phát cho khách khác.

### T-40 — Bảng giá sinh ra từ một hàm duy nhất
- **Quyết định**: `quoteCart()` trong `server/orders/service.js` là nơi duy nhất tính bảng giá; trang checkout và bước tạo đơn đều gọi nó. Client gửi kèm `expectedTotal` (tổng khách nhìn thấy); lệch → 409 `PRICE_CHANGED` kèm bảng giá mới (§12, D-41).
- **Lý do**: hai đường tính giá riêng là nguồn sai lệch tiền kinh điển — số khách thấy khác số bị trừ.
- **Hệ quả**: mọi thay đổi về giá/khuyến mãi phải làm trong `server/domain/pricing.js` + `quoteCart`, không tính lại ở frontend.

### T-41 — Khoá lạc quan cho chuyển trạng thái đơn
- **Quyết định**: mọi thay đổi trạng thái đơn đi qua `repo.updateOrderIfStatus(id, trạngThaiKỳVọng, giáTrịMới)` — chỉ ghi khi trạng thái hiện tại đúng như lúc đọc.
- **Lý do**: khách bấm huỷ đúng lúc webhook payOS báo đã trả tiền là tình huống có thật; không có khoá thì cả hai cùng "thành công" và đơn rơi vào trạng thái mâu thuẫn.
- **Hệ quả**: nơi gọi phải xử lý trường hợp trả `null` (trạng thái vừa đổi) — trả 409 cho client, không ghi đè.

### T-42 — Vercel Web Analytics bên cạnh GA
- **Quyết định**: `src/main.jsx` gọi `inject()` của `@vercel/analytics` ở client; `beforeSend` đưa URL qua `sanitizePath` (bỏ query/hash, che token QR) như GA.
- **Lý do**: số liệu truy cập không cookie, không cần đổi CSP (script và kết nối đều cùng origin); NFR-PRV-002 vẫn giữ.
- **Hệ quả**: phải bật Web Analytics trong dashboard Vercel của project; chưa bật thì `/_vercel/insights/script.js` trả 404 (vô hại).

### T-43 — Báo cáo GA realtime gọi GA4 Data API bằng `fetch` + JWT tự ký
- **Bối cảnh**: yêu cầu thêm báo cáo GA realtime vào admin. Mã đo `G-…` chỉ để gửi sự kiện; đọc số liệu cần GA Data API với OAuth.
- **Quyết định**: `server/adapters/gaRealtime.js` ký JWT RS256 bằng `node:crypto` (service account), đổi lấy access token, gọi `properties/{id}:runRealtimeReport` bằng `fetch` — không thêm SDK `googleapis` (nặng, cùng lý do T-29). Token giữ trong bộ nhớ (promise dùng chung để 5 báo cáo song song chỉ đổi token một lần), kết quả cache 15 giây. Test dùng `fetchImpl` giả.
- **Cấu hình**: `GA_PROPERTY_ID` + `GA_SERVICE_ACCOUNT_JSON` (JSON hoặc base64) hoặc `GA_CLIENT_EMAIL` + `GA_PRIVATE_KEY`. Thiếu → `configured:false`. Khoá chỉ ở server; lỗi Google đổi sang mã `GA_*`, không chuyển nguyên văn cho client.
- **Hệ quả**: cache theo từng instance serverless nên hiệu quả giảm khi có nhiều instance — chấp nhận, hạn mức realtime của GA đủ rộng cho vài admin.

### T-44 — Đăng nhập Google: OAuth trực tiếp, state trong cookie ký

- **Bối cảnh**: PO yêu cầu dùng cấu hình OAuth của Google Cloud, không dùng provider Google có sẵn của Supabase (D-78).
- **Quyết định**: server tự làm luồng authorization code: `GET /api/auth/google/start` (đặt cookie `lamvi_gauth` HttpOnly, SameSite=Lax, Secure khi https, ký HMAC bằng `MAY_HASH_SALT`, chứa state + nonce + next + lang, hạn 10 phút — không giữ trạng thái trong bộ nhớ vì serverless) → Google → `GET /api/auth/google/callback` đổi code lấy `id_token` qua TLS (kiểm `aud`, `iss`, `exp`, `nonce`, `email_verified`; không cần kiểm chữ ký vì nhận trực tiếp từ endpoint token của Google). Cấp phiên cho email đã xác minh bằng `auth.signInVerifiedEmail`: Supabase = `admin.generateLink({type:'magiclink'})` (tạo user nếu chưa có, không gửi email) + `verifyOtp(token_hash)`; adapter bộ nhớ tự tạo user. Phiên trả về trình duyệt qua **fragment** (`/auth/callback#s=…`) để không vào log máy chủ; trang `AuthCallbackPage` lưu phiên (`acceptSession`) rồi xoá fragment.
- **Cấu hình**: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`; redirect URI `{PUBLIC_SITE_URL}/api/auth/google/callback`. Thiếu → `/api/auth/providers` trả `google:false`, nút ẩn.
- **Hệ quả**: không phụ thuộc cài đặt provider của Supabase; rate limit dùng nhóm `login`. Tài khoản tạo bằng Google không có mật khẩu đã biết.

### T-45 — Bo góc, kính mờ, chuyển trang

- **Token** (`src/index.css`): `--r-xs 8 / --r-sm 12 / --r-md 20 / --r-lg 28px`; kính `--g-bg`, `--g-bg-strong`, `--g-border`, `--g-blur`, `--g-shadow`. Thẻ (`.product-card`, `.testimonial-card`, `.account-card`, `.order-summary`, `.product-detail-art`, `.auth-card`) dùng kính; đường chỉ bồi tranh (`::before/::after`) bo theo `bán kính thẻ − khoảng lùi`. Có `@supports not (backdrop-filter)` tăng độ đục.
- **Chuyển trang**: `LocaleLayout` bọc `<main>` bằng `PageTransition` (`AnimatePresence mode="wait"`, key = ngôn ngữ + đường dẫn không dấu `/` cuối). Thoát 0,22 s (mờ + trôi lên 10px), vào 0,5 s (trồi từ 18px). Dùng đối tượng animate trực tiếp, không dùng tên biến thể, để không lan xuống `m.*` bên trong. Về đầu trang sau khi trang mới bắt đầu vào (trừ khi URL có `#neo`).
- **Bẫy đã gặp**: trang đang thoát vẫn nằm trong cây React nên đọc location mới của router; `<Navigate>` của trang cũ chạy lại mỗi lần đổi đường dẫn → vòng lặp vô hạn (test treo). `Frozen` đóng băng `LocationContext`/`RouteContext` khi `useIsPresent()` là false.
- **Giảm chuyển động / SSR**: `useReducedMotionConfig()` → render `<main>` thường; lần vào đầu `initial={false}` nên HTML SSR hiện đủ nội dung.
- **Hệ quả**: nội dung trang mới chỉ render sau ~0,22 s → test cấp ứng dụng phải chờ đủ lâu (đã nới `flush` ở `Seo.extra.test.jsx`).

### T-46 — Header kính mờ, header riêng cho auth, ảnh phủ mảng navy

- **Header kính mờ**: `.nav` dùng `--g-blur` (blur 14px) dù `position: sticky`. Đây là ngoại lệ có chủ đích của design-rules §9, do PO yêu cầu (D-80); chỉ `.nav`. Test `AccountTheme.extra.test.jsx` cho phép riêng `.nav`. Rủi ro: vẽ lại khi cuộn trên máy yếu — nếu có báo cáo giật, hạ blur xuống 8px hoặc quay lại nền đặc.
- **Auth**: `LocaleLayout` chọn `AuthHeader`/`AuthFooter` khi đường dẫn thuộc `AUTH_PAGES`. Header chỉ có logo, `LanguageSwitcher`, nút chuyển đăng nhập ↔ đăng ký; không có `.nav-links`, không link neo. Scene `auth` không còn ảnh, nền là `radial-gradient` hoè/son/chàm mờ.
- **Ảnh**: `bay-green` (Di sản, 20%, giảm bão hoà) và `hills-gold` (Lookbook, 34%, ảnh ở nửa dưới) thay `halong-mist`/`lanterns-night`; nguồn CC0 ghi ở `public/images/scene/CREDITS.md`. `hills-gold` gốc 1024px nên bản 1280px là phóng nhẹ — chấp nhận vì độ đậm thấp.
- **Ảnh auth (D-81)**: `AuthShell` đặt `public/images/auth/lantern-river-{640,1024}.webp` trong `.auth-aside` (chiếm 74% chiều cao, tan dần về chàm đêm bằng mask để câu chữ nằm trên mảng tối). ≤760px: ảnh phủ cả dải đầu thẻ, ẩn câu trích. Bộ ảnh `auth` tách riêng khỏi `scene` và `dash`.
