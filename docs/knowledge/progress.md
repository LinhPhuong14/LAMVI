# Tiến độ tính năng

Cập nhật cuối mỗi tính năng. Trạng thái: ✅ xong · 🟡 một phần · ⛔ bị chặn (chờ quyết định) · ⬜ chưa làm.

| Nhóm | FR | Trạng thái | Code chính | Test | Chặn bởi |
|---|---|---|---|---|---|
| Catalog | FR-CAT-001 | ✅ | `server/routes/catalog.js`, `src/pages/HomePage.jsx`, `src/pages/ProductPage.jsx` | `server/catalog*.test.js`, `src/pages/HomePage.test.jsx`, `src/pages/Routing.extra.test.jsx` | — |
| Catalog | FR-CAT-002 (bán lẻ đèn trong bộ) | ⛔ | `products.kind = 'set'` | — | Q-05, Q-06 |
| Catalog | FR-CAT-003 (giá chưa VAT) | ✅ | `src/components/Price.jsx` | `src/components/Components.extra.test.jsx` | `[LEGAL]` I-04 |
| Catalog | FR-CAT-004 (admin sản phẩm) | ✅ | `server/routes/admin.js`, `src/admin/ProductsPage.jsx` | `server/admin*.test.js`, `src/admin/Admin*.test.jsx` | — |
| Tài khoản | FR-ACC-001 | ✅ | `server/routes/auth.js`, `src/auth/*`, `src/pages/auth/*`, `src/pages/AccountPage.jsx` | `server/auth*.test.js`, `src/pages/auth/Auth*.test.jsx` | Cấu hình Supabase (G-16) |
| Tài khoản | FR-ACC-002 (đơn của tôi) | ✅ | `src/pages/OrderPage.jsx`, `GET /api/orders*` | `server/orders*.test.js`, `src/pages/Checkout*.test.jsx` | — |
| Tài khoản | FR-ACC-003 (lời chúc) | ⛔ | — | — | Q-08 |
| Tài khoản | FR-ACC-004 (lịch sử chat Mây) | ✅ | `src/pages/AccountPage.jsx` | `src/may/May.test.jsx` | Xoá lịch sử chờ `[LEGAL]` I-15 |
| Giỏ hàng | FR-CART-001 | ✅ | `server/cart/*`, `server/routes/cart.js`, `src/cart/*`, `src/pages/CartPage.jsx` | `server/cart*.test.js`, `src/cart/Cart*.test.jsx` | — |
| Checkout | FR-CHK-001…008 | ✅ | `server/orders/*`, `server/routes/orders.js`, `src/pages/CheckoutPage.jsx` | `server/orders*.test.js`, `src/pages/Checkout*.test.jsx` | Soạn lời chúc (G-34) chờ Q-36 |
| Thanh toán | FR-PAY-001/002 | ✅ | `server/payments/*`, webhook `/api/payments/payos/webhook` | `server/orders*.test.js` | Thử payOS thật (G-33) |
| Đơn | FR-ORD-001/002 | ✅ | `server/orders/admin.js`, `src/admin/OrdersPage.jsx` | `server/orders*.test.js`, `src/admin/AdminOrders*.test.jsx` | Số tiền hoàn khi huỷ đơn đã làm: Q-20 (admin nhập tay) |
| Đổi trả | FR-RET-001/002 | ⛔ | — | — | Q-19, Q-22 |
| Lời chúc & QR | FR-MSG-001, FR-QR-001…005 | ⛔ | — | — | Q-08, Q-26, Q-25 |
| Lời chúc & QR | FR-QR-006 (trang QR lô) | ✅ | `src/pages/BatchPage.jsx`, `GET /api/batches/:code` | `src/pages/BatchPage*.test.jsx`, `server/catalog*.test.js` | — |
| Lời chúc & QR | FR-QR-007 (admin lô + video) | ✅ | `server/routes/admin.js`, `server/adapters/*/storage.js`, `src/admin/BatchesPage.jsx` | `server/admin*.test.js`, `src/admin/Admin*.test.jsx` | Thử với Supabase thật (G-22) |
| Admin | FAQ (G-07) | ✅ | `src/admin/FaqPage.jsx` | `server/admin*.test.js` | — |
| Admin | Đơn, coupon, phí ship/COD, nhật ký | ✅ | `server/routes/adminShop.js`, `src/admin/{OrdersPage,CouponsPage,ShopPage}.jsx`, `server/orders/audit.js` | `server/orders*.test.js`, `src/admin/AdminOrders*.test.jsx` | — |
| Admin | Đổi trả | ⛔ | — | — | Q-19, Q-22 |
| AI Mây | FR-AI-001…003, 005…007 | ✅ | `server/may/*`, `server/routes/may.js`, `src/may/*`, `src/admin/MayConfigPage.jsx` | `server/may*.test.js`, `src/may/May*.test.jsx` | OpenAI tắt tới khi `[LEGAL]` I-14 duyệt (D-55) |
| AI Mây | FR-AI-004 (tra đơn) | ⬜ | — | — | Không còn bị chặn (đã có đơn — G-29) |
| Coupon | FR-CPN-001/002 | ✅ | `server/orders/coupons.js`, `src/admin/CouponsPage.jsx` | `server/orders*.test.js` | Phân bổ khi đổi trả một phần (C-8b) |
| Nền tảng | FR-I18N-001 | ✅ | `src/i18n/*`, `server/i18n.js` | `src/i18n/core.test.js`, `src/pages/Routing.extra.test.jsx` | Duyệt bản dịch (G-14) |
| Nền tảng | FR-SEO-001 | ✅ | `server/ssr.js`, `server/routes/seo.js`, `src/seo/*`, `src/entry-server.jsx` | `server/seo*.test.js`, `server/ssr*.test.js`, `src/seo/*.test.js*` | Ảnh og:image (G-23); `[LEGAL]` I-04 cho giá JSON-LD |
| Nền tảng | FR-GA-001 | ⬜ | — | — | `[LEGAL]` Q-32 (cookie) |
| Vận hành | FR-IT-001…004 (dashboard IT) | ✅ | `server/routes/it.js`, `server/monitoring/*`, `src/it/*` | `server/it*.test.js`, `src/it/It*.test.jsx` | Cảnh báo chủ động (G-25) chờ Q-24 |

## Việc có thể làm tiếp mà không bị chặn

1. Mây tra đơn (FR-AI-004, G-29): `get_my_orders`, `lookup_order` có chống dò.
2. Nối link footer "Theo dõi đơn hàng" (G-10).
3. Thử payOS thật khi có tài khoản (G-33); chạy migration `20261001000006_orders.sql` trên Supabase thật (G-36).
4. Lời chúc (G-34) cần trả lời Q-36, Q-14, Q-29, Q-25, Q-26.
