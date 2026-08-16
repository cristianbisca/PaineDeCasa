insert into storage.buckets (id, name, public)
values ('photos', 'photos', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "pdc_photos_public_read" on storage.objects;
create policy "pdc_photos_public_read"
  on storage.objects
  for select to anon
  using (bucket_id = 'photos');

drop policy if exists "pdc_photos_anon_insert" on storage.objects;
create policy "pdc_photos_anon_insert"
  on storage.objects
  for insert to anon
  with check (bucket_id = 'photos');
