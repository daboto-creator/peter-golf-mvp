create or replace function public.get_best_round_first_party_inventory()
returns table (
  product_id uuid,
  unit_id uuid,
  canonical_model_id uuid,
  category_name text,
  match_category text,
  brand_name text,
  model_name text,
  condition public.product_condition,
  price public.money_minor_units,
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
    variant.id,
    product.canonical_model_id,
    category.name,
    case
      when profile.set_type = 'iron_set' then 'IRON'
      else upper(profile.club_type::text)
    end,
    brand.name,
    coalesce(model.model_name, club.model, set_specs.model, product.name),
    product.condition,
    coalesce(variant.price, product.price),
    inventory.quantity_on_hand - inventory.quantity_reserved,
    jsonb_strip_nulls(jsonb_build_object(
      'handedness', coalesce(club.handedness::text, set_specs.handedness::text),
      'loftDegrees', club.loft_degrees,
      'shaftFlex', coalesce(club.shaft_flex::text, set_specs.shaft_flex::text),
      'shaftMaterial', coalesce(club.shaft_material::text, set_specs.shaft_material::text),
      'shaftWeightGrams', club.shaft_weight_grams,
      'adjustableLoft', club.adjustable_loft,
      'adjustableHosel', club.adjustable_hosel,
      'setMakeup', variant.attributes->'setMakeup',
      'bounceDegrees', club.bounce_degrees,
      'grind', club.grind,
      'putterHeadType', club.putter_head_type::text,
      'lengthInches', club.length_inches,
      'lieDegrees', club.lie_degrees,
      'clubLengthInches', club.club_length_inches
    ))
  from public.products product
  join public.product_variants variant
    on variant.product_id = product.id
    and variant.active
    and variant.archived_at is null
  join public.inventory inventory on inventory.variant_id = variant.id
  join public.categories category on category.id = product.category_id
  join public.category_spec_profiles profile
    on profile.category_id = category.id
    and (
      profile.club_type in ('driver', 'fairway_wood', 'hybrid', 'iron', 'wedge', 'putter')
      or profile.set_type = 'iron_set'
    )
  join public.brands brand on brand.id = product.brand_id
  left join public.catalog_product_models model on model.id = product.canonical_model_id
  left join public.product_club_specs club on club.product_id = product.id
  left join public.product_set_specs set_specs on set_specs.product_id = product.id
  where product.status = 'active'
    and product.published
    and product.archived_at is null
    and coalesce(variant.price, product.price) is not null
    and inventory.quantity_on_hand - inventory.quantity_reserved > 0
  order by product.id, variant.id
  limit 500;
$$;

revoke all on function public.get_best_round_first_party_inventory() from public, anon;
grant execute on function public.get_best_round_first_party_inventory() to authenticated;

comment on function public.get_best_round_first_party_inventory() is
  'Returns only authenticated, currently sellable first-party club units for Best Round recommendation ranking; never exposes cost or margin.';
