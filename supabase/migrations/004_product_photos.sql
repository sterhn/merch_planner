-- Item descriptions + large product photos.
-- Items keep their small thumbnail (image_url, item-images bucket) and gain
-- a separate larger product photo (product_photo_url, product-photos bucket).
-- Safe to re-run: everything below is idempotent.

alter table items add column if not exists description text;
alter table items add column if not exists product_photo_url text;

-- Storage bucket for the large product photos (up to 1400px). Public read
-- (images are served by URL), only the authenticated user can upload/delete —
-- same model as item-images.
insert into storage.buckets (id, name, public) values ('product-photos', 'product-photos', true)
on conflict (id) do nothing;

drop policy if exists "authenticated upload product photos" on storage.objects;
drop policy if exists "authenticated update product photos" on storage.objects;
drop policy if exists "authenticated delete product photos" on storage.objects;
drop policy if exists "public read product photos" on storage.objects;

create policy "authenticated upload product photos" on storage.objects
  for insert to authenticated with check (bucket_id = 'product-photos');
create policy "authenticated update product photos" on storage.objects
  for update to authenticated using (bucket_id = 'product-photos');
create policy "authenticated delete product photos" on storage.objects
  for delete to authenticated using (bucket_id = 'product-photos');
create policy "public read product photos" on storage.objects
  for select using (bucket_id = 'product-photos');
