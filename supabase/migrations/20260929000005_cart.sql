-- Giỏ hàng (FR-CART-001, §11, D-59, D-60). Giỏ của người đã đăng nhập lưu server (D-41).
create table public.cart_items (
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete cascade,
  -- D-60: tối đa 10 mỗi dòng
  quantity integer not null check (quantity between 1 and 10),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create trigger cart_items_touch before update on public.cart_items
  for each row execute function public.touch_updated_at();

alter table public.cart_items enable row level security;
