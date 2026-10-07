-- Atomic event capture; deploy before NOTIFICATION_OUTBOX_ENABLED=1. No historical backfill.
begin;
create table public.notification_jobs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event text not null check (event in ('confirmed','payment_expired','shipped','cancelled','refunded')),
  snapshot jsonb not null,
  delivery_payload jsonb,
  delivery_started_at timestamptz,
  status text not null default 'pending' check (status in ('pending','leased','sent','dead')),
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lease_until timestamptz,
  lease_token uuid,
  sent_at timestamptz,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  unique(order_id,event)
);
alter table public.notification_jobs enable row level security;
revoke all on public.notification_jobs from anon, authenticated;
grant all on public.notification_jobs to service_role;
create index notification_jobs_pending_idx on public.notification_jobs(next_attempt_at,id) where status='pending';
create index notification_jobs_operations_idx on public.notification_jobs(status,created_at desc);
create index notification_jobs_payload_expiry_idx on public.notification_jobs(delivery_started_at,id) where delivery_payload is not null;
create index notification_jobs_leased_idx on public.notification_jobs(lease_until,id) where status='leased';
create function public.capture_order_notification() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare e text;
begin
  if tg_op='INSERT' then
    if new.status='confirmed' then e := 'confirmed'; end if;
  else
    if new.status is distinct from old.status then
      if new.status='confirmed' then e := 'confirmed';
      elsif new.status='shipped' then e := 'shipped';
      elsif new.status='cancelled' then
        e := case when new.cancel_reason='PAYMENT_EXPIRED' then 'payment_expired' else 'cancelled' end;
      end if;
    end if;
    if new.payment_status='refunded' and old.payment_status is distinct from new.payment_status then e := 'refunded'; end if;
  end if;
  if e is not null then
    insert into public.notification_jobs(order_id,event,snapshot) values(new.id,e,
      jsonb_build_object('code',new.code,'total',new.total,'trackingCode',new.tracking_code,'paymentStatus',new.payment_status))
      on conflict(order_id,event) do nothing;
  end if;
  return new;
end $$;
revoke all on function public.capture_order_notification() from public,anon,authenticated;
create trigger orders_notification_capture after insert or update of status,payment_status on public.orders
  for each row execute function public.capture_order_notification();
create function public.claim_notification_jobs(p_order_id uuid default null,p_limit integer default 5)
returns setof public.notification_jobs language plpgsql security definer set search_path=public,pg_temp as $$
begin
  -- Rendered retry payload is a short-lived delivery cache, not order/legal history.
  with expired as (select id from public.notification_jobs
    where delivery_payload is not null and delivery_started_at < now()-interval '24 hours'
    order by delivery_started_at,id for update skip locked limit 100)
  update public.notification_jobs j set delivery_payload=null from expired where j.id=expired.id;
  return query
  with ready as (
    select j.id from public.notification_jobs j
    where (p_order_id is null or j.order_id=p_order_id)
      and ((j.status='pending' and j.next_attempt_at<=now()) or (j.status='leased' and j.lease_until<=now()))
    order by j.next_attempt_at,j.id for update skip locked limit greatest(1,least(p_limit,5))
  )
  update public.notification_jobs j set status='leased',lease_until=now()+interval '90 seconds',
    lease_token=gen_random_uuid(),attempts=j.attempts+1
  from ready where j.id=ready.id returning j.*;
end $$;
revoke all on function public.claim_notification_jobs(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_notification_jobs(uuid,integer) to service_role;
create function public.retry_notification_job(p_id uuid,p_actor_id uuid) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare changed uuid;
begin
  if not exists(select 1 from public.profiles where id=p_actor_id and role='it') then
    raise exception 'FORBIDDEN';
  end if;
  update public.notification_jobs set status='pending',attempts=0,next_attempt_at=now(),lease_until=null,lease_token=null
  where id=p_id and status='dead' and (delivery_started_at is null or delivery_started_at>now()-interval '23 hours') returning id into changed;
  if changed is null then return false; end if;
  insert into public.audit_log(actor_id,actor_role,entity,entity_id,action,new_value)
    values(p_actor_id,'it','notification',p_id,'retry',jsonb_build_object('status','pending'));
  return true;
end $$;
revoke all on function public.retry_notification_job(uuid,uuid) from public,anon,authenticated;
grant execute on function public.retry_notification_job(uuid,uuid) to service_role;
commit;
