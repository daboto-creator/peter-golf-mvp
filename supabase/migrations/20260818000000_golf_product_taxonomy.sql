-- Structured golf product taxonomy and specifications.
-- Existing products remain valid: specialized details are required only for
-- categories explicitly registered in category_spec_profiles.

create type public.golf_product_family as enum ('club', 'bag', 'set');
create type public.golf_club_type as enum (
  'driver', 'fairway_wood', 'hybrid', 'iron', 'wedge', 'putter'
);
create type public.golf_bag_type as enum (
  'cart_bag', 'stand_bag', 'tour_bag', 'pencil_bag', 'travel_bag'
);
create type public.golf_set_type as enum (
  'complete_set', 'iron_set', 'starter_set', 'junior_set'
);
create type public.golfer_handedness as enum ('right', 'left');
create type public.golf_shaft_material as enum ('graphite', 'steel', 'other');
create type public.golf_shaft_flex as enum (
  'ladies', 'senior', 'regular', 'stiff', 'x_stiff', 'other'
);
create type public.golf_putter_head_type as enum ('blade', 'mallet');
create type public.product_target_player as enum (
  'men', 'women', 'junior', 'unisex'
);
create type public.product_component_kind as enum ('club', 'bag');

alter table public.products
  add column condition_score smallint,
  add column target_player public.product_target_player,
  add constraint products_condition_score_range
    check (condition_score is null or condition_score between 1 and 10),
  add constraint products_new_condition_has_no_score
    check (condition = 'used' or condition_score is null);

create table public.category_spec_profiles (
  category_id uuid primary key
    references public.categories (id) on delete restrict,
  family public.golf_product_family not null,
  club_type public.golf_club_type,
  bag_type public.golf_bag_type,
  set_type public.golf_set_type,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_spec_profiles_family_shape check (
    (family = 'club' and bag_type is null and set_type is null)
    or (family = 'bag' and club_type is null and set_type is null)
    or (family = 'set' and club_type is null and bag_type is null)
  )
);

create table public.product_club_specs (
  product_id uuid primary key
    references public.products (id) on delete cascade,
  club_type public.golf_club_type not null,
  model text,
  model_year smallint,
  handedness public.golfer_handedness,
  shaft_material public.golf_shaft_material,
  shaft_brand text,
  shaft_model text,
  shaft_flex public.golf_shaft_flex,
  shaft_weight_grams numeric(6, 1),
  club_length_inches numeric(5, 2),
  grip_brand text,
  grip_model text,
  grip_condition text,
  headcover_included boolean,
  notes text,
  loft_degrees numeric(5, 2),
  adjustable_loft boolean,
  adjustable_hosel boolean,
  adjustment_tool_included boolean,
  club_number text,
  iron_number text,
  bounce_degrees numeric(5, 2),
  grind text,
  putter_head_type public.golf_putter_head_type,
  length_inches numeric(5, 2),
  lie_degrees numeric(5, 2),
  neck_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_club_specs_year_range
    check (model_year is null or model_year between 1900 and 2200),
  constraint product_club_specs_positive_measurements check (
    (shaft_weight_grams is null or shaft_weight_grams > 0)
    and (club_length_inches is null or club_length_inches > 0)
    and (length_inches is null or length_inches > 0)
  ),
  constraint product_club_specs_nonnegative_angles check (
    (loft_degrees is null or loft_degrees >= 0)
    and (bounce_degrees is null or bounce_degrees >= 0)
    and (lie_degrees is null or lie_degrees >= 0)
  ),
  constraint product_club_specs_driver_fields check (
    club_type = 'driver'
    or (adjustable_loft is null and adjustment_tool_included is null)
  ),
  constraint product_club_specs_adjustable_hosel_scope check (
    club_type in ('driver', 'fairway_wood', 'hybrid')
    or adjustable_hosel is null
  ),
  constraint product_club_specs_wood_hybrid_fields check (
    club_type in ('fairway_wood', 'hybrid') or club_number is null
  ),
  constraint product_club_specs_iron_fields check (
    club_type = 'iron' or iron_number is null
  ),
  constraint product_club_specs_wedge_fields check (
    club_type = 'wedge' or (bounce_degrees is null and grind is null)
  ),
  constraint product_club_specs_putter_fields check (
    club_type = 'putter'
    or (
      putter_head_type is null and length_inches is null
      and lie_degrees is null and neck_type is null
    )
  )
);

create table public.product_bag_specs (
  product_id uuid primary key
    references public.products (id) on delete cascade,
  bag_type public.golf_bag_type not null,
  model text,
  model_year smallint,
  color text,
  divider_count smallint,
  pocket_count smallint,
  weight_kg numeric(6, 2),
  rain_hood_included boolean,
  strap_included boolean,
  waterproof boolean,
  cart_compatible boolean,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_bag_specs_year_range
    check (model_year is null or model_year between 1900 and 2200),
  constraint product_bag_specs_nonnegative_counts check (
    (divider_count is null or divider_count >= 0)
    and (pocket_count is null or pocket_count >= 0)
  ),
  constraint product_bag_specs_positive_weight
    check (weight_kg is null or weight_kg > 0)
);

create table public.product_set_specs (
  product_id uuid primary key
    references public.products (id) on delete cascade,
  set_type public.golf_set_type not null,
  model text,
  model_year smallint,
  handedness public.golfer_handedness,
  shaft_material public.golf_shaft_material,
  shaft_flex public.golf_shaft_flex,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_set_specs_year_range
    check (model_year is null or model_year between 1900 and 2200)
);

create table public.product_components (
  id uuid primary key default gen_random_uuid(),
  set_product_id uuid not null
    references public.products (id) on delete cascade,
  sort_order integer not null default 0,
  quantity smallint not null default 1,
  component_kind public.product_component_kind not null,
  club_type public.golf_club_type,
  bag_type public.golf_bag_type,
  component_number text,
  loft_degrees numeric(5, 2),
  handedness public.golfer_handedness,
  shaft_flex public.golf_shaft_flex,
  shaft_material public.golf_shaft_material,
  brand text,
  model text,
  condition public.product_condition,
  condition_grade public.product_condition_grade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_components_quantity_positive check (quantity > 0),
  constraint product_components_sort_order_nonnegative check (sort_order >= 0),
  constraint product_components_kind_shape check (
    (
      component_kind = 'club' and club_type is not null and bag_type is null
    ) or (
      component_kind = 'bag' and bag_type is not null and club_type is null
      and component_number is null and loft_degrees is null
      and shaft_flex is null and shaft_material is null
    )
  ),
  constraint product_components_condition_shape check (
    condition <> 'new' or condition_grade is null
  ),
  unique (set_product_id, sort_order)
);

create index products_condition_score_idx
  on public.products (condition, condition_grade, condition_score);
create index products_target_player_idx on public.products (target_player);
create index product_club_specs_filter_idx
  on public.product_club_specs
  (club_type, handedness, shaft_flex, shaft_material, loft_degrees);
create index product_bag_specs_filter_idx
  on public.product_bag_specs (bag_type, color);
create index product_set_specs_filter_idx
  on public.product_set_specs (set_type, handedness, shaft_flex);
create index product_components_set_product_id_idx
  on public.product_components (set_product_id);
create index product_components_club_filter_idx
  on public.product_components (club_type, handedness, shaft_flex)
  where component_kind = 'club';
create index product_components_bag_filter_idx
  on public.product_components (bag_type)
  where component_kind = 'bag';

create trigger category_spec_profiles_set_updated_at
before update on public.category_spec_profiles
for each row execute function public.set_updated_at();
create trigger product_club_specs_set_updated_at
before update on public.product_club_specs
for each row execute function public.set_updated_at();
create trigger product_bag_specs_set_updated_at
before update on public.product_bag_specs
for each row execute function public.set_updated_at();
create trigger product_set_specs_set_updated_at
before update on public.product_set_specs
for each row execute function public.set_updated_at();
create trigger product_components_set_updated_at
before update on public.product_components
for each row execute function public.set_updated_at();

-- Validate the final transaction state so product + specialized rows can be
-- replaced atomically without transient constraint failures.
create or replace function public.validate_product_golf_details()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_product_id uuid;
  selected_profile public.category_spec_profiles%rowtype;
  selected_club_type public.golf_club_type;
  selected_bag_type public.golf_bag_type;
  selected_set_type public.golf_set_type;
  club_count integer;
  bag_count integer;
  set_count integer;
  component_count integer;
  profile_found boolean;
begin
  if tg_table_name = 'products' then
    selected_product_id := case when tg_op = 'DELETE' then old.id else new.id end;
  elsif tg_table_name = 'product_components' then
    selected_product_id := case
      when tg_op = 'DELETE' then old.set_product_id else new.set_product_id
    end;
  else
    selected_product_id := case
      when tg_op = 'DELETE' then old.product_id else new.product_id
    end;
  end if;

  if not exists (
    select 1 from public.products where products.id = selected_product_id
  ) then
    return null;
  end if;

  select category_spec_profiles.* into selected_profile
  from public.products
  inner join public.category_spec_profiles
    on category_spec_profiles.category_id = products.category_id
  where products.id = selected_product_id;
  profile_found := found;

  select count(*) into club_count
  from public.product_club_specs where product_id = selected_product_id;
  select club_type into selected_club_type
  from public.product_club_specs where product_id = selected_product_id;
  select count(*) into bag_count
  from public.product_bag_specs where product_id = selected_product_id;
  select bag_type into selected_bag_type
  from public.product_bag_specs where product_id = selected_product_id;
  select count(*) into set_count
  from public.product_set_specs where product_id = selected_product_id;
  select set_type into selected_set_type
  from public.product_set_specs where product_id = selected_product_id;
  select count(*) into component_count
  from public.product_components where set_product_id = selected_product_id;

  if not profile_found then
    if club_count + bag_count + set_count + component_count <> 0 then
      raise exception 'Unprofiled categories cannot store golf specifications'
        using errcode = '23514';
    end if;
    return null;
  end if;

  if selected_profile.family = 'club' then
    if club_count <> 1 or bag_count <> 0 or set_count <> 0
      or component_count <> 0
      or (
        selected_profile.club_type is not null
        and selected_club_type is distinct from selected_profile.club_type
      )
    then
      raise exception 'Golf club category requires matching club specifications'
        using errcode = '23514';
    end if;
  elsif selected_profile.family = 'bag' then
    if bag_count <> 1 or club_count <> 0 or set_count <> 0
      or component_count <> 0
      or (
        selected_profile.bag_type is not null
        and selected_bag_type is distinct from selected_profile.bag_type
      )
    then
      raise exception 'Golf bag category requires matching bag specifications'
        using errcode = '23514';
    end if;
  else
    if set_count <> 1 or club_count <> 0 or bag_count <> 0
      or component_count = 0
      or (
        selected_profile.set_type is not null
        and selected_set_type is distinct from selected_profile.set_type
      )
    then
      raise exception 'Golf set category requires matching set specifications and components'
        using errcode = '23514';
    end if;
  end if;

  return null;
end;
$$;

create constraint trigger products_validate_golf_details
after insert or update of category_id on public.products
deferrable initially deferred
for each row execute function public.validate_product_golf_details();
create constraint trigger product_club_specs_validate_golf_details
after insert or update or delete on public.product_club_specs
deferrable initially deferred
for each row execute function public.validate_product_golf_details();
create constraint trigger product_bag_specs_validate_golf_details
after insert or update or delete on public.product_bag_specs
deferrable initially deferred
for each row execute function public.validate_product_golf_details();
create constraint trigger product_set_specs_validate_golf_details
after insert or update or delete on public.product_set_specs
deferrable initially deferred
for each row execute function public.validate_product_golf_details();
create constraint trigger product_components_validate_golf_details
after insert or update or delete on public.product_components
deferrable initially deferred
for each row execute function public.validate_product_golf_details();

revoke all on function public.validate_product_golf_details()
from public, anon, authenticated;

-- Add canonical golf taxonomy without changing or removing existing records.
insert into public.categories (slug, name, description, sort_order)
values
  ('golf-clubs', 'Golf Clubs', 'Bastones de golf individuales.', 100),
  ('golf-club-sets', 'Golf Club Sets', 'Sets estructurados de equipo de golf.', 110),
  ('golf-bags', 'Golf Bags', 'Bolsas de golf.', 120)
on conflict (slug) do nothing;

insert into public.categories (parent_id, slug, name, sort_order)
values
  ((select id from public.categories where slug = 'golf-clubs'), 'driver', 'Driver', 10),
  ((select id from public.categories where slug = 'golf-clubs'), 'fairway-wood', 'Fairway Wood', 20),
  ((select id from public.categories where slug = 'golf-clubs'), 'hybrid', 'Hybrid', 30),
  ((select id from public.categories where slug = 'golf-clubs'), 'iron', 'Iron', 40),
  ((select id from public.categories where slug = 'golf-clubs'), 'wedge', 'Wedge', 50),
  ((select id from public.categories where slug = 'golf-clubs'), 'putter', 'Putter', 60),
  ((select id from public.categories where slug = 'golf-club-sets'), 'complete-set', 'Complete Set', 10),
  ((select id from public.categories where slug = 'golf-club-sets'), 'iron-set', 'Iron Set', 20),
  ((select id from public.categories where slug = 'golf-club-sets'), 'starter-set', 'Starter Set', 30),
  ((select id from public.categories where slug = 'golf-club-sets'), 'junior-set', 'Junior Set', 40),
  ((select id from public.categories where slug = 'golf-bags'), 'cart-bag', 'Cart Bag', 10),
  ((select id from public.categories where slug = 'golf-bags'), 'stand-bag', 'Stand Bag', 20),
  ((select id from public.categories where slug = 'golf-bags'), 'tour-bag', 'Tour Bag', 30),
  ((select id from public.categories where slug = 'golf-bags'), 'pencil-bag', 'Pencil Bag', 40),
  ((select id from public.categories where slug = 'golf-bags'), 'travel-bag', 'Travel Bag', 50)
on conflict (slug) do nothing;

do $$
begin
  if exists (
    select 1 from public.categories
    where slug in ('golf-clubs', 'golf-club-sets', 'golf-bags')
      and parent_id is not null
  ) or exists (
    select 1
    from public.categories child
    where child.slug in (
      'driver', 'fairway-wood', 'hybrid', 'iron', 'wedge', 'putter'
    )
      and child.parent_id is distinct from (
        select id from public.categories where slug = 'golf-clubs'
      )
  ) or exists (
    select 1
    from public.categories child
    where child.slug in (
      'complete-set', 'iron-set', 'starter-set', 'junior-set'
    )
      and child.parent_id is distinct from (
        select id from public.categories where slug = 'golf-club-sets'
      )
  ) or exists (
    select 1
    from public.categories child
    where child.slug in (
      'cart-bag', 'stand-bag', 'tour-bag', 'pencil-bag', 'travel-bag'
    )
      and child.parent_id is distinct from (
        select id from public.categories where slug = 'golf-bags'
      )
  ) then
    raise exception 'Canonical golf category slugs conflict with an existing hierarchy'
      using errcode = '23514';
  end if;
end;
$$;

insert into public.category_spec_profiles (
  category_id, family, club_type, bag_type, set_type
)
select id, 'club'::public.golf_product_family,
  null::public.golf_club_type, null::public.golf_bag_type,
  null::public.golf_set_type
from public.categories where slug = 'golf-clubs'
union all
select id, 'set'::public.golf_product_family, null::public.golf_club_type,
  null::public.golf_bag_type, null::public.golf_set_type
from public.categories where slug = 'golf-club-sets'
union all
select id, 'bag'::public.golf_product_family, null::public.golf_club_type,
  null::public.golf_bag_type, null::public.golf_set_type
from public.categories where slug = 'golf-bags'
union all
select id, 'club'::public.golf_product_family,
  slug::public.golf_club_type, null::public.golf_bag_type,
  null::public.golf_set_type
from public.categories where slug in ('driver', 'hybrid', 'iron', 'wedge', 'putter')
union all
select id, 'club'::public.golf_product_family,
  'fairway_wood'::public.golf_club_type, null::public.golf_bag_type,
  null::public.golf_set_type
from public.categories where slug = 'fairway-wood'
union all
select id, 'set'::public.golf_product_family, null::public.golf_club_type,
  null::public.golf_bag_type,
  replace(slug, '-', '_')::public.golf_set_type
from public.categories where slug in ('complete-set', 'iron-set', 'starter-set', 'junior-set')
union all
select id, 'bag'::public.golf_product_family, null::public.golf_club_type,
  replace(slug, '-', '_')::public.golf_bag_type, null::public.golf_set_type
from public.categories where slug in ('cart-bag', 'stand-bag', 'tour-bag', 'pencil-bag', 'travel-bag')
on conflict (category_id) do nothing;

alter table public.category_spec_profiles enable row level security;
alter table public.product_club_specs enable row level security;
alter table public.product_bag_specs enable row level security;
alter table public.product_set_specs enable row level security;
alter table public.product_components enable row level security;

create policy "public can read relevant category spec profiles"
on public.category_spec_profiles for select to anon, authenticated
using (
  exists (
    select 1 from public.categories
    where categories.id = category_spec_profiles.category_id
      and categories.status = 'active'
      and exists (
        select 1 from public.products
        where products.category_id = categories.id
          and products.status = 'active' and products.published
          and products.archived_at is null
      )
  )
);
create policy "catalog staff can read category spec profiles"
on public.category_spec_profiles for select to authenticated
using (public.can_manage_catalog());

create policy "public can read published club specs"
on public.product_club_specs for select to anon, authenticated
using (
  exists (select 1 from public.products where products.id = product_id
    and products.status = 'active' and products.published
    and products.archived_at is null)
);
create policy "catalog staff can read all club specs"
on public.product_club_specs for select to authenticated
using (public.can_manage_catalog());
create policy "public can read published bag specs"
on public.product_bag_specs for select to anon, authenticated
using (
  exists (select 1 from public.products where products.id = product_id
    and products.status = 'active' and products.published
    and products.archived_at is null)
);
create policy "catalog staff can read all bag specs"
on public.product_bag_specs for select to authenticated
using (public.can_manage_catalog());
create policy "public can read published set specs"
on public.product_set_specs for select to anon, authenticated
using (
  exists (select 1 from public.products where products.id = product_id
    and products.status = 'active' and products.published
    and products.archived_at is null)
);
create policy "catalog staff can read all set specs"
on public.product_set_specs for select to authenticated
using (public.can_manage_catalog());
create policy "public can read published set components"
on public.product_components for select to anon, authenticated
using (
  exists (select 1 from public.products where products.id = set_product_id
    and products.status = 'active' and products.published
    and products.archived_at is null)
);
create policy "catalog staff can read all set components"
on public.product_components for select to authenticated
using (public.can_manage_catalog());

create policy "catalog rpc can write club specs"
on public.product_club_specs for all to authenticated
using (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled')
with check (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled');
create policy "catalog rpc can write bag specs"
on public.product_bag_specs for all to authenticated
using (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled')
with check (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled');
create policy "catalog rpc can write set specs"
on public.product_set_specs for all to authenticated
using (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled')
with check (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled');
create policy "catalog rpc can write set components"
on public.product_components for all to authenticated
using (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled')
with check (public.can_manage_catalog() and current_setting('peter_golf.golf_specs_rpc_write', true) = 'enabled');

revoke all on public.category_spec_profiles, public.product_club_specs,
  public.product_bag_specs, public.product_set_specs, public.product_components
from anon, authenticated;
grant select on public.category_spec_profiles, public.product_club_specs,
  public.product_bag_specs, public.product_set_specs, public.product_components
to anon, authenticated;
grant insert, update, delete on public.product_club_specs,
  public.product_bag_specs, public.product_set_specs, public.product_components
to authenticated;
grant select (condition_score, target_player) on public.products
to anon, authenticated;
grant update (condition_score, target_player) on public.products
to authenticated;

create or replace function public.sync_product_golf_details(
  requested_product_id uuid,
  requested_condition_score smallint,
  requested_target_player public.product_target_player,
  requested_specifications jsonb,
  requested_components jsonb default '[]'::jsonb
)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_family public.golf_product_family;
  component jsonb;
  component_index integer := 0;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;

  if jsonb_typeof(coalesce(requested_components, '[]'::jsonb)) <> 'array' then
    raise exception 'Product components must be an array' using errcode = '22023';
  end if;

  select category_spec_profiles.family into selected_family
  from public.products
  left join public.category_spec_profiles
    on category_spec_profiles.category_id = products.category_id
  where products.id = requested_product_id;

  if not found then
    raise exception 'Product is not available' using errcode = '22023';
  end if;

  if selected_family is null and requested_specifications is not null then
    raise exception 'Selected category does not accept golf specifications'
      using errcode = '22023';
  elsif selected_family is not null
    and jsonb_typeof(requested_specifications) is distinct from 'object'
  then
    raise exception 'Selected category requires golf specifications'
      using errcode = '22023';
  end if;

  perform set_config('peter_golf.golf_specs_rpc_write', 'enabled', true);

  update public.products set
    condition_score = requested_condition_score,
    target_player = requested_target_player
  where id = requested_product_id;

  delete from public.product_components where set_product_id = requested_product_id;
  delete from public.product_club_specs where product_id = requested_product_id;
  delete from public.product_bag_specs where product_id = requested_product_id;
  delete from public.product_set_specs where product_id = requested_product_id;

  if selected_family = 'club' then
    insert into public.product_club_specs (
      product_id, club_type, model, model_year, handedness, shaft_material,
      shaft_brand, shaft_model, shaft_flex, shaft_weight_grams,
      club_length_inches, grip_brand, grip_model, grip_condition,
      headcover_included, notes, loft_degrees, adjustable_loft,
      adjustable_hosel, adjustment_tool_included, club_number, iron_number,
      bounce_degrees, grind, putter_head_type, length_inches, lie_degrees,
      neck_type
    ) values (
      requested_product_id,
      (requested_specifications->>'clubType')::public.golf_club_type,
      nullif(requested_specifications->>'model', ''),
      nullif(requested_specifications->>'modelYear', '')::smallint,
      nullif(requested_specifications->>'handedness', '')::public.golfer_handedness,
      nullif(requested_specifications->>'shaftMaterial', '')::public.golf_shaft_material,
      nullif(requested_specifications->>'shaftBrand', ''),
      nullif(requested_specifications->>'shaftModel', ''),
      nullif(requested_specifications->>'shaftFlex', '')::public.golf_shaft_flex,
      nullif(requested_specifications->>'shaftWeightGrams', '')::numeric,
      nullif(requested_specifications->>'clubLengthInches', '')::numeric,
      nullif(requested_specifications->>'gripBrand', ''),
      nullif(requested_specifications->>'gripModel', ''),
      nullif(requested_specifications->>'gripCondition', ''),
      nullif(requested_specifications->>'headcoverIncluded', '')::boolean,
      nullif(requested_specifications->>'notes', ''),
      nullif(requested_specifications->>'loftDegrees', '')::numeric,
      nullif(requested_specifications->>'adjustableLoft', '')::boolean,
      nullif(requested_specifications->>'adjustableHosel', '')::boolean,
      nullif(requested_specifications->>'adjustmentToolIncluded', '')::boolean,
      nullif(requested_specifications->>'clubNumber', ''),
      nullif(requested_specifications->>'ironNumber', ''),
      nullif(requested_specifications->>'bounceDegrees', '')::numeric,
      nullif(requested_specifications->>'grind', ''),
      nullif(requested_specifications->>'putterHeadType', '')::public.golf_putter_head_type,
      nullif(requested_specifications->>'lengthInches', '')::numeric,
      nullif(requested_specifications->>'lieDegrees', '')::numeric,
      nullif(requested_specifications->>'neckType', '')
    );
  elsif selected_family = 'bag' then
    insert into public.product_bag_specs (
      product_id, bag_type, model, model_year, color, divider_count,
      pocket_count, weight_kg, rain_hood_included, strap_included,
      waterproof, cart_compatible, notes
    ) values (
      requested_product_id,
      (requested_specifications->>'bagType')::public.golf_bag_type,
      nullif(requested_specifications->>'model', ''),
      nullif(requested_specifications->>'modelYear', '')::smallint,
      nullif(requested_specifications->>'color', ''),
      nullif(requested_specifications->>'dividerCount', '')::smallint,
      nullif(requested_specifications->>'pocketCount', '')::smallint,
      nullif(requested_specifications->>'weightKg', '')::numeric,
      nullif(requested_specifications->>'rainHoodIncluded', '')::boolean,
      nullif(requested_specifications->>'strapIncluded', '')::boolean,
      nullif(requested_specifications->>'waterproof', '')::boolean,
      nullif(requested_specifications->>'cartCompatible', '')::boolean,
      nullif(requested_specifications->>'notes', '')
    );
  elsif selected_family = 'set' then
    insert into public.product_set_specs (
      product_id, set_type, model, model_year, handedness,
      shaft_material, shaft_flex, notes
    ) values (
      requested_product_id,
      (requested_specifications->>'setType')::public.golf_set_type,
      nullif(requested_specifications->>'model', ''),
      nullif(requested_specifications->>'modelYear', '')::smallint,
      nullif(requested_specifications->>'handedness', '')::public.golfer_handedness,
      nullif(requested_specifications->>'shaftMaterial', '')::public.golf_shaft_material,
      nullif(requested_specifications->>'shaftFlex', '')::public.golf_shaft_flex,
      nullif(requested_specifications->>'notes', '')
    );

    for component in select value from jsonb_array_elements(requested_components)
    loop
      insert into public.product_components (
        set_product_id, sort_order, quantity, component_kind, club_type,
        bag_type, component_number, loft_degrees, handedness, shaft_flex,
        shaft_material, brand, model, condition, condition_grade
      ) values (
        requested_product_id, component_index,
        coalesce(nullif(component->>'quantity', '')::smallint, 1),
        (component->>'componentKind')::public.product_component_kind,
        nullif(component->>'clubType', '')::public.golf_club_type,
        nullif(component->>'bagType', '')::public.golf_bag_type,
        nullif(component->>'componentNumber', ''),
        nullif(component->>'loftDegrees', '')::numeric,
        nullif(component->>'handedness', '')::public.golfer_handedness,
        nullif(component->>'shaftFlex', '')::public.golf_shaft_flex,
        nullif(component->>'shaftMaterial', '')::public.golf_shaft_material,
        nullif(component->>'brand', ''), nullif(component->>'model', ''),
        nullif(component->>'condition', '')::public.product_condition,
        nullif(component->>'conditionGrade', '')::public.product_condition_grade
      );
      component_index := component_index + 1;
    end loop;
  end if;

  perform set_config('peter_golf.golf_specs_rpc_write', 'disabled', true);
end;
$$;

revoke all on function public.sync_product_golf_details(
  uuid, smallint, public.product_target_player, jsonb, jsonb
) from public, anon;
grant execute on function public.sync_product_golf_details(
  uuid, smallint, public.product_target_player, jsonb, jsonb
) to authenticated;

create or replace function public.create_golf_product_with_base_variant(
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
  requested_specifications jsonb, requested_components jsonb default '[]'::jsonb
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security invoker set search_path = ''
as $$
begin
  select created.product_id, created.variant_id
  into product_id, variant_id
  from public.create_product_with_base_variant(
    requested_slug, requested_sku, requested_name,
    requested_short_description, requested_description, requested_condition,
    requested_condition_grade, requested_condition_notes, requested_brand_id,
    requested_category_id, requested_fulfillment_type, requested_price,
    requested_compare_at_price, requested_currency, requested_featured,
    requested_published, requested_price_is_estimate,
    requested_lead_time_min_days, requested_lead_time_max_days
  ) as created;
  perform public.sync_product_golf_details(
    product_id, requested_condition_score, requested_target_player,
    requested_specifications, requested_components
  );
  return next;
end;
$$;

create or replace function public.update_golf_product_with_base_variant(
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
  requested_specifications jsonb, requested_components jsonb default '[]'::jsonb
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security invoker set search_path = ''
as $$
begin
  select updated.product_id, updated.variant_id
  into product_id, variant_id
  from public.update_product_with_base_variant(
    requested_product_id, expected_status, expected_published,
    requested_slug, requested_sku, requested_name,
    requested_short_description, requested_description, requested_condition,
    requested_condition_grade, requested_condition_notes, requested_brand_id,
    requested_category_id, requested_fulfillment_type, requested_price,
    requested_compare_at_price, requested_currency, requested_featured,
    requested_published, requested_price_is_estimate,
    requested_lead_time_min_days, requested_lead_time_max_days
  ) as updated;
  perform public.sync_product_golf_details(
    product_id, requested_condition_score, requested_target_player,
    requested_specifications, requested_components
  );
  return next;
end;
$$;

revoke all on function public.create_golf_product_with_base_variant(
  text, text, text, text, text, public.product_condition,
  public.product_condition_grade, text, uuid, uuid, public.fulfillment_type,
  public.money_minor_units, public.money_minor_units, public.iso_currency_code,
  boolean, boolean, boolean, integer, integer, smallint,
  public.product_target_player, jsonb, jsonb
) from public, anon;
grant execute on function public.create_golf_product_with_base_variant(
  text, text, text, text, text, public.product_condition,
  public.product_condition_grade, text, uuid, uuid, public.fulfillment_type,
  public.money_minor_units, public.money_minor_units, public.iso_currency_code,
  boolean, boolean, boolean, integer, integer, smallint,
  public.product_target_player, jsonb, jsonb
) to authenticated;

revoke all on function public.update_golf_product_with_base_variant(
  uuid, public.product_status, boolean, text, text, text, text, text,
  public.product_condition, public.product_condition_grade, text, uuid, uuid,
  public.fulfillment_type, public.money_minor_units, public.money_minor_units,
  public.iso_currency_code, boolean, boolean, boolean, integer, integer,
  smallint, public.product_target_player, jsonb, jsonb
) from public, anon;
grant execute on function public.update_golf_product_with_base_variant(
  uuid, public.product_status, boolean, text, text, text, text, text,
  public.product_condition, public.product_condition_grade, text, uuid, uuid,
  public.fulfillment_type, public.money_minor_units, public.money_minor_units,
  public.iso_currency_code, boolean, boolean, boolean, integer, integer,
  smallint, public.product_target_player, jsonb, jsonb
) to authenticated;
