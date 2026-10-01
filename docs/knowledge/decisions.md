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
| T-21 | 2026-09-28 | Mây gọi OpenAI Chat Completions bằng `fetch` (không thêm SDK); adapter `server/adapters/openai.js`, test dùng client giả `{ complete() }` | Hiệu lực |
| T-22 | 2026-09-28 | Luật của Mây thực thi ở server, không dựa vào prompt: danh sách tool cố định chỉ đọc, che PII, kiểm tra số (BR-AI-003), hạn mức, ngân sách, timeout | Hiệu lực |
| T-23 | 2026-09-28 | Cấu hình Mây lưu `app_settings` key `may`, gộp với mặc định trong `server/may/config.js` | Hiệu lực |
| T-24 | 2026-09-29 | Giỏ hàng: server luôn tính giá (`server/cart/service.js#present`); giỏ vãng lai lưu `localStorage` `moc.cart` và lấy giá qua `POST /api/cart/quote`; `CartProvider` nằm trong `LocaleLayout`, chỉ đọc storage trong effect (không lệch hydrate) | Hiệu lực |
| T-25 | 2026-10-01 | payOS qua adapter (`server/payments/payos.js`); thiếu `PAYOS_*` → dev dùng payOS giả lập (`fakePayos.js`, trang `/api/dev/payos/:mã`, gửi webhook có chữ ký thật vào chính server), production tắt payOS (chỉ COD) | Hiệu lực |
| T-26 | 2026-10-01 | Đơn hàng: `updateOrder` compare-and-set theo trạng thái; tạo đơn qua RPC `create_order` (khoá coupon); `clientKey` chống tạo trùng; mọi thay đổi ghi `audit_log` qua `server/orders/audit.js` (lỗi ghi log không làm hỏng thao tác); dọn đơn quá hạn mỗi phút trong `server/index.js` | Hiệu lực |
| T-17 | 2026-09-28 | Dữ liệu SSR truyền qua `window.__INITIAL_DATA__` (key `useApi`: `path\|lang`); `useApi` dùng khi hydrate, `AppShell` xoá sau hydrate | Hiệu lực |

---

### T-02 — Express trong cùng repo
- **Bối cảnh**: repo chỉ có SPA; spec yêu cầu logic phía server (tính giá, webhook payOS, quyền dữ liệu của Mây — NFR-SEC-003).
- **Quyết định**: `server/` chạy Express 5, `createApp(deps)` nhận adapter qua tham số để test được. Vite dev proxy `/api` → `http://localhost:8787`.
- **Hệ quả**: mọi quy tắc nghiệp vụ (BR-*) nằm ở server; frontend chỉ hiển thị.

### T-03 / T-04 — Supabase qua adapter
- **Bối cảnh**: người dùng chọn Supabase; môi trường test/CI không có Supabase.
- **Quyết định**: `server/adapters/supabase/*` dùng `@supabase/supabase-js` với service role key (chỉ ở server). `server/adapters/memory/*` cùng interface, nạp dữ liệu từ `server/data/seed.js`. `server/index.js` chọn Supabase khi có đủ `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`; nếu thiếu → bộ nhớ và in cảnh báo.
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

### T-21 / T-22 — AI Mây
- Luồng một lượt (`server/may/service.js#chat`): kiểm tra độ dài → hạn mức (`incrementMayCounter`) → cờ OpenAI/khoá/ngân sách (offline nếu không đạt) → vòng gọi OpenAI + tool (≤ 4 vòng, `AbortController` 15 giây) → ghi chi phí → kiểm tra số → lưu lịch sử nếu đã đăng nhập.
- Thêm tool mới: khai báo trong `MAY_TOOLS` và `runTool` (`server/may/tools.js`); chỉ trả trường cần thiết, không có thao tác ghi (BR-AI-006). Khi làm đơn hàng: thêm `get_my_orders` (dùng `user` của phiên, không nhận user từ model) và `lookup_order` có chống dò.
- Frontend: `src/may/May.jsx` (nút + tour, lazy-load khung chat, error boundary). Tour chỉ tự bật ở trang chủ.

### T-25 / T-26 — Checkout, đơn hàng, payOS
- **Tính giá** chỉ ở `server/orders/pricing.js#priceOrder` (VAT D-62, ship D-63, coupon D-65…D-67). Checkout gửi `expectedTotal`; server tính lại, lệch → 409 `PRICE_CHANGED` (D-41).
- **Tạo đơn**: kiểm tra giỏ/coupon/COD → `repo.createOrder` (RPC nguyên tử) → payOS `createPaymentLink` (orderCode = `orders.code`) → bỏ các dòng đã mua khỏi giỏ. payOS lỗi → huỷ đơn (`payment_error`), 502.
- **Thanh toán**: webhook (đã xác minh chữ ký) → `payment_events` (chống trùng) → `applyPaid`: khớp số tiền → CONFIRMED; lệch → huỷ + chờ hoàn tiền + cờ `AMOUNT_MISMATCH`; đơn đã huỷ → chờ hoàn tiền + cờ `PAID_AFTER_CANCEL`. Đơn chờ thanh toán được đối soát khi xem (tối đa 10 giây/lần) và khi quá hạn.
- **Thử payOS thật** (G-33): đặt `PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`; đăng ký webhook `https://<tên miền>/api/payments/payos/webhook` trong trang payOS; `PUBLIC_SITE_URL` phải đúng để returnUrl/cancelUrl đúng.
- **Thêm thao tác admin trên đơn**: thêm vào `ADMIN_ACTIONS` + `switch` trong `server/orders/admin.js`, luôn qua `transition()` để có compare-and-set và nhật ký.
