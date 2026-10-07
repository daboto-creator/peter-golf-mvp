-- Allow authenticated golfers (and the public catalog reader) to resolve the
-- canonical golf taxonomy used by Mi Golf. These are reference rows only;
-- write access and pricing/payment tables remain private.

alter table public.catalog_product_models enable row level security;

create policy "public can read active golf reference brands"
on public.brands
for select
to anon, authenticated
using (status = 'active');

create policy "public can read active golf reference categories"
on public.categories
for select
to anon, authenticated
using (status = 'active');

create policy "public can read active golf reference profiles"
on public.category_spec_profiles
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.categories
    where categories.id = category_spec_profiles.category_id
      and categories.status = 'active'
  )
);

create policy "public can read active golf reference models"
on public.catalog_product_models
for select
to anon, authenticated
using (
  status = 'active'
  and exists (
    select 1 from public.brands
    where brands.id = catalog_product_models.brand_id
      and brands.status = 'active'
  )
  and exists (
    select 1 from public.categories
    where categories.id = catalog_product_models.category_id
      and categories.status = 'active'
  )
);

grant select (id, slug, name, status)
on public.brands to anon, authenticated;

grant select (id, parent_id, sort_order, slug, name, status)
on public.categories to anon, authenticated;

grant select (category_id, family, club_type, bag_type, set_type)
on public.category_spec_profiles to anon, authenticated;

grant select (id, brand_id, category_id, model_name, normalized_model_name, status)
on public.catalog_product_models to anon, authenticated;
