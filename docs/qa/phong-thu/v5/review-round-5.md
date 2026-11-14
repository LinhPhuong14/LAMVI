# Visual review — vòng 5/5, audit cuối

## Phạm vi và kết luận

Đã mở trực tiếp bằng `view_image` toàn bộ **21 PNG** trong `docs/qa/phong-thu/v5/round-5/`: 10 cảnh chính, 4 ảnh trung gian, 5 ảnh compact và 2 ảnh lời chúc theo dịp. Đã đọc `result.json`. Không đọc/sửa code hoặc test, không commit; chỉ tạo báo cáo này.

**Bản tĩnh chính và compact đã khá hơn vòng 4; chưa duyệt trọn yêu cầu chuyển động/continuity.** Không thấy P0 chặn đọc hoặc thao tác trong các ảnh được cung cấp. Còn **P1** về rút giấy sát/cắt khung, chuyển giấy có cảm giác xuyên cảnh, chữ đang hiện còn bị khuyết và bằng chứng motion chưa đủ. Hoàn tất đúng năm vòng review; kết luận này không tự mở thêm vòng thứ sáu.

## Chấm từng ảnh

| Ảnh | Điểm | Nhận xét trực tiếp |
| --- | --- | --- |
| `01-room` | 7/10 | Phòng tối có không khí, công tắc rõ; không khác đáng kể vòng 4. Bì tối nhưng còn nhận ra. |
| `02-lit` | 7/10 | Đèn/tranh gà giữ được sắc thái, tên trên bì rõ hơn các vòng đầu. Mặt giấy và bì vẫn khá phẳng nhưng không thành lỗi cản đọc. |
| `03a-midflight` | 6/10 | Bì đã ở trước mặt, mở nắp và có cùng kích thước/vị trí gần như ảnh ready. Hình này không chứng minh đường nâng giữa chừng, dù trace ghi `approaching`. |
| `03-envelope` | 7/10 | Tên người nhận rõ, toàn nắp/đáy bì nằm trong ảnh, khoảng thở tương đương vòng 4. Trạng thái đích ổn. |
| `03b-extract` | 4/10 | Tờ giấy caro vươn lên sát mép trên, không thấy khoảng thở ở đầu giấy. Nắp bì che phần giữa tờ giấy; cần chứng minh đường đi không xuyên nắp. Quãng rút mới chưa giải quyết hết vấn đề framing trong ảnh thật. |
| `03c-lifting` | 5/10 | Tấm giấy lớn giữa khung đang trong suốt, thấy xuyên rõ đèn, tranh và bàn; cảm giác một lớp giao diện đang dissolve hơn là tờ giấy có khối lượng. Bì đã ở trên bàn nhưng ảnh rời không chứng minh quá trình trả về. |
| `04-writing` | 7/10 | Tiêu đề đang ở gần trái trên, lớn hơn trạng thái dock; có vẻ là mốc chuyển kích thước/vị trí. Không còn là bằng chứng tiêu đề viết ở trung tâm desktop như ảnh vòng 4. Không suy trạng thái từ tên “writing”. |
| `05-docked` | 6/10 | Tiêu đề ở vị trí cuối, body đã bắt đầu; cue ở ngoài giấy. Dòng thứ hai có nhiều phần chữ đứt/khuyết, chưa đạt cảm giác hiện theo nguyên từ trọn vẹn trong từng frame. |
| `06-body` | 7/10 | Phần chữ đã hiện đọc tốt, cue không còn đè đoạn cuối. Nội dung bên dưới mép vùng cuộn là bình thường khi đã có gợi ý tiếp tục đọc. |
| `07-lamvi` | 8/10 | Brand, câu sinh nhật, chỉ số và nút rõ; cue đã ra ngoài giấy, không chồng CTA. |
| `08-lamvi-next` | 8/10 | Câu mới và 2/3 xác nhận việc đổi lời chúc, layout ổn định; không còn cue đè mép nút. |
| `09a-paper-return` | 7/10 | Ảnh đã là bố cục bánh hoàn chỉnh, gần trùng `09-cake`; không thấy tờ giấy đang trở về giữa đường. Chấm trạng thái nhìn được, không coi tên file là bằng chứng chuyển tiếp. |
| `09-cake` | 7/10 | Bánh hai tầng màu kem rõ, nến là điểm chạm, đèn/tranh vẫn đủ mặt. Giấy quanh bì còn nhiều cạnh nhưng đã có cụm và không che bánh. |
| `10-final` | 8/10 | Lời chúc và dòng ký LAMVI đầy đủ, không che bánh. Dải trắng đã ngắn hơn và nằm sát phần giấy dưới bánh, bớt cảm giác một mảnh rời so với vòng 4. |
| `compact-writing` | 8/10 | Có bằng chứng tiêu đề đang viết dở ở giữa, còn đủ biên giấy; không bị UI góc trên che chữ. Ảnh tĩnh chưa xác nhận thứ tự nét. |
| `compact-body` | 6/10 | Tiêu đề dock nhỏ và header gọn hơn rõ rệt. Nhưng dòng đang hiện có chữ khuyết nét, cùng triệu chứng với desktop. Cue đã xuống ngoài giấy. |
| `compact-reader` | 8/10 | Thấy trọn bốn dòng đoạn đầu, tiêu đề đủ nhỏ mà vẫn đọc được; xử lý đúng lỗi compact vòng 4. |
| `compact-quote` | 8/10 | Brand, câu kỷ niệm, 1/3 và nút đổi câu đều trọn trong khung 360 × 203. Không còn phải suy khả năng dùng thẻ từ ảnh CTA cuối. |
| `compact-end` | 8/10 | CTA cuối trọn, cue biến mất, có khoảng trống dưới. Phần thẻ trước đó bị cắt do vị trí cuộn là hợp lý. |
| `quote-anniversary` | 8/10 | Câu kỷ niệm và CTA đúng ngữ cảnh, cue ngoài giấy. Chất giọng LAMVI rõ hơn các vòng đầu. |
| `quote-encouragement` | 8/10 | Câu động viên khác nội dung kỷ niệm/sinh nhật, CTA “Mở khi cần” phù hợp, không có chữ/điều khiển chồng nhau. |

Trung bình 21 ảnh: **7,0/10**. Riêng 10 cảnh chính: **7,2/10**. Không dùng trung bình để ép kết luận pass: frame chuyển tiếp còn yếu trong khi trạng thái đọc cuối khá tốt.

## So với vòng 4

- **Compact: đã xử lý lỗi chính.** `compact-reader` từ một dòng body nhìn trọn sang bốn dòng; `compact-quote` chứng minh thẻ và nút dùng được, `compact-end` chứng minh CTA cuối không bị cắt.
- **Cue: đã xử lý chồng chữ/CTA.** Ở ảnh desktop và compact, cue nằm dưới mép giấy; ở compact-end đã ẩn. Chưa xác nhận delay 550 ms vì trace không ghi thời điểm cue xuất hiện.
- **Cảnh kết: cải thiện.** Thẻ đầy đủ chữ ký LAMVI, dải trắng tiền cảnh đã ngắn và gắn với cụm giấy hơn. Không giữ lại kết luận “mảnh giấy rời lớn” của vòng 4 như một lỗi chưa sửa.
- **Rút giấy: vẫn cần sửa/kiểm.** Ảnh mới cung cấp bằng chứng trực tiếp đầu giấy sát mép trên và giai đoạn giấy trong suốt; không duyệt chỉ dựa trên việc distance đã đổi thành 0,9.
- **Body: trạng thái hoàn tất rõ, trạng thái đang hiện chưa sạch.** Vòng này có frame bắt đúng lúc chữ khuyết; không khẳng định whole-word mask đã giải quyết hoàn toàn bằng thông tin implementation.

## Audit timing và continuity

Trace ghi các thời điểm chụp thực tế theo giây, cùng phase. Những điểm quan trọng:

| Mốc | Giây | Quan sát và giới hạn |
| --- | ---: | --- |
| `03a-midflight` | 43,182 | `approaching`, nhưng hình đã gần giống ready. |
| `03-envelope` | 46,760 | `ready`, cùng hình bì ở trước mặt. |
| `03b-extract` | 48,663 | `extracting`, giấy chạm mép trên. |
| `03c-lifting` | 51,295 | `reading`, lớp giấy còn trong suốt. |
| `04-writing` | 57,022 | Tiêu đề đã lệch về trái trên, body chưa thấy. |
| `05-docked` | 58,694 | Tiêu đề dock, body đã có chữ. |
| `06-body` | 59,688 | Body có thêm nhiều đoạn đọc được. |
| `09a-paper-return` | 64,365 | `surprise`, hình đã giống cảnh bánh. |
| `09-cake` | 69,253 | Cảnh bánh ổn định. |
| `10-final` | 79,227 | `celebrated`, thẻ kết trọn chữ. |

Các timestamp là **thời điểm lấy mẫu**, không phải thời điểm bắt đầu/kết thúc animation. Chênh lệch 1,672 giây giữa ảnh 04–05 không thể gọi là thời lượng dock; tương tự không dùng khoảng 03a–03 để đo đường bay. Trace chưa có sự kiện viết xong, dock bắt đầu/kết thúc và body bắt đầu.

**Gating không bị kẹt theo chuỗi ảnh:** body đã xuất hiện sau mốc tiêu đề. Chưa chứng minh chính xác body chỉ bắt đầu sau frame dock hoàn tất; cả 05 và 06 đều đã có body, trong khi 04 chưa ở trung tâm. Compact có ảnh viết giữa giấy và ảnh body sau dock nhưng không có timeline tương ứng trong JSON.

Video được chỉ tới `page@57cb5066f64f04794d8cb855c247742d.webm` trong thư mục vòng 5. **Chưa xem/decode được video trong lượt audit này**: môi trường không có `ffprobe` và các thư viện giải mã Python đã kiểm tra không có sẵn. Không cài thêm công cụ cho tác vụ review này. Vì vậy không tuyên bố đã kiểm FPS, easing, stroke từng nét, đường kéo liên tục, thời gian đứng hình hoặc chuyển động đom đóm. JSON `errors: []` cũng không chứng minh các tiêu chí thị giác ấy.

## P0/P1 còn lại và quyết định cuối

**P0: không phát hiện trong phạm vi ảnh đã kiểm.** Điều này không tương đương xác nhận mọi tương tác hoặc mọi kích thước màn hình đều đạt.

**P1 — Ưu tiên 1: rút/nâng giấy phải giữ hình khối và biên khung.**

Điều chỉnh đường đi hoặc framing để đầu giấy còn khoảng thở khoảng 16–24 px khi rút, thay vì sát/cắt ở `03b-extract`. Giữ tờ giấy đủ đục trong giai đoạn nâng; nếu cần crossfade từ vật thể sang vùng đọc thì khớp biên và rút ngắn pha xuyên cảnh, tránh cả đèn/tranh hiện rõ qua giấy như `03c-lifting`. Kiểm frame ngay trước/sau lúc giấy vượt miệng bì để loại trừ xuyên nắp. Đây là lỗi hình ảnh quan sát được, không suy nguyên nhân từ tham số local-distance.

**P1 — Ưu tiên 2: body cần hiện thành chữ/từ đọc được trong từng frame.**

`05-docked` và `compact-body` vẫn có mảnh chữ, dù `06-body` và `compact-reader` hoàn tất rất rõ. Chọn hiện nguyên từ/dòng với alpha đồng đều, hoặc fade cả đoạn; tránh vùng cắt đi qua thân glyph và dấu. Kiểm ngay những frame đang hiện, không chỉ ảnh cuối. Giữ bố cục compact mới và vị trí cue đã tốt.

**P1 — Ưu tiên 3: khép bằng chứng cho yêu cầu motion trước khi ký duyệt motion.**

Cần kiểm trực tiếp đoạn quay liên tục quanh viết/dock/body và rút/trả giấy; hoặc cung cấp chuỗi frame đủ dày có timestamp từ chính video. Gắn mốc sự kiện viết xong, dock kết thúc, body bắt đầu để kiểm thứ tự. Hai ảnh `03a-midflight` và `09a-paper-return` hiện không cho thấy trạng thái trung gian thực sự khác đích. Đây là khoảng trống kiểm chứng, không phải khẳng định animation bị giật. Không cần thêm một vòng review theo nghi thức; main có thể xử lý và xác minh các mục này trong bước bàn giao cuối.

**Chốt sau năm vòng:** chấp nhận phần bố cục đọc desktop/compact, artwork đèn, lời chúc của ba dịp đã thấy và thẻ kết ở trạng thái tĩnh; chưa ký duyệt phần rút/nâng giấy và yêu cầu motion đầy đủ. Artwork nhìn thuyết phục hơn bản đầu, nhưng không suy nguồn tạo ảnh hoặc giấy phép từ ảnh. Chưa kết luận cho các dịp chưa chụp, câu thứ ba chưa thấy, reduced-motion hay kích thước màn hình chưa được cung cấp. Không yêu cầu sửa code/test trong vai trò reviewer này.
