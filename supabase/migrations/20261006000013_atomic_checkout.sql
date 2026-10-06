-- T-59: stock, coupon and order snapshots commit together. Run before deploying code.
begin;

-- NULL = historical reservation unknown; do not invent stock provenance for old orders.
alter table public.order_items add column if not exists stock_reserved integer
  check (stock_reserved is null or stock_reserved between 0 and quantity);
-- Opt-in on the cancellation write: migration can run before code deployment.
-- Older server versions still release manually and must not also activate the trigger.
alter table public.orders add column if not exists atomic_cancellation boolean not null default false;

create or replace function public.create_checkout_order(p_order jsonb, p_items jsonb, p_coupon jsonb default null)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare
  o public.orders%rowtype;
  p public.products%rowtype;
  c public.coupons%rowtype;
  it record;
  line jsonb;
  user_uses integer;
  item_total bigint;
  result jsonb;
begin
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'CART_EMPTY';
  end if;
  o := jsonb_populate_record(null::public.orders, p_order);
  -- One customer cannot simultaneously bypass the per-customer coupon limit.
  perform 1 from auth.users where id = o.user_id for update;
  perform 1 from public.cart_items where user_id = o.user_id order by product_id for update;
  if not exists (select 1 from public.cart_items where user_id = o.user_id) then raise exception 'CART_EMPTY'; end if;
  if (select count(*) from public.cart_items where user_id = o.user_id) <> jsonb_array_length(p_items) or exists (
    select 1 from public.cart_items ci full join jsonb_to_recordset(p_items)
      as supplied(product_id uuid, quantity integer)
      on ci.product_id = supplied.product_id and ci.user_id = o.user_id
    where (ci.user_id = o.user_id or ci.user_id is null)
      and (ci.product_id is null or supplied.product_id is null or ci.quantity <> supplied.quantity)
  ) then raise exception 'CART_HAS_UNAVAILABLE'; end if;

  -- Stable lock order for different carts containing the same products.
  for it in
    select (e->>'product_id')::uuid as pid, sum((e->>'quantity')::integer) as qty
    from jsonb_array_elements(p_items) e group by 1 order by 1
  loop
    select * into p from public.products where id = it.pid for update;
    if not found or p.status <> 'published' then raise exception 'CART_HAS_UNAVAILABLE'; end if;
    if exists (select 1 from jsonb_array_elements(p_items) e
      where (e->>'product_id')::uuid = it.pid and (e->>'unit_price')::integer <> p.price) then
      raise exception 'PRICE_CHANGED';
    end if;
    if p.stock is not null and p.stock < it.qty then raise exception 'OUT_OF_STOCK' using detail = p.slug; end if;
  end loop;

  select sum((e->>'unit_price')::bigint * (e->>'quantity')::integer) into item_total
    from jsonb_array_elements(p_items) e;
  if item_total <> o.subtotal then raise exception 'PRICE_CHANGED'; end if;

  if o.coupon_id is not null then
    select * into c from public.coupons where id = o.coupon_id for update;
    if not found then raise exception 'COUPON_NOT_FOUND'; end if;
    if c.status <> 'active' then raise exception 'COUPON_INACTIVE'; end if;
    if c.starts_at is not null and now() < c.starts_at then raise exception 'COUPON_NOT_STARTED'; end if;
    if c.ends_at is not null and now() >= c.ends_at then raise exception 'COUPON_EXPIRED'; end if;
    if c.usage_limit is not null and c.used_count >= c.usage_limit then raise exception 'COUPON_USED_UP'; end if;
    select count(*) into user_uses from public.coupon_redemptions
      where coupon_id = c.id and user_id = o.user_id;
    if c.per_user_limit is not null and user_uses >= c.per_user_limit then raise exception 'COUPON_USER_LIMIT'; end if;
    if c.min_order is not null and o.subtotal < c.min_order then raise exception 'COUPON_MIN_ORDER'; end if;
    if cardinality(c.product_ids) > 0 and not exists (
      select 1 from jsonb_array_elements(p_items) e where (e->>'product_id')::uuid = any(c.product_ids)
    ) then raise exception 'COUPON_NOT_APPLICABLE'; end if;
    -- Reconfirm if admin changed any pricing/eligibility rule since the quote.
    if p_coupon is null or exists (
      select 1 from unnest(array['id','code','type','value','max_discount','min_order',
        'product_ids','usage_limit','per_user_limit','starts_at','ends_at']) k
      where coalesce(to_jsonb(c)->k, 'null'::jsonb) is distinct from coalesce(p_coupon->k, 'null'::jsonb)
    ) then raise exception 'PRICE_CHANGED'; end if;
    update public.coupons set used_count = used_count + 1 where id = c.id;
  end if;

  insert into public.orders (
    code, user_id, status, order_kind, has_message, qr_lang, recipient_is_self,
    recipient_name, recipient_phone, address_line, ward, district, province,
    province_code, ward_code, note, payment_method, payment_status, payment_expires_at,
    payos_order_code, subtotal, discount, shipping_fee, total, vat_amount, vat_rate,
    coupon_id, coupon_code, qr_token
  ) values (
    o.code, o.user_id, o.status, o.order_kind, o.has_message, o.qr_lang, o.recipient_is_self,
    o.recipient_name, o.recipient_phone, o.address_line, o.ward, o.district, o.province,
    o.province_code, o.ward_code, o.note, o.payment_method, o.payment_status, o.payment_expires_at,
    o.payos_order_code, o.subtotal, o.discount, o.shipping_fee, o.total, o.vat_amount, o.vat_rate,
    o.coupon_id, o.coupon_code, o.qr_token
  ) returning * into o;

  for line in select value from jsonb_array_elements(p_items)
  loop
    select * into p from public.products where id = (line->>'product_id')::uuid;
    insert into public.order_items (order_id, product_id, slug, name, unit_price, quantity, line_total, stock_reserved)
    values (o.id, p.id, p.slug, p.name, p.price, (line->>'quantity')::integer,
      p.price * (line->>'quantity')::integer,
      case when p.stock is null then 0 else (line->>'quantity')::integer end);
    update public.products set stock = stock - (line->>'quantity')::integer
      where id = p.id and stock is not null;
  end loop;
  if c.id is not null then
    insert into public.coupon_redemptions (coupon_id, user_id, order_id) values (c.id, o.user_id, o.id);
  end if;
  delete from public.cart_items where user_id = o.user_id;
  select to_jsonb(o) || jsonb_build_object('order_items', jsonb_agg(to_jsonb(i))) into result
    from public.order_items i where i.order_id = o.id;
  return result;
end;
$$;

-- Cancellation and releasing resources succeed together or roll back together.
-- No separate best-effort release after status was already committed.
create or replace function public.release_cancelled_order() returns trigger
language plpgsql set search_path = public, pg_temp as $$
declare it record;
begin
  if new.atomic_cancellation and new.status = 'cancelled' and old.status <> 'cancelled' then
    for it in
      select product_id, sum(stock_reserved) as qty from public.order_items
      where order_id = new.id and stock_reserved > 0 and product_id is not null
      group by product_id order by product_id
    loop
      update public.products set stock = stock + it.qty
        where id = it.product_id and stock is not null;
    end loop;
    if exists (select 1 from public.order_items where order_id = new.id and stock_reserved is null) then
      raise warning 'Legacy order % has unknown stock reservation; manual reconciliation required', new.code;
    end if;
    -- Only release an actual redemption; repeated status updates cannot decrement twice.
    delete from public.coupon_redemptions where order_id = new.id returning coupon_id into it;
    if found then
      update public.coupons set used_count = greatest(0, used_count - 1) where id = it.coupon_id;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists orders_release_on_cancel on public.orders;
create trigger orders_release_on_cancel after update of status on public.orders
  for each row execute function public.release_cancelled_order();

revoke all on function public.create_checkout_order(jsonb,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.create_checkout_order(jsonb,jsonb,jsonb) to service_role;
revoke all on function public.release_cancelled_order() from public, anon, authenticated;
notify pgrst, 'reload schema';
commit;
