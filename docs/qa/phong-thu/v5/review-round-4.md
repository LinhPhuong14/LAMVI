# Visual review — vòng 4/5

Đã mở trực tiếp bằng `view_image` toàn bộ 14 PNG trong `docs/qa/phong-thu/v5/round-4/`: 10 mốc chính, `compact-reader`, `compact-end`, `quote-anniversary`, `quote-encouragement`. Không đọc/sửa code hoặc test, không commit. Báo cáo này là đầu ra duy nhất.

`result.json` ghi `errors: []` và video `page@ea31823a92bd79e79095029f1b96a687.webm`; chưa xem video. Tên ảnh và trạng thái driver không chứng minh timing/motion. Vòng 5 sẽ kiểm bằng frame trung gian và timing trace được cung cấp.

## Điểm từng cảnh và compact

| Ảnh | Điểm | Nhận xét dựa trên hình |
| --- | --- | --- |
| `01-room` | 7/10 | Không khí và điểm chạm công tắc ổn. Bì vẫn khá tối nhưng cảnh có chủ đích ánh sáng; chưa thấy lỗi mới đáng chặn. |
| `02-lit` | 7/10 | Tranh gà, ánh đèn và phòng thống nhất. Tên bì đã đậm hơn; giấy lót và bì vẫn khá phẳng nhưng đọc được cấu trúc. |
| `03-envelope` | 7/10 | “Gửi Linh” rõ hơn hẳn vòng 3, nắp/niêm nằm trọn khung; đỉnh khoảng 40 px, đáy khoảng 28 px tại 800 × 450. Khoảng thở đã chấp nhận được. Đường gấp vẫn giao qua khung nhãn nhưng không còn làm mất tên. |
| `04-writing` | 8/10 | Tiêu đề giữa giấy đẹp, viền giấy sạch, không còn đầu/đáy bì ló. Ảnh đã đủ chữ nên chưa chứng minh được stroke hoặc quãng rút giấy. |
| `05-docked` | 7/10 | Tiêu đề trái trên, body còn trống: trạng thái gating tốt. Tuy nhiên gợi ý “Cuộn để đọc tiếp” đã hiện khi chưa có body, gọi thao tác quá sớm. |
| `06-body` | 6/10 | Thân thư rõ và liền chữ. Gợi ý cuộn nằm đè ngay trên dòng “Mình nhớ những buổi chiều…”, trở thành vật cản đọc. Đây là lỗi mới do cách đặt cue, không phải do nội dung dài. |
| `07-lamvi` | 7/10 | Thẻ thương hiệu rõ, nút đổi câu dùng mũi tên ngang đúng hành vi. Cue cuộn nằm chồng lên mép CTA mở thiệp phía dưới, làm cụm thao tác thiếu sạch. |
| `08-lamvi-next` | 7/10 | Nội dung đổi sang câu khác và 2/3, bố cục ổn định. Vẫn còn xung đột cue/CTA như ảnh 07. |
| `09-cake` | 7/10 | Hai tầng cùng màu kem đã đọc thành bánh, bớt giống hộp; nến có trọng tâm, đèn giữ artwork. Giấy dưới bánh/phong bì còn hơi nhiều cạnh nhưng không còn rối như vòng đầu. |
| `10-final` | 7/10 | Câu chúc và dòng “Giữ lại một khoảng sáng — LAMVI” nằm trọn thẻ; thẻ lệch phải, không che bánh. Có một dải trắng viền nâu tách rời ở mép bàn trái, trông như mảnh đạo cụ sót. Thẻ còn khá gần mép phải nhưng đủ lề. |
| `compact-reader` | 4/10 | Ảnh 360 × 203: tiêu đề dock còn rất lớn, vùng đầu và khoảng trống chiếm phần lớn giấy. Chỉ khoảng một dòng body nhìn trọn, dòng kế bị cắt; cue cuộn nổi giữa vùng đọc nhỏ. Đây chưa phải bố cục compact đạt chất lượng. |
| `compact-end` | 7/10 | CTA “Mở kỷ niệm của chúng mình” nằm trọn vùng nhìn, có khoảng trống dưới. Phần thẻ phía trên bị cắt phù hợp ảnh ở vị trí cuộn cuối, không tự xem là lỗi tràn. Ảnh này chưa chứng minh chữ/nút của toàn thẻ có thể đọc thuận tiện ở compact. |
| `quote-anniversary` | 8/10 | “Mong mình còn nhiều ngày bình thường để cùng nhau nhớ lại.” đúng giọng kỷ niệm; CTA cùng ngữ cảnh, brand rõ. Cue cuộn vẫn đè mép CTA. |
| `quote-encouragement` | 8/10 | “Hôm nay đi chậm một chút cũng được, bạn vẫn đang trên đường.” có giọng động viên riêng; CTA “Mở khi cần” phù hợp. Không thấy đổi tên dịp một cách máy móc. Vẫn vướng cue như ảnh kỷ niệm. |

Trung bình 14 ảnh: **6,9/10**. Không so trực tiếp trung bình này với vòng trước vì thêm ảnh compact và dịp khác. Các sửa tên bì, biên giấy, chất liệu bánh, dòng ký thẻ kết đã có kết quả nhìn thấy; **chưa duyệt hoàn thiện** vì compact và cue đang cản việc đọc.

## Ba ưu tiên hoàn thiện cho vòng 5

### 1. P0 — Thiết kế lại vùng đầu thư cho chiều cao compact

- Với 360 × 203, thu nhỏ tiêu đề sau dock và giảm mạnh khoảng cách dưới tiêu đề/đầu đoạn; giữ tiêu đề lớn ở màn viết giữa giấy nếu còn vừa khung. Hai trạng thái không cần cùng tỷ lệ chữ.
- Mục tiêu tại trạng thái dock + body: thấy ít nhất khoảng ba dòng body trọn vẹn, không chỉ một dòng như `compact-reader`. Giữ cỡ chữ body dễ đọc, ưu tiên giảm header và padding thay vì ép toàn bộ chữ nhỏ lại.
- Giữ cue và footer khỏi vùng chữ, không để điều khiển góc trên lấn nội dung khi cuộn. Kiểm riêng lời chúc nhiều dòng và nút đổi câu trên compact; `compact-end` mới chứng minh CTA cuối nằm trọn.

**Bằng chứng vòng 5:** compact giữa lúc viết, dock + body, thẻ LAMVI đầy đủ khi cuộn đến, và cuối thư. Chụp đúng 360 × 203 cùng một khung landscape phổ biến lớn hơn để tránh sửa vừa một kích thước duy nhất.

### 2. P1 — Đặt cue cuộn vào vùng riêng và chỉ hiện khi có nội dung để cuộn

- Không hiện cue ở trạng thái tiêu đề dock mà body còn trống như `05-docked`. Chỉ hiện khi nội dung đã có và còn phần bên dưới vùng nhìn.
- Dành một dải nhỏ ở chân giấy ngoài vùng text/CTA cho cue, hoặc đặt vào lề; tăng padding vùng cuộn tương ứng để không dòng nào chạy dưới nhãn. `06-body` đang bị che chữ thật, còn `07/08` và hai ảnh quote bị nhãn phủ mép nút.
- Ẩn cue khi tới cuối nội dung. Giữ “Hiện toàn bộ lá thư” trong vùng điều khiển riêng khi còn cần; bộ ảnh này chưa có ảnh rõ của nút skip footer nên chưa xác nhận vị trí cuối cùng của nó.

**Bằng chứng vòng 5:** dock chưa có cue, body có cue nhưng không che chữ, thẻ LAMVI/CTA không bị chồng, cuối thư cue biến mất; kiểm cả desktop và compact.

### 3. P1 — Dọn mảnh đạo cụ ở kết và đóng kiểm tra continuity bằng bằng chứng chuyển động

- Loại bỏ hoặc đưa về đúng cụm giấy dải trắng viền nâu ở tiền cảnh trái trong `10-final`; không để một mảnh riêng xuất hiện ở cảnh kết làm người xem nghi là vật bị tách. Ảnh `09-cake` không có dải ấy ở cùng vị trí dễ thấy, cần kiểm cả quá trình chuyển trạng thái thay vì đoán nguyên nhân.
- Giữ bố cục bánh và thẻ kết hiện tại; ưu tiên bóng tiếp xúc/viền giấy sạch, không mở rộng thêm đạo cụ. Dòng ký LAMVI đã đủ chữ, không cần tăng kích thước thẻ.
- Main dự định giảm quãng rút giấy từ 1,35 xuống 0,9. Chưa duyệt con số từ ảnh: tiêu chí là giấy rút vừa qua miệng bì, không bay khỏi viewport hoặc xuyên nắp; bì về bàn có đường đi liên tục, giấy chuyển thành màn đọc không nhảy hình.
- Cung cấp frame trung gian gắn timestamp thực từ cùng một lượt quay: bì trên bàn → nâng → mở nắp → giấy rút nửa chừng → vừa thoát túi → giấy đọc/viết → dock → body → thu giấy → bánh → kết. Kèm trace thời điểm viết xong, bắt đầu/kết thúc dock, body bắt đầu. Dùng chúng để kiểm thứ tự và khoảng thời gian; class được driver chờ không thay thế được quan sát chuyển động.

**Điều kiện duyệt vòng 5:** không cắt giấy/nắp ở frame trung gian, không có mảnh đạo cụ xuất hiện vô cớ; tiêu đề có bằng chứng viết chậm theo nét, dock hoàn tất trước body; đom đóm thưa và tránh vùng chữ. Nếu chỉ có frame rời/trace sự kiện mà chưa xem được video, sẽ ghi rõ giới hạn về độ mượt giữa các frame.

## Bàn giao

Vòng 4 hoàn tất. Chờ main sửa và gửi bộ vòng 5 thực tế; chưa chấm hoặc suy trước kết quả vòng cuối. Các dịp kỷ niệm và động viên đã có bằng chứng lời chúc riêng; chưa mở rộng kết luận sang những dịp chưa được cung cấp.
