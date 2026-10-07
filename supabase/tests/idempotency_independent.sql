-- Disposable DB only: replay must precede consumed-cart checks and remain owner scoped.
\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('10000000-0000-0000-0000-000000000096','replay@example.invalid'),('10000000-0000-0000-0000-000000000095','other@example.invalid');
insert into products(id,slug,kind,status,price,name,stock) values ('20000000-0000-0000-0000-000000000096','replay-lamp','single','published',1000,'{"vi":"Lamp"}',5);
insert into cart_items(user_id,product_id,quantity) values ('10000000-0000-0000-0000-000000000096','20000000-0000-0000-0000-000000000096',2);
create function pg_temp.idempotent_checkout(u uuid default '10000000-0000-0000-0000-000000000096', fp text default repeat('a',64)) returns jsonb language sql as $$
select create_checkout_order(jsonb_build_object('code','IDEMPENDENT-96','user_id',u,'status','confirmed','order_kind','self','has_message',false,'recipient_is_self',true,'recipient_name','Test','recipient_phone','0912345678','address_line','Test','province','Test','payment_method','cod','payment_status','pending','subtotal',2000,'total',2000,'discount',0,'shipping_fee',0,'vat_amount',0,'vat_rate',0.1,'qr_token',repeat('c',64),'checkout_idempotency_key','40000000-0000-4000-8000-000000000096','checkout_fingerprint',fp),'[{"product_id":"20000000-0000-0000-0000-000000000096","quantity":2,"unit_price":1000}]',null)
$$;
do $$
declare first_order jsonb; replay jsonb;
begin
 first_order:=pg_temp.idempotent_checkout();
 replay:=pg_temp.idempotent_checkout();
 if replay->>'id'<>first_order->>'id' or replay->>'checkout_replayed'<>'true' then raise exception 'replay did not recover original'; end if;
 if (select stock from products where slug='replay-lamp')<>3 then raise exception 'replay reserved twice'; end if;
 if (select count(*) from notification_jobs where order_id=(first_order->>'id')::uuid)<>1 then raise exception 'replay duplicated notification'; end if;
 begin
 perform pg_temp.idempotent_checkout('10000000-0000-0000-0000-000000000096',repeat('b',64));raise exception 'changed payload silently reused';
 exception when raise_exception then if sqlerrm<>'CHECKOUT_KEY_CONFLICT' then raise; end if;end;
 begin
 perform pg_temp.idempotent_checkout('10000000-0000-0000-0000-000000000095');raise exception 'cross owner order replayed';
 exception when raise_exception then if sqlerrm<>'CART_EMPTY' then raise; end if;end;
end $$;
rollback;
\echo Idempotency independent SQL checks passed
