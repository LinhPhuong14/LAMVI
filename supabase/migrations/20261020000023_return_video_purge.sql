-- D-109: video đổi trả xoá 90 ngày sau khi xử lý xong (resolved/rejected). Giữ dòng yêu cầu, chỉ xoá tệp
-- và đánh dấu thời điểm xoá để cron không xoá lại và admin biết video không còn.
alter table public.return_requests add column if not exists video_purged_at timestamptz;
create index if not exists return_requests_purge on public.return_requests(status, resolved_at, decided_at) where video_purged_at is null;
notify pgrst, 'reload schema';
