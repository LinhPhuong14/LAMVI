# Thiết kế lại dashboard: khách hàng và admin (đề xuất, chưa triển khai)

Góc nhìn: senior UI/UX. Mục tiêu của từng màn hình trả lời đúng một câu hỏi "người này mở trang này để làm gì?", rồi xếp mọi thứ theo việc đó. Hiện dashboard theo kiểu "mỗi tab một danh sách", nên khách phải tự tìm việc cần làm và admin không thấy ngay việc nào đang cháy.

Nguyên tắc chung (áp cho cả hai dashboard):

1. **Việc cần làm trước, số liệu sau.** Đầu mỗi trang là thứ cần hành động (đơn chờ xử lý, lời chúc chưa soạn), không phải số tổng.
2. **Một nút chính mỗi màn hình**, đặt cố định một chỗ: góc trên phải của vùng nội dung (desktop), thanh dưới cố định (mobile). Nút phụ là nút viền; nút huỷ/xoá là chữ, đặt xa nút chính.
3. **Danh sách có ba trạng thái rõ**: đang tải (khung xương đúng hình nội dung), rỗng (nói việc tiếp theo và có nút), lỗi (nói nguyên nhân và có nút thử lại).
4. **Chi tiết mở trong ngăn trượt bên phải** (admin) hoặc trang riêng có breadcrumb (khách), không bật modal chồng modal.
5. **Màu trạng thái có nghĩa và dùng một bảng**: chờ (caramel), đang làm (nâu ấm), xong (xanh lá dùng riêng cho trạng thái, đây là ngoại lệ có chủ đích của bảng thương hiệu), lỗi (đỏ gạch). Chip luôn kèm chữ, không chỉ màu.
6. **Thanh điều hướng**: nhóm theo công việc, không theo bảng dữ liệu.

---

## A. Dashboard khách hàng (`/account`)

Người dùng: người mua cho mình hoặc mua tặng, vào để (1) biết đơn đến đâu, (2) soạn hoặc sửa lời chúc, (3) xem video mẻ đèn, (4) hỏi Mây, (5) đổi thông tin. Thường vào bằng điện thoại.

Điều hướng: 5 mục như hiện tại nhưng đổi tên theo việc: **Tổng quan · Đơn hàng · Lời chúc & video · Trò chuyện · Hồ sơ**. Gallery nên nằm trong "Lời chúc & video" vì cùng một câu chuyện (đèn của tôi) thay vì là tab độc lập. Mobile: thanh tab đáy 4 mục (Tổng quan, Đơn hàng, Lời chúc, Hồ sơ); Trò chuyện mở bằng nút Mây nổi như hiện nay.

### A1. Tổng quan
- **Dải việc cần làm** (tối đa 3 thẻ, mỗi thẻ một nút): "Đơn LV… đang được làm, dự kiến xong ngày …" (Xem đơn); "Đơn LV… có lời chúc chưa soạn, còn 2 ngày" (Soạn lời chúc, nút chính, màu đậm); "Có lời chúc sắp hết hạn tải" (Tải về).
- **Đơn gần nhất** dạng thanh tiến độ ngang 5 mốc (đã có ở chi tiết đơn, kéo lên đây).
- Ba số liệu nhỏ ở hàng dưới (giỏ hàng, số đơn, câu đã hỏi Mây): chỉ giữ giỏ hàng và đơn; "câu đã hỏi Mây" không phải việc của khách, bỏ khỏi tổng quan.
- Hình minh hoạ lớn chỉ ở trạng thái rỗng (khách mới), không chiếm đầu trang của người đã có đơn.
- Nút chính: "Tiếp tục xem đèn" chỉ hiện khi chưa có việc nào cần làm.

### A2. Đơn hàng
- Bố cục hai cột trên desktop: trái là danh sách (mã, ngày, tổng, chip trạng thái, ảnh đèn nhỏ), phải là chi tiết đơn đang chọn (tiến độ, sản phẩm, người nhận, thanh toán, lời chúc). Mobile: danh sách, bấm vào mở chi tiết toàn màn hình.
- Bộ lọc là chip ngang: Đang xử lý · Đang giao · Hoàn tất · Đã huỷ. Mặc định "Đang xử lý".
- Nút trong chi tiết: chính = "Soạn lời chúc" (khi còn sửa được) hoặc "Thanh toán" (đơn payOS chờ); phụ = "Yêu cầu đổi trả" (chỉ hiện trong 7 ngày từ giao); chữ = "Huỷ đơn" (cuối trang, có hỏi xác nhận, kèm điều kiện huỷ).
- Bỏ lặp: trang chi tiết đơn riêng (`/don-hang/:code`) và panel trong dashboard đang hiển thị trùng nội dung; giữ một nguồn.

### A3. Lời chúc & video (gộp Gallery)
- Mỗi đơn có lời chúc là một thẻ: người nhận, trạng thái (chưa soạn / đã soạn / người nhận đã mở), hạn sửa, hạn media.
- Hành động trên thẻ: Soạn/Sửa (chính), Xem như người nhận (phụ), Sao chép link QR.
- Dưới cùng: **Video mẻ đèn** của các lô đèn khách đã mua, dạng carousel; nút "Xem video" mở trang lô.
- Gallery mảnh ghép giữ lại như phần thưởng nhỏ ở cuối, không phải điểm vào chính.

### A4. Trò chuyện (Mây)
- Giữ danh sách hội thoại bên trái, nội dung bên phải. Ô nhập cố định đáy. Gợi ý nhanh (chip): "Đơn của tôi đến đâu?", "Chính sách đổi trả", "Gợi ý quà tặng".
- Nút "Xoá lịch sử" là nút chữ ở góc, có xác nhận; không đặt cạnh nút Gửi.

### A5. Hồ sơ
- Hai khối cách nhau rõ: **Thông tin** (họ tên, điện thoại, ngôn ngữ) và **Bảo mật** (đổi mật khẩu, đăng xuất mọi thiết bị).
- Chỉnh sửa tại chỗ từng dòng (bấm "Sửa" ở dòng), lưu bằng nút ở chính khối đó, không một nút Lưu chung ở cuối trang.
- Địa chỉ giao hàng đã dùng: danh sách địa chỉ có đặt mặc định (hiện chưa có; đề xuất, cần BA).

---

## B. Dashboard admin (`/admin`)

Người dùng: chủ shop và nhân viên vận hành. Mở lúc đầu ngày để biết việc, rồi xử lý đơn, lô, đổi trả; thỉnh thoảng sửa danh mục. Thường dùng laptop.

Điều hướng (thanh bên, nhóm theo công việc):
- **Hôm nay**: Tổng quan
- **Bán hàng**: Đơn hàng · Đổi trả · Mã giảm giá
- **Sản phẩm**: Sản phẩm · Bộ sưu tập · Lô & video
- **Nội dung**: Hỏi đáp (FAQ) · Mây
- **Khách hàng**: Người dùng
- **Phân tích**: Analytics
- Cuối: Dashboard IT (chỉ vai IT), Về website.
Huy hiệu số cạnh Đơn hàng (đơn cần xử lý) và Đổi trả (yêu cầu mới).

### B1. Tổng quan (trang mặc định, hiện chưa thật sự là "hôm nay")
- **Hàng 1, cần xử lý ngay**: 3 thẻ lớn có số và nút: Đơn mới chờ xác nhận · Đơn COD sắp giao chưa thu tiền · Yêu cầu đổi trả chưa xử lý. Bấm vào mở đúng danh sách đã lọc.
- **Hàng 2**: doanh thu 7 ngày (một biểu đồ cột, so với 7 ngày trước), số đơn, giá trị đơn trung bình. Một biểu đồ duy nhất, không sparkline trang trí.
- **Hàng 3**: nhật ký hoạt động gần đây (ai đổi gì, 10 dòng) và cảnh báo hệ thống (hết hàng, lô chưa xuất bản video).
- Nút chính: không có (trang này để đọc); lối tắt "Tạo mã giảm giá", "Thêm sản phẩm" ở góc trên phải dạng nút phụ.

### B2. Đơn hàng
- **Thanh lọc trên cùng**: chip trạng thái kèm số lượng (Mới · Đang làm · Đã đóng gói · Đang giao · Hoàn tất · Huỷ), ô tìm theo mã/tên/điện thoại, lọc ngày, lọc COD/payOS.
- **Bảng**: mã đơn, khách, tổng, thanh toán, trạng thái (chip), ngày, hành động nhanh một nút theo trạng thái kế tiếp ("Xác nhận", "Đóng gói", "Gửi đi"). Hàng cần chú ý có vạch caramel bên trái.
- **Ngăn chi tiết bên phải** khi bấm hàng: tiến độ, sản phẩm, người nhận, ghi chú, lịch sử trạng thái, nút chuyển trạng thái (chính), nút "Nhập mã vận đơn" khi SHIPPED, "Đã thu tiền COD", "Huỷ đơn" (chữ, đỏ gạch).
- Chọn nhiều hàng: thanh thao tác nổi ở đáy (Xuất CSV, In phiếu giao, Đánh dấu đóng gói).
- Admin không xem nội dung lời chúc (D-89): hàng chỉ có cờ, giữ đúng.

### B3. Đổi trả
- Bảng theo trạng thái (Mới · Đang xem · Đã xử lý). Ngăn chi tiết có **video khui hàng phát ngay** (trình phát lớn), lý do khách, đơn liên quan.
- Nút: Chấp nhận (chính) · Từ chối (viền, bắt buộc nhập lý do) · Hoàn tiền thủ công. Hiện đếm ngược 90 ngày xoá video (D-109).

### B4. Mã giảm giá
- Bảng: mã, loại, giá trị, lượt dùng/giới hạn, hạn, bật/tắt (công tắc ngay trên hàng). Nút chính "Tạo mã" góc trên phải mở ngăn bên. Mã đã dùng không xoá, chỉ tắt (đã đúng quy tắc, nói rõ ở tooltip).

### B5. Sản phẩm
- Dạng **lưới thẻ có ảnh** (không bảng chữ): ảnh, tên, giá, tồn kho, chip hiển thị/ẩn, bộ sưu tập. Lọc theo bộ sưu tập, trạng thái.
- Ngăn sửa có tab: Thông tin · Ảnh · Câu chuyện (3 ngôn ngữ, đã có) · Tồn kho & giá. Nút "Lưu" dính đáy ngăn, xem trước trang công khai ở nút phụ.
- Nút chính "Thêm sản phẩm".

### B6. Bộ sưu tập
- Kéo thả sắp thứ tự các đèn trong bộ (có số thứ tự và ảnh). Hiện giá bộ so với tổng giá lẻ để thấy mức ưu đãi.

### B7. Lô & video
- Mỗi lô là một thẻ có tiến trình 3 bước: Tạo lô → Tải video → Xuất bản. Bước tiếp theo là nút chính trên thẻ. Chặn xuất bản khi chưa có video (đã đúng) và nói rõ vì sao.
- Tải video lớn qua signed URL kèm thanh tiến độ và nút huỷ.

### B8. Hỏi đáp (FAQ) và Mây
- FAQ: danh sách có thứ tự kéo thả, mỗi mục sửa tại chỗ 3 ngôn ngữ dạng tab nhỏ; nhãn ngôn ngữ cố định, không dùng ba ô dài chồng nhau.
- Mây: tách **Cấu hình** (bật OpenAI, ngân sách, câu thông báo) và **Chi phí & sử dụng** (biểu đồ chi phí theo ngày, số cuộc hội thoại). Nút Lưu dính đáy khi có thay đổi chưa lưu.

### B9. Người dùng
- Bảng: tên, email, vai trò (chip), ngày tham gia, số đơn, trạng thái khoá. Ngăn chi tiết: đơn của người này, đổi vai trò, khoá/mở khoá (xác nhận). Không hiện nội dung lời chúc.

### B10. Analytics
- Mặc định 7 ngày, bộ chọn kỳ ở góc trên phải. Thứ tự: người dùng realtime, kênh vào, trang xem nhiều, phễu (xem sản phẩm → thêm giỏ → thanh toán → đặt). Phễu là biểu đồ chính vì trả lời "mất khách ở đâu".

---

## C. Thứ tự triển khai đề xuất

1. Admin **Tổng quan** thành "Hôm nay" (B1) và **Đơn hàng** với ngăn chi tiết, lọc chip, hành động nhanh (B2). Đây là phần admin dùng nhiều nhất.
2. Khách: **Tổng quan** theo việc cần làm (A1) và gộp **Lời chúc & video** (A3).
3. Đổi trả có trình phát video (B3), Sản phẩm dạng lưới thẻ (B5).
4. Phần còn lại.

Điểm cần BA/PO xác nhận trước khi làm (không tự quyết): có thêm sổ địa chỉ cho khách (A5) không; có tạo chức năng xuất CSV và in phiếu giao (B2) không, vì đây là yêu cầu vận hành mới ngoài phạm vi D-34; vai trò nhân viên có tách quyền (chỉ xem đơn, không đụng giá) không.
