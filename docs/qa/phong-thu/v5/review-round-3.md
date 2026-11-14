# Visual review — vòng 3/5

Đã mở trực tiếp bằng `view_image` đủ 10 ảnh trong `docs/qa/phong-thu/v5/round-3/`, từ `01-room.png` đến `10-final.png`. Hai ảnh bánh/kết đã tồn tại trước khi mở. Chỉ review ảnh thực tế, không đọc/sửa code hoặc test, không commit.

`result.json` ghi `errors: []` và video `page@583ba37613eeb2b27c3a3cc3bbe92ba0.webm` trong cùng thư mục. Tôi chưa xem video; không dùng tên ảnh hoặc thời gian driver chờ class làm bằng chứng tốc độ animation. Thông tin delta clock/whole-word mask đã sửa là thông tin main cung cấp, không phải kết luận từ việc đọc implementation.

## Chấm từng cảnh

| Ảnh | Điểm | Đánh giá trực tiếp |
| --- | --- | --- |
| `01-room.png` | 7/10 | Không khí tối ấm và tranh gà ổn. Có thêm mảng giấy lớn chạy từ dưới phong bì sang công tắc, làm mặt bàn bận hơn; bì vẫn chìm vào bàn tối. |
| `02-lit.png` | 7/10 | Phòng sáng rõ, artwork gà giữ được nhận diện. Giấy và bì tạo nhiều lớp phẳng tương tự nhau; dòng tên trên bì chưa đủ rõ ở khoảng cách này. |
| `03-envelope.png` | 5/10 | Thấy rõ bì mở ở trước phòng, khác trạng thái trên bàn. Đỉnh nắp/niêm chỉ cách mép trên khoảng hơn 10 px, đáy bì sát mép dưới; “Gửi Linh” vẫn chìm màu. Đây chưa phải bố cục có khoảng thở. |
| `04-writing.png` | 8/10 | Tiêu đề lớn, cân giữa giấy và đủ dấu, chất nét đẹp hơn body. Ảnh chụp đã đủ chữ nên không chứng minh stroke đang diễn ra. Đầu/đáy bì còn ló sau giấy làm silhouette chưa sạch. |
| `05-docked.png` | 8/10 | Đã thấy tiêu đề ở trái trên, phần body còn trống: bằng chứng riêng cho trạng thái dock trước đọc. Bố cục thoáng, đúng hierarchy mong muốn. |
| `06-body.png` | 7/10 | Chữ hiện liền và đọc được, không còn mảnh glyph như vòng 2. Đoạn dưới đang bị cắt bởi mép giấy; không thấy gợi ý cuộn hoặc footer trong ảnh này. Chưa thể xác nhận skip footer bằng ảnh hiện có. |
| `07-lamvi.png` | 7/10 | Có nhãn “Một lời chúc từ LAMVI”, câu sinh nhật riêng, chỉ số 1/3 và nút rõ. Thẻ rộng, nhiều khoảng trống phía dưới; chữ ký “An” sát góc trên/phải khiến bố cục cuộn trông thiếu khoảng nghỉ. CTA bên dưới chạm mép vùng đọc. |
| `08-lamvi-next.png` | 7/10 | Câu thứ hai thực sự khác câu đầu, đổi thành 2/3; chiều cao thẻ ổn định giữa hai ảnh. Giọng “âm thầm vun vén… mùa nở hoa” hợp không khí. Mũi tên chéo ở nút đổi câu dễ gợi hành vi mở liên kết, chưa hợp thao tác trong cùng thẻ. |
| `09-cake.png` | 6/10 | Bánh đã lớn, gần trung tâm, nến và artwork đèn đọc được; không còn lỗi bánh tí hon của vòng 2. Nhưng khối nâu dưới bánh quá cao, giống hộp hơn đế; giấy sáng trải dài hai bên và một mẩu nâu tiền cảnh làm cảnh còn thô. |
| `10-final.png` | 5/10 | Có bổ sung dòng ký LAMVI dưới lời chúc, nhưng dòng đó bị cắt ở đáy thẻ; thẻ sát đáy ảnh. Câu chính vẫn đọc được, song cảnh kết chưa đạt độ hoàn thiện vì chữ thương hiệu bị cụt. |

Trung bình: **6,7/10** trên 10 mốc. Tiến bộ rõ ở trạng thái tiêu đề/body và kích thước bánh; **chưa duyệt tổng thể** vì bì còn khó đọc, đạo cụ bánh chưa thuyết phục và thẻ cuối bị cắt chữ.

## Title/body gating và nội dung thương hiệu

**PASS về các trạng thái được chứng minh:** `04-writing` có tiêu đề giữa trang, `05-docked` có tiêu đề trái trên khi body còn trống, `06-body` có body. Không còn bằng chứng đứng mãi ở tiêu đề giữa trang trong chuỗi ảnh này. **Chưa duyệt tốc độ viết, độ mượt dock hoặc thứ tự ở từng frame:** cần xem đoạn quay liên tục để xác nhận; driver đợi class không phải timestamp thực của motion.

Body hiện tại liền chữ, đủ dấu và đọc được ở phần đã xuất hiện. Việc cuộn tới thẻ LAMVI trong ảnh 07–08 chứng minh có nội dung phía sau, nhưng không giải quyết tín hiệu cuộn còn thiếu ở ảnh 06.

**LAMVI quotes: đạt bước đầu.** Nhãn thương hiệu rõ, có ít nhất hai câu khác nhau và bằng chứng đổi 1/3 → 2/3. Chỉ số 3 chưa được chụp; chưa đánh giá câu thứ ba hoặc các dịp khác. **Brand ở kết: chưa đạt**, vì dòng ký bị cắt. Đom đóm/hạt sáng thấy ở hai bên giấy; ảnh tĩnh chưa xác nhận cách chúng bay.

## Ba ưu tiên cụ thể cho vòng 4

### 1. P0 — Bảo vệ nội dung khi cuộn và ở cảnh kết

- Sửa thẻ cuối để toàn bộ câu chính, đường phân cách và dòng “Giữ lại một khoảng sáng — LAMVI” nằm trọn trong thẻ. Ở khung 800 × 450, chừa đáy viewport khoảng 20–24 px và padding dưới chữ ký tối thiểu 12–16 px; không đẩy dòng thương hiệu ra ngoài như `10-final`.
- Trên giấy đọc, thêm dấu hiệu còn nội dung bên dưới: một gợi ý “Cuộn để đọc tiếp” nhỏ hoặc mép fade nhẹ trong vùng padding. Tránh để đoạn cuối cụt trông như nội dung đã hết ở `06-body`; bảo đảm cuộn hết có khoảng đệm để đọc trọn dòng cuối và thao tác footer.
- Chừa khoảng nghỉ giữa chữ ký người gửi, thẻ LAMVI và CTA mở thiệp. Giữ CTA trọn khi được cuộn tới; thay mũi tên chéo ở “Lời chúc tiếp theo” bằng mũi tên ngang/biểu tượng chuyển câu để hành vi rõ hơn.

**Cần ảnh vòng 4:** thẻ cuối thấy đủ dòng ký và khoảng đáy; đầu/giữa/cuối vùng đọc với dòng cuối, skip footer và CTA được đưa trọn vào vùng nhìn. Không yêu cầu mọi nội dung phải cùng nằm trong một màn hình.

### 2. P1 — Làm bì thật sự đọc được và bớt sát khung

- Đồng ý với main về triệu chứng: `03-envelope` có tên người nhận quá nhạt. Tăng độ tương phản tên tới mức nâu đậm đọc ngay trên giấy vàng; tách chữ khỏi các đường gấp đang giao qua vùng nhãn. Kiểm ở cả ánh sáng tắt/bật và cảnh bì trước mặt.
- Không xác nhận nguyên nhân color space từ ảnh. Main có thể kiểm giả thuyết đó, nhưng tiêu chí duyệt là kết quả chữ tên rõ trong screenshot thật, không chỉ thông số texture đã đổi.
- Thu nhỏ hoặc lùi bì một chút để còn khoảng thở trên/dưới khoảng 24 px ở khung này; giữ cả nắp/niêm trong khung. Khi giấy đã thành màn đọc, hạ/giấu phần bì ló ở đỉnh và đáy để viền giấy sạch.

**Cần ảnh vòng 4:** cận bì mở với tên rõ và đủ lề; một mốc bì đang nâng giữa đường để kiểm khoảng hở/bóng trước khi mở, vì ảnh 03 hiện chỉ cho thấy trạng thái mở đã ở phía trước.

### 3. P1 — Hoàn thiện bánh và cụm đạo cụ, giữ góc máy gần hiện tại

- Giữ tỷ lệ bánh/góc gần mới: đã giải quyết vấn đề vòng 2. Đổi khối nâu cao phía dưới thành đế mỏng có hình dáng rõ, hoặc tạo tầng bánh có chất liệu nhất quán nếu chủ ý là bánh hai tầng. Hiện tại tầng trắng trên và hộp nâu dưới chưa đọc thành một chiếc bánh thuyết phục.
- Gom giấy và bì về một cụm thấp bên phải; giảm các dải giấy trắng chạy ngang mặt bàn và bỏ/giải thích được mẩu nâu nhỏ ở tiền cảnh. Chừa mặt bàn quanh đế để thấy bóng tiếp xúc, không để bánh có vẻ đứng trên nhiều tấm phẳng lộn xộn.
- Làm nến và ngọn lửa thành điểm sáng nhỏ rõ ràng, giữ hướng dẫn lệch khỏi silhouette nến. Ở cảnh kết, đặt thẻ vào khoảng âm của góc máy đã dọn, không che chân bánh hoặc sát mép ảnh.

**Cần ảnh vòng 4:** bánh trước/sau thổi nến, chân bánh và cụm bì nhìn sạch; ảnh kết cùng góc có thẻ đủ chữ. Quay liên tục thư → thu giấy → bánh để kiểm continuity thay vì chỉ đánh giá đích cuối.

## Bàn giao

Vòng 3 hoàn tất. Main sửa theo ba ưu tiên rồi cung cấp ảnh mới cho vòng 4. Chưa review vòng 4–5; không sửa thêm tài liệu ngoài báo cáo này.
