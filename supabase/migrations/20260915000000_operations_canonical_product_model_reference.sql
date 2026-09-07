-- Link first-party Operations products to the shared golf model catalog while
-- preserving the original model text in the category-specific spec table.
alter table public.products
  add column canonical_model_id uuid
    references public.catalog_product_models(id) on delete restrict,
  add column model_reference_status text not null default 'USER_ENTERED';

alter table public.products
  add constraint products_model_reference_status_valid
    check (model_reference_status in ('RESOLVED','USER_ENTERED','PENDING_REVIEW')),
  add constraint products_model_reference_consistent
    check (
      (canonical_model_id is not null and model_reference_status = 'RESOLVED')
      or
      (canonical_model_id is null and model_reference_status <> 'RESOLVED')
    );

create index products_canonical_model_idx
  on public.products(canonical_model_id)
  where canonical_model_id is not null;

comment on column public.products.canonical_model_id is
  'Shared product identity; unit-specific golf configuration remains in product_*_specs.';
comment on column public.products.model_reference_status is
  'Resolution state for canonical model linkage. Manual text remains pending or user-entered.';

create or replace function private.validate_product_model_reference(
  requested_brand_id uuid,
  requested_category_id uuid,
  requested_canonical_model_id uuid,
  requested_model_reference_status text
)
returns void
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if requested_model_reference_status not in ('RESOLVED','USER_ENTERED','PENDING_REVIEW') then
    raise exception 'Invalid model reference status' using errcode = '22023';
  end if;

  if requested_canonical_model_id is null then
    if requested_model_reference_status = 'RESOLVED' then
      raise exception 'Resolved model reference requires a canonical model' using errcode = '22023';
    end if;
    return;
  end if;

  if requested_model_reference_status <> 'RESOLVED' then
    raise exception 'Canonical model requires resolved status' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.catalog_product_models model
    where model.id = requested_canonical_model_id
      and model.brand_id = requested_brand_id
      and model.category_id = requested_category_id
      and model.status = 'active'
  ) then
    raise exception 'Canonical model does not match brand and category' using errcode = '22023';
  end if;
end;
$$;

revoke all on function private.validate_product_model_reference(uuid,uuid,uuid,text)
  from public, anon, authenticated;

create or replace function public.create_priced_golf_product_with_model_reference(
  requested_slug text, requested_sku text, requested_name text,
  requested_short_description text, requested_description text,
  requested_condition public.product_condition,
  requested_condition_grade public.product_condition_grade,
  requested_condition_notes text, requested_brand_id uuid,
  requested_category_id uuid, requested_fulfillment_type public.fulfillment_type,
  requested_price public.money_minor_units,
  requested_compare_at_price public.money_minor_units,
  requested_currency public.iso_currency_code, requested_featured boolean,
  requested_published boolean, requested_price_is_estimate boolean,
  requested_lead_time_min_days integer, requested_lead_time_max_days integer,
  requested_condition_score smallint,
  requested_target_player public.product_target_player,
  requested_specifications jsonb, requested_components jsonb,
  requested_pricing jsonb, requested_canonical_model_id uuid,
  requested_model_reference_status text
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  perform private.validate_product_model_reference(
    requested_brand_id, requested_category_id, requested_canonical_model_id,
    requested_model_reference_status
  );
  select created.product_id, created.variant_id into product_id, variant_id
  from public.create_priced_golf_product_with_base_variant(
    requested_slug, requested_sku, requested_name, requested_short_description,
    requested_description, requested_condition, requested_condition_grade,
    requested_condition_notes, requested_brand_id, requested_category_id,
    requested_fulfillment_type, requested_price, requested_compare_at_price,
    requested_currency, requested_featured, requested_published,
    requested_price_is_estimate, requested_lead_time_min_days,
    requested_lead_time_max_days, requested_condition_score,
    requested_target_player, requested_specifications, requested_components,
    requested_pricing
  ) as created;
  update public.products
  set canonical_model_id = requested_canonical_model_id,
      model_reference_status = requested_model_reference_status
  where id = product_id;
  return next;
end;
$$;

create or replace function public.update_priced_golf_product_with_model_reference(
  requested_product_id uuid, expected_status public.product_status,
  expected_published boolean, requested_slug text, requested_sku text,
  requested_name text, requested_short_description text,
  requested_description text, requested_condition public.product_condition,
  requested_condition_grade public.product_condition_grade,
  requested_condition_notes text, requested_brand_id uuid,
  requested_category_id uuid, requested_fulfillment_type public.fulfillment_type,
  requested_price public.money_minor_units,
  requested_compare_at_price public.money_minor_units,
  requested_currency public.iso_currency_code, requested_featured boolean,
  requested_published boolean, requested_price_is_estimate boolean,
  requested_lead_time_min_days integer, requested_lead_time_max_days integer,
  requested_condition_score smallint,
  requested_target_player public.product_target_player,
  requested_specifications jsonb, requested_components jsonb,
  requested_pricing jsonb, requested_canonical_model_id uuid,
  requested_model_reference_status text
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  perform private.validate_product_model_reference(
    requested_brand_id, requested_category_id, requested_canonical_model_id,
    requested_model_reference_status
  );
  select updated.product_id, updated.variant_id into product_id, variant_id
  from public.update_priced_golf_product_with_base_variant(
    requested_product_id, expected_status, expected_published, requested_slug,
    requested_sku, requested_name, requested_short_description,
    requested_description, requested_condition, requested_condition_grade,
    requested_condition_notes, requested_brand_id, requested_category_id,
    requested_fulfillment_type, requested_price, requested_compare_at_price,
    requested_currency, requested_featured, requested_published,
    requested_price_is_estimate, requested_lead_time_min_days,
    requested_lead_time_max_days, requested_condition_score,
    requested_target_player, requested_specifications, requested_components,
    requested_pricing
  ) as updated;
  update public.products
  set canonical_model_id = requested_canonical_model_id,
      model_reference_status = requested_model_reference_status
  where id = product_id;
  return next;
end;
$$;

create or replace function public.update_golf_product_with_model_reference(
  requested_product_id uuid, expected_status public.product_status,
  expected_published boolean, requested_slug text, requested_sku text,
  requested_name text, requested_short_description text,
  requested_description text, requested_condition public.product_condition,
  requested_condition_grade public.product_condition_grade,
  requested_condition_notes text, requested_brand_id uuid,
  requested_category_id uuid, requested_fulfillment_type public.fulfillment_type,
  requested_price public.money_minor_units,
  requested_compare_at_price public.money_minor_units,
  requested_currency public.iso_currency_code, requested_featured boolean,
  requested_published boolean, requested_price_is_estimate boolean,
  requested_lead_time_min_days integer, requested_lead_time_max_days integer,
  requested_condition_score smallint,
  requested_target_player public.product_target_player,
  requested_specifications jsonb, requested_components jsonb,
  requested_canonical_model_id uuid, requested_model_reference_status text
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  perform private.validate_product_model_reference(
    requested_brand_id, requested_category_id, requested_canonical_model_id,
    requested_model_reference_status
  );
  select updated.product_id, updated.variant_id into product_id, variant_id
  from public.update_golf_product_with_base_variant(
    requested_product_id, expected_status, expected_published, requested_slug,
    requested_sku, requested_name, requested_short_description,
    requested_description, requested_condition, requested_condition_grade,
    requested_condition_notes, requested_brand_id, requested_category_id,
    requested_fulfillment_type, requested_price, requested_compare_at_price,
    requested_currency, requested_featured, requested_published,
    requested_price_is_estimate, requested_lead_time_min_days,
    requested_lead_time_max_days, requested_condition_score,
    requested_target_player, requested_specifications, requested_components
  ) as updated;
  update public.products
  set canonical_model_id = requested_canonical_model_id,
      model_reference_status = requested_model_reference_status
  where id = product_id;
  return next;
end;
$$;

revoke all on function public.create_priced_golf_product_with_model_reference(
  text,text,text,text,text,public.product_condition,
  public.product_condition_grade,text,uuid,uuid,public.fulfillment_type,
  public.money_minor_units,public.money_minor_units,public.iso_currency_code,
  boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,jsonb,uuid,text
) from public, anon;
grant execute on function public.create_priced_golf_product_with_model_reference(
  text,text,text,text,text,public.product_condition,
  public.product_condition_grade,text,uuid,uuid,public.fulfillment_type,
  public.money_minor_units,public.money_minor_units,public.iso_currency_code,
  boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,jsonb,uuid,text
) to authenticated;

revoke all on function public.update_priced_golf_product_with_model_reference(
  uuid,public.product_status,boolean,text,text,text,text,text,
  public.product_condition,public.product_condition_grade,text,uuid,uuid,
  public.fulfillment_type,public.money_minor_units,public.money_minor_units,
  public.iso_currency_code,boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,jsonb,uuid,text
) from public, anon;
grant execute on function public.update_priced_golf_product_with_model_reference(
  uuid,public.product_status,boolean,text,text,text,text,text,
  public.product_condition,public.product_condition_grade,text,uuid,uuid,
  public.fulfillment_type,public.money_minor_units,public.money_minor_units,
  public.iso_currency_code,boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,jsonb,uuid,text
) to authenticated;

revoke all on function public.update_golf_product_with_model_reference(
  uuid,public.product_status,boolean,text,text,text,text,text,
  public.product_condition,public.product_condition_grade,text,uuid,uuid,
  public.fulfillment_type,public.money_minor_units,public.money_minor_units,
  public.iso_currency_code,boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,uuid,text
) from public, anon;
grant execute on function public.update_golf_product_with_model_reference(
  uuid,public.product_status,boolean,text,text,text,text,text,
  public.product_condition,public.product_condition_grade,text,uuid,uuid,
  public.fulfillment_type,public.money_minor_units,public.money_minor_units,
  public.iso_currency_code,boolean,boolean,boolean,integer,integer,smallint,
  public.product_target_player,jsonb,jsonb,uuid,text
) to authenticated;
