# Tiến độ tính năng

Cập nhật cuối mỗi tính năng. Trạng thái: ✅ xong · 🟡 một phần · ⛔ bị chặn (chờ quyết định) · ⬜ chưa làm.

| Nhóm | FR | Trạng thái | Code chính | Test | Chặn bởi |
|---|---|---|---|---|---|
| Catalog | FR-CAT-001 | ✅ | `server/routes/catalog.js`, `src/pages/HomePage.jsx`, `src/pages/ProductPage.jsx` | `server/catalog*.test.js`, `src/pages/HomePage.test.jsx`, `src/pages/Routing.extra.test.jsx` | — |
| Catalog | FR-CAT-002 (bán lẻ đèn trong bộ) | ⛔ | `products.kind = 'set'` | — | Q-05, Q-06 |
| Catalog | FR-CAT-003 (giá đã gồm VAT, D-68) | ✅ | `src/components/Price.jsx`, `server/domain/pricing.js` | `server/pricing*.test.js`, `src/components/Components.extra.test.jsx` | — (I-04 đã chốt) |
| Catalog | FR-CAT-004 (admin sản phẩm + ảnh, D-77) | ✅ | `server/routes/admin.js`, `src/admin/ProductsPage.jsx`, `src/components/ProductImage.jsx` | `server/admin*.test.js`, `server/productImage.extra.test.js`, `src/admin/Admin*.test.jsx` | Ảnh sản phẩm **thật** chưa có (G-33) |
| Tài khoản | FR-ACC-001 (không xác nhận email, D-63) | ✅ | `server/routes/auth.js`, `server/adapters/*/auth.js`, `src/auth/*`, `src/pages/auth/*`, `src/pages/AccountPage.jsx` | `server/auth*.test.js`, `server/rateLimit.extra.test.js`, `src/pages/auth/Auth*.test.jsx` | Cấu hình Supabase URL (G-16) |
| Tài khoản | FR-ACC-001 (đăng nhập Google D-78, khung auth mới, đăng xuất ở header) | ✅ | `server/google.js`, `server/routes/auth.js`, `src/pages/auth/{AuthShell,GoogleButton,AuthCallbackPage}.jsx`, `src/components/SiteHeader.jsx` | `server/googleAuth.test.js`, `src/pages/auth/*.extra.test.jsx` |
| Tài khoản | FR-ACC-002 (đơn của tôi) | ✅ | `src/orders/useOrders.js`, `src/pages/AccountPage.jsx`, `src/pages/OrderPage.jsx` | `src/pages/AccountDashboard.extra.test.jsx`, `server/orders*.test.js` | — |
| Tài khoản | FR-ACC-003 (lời chúc) | ⬜ | Đơn đã có cờ `has_message`/`qr_lang` (D-76) | — | G-42 |
| Tài khoản | FR-ACC-004 (lịch sử chat Mây) | ✅ | `src/pages/AccountPage.jsx` | `src/may/May.test.jsx` | Xoá lịch sử chờ `[LEGAL]` I-15 |
| Giỏ hàng | FR-CART-001 | ✅ | `server/cart/*`, `server/routes/cart.js`, `src/cart/*`, `src/pages/CartPage.jsx` | `server/cart*.test.js`, `src/cart/Cart*.test.jsx` | — |
| Checkout | FR-CHK-001…008 | ✅ | `server/orders/service.js`, `server/routes/orders.js`, `server/domain/{order,pricing,coupon}.js`, `src/pages/CheckoutPage.jsx` | `server/orders.test.js`, `server/orders.extra.test.js`, `server/pricing*.test.js` | Q-12 (phí thiệp), G-44 (tồn kho), G-46 (danh mục địa chỉ) |
| Thanh toán | FR-PAY-001/002 | ✅ | `server/adapters/payos.js`, `server/orders/service.js` | `server/payos.extra.test.js`, `server/orders*.test.js` | Chưa thử với tài khoản payOS thật |
| Đơn | FR-ORD-001/002 | ✅ | `server/orders/service.js`, `src/admin/OrdersPage.jsx`, `src/pages/OrderPage.jsx` | `server/orders*.test.js`, `src/admin/AdminOrders.extra.test.jsx` | Q-20 (mức hoàn tiền), BR-ORD-002 không kiểm được (G-43) |
| Đổi trả | FR-RET-001/002 | ⛔ | — | — | Q-19, Q-22 |
| Lời chúc & QR | FR-MSG-001, FR-QR-001…005 | ⬜ | — | — | G-42 — phần lớn nhất còn lại |
| Lời chúc & QR | FR-QR-006 (trang QR lô) | ✅ | `src/pages/BatchPage.jsx`, `GET /api/batches/:code` | `src/pages/BatchPage*.test.jsx`, `server/catalog*.test.js` | — |
| Lời chúc & QR | FR-QR-007 (admin lô + video) | ✅ | `server/routes/admin.js`, `server/adapters/*/storage.js`, `src/admin/BatchesPage.jsx` | `server/admin*.test.js`, `src/admin/Admin*.test.jsx` | Thử với Supabase thật (G-22) |
| Admin | FAQ (G-07) | ✅ | `src/admin/FaqPage.jsx` | `server/admin*.test.js` | — |
| Admin | Đơn hàng, coupon | ✅ | `src/admin/OrdersPage.jsx`, `src/admin/CouponsPage.jsx` | `src/admin/AdminOrders.extra.test.jsx`, `server/orders.test.js` | — |
| Admin | Đổi trả | ⛔ | — | — | Q-19, Q-22 |
| AI Mây | FR-AI-001…003, 005…007 | ✅ | `server/may/*`, `server/routes/may.js`, `src/may/*`, `src/admin/MayConfigPage.jsx` | `server/may*.test.js`, `src/may/May*.test.jsx` | Cần `OPENAI_API_KEY` + Supabase trên Vercel |
| AI Mây | FR-AI-004 (tra đơn) | ⬜ | Đã có đơn hàng — làm được ngay | — | G-29 |
| Coupon | FR-CPN-001/002 | ✅ | `server/domain/{coupon,couponValidate}.js`, `server/routes/admin.js`, `src/admin/CouponsPage.jsx` | `server/orders*.test.js`, `server/pricing*.test.js` | — |
| Nền tảng | FR-I18N-001 | ✅ | `src/i18n/*`, `server/i18n.js` | `src/i18n/core.test.js`, `src/pages/Routing.extra.test.jsx` | Duyệt bản dịch (G-14) |
| Nền tảng | FR-SEO-001 | ✅ | `server/ssr.js`, `server/routes/seo.js`, `src/seo/*`, `public/images/og` | `server/seo*.test.js`, `server/analytics.seo.extra.test.js`, `src/seo/*.test.js*` | Ảnh sản phẩm thật (G-33) |
| Nền tảng | FR-GA-001 | ✅ | `src/analytics/*`, nhúng ở `server/ssr.js` | `src/analytics/*.test.js*`, `server/analytics.seo.extra.test.js` | Còn 2 sự kiện chờ trang QR lời chúc (G-42) |
| Nền tảng | FR-GA-001 (báo cáo realtime trong admin, T-43) | ✅ | `server/adapters/gaRealtime.js`, `server/routes/admin.js`, `src/admin/AnalyticsPage.jsx` | `server/gaRealtime*.test.js`, `src/admin/Analytics*.test.jsx` | Cần property + service account GA thật (G-50) |
| Giao diện | NFR-A11Y-001, giao diện dân gian cổ + motion (T-21…T-23) | ✅ | `src/index.css`, `src/styles/*`, `src/components/*`, `public/images/scene` (T-36) | `src/components/{Motion,Effects,Classic,FolkGallery,Folk}*.test.jsx`, `server/ssr.*.extra.test.js` | NFR-PERF-001 chưa có mục tiêu (`[ASSUMPTION]` §31.4) |
| Giao diện | Bo góc, kính mờ, chuyển trang (D-79, T-45) | ✅ | `src/index.css`, `src/styles/App.css`, `src/components/PageTransition.jsx`, `src/components/LocaleLayout.jsx` | `src/components/PageTransition.test.jsx` |
| Giao diện | Header kính mờ, header/footer riêng cho auth, nền auth trơn, ảnh phủ mảng navy (D-80, T-46) | ✅ | `src/components/AuthHeader.jsx`, `AuthFooter.jsx`, `Scene.jsx`, `src/styles/App.css` | `src/pages/auth/Auth.extra.test.jsx` |
| Giao diện | Trang auth v2: sân khấu ảnh, thẻ kính, tab, hiện/ẩn mật khẩu (D-82, T-47) | ✅ | `src/pages/auth/AuthShell.jsx`, `src/components/Field.jsx`, `src/styles/App.css` | `src/pages/auth/AuthRedesign.extra.test.jsx` |
| Giao diện | Ảnh riêng cho trang auth (D-81) | ✅ | `src/pages/auth/AuthShell.jsx`, `public/images/auth/*` | `src/pages/auth/AuthPhoto.extra.test.jsx` |
| Bảo mật | Auth production không cần Supabase Pro/Twilio (T-49): thư do server gửi, token đặt lại một lần, refresh token cookie HttpOnly (G-17), chặn mật khẩu đã lộ, CSRF Origin | ✅ | `server/mail/*`, `server/security/pwned.js`, `server/middleware/sessionCookie.js`, `server/routes/auth.js`, `server/adapters/*/auth.js`, `src/auth/AuthProvider.jsx`, `src/pages/auth/{ResetPassword,AuthCallback}Page.jsx` | `server/auth*.test.js`, `server/mail/*.test.js`, `server/security/*.test.js`, `server/middleware/sessionCookie.test.js`, `server/**/*.t49.extra.test.js`, `src/pages/auth/*.test.jsx` | G-52 (cấu hình Resend/Brevo + DNS), Q-39 (xác minh email) |
| Bảo mật | Security headers, chống dò/spam, G-18, G-28 | ✅ | `server/middleware/{security,rateLimit}.js`, `server/routes/auth.js`, `server/monitoring/metrics.js` | `server/security.cache.extra.test.js`, `server/rateLimit.extra.test.js`, `server/it.extra.test.js` | G-17 (token ở localStorage) vẫn mở |
| Vận hành | Deploy Vercel (T-33) | 🟡 | `api/index.js`, `vercel.json`, `docs/knowledge/deploy-vercel.md` | `lamvi.vercel.app` chạy (200) nhưng bằng dữ liệu bộ nhớ | Chưa có bảng trên Supabase + biến `SUPABASE_*` ở Vercel (G-36); cron chưa kiểm chứng (G-47) |
| Vận hành | FR-IT-001…004 (dashboard IT) | ✅ | `server/routes/it.js`, `server/monitoring/*`, `src/it/*` | `server/it*.test.js`, `src/it/It*.test.jsx` | Cảnh báo chủ động (G-25) chờ Q-24 |
| Vận hành | Thông báo đơn hàng (§20) | ⬜ | — | — | Q-24 (kênh), G-45 |

## Việc có thể làm tiếp mà không bị chặn

1. **Lời chúc & trang QR lời chúc** (G-42, FR-MSG-001, FR-QR-001…005) — phần nghiệp vụ lớn nhất còn lại. Quyết định đã đủ: D-75 (90 ngày), D-76 (soạn sau), D-12, D-13, BR-MSG-001…008.
2. **Mây tra đơn** (G-29, FR-AI-004) — đã có bảng đơn; cần `get_my_orders` / `lookup_order` + chống dò mã đơn (BR-AI-002).
3. **Nội dung chính sách** (G-10): Chính sách riêng tư (bắt buộc vì D-72 nêu GA ở đó), chính sách đổi trả, link footer.
4. **Nhật ký admin cho sản phẩm/FAQ/lô** (G-21) — đã có bảng `audit_log`, chỉ cần gọi thêm.
5. **Đưa lên Supabase thật** (G-36): chạy migration 001→008 + seed, đặt biến môi trường, kiểm luồng đặt hàng thật.

## Còn chờ người dùng / bên ngoài

- Q-05 (giá lẻ đèn trong bộ Sum Vầy), Q-12, Q-19, Q-20, Q-22, Q-24, Q-25, Q-27, Q-29, Q-33, Q-35, Q-37, Q-38.
- `[LEGAL]` Q-36 (ảnh tư liệu CC0), I-15 (xoá lịch sử chat).
- Tài khoản payOS thật (`PAYOS_*`) và khoá GA (`GA_MEASUREMENT_ID`).
- Ảnh sản phẩm thật (G-33, G-23).

- Vercel Web Analytics (T-42): `@vercel/analytics` nhúng ở `src/main.jsx`, URL đã làm sạch. Cần bật Analytics trên dashboard Vercel.
