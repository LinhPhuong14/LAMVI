# Ảnh thương hiệu LAMVI (tài sản của chính LAMVI)

Lấy ngày 2026-10-14 từ **fanpage chính thức của LAMVI** (https://www.facebook.com/profile.php?id=61593996136514), phần hiển thị công khai khi chưa đăng nhập. Chủ sở hữu: nhóm LAMVI — không phải ảnh bên thứ ba.

| Tệp | Nguồn | Kích thước | Ghi chú |
|---|---|---|---|
| `logotype.svg` | `LAMVI_logotype_vector_chuan.pdf` do nhóm LAMVI gửi (2026-10-21), đổi PDF → SVG bằng `pdftocairo -svg`, làm tròn toạ độ 2 chữ số | 180,75×49,5 (vector) | Logotype chuẩn, màu nâu #8A543A. Dùng ở thanh điều hướng (`Wordmark.jsx`); header đăng nhập/đăng ký đổi sang màu kem bằng CSS filter |
| `logo-round-400.jpg` | Ảnh đại diện của fanpage (gốc 200×200) nâng cấp bằng Real-ESRGAN x4 rồi thu về 400 px (21/10) | 400×400 | Logo tròn nâu–vàng "LV LAMVI — Ánh sáng từ di sản Việt". Bản nâng cấp bằng AI, vẫn cần file gốc/vector; dùng cho favicon, chân trang, khung đăng nhập và tài khoản. Logotype vector đã có (`logotype.svg`), logo tròn vector vẫn chưa có |
| *(không còn trong `public/`)* `docs/brand-source/cover-960.jpg` | Bài đăng cập nhật ảnh bìa | 960×540 | **Bản gốc để ngoài `public/` vì dải dưới in thông tin liên hệ (email lệch D-110) — không phục vụ công khai. Đã được `cover-1672x800.jpg` thay thế; bản 960 chỉ giữ để tham chiếu.** Banner "LAMVI — Mang câu chuyện Việt sống lại bằng ánh sáng và công nghệ" kèm dải thông tin liên hệ in sẵn trong ảnh (địa chỉ, hotline, email, website, TikTok) — thông tin này chưa được xác nhận (xem ba-spec G-115) |
| `cover-1672x800.jpg` | Cắt từ `docs/brand-source/cover-1672.jpg` (banner full HD nhóm gửi 2026-10-21; bỏ 141 px dải thông tin liên hệ phía dưới — dải đó in email `lamvi6866@` lệch với email chính thức D-110) | 1672×800 | Dùng ở mục Di sản trên trang chủ và dựng `og/default.png`. Thay bản 960×460 lấy từ fanpage |

`../../favicon.png` (64 px, cắt tròn) và `../../apple-touch-icon.png` (180 px) dựng từ `logo-round-400.jpg` thay cho logo mặc định của Vite.

Ảnh sản phẩm trên fanpage (poster từng mẫu đèn) chỉ lấy được bản thumbnail ≤ 206 px khi chưa đăng nhập → **không dùng cho web**; cần ảnh gốc từ nhóm.
