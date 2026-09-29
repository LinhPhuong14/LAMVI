# Knowledge base — MỘC

Bộ tài liệu này giữ cho mọi phiên code (người hoặc AI) làm việc thống nhất. Đọc theo thứ tự dưới đây trước khi bắt đầu.

| File | Nội dung | Khi nào cập nhật |
|---|---|---|
| [`../ba-spec.md`](../ba-spec.md) | **Nguồn yêu cầu nghiệp vụ duy nhất** (FR, BR, US/AC). Quyết định nghiệp vụ `D-xx` ở Phụ lục A | Sau mỗi tính năng (xem quy trình bên dưới) |
| [`decisions.md`](decisions.md) | Quyết định **kỹ thuật** `T-xx` (stack, kiến trúc, quy ước) | Khi chọn/đổi công nghệ hoặc cách làm |
| [`architecture.md`](architecture.md) | Cấu trúc thư mục, luồng dữ liệu, adapter, schema, API | Khi thêm module/bảng/endpoint |
| [`design-rules.md`](design-rules.md) | Design rules: màu, chữ, nét/khung, hoạ tiết, ảnh (nguồn, giấy phép), motion, hiệu năng | Khi đổi token, thêm component giao diện hoặc ảnh |
| [`conventions.md`](conventions.md) | Quy ước code, i18n, API, test, commit | Khi thống nhất quy ước mới |
| [`deploy-vercel.md`](deploy-vercel.md) | Cách chạy trên Vercel, biến môi trường, quy tắc deploy (T-33) | Khi đổi cấu hình deploy |
| [`glossary.md`](glossary.md) | Thuật ngữ nghiệp vụ ↔ tên trong code | Khi xuất hiện khái niệm mới |
| [`progress.md`](progress.md) | Bảng trạng thái tính năng theo FR, file, test | Cuối mỗi tính năng |
| [`session-log.md`](session-log.md) | Nhật ký từng phiên: làm gì, quyết gì, còn gì | Cuối mỗi phiên |

Quyết định nghiệp vụ (`D-xx`) **chỉ** ghi ở Phụ lục A của `ba-spec.md`; quyết định kỹ thuật (`T-xx`) **chỉ** ghi ở `decisions.md`. Không ghi trùng ở hai nơi — chỉ tham chiếu mã.

---

## Quy trình mỗi phiên

### Đầu phiên

1. Đọc `CLAUDE.md`, file này, `progress.md` và mục mới nhất của `session-log.md`.
2. Đọc các mục `ba-spec.md` liên quan (FR, BR, US/AC, edge case §27).
3. Liệt kê các điểm `[BA DECISION REQUIRED]` / `[LEGAL]` chạm tới phần sắp làm → **hỏi người dùng**, không tự quyết.
4. Tạo nhánh `feat/…`, `fix/…` hoặc `docs/…` (không dùng `claude/…`).

### Mỗi tính năng

1. Code theo spec (code khác spec → sửa code, không sửa spec).
2. Tự viết test cho AC chính; chạy `npm test` và `npm run lint`.
3. **Tạo subagent kiểm thử độc lập**: subagent đọc spec + code, viết thêm test cho AC/edge case còn thiếu, chạy, báo lỗi. Sửa đến khi xanh.
4. Cập nhật `progress.md` (trạng thái, test), `architecture.md` nếu có endpoint/bảng mới.
5. Commit riêng cho tính năng.

### Cuối phiên (cùng nhánh/PR)

1. `ba-spec.md`: mục 31.2/31.3 (đánh dấu đã xử lý, thêm khoảng trống mới), quyết định mới → Phụ lục A (`D-xx` tiếp theo) + gỡ nhãn + gỡ câu hỏi ở §30, giả định mới → `[ASSUMPTION]`, tăng phiên bản + ngày.
2. `decisions.md`: quyết định kỹ thuật mới.
3. `session-log.md`: thêm mục phiên.
4. Push nhánh.

## Lệnh thường dùng

```bash
npm install
npm run dev          # Express: web SSR + API, cổng 5173 (T-15)
npm run dev:api      # chỉ API
npm test             # Vitest: test server + frontend
npm run lint         # oxlint
npm run build        # client + SSR
npm start            # chạy bản build
# Vercel: xem deploy-vercel.md (api/index.js + vercel.json, T-33)
```

Biến môi trường: xem [`../../.env.example`](../../.env.example). Không có biến Supabase → server chạy adapter bộ nhớ với dữ liệu seed (T-04).
