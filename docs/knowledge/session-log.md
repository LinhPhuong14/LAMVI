# Nhật ký phiên

Mới nhất ở trên. Mỗi mục: mục tiêu · quyết định · đã làm · còn lại.

---

## 2026-09-28 (phiên 5) — Giao diện dân gian cổ + motion (nhánh `feat/folk-art-redesign`)

**Quyết định từ người dùng**

- Web phải "thật nghệ thuật dân gian", thêm cảm giác cổ xưa hoài niệm; motion tốt cả khi xuất hiện và biến mất; hiệu năng tốt; màu tốt hơn.
- Làm trên nhánh mới từ `master` (bản thiết kế đầu tiên ở nhánh `claude/folk-art-web-design-v3ice8` dựa trên master cũ, không gộp).

**Đã làm**

1. Bảng màu Đông Hồ đã ngả màu thời gian + bí danh biến cũ cho `pages.css` (T-23); texture sợi dó, vết ố, mực mòn, viền tối kiểu ảnh cũ.
2. Hoạ tiết SVG (`Motifs.jsx`): trống đồng, mây, sen, con dấu son (logo), dấu bưu điện, ảnh cũ viền răng cưa; đèn vẽ lại theo lối khắc gỗ có tua rua.
3. Motion (T-22): `useViewState` + `Reveal` — xuất hiện khi cuộn tới, biến mất theo hướng cuộn; `CountUp`; đèn lookbook thắp/lịm; hero cuộn đi thì đèn bay lên; header ẩn/hiện theo hướng cuộn; FAQ mở như cuộn thư; `LazyMotion strict`.
4. Hiệu năng (T-21): font tự host + preload, bỏ Google Fonts. Đo local: LCP ~1,55 s → ~0,45 s, CLS 0.
5. Test `src/components/Motion.test.jsx`. Test phát hiện: `useReducedMotion` bỏ qua `MotionConfig` → đổi sang `useReducedMotionConfig`.
5a. Subagent kiểm thử độc lập (T-11): `Motion.extra.test.jsx`, `server/ssr.design.extra.test.js` — không có lỗi; lưu ý HTML SSR có 68 phần tử `opacity:0` (G-30) và cảnh báo lint `set-state-in-effect` → đã sửa: màn hình đầu chạy bằng CSS, `@media (scripting: none)`, `useFinePointer` dùng `useSyncExternalStore`.
5b. Theo yêu cầu "tham khảo Aceternity UI": 9 hiệu ứng tự viết lại (T-24) — Lamp, Spotlight, 3D Card, Text Generate, Tracing Beam, Moving Border, Focus Cards, Sparkles (đèn trời), Text Hover.
5c. Subagent kiểm thử độc lập lần 2 (T-11): `Effects.extra.test.jsx`, `server/ssr.effects.extra.test.js` (31 test) — không có lỗi; rủi ro id gradient `brandInk` viết cứng (trùng nếu tái dùng) → đã sửa bằng `useId()`.
6. Spec v0.6: §31.4, G-29, G-30, `[ASSUMPTION]` ngưỡng NFR-PERF-001.

**Còn lại / cần người dùng**

- PO chốt NFR-PERF-001; thống nhất thương hiệu MỘC ↔ "LÂM VỊ" (nhánh `docs/branding-guideline`) trước khi gộp.
- Thay minh hoạ bằng ảnh thật khi có (G-23, G-29).

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
