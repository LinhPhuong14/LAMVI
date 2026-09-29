# Tiến độ tính năng

Cập nhật cuối mỗi tính năng. Trạng thái: ✅ xong · 🟡 một phần · ⛔ bị chặn (chờ quyết định) · ⬜ chưa làm.

| Nhóm | FR | Trạng thái | Code chính | Test | Chặn bởi |
|---|---|---|---|---|---|
| Catalog | FR-CAT-001 | ✅ | `server/routes/catalog.js`, `src/pages/HomePage.jsx`, `src/pages/ProductPage.jsx` | `server/catalog*.test.js`, `src/pages/HomePage.test.jsx`, `src/pages/Routing.extra.test.jsx` | — |
| Catalog | FR-CAT-002 (bán lẻ đèn trong bộ) | ⛔ | `products.kind = 'set'` | — | Q-05, Q-06 |
| Catalog | FR-CAT-003 (giá chưa VAT) | ✅ | `src/components/Price.jsx` | `src/components/Components.extra.test.jsx` | `[LEGAL]` I-04 |
| Catalog | FR-CAT-004 (admin sản phẩm) | ✅ | `server/routes/admin.js`, `src/admin/ProductsPage.jsx` | `server/admin*.test.js`, `src/admin/Admin*.test.jsx` | — |
| Tài khoản | FR-ACC-001 (không xác nhận email, D-63) | ✅ | `server/routes/auth.js`, `server/adapters/supabase/auth.js`, `src/auth/*`, `src/pages/auth/*`, `src/pages/AccountPage.jsx` (dashboard, v0.12) | `server/auth*.test.js`, `server/adapters/supabase/auth*.test.js`, `src/pages/auth/Auth*.test.jsx`, `src/pages/AccountDashboard.extra.test.jsx` | Cấu hình Supabase URL (G-16); rate limit (G-20, G-37) |
| Tài khoản | FR-ACC-002 (đơn của tôi) | ⬜ | Chỗ chờ ở dashboard `AccountPage` (G-40) | — | Cần đơn hàng |
| Tài khoản | FR-ACC-003 (lời chúc) | ⛔ | — | — | Q-08 |
| Tài khoản | FR-ACC-004 (lịch sử chat Mây) | ✅ | `src/pages/AccountPage.jsx` | `src/may/May.test.jsx` | Xoá lịch sử chờ `[LEGAL]` I-15 |
| Giỏ hàng | FR-CART-001 | ✅ | `server/cart/*`, `server/routes/cart.js`, `src/cart/*`, `src/pages/CartPage.jsx` | `server/cart*.test.js`, `src/cart/Cart*.test.jsx` | — |
| Checkout | FR-CHK-001…008 | ⛔ | — | — | Q-09, Q-11, Q-10/C-1…C-3/C-5, Q-08, Q-15 |
| Thanh toán | FR-PAY-001/002 | ⛔ | — | — | Q-15, Q-16 |
| Đơn | FR-ORD-001/002 | ⬜ | — | — | Q-20 (hoàn tiền) |
| Đổi trả | FR-RET-001/002 | ⛔ | — | — | Q-19, Q-22 |
| Lời chúc & QR | FR-MSG-001, FR-QR-001…005 | ⛔ | — | — | Q-08, Q-26, Q-25 |
| Lời chúc & QR | FR-QR-006 (trang QR lô) | ✅ | `src/pages/BatchPage.jsx`, `GET /api/batches/:code` | `src/pages/BatchPage*.test.jsx`, `server/catalog*.test.js` | — |
| Lời chúc & QR | FR-QR-007 (admin lô + video) | ✅ | `server/routes/admin.js`, `server/adapters/*/storage.js`, `src/admin/BatchesPage.jsx` | `server/admin*.test.js`, `src/admin/Admin*.test.jsx` | Thử với Supabase thật (G-22) |
| Admin | FAQ (G-07) | ✅ | `src/admin/FaqPage.jsx` | `server/admin*.test.js` | — |
| Admin | Đơn, coupon, cấu hình Mây, đổi trả | ⛔ | — | — | Chưa có nghiệp vụ tương ứng |
| AI Mây | FR-AI-001…003, 005…007 | ✅ | `server/may/*`, `server/routes/may.js`, `src/may/*`, `src/admin/MayConfigPage.jsx` | `server/may*.test.js`, `src/may/May*.test.jsx` | OpenAI mặc định bật (D-67); cần `OPENAI_API_KEY` + Supabase trên Vercel |
| AI Mây | FR-AI-004 (tra đơn) | ⛔ | — | — | Cần đơn hàng (G-29) |
| Coupon | FR-CPN-001/002 | ⛔ | — | — | C-1…C-3, C-5, C-6, C-8 |
| Nền tảng | FR-I18N-001 | ✅ | `src/i18n/*`, `server/i18n.js` | `src/i18n/core.test.js`, `src/pages/Routing.extra.test.jsx` | Duyệt bản dịch (G-14) |
| Nền tảng | FR-SEO-001 | ✅ | `server/ssr.js`, `server/routes/seo.js`, `src/seo/*`, `src/entry-server.jsx` | `server/seo*.test.js`, `server/ssr*.test.js`, `src/seo/*.test.js*` | Ảnh og:image (G-23); `[LEGAL]` I-04 cho giá JSON-LD |
| Nền tảng | FR-GA-001 | ⬜ | — | — | `[LEGAL]` Q-32 (cookie) |
| Giao diện | NFR-A11Y-001 (giảm chuyển động), giao diện dân gian cổ + motion (T-21…T-23) | ✅ | `src/index.css`, `src/styles/App.css`, `src/pages/HomePage.jsx`, `src/components/{Reveal,Motifs,Effects,FolkGallery,Scene,Lantern,SiteHeader}.jsx`, `src/data/folkArt.js`, `public/images/scene` (T-36), `src/lib/motion.js` | `src/components/{Motion,Effects,Classic,FolkGallery,Folk}*.test.jsx`, `server/ssr.{design,effects,classic}.extra.test.js` | NFR-PERF-001 chưa có mục tiêu (dùng tạm `[ASSUMPTION]` §31.4) |
| Vận hành | Deploy Vercel (T-33) | 🟡 | `api/index.js`, `vercel.json`, `docs/knowledge/deploy-vercel.md` | `lamvi.vercel.app` chạy (200) nhưng bằng dữ liệu bộ nhớ | Chưa có bảng trên Supabase + biến `SUPABASE_*` ở Vercel (G-36) |
| Vận hành | FR-IT-001…004 (dashboard IT) | ✅ | `server/routes/it.js`, `server/monitoring/*`, `src/it/*` | `server/it*.test.js`, `src/it/It*.test.jsx` | Cảnh báo chủ động (G-25) chờ Q-24 |

## Việc có thể làm tiếp mà không bị chặn

1. (Không còn phần lớn nào không bị chặn — xem cột "Chặn bởi"; trả lời P0 ở `ba-spec.md` §30 để làm giỏ hàng → checkout → đơn.)
