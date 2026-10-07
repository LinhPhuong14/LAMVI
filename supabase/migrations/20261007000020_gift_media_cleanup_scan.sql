-- Existing D-26/D-75 deadlines only. Eligible keyset batches prevent the first
-- 1000 unexpired records from starving every later expired file.
create or replace function public.list_expired_gift_media(before_at timestamptz, after_id uuid default null, batch_limit integer default 10)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
 select coalesce(jsonb_agg(t.item order by t.id), '[]'::jsonb) from (
  select g.id, jsonb_build_object(
    'message', jsonb_build_object('id',g.id,'order_id',g.order_id,'voice_path',g.voice_path,
      'video_path',g.video_path,'confirmed_at',g.confirmed_at,'media_deleted_at',g.media_deleted_at),
    'order', jsonb_build_object('id',o.id,'status',o.status,'delivered_at',o.delivered_at)
  ) item
  from public.gift_messages g join public.orders o on o.id=g.order_id
  where g.media_deleted_at is null and (g.voice_path is not null or g.video_path is not null)
    and (after_id is null or g.id > after_id)
    and (g.confirmed_at <= before_at - interval '720 hours'
      or (g.confirmed_at is null and o.delivered_at <= before_at - interval '2160 hours'))
  order by g.id limit greatest(1, least(coalesce(batch_limit,10),100))
 ) t;
$$;
revoke all on function public.list_expired_gift_media(timestamptz,uuid,integer) from public,anon,authenticated;
grant execute on function public.list_expired_gift_media(timestamptz,uuid,integer) to service_role;
create index if not exists gift_media_active_confirmed_idx on public.gift_messages(confirmed_at,id)
 where media_deleted_at is null and (voice_path is not null or video_path is not null);
create index if not exists orders_delivered_at_idx on public.orders(delivered_at) where delivered_at is not null;
