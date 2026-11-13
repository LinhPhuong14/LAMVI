# Kiểm tra Phòng thư POV — 2026-11-13

Bản hiện hành theo D-136 mới nhất: mở đầu POV, giữ nền Việt gen, sáu góc và thao tác chủ động. Ảnh trong `current/` là kết quả lượt mới, không phải ảnh isometric cũ ở thư mục cha.

- `current/01-pov-dark.png` đến `07-final.png`: 800×450, cùng một scene từ bật đèn đến tắt nến. Bì top-down đặt đúng tâm; thư HTML chiếm 88% ngang ở khung thấp. `birthday-mobile.webm` quay toàn bộ luồng với kéo ngắn rồi thao tác mở hoàn tất; kiểm tra kết thúc `celebrated`, không tràn ngang, không console/page error sau khi stub riêng Vercel analytics không có ở local.
- `video-mobile.webm`: lời chúc video được chủ động phát, controls có bật; phát hết 5,949 giây, audio decoded 92080 bytes; mở thiệp/tắt nến thành công. `reduced-mobile.webm` và `fallback-mobile.webm`: cùng luồng bằng bàn phím, kết thúc đúng, không lỗi JS.
- `portrait.png`: 360×800, rotate overlay, không khởi tạo canvas. `compact.png`: 360×203, reader rộng 316,8 px, cuộn được, không tràn ngang. `desktop.png`: 1440×900, game được letterbox bên trong viewport. `layout.json` đo wrapper viewport, không phải kích thước scene 16:9.
- `variants.json` ghi kết quả thực tế và chỉ số media. Đường dẫn `/tmp` trong JSON là nguồn video lúc ghi; các video đã được chép vào thư mục này.

Trình duyệt: Chromium headless, SwiftShader, DPR mặc định 1; không coi đây là benchmark GPU thiết bị thật. Video mẫu là clip tự dựng có âm thanh, không phải video lời chúc của khách hàng. Nền phòng là ảnh gen/projected plate; những góc đảo có giới hạn parallax, chưa phải nội thất scan đầy đủ. Model đèn/artwork và sợi giấy chưa phải asset sản phẩm thật.

Kiểm thử độc lập: 101/101 ca trong năm tệp phòng thư đạt sau sửa lỗi resize và cờ moving của CameraRig. Kết quả hồi quy toàn repo được ghi bổ sung khi lượt cuối hoàn tất.

Hồi quy cuối: 265 tệp, 4052 đạt, 1 ca routing ngôn ngữ không ổn định dưới tải song song, 2 bỏ qua. Chạy lại nguyên tệp `src/pages/Routing.extra.test.jsx` độc lập: 26/26 đạt. Không đổi mã routing để làm xanh kiểm tra giao diện phòng thư. `npm run lint` và build client/SSR đạt. Log lượt chạy lưu tại `/tmp/lamvi-final-tests-2.log`, `/tmp/lamvi-routing-rerun.log`, `/tmp/lamvi-final-build.log`.

Lượt kiểm tra độc lập trên build cuối (5185) xác nhận kéo native ngắn/cancel trở về ready, kéo dài tới reading; không lỗi console/JS/HTTP. Ảnh so sánh `comparison/` dùng cùng camera/lighting cho bàn cũ và KayKit. Xem README ở đó để tránh nhầm tên `room-lit` với góc phòng mở đầu.

Kiểm tra xác nhận sau chỉnh geometry cuối: `npm test -- src/letter-room src/components/Brand.extra.test.jsx src/pages/Routing.extra.test.jsx --maxWorkers=2` đạt **6 tệp / 136 ca** (gồm routing và brand).
