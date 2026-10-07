# Quy ước

## Chung

- JavaScript ES modules (`"type": "module"`), không TypeScript (T-01). Định dạng như code hiện có: 2 dấu cách, nháy đơn, không chấm phẩy.
- Chú thích trong code viết tiếng Việt, ngắn; khi code hiện thực một quy tắc spec thì ghi mã (`// BR-PRC-003`, `// D-40`).
- Nhánh: `feat/…`, `fix/…`, `docs/…`. Commit message tiếng Việt, câu mệnh lệnh ngắn ("Thêm API catalog…").
- Không tự hiện thực điểm `[BA DECISION REQUIRED]`/`[LEGAL]`. Nếu buộc phải có chỗ trống trong code, để `// TODO(Q-xx)` và không đoán giá trị.

## Server (`server/`)

- `createApp({ repo, auth })` — không đọc env trong `app.js`; env chỉ đọc ở `server/config.js` / `server/index.js`.
- Route mỏng: kiểm tra đầu vào → gọi repository/auth → trả JSON. Quy tắc nghiệp vụ đặt trong `server/domain/*` (hàm thuần, test riêng được).
- Mọi dữ liệu hiển thị cho khách lọc theo trạng thái công khai **ở server** (vd sản phẩm `published`, lô `video_published`).
- Định dạng lỗi thống nhất:

  ```json
  { "error": { "code": "VALIDATION_ERROR", "message": "…", "fields": { "email": "INVALID_EMAIL" } } }
  ```

  `code` là hằng số tiếng Anh viết hoa; frontend dịch `code` sang thông điệp theo ngôn ngữ. Không trả thông điệp lỗi gốc của Supabase ra ngoài.
- Mã HTTP: 400 dữ liệu sai, 401 chưa/sai đăng nhập, 403 không đủ quyền, 404 không có (hoặc không được phép biết — AC-004 US-004), 409 xung đột, 500 lỗi hệ thống.
- Tham số ngôn ngữ: query `?lang=vi|en|zh`; giá trị lạ → `vi`.
- Tên trường JSON: camelCase. Tên cột DB: snake_case. Chuyển đổi trong adapter.
- Tiền: số nguyên VND, **đã gồm VAT** (`price`, `total`, `lineTotal`…), kèm `currency: "VND"` (D-68).
  Bảng giá chỉ được tính ở `server/domain/pricing.js` + `quoteCart` (T-40) — không tính lại ở frontend.

## Frontend (`src/`)

- Trang ở `src/pages/`, thành phần dùng lại ở `src/components/`, gọi API ở `src/api/`, i18n ở `src/i18n/`.
- Không viết chuỗi hiển thị trực tiếp trong JSX — dùng `t('key')`. Thêm key thì thêm cho **cả** `vi`, `en`, `zh`; thiếu → hiện `vi` (D-40).
- Link nội bộ dùng `useI18n().path('/…')` để giữ tiền tố ngôn ngữ (D-37).
- Giá hiển thị qua `<Price />` — luôn kèm chú thích "đã gồm VAT" (BR-PRC-003, D-68).
- Mỗi trang render `<Seo>` (T-16): trang công khai truyền `title`, `description`, `path` (không có tiền tố ngôn ngữ); trang không được index (QR, tài khoản, giỏ, checkout, admin — BR-SEO-001, D-44) truyền `noindex`; trang lỗi truyền `status`. Không gọi `useNoIndex()` trực tiếp khi đã có `<Seo noindex>`.
- Trang công khai phải render được trên server (T-15): không đọc `window`/`localStorage` khi render; khai báo key dữ liệu trong `src/seo/routes.js`.
- Tôn trọng `prefers-reduced-motion` (NFR-A11Y-001): CSS có media query trong `pages.css`; framer-motion được bọc `MotionConfig reducedMotion="user"` ở `LocaleLayout`. Hook cần biết trạng thái giảm chuyển động dùng `useReducedMotionConfig()`.
- framer-motion: chỉ dùng `m.*` (LazyMotion strict — T-22); hiệu ứng xuất hiện/biến mất dùng `<Reveal>` + biến thể trong `src/lib/motion.js`; hiệu ứng lặp viết bằng CSS.
- Giao diện theo [`design-rules.md`](design-rules.md) (màu, khung, ảnh, motion). Ảnh ngoài: chỉ public domain/CC0, ghi nguồn ở `public/images/folk/CREDITS.md` + `src/data/folkArt.js`.
- Màu dùng token trong `src/index.css` (`--diep`, `--than`, `--son`, `--hoe`, `--cham`, `--la`…); tên cũ (`--ink`, `--brown`…) chỉ là bí danh cho code cũ (T-23). SVG trang trí đặt `aria-hidden="true"`.

## Test

- Server: `server/**/*.test.js`, dùng `createApp` với adapter bộ nhớ + `supertest`. Không gọi mạng thật.
- Frontend: `src/**/*.test.jsx`, đặt `// @vitest-environment jsdom` ở đầu file; mock `fetch`.
- Tên test ghi mã AC/BR khi có: `it('AC-004: token không tồn tại → 404 chung', …)`.
- Trước khi commit: `npm test` và `npm run lint` phải sạch; `npm run build` phải qua.

Public SSR motion dùng useHydratedReducedMotion từ src/lib/hydration.js để server/client initial markup đồng nhất. Private lazy-route tests phải await phần tử page trước thao tác; không bỏ assertions hoặc ép eager import chỉ để test qua.
