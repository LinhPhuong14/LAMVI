# Visual review — vòng 1/5

Vai trò: Senior Game UI Designer khó tính. Chỉ review, không sửa code/test, không commit. Main thực hiện sửa trước khi gửi ảnh mới cho vòng 2.

## Bằng chứng và giới hạn

Đã mở trực tiếp bằng `view_image` cả 7 ảnh `docs/qa/phong-thu/v4/v4-1-room.png` đến `v4-7-final.png`, kích thước 800 × 450. Chỉ chấm bản v4 này. Ảnh tĩnh cho phép đánh giá bố cục, vật liệu, chữ và chênh lệch giữa các mốc; không chứng minh tốc độ viết, độ mượt camera, đường bay phong bì hay chuyển động đom đóm. Không kết luận các hiệu ứng ấy đã có hoặc chưa có chỉ từ ảnh chụp.

## Điểm từng cảnh

| Cảnh / ảnh | Điểm | Nhận xét dựa trên ảnh |
| --- | --- | --- |
| Phòng tối — `v4-1-room.png` | 6/10 | POV và cửa sổ chiều tối tạo được không khí. Công tắc có hướng dẫn rõ, nhưng phong bì gần chìm vào mặt bàn; tranh trên đèn giống hai con chim biểu tượng, độ chi tiết thua tranh gà trên tường. |
| Bật đèn — `v4-2-switch.png` | 6/10 | Sắc vàng ấm hợp phòng thư, đèn thành điểm hút mắt. Mặt bàn sáng khá đều, phong bì vàng trên nền nâu thiếu bóng tiếp xúc rõ; thân đèn gần trắng trơn khiến hình chim càng giống decal. |
| Phong bì — `v4-3-envelope.png` | 5/10 | Gần như trùng bố cục ảnh bật đèn; phong bì vẫn nằm ở vị trí cũ, dấu chỉ dẫn nhỏ nằm trên con dấu. Ảnh này chưa truyền đạt được trạng thái “đã nhấc lên / đang mời mở”, chữ trên bì quá mờ để đọc. |
| Mở bì — `v4-4-slot.png` | 5/10 | Phong bì chiếm trung tâm, giấy caro bên trong dễ nhận. Nắp bì bị cắt ở mép trên; các tam giác phẳng và nét chéo chiếm ưu thế, dòng “Gửi Linh” tương phản thấp. So với ảnh 3, tỷ lệ và vị trí đổi rất lớn, cần bằng chứng chuyển tiếp. |
| Lá thư — `v4-5-letter.png` | 5/10 | Giấy caro và chữ nâu thống nhất chất liệu. Tiêu đề đã ở góc trái trong khi thân thư đang xuất hiện; dòng thứ hai có nhiều mảnh nét rời, khó đọc. Nút “Hiện toàn bộ lá thư” chen giữa lời chào và nội dung làm đứt nhịp đọc. |
| Bánh sinh nhật — `v4-6-cake.png` | 4/10 | Nhận ra bánh và nến, nhưng quá nhiều mảng giấy/phong bì cỡ lớn chồng nhau ở tiền cảnh; khối nâu dưới bánh khiến cấu trúc khó hiểu. Đèn chuyển sang phải, bị cắt đỉnh và chỉ còn một mẩu họa tiết nhìn thấy. Bố cục mất sự yên tĩnh của cảnh đầu. |
| Kết — `v4-7-final.png` | 5/10 | Lời chúc đọc được, có nền riêng. Tuy nhiên thẻ trắng đặt thấp, phủ lên vùng tiền cảnh vốn đã chật; câu “Tuổi mới…” còn khá chung và không có dấu hiệu LAMVI trong chính thẻ. Cảnh phía sau chưa đủ gọn để tạo khoảnh khắc kết. |

Trung bình: **5,1/10**. Chưa duyệt chất lượng hình ảnh: phòng có không khí, nhưng đạo cụ và chuyển cảnh chưa tạo thành một trải nghiệm thống nhất.

## Ba ưu tiên sửa, theo thứ tự

### 1. P0 — Chốt màn viết tiêu đề: giữa giấy → viết chậm theo nét → dock trái trên → mới hiện thân thư

**Bằng chứng:** `v4-5-letter.png` cho thấy lời chào ở trái trên và nội dung xuất hiện thành những đoạn nét rời ở dòng thứ hai. Một ảnh không xác nhận được đã có màn viết tiêu đề ở giữa trước đó; vì vậy yêu cầu này hiện chưa được chứng minh, chưa thể duyệt.

**Sửa cụ thể:** cho “Gửi Linh,” mở đầu ở giữa vùng giấy, lớn hơn chữ thân khoảng 1,5 lần; viết tuần tự theo nét bút với nhịp chậm, đủ thấy thứ tự nét và dấu tiếng Việt. Hoàn tất rồi giữ khoảng 0,6–0,8 giây, di chuyển và thu nhỏ chính tiêu đề ấy về trái trên trong khoảng 0,7–1 giây; sau khi dock mới cho thân thư hiện theo dòng hoặc đoạn. Không để một dòng đọc dở thành các mảnh chữ rải như ảnh hiện tại. Dời nút bỏ qua xuống góc dưới của vùng đọc, giảm độ nổi và tránh chen giữa lời chào với đoạn đầu. Đây là mục tiêu timing đề xuất, không phải số đo từ ảnh.

**Điều kiện duyệt vòng sau:** có ảnh giữa lúc tiêu đề đang viết ở trung tâm, ảnh dock xong nhưng thân chưa hiện, ảnh thân đọc rõ; kèm đoạn quay liên tục để kiểm nhịp stroke, dấu tiếng Việt và thứ tự chuyển trạng thái. Giấy caro và tiêu đề không nhảy vị trí khi nút bỏ qua thay đổi trạng thái.

### 2. P0 — Giữ một phong bì xuyên suốt; dọn cảnh bánh để khôi phục continuity

**Bằng chứng:** `v4-2-switch.png` và `v4-3-envelope.png` gần như giống nhau, rồi `v4-4-slot.png` có phong bì rất lớn, nắp cắt mép trên. Tới `v4-6-cake.png`, đèn ở phía phải thay vì trái và tiền cảnh phủ đầy những mặt giấy lớn; `v4-7-final.png` giữ nguyên sự chật chội này. Chênh lệch các ảnh là có thật; chưa thể gọi đó là chuyển động giật nếu chưa xem video.

**Sửa cụ thể:** tạo mốc trung gian nhìn rõ phong bì nâng khỏi bàn với bóng tách dần, giữ nguyên màu giấy, dấu niêm, mặt có tên người nhận và tỷ lệ nắp trong suốt đường bay. Khi mở, để toàn bộ nắp trong khung với khoảng thở tối thiểu 5% chiều cao ảnh. Cho giấy trượt ra từ miệng bì theo cùng trục trước khi phủ vùng đọc. Sau đọc thư, đặt giấy và bì về một cụm gọn, chỉ giữ các lớp cần thiết; tách chân bánh khỏi các mặt giấy và khối nâu đang làm rối silhouette. Chọn góc bánh còn thấy được đèn cùng họa tiết, tránh cắt đỉnh và tránh cảm giác đổi chỗ đèn đột ngột. Nếu đổi góc máy, cần chuyển động có mốc phòng để người xem theo dõi.

**Điều kiện duyệt vòng sau:** quay liên tục từ bật đèn → nâng bì → mở → rút giấy → bánh → kết. Chụp thêm mốc phong bì đang nổi và giấy rút nửa chừng. Ở cảnh bánh, silhouette bánh/nến phải đọc được ngay, không có lớp giấy lớn chạy xuyên vùng chân bánh; lời chúc có vùng thở riêng.

### 3. P1 — Nâng chất tranh Đông Hồ và đưa chất LAMVI vào ánh sáng, đom đóm, lời chúc theo dịp

**Bằng chứng:** `v4-1-room.png`/`v4-2-switch.png` có hai hình chim đơn giản trên đèn, trong khi tranh gà treo tường có chi tiết phong phú hơn; tới cảnh bánh họa tiết đèn chỉ còn một mẩu ở mép. Trong bảy ảnh chưa thấy rõ đom đóm. Thẻ kết `v4-7-final.png` chỉ có lời chúc sinh nhật chung; nhãn LAMVI ở góc màn hình chưa đủ tạo giọng thương hiệu cho lời chúc. Không thể xác định bằng ảnh liệu asset có được tạo bằng AI, các dịp khác đã có nội dung, hay hạt sáng đang nằm ở thời điểm khác của animation.

**Sửa cụ thể:** dùng artwork được tạo riêng theo tinh thần tranh Đông Hồ với nét khắc có chủ ý, bảng màu son–vàng–chàm tiết chế và chất giấy dó; thay hình chim dạng biểu tượng bằng một bố cục đủ thuyết phục khi nhìn gần. Ôm artwork theo mặt trụ đèn, giữ chi tiết khi bật sáng và đặt vùng nhìn chính về phía camera ở cả cảnh phòng lẫn bánh. Thêm đom đóm thưa quanh cửa sổ/vùng tối, kích thước và độ sáng có phân cấp; tránh bay lên mặt giấy, chữ và vùng thao tác. Thẻ kết nên cùng chất giấy với thư, có dòng ký nhỏ “LAMVI” và câu chúc riêng theo dịp, chỉ xuất hiện sau khi nghi thức tương ứng hoàn tất. Ví dụ giọng sinh nhật: “Thêm một tuổi, thêm một khoảng sáng cho điều bạn thương. — LAMVI”. Các dịp còn lại cần câu riêng, không chỉ đổi tên người nhận.

**Điều kiện duyệt vòng sau:** ảnh cận artwork lúc đèn tắt/bật, ảnh đom đóm đọc được trên nền tối, ảnh thẻ kết sinh nhật có chữ ký; khi main triển khai các dịp khác thì cung cấp ảnh riêng để review nội dung theo dịp. Không xem ảnh sinh nhật là bằng chứng cho toàn bộ dịp.

## Bàn giao

Chỉ hoàn tất **vòng 1**. Chờ main sửa và gửi bộ ảnh mới trước vòng 2; không chấm trước vòng 2–5. Không chỉnh code/test, không chạy kiểm thử sản phẩm cho tác vụ review ảnh, không commit. Báo cáo này là tệp duy nhất được tạo trong lượt review.
