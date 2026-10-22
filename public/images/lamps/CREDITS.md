# Ảnh 5 mẫu đèn (tài sản của chính LAMVI)

Lấy ngày 2026-10-14 từ **fanpage chính thức của LAMVI** (https://www.facebook.com/profile.php?id=61593996136514), mục Ảnh hiển thị công khai khi chưa đăng nhập. Chủ sở hữu: nhóm LAMVI.

Tệp gốc chỉ là **thumbnail 206×206 px** (poster từng mẫu: tên đèn + câu giới thiệu in trên ảnh). **Từ 21/10/2026**: nâng cấp bằng Real-ESRGAN (x4plus) lên **824×824** (chạy trên bản 206 px thu từ ảnh 618 cũ; bản 618 Lanczos cũ không còn). Mô hình AI vẽ thêm chi tiết nên hoạ tiết nhỏ và chữ in trên poster có thể khác ảnh gốc đôi chút — vẫn cần ảnh gốc độ phân giải cao thật (G-110). **Cần thay bằng ảnh gốc độ phân giải cao** (G-110); khi admin tải ảnh riêng ở `/admin/products` thì ảnh admin được ưu tiên (`server/domain/photos.js`).

| Tệp | Mẫu đèn (slug) |
|---|---|
| `thu-hoach.jpg` | den-thu-hoach |
| `tu-linh.jpg` | den-tu-linh |
| `phuc-loc-song-toan.jpg` | den-phuc-loc-song-toan |
| `tam-duong-khai-thai.jpg` | den-ga-tam-duong-khai-thai |
| `lon-dan.jpg` | den-lon-dan |

Ảnh trông giống dựng bằng công cụ tạo ảnh (poster quảng bá) hơn là ảnh chụp sản phẩm thật — cần PO xác nhận được dùng làm ảnh sản phẩm.

## Bản tách nền (D-107)

`<tên>-cutout.webp` (nền trong, cao 1000 px, rộng ~440–465 px) dựng bằng `scripts/gen_lamp_cutouts.py` từ các ảnh `.jpg` ở trên: rembg tách chao đèn sáng; **đế gỗ được lấy lại từ điểm ảnh gốc** (đế tối trùng màu nền nên rembg không tách được) và cắt bằng mặt nạ bầu dục. Dùng ở hero, lookbook, thẻ sản phẩm và thẻ bộ sưu tập để giữ quầng sáng/hiệu ứng; trang chi tiết dùng ảnh đầy đủ phủ kín khung. Cắt tự động từ ảnh 206 px nên biên hơi mềm — thay bằng ảnh gốc/ảnh đã tách nền chuẩn khi có.

## Ảnh chính 1200×1200 (21/10/2026, `scripts/gen_lamp_heroes.py`)

Ảnh `<tên>.jpg` **không còn là poster gốc**: chữ in trên poster (tên đèn, câu giới thiệu) vốn chỉ có 206 px nên khi nâng cấp bằng AI bị vẽ lại thành ký tự méo, trông "vỡ" hơn cả ảnh mờ. Ảnh chính nay = bản tách nền sắc nét (`<tên>-cutout.webp`) đặt lên nền ấm lấy từ poster đã làm nhoè hẳn (chữ biến mất, giữ tông màu), có quầng sáng và bóng đổ dưới đế. Poster gốc không nằm trong repo. Khi có ảnh chụp thật full HD thì thay luôn (G-110).
