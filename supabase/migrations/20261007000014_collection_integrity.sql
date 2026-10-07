-- D-96: prevent new dangling product assignments and collection deletion races.
-- NOT VALID preserves legacy assignments until operators reconcile them; new
-- inserts/updates and referenced deletes are still enforced by PostgreSQL.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'products_collection_slug_fkey' and conrelid = 'public.products'::regclass) then
    alter table public.products add constraint products_collection_slug_fkey
      foreign key (collection_slug) references public.collections(slug)
      on delete restrict on update restrict not valid;
  end if;
end $$;
