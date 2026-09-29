# Nhật ký phiên

Mới nhất ở trên. Mỗi mục: mục tiêu · quyết định · đã làm · còn lại.

---

## 2026-09-29 (phiên 6) — Giỏ hàng (nhánh `feat/cart`, từ `master`), gộp vào `master`

**Quyết định từ người dùng**

- D-59 (Q-13): vãng lai có giỏ lưu trình duyệt, gộp khi đăng nhập.
- D-60: tối đa 10 mỗi dòng. D-61: nút Thanh toán bắt đăng nhập rồi báo sắp ra mắt.

**Đã làm**

1. Server: `server/cart/service.js`, `/api/cart/*`, migration `20260929000005_cart.sql`; bảo trì cho phép `/api/cart/quote`.
2. Frontend: `CartProvider`, nút thêm vào giỏ (thẻ + trang chi tiết), header đếm số lượng, `/cart`. Test cũ cập nhật theo hành vi mới (nút thẻ sản phẩm đổi từ "Xem chi tiết" sang thêm vào giỏ; test render routes cần `AuthProvider`). Sửa header xuống dòng ở 1280px.
3. Spec v0.7: D-59…D-61, gỡ Q-13, G-02 đã xử lý.
4. Subagent kiểm thử giỏ hàng (101 test mới) phát hiện: `/api/cart/quote` lộ tên sản phẩm nháp cho khách (D-39); quote chậm ghi đè giỏ vừa gộp khi đăng nhập; giỏ trình duyệt >100 dòng làm kẹt trang giỏ/gộp → đã sửa (quote bỏ nháp, ẩn tên sản phẩm đã ẩn; mã yêu cầu tăng dần trong `CartProvider`; `loadLocalCart` gộp trùng + cắt 50 dòng). Thêm: PUT sản phẩm nháp/ẩn chưa có trong giỏ trả cùng 404 như không tồn tại; gộp lỗi (bảo trì 503) vẫn hiện giỏ tài khoản. Rủi ro còn lại ghi G-32.

**Còn lại / cần người dùng**

- Chạy migration `20260929000005_cart.sql`.
- Checkout chờ P0: Q-09 (VAT), Q-11 (phí ship), coupon C-1…C-3/C-5, Q-08 (lời chúc), Q-15/Q-16 (payOS), Q-17 đã có (chặn COD khi giao người khác).

---

## 2026-09-28 (phiên 5) — AI Mây (nhánh `feat/may`, từ `master`), gộp vào `master`

**Quyết định từ người dùng**

- D-55: code đủ OpenAI nhưng tắt bằng cờ (mặc định tắt) tới khi pháp chế duyệt I-14.
- D-56: kênh hỗ trợ (Q-31) do admin nhập. D-57: timeout 15 giây. D-58: ngân sách 20 USD/tháng.

**Đã làm**

1. Server: `server/may/*`, `/api/may/chat`, `/api/may/history`, `/api/admin/may/*`, migration `20260928000004_may.sql`; dashboard IT hiện trạng thái OpenAI + % ngân sách.
2. Frontend: mascot, khung chat, tour trang chủ, lịch sử trên trang tài khoản, `/admin/may`.
3. Spec v0.6: D-55…D-58, gỡ Q-31, G-05 một phần, G-29…G-31.
4. Subagent kiểm thử Mây phát hiện: SĐT dạng `(+84) 912 345 678` không bị che → đã sửa. Rủi ro đã xử lý: lỗi DB khi đọc/ghi chi phí hoặc lưu lịch sử không còn làm hỏng câu trả lời (500/"ốm"); chặn câu nhắc giảm giá / số tiền viết tắt ở server; cắt lịch sử theo 500 ký tự/lượt; timeout cắt được cả tool treo; ngân sách 0 báo "đã hết".

**Còn lại / cần người dùng**

- Pháp chế duyệt I-14 → admin bật OpenAI ở `/admin/may` (cần `OPENAI_API_KEY` trên server).
- Nhập kênh hỗ trợ ở `/admin/may`. Duyệt nội dung tour + câu thông báo en/zh.
- Tra đơn (G-29) làm cùng đơn hàng.

---

## 2026-09-28 (phiên 4) — Vai trò IT + dashboard IT (nhánh `feat/it-dashboard`), gộp vào `master`

**Quyết định từ người dùng**

- D-51: vai trò IT, dashboard riêng `/it`; IT có cả quyền admin.
- D-52: dashboard gồm số liệu API, trạng thái tích hợp, chế độ bảo trì.
- D-53: số liệu lưu Supabase. D-54: bảo trì = trang bảo trì + API ghi 503.
- Gộp chuỗi nhánh foundation → admin → seo → it-dashboard thẳng vào `master`.

**Đã làm**

1. Hoàn tất kiểm thử SEO còn dở (phiên 3): hai subagent (client + server) → sửa 5 lỗi (xem commit "Bổ sung test độc lập SEO phía server").
2. Vai trò IT, `/api/it/*`, `server/monitoring/*`, `/it`, migration `20260928000003_it.sql`. Lỗi tự phát hiện: nhãn route đọc ở sự kiện `finish` bị mất `req.route` → chụp lúc `writeHead` (T-19).
3. Spec v0.5: FR-IT-001…004, D-51…D-54, G-24…G-28.
4. Subagent kiểm thử IT phát hiện: route API lạ đưa nguyên đoạn URL vào nhãn (uuid/chuỗi tuỳ ý, bảng phình) → gộp `/api/*`. Rủi ro đã xử lý: bảo trì fail-open cả khi trước đó đang bật; flush từng bước độc lập, dọn dữ liệu chỉ đánh dấu khi thành công; revoke execute `record_api_metrics`; allowlist bảo trì không phân biệt hoa thường và chấp nhận `/` cuối.

**Còn lại / cần người dùng**

- Chạy migration `20260928000003_it.sql`; cấp vai trò `it` trong Supabase.
- Cảnh báo chủ động (G-25) chờ kênh thông báo Q-24.

---

## 2026-09-28 (phiên 3) — SEO (nhánh `feat/seo`, tách từ `feat/admin`)

**Quyết định từ người dùng**

- D-49: SSR trong Express (một server Node cho web + API).
- D-50: JSON-LD sản phẩm có giá chưa VAT, `valueAddedTaxIncluded: false` (I-04 vẫn chờ pháp chế).

**Đã làm**

1. Hoàn tất kiểm thử admin còn dở từ phiên 2: subagent phát hiện `contentType` `toString`/`__proto__` lọt kiểm tra → đã sửa; thêm các bản sửa rủi ro (xem commit trên `feat/admin`).
2. SSR: `server/ssr.js`, `src/entry-server.jsx`, `src/AppShell.jsx`, hydrate có dữ liệu nạp sẵn. Lỗi tự phát hiện khi chạy trình duyệt thật: trang chủ lệch hydrate vì trang chủ và footer dùng chung key `/products` mà key bị xoá sau lần đọc đầu → sửa bằng store xoá sau khi hydrate xong.
3. `<Seo>` cho mọi trang; canonical, hreflang, Open Graph, JSON-LD; 404 thật; `sitemap.xml`, `robots.txt`.
4. Spec v0.4: D-49, D-50, G-12/G-15 đã xử lý, G-23 mới.
5. Subagent kiểm thử SEO (client + server) phát hiện: `fill()` dùng chuỗi thay thế nên `$'`/`` $` ``/`$&` trong DB làm vỡ HTML; slug mã hoá hỏng trả 200 trang "đang tải"; dev server 500 với URL `%` hỏng; sitemap 500 khi `updatedAt` hỏng; robots `Disallow: /admin` chặn nhầm tiền tố → đã sửa. Còn mở: trang chủ khi DB lỗi vẫn trả 200 (chưa có yêu cầu).

**Còn lại / cần người dùng**

- Triển khai giờ cần server Node (không còn hosting tĩnh): `npm run build && npm start`, đặt `PUBLIC_SITE_URL` đúng tên miền.
- Ảnh sản phẩm/og:image (G-23). Google Analytics chờ `[LEGAL]` Q-32.

---

## 2026-09-28 (phiên 2) — Admin (nhánh `feat/admin`, tách từ `feat/foundation-web`)

**Mục tiêu**: admin sản phẩm, FAQ, lô & video lô.

**Quyết định từ người dùng**

- D-45: chốt câu "lời chúc riêng cho mỗi món quà", "Hành trình mẻ đèn của bạn".
- D-46: video lô tải file lên Supabase Storage.
- D-47: lô đã xuất bản được thay video, không gỡ/xoá/đổi mã.
- D-48: giao diện admin chỉ tiếng Việt.

**Đã làm**

1. Gộp `origin/master` (nhánh `fix/web-copy-ba-spec` — sửa câu chữ §31.3 đợt 1) vào `feat/foundation-web`: dùng câu chữ đợt 1 trong i18n, hợp nhất §31.2/§31.3; đổi Q-34 (409 đăng ký) của phiên trước thành Q-35 vì trùng mã với Q-34 trên master. Sửa dòng "Trạng thái" đầu spec bị thay nhãn nhầm ở phiên trước.
2. Admin: `/api/admin/*` + `/admin` (sản phẩm, FAQ, lô, tải video bằng signed URL, xuất bản). Subagent kiểm thử độc lập (T-11). Subagent phát hiện: `VIDEO_TYPES[contentType]` nhận cả `toString`/`__proto__` → đã sửa. Rủi ro đã xử lý: kiểm lại kiểu file thật khi gắn video, bucket chỉ nhận video, PATCH rỗng không gọi update, trigger chặn xoá video của lô đã xuất bản.
3. Spec v0.3: D-45…D-48, G-06 một phần, G-21, G-22, giả định mới.

**Còn lại / cần người dùng**

- Chạy migration `20260928000002_admin.sql`; cấp admin bằng `update public.profiles set role = 'admin' …`; thử tải video với Supabase thật (G-22).
- Nhánh khác trên origin (`docs/branding-guideline`, `feat/landing-page`) đổi thương hiệu sang "LÂM VỊ" + Tailwind — chưa gộp master; cần thống nhất trước khi gộp.

---

## 2026-09-28 — Nền tảng web (nhánh `feat/foundation-web`)

**Mục tiêu**: hiện thực phần của `ba-spec.md` không bị chặn bởi `[BA DECISION REQUIRED]`; lập knowledge base.

**Quyết định từ người dùng**

- Nhánh `feat/…` thay vì `claude/…` (CLAUDE.md).
- Stack: Supabase + Node + Express (T-02, T-03).
- Phạm vi: nền tảng chưa bị chặn — routing, i18n, catalog + FAQ từ DB, tài khoản, trang QR lô, sửa nội dung §31.3.
- Duyệt toàn bộ `[PROPOSAL]`/`[ASSUMPTION]` của spec v0.1 → D-41 (và D-37…D-40 cụ thể hoá).
- Q-30: QR đèn là mã chung của lô → D-43. Trang lô `noindex` → D-44.
- Đăng nhập email + mật khẩu → D-42.
- Có Supabase project; người dùng sẽ thêm biến môi trường.

**Đã làm** (mỗi tính năng có subagent kiểm thử độc lập, T-11)

1. Backend Express + adapter Supabase/bộ nhớ; API catalog, FAQ, lô; migration + seed. Subagent phát hiện: URL hỏng và body quá lớn trả 500 → đã sửa; ràng buộc `video_url` rỗng → đã sửa.
2. Frontend: router `/`, `/en`, `/zh`; i18n; sản phẩm/FAQ từ API; chú thích VAT; sửa nội dung §31.3. Subagent phát hiện: câu "lưu giữ bền bỉ" (D-26), framer-motion bỏ qua reduced-motion, client trả `null` với 200 không phải JSON → đã sửa.
3. Tài khoản: đăng ký, đăng nhập, đăng xuất, refresh, quên/đặt lại mật khẩu, hồ sơ.
3a. Subagent phát hiện: lỗi mạng khi refresh làm mất phiên; form hồ sơ không hiện giá trị đã chuẩn hoá; quên mật khẩu dò được email qua 429 của Supabase; đăng xuất Supabase chỉ thu hồi phiên hiện tại; đăng ký lại email chưa xác nhận ghi đè hồ sơ; mật khẩu > 72 byte → đã sửa. Còn mở: G-18 (reset nhận mọi access token), G-20 (rate limit), Q-35 (409 khi email đã đăng ký).
4. Trang QR lô đèn `/lo/:code`. Subagent phát hiện: tiêu đề "không tìm thấy" khi lỗi 500, ngày lệch theo múi giờ → đã sửa.
5. Spec v0.2: D-37…D-44, §31.2/§31.3, giả định mới `[ASSUMPTION]`.

**Còn lại / cần người dùng**

- Trả lời P0 ở `ba-spec.md` §30 để làm giỏ hàng → checkout → thanh toán → lời chúc.
- Duyệt câu thay thế §31.3 và bản dịch en/zh (G-14).
- Cấu hình Supabase: chạy migration + seed, Redirect URLs (G-16), thêm `.env`.
- Trả lời Q-35. Trước go-live: G-17, G-18, G-20.
