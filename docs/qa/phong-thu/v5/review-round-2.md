# Visual review — vòng 2/5

Đã mở trực tiếp bằng `view_image` đủ 9 ảnh `/tmp/v5-r2-{1-room,2-switch,3-envelope,4-slot,5-letter,5b-docked,5c-body,6-cake,7-final}.png` (800 × 450). Không đọc/sửa code, không sửa test, không commit.

Đã đọc `/tmp/qa-v5-r2.log`: log ghi `final celebrated overflow false errors 0`, video tại `/tmp/lamvi-six-video/page@1b1dbbbf87af9a3150bd13bbbd4a6dec.webm`. Đây là thông tin từ log, không phải kết quả tôi xem video. Nhận xét dưới đây dựa trên ảnh thực tế; độ mượt và nhịp stroke chưa được kiểm bằng chuyển động.

## Chấm từng mốc

| Ảnh | Điểm | Nhận xét |
| --- | --- | --- |
| `1-room` | 7/10 | Tranh gà trên đèn có nét, màu và bố cục thuyết phục hơn hình chim cũ; phòng giữ được không khí tối ấm. Phong bì vẫn khá chìm vào bàn. |
| `2-switch` | 7/10 | Artwork vẫn đọc được khi đèn sáng, chất dân gian rõ hơn vòng 1. Ánh đèn làm màu tranh nhạt đi đáng kể; cần giữ sắc đen/nâu của nét khắc. |
| `3-envelope` | 5/10 | Ảnh vẫn gần trùng cảnh bật đèn, chỉ thêm dấu chỉ dẫn trên niêm. Chưa thấy khoảng hở/bóng tách để đọc trạng thái phong bì đang nổi. Thông số khoảng cách mới không thay thế được bằng chứng hình ảnh. |
| `4-slot` | 6/10 | Bì nhỏ hơn vòng 1, để lộ thêm phòng hai bên, giấy caro nhìn rõ. Đỉnh nắp vẫn cắt ở mép trên; tên người nhận trên bì còn mờ, giao tuyến tam giác khá phẳng. |
| `5-letter` | 7/10 | Tiêu đề lớn ở giữa, nét viết thanh thoát, có cảm giác mở đầu riêng. Ảnh bắt ở “Gửi Li…” nên đúng là một trạng thái đang viết, nhưng không đủ để xác nhận tốc độ hay stroke thực sự. |
| `5b-docked` | 4/10 | “Gửi Linh,” đã đủ chữ nhưng vẫn ở giữa. Theo mốc 6,2 giây do main cung cấp, đây là mốc dock thất bại; tên file không phải bằng chứng đã dock. |
| `5c-body` | 6/10 | Tiêu đề thực tế đã dock trái trên, thân thư hiện bên dưới; không bị kẹt vĩnh viễn. Tuy vậy dòng “Chiếc đèn này…” vẫn bị vụn nét; nút hiện toàn bộ nằm ngang cạnh đoạn đầu, cạnh tranh với nội dung. |
| `6-cake` | 5/10 | Bàn, đèn và phong bì bớt chồng lấn, đèn thấy trọn và còn giữ artwork. Nhưng góc máy lùi quá xa: bánh chỉ rộng khoảng 45 px, nến rất nhỏ, khoảng tường/sàn chiếm nhiều diện tích. Khoảnh khắc sinh nhật thiếu trọng tâm. |
| `7-final` | 5/10 | Thẻ chúc dễ đọc hơn vùng nền bận ở vòng 1, nhưng lớn hơn bánh nhiều lần và che phần bàn. Câu chúc vẫn là câu cũ, không có ký LAMVI trên thẻ; cảnh kết chưa có dấu ấn nội dung mới. |

Trung bình 9 mốc: **5,8/10**. Số mốc khác vòng 1 nên không dùng chênh lệch trung bình để khẳng định mức tăng chất lượng. Artwork và độ gọn cảnh bánh tiến bộ; nhịp tiêu đề và trọng tâm bánh chưa đạt.

## Kết luận title/body gating

**FAIL về thời điểm hoàn tất/dock của lượt này.** `5b-docked` vẫn đứng giữa ở mốc main yêu cầu 6,2 giây. Cần sửa trước khi duyệt trải nghiệm tiêu đề.

**Có bằng chứng thoát sang thân thư:** `5c-body` đã dock và hiện nội dung. Vì vậy không kết luận “kẹt vĩnh viễn” hoặc “không bao giờ hiện body”. Thứ tự trong hai ảnh cuối phù hợp việc dock rồi đọc, nhưng ảnh tĩnh không chứng minh body chỉ bắt đầu sau khi animation dock kết thúc. Main đã báo tiến độ timer chậm hơn dự định và sẽ sửa delta updater; nguyên nhân này là thông tin main cung cấp, tôi không kiểm code để xác nhận.

## Ba sửa ưu tiên cho vòng 3

### 1. P0 — Sửa tiến độ tiêu đề và loại bỏ chữ thân bị vụn

- Đặt timeline đo bằng thời gian thực: viết xong → giữ ngắn → dock hoàn tất → body bắt đầu. Nếu giữ mục tiêu 6,2 giây cho ảnh dock, tại mốc ấy tiêu đề phải nằm trái trên đúng vị trí cuối; không chấp nhận ảnh giữa trang mang tên “docked”.
- Sau dock mới hiện body bằng dòng/đoạn đọc liền mạch. Ở `5c-body`, các mảnh nét cuối dòng vẫn tạo cảm giác chữ lỗi; cần bỏ kiểu hiện làm vỡ glyph và dấu tiếng Việt này.
- Đưa “Hiện toàn bộ lá thư” ra khỏi cột đọc, vào chân giấy với khoảng cách riêng; không đặt cạnh dòng đầu như hiện tại.

**Bằng chứng cần ở vòng 3:** ảnh đang viết giữa trang, ảnh hoàn tất trước dock, ảnh dock xong ở timestamp thực, ảnh body rõ; kèm quay liên tục có mốc thời gian để xác nhận không stall và không chồng hai giai đoạn. Nếu còn đứng giữa quá mốc và không tiến tiếp, đánh trượt cả gating; không coi chữ đẹp là đủ.

### 2. P0 — Kéo trọng tâm về bánh, đồng thời chứng minh phong bì thật sự nổi

- Góc toàn bàn giải quyết được phần chồng lấn nhưng đang đánh đổi bằng bánh quá nhỏ. Dùng góc gần hơn hoặc tăng tỷ lệ bánh có kiểm soát để bánh rộng khoảng 12–16% viewport (96–128 px ở khung 800 px); ưu tiên nhìn rõ nến, mặt bánh và đế. Giữ đủ đèn/artwork làm mốc không gian, giảm vùng sàn/tường trống. Đây là kích thước mục tiêu đề xuất, không phải kích thước đã có.
- Dọn giấy thành một cụm thấp, giữ chân bánh tách khỏi giấy. Đặt thẻ kết vào vùng âm của bố cục mới để không che bánh/nến và không trở thành vật thể lớn nhất cảnh.
- Chụp đúng một mốc phong bì đã rời bàn: thấy khoảng hở, bóng tiếp xúc tách ra và hướng mặt bì nhất quán. Cho đỉnh nắp nằm trọn khung ở cảnh mở; tăng tương phản dòng “Gửi Linh” trên bì. Ảnh `3-envelope` hiện tại chưa chứng minh thay đổi floating, dù main đã đổi distance.

**Bằng chứng cần ở vòng 3:** ảnh phong bì giữa đường nâng, ảnh nắp mở đủ biên và ảnh bánh/nến đọc được ngay ở 800 × 450; quay đường chuyển từ thư về bánh để kiểm tính liên tục, không chỉ một góc đẹp ở đích.

### 3. P1 — Hoàn thiện lớp LAMVI: giữ nét tranh, đom đóm có chủ đích, lời chúc riêng

- Giữ artwork gà mới: đã tốt hơn rõ rệt. Điều chỉnh độ sáng/vật liệu để nét tối và màu son còn rõ khi đèn bật, thay vì bị bạc như `2-switch`. Không suy nguồn tạo ảnh từ vẻ ngoài; nhận xét ở đây chỉ về chất lượng nhìn thấy.
- Các chấm sáng nhỏ đã nhìn thấy ở vùng ngoài giấy, đặc biệt phía trái trong `5b-docked` và `5c-body`; ghi nhận lớp hạt đã có dấu hiệu hiện diện. Cần quay để phân biệt chuyển động đom đóm có nhịp với bụi sáng ngẫu nhiên. Giữ mật độ thưa quanh vùng cửa sổ, tránh phủ chữ và vùng nến.
- Thẻ cuối vẫn dùng câu “Tuổi mới, mong mọi điều bạn ấp ủ sẽ tìm được ngày nở hoa.” Thêm chữ ký LAMVI nhỏ và biên tập câu chúc theo từng dịp. Ví dụ sinh nhật: “Thêm một tuổi, thêm một khoảng sáng cho điều bạn thương. — LAMVI”. Làm thẻ đồng chất giấy thư, chừa khoảng thở quanh nội dung; đừng chỉ thay chữ trên một thẻ quá to.

**Bằng chứng cần ở vòng 3:** cận artwork bật sáng, clip hạt sáng, thẻ sinh nhật đã biên tập có ký LAMVI. Chỉ đánh giá các dịp khác khi main cung cấp ảnh thực tế tương ứng.

## Bàn giao

Vòng 2 hoàn tất, **chưa duyệt**. Main sửa rồi cung cấp ảnh mới cho vòng 3. Không review trước vòng 3–5. Tệp này là đầu ra duy nhất của lượt review.
