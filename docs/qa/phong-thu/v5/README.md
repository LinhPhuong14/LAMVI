# Phòng thư — năm vòng review UI và sửa

Reviewer riêng với persona Senior Game UI Designer khó tính chỉ mở ảnh và viết nhận xét; main sửa code giữa các vòng. Các báo cáo giữ nguyên nhận xét và giới hạn, không sửa điểm để giả vờ duyệt.

| Vòng | Bằng chứng | Sửa sau phản hồi |
| --- | --- | --- |
| [1](review-round-1.md) | Bảy ảnh v4 | Title viết giữa giấy/dock, artwork gen, dọn cảnh bánh |
| [2](review-round-2.md) | round-2 | Sửa clock, tăng trọng tâm bánh, body liền từ, tên bì |
| [3](review-round-3.md) | round-3 | Lề bì, sRGB tên, chữ ký LAMVI, scroll cue, đế bánh kem |
| [4](review-round-4.md) | round-4, thêm hai dịp và compact | Header compact, cue ra ngoài giấy, rút giấy 0,9, nối dải giấy |
| [5](review-round-5.md) | round-5, frame trung gian + trace | Giữ giấy đục, thêm biên quãng rút, alpha nguyên từ, chặn body tới khi CSS dock xong |

Vòng 5 không thấy P0 trong ảnh; reviewer chấp nhận bố cục đọc/quotes/artwork ở trạng thái tĩnh, còn P1 về giấy và motion. Các sửa cuối và proof bổ sung được kiểm riêng trong `round-final/` và `title-proof/`; đây là bước sửa/xác minh sau audit thứ năm, không gọi là vòng review thứ sáu. Trung bình từng vòng không so trực tiếp do bộ ảnh và số mốc khác nhau.

## Bằng chứng hiện hành

- `round-final/flow.webm`: luồng Three.js từ đèn tắt đến tắt nến; cùng thư mục có ảnh và `result.json` ghi phase và thời điểm lấy mẫu. Tên file là mục tiêu driver; **phase trong JSON** mới cho biết phase thật. Capture có thể trễ trên SwiftShader, không suy thời lượng animation từ khoảng cách hai ảnh.
- `title-proof/title-sequence.webm`, `timing.json`: cùng TitleInk/Reader nhưng ép fallback để đo DOM/CSS không chịu chi phí render phòng. Lấy mẫu 50 ms cho nét đã xong, dock bắt đầu/kết thúc, body hiện; không dùng proof này để khẳng định bóng/drag 3D.
- `round-5/compact-*`: 360×203; đọc được bốn dòng đoạn đầu, thẻ LAMVI và nút trong khung, cue ngoài giấy. `quote-*` có ảnh riêng kỷ niệm/động viên, sinh nhật trong luồng chính. Bảy dịp còn được kiểm bằng unit test, không khẳng định đã chụp mọi dịp.
- Các clip được đổi từ tên tự động `page@...webm` thành `flow.webm` sau ghi; báo cáo lịch sử có thể giữ tên nguồn cũ. Video lỗi/phiên ghi hủy không được giữ để nghiệm thu.

## Kiểm tra

Hồi quy toàn nhánh: **268 tệp, 4084 ca đạt, 2 bỏ qua** (`npm test -- --maxWorkers=4 --retry=1`, /tmp/lamvi-v5-full-tests.log). Sau chỉnh cuối chạy lại focused và build/lint; số liệu xác nhận ở phần bổ sung bên dưới. Reviewer không được dùng thay kiểm thử độc lập.

Trình duyệt Chromium headless/SwiftShader, landscape 800×450; compact bổ sung có fallback 2D. Không benchmark GPU điện thoại thật, không tuyên bố FPS/easing đã được reviewer xem trọn video. Có thể decode clip bằng FFmpeg đi kèm Playwright tại cache ffmpeg-1013 (không cần cài dependency dự án); các frame bổ sung lưu cùng proof.

Artwork là ảnh gen minh họa, không phải tranh Đông Hồ được xác thực. Source/prompt: `docs/art/dong-ho-roosters-v5*`. Đèn/model và texture dó vẫn cần asset sản phẩm thật.

## Xác minh sau audit thứ năm

- Sau phản hồi cuối, thư HTML bắt đầu với opacity **1**; giữ hình khối giấy đục. Pose bì lùi/đặt thấp thêm, quãng rút giữ 0,9 vừa thoát miệng; nắp gập ra xa người đọc rồi nằm phẳng khi bì về bàn, tránh che lá thư. `round-final/03b-extract.png` có biên trên khoảng 30 px, `03c-lifting.png` giấy đục; kiểm thêm tám frame decode trực tiếp từ clip trong `round-final/video-frames/`.
- Thân thư dùng alpha đồng đều trên nguyên từ; không còn clip cắt qua glyph/dấu. Title giữ phong cách nét SVG cho demo Linh, tên khác vẫn là font + mask (giới hạn đã nêu).
- Proof mới: inkComplete 4113 ms, dockStart 4526 ms, dockEnd 5392 ms, bodyStart 5392 ms, **bodyNeverDuringDock=true** trong 160 mẫu. Đây là thời gian tương đối từ khi bắt đầu probe, không phải thời gian từ mở trang. Có guard `getAnimations()` và `transitionend` thật, thay vì đoán dock xong chỉ bằng timer. Clip và JSON ở `title-proof/`.
- Lượt Three.js cuối trên production local 5198 kết thúc `celebrated`, errors=[], không tràn ngang. Thời gian giữa các ảnh không dùng làm FPS. Clip `round-final/flow.webm` đã được decode bằng FFmpeg cache Playwright; reviewer vòng 5 chưa trực tiếp xem clip này, main kiểm frame sau sửa.
- Kiểm thử cuối: **126/126 ca phòng thư (7 tệp)**, có test chặn body khi CSS transition còn chạy; lint sạch, build client/SSR đạt. Hồi quy toàn nhánh trước các sửa hình ảnh cuối: **4084 đạt, 2 skip, 268 tệp**. Không đánh đồng suite này với suite master của phiên khác.
