-- D-134, D-135: phong thư riêng của từng đơn — admin soạn toàn bộ, xuất bản thì sinh subdomain
-- ngẫu nhiên (slug) + token bí mật cho QR. Chỉ server (service role) đọc/ghi. Chạy lại an toàn.
create table if not exists public.order_letters (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Nội dung đã được server kiểm (server/domain/letter.js): tên, dịp, đoạn thư, video, tái bút, bất ngờ
  content jsonb,
  -- Subdomain ngẫu nhiên, không phải bí mật (lộ qua DNS/SNI)
  slug text constraint order_letters_slug_key unique check (slug is null or slug ~ '^[a-z][a-z0-9]{9}$'),
  -- Bí mật trong QR (sau dấu #). Lưu thô như orders.qr_token để admin in lại QR; đổi bằng "tạo QR mới".
  token text check (token is null or token ~ '^[A-Za-z0-9_-]{43}$'),
  published_at timestamptz,
  opened_at timestamptz,
  updated_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_letters_published_ready check (status <> 'published' or (content is not null and slug is not null and token is not null))
);

drop trigger if exists order_letters_touch on public.order_letters;
create trigger order_letters_touch before update on public.order_letters
  for each row execute function public.touch_updated_at();

alter table public.order_letters enable row level security;
-- T-51: chỉ server (service role) truy cập, khoá anon/authenticated tường minh
revoke all on public.order_letters from anon, authenticated;

notify pgrst, 'reload schema';
