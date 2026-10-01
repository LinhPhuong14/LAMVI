# Thuật ngữ

Dùng đúng tên trong cột "Code" cho biến, bảng, endpoint.

| Nghiệp vụ (vi) | Tiếng Anh | Code | Ghi chú |
|---|---|---|---|
| Sản phẩm / mẫu đèn | Product | `product`, bảng `products` | `kind`: `single` / `set` |
| Bộ Sum Vầy | Set | `kind = 'set'` | Thành phần bộ chờ Q-05 |
| Giá chưa VAT | Price excluding VAT | `price_excl_vat` / `priceExclVat` | Số nguyên VND (T-09) |
| Trạng thái hiển thị sản phẩm | Product status | `status`: `draft` / `published` / `hidden` | D-39 |
| Câu hỏi thường gặp | FAQ entry | `faq_entries` | Mây đọc từ đây |
| Lô sản xuất | Batch | `batch`, bảng `batches`, URL `/lo/:code` | QR khắc trên đèn là mã chung của lô (D-43) |
| Video lô | Batch video | `video_url` | Lưu vĩnh viễn (D-10) |
| Tài khoản / hồ sơ | Profile | bảng `profiles` (1-1 `auth.users`) | Vai trò `customer` / `admin` / `it` (D-38, D-51) |
| Chế độ bảo trì | Maintenance mode | `app_settings.key = 'maintenance'` | D-54 |
| Số liệu API | API metrics | bảng `api_metrics`, `server/monitoring/metrics.js` | D-53 |
| Ngôn ngữ ưa thích | Preferred locale | `preferred_locale` | `vi` / `en` / `zh` |
| Giỏ hàng | Cart | bảng `cart_items`, `src/cart/*`, localStorage `moc.cart` (vãng lai) | D-59, D-60 |
| Đơn hàng | Order | bảng `orders`, `order_items`; `server/orders/*`; trang `/account/orders/:id` | §16 |
| Mã đơn | Order code | `orders.code` (số, từ 100001) — cũng là `orderCode` của payOS | T-26 |
| Công đoạn | Production stage | `orders.production_stage` 1–4 (`process.steps` trong i18n) | C-11 |
| Mã giảm giá | Coupon | bảng `coupons`; loại `percent` / `amount` / `free_shipping` | D-65…D-68 |
| Cấu hình cửa hàng | Shop settings | `app_settings` key `shop`: `shippingFee`, `freeShippingFrom`, `codMaxTotal` | D-63, D-71 |
| Nhật ký kiểm toán | Audit log | bảng `audit_log`, `server/orders/audit.js` | NFR-AUD-001 |
| Đơn hàng | Order | `order` | Chưa làm |
| Lời chúc | Gift message | `gift_message` | Chưa làm |
| Thiệp cảm ơn in | Thank-you card | `thank_you_card` | Chưa làm |
| Mây | May (mascot) | `may`, `server/may/*`, `src/may/*` | Loại câu trả lời `kind`: answer / resting / tired / sick / unknown |
| Người mua / người nhận | Buyer / recipient | `buyer`, `recipient` | |
| Mua tặng / Mua cho mình | Gift / Self | `order_type`: `gift` / `self` | |
