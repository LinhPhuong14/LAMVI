-- Coupon (FR-CPN-001/002, §14, D-71), đơn hàng (FR-CHK-*, FR-ORD-*, §12, §16)
-- và thanh toán (FR-PAY-001/002, §15, D-73).
-- Mọi số tiền là số nguyên VND ĐÃ gồm VAT (D-68, T-09).

-- ---------- Coupon ----------
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  -- Mã khách nhập; luôn lưu chữ HOA để so khớp không phân biệt hoa/thường
  code text not null unique check (code = upper(code) and length(code) between 3 and 32),
  -- D-71 / C-1: ba loại
  type text not null check (type in ('percent', 'amount', 'free_shipping')),
  -- percent: 1..100; amount: số tiền VND; free_shipping: 0
  value integer not null default 0 check (value >= 0),
  -- C-6: trần giảm, chỉ có nghĩa với loại percent
  max_discount integer check (max_discount >= 0),
  -- §14: điều kiện đơn tối thiểu (tính trên tạm tính)
  min_order integer check (min_order >= 0),
  -- C-3: giới hạn vào một số sản phẩm; NULL hoặc rỗng = toàn đơn
  product_ids uuid[],
  -- C-5: tổng lượt dùng và số lần mỗi khách; NULL = không giới hạn
  usage_limit integer check (usage_limit > 0),
  per_user_limit integer default 1 check (per_user_limit > 0),
  used_count integer not null default 0 check (used_count >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  status text not null default 'active' check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_percent_range check (type <> 'percent' or value between 1 and 100),
  constraint coupons_amount_positive check (type <> 'amount' or value > 0),
  constraint coupons_period check (starts_at is null or ends_at is null or starts_at < ends_at)
);

create index coupons_code_idx on public.coupons (code);

-- ---------- Đơn hàng ----------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  -- Mã hiển thị cho khách và để tra đơn
  code text not null unique,
  user_id uuid not null references auth.users (id) on delete restrict,
  -- §16
  status text not null check (status in (
    'pending_payment', 'confirmed', 'in_production', 'packed',
    'shipped', 'delivered', 'delivery_failed', 'cancelled'
  )),
  -- FR-CHK-002 (C-02) và FR-CHK-003 (D-14)
  order_kind text not null check (order_kind in ('gift', 'self')),
  has_message boolean not null default false,
  -- FR-CHK-005 (D-24): ngôn ngữ trang QR, chỉ khi đơn có lời chúc
  qr_lang text check (qr_lang in ('vi', 'en', 'zh')),

  -- FR-CHK-004 / BR-SHP-001, BR-SHP-002: chỉ giao trong Việt Nam
  recipient_is_self boolean not null,
  recipient_name text not null,
  recipient_phone text not null,
  address_line text not null,
  ward text,
  district text,
  province text not null,
  note text,

  -- §15
  payment_method text not null check (payment_method in ('payos', 'cod')),
  payment_status text not null default 'pending' check (payment_status in (
    'pending', 'paid', 'expired', 'cancelled', 'refund_pending', 'refunded'
  )),
  -- D-73 (Q-15): hạn link thanh toán payOS
  payment_expires_at timestamptz,
  payos_order_code bigint unique,
  -- Cờ cho admin xử lý tay: trả tiền sau khi đơn đã huỷ, số tiền lệch (D-41)
  payment_flag text,

  -- BR-PRC-002: bảng giá chốt tại thời điểm tạo đơn, không đổi khi giá sản phẩm đổi
  subtotal integer not null check (subtotal >= 0),
  discount integer not null default 0 check (discount >= 0),
  shipping_fee integer not null default 0 check (shipping_fee >= 0),
  total integer not null check (total >= 0),
  vat_amount integer not null default 0 check (vat_amount >= 0),
  vat_rate numeric(4, 3) not null default 0.1,
  coupon_id uuid references public.coupons (id) on delete set null,
  coupon_code text,

  -- Vận chuyển (§17): admin nhập tay
  tracking_code text,
  cancelled_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- BR-PAY-004: đơn giao người khác không được chọn COD
  constraint orders_cod_self_only check (payment_method <> 'cod' or recipient_is_self),
  -- FR-CHK-005: chỉ đơn có lời chúc mới cần ngôn ngữ trang QR
  constraint orders_qr_lang_only_with_message check (has_message or qr_lang is null),
  -- Đơn COD bỏ qua PENDING_PAYMENT (§16)
  constraint orders_cod_not_pending check (payment_method <> 'cod' or status <> 'pending_payment')
);

create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);
-- Quét đơn payOS quá hạn (BR-PAY-003)
create index orders_payment_expiry_idx on public.orders (payment_expires_at)
  where status = 'pending_payment';

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  -- Sản phẩm có thể bị xoá sau này; đơn vẫn phải đọc được
  product_id uuid references public.products (id) on delete set null,
  slug text not null,
  name jsonb not null,
  unit_price integer not null check (unit_price >= 0),
  quantity integer not null check (quantity between 1 and 10),
  line_total integer not null check (line_total >= 0)
);

create index order_items_order_idx on public.order_items (order_id);

-- C-5, C-8: đếm lượt dùng theo khách; BR-CPN-003 mỗi đơn tối đa 1 coupon
create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  order_id uuid not null unique references public.orders (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index coupon_redemptions_user_idx on public.coupon_redemptions (coupon_id, user_id);

-- NFR-AUD-001: nhật ký đổi trạng thái đơn, coupon, hoàn tiền (ai, khi nào, giá trị cũ/mới)
create table public.audit_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor_id uuid references auth.users (id) on delete set null,
  -- 'system' khi do hệ thống đổi (webhook, hết hạn thanh toán)
  actor_role text not null,
  entity text not null,
  entity_id uuid,
  action text not null,
  old_value jsonb,
  new_value jsonb
);

create index audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);

create trigger coupons_touch before update on public.coupons
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- T-05: chỉ server (service role) truy cập; bật RLS, không policy
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.audit_log enable row level security;

-- C-5: tăng/trả lượt dùng nguyên tử (hai đơn cùng lúc không được vượt usage_limit).
-- Trả về số lượt sau khi tăng, hoặc NULL nếu đã hết lượt.
create or replace function public.claim_coupon(p_coupon_id uuid) returns integer
language plpgsql as $$
declare
  v_used integer;
begin
  update public.coupons
     set used_count = used_count + 1
   where id = p_coupon_id
     and status = 'active'
     and (usage_limit is null or used_count < usage_limit)
  returning used_count into v_used;
  return v_used;
end;
$$;

-- C-8: trả lượt khi huỷ đơn / payOS hết hạn
create or replace function public.release_coupon(p_coupon_id uuid) returns void
language sql as $$
  update public.coupons set used_count = greatest(used_count - 1, 0) where id = p_coupon_id;
$$;
