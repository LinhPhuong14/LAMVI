# Quyết định kỹ thuật (T-xx)

Quyết định nghiệp vụ nằm ở Phụ lục A của [`ba-spec.md`](../ba-spec.md) (`D-xx`). File này chỉ chứa quyết định kỹ thuật. Mỗi mục: bối cảnh → quyết định → hệ quả. Không xóa mục cũ; nếu thay, đánh dấu **Bị thay bởi T-yy**.

| ID | Ngày | Quyết định | Trạng thái |
|---|---|---|---|
| T-01 | 2026-09-28 | Frontend: React 19 + Vite, định tuyến bằng `react-router-dom` | Hiệu lực |
| T-02 | 2026-09-28 | Backend: Node + Express 5 trong cùng repo (`server/`), API dưới `/api` | Hiệu lực |
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
