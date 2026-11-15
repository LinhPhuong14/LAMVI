# QA minh hoạ theo dịp — 2026-11-15 (D-143)

Kiểm trên bản build client + SSR qua Express cục bộ với adapter bộ nhớ (không thay dữ liệu thật).

- 21 lượt: bảy dịp × desktop 1440×1000, mobile 360×740, mobile nhỏ 320×568; chế độ giảm chuyển động.
- Mỗi ảnh decode thành công, `srcset` có bản WebP 480/960, khung thiệp/body không tràn ngang, đóng thiệp quay về thư, không có lỗi JavaScript. Chi tiết: `checks.json`.
- Sinh nhật: trước thổi chưa hiện lời chúc, sau thổi nến tắt và lời chúc hiện. Thêm lượt 390×844 với chuyển động mặc định: đợi animation nến tắt, kiểm Escape đóng thiệp, không lỗi JavaScript.
- Giữ sáu ảnh tiêu biểu; 21 lượt đã kiểm nhưng không lưu toàn bộ ảnh trùng bố cục.
- T-11: `src/letter-web/occasion-art.independent.test.jsx`, 12 test về bảy ảnh, responsive/kích thước dự trữ, nến/lời chúc/confetti/focus/cleanup, ảnh kỷ niệm/ngày/địa điểm/biểu tượng/tái bút và đóng khung.

Không kiểm trên thiết bị vật lý trong phiên này.

Full regression phát hiện test đổi vi → en → zh đọc link trước khi `PageTransition` hoàn tất. Sửa assertions của `Routing.extra.test.jsx` sang chờ nội dung/link cũ biến mất, giữ nguyên kỳ vọng nghiệp vụ; kiểm thử độc lập đã review và rerun tệp đạt 26/26.
