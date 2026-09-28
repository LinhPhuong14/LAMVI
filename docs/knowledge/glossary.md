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
| Đơn hàng | Order | `order` | Chưa làm |
| Lời chúc | Gift message | `gift_message` | Chưa làm |
| Thiệp cảm ơn in | Thank-you card | `thank_you_card` | Chưa làm |
| Mây | May (mascot) | `may` | Chưa làm |
| Người mua / người nhận | Buyer / recipient | `buyer`, `recipient` | |
| Mua tặng / Mua cho mình | Gift / Self | `order_type`: `gift` / `self` | |
