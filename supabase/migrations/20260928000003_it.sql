-- Vai trò IT + dashboard IT (D-51…D-54)

-- D-51: thêm vai trò it (IT có cả quyền admin)
alter table public.profiles drop constraint profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('customer', 'admin', 'it'));

-- D-53: số liệu API gộp theo phút × method × route × status (lưu Supabase)
-- Histogram độ trễ theo mốc ms để ước lượng p50/p95
create table public.api_metrics (
  bucket timestamptz not null,
  method text not null,
  route text not null,
  status integer not null,
  count integer not null default 0,
  total_ms double precision not null default 0,
  max_ms double precision not null default 0,
  le_50 integer not null default 0,
  le_100 integer not null default 0,
  le_250 integer not null default 0,
  le_500 integer not null default 0,
  le_1000 integer not null default 0,
  le_2500 integer not null default 0,
  gt_2500 integer not null default 0,
  primary key (bucket, method, route, status)
);

-- Lỗi 5xx gần đây (không lưu body, token hay dữ liệu cá nhân)
create table public.api_errors (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  method text not null,
  route text not null,
  path text not null,
  status integer not null,
  code text,
  message text
);
create index api_errors_at_idx on public.api_errors (at desc);

-- D-54: cài đặt hệ thống (chế độ bảo trì)
create table public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

-- Cộng dồn nhiều server cùng ghi một phút (atomic)
create or replace function public.record_api_metrics(rows jsonb) returns void
language sql as $$
  insert into public.api_metrics as m
    (bucket, method, route, status, count, total_ms, max_ms, le_50, le_100, le_250, le_500, le_1000, le_2500, gt_2500)
  select (r->>'bucket')::timestamptz, r->>'method', r->>'route', (r->>'status')::int, (r->>'count')::int,
         (r->>'total_ms')::double precision, (r->>'max_ms')::double precision,
         (r->>'le_50')::int, (r->>'le_100')::int, (r->>'le_250')::int, (r->>'le_500')::int,
         (r->>'le_1000')::int, (r->>'le_2500')::int, (r->>'gt_2500')::int
  from jsonb_array_elements(rows) r
  on conflict (bucket, method, route, status) do update set
    count = m.count + excluded.count,
    total_ms = m.total_ms + excluded.total_ms,
    max_ms = greatest(m.max_ms, excluded.max_ms),
    le_50 = m.le_50 + excluded.le_50,
    le_100 = m.le_100 + excluded.le_100,
    le_250 = m.le_250 + excluded.le_250,
    le_500 = m.le_500 + excluded.le_500,
    le_1000 = m.le_1000 + excluded.le_1000,
    le_2500 = m.le_2500 + excluded.le_2500,
    gt_2500 = m.gt_2500 + excluded.gt_2500;
$$;

-- Chỉ server (service role) gọi hàm này
revoke execute on function public.record_api_metrics(jsonb) from public, anon, authenticated;

alter table public.api_metrics enable row level security;
alter table public.api_errors enable row level security;
alter table public.app_settings enable row level security;
