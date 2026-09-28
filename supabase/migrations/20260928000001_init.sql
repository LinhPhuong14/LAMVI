-- MỘC — schema nền tảng (T-03). Văn bản đa ngôn ngữ: jsonb {vi, en, zh} (T-06).

create extension if not exists pgcrypto;

-- D-39: Draft / Published / Hidden
create table public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  kind text not null check (kind in ('single', 'set')),
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  -- D-03, T-09: giá chưa VAT, số nguyên VND
  price_excl_vat integer not null check (price_excl_vat >= 0),
  tone text,
  sort_order integer not null default 0,
  name jsonb not null,
  description jsonb,
  badge jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- G-07: FAQ lưu DB để Mây đọc (FR-AI-003)
create table public.faq_entries (
  id uuid primary key default gen_random_uuid(),
  sort_order integer not null default 0,
  is_published boolean not null default true,
  question jsonb not null,
  answer jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- D-01, D-10, D-43: video theo lô, QR đèn là mã chung của lô
create table public.batches (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'created' check (status in ('created', 'video_published')),
  video_url text,
  produced_on date,
  title jsonb,
  story jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint batches_video_required check (status <> 'video_published' or coalesce(video_url, '') <> '')
);

-- Hồ sơ 1-1 với auth.users; D-38: một vai trò admin duy nhất
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  phone text,
  preferred_locale text not null default 'vi' check (preferred_locale in ('vi', 'en', 'zh')),
  role text not null default 'customer' check (role in ('customer', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_touch before update on public.products
  for each row execute function public.touch_updated_at();
create trigger faq_entries_touch before update on public.faq_entries
  for each row execute function public.touch_updated_at();
create trigger batches_touch before update on public.batches
  for each row execute function public.touch_updated_at();
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- T-05: frontend không gọi Supabase trực tiếp; server dùng service role (bỏ qua RLS).
-- Bật RLS và không tạo policy nào → khóa truy cập bằng anon key.
alter table public.products enable row level security;
alter table public.faq_entries enable row level security;
alter table public.batches enable row level security;
alter table public.profiles enable row level security;
