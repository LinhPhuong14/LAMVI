-- Disposable database only. No production data changes: rollback all fixtures.
begin;
do $$
declare c uuid; p uuid;
begin
  insert into public.collections(slug, name) values ('collection-integrity-test', '{"vi":"Test"}') returning id into c;
  insert into public.products(slug, kind, price, name, collection_slug)
    values ('collection-integrity-lamp', 'single', 1000, '{"vi":"Test"}', 'collection-integrity-test') returning id into p;
  begin
    delete from public.collections where id = c;
    raise exception 'FAIL: attached collection deleted';
  exception when foreign_key_violation then null;
  end;
  begin
    update public.products set collection_slug = 'missing-integrity-collection' where id = p;
    raise exception 'FAIL: dangling collection assignment accepted';
  exception when foreign_key_violation then null;
  end;
  update public.products set collection_slug = null where id = p;
  delete from public.collections where id = c;
end $$;
rollback;
