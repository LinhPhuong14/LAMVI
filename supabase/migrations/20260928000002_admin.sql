-- Admin: video lô lưu ở Supabase Storage (D-46)

-- Đường dẫn object trong bucket (video_url là link công khai suy ra từ đây)
alter table public.batches add column video_path text;

-- D-47: lô đã xuất bản video không được gỡ xuất bản hay xoá
create or replace function public.batches_guard_published() returns trigger
language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'video_published' then
      raise exception 'batch_published_cannot_be_deleted';
    end if;
    return old;
  end if;
  if old.status = 'video_published' and new.status <> 'video_published' then
    raise exception 'batch_published_cannot_be_unpublished';
  end if;
  if old.status = 'video_published' and new.code <> old.code then
    raise exception 'batch_published_code_locked';
  end if;
  return new;
end;
$$;

create trigger batches_guard_published
  before update or delete on public.batches
  for each row execute function public.batches_guard_published();

-- Bucket công khai cho video lô (đọc công khai; ghi chỉ qua signed upload URL do server cấp)
insert into storage.buckets (id, name, public)
values ('batch-videos', 'batch-videos', true)
on conflict (id) do nothing;
