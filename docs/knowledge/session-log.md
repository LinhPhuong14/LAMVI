# Nhật ký phiên

Mới nhất ở trên. Mỗi mục: mục tiêu · quyết định · đã làm · còn lại.

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
2. Admin: `/api/admin/*` + `/admin` (sản phẩm, FAQ, lô, tải video bằng signed URL, xuất bản). Subagent kiểm thử độc lập (T-11).
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
