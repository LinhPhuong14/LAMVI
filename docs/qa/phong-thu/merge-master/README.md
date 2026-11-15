# Merge Phòng thư — 2026-11-15

PO đã xác nhận xử lý conflict và merge `feat/phong-thu` vào `master`.

- Giữ các thay đổi mới từ master đến `e3565ff`: web 2D mặc định ở `/phong-thu`, phòng 3D ở `/phong-thu/3d`, ảnh bảy dịp D-143, thư lẻ D-142, template/lamp, intro films, API/QR, admin preview và bản sửa kiểm thử routing.
- Phần conflict 3D giữ title font Dancing Script/mask cho mọi tên, ready gate tải font + asset + frame đầu; giữ đồng thời postscript ở thư và cảnh kết, chỉ mở bất ngờ khi có dữ liệu thật (không coi photos:[] là có nội dung).
- Giữ dependencies `@fontsource/patrick-hand`, `@fontsource/dancing-script`, `canvas-confetti` cùng Three.js/camera-controls; giữ cả lịch sử quyết định/tài liệu của hai nhánh.
- T-11 bổ sung `src/letter-room/merge-contract.independent.test.jsx`: title/font và transition gate, postscript, trường dữ liệu rỗng, afterLetter, route/template/QR cho thư lẻ. Cập nhật integration test theo hành vi title mới, vẫn kiểm role=status của lỗi video.

## Xác minh

Lint + build client/SSR đạt. Focused 10 tệp/169 ca đạt trên bản đã giải quyết conflict đầu tiên; sau đó cập nhật master mới `e3565ff` và chạy hồi quy toàn dự án. Kết quả toàn bộ ghi bổ sung sau khi hoàn tất.

Browser Chromium headless 800×450 reduced-motion trên build production local 5311: `/phong-thu` có `.lw-page` đúng web 2D; `/phong-thu/3d` bật đèn → mở bì → mở giấy → đọc thư, heading computed `Dancing Script`, SVG trong title=0, vùng LAMVI có mặt, không lỗi JS. Ảnh và số đo cùng thư mục. Đây không phải benchmark GPU điện thoại hay kiểm chứng triển khai Vercel đã hoàn thành.

Không đổi cấu hình deploy, không chạy migration/ghi dữ liệu thật; bảo toàn `.mcp.json` đang được người dùng sửa ở worktree master.

Kết quả cuối: **284 tệp / 4370 ca đạt / 2 bỏ qua**, `npm test -- --maxWorkers=6 --retry=1`. Lượt đầu tìm đúng ba kiểm thử Reader còn kỳ vọng SVG/2300 ms; đã cập nhật chỉ ba ca đó theo title font/5600 ms/transition guard, giữ nguyên bốn ca HandwrittenTitle 2D (tệp 7/7 đạt). Lint sạch và build client/SSR đạt. Không có ca lỗi còn bỏ ngỏ.

Đẩy master qua worktree tích hợp riêng; so sánh Git tree với nhánh đã kiểm tra trước push. Worktree master chính chỉ fast-forward; không stash/reset hay đưa `.mcp.json` vào commit.
