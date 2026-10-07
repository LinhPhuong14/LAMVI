-- Disposable PostgreSQL only: no production user/order writes. Fixtures rollback.
begin;
insert into auth.users(id,email) values
 ('18000000-0000-0000-0000-000000000001','idempotency-one@example.invalid'),
 ('18000000-0000-0000-0000-000000000002','idempotency-two@example.invalid');
insert into products(id,slug,kind,status,price,name,stock) values
 ('18000000-0000-0000-0000-000000000003','idempotency-lamp','single','published',1000,'{"vi":"Lamp"}',5);
insert into cart_items(user_id,product_id,quantity)
 select id,'18000000-0000-0000-0000-000000000003',1 from auth.users where id in
 ('18000000-0000-0000-0000-000000000001','18000000-0000-0000-0000-000000000002');
do $$
declare payload jsonb; items jsonb; first_order jsonb; replay jsonb; second_order jsonb;
begin
 payload := jsonb_build_object(
  'code','IDEMPOTENT-1','user_id','18000000-0000-0000-0000-000000000001',
  'status','confirmed','order_kind','self','has_message',false,'recipient_is_self',true,
  'recipient_name','Test','recipient_phone','0912345678','address_line','Test','province','Test',
  'payment_method','cod','payment_status','pending','subtotal',1000,'discount',0,'shipping_fee',0,'total',1000,'vat_amount',0,'vat_rate',0.1,
  'checkout_idempotency_key','18000000-0000-4000-8000-000000000018','checkout_fingerprint',repeat('a',64),'qr_token',repeat('a',64));
 items := '[{"product_id":"18000000-0000-0000-0000-000000000003","quantity":1,"unit_price":1000}]'::jsonb;
 first_order := create_checkout_order(payload,items,null);
 replay := create_checkout_order(payload,null,null);
 if replay->>'id' <> first_order->>'id' or replay->>'checkout_replayed' <> 'true' then raise exception 'empty-cart replay failed'; end if;
 if (select stock from products where slug='idempotency-lamp') <> 4 then raise exception 'replay deducted inventory'; end if;
 if (select count(*) from notification_jobs where order_id=(first_order->>'id')::uuid) <> 1 then raise exception 'replay duplicated notification'; end if;
 begin
  perform create_checkout_order(payload || '{"checkout_fingerprint":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}',null,null);
  raise exception 'changed payload unexpectedly accepted';
 exception when raise_exception then if sqlerrm <> 'CHECKOUT_KEY_CONFLICT' then raise; end if;
 end;
 second_order := create_checkout_order(payload || '{"code":"IDEMPOTENT-2","user_id":"18000000-0000-0000-0000-000000000002","qr_token":"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"}',items,null);
 if second_order->>'id' = first_order->>'id' then raise exception 'key leaked across users'; end if;
 if (select stock from products where slug='idempotency-lamp') <> 3 then raise exception 'second user checkout missing'; end if;
 begin
  update orders set checkout_fingerprint=null where id=(first_order->>'id')::uuid;
  raise exception 'null fingerprint accepted';
 exception when check_violation then null;
 end;
 if has_function_privilege('anon','public.create_checkout_order(jsonb,jsonb,jsonb)','execute') or
    has_function_privilege('authenticated','public.create_checkout_order(jsonb,jsonb,jsonb)','execute') then raise exception 'public checkout RPC access'; end if;
end;
$$;
rollback;
