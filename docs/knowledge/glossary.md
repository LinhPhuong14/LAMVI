# Thuật ngữ

Dùng đúng tên trong cột "Code" cho biến, bảng, endpoint.

| Nghiệp vụ (vi) | Tiếng Anh | Code | Ghi chú |
|---|---|---|---|
| Sản phẩm / mẫu đèn | Product | `product`, bảng `products` | `kind`: `single` / `set` |
| Bộ Sum Vầy | Set | `kind = 'set'` | Thành phần bộ chờ Q-05 |
| Giá bán (đã gồm VAT) | Price (VAT included) | `price` / `products.price` | Số nguyên VND, **đã gồm VAT** (D-68, T-09) |
| Cấu hình tính giá | Pricing config | `app_settings.key = 'pricing'` | Thuế suất, phí ship, ngưỡng miễn ship (D-69, D-70) |
| Trạng thái hiển thị sản phẩm | Product status | `status`: `draft` / `published` / `hidden` | D-39 |
| Câu hỏi thường gặp | FAQ entry | `faq_entries` | Mây đọc từ đây |
| Lô sản xuất | Batch | `batch`, bảng `batches`, URL `/lo/:code` | QR khắc trên đèn là mã chung của lô (D-43) |
| Video lô | Batch video | `video_url` | Lưu vĩnh viễn (D-10) |
| Tài khoản / hồ sơ | Profile | bảng `profiles` (1-1 `auth.users`) | Vai trò `customer` / `admin` / `it` (D-38, D-51) |
| Chế độ bảo trì | Maintenance mode | `app_settings.key = 'maintenance'` | D-54 |
| Số liệu API | API metrics | bảng `api_metrics`, `server/monitoring/metrics.js` | D-53 |
| Ngôn ngữ ưa thích | Preferred locale | `preferred_locale` | `vi` / `en` / `zh` |
| Giỏ hàng | Cart | bảng `cart_items`, `src/cart/*`, localStorage `moc.cart` (vãng lai) | D-59, D-60 |
| Đơn hàng | Order | `order`, bảng `orders` + `order_items`, URL `/don-hang/:code` | Mã hiển thị `LV<yy><mm>-<7 ký tự>` |
| Trạng thái đơn | Order status | `status`: `pending_payment` / `confirmed` / `in_production` / `packed` / `shipped` / `delivered` / `delivery_failed` / `cancelled` | §16 |
| Trạng thái thanh toán | Payment status | `payment_status`: `pending` / `paid` / `expired` / `cancelled` / `refund_pending` / `refunded` | §15 |
| Mã giảm giá | Coupon | bảng `coupons` + `coupon_redemptions` | 3 loại `percent` / `amount` / `free_shipping` (D-71) |
| Nhật ký kiểm toán | Audit log | bảng `audit_log` | Đơn, coupon, hoàn tiền (NFR-AUD-001) |
| Cổng thanh toán | Payment gateway | `payos`, `server/adapters/payos.js` | Mã đơn gửi payOS: `payos_order_code` (số nguyên) |
| Lời chúc | Gift message | `gift_message` | Chưa làm |
| Thiệp cảm ơn in | Thank-you card | `thank_you_card` | Chưa làm |
| Mây | May (mascot) | `may`, `server/may/*`, `src/may/*` | Loại câu trả lời `kind`: answer / resting / tired / sick / unknown |
| Người mua / người nhận | Buyer / recipient | `buyer`, `recipient` | |
| Mua tặng / Mua cho mình | Gift / Self | `order_kind`: `gift` / `self` | D-76: đơn tặng luôn có lời chúc |
| Ảnh sản phẩm | Product image | `products.image_url` / `image_path` / `image_alt`, bucket `product-images` | D-77 |
