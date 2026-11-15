# Minh hoạ theo dịp — LAMVI

Bộ 7 minh hoạ gốc tạo ngày 2026-11-15 bằng công cụ tích hợp `image_gen`, theo yêu cầu người dùng (D-143). Đây là minh hoạ số gợi chất liệu giấy dó/gouache; không phải tranh Đông Hồ tư liệu, ảnh sản phẩm hay ảnh xưởng.

Prompt đầy đủ = `promptBase` + `"Subject: "` + mục tương ứng trong [`prompts.json`](prompts.json). Không dùng ảnh tham chiếu ngoài. Bản sinh nhật không có nến vẽ sẵn; giao diện ghép nến tương tác để thổi tắt thật.

Mỗi dịp có hai WebP 480×320 và 960×640 (quality 84), không cắt bố cục. Dùng trong `src/letter-web/Surprise.jsx`; tải khi mở thiệp, có `srcset`, kích thước cố định và alt tiếng Việt. Tem tranh tư liệu trên phong bì/tờ thư vẫn thuộc bộ `../folk/` với nguồn riêng.

| Tệp | Nội dung |
|---|---|
| birthday | Bánh kem hoa mơ |
| anniversary | Đôi tách trà kỷ niệm |
| thankYou | Bó sen cảm ơn |
| milestone | Hạc giấy cho cột mốc |
| encouragement | Mầm xanh động viên |
| longDistance | Hai ô cửa sáng đèn |
| justBecause | Phong thư và hoa bất chợt |
