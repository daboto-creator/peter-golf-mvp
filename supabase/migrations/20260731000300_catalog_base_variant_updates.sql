-- Atomic synchronization of products and their canonical base variants.
-- This migration is intentionally local until it receives explicit review.

create policy "catalog staff can update canonical base variant through rpc"
on public.product_variants
for update
to authenticated
using (
  (select public.can_manage_catalog())
  and current_setting('peter_golf.catalog_base_variant_rpc_write', true) = 'enabled'
)
with check (
  (select public.can_manage_catalog())
  and current_setting('peter_golf.catalog_base_variant_rpc_write', true) = 'enabled'
);

revoke update on public.product_variants from anon, authenticated;
grant update (sku, name) on public.product_variants to authenticated;

create or replace function public.require_catalog_base_variant_rpc_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
    and current_setting(
      'peter_golf.catalog_base_variant_rpc_write',
      true
    ) <> 'enabled'
  then
    raise exception 'Product identity writes require the catalog RPC'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

create trigger products_identity_requires_catalog_rpc
before update of sku, name on public.products
for each row
when (
  old.sku is distinct from new.sku
  or old.name is distinct from new.name
)
execute function public.require_catalog_base_variant_rpc_write();

revoke all on function public.require_catalog_base_variant_rpc_write()
from public, anon, authenticated;

create or replace function public.update_product_with_base_variant(
  requested_product_id uuid,
  expected_status public.product_status,
  expected_published boolean,
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
  selected_product record;
  selected_variant_id uuid;
  selected_variant_sku text;
  selected_variant_name text;
  selected_variant_active boolean;
  selected_variant_archived_at timestamptz;
  selected_variant_attributes jsonb;
  selected_variant_sort_order integer;
  variant_count bigint;
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

  select
    products.id,
    products.sku,
    products.name,
    products.condition,
    products.status,
    products.published,
    products.archived_at
  into selected_product
  from public.products
  where products.id = requested_product_id
  for update;

  if not found then
    raise exception 'Product is not available' using errcode = '22023';
  end if;

  if selected_product.archived_at is not null
    or selected_product.status = 'archived'
  then
    raise exception 'Archived product cannot be edited'
      using errcode = '22023';
  end if;

  if selected_product.status is distinct from expected_status
    or selected_product.published is distinct from expected_published
  then
    raise exception 'Product state changed' using errcode = '40001';
  end if;

  select count(*) into variant_count
  from public.product_variants
  where product_variants.product_id = selected_product.id;

  if variant_count = 0 then
    raise exception 'Product requires base variant repair'
      using errcode = '22023';
  end if;

  if variant_count <> 1 then
    raise exception 'Product requires variant management'
      using errcode = '22023';
  end if;

  select
    product_variants.id,
    product_variants.sku,
    product_variants.name,
    product_variants.active,
    product_variants.archived_at,
    product_variants.attributes,
    product_variants.sort_order
  into
    selected_variant_id,
    selected_variant_sku,
    selected_variant_name,
    selected_variant_active,
    selected_variant_archived_at,
    selected_variant_attributes,
    selected_variant_sort_order
  from public.product_variants
  where product_variants.product_id = selected_product.id;

  if selected_variant_sku is distinct from selected_product.sku
    or selected_variant_name is distinct from selected_product.name
    or selected_variant_active is distinct from true
    or selected_variant_archived_at is not null
    or selected_variant_attributes is distinct from '{}'::jsonb
    or selected_variant_sort_order is distinct from 0
  then
    raise exception 'Product base variant is not canonical'
      using errcode = '22023';
  end if;

  if selected_product.condition = 'used'
    and requested_condition = 'new'
    and exists (
      select 1
      from public.product_images
      where product_images.product_id = selected_product.id
        and product_images.is_condition_evidence
    )
  then
    raise exception 'Used-condition evidence must be removed first'
      using errcode = '23514';
  end if;

  perform set_config(
    'peter_golf.catalog_base_variant_rpc_write',
    'enabled',
    true
  );

  update public.products
  set
    slug = btrim(requested_slug),
    sku = normalized_sku,
    name = normalized_name,
    short_description = requested_short_description,
    description = requested_description,
    condition = requested_condition,
    condition_grade = requested_condition_grade,
    condition_notes = requested_condition_notes,
    brand_id = requested_brand_id,
    category_id = requested_category_id,
    status = case
      when requested_published then 'active'::public.product_status
      else 'draft'::public.product_status
    end,
    fulfillment_type = requested_fulfillment_type,
    price = requested_price,
    compare_at_price = requested_compare_at_price,
    currency = requested_currency,
    featured = requested_featured,
    published = requested_published,
    price_is_estimate = requested_price_is_estimate,
    lead_time_min_days = requested_lead_time_min_days,
    lead_time_max_days = requested_lead_time_max_days
  where products.id = selected_product.id
  returning products.id into product_id;

  if not found then
    raise exception 'Product state changed' using errcode = '40001';
  end if;

  update public.product_variants
  set sku = normalized_sku,
    name = normalized_name
  where product_variants.id = selected_variant_id
  returning product_variants.id into variant_id;

  if not found then
    raise exception 'Product variant changed' using errcode = '40001';
  end if;

  perform set_config(
    'peter_golf.catalog_base_variant_rpc_write',
    'disabled',
    true
  );

  return next;
end;
$$;

revoke all on function public.update_product_with_base_variant(
  uuid,
  public.product_status,
  boolean,
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
grant execute on function public.update_product_with_base_variant(
  uuid,
  public.product_status,
  boolean,
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
