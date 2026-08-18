-- Structured golf product creation, editing, compatibility and filtering.
-- Run after `npm run supabase:reset`.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values (
  '19000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'golf-products.operator@example.test', '{}'::jsonb, '{}'::jsonb,
  now(), now()
);
insert into public.user_roles (user_id, role_id)
select '19000000-0000-4000-8000-000000000001', id
from public.roles where name = 'operator';

select set_config(
  'request.jwt.claim.sub',
  '19000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

create or replace function pg_temp.create_golf_test_product(
  product_slug text,
  category_slug text,
  specifications jsonb,
  components jsonb default '[]'::jsonb,
  product_condition public.product_condition default 'new',
  product_grade public.product_condition_grade default null,
  product_score smallint default null
) returns uuid
language plpgsql
as $$
declare
  created_id uuid;
begin
  select product_id into created_id
  from public.create_golf_product_with_base_variant(
    product_slug,
    upper(replace(product_slug, '-', '_')),
    initcap(replace(product_slug, '-', ' ')),
    null, null, product_condition, product_grade,
    case when product_condition = 'used' then 'Condición de prueba' else null end,
    (select id from public.brands where slug = 'marca-demo-norte'),
    (select id from public.categories where slug = category_slug),
    'in_stock', 10000, null, 'MXN', false, false, false, null, null,
    product_score, 'unisex', specifications, components
  );
  return created_id;
end;
$$;

create or replace function pg_temp.update_golf_test_product(
  product_slug text,
  category_slug text,
  specifications jsonb,
  components jsonb default '[]'::jsonb
) returns void
language plpgsql
as $$
declare
  current_id uuid;
  current_sku text;
  current_name text;
  current_condition public.product_condition;
  current_grade public.product_condition_grade;
  current_notes text;
  current_score smallint;
  current_target public.product_target_player;
begin
  select id, sku, name, condition, condition_grade, condition_notes,
    condition_score, target_player
  into strict current_id, current_sku, current_name, current_condition,
    current_grade, current_notes, current_score, current_target
  from public.products where slug = product_slug;

  perform public.update_golf_product_with_base_variant(
    current_id, 'draft', false, product_slug, current_sku,
    current_name || ' editado', null, null, current_condition,
    current_grade, current_notes,
    (select id from public.brands where slug = 'marca-demo-norte'),
    (select id from public.categories where slug = category_slug),
    'in_stock', 12500, null, 'MXN', false, false, false, null, null,
    current_score, current_target, specifications, components
  );
end;
$$;

select pg_temp.create_golf_test_product(
  'driver-estructurado-test', 'driver',
  '{"clubType":"driver","model":"D1","modelYear":2026,"handedness":"right","shaftMaterial":"graphite","shaftFlex":"regular","loftDegrees":10.5,"adjustableLoft":true,"adjustableHosel":true,"adjustmentToolIncluded":true}'::jsonb,
  '[]'::jsonb, 'used', 'like_new', 9::smallint
);
select pg_temp.create_golf_test_product(
  'wedge-estructurado-test', 'wedge',
  '{"clubType":"wedge","loftDegrees":56,"bounceDegrees":12,"grind":"M"}'::jsonb
);
select pg_temp.create_golf_test_product(
  'putter-estructurado-test', 'putter',
  '{"clubType":"putter","putterHeadType":"mallet","lengthInches":34,"loftDegrees":3,"lieDegrees":70,"neckType":"slant","headcoverIncluded":true}'::jsonb
);
select pg_temp.create_golf_test_product(
  'stand-bag-estructurada-test', 'stand-bag',
  '{"bagType":"stand_bag","model":"Carry","color":"Negro","dividerCount":4,"pocketCount":7,"weightKg":2.2,"rainHoodIncluded":true,"strapIncluded":true,"waterproof":false,"cartCompatible":true}'::jsonb
);
select pg_temp.create_golf_test_product(
  'complete-set-estructurado-test', 'complete-set',
  '{"setType":"complete_set","model":"Starter Pro","handedness":"right","shaftMaterial":"graphite","shaftFlex":"regular"}'::jsonb,
  '[
    {"componentKind":"club","clubType":"driver","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"graphite","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"6-PW","quantity":5,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"putter","quantity":1,"handedness":"right","condition":"new"},
    {"componentKind":"bag","bagType":"stand_bag","quantity":1,"condition":"new"}
  ]'::jsonb
);

select pg_temp.update_golf_test_product(
  'driver-estructurado-test', 'driver',
  '{"clubType":"driver","model":"D2","modelYear":2025,"handedness":"right","shaftMaterial":"graphite","shaftBrand":"Mitsubishi","shaftModel":"Tensei 1K Blue","shaftFlex":"regular","shaftWeightGrams":65,"clubLengthInches":45.5,"gripBrand":"Golf Pride","gripModel":"Tour Velvet","gripCondition":"Excelente","headcoverIncluded":true,"notes":"Driver editado","loftDegrees":9,"adjustableLoft":true,"adjustableHosel":true,"adjustmentToolIncluded":false}'::jsonb
);
select pg_temp.update_golf_test_product(
  'wedge-estructurado-test', 'wedge',
  '{"clubType":"wedge","model":"W2","modelYear":2025,"handedness":"right","shaftMaterial":"steel","shaftFlex":"stiff","loftDegrees":58,"bounceDegrees":10,"grind":"S"}'::jsonb
);
select pg_temp.update_golf_test_product(
  'putter-estructurado-test', 'putter',
  '{"clubType":"putter","model":"P2","modelYear":2025,"handedness":"right","shaftMaterial":"steel","putterHeadType":"blade","lengthInches":35,"loftDegrees":4,"lieDegrees":71,"neckType":"plumber","headcoverIncluded":false}'::jsonb
);
select pg_temp.update_golf_test_product(
  'stand-bag-estructurada-test', 'stand-bag',
  '{"bagType":"stand_bag","model":"Carry 2","modelYear":2025,"color":"Azul","dividerCount":5,"pocketCount":8,"weightKg":2.4,"rainHoodIncluded":true,"strapIncluded":true,"waterproof":true,"cartCompatible":false,"notes":"Bolsa editada"}'::jsonb
);
select pg_temp.update_golf_test_product(
  'complete-set-estructurado-test', 'complete-set',
  '{"setType":"complete_set","model":"Starter Pro 2","modelYear":2025,"handedness":"right","shaftMaterial":"graphite","shaftFlex":"regular","notes":"Set editado"}'::jsonb,
  '[
    {"componentKind":"club","clubType":"driver","loftDegrees":10.5,"quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"graphite","brand":"Peter Golf","model":"D1","condition":"new"},
    {"componentKind":"club","clubType":"fairway_wood","componentNumber":"3W","loftDegrees":15,"quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"graphite","condition":"new"},
    {"componentKind":"club","clubType":"hybrid","componentNumber":"4H","loftDegrees":25,"quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"graphite","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"6","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"7","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"8","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"9","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"PW","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"iron","componentNumber":"SW","quantity":1,"handedness":"right","shaftFlex":"regular","shaftMaterial":"steel","condition":"new"},
    {"componentKind":"club","clubType":"putter","componentNumber":"34 in","quantity":1,"handedness":"right","condition":"new"},
    {"componentKind":"bag","bagType":"stand_bag","quantity":1,"brand":"Peter Golf","model":"Carry","condition":"new"}
  ]'::jsonb
);

select pg_temp.create_golf_test_product(
  'category-change-cleanup-test', 'driver',
  '{"clubType":"driver","loftDegrees":10.5,"shaftFlex":"regular"}'::jsonb
);
select pg_temp.update_golf_test_product(
  'category-change-cleanup-test', 'stand-bag',
  '{"bagType":"stand_bag","color":"Negro"}'::jsonb
);
set constraints all immediate;
do $$
declare selected_id uuid;
begin
  select id into strict selected_id from public.products
  where slug = 'category-change-cleanup-test';
  if exists (select 1 from public.product_club_specs where product_id = selected_id)
    or not exists (select 1 from public.product_bag_specs where product_id = selected_id and bag_type = 'stand_bag')
  then raise exception 'Club to bag change left incompatible specifications'; end if;
end;
$$;
set constraints all deferred;
select pg_temp.update_golf_test_product(
  'category-change-cleanup-test', 'complete-set',
  '{"setType":"complete_set","handedness":"right"}'::jsonb,
  '[{"componentKind":"club","clubType":"putter","quantity":1}]'::jsonb
);

reset role;
set constraints all immediate;

do $$
declare
  set_id uuid;
begin
  if not exists (
    select 1 from public.product_club_specs
    inner join public.products on products.id = product_club_specs.product_id
    where products.slug = 'driver-estructurado-test'
      and club_type = 'driver' and handedness = 'right'
      and shaft_flex = 'regular' and loft_degrees = 9
      and shaft_brand = 'Mitsubishi' and shaft_model = 'Tensei 1K Blue'
      and shaft_weight_grams = 65 and grip_brand = 'Golf Pride'
  ) then raise exception 'Driver specifications were not persisted'; end if;

  if not exists (
    select 1 from public.products
    where slug = 'driver-estructurado-test'
      and condition = 'used' and condition_grade = 'like_new'
      and condition_score = 9 and target_player = 'unisex'
  ) then raise exception 'Normalized condition or target player was not persisted'; end if;

  if not exists (
    select 1 from public.product_club_specs
    inner join public.products on products.id = product_club_specs.product_id
    where products.slug = 'wedge-estructurado-test'
      and loft_degrees = 58 and bounce_degrees = 10 and grind = 'S'
  ) then raise exception 'Wedge edit was not persisted'; end if;

  if not exists (
    select 1 from public.product_club_specs
    inner join public.products on products.id = product_club_specs.product_id
    where products.slug = 'putter-estructurado-test'
      and putter_head_type = 'blade' and length_inches = 35
      and lie_degrees = 71 and neck_type = 'plumber'
  ) then raise exception 'Putter specifications were not persisted'; end if;

  if not exists (
    select 1 from public.product_bag_specs
    inner join public.products on products.id = product_bag_specs.product_id
    where products.slug = 'stand-bag-estructurada-test'
      and bag_type = 'stand_bag' and color = 'Azul'
      and divider_count = 5 and pocket_count = 8 and waterproof
  ) then raise exception 'Stand Bag specifications were not persisted'; end if;

  select id into strict set_id
  from public.products where slug = 'complete-set-estructurado-test';
  if (select count(*) from public.product_components where set_product_id = set_id) <> 11
    or not exists (select 1 from public.product_components where set_product_id = set_id and club_type = 'driver')
    or not exists (select 1 from public.product_components where set_product_id = set_id and club_type = 'putter')
    or not exists (select 1 from public.product_components where set_product_id = set_id and bag_type = 'stand_bag')
    or (select count(*) from public.product_components where set_product_id = set_id and club_type = 'iron' and component_number in ('6', '7', '8', '9', 'PW', 'SW')) <> 6
  then raise exception 'Complete Set components are not queryable'; end if;

  if (select count(*) from public.product_variants where product_id = set_id) <> 1
    or exists (
      select 1 from public.inventory
      inner join public.product_variants
        on product_variants.id = inventory.variant_id
      where product_variants.product_id = set_id
    )
  then raise exception 'Set components created sellable variants or inventory'; end if;

  if exists (
    select 1 from public.product_bag_specs
    where product_id = (select id from public.products where slug = 'category-change-cleanup-test')
  ) or not exists (
    select 1 from public.product_set_specs
    where product_id = (select id from public.products where slug = 'category-change-cleanup-test')
  ) then raise exception 'Bag to set change left incompatible specifications'; end if;

  if not exists (
    select 1 from public.products where slug = 'putter-seminuevo-demo'
  ) or exists (
    select 1 from public.product_club_specs
    where product_id = (select id from public.products where slug = 'putter-seminuevo-demo')
  ) then raise exception 'Existing products lost backward compatibility'; end if;

  if (select count(*) from public.categories where slug in (
    'golf-clubs', 'golf-club-sets', 'golf-bags', 'driver', 'fairway-wood',
    'hybrid', 'iron', 'wedge', 'putter', 'complete-set', 'iron-set',
    'starter-set', 'junior-set', 'cart-bag', 'stand-bag', 'tour-bag',
    'pencil-bag', 'travel-bag'
  )) <> 18 or exists (
    select 1 from public.categories child
    join public.categories parent on parent.id = child.parent_id
    where (child.slug in ('driver', 'fairway-wood', 'hybrid', 'iron', 'wedge', 'putter') and parent.slug <> 'golf-clubs')
       or (child.slug in ('complete-set', 'iron-set', 'starter-set', 'junior-set') and parent.slug <> 'golf-club-sets')
       or (child.slug in ('cart-bag', 'stand-bag', 'tour-bag', 'pencil-bag', 'travel-bag') and parent.slug <> 'golf-bags')
  ) then raise exception 'Canonical golf taxonomy is duplicated or malformed'; end if;
end;
$$;

select 'golf product taxonomy checks passed' as result;
rollback;
