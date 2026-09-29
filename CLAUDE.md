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

## Triển khai Vercel

Chi tiết và lý do: `docs/knowledge/deploy-vercel.md` (T-33). Quy tắc bắt buộc:

- Web + API chạy bằng **một** Vercel Function `api/index.js` (re-export Express `app` từ `server/index.js`), cấu hình ở `vercel.json`. Không tách thêm function, không đổi `outputDirectory` sang `dist/client` (sẽ bỏ qua SSR).
- `server/index.js` không được `listen` khi có `process.env.VERCEL`. Thêm tệp đọc lúc chạy ngoài `dist/**` → thêm vào `includeFiles`.
- Preview/Production **bắt buộc** có `SUPABASE_*` (không dùng adapter bộ nhớ), `PUBLIC_SITE_URL` là domain thật, `TRUST_PROXY=1`, `MAY_HASH_SALT` riêng. Biến môi trường đặt ở Vercel, không commit `.env`/token; không đặt `DEV_ADMIN_*`/`DEV_IT_*`. Biến mới bắt buộc → cập nhật `.env.example` + `deploy-vercel.md`.
- Giới hạn serverless: body ≤ 4,5 MB (video lô luôn qua signed upload URL, T-12), không ghi file cục bộ, không giữ trạng thái trong bộ nhớ tiến trình.
- Trước khi push: `npm run lint`, `npm test`, `npm run build` xanh. Production = `master`; không `vercel --prod` từ máy khi chưa được yêu cầu.
- Đổi cấu hình deploy phải cập nhật `deploy-vercel.md`, `decisions.md` (T-xx) và `progress.md` trong cùng commit.
