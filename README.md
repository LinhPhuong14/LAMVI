# MỘC — Web bán đèn giấy dó

React + Vite (frontend), Express (API), Supabase (Postgres + Auth).

- Yêu cầu nghiệp vụ: [`docs/ba-spec.md`](docs/ba-spec.md)
- Knowledge base cho các phiên code: [`docs/knowledge/README.md`](docs/knowledge/README.md)

## Chạy

```bash
npm install
cp .env.example .env   # điền SUPABASE_*; để trống thì API dùng dữ liệu bộ nhớ
npm run dev            # web http://localhost:5173, API http://localhost:8787
npm test
npm run lint
npm run build
```

## Supabase

1. Chạy `supabase/migrations/*.sql` rồi `supabase/seed.sql` (SQL editor hoặc `supabase db push`).
2. Authentication → URL Configuration: thêm `PUBLIC_SITE_URL` + `/login`, `/reset-password`, `/en/reset-password`, `/zh/reset-password` vào Redirect URLs.
3. Sửa `server/data/seed.js` thì chạy `npm run db:seed-sql` để sinh lại `supabase/seed.sql`.
