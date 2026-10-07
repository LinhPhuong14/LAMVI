-- G-35: acknowledged idempotent batches, safe retry after lost HTTP response.
create table public.api_metric_batches (
  id uuid primary key,
  created_at timestamptz not null default now()
);
alter table public.api_metric_batches enable row level security;

create or replace function public.record_api_metric_batch(batch_id uuid, rows jsonb, errors jsonb)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if jsonb_typeof(rows) <> 'array' or jsonb_array_length(rows) > 1000
    or jsonb_typeof(errors) <> 'array' or jsonb_array_length(errors) > 100 then
    raise exception 'invalid metric batch';
  end if;
  insert into public.api_metric_batches(id) values(batch_id) on conflict do nothing;
  if not found then return; end if;
  perform public.record_api_metrics(rows);
  insert into public.api_errors(at, method, route, path, status, code, message)
    select (r->>'at')::timestamptz, r->>'method', r->>'route', r->>'path',
      (r->>'status')::integer, r->>'code', r->>'message'
    from jsonb_array_elements(errors) r;
end;
$$;
revoke all on function public.record_api_metric_batch(uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.record_api_metric_batch(uuid,jsonb,jsonb) to service_role;

-- Aggregate in DB, not PostgREST's default 1000-row response limit.
create or replace function public.aggregate_api_metrics(since_at timestamptz)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(jsonb_agg(t), '[]'::jsonb) from (
  select m.method, m.route, m.status, sum(m.count) as count, sum(m.total_ms) as total_ms, max(m.max_ms) as max_ms,
    sum(m.le_50) as le_50,sum(m.le_100) as le_100,sum(m.le_250) as le_250,sum(m.le_500) as le_500,sum(m.le_1000) as le_1000,sum(m.le_2500) as le_2500,sum(m.gt_2500) as gt_2500
  from public.api_metrics m
  where m.bucket >= greatest(since_at, now() - interval '30 days')
  group by m.method,m.route,m.status) t;
$$;
revoke all on function public.aggregate_api_metrics(timestamptz) from public, anon, authenticated;
grant execute on function public.aggregate_api_metrics(timestamptz) to service_role;
create index if not exists api_metrics_bucket_idx on public.api_metrics(bucket);
create index if not exists api_metric_batches_created_idx on public.api_metric_batches(created_at);
