# Quy ước dự án

## Đặt tên nhánh git

Chỉ dùng các tiền tố sau khi tạo nhánh mới:

- `feat/...` — tính năng mới
- `fix/...` — sửa lỗi
- `docs/...` — tài liệu

Không dùng tiền tố `claude/...`.

## Knowledge base

Đầu mỗi phiên đọc `docs/knowledge/README.md` (quy trình phiên, quyết định kỹ thuật `T-xx`, kiến trúc, quy ước, tiến độ, nhật ký). Mỗi tính năng phải có subagent kiểm thử độc lập trước khi commit (T-11). Cuối phiên cập nhật `progress.md` và `session-log.md`.

## Đặc tả nghiệp vụ (BA)

Nguồn yêu cầu nghiệp vụ duy nhất: `docs/ba-spec.md`.

**Trước khi code:**

- Đọc các mục của `docs/ba-spec.md` liên quan tới phần sắp làm (FR, BR, US/AC, edge case).
- Không tự quyết định những điểm đang gắn `[BA DECISION REQUIRED]` hoặc `[LEGAL]` — hỏi lại người dùng.
- Nếu code hiện tại khác spec, làm theo spec; không sửa spec cho khớp với code.

**Sau khi code xong** (trong cùng nhánh/PR), cập nhật lại `docs/ba-spec.md`:

- Mục 31.2 (khoảng trống so với code) và 31.3 (nội dung web phải sửa): đánh dấu mục đã xử lý, thêm khoảng trống mới phát hiện.
- Quyết định mới từ người dùng: thêm vào Phụ lục A (mã `D-xx` tiếp theo), gỡ nhãn `[BA DECISION REQUIRED]` tương ứng và câu hỏi ở mục 30.
- Giả định phát sinh trong lúc code: ghi vào spec với nhãn `[ASSUMPTION]`.
- Tăng phiên bản ở đầu tài liệu (ví dụ v0.1 → v0.2) và cập nhật ngày.
