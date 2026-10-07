# LAMVI — Web bán đèn giấy dó

React + Vite (frontend), Express (API), Supabase (Postgres + Auth).

- Yêu cầu nghiệp vụ: [`docs/ba-spec.md`](docs/ba-spec.md)
- Knowledge base cho các phiên code: [`docs/knowledge/README.md`](docs/knowledge/README.md)

## Chạy

```bash
npm install
cp .env.example .env   # điền SUPABASE_*; development có thể để trống để dùng dữ liệu bộ nhớ
npm run dev            # web (SSR) + API tại http://localhost:5173
npm test
npm run lint
npm run build          # dist/client + dist/server (SSR)
npm start              # chạy bản build với production bindings đầy đủ
```

Triển khai cần một server Node (SSR — D-49). Đặt `PUBLIC_SITE_URL` là tên miền thật (dùng cho canonical, hreflang, sitemap).

## Supabase

1. Project mới: áp dụng migrations theo thứ tự, seed chỉ khi cần dữ liệu mẫu. Project đang có dữ liệu: kiểm lịch sử migration và chỉ áp dụng bản còn thiếu theo [runbook](docs/production-release-1m.md), không chạy lại toàn bộ/seed lên production. Migration dùng SQL thuần; các test có lệnh psql như `\set` phải chạy bằng runner disposable, không dán vào Supabase SQL Editor.
2. Authentication → URL Configuration: thêm `PUBLIC_SITE_URL` + `/login`, `/reset-password`, `/en/reset-password`, `/zh/reset-password` vào Redirect URLs.
3. Sửa `server/data/seed.js` thì chạy `npm run db:seed-sql` để sinh lại `supabase/seed.sql`.

Kiểm bản build bằng dữ liệu bộ nhớ local phải bật rõ ngoại lệ loopback:

```bash
ALLOW_LOCAL_MEMORY=1 PUBLIC_SITE_URL=http://127.0.0.1:5345 PORT=5345 npm start
```

Ngoại lệ này không dùng được trên Vercel. Production cần Supabase, HTTPS, salt riêng và rate limit; xem [runbook phát hành](docs/production-release-1m.md) và [QA/QC](docs/qa-qc-2026-10-07-round2.md).
