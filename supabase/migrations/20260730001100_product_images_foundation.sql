-- Public product-image Storage foundation and operator/admin metadata workflow.
-- This migration is intentionally local until it receives explicit review.

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.product_images
  add constraint product_images_storage_path_format
  check (
    storage_path ~
      '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
  );

create or replace function public.prevent_new_product_with_condition_evidence()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.condition = 'new' and exists (
    select 1
    from public.product_images
    where product_images.product_id = new.id
      and product_images.is_condition_evidence
  ) then
    raise exception 'Remove condition evidence before changing product condition'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

create trigger products_require_used_condition_evidence
before update of condition on public.products
for each row execute function public.prevent_new_product_with_condition_evidence();

revoke all on function public.prevent_new_product_with_condition_evidence()
  from public, anon, authenticated;

create policy "catalog staff can read all product images"
on public.product_images
for select
to authenticated
using ((select public.can_manage_catalog()));

create policy "catalog staff can create product images"
on public.product_images
for insert
to authenticated
with check (
  (select public.can_manage_catalog())
  and exists (
    select 1
    from public.products
    where products.id = product_images.product_id
  )
);

create policy "catalog staff can update product images"
on public.product_images
for update
to authenticated
using (
  (select public.can_manage_catalog())
  and exists (
    select 1
    from public.products
    where products.id = product_images.product_id
  )
)
with check (
  (select public.can_manage_catalog())
  and exists (
    select 1
    from public.products
    where products.id = product_images.product_id
  )
);

create policy "catalog staff can delete product images"
on public.product_images
for delete
to authenticated
using (
  (select public.can_manage_catalog())
  and exists (
    select 1
    from public.products
    where products.id = product_images.product_id
  )
);

revoke insert, update, delete, truncate, references, trigger
on public.product_images
from anon, authenticated;

grant insert (
  id,
  product_id,
  storage_path,
  alt_text,
  sort_order,
  is_primary,
  is_condition_evidence
) on public.product_images to authenticated;

grant update (
  alt_text,
  sort_order,
  is_primary,
  is_condition_evidence
) on public.product_images to authenticated;

grant delete on public.product_images to authenticated;

create policy "public can read valid product image objects"
on storage.objects
for select
to anon, authenticated
using (
  bucket_id = 'product-images'
  and name ~
    '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$'
);

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
    where products.id::text = (storage.foldername(name))[2]
  )
);

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
    where products.id::text = (storage.foldername(name))[2]
  )
);

create or replace function public.register_product_image(
  requested_product_id uuid,
  requested_storage_path text,
  requested_alt_text text,
  requested_is_condition_evidence boolean
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  product_condition public.product_condition;
  next_sort_order integer;
  should_be_primary boolean;
  new_image_id uuid;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  select products.condition
    into product_condition
    from public.products
    where products.id = requested_product_id
    for update;

  if not found then
    raise exception 'Product unavailable' using errcode = 'P0002';
  end if;

  if requested_storage_path !~
    ('^products/' || requested_product_id::text ||
     '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
  then
    raise exception 'Invalid storage path' using errcode = '22023';
  end if;

  if char_length(btrim(requested_alt_text)) not between 1 and 300 then
    raise exception 'Invalid alt text' using errcode = '22023';
  end if;

  if requested_is_condition_evidence and product_condition <> 'used' then
    raise exception 'Condition evidence requires a used product'
      using errcode = '22023';
  end if;

  if (
    select count(*)
    from public.product_images
    where product_images.product_id = requested_product_id
  ) >= 24 then
    raise exception 'Product image limit reached' using errcode = '22023';
  end if;

  select
    coalesce(max(product_images.sort_order), -1) + 1,
    not exists (
      select 1
      from public.product_images
      where product_images.product_id = requested_product_id
        and product_images.is_primary
    )
  into next_sort_order, should_be_primary
  from public.product_images
  where product_images.product_id = requested_product_id;

  insert into public.product_images (
    product_id,
    storage_path,
    alt_text,
    sort_order,
    is_primary,
    is_condition_evidence
  )
  values (
    requested_product_id,
    requested_storage_path,
    btrim(requested_alt_text),
    next_sort_order,
    should_be_primary,
    requested_is_condition_evidence
  )
  returning id into new_image_id;

  return new_image_id;
end;
$$;

create or replace function public.update_product_image(
  requested_product_id uuid,
  requested_image_id uuid,
  requested_alt_text text,
  requested_is_primary boolean,
  requested_is_condition_evidence boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  product_condition public.product_condition;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  select products.condition
    into product_condition
    from public.products
    where products.id = requested_product_id
    for update;

  if not found or not exists (
    select 1
    from public.product_images
    where product_images.id = requested_image_id
      and product_images.product_id = requested_product_id
  ) then
    return false;
  end if;

  if char_length(btrim(requested_alt_text)) not between 1 and 300 then
    raise exception 'Invalid alt text' using errcode = '22023';
  end if;

  if requested_is_condition_evidence and product_condition <> 'used' then
    raise exception 'Condition evidence requires a used product'
      using errcode = '22023';
  end if;

  if requested_is_primary then
    update public.product_images
    set is_primary = false
    where product_images.product_id = requested_product_id
      and product_images.is_primary;
  end if;

  update public.product_images
  set
    alt_text = btrim(requested_alt_text),
    is_primary = requested_is_primary,
    is_condition_evidence = requested_is_condition_evidence
  where product_images.id = requested_image_id
    and product_images.product_id = requested_product_id;

  if not requested_is_primary and not exists (
    select 1
    from public.product_images
    where product_images.product_id = requested_product_id
      and product_images.is_primary
  ) then
    update public.product_images
    set is_primary = true
    where product_images.id = (
      select product_images.id
      from public.product_images
      where product_images.product_id = requested_product_id
      order by product_images.sort_order, product_images.id
      limit 1
    );
  end if;

  return true;
end;
$$;

create or replace function public.reorder_product_images(
  requested_product_id uuid,
  requested_image_ids uuid[]
)
returns boolean
language plpgsql
set search_path = ''
as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  perform 1
  from public.products
  where products.id = requested_product_id
  for update;

  if not found
    or cardinality(requested_image_ids) <> (
      select count(*)
      from public.product_images
      where product_images.product_id = requested_product_id
    )
    or cardinality(requested_image_ids) <> (
      select count(distinct image_id)
      from unnest(requested_image_ids) as image_id
    )
    or exists (
      select 1
      from unnest(requested_image_ids) as image_id
      where not exists (
        select 1
        from public.product_images
        where product_images.id = image_id
          and product_images.product_id = requested_product_id
      )
    )
  then
    return false;
  end if;

  update public.product_images
  set sort_order = requested_order.position - 1
  from unnest(requested_image_ids) with ordinality
    as requested_order(image_id, position)
  where product_images.id = requested_order.image_id
    and product_images.product_id = requested_product_id;

  return true;
end;
$$;

create or replace function public.remove_product_image(
  requested_product_id uuid,
  requested_image_id uuid
)
returns table (
  id uuid,
  storage_path text,
  alt_text text,
  sort_order integer,
  is_primary boolean,
  is_condition_evidence boolean
)
language plpgsql
set search_path = ''
as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  perform 1
  from public.products
  where products.id = requested_product_id
  for update;

  if not found then
    return;
  end if;

  return query
  delete from public.product_images
  where product_images.id = requested_image_id
    and product_images.product_id = requested_product_id
  returning
    product_images.id,
    product_images.storage_path,
    product_images.alt_text,
    product_images.sort_order,
    product_images.is_primary,
    product_images.is_condition_evidence;

  if not exists (
    select 1
    from public.product_images
    where product_images.product_id = requested_product_id
      and product_images.is_primary
  ) then
    update public.product_images
    set is_primary = true
    where product_images.id = (
      select product_images.id
      from public.product_images
      where product_images.product_id = requested_product_id
      order by product_images.sort_order, product_images.id
      limit 1
    );
  end if;
end;
$$;

create or replace function public.restore_product_image(
  requested_product_id uuid,
  requested_image_id uuid,
  requested_storage_path text,
  requested_alt_text text,
  requested_sort_order integer,
  requested_is_primary boolean,
  requested_is_condition_evidence boolean
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  product_condition public.product_condition;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog access denied' using errcode = '42501';
  end if;

  select products.condition
    into product_condition
    from public.products
    where products.id = requested_product_id
    for update;

  if not found
    or requested_storage_path !~
      ('^products/' || requested_product_id::text ||
       '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
    or char_length(btrim(requested_alt_text)) not between 1 and 300
    or requested_sort_order < 0
    or (requested_is_condition_evidence and product_condition <> 'used')
  then
    return false;
  end if;

  if requested_is_primary then
    update public.product_images
    set is_primary = false
    where product_images.product_id = requested_product_id
      and product_images.is_primary;
  end if;

  insert into public.product_images (
    id,
    product_id,
    storage_path,
    alt_text,
    sort_order,
    is_primary,
    is_condition_evidence
  )
  values (
    requested_image_id,
    requested_product_id,
    requested_storage_path,
    btrim(requested_alt_text),
    requested_sort_order,
    requested_is_primary,
    requested_is_condition_evidence
  );

  return true;
end;
$$;

revoke all on function public.register_product_image(uuid, text, text, boolean)
  from public, anon;
revoke all on function public.update_product_image(uuid, uuid, text, boolean, boolean)
  from public, anon;
revoke all on function public.reorder_product_images(uuid, uuid[])
  from public, anon;
revoke all on function public.remove_product_image(uuid, uuid)
  from public, anon;
revoke all on function public.restore_product_image(
  uuid, uuid, text, text, integer, boolean, boolean
) from public, anon;

grant execute on function public.register_product_image(uuid, text, text, boolean)
  to authenticated;
grant execute on function public.update_product_image(uuid, uuid, text, boolean, boolean)
  to authenticated;
grant execute on function public.reorder_product_images(uuid, uuid[])
  to authenticated;
grant execute on function public.remove_product_image(uuid, uuid)
  to authenticated;
grant execute on function public.restore_product_image(
  uuid, uuid, text, text, integer, boolean, boolean
) to authenticated;
