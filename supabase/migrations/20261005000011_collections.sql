-- Bộ sưu tập đèn (D-96): một bộ có nhiều đèn lẻ, khách mua cả bộ hoặc từng đèn.
-- Gallery + chăn Đông Hồ (D-97) đọc cấu trúc này để biết khách sở hữu đủ bộ hay chưa.
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  tone text,
  sort_order integer not null default 0,
  name jsonb not null,
  description jsonb,
  -- Phần thưởng cốt truyện: mở khi khách sở hữu đủ đèn của bộ (chỉ server trả ra khi đủ điều kiện)
  story_title jsonb,
  story jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collections enable row level security;

-- Đèn thuộc bộ nào (NULL = đèn lẻ không thuộc bộ). Bộ "set" cũng gắn cùng collection_slug.
alter table public.products add column if not exists collection_slug text;
alter table public.products add column if not exists piece_order integer not null default 0;
create index if not exists products_collection_idx on public.products (collection_slug);
