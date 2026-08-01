-- Atomic base-variant creation for the current non-configurable catalog flow.
-- This migration is intentionally local until it receives explicit review.

create or replace function public.can_create_catalog_base_variant(
  requested_product_id uuid,
  requested_sku text,
  requested_name text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_catalog()
    and exists (
      select 1
      from public.products
      where products.id = requested_product_id
        and products.status <> 'archived'
        and products.archived_at is null
        and products.sku = requested_sku
        and products.name = requested_name
    )
    and not exists (
      select 1
      from public.product_variants
      where product_variants.product_id = requested_product_id
    );
$$;

revoke all on function public.can_create_catalog_base_variant(uuid, text, text)
from public, anon;
grant execute on function public.can_create_catalog_base_variant(uuid, text, text)
to authenticated;

create policy "catalog staff can create one canonical base variant"
on public.product_variants
for insert
to authenticated
with check (
  active
  and archived_at is null
  and attributes = '{}'::jsonb
  and sort_order = 0
  and price is null
  and compare_at_price is null
  and cost is null
  and public.can_create_catalog_base_variant(product_id, sku, name)
);

revoke insert on public.product_variants from anon, authenticated;
grant insert (product_id, sku, name) on public.product_variants to authenticated;

create or replace function public.create_product_with_base_variant(
  requested_slug text,
  requested_sku text,
  requested_name text,
  requested_short_description text,
  requested_description text,
  requested_condition public.product_condition,
  requested_condition_grade public.product_condition_grade,
  requested_condition_notes text,
  requested_brand_id uuid,
  requested_category_id uuid,
  requested_fulfillment_type public.fulfillment_type,
  requested_price public.money_minor_units,
  requested_compare_at_price public.money_minor_units,
  requested_currency public.iso_currency_code,
  requested_featured boolean,
  requested_published boolean,
  requested_price_is_estimate boolean,
  requested_lead_time_min_days integer,
  requested_lead_time_max_days integer
)
returns table (
  product_id uuid,
  variant_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  normalized_sku text := upper(btrim(requested_sku));
  normalized_name text := btrim(requested_name);
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed'
      using errcode = '42501';
  end if;

  if normalized_sku = ''
    or char_length(normalized_sku) > 80
    or normalized_sku !~ '^[A-Z0-9][A-Z0-9._-]*$'
  then
    raise exception 'Product SKU is invalid' using errcode = '22023';
  end if;

  if normalized_name = '' or char_length(normalized_name) > 200 then
    raise exception 'Product name is invalid' using errcode = '22023';
  end if;

  insert into public.products (
    slug,
    sku,
    name,
    short_description,
    description,
    condition,
    condition_grade,
    condition_notes,
    brand_id,
    category_id,
    status,
    fulfillment_type,
    price,
    compare_at_price,
    currency,
    featured,
    published,
    price_is_estimate,
    lead_time_min_days,
    lead_time_max_days,
    archived_at
  )
  values (
    btrim(requested_slug),
    normalized_sku,
    normalized_name,
    requested_short_description,
    requested_description,
    requested_condition,
    requested_condition_grade,
    requested_condition_notes,
    requested_brand_id,
    requested_category_id,
    case
      when requested_published then 'active'::public.product_status
      else 'draft'::public.product_status
    end,
    requested_fulfillment_type,
    requested_price,
    requested_compare_at_price,
    requested_currency,
    requested_featured,
    requested_published,
    requested_price_is_estimate,
    requested_lead_time_min_days,
    requested_lead_time_max_days,
    null
  )
  returning id into product_id;

  insert into public.product_variants (product_id, sku, name)
  values (product_id, normalized_sku, normalized_name)
  returning id into variant_id;

  return next;
end;
$$;

revoke all on function public.create_product_with_base_variant(
  text,
  text,
  text,
  text,
  text,
  public.product_condition,
  public.product_condition_grade,
  text,
  uuid,
  uuid,
  public.fulfillment_type,
  public.money_minor_units,
  public.money_minor_units,
  public.iso_currency_code,
  boolean,
  boolean,
  boolean,
  integer,
  integer
) from public, anon;
grant execute on function public.create_product_with_base_variant(
  text,
  text,
  text,
  text,
  text,
  public.product_condition,
  public.product_condition_grade,
  text,
  uuid,
  uuid,
  public.fulfillment_type,
  public.money_minor_units,
  public.money_minor_units,
  public.iso_currency_code,
  boolean,
  boolean,
  boolean,
  integer,
  integer
) to authenticated;

create or replace function public.repair_product_base_variant(
  requested_product_id uuid
)
returns table (
  product_id uuid,
  variant_id uuid,
  created boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_product record;
  existing_variant record;
  variant_count bigint;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed'
      using errcode = '42501';
  end if;

  select products.id, products.sku, products.name,
    products.status, products.archived_at
  into selected_product
  from public.products
  where products.id = requested_product_id
  for update;

  if not found then
    raise exception 'Product is not available' using errcode = '22023';
  end if;

  if selected_product.status = 'archived'
    or selected_product.archived_at is not null
  then
    raise exception 'Archived product cannot be repaired'
      using errcode = '22023';
  end if;

  if selected_product.sku <> upper(btrim(selected_product.sku))
    or selected_product.sku = ''
    or char_length(selected_product.sku) > 80
    or selected_product.sku !~ '^[A-Z0-9][A-Z0-9._-]*$'
  then
    raise exception 'Product SKU is invalid' using errcode = '22023';
  end if;

  select count(*) into variant_count
  from public.product_variants
  where product_variants.product_id = selected_product.id;

  if variant_count = 0 then
    insert into public.product_variants (product_id, sku, name)
    values (selected_product.id, selected_product.sku, selected_product.name)
    returning id into variant_id;

    product_id := selected_product.id;
    created := true;
    return next;
    return;
  end if;

  if variant_count = 1 then
    select product_variants.id, product_variants.sku,
      product_variants.name, product_variants.active,
      product_variants.archived_at, product_variants.attributes,
      product_variants.sort_order
    into existing_variant
    from public.product_variants
    where product_variants.product_id = selected_product.id;

    if existing_variant.sku = selected_product.sku
      and existing_variant.name = selected_product.name
      and existing_variant.active
      and existing_variant.archived_at is null
      and existing_variant.attributes = '{}'::jsonb
      and existing_variant.sort_order = 0
    then
      product_id := selected_product.id;
      variant_id := existing_variant.id;
      created := false;
      return next;
      return;
    end if;
  end if;

  raise exception 'Product already has variants' using errcode = '23505';
end;
$$;

revoke all on function public.repair_product_base_variant(uuid)
from public, anon;
grant execute on function public.repair_product_base_variant(uuid)
to authenticated;
