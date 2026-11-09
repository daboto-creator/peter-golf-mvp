-- Narrow public projection for Best Round Pro and catalog availability.
-- It exposes only currently sellable commercial data, never inventory IDs,
-- costs, reserved quantities, supplier data, or margin.
create or replace function public.get_public_first_party_sellable_inventory()
returns table (
  product_id uuid,
  slug text,
  name text,
  brand_name text,
  model_name text,
  category_name text,
  product_family text,
  club_type text,
  set_type text,
  condition public.product_condition,
  price public.money_minor_units,
  currency public.iso_currency_code,
  available_quantity integer,
  technical_specs jsonb
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    product.id,
    product.slug,
    product.name,
    brand.name,
    coalesce(model.model_name, club.model, set_specs.model, product.name),
    category.name,
    profile.family::text,
    profile.club_type::text,
    profile.set_type::text,
    product.condition,
    product.price,
    product.currency,
    stock.available_quantity,
    jsonb_strip_nulls(jsonb_build_object(
      'handedness', coalesce(club.handedness::text, set_specs.handedness::text),
      'loftDegrees', club.loft_degrees,
      'shaftFlex', coalesce(club.shaft_flex::text, set_specs.shaft_flex::text),
      'shaftMaterial', coalesce(club.shaft_material::text, set_specs.shaft_material::text),
      'shaftWeightGrams', club.shaft_weight_grams,
      'adjustableLoft', club.adjustable_loft,
      'adjustableHosel', club.adjustable_hosel,
      'setMakeup', variant_attributes.set_makeup,
      'bounceDegrees', club.bounce_degrees,
      'grind', club.grind,
      'putterHeadType', club.putter_head_type::text,
      'lengthInches', club.length_inches,
      'lieDegrees', club.lie_degrees,
      'clubLengthInches', club.club_length_inches
    ))
  from public.products product
  join lateral (
    select sum(inventory.quantity_on_hand - inventory.quantity_reserved)::integer
      as available_quantity
    from public.product_variants sellable_variant
    join public.inventory inventory
      on inventory.variant_id = sellable_variant.id
    where sellable_variant.product_id = product.id
      and sellable_variant.active
      and sellable_variant.archived_at is null
      and coalesce(sellable_variant.price, product.price) > 0
      and inventory.quantity_on_hand > inventory.quantity_reserved
  ) stock on stock.available_quantity > 0
  left join lateral (
    select sellable_variant.attributes->'setMakeup' as set_makeup
    from public.product_variants sellable_variant
    join public.inventory inventory
      on inventory.variant_id = sellable_variant.id
    where sellable_variant.product_id = product.id
      and sellable_variant.active
      and sellable_variant.archived_at is null
      and coalesce(sellable_variant.price, product.price) > 0
      and inventory.quantity_on_hand > inventory.quantity_reserved
    order by sellable_variant.sort_order, sellable_variant.id
    limit 1
  ) variant_attributes on true
  join public.categories category on category.id = product.category_id
  left join public.category_spec_profiles profile
    on profile.category_id = category.id
  join public.brands brand on brand.id = product.brand_id
  left join public.catalog_product_models model on model.id = product.canonical_model_id
  left join public.product_club_specs club on club.product_id = product.id
  left join public.product_set_specs set_specs on set_specs.product_id = product.id
  where product.status = 'active'
    and product.published
    and product.archived_at is null
    and product.price > 0
  order by product.id
  limit 500;
$$;

revoke all on function public.get_public_first_party_sellable_inventory()
  from public, anon, authenticated;
grant execute on function public.get_public_first_party_sellable_inventory()
  to anon, authenticated;

comment on function public.get_public_first_party_sellable_inventory() is
  'Sanitized public sellable First Party projection for catalog availability and Best Round Pro; exposes public product facts and available quantity only.';
