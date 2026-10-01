-- Checkout, đơn hàng, coupon, thanh toán (FR-CHK-*, FR-ORD-*, FR-PAY-*, FR-CPN-*; D-62…D-72).
-- Cấu hình phí ship / mức COD lưu ở app_settings (key 'shop').

-- §14, D-65…D-68
create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' and length(code) <= 30),
  status text not null default 'active' check (status in ('active', 'inactive')),
  type text not null check (type in ('percent', 'amount', 'free_shipping')),
  value integer not null default 0 check (value >= 0),
  max_discount integer check (max_discount > 0),
  min_order integer check (min_order >= 0),
  starts_at timestamptz,
  ends_at timestamptz,
  usage_limit integer check (usage_limit > 0),
  per_user_limit integer check (per_user_limit > 0),
  -- null = toàn đơn; có giá trị = chỉ các sản phẩm này (D-67)
  product_ids uuid[],
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Mã đơn dạng số (payOS yêu cầu orderCode là số)
create sequence public.order_code_seq start 100001;

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code bigint not null unique default nextval('public.order_code_seq'),
  -- Không xoá dây chuyền: đơn là chứng từ, phải giữ khi xoá tài khoản [ASSUMPTION]
  user_id uuid not null references auth.users (id),
  -- chống tạo trùng khi bấm hai lần
  client_key text not null,
  status text not null check (status in ('PENDING_PAYMENT', 'CONFIRMED', 'IN_PRODUCTION', 'PACKED', 'SHIPPED', 'DELIVERED', 'DELIVERY_FAILED', 'CANCELLED')),
  production_stage smallint check (production_stage between 1 and 4),
  order_type text not null check (order_type in ('gift', 'self')),
  has_message boolean not null default false,
  qr_lang text check (qr_lang in ('vi', 'en', 'zh')),
  recipient_type text not null check (recipient_type in ('self', 'other')),
  recipient jsonb not null,
  payment_method text not null check (payment_method in ('payos', 'cod')),
  payment_status text not null,
  coupon_id uuid references public.coupons (id),
  coupon_code text,
  subtotal integer not null,
  discount integer not null default 0,
  shipping_fee integer not null default 0,
  vat integer not null,
  total integer not null,
  payment_expires_at timestamptz,
  payment_link_id text,
  checkout_url text,
  paid_at timestamptz,
  paid_amount integer,
  payment_ref text,
  -- Cờ cho admin: PAID_AFTER_CANCEL, AMOUNT_MISMATCH
  flags text[] not null default '{}',
  tracking_code text,
  cancelled_at timestamptz,
  cancel_reason text,
  cod_collected_at timestamptz,
  refunded_at timestamptz,
  refunded_amount integer,
  refund_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_key)
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status, created_at desc);
create index orders_coupon_idx on public.orders (coupon_id) where coupon_id is not null;

-- BR-PRC-002: giá chốt lúc tạo đơn
create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  product_id uuid references public.products (id) on delete set null,
  product_slug text not null,
  product_name jsonb not null,
  unit_price integer not null,
  quantity integer not null check (quantity between 1 and 10),
  line_total integer not null,
  -- §21.6: lô gán cho dòng hàng (BR-ORD-002)
  batch_id uuid references public.batches (id)
);
create index order_items_order_idx on public.order_items (order_id);

-- BR-PAY-002: webhook trùng mã giao dịch chỉ xử lý một lần
create table public.payment_events (
  id bigint generated always as identity primary key,
  provider text not null,
  reference text not null,
  order_code bigint,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (provider, reference)
);

-- NFR-AUD-001: ai, khi nào, giá trị cũ/mới (đơn, coupon, hoàn tiền, cấu hình phí)
create table public.audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor_id uuid,
  actor_role text not null,
  entity text not null,
  entity_id text not null,
  action text not null,
  old_value jsonb,
  new_value jsonb
);
create index audit_log_entity_idx on public.audit_log (entity, entity_id, at desc);

create trigger coupons_touch before update on public.coupons
  for each row execute function public.touch_updated_at();
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

-- Tạo đơn nguyên tử: khoá coupon, đếm lượt đã dùng (đơn chưa huỷ — D-68), chèn đơn + dòng hàng.
-- p_order / p_items: cột snake_case. Lỗi nghiệp vụ trả qua message (COUPON_INVALID / COUPON_USED_UP / COUPON_USER_LIMIT).
create or replace function public.create_order(p_order jsonb, p_items jsonb) returns uuid
language plpgsql as $$
declare
  v_coupon public.coupons;
  v_used integer;
  v_id uuid := gen_random_uuid();
begin
  if p_order->>'coupon_id' is not null then
    select * into v_coupon from public.coupons where id = (p_order->>'coupon_id')::uuid for update;
    -- Kiểm tra lại lúc ghi (admin có thể vừa tắt/đổi hạn coupon — BR-CPN-002)
    if not found or v_coupon.status <> 'active'
       or (v_coupon.starts_at is not null and now() < v_coupon.starts_at)
       or (v_coupon.ends_at is not null and now() >= v_coupon.ends_at) then
      raise exception 'COUPON_INVALID';
    end if;
    if v_coupon.usage_limit is not null then
      select count(*) into v_used from public.orders where coupon_id = v_coupon.id and status <> 'CANCELLED';
      if v_used >= v_coupon.usage_limit then
        raise exception 'COUPON_USED_UP';
      end if;
    end if;
    if v_coupon.per_user_limit is not null then
      select count(*) into v_used from public.orders
        where coupon_id = v_coupon.id and status <> 'CANCELLED' and user_id = (p_order->>'user_id')::uuid;
      if v_used >= v_coupon.per_user_limit then
        raise exception 'COUPON_USER_LIMIT';
      end if;
    end if;
  end if;

  insert into public.orders
    select * from jsonb_populate_record(null::public.orders, p_order || jsonb_build_object(
      'id', v_id,
      'code', nextval('public.order_code_seq'),
      'flags', coalesce(p_order->'flags', '[]'::jsonb),
      'created_at', now(),
      'updated_at', now()
    ));

  insert into public.order_items
    select * from jsonb_populate_recordset(null::public.order_items, (
      select jsonb_agg(x || jsonb_build_object('id', gen_random_uuid(), 'order_id', v_id))
      from jsonb_array_elements(p_items) x
    ));

  return v_id;
end;
$$;

revoke execute on function public.create_order(jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.create_order(jsonb, jsonb) to service_role;

-- Chỉ server (service role) truy cập; không có policy cho anon/authenticated
alter table public.coupons enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.payment_events enable row level security;
alter table public.audit_log enable row level security;
