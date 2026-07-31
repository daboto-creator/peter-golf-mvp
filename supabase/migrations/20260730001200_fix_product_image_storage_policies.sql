-- Qualify the outer Storage object path inside the correlated product lookup.

drop policy if exists "catalog staff can upload valid product image objects"
on storage.objects;

create policy "catalog staff can upload valid product image objects"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select public.can_manage_catalog())
  and name ~
    '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and exists (
    select 1
    from public.products
    where products.id::text =
      (storage.foldername(storage.objects.name))[2]
  )
);

drop policy if exists "catalog staff can delete valid product image objects"
on storage.objects;

create policy "catalog staff can delete valid product image objects"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select public.can_manage_catalog())
  and name ~
    '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  and exists (
    select 1
    from public.products
    where products.id::text =
      (storage.foldername(storage.objects.name))[2]
  )
);
