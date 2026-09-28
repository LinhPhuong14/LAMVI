# Tiến độ tính năng

Cập nhật cuối mỗi tính năng. Trạng thái: ✅ xong · 🟡 một phần · ⛔ bị chặn (chờ quyết định) · ⬜ chưa làm.

| Nhóm | FR | Trạng thái | Code chính | Test | Chặn bởi |
|---|---|---|---|---|---|
| Catalog | FR-CAT-001 | ✅ | `server/routes/catalog.js`, `src/pages/HomePage.jsx`, `src/pages/ProductPage.jsx` | `server/catalog*.test.js`, `src/pages/HomePage.test.jsx`, `src/pages/Routing.extra.test.jsx` | — |
| Catalog | FR-CAT-002 (bán lẻ đèn trong bộ) | ⛔ | `products.kind = 'set'` | — | Q-05, Q-06 |
| Catalog | FR-CAT-003 (giá chưa VAT) | ✅ | `src/components/Price.jsx` | `src/components/Components.extra.test.jsx` | `[LEGAL]` I-04 |
| Catalog | FR-CAT-004 (admin sản phẩm) | ⬜ | — | — | — |
| Tài khoản | FR-ACC-001 | ✅ | `server/routes/auth.js`, `src/auth/*`, `src/pages/auth/*`, `src/pages/AccountPage.jsx` | `server/auth*.test.js`, `src/pages/auth/Auth*.test.jsx` | Cấu hình Supabase (G-16) |
| Tài khoản | FR-ACC-002 (đơn của tôi) | ⬜ | Chỗ trống ở `AccountPage` | — | Cần đơn hàng |
| Tài khoản | FR-ACC-003, FR-ACC-004 | ⬜ | — | — | Lời chúc, Mây |
| Giỏ hàng | FR-CART-001 | ⛔ | — | — | Q-13 |
| Checkout | FR-CHK-001…008 | ⛔ | — | — | Q-09, Q-11, Q-10/C-1…C-3/C-5, Q-08, Q-15 |
| Thanh toán | FR-PAY-001/002 | ⛔ | — | — | Q-15, Q-16 |
| Đơn | FR-ORD-001/002 | ⬜ | — | — | Q-20 (hoàn tiền) |
| Đổi trả | FR-RET-001/002 | ⛔ | — | — | Q-19, Q-22 |
| Lời chúc & QR | FR-MSG-001, FR-QR-001…005 | ⛔ | — | — | Q-08, Q-26, Q-25 |
| Lời chúc & QR | FR-QR-006 (trang QR lô) | ✅ | `src/pages/BatchPage.jsx`, `GET /api/batches/:code` | `src/pages/BatchPage*.test.jsx`, `server/catalog*.test.js` | — |
| Lời chúc & QR | FR-QR-007 (admin lô) | ⬜ | — | — | — |
| AI Mây | FR-AI-001…007 | ⬜ | — | — | Q-31 (kênh hỗ trợ), `[LEGAL]` I-14 |
| Coupon | FR-CPN-001/002 | ⛔ | — | — | C-1…C-3, C-5, C-6, C-8 |
| Nền tảng | FR-I18N-001 | ✅ | `src/i18n/*`, `server/i18n.js` | `src/i18n/core.test.js`, `src/pages/Routing.extra.test.jsx` | Duyệt bản dịch (G-14) |
| Nền tảng | FR-SEO-001 | 🟡 | `useNoIndex` cho trang riêng tư | Có | Pre-render/SSR, hreflang (G-12, G-15) |
| Nền tảng | FR-GA-001 | ⬜ | — | — | `[LEGAL]` Q-32 (cookie) |

## Việc có thể làm tiếp mà không bị chặn

1. Admin: API + giao diện quản lý sản phẩm, FAQ, lô (FR-CAT-004, FR-QR-007) — chỉ cần vai trò `admin` (D-38).
2. SEO: pre-render trang công khai, `hreflang`, sitemap, meta theo ngôn ngữ (G-12, G-15).
3. Mây phần không cần đơn: tour + FAQ từ DB (FR-AI-001…003, FR-AI-005) — cần OpenAI key; I-14 là `[LEGAL]`.
