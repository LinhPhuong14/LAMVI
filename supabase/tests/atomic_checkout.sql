-- Run only in a disposable database after all migrations, not on production.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000001','checkout-test@example.invalid');
insert into public.products(id,slug,kind,status,price,name,stock) values
  ('20000000-0000-0000-0000-000000000001','tracked','single','published',1000,'{"vi":"Tracked"}',5),
  ('20000000-0000-0000-0000-000000000002','untracked','single','published',1000,'{"vi":"Untracked"}',null);
insert into public.coupons(id,code,type,value,per_user_limit,usage_limit) values
  ('30000000-0000-0000-0000-000000000001','ATOMIC','amount',100,1,10);

-- Local helper constructs trusted server payloads and a matching cart.
create function pg_temp.checkout_payload(code text, ids uuid[], q integer, coupon boolean default false)
returns jsonb language plpgsql as $$
declare items jsonb; cp jsonb; n integer;
begin
  n := cardinality(ids) * q * 1000;
  insert into public.cart_items(user_id,product_id,quantity)
    select '10000000-0000-0000-0000-000000000001', id, q from unnest(ids) id
    on conflict(user_id,product_id) do update set quantity=excluded.quantity;
  select jsonb_agg(jsonb_build_object('product_id',id,'quantity',q,'unit_price',1000)) into items from unnest(ids) id;
  if coupon then select to_jsonb(c) into cp from public.coupons c where c.code='ATOMIC'; end if;
  return public.create_checkout_order(jsonb_build_object(
    'code',code,'user_id','10000000-0000-0000-0000-000000000001',
    'status','confirmed','order_kind','self','has_message',false,'qr_lang',null,
    'recipient_is_self',true,'recipient_name','Test','recipient_phone','0912345678',
    'address_line','Test','province','Test','payment_method','cod','payment_status','pending',
    'subtotal',n,'discount',case when coupon then 100 else 0 end,'shipping_fee',0,
    'total',n-case when coupon then 100 else 0 end,'vat_amount',0,'vat_rate',0.1,
    'coupon_id',case when coupon then '30000000-0000-0000-0000-000000000001' else null end,
    'coupon_code',case when coupon then 'ATOMIC' else null end,'qr_token',encode(gen_random_bytes(32),'hex')
  ),items,cp);
end;
$$;

create function pg_temp.fail_item() returns trigger language plpgsql as $$
begin raise exception 'TEST_ITEM_FAILURE'; end;
$$;

do $$
declare o jsonb;
begin
  o := pg_temp.checkout_payload('ATOMIC-1',array['20000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000002']::uuid[],2,true);
  if (select stock from products where slug='tracked') <> 3 then raise exception 'stock not reserved'; end if;
  if (select used_count from coupons where code='ATOMIC') <> 1 then raise exception 'coupon not reserved'; end if;
  if exists(select 1 from cart_items) then raise exception 'cart not consumed'; end if;
  if (select stock_reserved from order_items where product_id='20000000-0000-0000-0000-000000000002' and order_id=(o->>'id')::uuid) <> 0 then
    raise exception 'untracked item reservation invented'; end if;
  -- Product becomes tracked after checkout; cancelling must not add unreserved units.
  update products set stock=5 where slug='untracked';
  update orders set status='cancelled', atomic_cancellation=true where id=(o->>'id')::uuid;
  if exists(select 1 from products where stock <> 5) then raise exception 'cancel stock mismatch'; end if;
  if (select used_count from coupons where code='ATOMIC') <> 0 then raise exception 'coupon not released'; end if;
  update orders set status='cancelled', atomic_cancellation=true where id=(o->>'id')::uuid;
  if exists(select 1 from products where stock <> 5) then raise exception 'duplicate release'; end if;

  -- Invalid item insert must roll back order, coupon, stock AND cart cleanup.
  begin
    perform pg_temp.checkout_payload('ROLLBACK',array['20000000-0000-0000-0000-000000000001']::uuid[],11,true);
    raise exception 'invalid item unexpectedly committed';
  exception when check_violation then null;
    when raise_exception then if sqlerrm <> 'OUT_OF_STOCK' then raise; end if;
  end;
  if exists(select 1 from orders where code='ROLLBACK') or (select used_count from coupons where code='ATOMIC') <> 0
    or (select stock from products where slug='tracked') <> 5 then raise exception 'failed create leaked resources'; end if;

  -- Force an item-write error after the order and coupon writes.
  update products set stock=20 where slug='tracked';
  insert into cart_items(user_id,product_id,quantity) values
    ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',2);
  create trigger test_item_fail before insert on order_items for each row execute function pg_temp.fail_item();
  begin
    perform pg_temp.checkout_payload('LATE-FAIL',array['20000000-0000-0000-0000-000000000001']::uuid[],2,true);
    raise exception 'item failure unexpectedly committed';
  exception when raise_exception then if sqlerrm <> 'TEST_ITEM_FAILURE' then raise; end if;
  end;
  drop trigger test_item_fail on order_items;
  if exists(select 1 from orders where code='LATE-FAIL') or (select used_count from coupons where code='ATOMIC') <> 0
    or (select stock from products where slug='tracked') <> 20
    or (select quantity from cart_items where product_id='20000000-0000-0000-0000-000000000001') <> 2 then
    raise exception 'late failure leaked resources'; end if;

  o := pg_temp.checkout_payload('CANCEL-FAIL',array['20000000-0000-0000-0000-000000000001']::uuid[],2,true);
  -- Emulate an inventory write failure during the cancellation trigger.
  alter table products add constraint test_release_fails check (stock < 20);
  begin
    update orders set status='cancelled', atomic_cancellation=true where id=(o->>'id')::uuid;
    raise exception 'failed release unexpectedly committed';
  exception when check_violation then null;
  end;
  if (select status from orders where id=(o->>'id')::uuid) <> 'confirmed'
    or (select stock from products where slug='tracked') <> 18
    or (select atomic_cancellation from orders where id=(o->>'id')::uuid)
    or (select used_count from coupons where code='ATOMIC') <> 1 then raise exception 'cancel not atomic'; end if;
  alter table products drop constraint test_release_fails;
  update orders set status='cancelled', atomic_cancellation=true where id=(o->>'id')::uuid;
  if (select stock from products where slug='tracked') <> 20 then raise exception 'cancel retry failed'; end if;

  -- Migration-before-deploy compatibility: old code does not opt into trigger release.
  o := pg_temp.checkout_payload('OLD-CODE',array['20000000-0000-0000-0000-000000000001']::uuid[],2,true);
  update orders set status='cancelled' where id=(o->>'id')::uuid;
  if (select stock from products where slug='tracked') <> 18
    or (select used_count from coupons where code='ATOMIC') <> 1 then raise exception 'old code double release'; end if;
  perform public.release_stock('[{"product_id":"20000000-0000-0000-0000-000000000001","quantity":2}]');
  perform public.release_coupon('30000000-0000-0000-0000-000000000001');
  delete from coupon_redemptions where order_id=(o->>'id')::uuid;
  if (select stock from products where slug='tracked') <> 20 then raise exception 'old release incompatible'; end if;

  -- Historical unknown reservation is not inferred from the current stock.
  o := pg_temp.checkout_payload('LEGACY',array['20000000-0000-0000-0000-000000000001']::uuid[],2,true);
  update order_items set stock_reserved=null where order_id=(o->>'id')::uuid;
  update orders set status='cancelled', atomic_cancellation=true where id=(o->>'id')::uuid;
  if (select stock from products where slug='tracked') <> 18 then raise exception 'legacy stock invented'; end if;
  if (select used_count from coupons where code='ATOMIC') <> 0 then raise exception 'legacy coupon not released'; end if;

  if has_function_privilege('anon','public.create_checkout_order(jsonb,jsonb,jsonb)','execute')
    or has_function_privilege('authenticated','public.create_checkout_order(jsonb,jsonb,jsonb)','execute')
    or not has_function_privilege('service_role','public.create_checkout_order(jsonb,jsonb,jsonb)','execute') then
    raise exception 'incorrect RPC permissions'; end if;
end;
$$;
rollback;
\echo Atomic checkout SQL checks passed
