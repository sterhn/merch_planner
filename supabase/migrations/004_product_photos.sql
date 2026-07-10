-- Item descriptions + full-size product photos.

-- Free-text description shown/edited in the catalog item form.
alter table items add column if not exists description text;

-- Storage bucket for product photos (up to 1400px, replaces the old 512px
-- item-images thumbnails for new uploads). Public read (images are served
-- by URL), only the authenticated user can upload or delete.
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

create policy "authenticated upload product photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-photos');
create policy "authenticated update product photos" on storage.objects
  for update to authenticated using (bucket_id = 'product-photos');
create policy "authenticated delete product photos" on storage.objects
  for delete to authenticated using (bucket_id = 'product-photos');
create policy "public read product photos" on storage.objects
  for select using (bucket_id = 'product-photos');
