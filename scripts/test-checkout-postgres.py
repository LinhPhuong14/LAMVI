#!/usr/bin/env python3
"""Run migrations and checkout regressions in a disposable PostgreSQL container."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import subprocess
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]
NAME = f"lamvi-checkout-test-{uuid.uuid4().hex[:8]}"
IMAGE = "postgres:17@sha256:d74eeac9a635390a49bc21bd49fccd973de707e2a53a76ac49b552b8712ec46f"


def sql(source, check=True):
    result = subprocess.run(
        ["docker", "exec", "-i", NAME, "psql", "-U", "postgres", "-qAt", "-v", "ON_ERROR_STOP=1"],
        input=source, text=True, capture_output=True,
    )
    if check and result.returncode:
        raise RuntimeError(result.stderr)
    return result


def reset(stock=1, coupon_limit=10):
    sql(f"""
      truncate orders, cart_items, coupons, products, auth.users cascade;
      insert into auth.users(id,email) values
        ('10000000-0000-0000-0000-000000000001','one@example.invalid'),
        ('10000000-0000-0000-0000-000000000002','two@example.invalid');
      insert into products(id,slug,kind,status,price,name,stock) values
        ('20000000-0000-0000-0000-000000000001','one','single','published',1000,'{{"vi":"One"}}',{stock}),
        ('20000000-0000-0000-0000-000000000002','two','single','published',1000,'{{"vi":"Two"}}',{stock});
      insert into coupons(id,code,type,value,usage_limit,per_user_limit) values
        ('30000000-0000-0000-0000-000000000001','ATOMIC','amount',100,{coupon_limit},1);
    """)


def purchase(code, user, products, coupon=False, key=None, fingerprint="a" * 64):
    ids = ",".join(f"'20000000-0000-0000-0000-00000000000{i}'" for i in products)
    extra = f",'{key}'::uuid,'{fingerprint}'" if key else ''
    return f"""begin; set local statement_timeout='8s'; set local role service_role;
      select test_checkout('{code}','10000000-0000-0000-0000-00000000000{user}',array[{ids}]::uuid[],{str(coupon).lower()}{extra});
      select pg_sleep(0.1); commit;"""


def parallel(commands):
    with ThreadPoolExecutor(max_workers=2) as workers:
        return list(workers.map(lambda command: sql(command, check=False), commands))


try:
    subprocess.run(["docker", "run", "--rm", "-d", "--name", NAME,
                    "-e", "POSTGRES_HOST_AUTH_METHOD=trust", IMAGE], check=True, stdout=subprocess.DEVNULL)
    for _ in range(60):
        if subprocess.run(["docker", "exec", NAME, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"],
                          stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0:
            break
        time.sleep(0.5)
    else:
        raise RuntimeError("PostgreSQL startup timed out")
    sql("""
      create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key,email text);
      create function auth.uid() returns uuid language sql as $$select null::uuid$$;
      create schema storage;
      create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    """)
    for migration in sorted((ROOT / "supabase/migrations").glob("*.sql")):
        sql(migration.read_text())
        if migration.name == '20261006000013_atomic_checkout.sql':
            sql(migration.read_text())  # Repeat at its version; never overwrite newer RPC definitions.
    for regression in sorted((ROOT / 'supabase/tests').glob('*.sql')):
        sql(regression.read_text())
        print('PASS: SQL regression ' + regression.name)
    sql((ROOT / 'supabase/tests/operational_features.sql').read_text().split('do $$')[0] + 'commit;')
    claims = parallel(["begin; select count(*) from claim_notification_jobs('90000000-0000-0000-0000-000000000099',5); select pg_sleep(0.1); commit;"] * 2)
    counts = [r.stdout.strip().splitlines()[0] for r in claims]
    assert sorted(counts) == ['0', '1'], counts
    print('PASS: concurrent outbox claims cannot lease same event twice')
    sql('truncate orders, cart_items, coupons, products, auth.users cascade;')
    sql((ROOT / 'supabase/tests/returns_independent.sql').read_text().split('do $$')[0] + 'commit;')
    def return_submit(request_id):
        return "begin; select submit_return_request('80000000-0000-0000-0000-0000000000%s','10000000-0000-0000-0000-000000000098','wrong_item','Wrong lamp','[{\"slug\":\"return-lamp\",\"quantity\":1}]'); select pg_sleep(0.1); commit;" % request_id
    submitted = parallel([return_submit('98'), return_submit('97')])
    assert sum(r.returncode == 0 for r in submitted) == 1, [r.stderr for r in submitted]
    assert any('RETURN_QUANTITY_EXCEEDED' in r.stderr for r in submitted), [r.stderr for r in submitted]
    print('PASS: concurrent returns cannot reserve same purchased unit twice')
    metric = """begin; select record_api_metric_batch('18000000-0000-4000-8000-000000000017',
      '[{"bucket":"2026-10-07T01:00:00Z","method":"GET","route":"/concurrent-metric","status":200,"count":1,"total_ms":1,"max_ms":1,"le_50":1,"le_100":0,"le_250":0,"le_500":0,"le_1000":0,"le_2500":0,"gt_2500":0}]','[]');
      select pg_sleep(0.1); commit;"""
    receipts = parallel([metric, metric])
    assert all(r.returncode == 0 for r in receipts), [r.stderr for r in receipts]
    assert sql("select sum(count) from api_metrics where route='/concurrent-metric'").stdout.strip() == '1'
    print('PASS: concurrent metric receipt counts once')
    sql('truncate orders, cart_items, coupons, products, auth.users cascade;')
    print("PASS: all migrations, repeatable migration 013, rollback, cancellation, ledger and RPC permissions")
    sql("""
      grant usage on schema public to service_role;
      grant all on all tables in schema public to service_role;
      grant all on all sequences in schema public to service_role;
      create function public.test_checkout(p_code text,p_user uuid,p_ids uuid[],p_coupon boolean,p_key uuid default null,p_fingerprint text default null)
      returns jsonb language plpgsql as $$
      declare cp jsonb; items jsonb; n integer;
      begin
        n := cardinality(p_ids)*1000;
        select jsonb_agg(jsonb_build_object('product_id',id,'quantity',1,'unit_price',1000)) into items from unnest(p_ids) id;
        if p_coupon then select to_jsonb(c) into cp from public.coupons c where c.code='ATOMIC'; end if;
        return public.create_checkout_order(jsonb_build_object(
          'code',p_code,'user_id',p_user,'checkout_idempotency_key',p_key,'checkout_fingerprint',p_fingerprint,'status','confirmed','order_kind','self','has_message',false,'qr_lang',null,
          'recipient_is_self',true,'recipient_name','Test','recipient_phone','0912345678','address_line','Test','province','Test',
          'payment_method','cod','payment_status','pending','subtotal',n,'discount',case when p_coupon then 100 else 0 end,
          'shipping_fee',0,'total',n-case when p_coupon then 100 else 0 end,'vat_amount',0,'vat_rate',0.1,
          'coupon_id',case when p_coupon then '30000000-0000-0000-0000-000000000001' else null end,
          'coupon_code',case when p_coupon then 'ATOMIC' else null end,'qr_token',(md5(random()::text)||md5(random()::text))
        ),items,cp);
      end;
      $$;
      grant execute on function public.test_checkout(text,uuid,uuid[],boolean,uuid,text) to service_role;
    """)
    reset()
    sql("insert into cart_items(user_id,product_id,quantity) select id,'20000000-0000-0000-0000-000000000001',1 from auth.users;")
    results = parallel([purchase("LAST-1", 1, [1]), purchase("LAST-2", 2, [1])])
    assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
    assert "OUT_OF_STOCK" in next(r.stderr for r in results if r.returncode)
    assert sql("select stock from products where slug='one'").stdout.strip() == "0"
    print("PASS: simultaneous purchase of last item commits one order")

    reset(stock=5)
    sql("insert into cart_items(user_id,product_id,quantity) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1);")
    key = '18000000-0000-4000-8000-000000000018'
    results = parallel([purchase('IDEM-RACE-1', 1, [1], key=key), purchase('IDEM-RACE-2', 1, [1], key=key)])
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    assert sql('select count(*) from orders').stdout.strip() == '1'
    assert sql("select stock from products where slug='one'").stdout.strip() == '4'
    assert sql('select count(*) from notification_jobs').stdout.strip() == '1'
    changed = sql(purchase('IDEM-CHANGED', 1, [1], key=key, fingerprint='b' * 64), check=False)
    assert changed.returncode and 'CHECKOUT_KEY_CONFLICT' in changed.stderr, changed.stderr
    print('PASS: concurrent same-key checkout replays one order/stock/event; changed fingerprint conflicts')

    reset(stock=5, coupon_limit=1)
    sql("""insert into cart_items values
      ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1,now(),now()),
      ('10000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002',1,now(),now());""")
    results = parallel([purchase("COUPON-1", 1, [1], True), purchase("COUPON-2", 2, [2], True)])
    assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
    assert "COUPON_USED_UP" in next(r.stderr for r in results if r.returncode)
    assert sql("select sum(stock) from products").stdout.strip() == "9"
    assert sql("select count(*) from cart_items").stdout.strip() == "1"
    print("PASS: coupon contention rolls back losing order and preserves its stock/cart")

    reset(stock=5)
    sql("insert into cart_items(user_id,product_id,quantity) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1);")
    results = parallel([purchase("DOUBLE-1", 1, [1]), purchase("DOUBLE-2", 1, [1])])
    assert sum(r.returncode == 0 for r in results) == 1, [r.stderr for r in results]
    assert "CART_EMPTY" in next(r.stderr for r in results if r.returncode)
    assert sql("select stock from products where slug='one'").stdout.strip() == "4"
    print("PASS: duplicate checkout consumes the cart once")

    reset(stock=5)
    sql("insert into cart_items(user_id,product_id,quantity) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1);")
    sql(purchase("USER-LIMIT-1", 1, [1], True))
    sql("insert into cart_items(user_id,product_id,quantity) values ('10000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001',1);")
    result = sql(purchase("USER-LIMIT-2", 1, [1], True), check=False)
    assert result.returncode != 0 and "COUPON_USER_LIMIT" in result.stderr
    assert sql("select stock from products where slug='one'").stdout.strip() == "4"
    assert sql("select used_count from coupons").stdout.strip() == "1"
    print("PASS: per-customer coupon limit checked in the transaction")

    reset(stock=5)
    sql("insert into cart_items(user_id,product_id,quantity) select u.id,p.id,1 from auth.users u cross join products p;")
    results = parallel([purchase("LOCK-1", 1, [1, 2]), purchase("LOCK-2", 2, [2, 1])])
    assert all(r.returncode == 0 for r in results), [r.stderr for r in results]
    assert sql("select sum(stock) from products").stdout.strip() == "6"
    print("PASS: reversed carts use stable product lock ordering without deadlock")
finally:
    subprocess.run(["docker", "rm", "-f", NAME], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
