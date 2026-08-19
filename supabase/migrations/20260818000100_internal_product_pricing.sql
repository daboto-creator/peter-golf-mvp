-- Internal Peter Golf pricing engine. Monetary values are integer MXN cents.
-- VAT/tax treatment is intentionally out of scope until the business defines
-- whether domain amounts are tax-inclusive or tax-exclusive.

create type public.acquisition_channel as enum ('purchase', 'trade_in');
create type public.market_price_confidence as enum (
  'high', 'medium', 'low', 'unavailable'
);
create type public.pricing_status as enum (
  'AUTO_COMPETITIVE',
  'ABOVE_MARKET_WARNING',
  'AUTO_MARKET_ADJUSTED_UP',
  'NO_MARKET_REFERENCE'
);
create type public.pricing_health as enum ('GREEN', 'YELLOW', 'RED');

create table public.pricing_rules (
  code text primary key,
  display_name text not null,
  target_return_bps integer not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pricing_rules_code_format check (code ~ '^[A-Z][A-Z0-9_]*$'),
  constraint pricing_rules_target_range check (
    target_return_bps between 0 and 9999
  )
);

create table public.payment_fee_configs (
  code text primary key,
  display_name text not null,
  percentage_bps integer not null,
  fixed_fee public.money_minor_units not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payment_fee_configs_code_format
    check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint payment_fee_configs_percentage_range
    check (percentage_bps between 0 and 9999)
);

create table public.category_pricing_profiles (
  category_id uuid primary key references public.categories (id) on delete cascade,
  new_rule_code text references public.pricing_rules (code) on delete restrict,
  used_rule_code text references public.pricing_rules (code) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_pricing_profiles_has_rule check (
    new_rule_code is not null or used_rule_code is not null
  )
);

create table public.market_price_researches (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products (id) on delete set null,
  brand_id uuid not null references public.brands (id) on delete restrict,
  category_id uuid not null references public.categories (id) on delete restrict,
  product_condition public.product_condition not null,
  input_fingerprint text not null,
  provider text not null,
  search_query text,
  input_snapshot jsonb not null,
  result_snapshot jsonb not null,
  median_price public.money_minor_units,
  average_price public.money_minor_units,
  low_price public.money_minor_units,
  high_price public.money_minor_units,
  sample_size integer not null default 0,
  confidence public.market_price_confidence not null default 'unavailable',
  excluded_count integer not null default 0,
  checked_at timestamptz not null,
  expires_at timestamptz not null,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint market_price_researches_fingerprint_format
    check (input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint market_price_researches_snapshots_object check (
    jsonb_typeof(input_snapshot) = 'object'
    and jsonb_typeof(result_snapshot) = 'object'
  ),
  constraint market_price_researches_sample_nonnegative
    check (sample_size >= 0 and excluded_count >= 0),
  constraint market_price_researches_expiry check (expires_at > checked_at),
  constraint market_price_researches_market_shape check (
    (
      median_price is null and average_price is null and low_price is null
      and high_price is null and sample_size = 0 and confidence = 'unavailable'
    ) or (
      median_price > 0 and average_price > 0 and sample_size > 0
      and confidence <> 'unavailable'
      and (low_price is null or low_price <= median_price)
      and (high_price is null or high_price >= median_price)
    )
  )
);

create table public.product_pricing (
  variant_id uuid primary key
    references public.product_variants (id) on delete cascade,
  product_id uuid not null unique
    references public.products (id) on delete cascade,
  acquisition_channel public.acquisition_channel not null default 'purchase',
  conditioning_cost public.money_minor_units not null default 0,
  packaging_cost public.money_minor_units not null default 0,
  shipping_subsidy public.money_minor_units not null default 0,
  pricing_rule_code text not null
    references public.pricing_rules (code) on delete restrict,
  payment_fee_config_code text not null
    references public.payment_fee_configs (code) on delete restrict,
  market_reference public.money_minor_units,
  market_average public.money_minor_units,
  market_low public.money_minor_units,
  market_high public.money_minor_units,
  market_sample_size integer not null default 0,
  market_confidence public.market_price_confidence not null default 'unavailable',
  market_source text,
  market_source_url text,
  market_checked_at timestamptz,
  market_provider text,
  market_research_id uuid
    references public.market_price_researches (id) on delete set null,
  financial_price public.money_minor_units not null,
  suggested_price public.money_minor_units not null,
  final_price public.money_minor_units not null,
  estimated_payment_fee public.money_minor_units not null,
  expected_contribution numeric(14, 0) not null,
  return_on_cost_bps integer not null,
  margin_on_sale_bps integer not null,
  market_delta_bps integer,
  status public.pricing_status not null,
  health public.pricing_health not null,
  manual_override boolean not null default false,
  manual_price_reason text,
  overridden_by uuid references auth.users (id) on delete set null,
  overridden_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint product_pricing_market_shape check (
    (
      market_reference is null
      and market_average is null
      and market_low is null
      and market_high is null
      and market_sample_size = 0
      and market_confidence = 'unavailable'
    ) or (
      market_reference is not null
      and market_reference > 0
      and (market_average is null or market_average > 0)
      and market_confidence <> 'unavailable'
      and (market_low is null or market_low <= market_reference)
      and (market_high is null or market_high >= market_reference)
      and (market_low is null or market_high is null or market_low <= market_high)
    )
  ),
  constraint product_pricing_sample_nonnegative check (market_sample_size >= 0),
  constraint product_pricing_source_length check (
    market_source is null or char_length(market_source) <= 240
  ),
  constraint product_pricing_reason_shape check (
    not manual_override or overridden_by is not null
  ),
  constraint product_pricing_version_positive check (version > 0)
);

create table public.pricing_calculations (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products (id) on delete cascade,
  variant_id uuid not null references public.product_variants (id) on delete cascade,
  pricing_rule_code text not null
    references public.pricing_rules (code) on delete restrict,
  final_price public.money_minor_units not null,
  status public.pricing_status not null,
  manual_override boolean not null,
  actor_id uuid references auth.users (id) on delete set null,
  snapshot jsonb not null,
  calculated_at timestamptz not null default now(),
  constraint pricing_calculations_snapshot_object
    check (jsonb_typeof(snapshot) = 'object')
);

create index product_pricing_rule_idx on public.product_pricing (pricing_rule_code);
create index product_pricing_status_idx on public.product_pricing (status, health);
create index product_pricing_market_checked_idx
  on public.product_pricing (market_checked_at)
  where market_reference is not null;
create index pricing_calculations_product_date_idx
  on public.pricing_calculations (product_id, calculated_at desc);
create index market_price_researches_cache_idx
  on public.market_price_researches (
    input_fingerprint, provider, expires_at desc
  );
create index market_price_researches_product_date_idx
  on public.market_price_researches (product_id, checked_at desc)
  where product_id is not null;

create trigger pricing_rules_set_updated_at before update on public.pricing_rules
for each row execute function public.set_updated_at();
create trigger payment_fee_configs_set_updated_at
before update on public.payment_fee_configs
for each row execute function public.set_updated_at();
create trigger category_pricing_profiles_set_updated_at
before update on public.category_pricing_profiles
for each row execute function public.set_updated_at();
create trigger product_pricing_set_updated_at
before update on public.product_pricing
for each row execute function public.set_updated_at();
create trigger pricing_calculations_are_immutable
before update on public.pricing_calculations
for each row execute function public.reject_immutable_row_change();

insert into public.pricing_rules (code, display_name, target_return_bps)
values
  ('DRIVER_NEW', 'Driver nuevo', 3000),
  ('FAIRWAY_WOOD_NEW', 'Fairway Wood nuevo', 3000),
  ('HYBRID_NEW', 'Hybrid nuevo', 3000),
  ('IRON_NEW', 'Hierro individual nuevo', 3000),
  ('IRON_SET_NEW', 'Set de hierros nuevo', 3000),
  ('WEDGE_NEW', 'Wedge nuevo', 3500),
  ('PUTTER_NEW', 'Putter nuevo', 3500),
  ('COMPLETE_SET_NEW', 'Set nuevo', 3000),
  ('CLUB_USED', 'Bastón seminuevo', 4000),
  ('IRON_SET_USED', 'Set de hierros seminuevo', 4000),
  ('PUTTER_USED', 'Putter seminuevo', 4000),
  ('COMPLETE_SET_USED', 'Set seminuevo', 4000),
  ('TRADE_IN', 'Trade-in', 5000),
  ('GOLF_BAG', 'Bolsa de golf', 4000),
  ('APPAREL', 'Ropa', 4500),
  ('SHOES', 'Calzado', 4000),
  ('BALLS', 'Pelotas', 2500),
  ('GLOVES', 'Guantes', 4000),
  ('GRIPS', 'Grips', 4500),
  ('ACCESSORY', 'Accesorio', 4500),
  ('SMALL_ACCESSORY', 'Accesorio pequeño', 6000),
  ('GPS_RANGEFINDER', 'GPS o rangefinder', 3000),
  ('TRAINING_GADGET', 'Dispositivo de entrenamiento', 4000),
  ('OTHER', 'Otro', 3500);

insert into public.payment_fee_configs (
  code, display_name, percentage_bps, fixed_fee
)
values ('stripe_domestic_mx', 'Stripe doméstico México', 360, 300);

insert into public.category_pricing_profiles (
  category_id, new_rule_code, used_rule_code
)
select categories.id,
  case categories.slug
    when 'driver' then 'DRIVER_NEW'
    when 'fairway-wood' then 'FAIRWAY_WOOD_NEW'
    when 'hybrid' then 'HYBRID_NEW'
    when 'iron' then 'IRON_NEW'
    when 'wedge' then 'WEDGE_NEW'
    when 'putter' then 'PUTTER_NEW'
    when 'iron-set' then 'IRON_SET_NEW'
    when 'complete-set' then 'COMPLETE_SET_NEW'
    when 'starter-set' then 'COMPLETE_SET_NEW'
    when 'junior-set' then 'COMPLETE_SET_NEW'
    when 'golf-bags' then 'GOLF_BAG'
    when 'cart-bag' then 'GOLF_BAG'
    when 'stand-bag' then 'GOLF_BAG'
    when 'tour-bag' then 'GOLF_BAG'
    when 'pencil-bag' then 'GOLF_BAG'
    when 'travel-bag' then 'GOLF_BAG'
    when 'bolsas-demo' then 'GOLF_BAG'
    when 'accesorios-demo' then 'ACCESSORY'
    else 'OTHER'
  end,
  case categories.slug
    when 'putter' then 'PUTTER_USED'
    when 'iron-set' then 'IRON_SET_USED'
    when 'complete-set' then 'COMPLETE_SET_USED'
    when 'starter-set' then 'COMPLETE_SET_USED'
    when 'junior-set' then 'COMPLETE_SET_USED'
    when 'golf-bags' then 'GOLF_BAG'
    when 'cart-bag' then 'GOLF_BAG'
    when 'stand-bag' then 'GOLF_BAG'
    when 'tour-bag' then 'GOLF_BAG'
    when 'pencil-bag' then 'GOLF_BAG'
    when 'travel-bag' then 'GOLF_BAG'
    when 'bolsas-demo' then 'GOLF_BAG'
    when 'accesorios-demo' then 'ACCESSORY'
    else 'CLUB_USED'
  end
from public.categories
where categories.slug in (
  'golf-clubs', 'driver', 'fairway-wood', 'hybrid', 'iron', 'wedge',
  'putter', 'golf-club-sets', 'complete-set', 'iron-set', 'starter-set',
  'junior-set', 'golf-bags', 'cart-bag', 'stand-bag', 'tour-bag',
  'pencil-bag', 'travel-bag', 'palos-demo', 'bolsas-demo',
  'accesorios-demo'
)
on conflict (category_id) do update set
  new_rule_code = excluded.new_rule_code,
  used_rule_code = excluded.used_rule_code;

create or replace function public.can_override_pricing_floor()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    inner join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid()) and roles.name = 'admin'
  );
$$;

revoke all on function public.can_override_pricing_floor() from public, anon;
grant execute on function public.can_override_pricing_floor() to authenticated;

create or replace function public.resolve_product_pricing_rule(
  requested_product_id uuid,
  requested_category_id uuid,
  requested_condition public.product_condition,
  requested_acquisition_channel public.acquisition_channel
)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  selected_rule text;
  selected_club_type public.golf_club_type;
  selected_set_type public.golf_set_type;
begin
  if requested_acquisition_channel = 'trade_in' then return 'TRADE_IN'; end if;
  select club_type into selected_club_type from public.product_club_specs
  where product_id = requested_product_id;
  if selected_club_type is not null then
    if requested_condition = 'used' then
      return case when selected_club_type = 'putter'
        then 'PUTTER_USED' else 'CLUB_USED' end;
    end if;
    return case selected_club_type
      when 'driver' then 'DRIVER_NEW'
      when 'fairway_wood' then 'FAIRWAY_WOOD_NEW'
      when 'hybrid' then 'HYBRID_NEW'
      when 'iron' then 'IRON_NEW'
      when 'wedge' then 'WEDGE_NEW'
      when 'putter' then 'PUTTER_NEW' end;
  end if;
  select set_type into selected_set_type from public.product_set_specs
  where product_id = requested_product_id;
  if selected_set_type is not null then
    if selected_set_type = 'iron_set' then
      return case when requested_condition = 'new'
        then 'IRON_SET_NEW' else 'IRON_SET_USED' end;
    end if;
    return case when requested_condition = 'new'
      then 'COMPLETE_SET_NEW' else 'COMPLETE_SET_USED' end;
  end if;
  if exists (select 1 from public.product_bag_specs
    where product_id = requested_product_id) then return 'GOLF_BAG'; end if;
  select case when requested_condition = 'new'
    then new_rule_code else used_rule_code end
  into selected_rule
  from public.category_pricing_profiles
  where category_id = requested_category_id;
  return coalesce(selected_rule, 'OTHER');
end;
$$;

revoke all on function public.resolve_product_pricing_rule(
  uuid, uuid, public.product_condition, public.acquisition_channel
) from public, anon, authenticated;

create or replace function public.round_up_commercial_price(
  requested_minimum public.money_minor_units,
  requested_market_upper public.money_minor_units default null
)
returns public.money_minor_units language plpgsql immutable set search_path = '' as $$
declare
  minimum_mxn numeric := ceil(requested_minimum / 100);
  block_mxn numeric;
  offset_mxn integer;
  candidate public.money_minor_units;
begin
  block_mxn := floor(minimum_mxn / 1000) * 1000;
  loop
    foreach offset_mxn in array array[99,199,299,399,490,499,599,699,799,890,899,990,999]
    loop
      candidate := (block_mxn + offset_mxn) * 100;
      if candidate >= requested_minimum then
        if requested_market_upper is not null
          and candidate > requested_market_upper
          and requested_minimum <= requested_market_upper
        then
          return requested_minimum;
        end if;
        return candidate;
      end if;
    end loop;
    block_mxn := block_mxn + 1000;
  end loop;
end;
$$;

revoke all on function public.round_up_commercial_price(
  public.money_minor_units, public.money_minor_units
) from public, anon, authenticated;

create or replace function public.calculate_product_pricing(
  requested_acquisition_cost public.money_minor_units,
  requested_conditioning_cost public.money_minor_units,
  requested_packaging_cost public.money_minor_units,
  requested_shipping_subsidy public.money_minor_units,
  requested_rule_code text,
  requested_market_reference public.money_minor_units,
  requested_market_low public.money_minor_units,
  requested_market_high public.money_minor_units,
  requested_market_sample_size integer,
  requested_market_confidence public.market_price_confidence,
  requested_final_price public.money_minor_units,
  requested_manual_reason text
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  selected_rule public.pricing_rules%rowtype;
  selected_fee public.payment_fee_configs%rowtype;
  direct_cost public.money_minor_units;
  desired_contribution public.money_minor_units;
  financial public.money_minor_units;
  market_lower public.money_minor_units;
  market_upper public.money_minor_units;
  minimum_competitive public.money_minor_units;
  suggested public.money_minor_units;
  final_price public.money_minor_units;
  fee public.money_minor_units;
  contribution numeric(14,0);
  roc integer;
  margin integer;
  delta integer;
  selected_status public.pricing_status;
  selected_health public.pricing_health;
  is_override boolean;
  normalized_reason text := nullif(btrim(requested_manual_reason), '');
begin
  if requested_acquisition_cost <= 0 then
    raise exception 'Acquisition cost must be greater than zero' using errcode = '22023';
  end if;
  if requested_market_sample_size < 0 then
    raise exception 'Market sample size is invalid' using errcode = '22023';
  end if;
  if (requested_market_reference is null and (
      requested_market_low is not null or requested_market_high is not null
      or requested_market_sample_size <> 0
      or requested_market_confidence <> 'unavailable'))
    or (requested_market_reference is not null and (
      requested_market_reference <= 0
      or requested_market_confidence = 'unavailable'
      or (requested_market_low is not null and requested_market_low > requested_market_reference)
      or (requested_market_high is not null and requested_market_high < requested_market_reference)
    ))
  then
    raise exception 'Market reference is invalid' using errcode = '22023';
  end if;

  select * into strict selected_rule from public.pricing_rules
  where code = requested_rule_code and active;
  select * into strict selected_fee from public.payment_fee_configs
  where code = 'stripe_domestic_mx' and active;

  direct_cost := requested_acquisition_cost + requested_conditioning_cost
    + requested_packaging_cost + requested_shipping_subsidy;
  desired_contribution := ceil(direct_cost * selected_rule.target_return_bps / 10000);
  financial := ceil((direct_cost * (10000 + selected_rule.target_return_bps)
    + selected_fee.fixed_fee * 10000) / (10000 - selected_fee.percentage_bps));

  if requested_market_reference is null
    or requested_market_confidence not in ('high', 'medium')
  then
    selected_status := 'NO_MARKET_REFERENCE';
    suggested := public.round_up_commercial_price(financial, null);
  else
    market_lower := ceil(requested_market_reference * 9000 / 10000);
    market_upper := floor(requested_market_reference * 11000 / 10000);
    if financial > market_upper then
      selected_status := 'ABOVE_MARKET_WARNING';
      suggested := public.round_up_commercial_price(financial, null);
    elsif financial < market_lower then
      selected_status := 'AUTO_MARKET_ADJUSTED_UP';
      minimum_competitive := greatest(financial, market_lower);
      suggested := public.round_up_commercial_price(minimum_competitive, market_upper);
    else
      selected_status := 'AUTO_COMPETITIVE';
      suggested := public.round_up_commercial_price(financial, market_upper);
    end if;
  end if;

  final_price := coalesce(requested_final_price, suggested);
  if final_price < direct_cost then
    raise exception 'Final price cannot be below direct cost' using errcode = '23514';
  end if;
  is_override := final_price <> suggested;
  if is_override and final_price < financial then
    if not public.can_override_pricing_floor() then
      raise exception 'Only admins can price below financial floor' using errcode = '42501';
    end if;
    if normalized_reason is null then
      raise exception 'Manual price reason is required below financial floor' using errcode = '22023';
    end if;
  end if;

  fee := ceil(final_price * selected_fee.percentage_bps / 10000)
    + selected_fee.fixed_fee;
  contribution := final_price - direct_cost - fee;
  roc := case when direct_cost = 0 then 0
    else trunc(contribution * 10000 / direct_cost)::integer end;
  margin := case when final_price = 0 then 0
    else trunc(contribution * 10000 / final_price)::integer end;
  delta := case when requested_market_reference is null then null
    else trunc((final_price - requested_market_reference) * 10000
      / requested_market_reference)::integer end;
  selected_health := case
    when roc >= selected_rule.target_return_bps then 'GREEN'
    when roc >= selected_rule.target_return_bps - 1000 then 'YELLOW'
    else 'RED' end;

  return jsonb_build_object(
    'totalDirectCost', direct_cost,
    'desiredContribution', desired_contribution,
    'targetReturnBps', selected_rule.target_return_bps,
    'paymentFeeConfigCode', selected_fee.code,
    'paymentFeePercentageBps', selected_fee.percentage_bps,
    'paymentFeeFixedMinor', selected_fee.fixed_fee,
    'financialPrice', financial,
    'marketLowerBound', market_lower,
    'marketUpperBound', market_upper,
    'minimumCompetitivePrice', minimum_competitive,
    'automaticSuggestedPrice', suggested,
    'finalSalePrice', final_price,
    'estimatedPaymentFee', fee,
    'expectedContribution', contribution,
    'returnOnCostBps', roc,
    'marginOnSaleBps', margin,
    'marketDeltaBps', delta,
    'status', selected_status,
    'health', selected_health,
    'override', is_override,
    'manualPriceReason', normalized_reason
  );
end;
$$;

revoke all on function public.calculate_product_pricing(
  public.money_minor_units, public.money_minor_units, public.money_minor_units,
  public.money_minor_units, text, public.money_minor_units,
  public.money_minor_units, public.money_minor_units, integer,
  public.market_price_confidence, public.money_minor_units, text
) from public, anon, authenticated;

create or replace function public.record_market_price_research(
  requested_product_id uuid,
  requested_brand_id uuid,
  requested_category_id uuid,
  requested_condition public.product_condition,
  requested_input_fingerprint text,
  requested_provider text,
  requested_search_query text,
  requested_input_snapshot jsonb,
  requested_result_snapshot jsonb,
  requested_median_price public.money_minor_units,
  requested_average_price public.money_minor_units,
  requested_low_price public.money_minor_units,
  requested_high_price public.money_minor_units,
  requested_sample_size integer,
  requested_confidence public.market_price_confidence,
  requested_excluded_count integer,
  requested_checked_at timestamptz,
  requested_expires_at timestamptz
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare research_id uuid;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;
  insert into public.market_price_researches (
    product_id, brand_id, category_id, product_condition,
    input_fingerprint, provider, search_query, input_snapshot,
    result_snapshot, median_price, average_price, low_price, high_price,
    sample_size, confidence, excluded_count, checked_at, expires_at, created_by
  ) values (
    requested_product_id, requested_brand_id, requested_category_id,
    requested_condition, requested_input_fingerprint, requested_provider,
    nullif(btrim(requested_search_query), ''), requested_input_snapshot,
    requested_result_snapshot, requested_median_price,
    requested_average_price, requested_low_price, requested_high_price,
    requested_sample_size, requested_confidence, requested_excluded_count,
    requested_checked_at, requested_expires_at, auth.uid()
  ) returning id into research_id;
  return research_id;
end;
$$;

revoke all on function public.record_market_price_research(
  uuid, uuid, uuid, public.product_condition, text, text, text, jsonb, jsonb,
  public.money_minor_units, public.money_minor_units, public.money_minor_units,
  public.money_minor_units, integer, public.market_price_confidence, integer,
  timestamptz, timestamptz
) from public, anon;
grant execute on function public.record_market_price_research(
  uuid, uuid, uuid, public.product_condition, text, text, text, jsonb, jsonb,
  public.money_minor_units, public.money_minor_units, public.money_minor_units,
  public.money_minor_units, integer, public.market_price_confidence, integer,
  timestamptz, timestamptz
) to authenticated;

create or replace function public.apply_product_pricing(
  requested_product_id uuid,
  requested_variant_id uuid,
  requested_category_id uuid,
  requested_condition public.product_condition,
  requested_final_price public.money_minor_units,
  requested_pricing jsonb
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  channel public.acquisition_channel := coalesce(
    nullif(requested_pricing->>'acquisitionChannel', '')::public.acquisition_channel,
    'purchase'
  );
  acquisition public.money_minor_units := nullif(requested_pricing->>'acquisitionCost', '')::numeric;
  conditioning public.money_minor_units := coalesce(nullif(requested_pricing->>'conditioningCost', '')::numeric, 0);
  packaging public.money_minor_units := coalesce(nullif(requested_pricing->>'packagingCost', '')::numeric, 0);
  shipping public.money_minor_units := coalesce(nullif(requested_pricing->>'shippingSubsidy', '')::numeric, 0);
  market_reference public.money_minor_units := nullif(requested_pricing->>'marketReference', '')::numeric;
  market_average public.money_minor_units := nullif(requested_pricing->>'marketAverage', '')::numeric;
  market_low public.money_minor_units := nullif(requested_pricing->>'marketLow', '')::numeric;
  market_high public.money_minor_units := nullif(requested_pricing->>'marketHigh', '')::numeric;
  market_sample integer := coalesce(nullif(requested_pricing->>'marketSampleSize', '')::integer, 0);
  market_confidence public.market_price_confidence := coalesce(
    nullif(requested_pricing->>'marketConfidence', '')::public.market_price_confidence,
    'unavailable'
  );
  market_source text := nullif(btrim(requested_pricing->>'marketSource'), '');
  market_source_url text := nullif(btrim(requested_pricing->>'marketSourceUrl'), '');
  research_id uuid := nullif(requested_pricing->>'marketResearchId', '')::uuid;
  research public.market_price_researches%rowtype;
  market_provider text;
  market_checked_at timestamptz;
  market_snapshot jsonb := '{}'::jsonb;
  manual_reason text := nullif(btrim(requested_pricing->>'manualPriceReason'), '');
  rule_code text;
  calculation jsonb;
  actor uuid := auth.uid();
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  if jsonb_typeof(requested_pricing) is distinct from 'object' then
    raise exception 'Pricing input is required' using errcode = '22023';
  end if;
  if research_id is not null then
    select researches.* into research
    from public.market_price_researches researches
    join public.products products on products.id = requested_product_id
    where researches.id = research_id
      and researches.brand_id = products.brand_id
      and researches.category_id = requested_category_id
      and researches.product_condition = requested_condition
      and (researches.product_id is null
        or researches.product_id = requested_product_id);
    if not found then
      raise exception 'Market research does not match product identity'
        using errcode = '22023';
    end if;
    market_reference := research.median_price;
    market_average := research.average_price;
    market_low := research.low_price;
    market_high := research.high_price;
    market_sample := research.sample_size;
    market_confidence := research.confidence;
    market_source := case when research.median_price is null then null
      else research.provider || ' · Google Shopping MX' end;
    market_source_url := null;
    market_provider := research.provider;
    market_checked_at := research.checked_at;
    market_snapshot := research.result_snapshot;
  else
    market_provider := case when market_reference is null then null else 'manual' end;
    market_checked_at := case when market_reference is null then null else now() end;
  end if;
  if market_reference is not null and market_source is null then
    raise exception 'Manual market source is required' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.product_variants
    where id = requested_variant_id and product_id = requested_product_id
  ) then
    raise exception 'Product variant does not belong to product' using errcode = '22023';
  end if;

  rule_code := public.resolve_product_pricing_rule(
    requested_product_id, requested_category_id, requested_condition, channel
  );
  calculation := public.calculate_product_pricing(
    acquisition, conditioning, packaging, shipping, rule_code,
    market_reference, market_low, market_high, market_sample,
    market_confidence, requested_final_price, manual_reason
  );

  if exists (
    select 1 from public.products
    where id = requested_product_id and compare_at_price is not null
      and compare_at_price < (calculation->>'finalSalePrice')::numeric
  ) then
    raise exception 'Compare-at price cannot be below final price' using errcode = '23514';
  end if;

  update public.product_variants set cost = acquisition
  where id = requested_variant_id;
  update public.products set price = (calculation->>'finalSalePrice')::numeric
  where id = requested_product_id;

  insert into public.product_pricing (
    variant_id, product_id, acquisition_channel, conditioning_cost,
    packaging_cost, shipping_subsidy, pricing_rule_code,
    payment_fee_config_code, market_reference, market_average,
    market_low, market_high,
    market_sample_size, market_confidence, market_source, market_source_url,
    market_checked_at, market_provider, market_research_id,
    financial_price, suggested_price, final_price,
    estimated_payment_fee, expected_contribution, return_on_cost_bps,
    margin_on_sale_bps, market_delta_bps, status, health, manual_override,
    manual_price_reason, overridden_by, overridden_at
  ) values (
    requested_variant_id, requested_product_id, channel, conditioning,
    packaging, shipping, rule_code,
    calculation->>'paymentFeeConfigCode', market_reference, market_average,
    market_low, market_high, market_sample, market_confidence, market_source,
    market_source_url, market_checked_at, market_provider, research_id,
    (calculation->>'financialPrice')::numeric,
    (calculation->>'automaticSuggestedPrice')::numeric,
    (calculation->>'finalSalePrice')::numeric,
    (calculation->>'estimatedPaymentFee')::numeric,
    (calculation->>'expectedContribution')::numeric,
    (calculation->>'returnOnCostBps')::integer,
    (calculation->>'marginOnSaleBps')::integer,
    nullif(calculation->>'marketDeltaBps', '')::integer,
    (calculation->>'status')::public.pricing_status,
    (calculation->>'health')::public.pricing_health,
    (calculation->>'override')::boolean, calculation->>'manualPriceReason',
    case when (calculation->>'override')::boolean then actor else null end,
    case when (calculation->>'override')::boolean then now() else null end
  ) on conflict (variant_id) do update set
    acquisition_channel = excluded.acquisition_channel,
    conditioning_cost = excluded.conditioning_cost,
    packaging_cost = excluded.packaging_cost,
    shipping_subsidy = excluded.shipping_subsidy,
    pricing_rule_code = excluded.pricing_rule_code,
    payment_fee_config_code = excluded.payment_fee_config_code,
    market_reference = excluded.market_reference,
    market_average = excluded.market_average,
    market_low = excluded.market_low,
    market_high = excluded.market_high,
    market_sample_size = excluded.market_sample_size,
    market_confidence = excluded.market_confidence,
    market_source = excluded.market_source,
    market_source_url = excluded.market_source_url,
    market_checked_at = excluded.market_checked_at,
    market_provider = excluded.market_provider,
    market_research_id = excluded.market_research_id,
    financial_price = excluded.financial_price,
    suggested_price = excluded.suggested_price,
    final_price = excluded.final_price,
    estimated_payment_fee = excluded.estimated_payment_fee,
    expected_contribution = excluded.expected_contribution,
    return_on_cost_bps = excluded.return_on_cost_bps,
    margin_on_sale_bps = excluded.margin_on_sale_bps,
    market_delta_bps = excluded.market_delta_bps,
    status = excluded.status,
    health = excluded.health,
    manual_override = excluded.manual_override,
    manual_price_reason = excluded.manual_price_reason,
    overridden_by = excluded.overridden_by,
    overridden_at = excluded.overridden_at,
    version = public.product_pricing.version + 1;

  insert into public.pricing_calculations (
    product_id, variant_id, pricing_rule_code, final_price, status,
    manual_override, actor_id, snapshot
  ) values (
    requested_product_id, requested_variant_id, rule_code,
    (calculation->>'finalSalePrice')::numeric,
    (calculation->>'status')::public.pricing_status,
    (calculation->>'override')::boolean, actor,
    calculation || jsonb_build_object(
      'acquisitionCost', acquisition,
      'conditioningCost', conditioning,
      'packagingCost', packaging,
      'shippingSubsidy', shipping,
      'acquisitionChannel', channel,
      'pricingRuleCode', rule_code,
      'market', jsonb_build_object(
        'reference', market_reference, 'average', market_average,
        'low', market_low, 'high', market_high,
        'sampleSize', market_sample, 'confidence', market_confidence,
        'source', market_source, 'sourceUrl', market_source_url,
        'provider', market_provider, 'researchId', research_id,
        'checkedAt', market_checked_at,
        'researchSnapshot', market_snapshot
      ),
      'taxTreatment', 'not_configured'
    )
  );
  return calculation;
end;
$$;

revoke all on function public.apply_product_pricing(
  uuid, uuid, uuid, public.product_condition, public.money_minor_units, jsonb
) from public, anon, authenticated;

create or replace function public.create_priced_golf_product_with_base_variant(
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
  requested_pricing jsonb
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  select created.product_id, created.variant_id into product_id, variant_id
  from public.create_golf_product_with_base_variant(
    requested_slug, requested_sku, requested_name, requested_short_description,
    requested_description, requested_condition, requested_condition_grade,
    requested_condition_notes, requested_brand_id, requested_category_id,
    requested_fulfillment_type, requested_price, requested_compare_at_price,
    requested_currency, requested_featured, requested_published,
    requested_price_is_estimate, requested_lead_time_min_days,
    requested_lead_time_max_days, requested_condition_score,
    requested_target_player, requested_specifications, requested_components
  ) as created;
  perform public.apply_product_pricing(
    product_id, variant_id, requested_category_id, requested_condition,
    requested_price, requested_pricing
  );
  return next;
end;
$$;

create or replace function public.update_priced_golf_product_with_base_variant(
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
  requested_pricing jsonb
)
returns table (product_id uuid, variant_id uuid)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;

  -- The legacy golf wrapper updates the base condition before syncing golf
  -- details. Clear a legacy used score first when moving back to new so the
  -- existing products_new_condition_has_no_score constraint remains valid
  -- throughout this same transaction.
  if requested_condition = 'new' then
    perform set_config('peter_golf.golf_specs_rpc_write', 'enabled', true);
    update public.products
    set condition_score = null
    where id = requested_product_id and condition_score is not null;
  end if;

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
  perform public.apply_product_pricing(
    product_id, variant_id, requested_category_id, requested_condition,
    requested_price, requested_pricing
  );
  return next;
end;
$$;

revoke all on function public.create_priced_golf_product_with_base_variant(
  text, text, text, text, text, public.product_condition,
  public.product_condition_grade, text, uuid, uuid, public.fulfillment_type,
  public.money_minor_units, public.money_minor_units, public.iso_currency_code,
  boolean, boolean, boolean, integer, integer, smallint,
  public.product_target_player, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.create_priced_golf_product_with_base_variant(
  text, text, text, text, text, public.product_condition,
  public.product_condition_grade, text, uuid, uuid, public.fulfillment_type,
  public.money_minor_units, public.money_minor_units, public.iso_currency_code,
  boolean, boolean, boolean, integer, integer, smallint,
  public.product_target_player, jsonb, jsonb, jsonb
) to authenticated;

revoke all on function public.update_priced_golf_product_with_base_variant(
  uuid, public.product_status, boolean, text, text, text, text, text,
  public.product_condition, public.product_condition_grade, text, uuid, uuid,
  public.fulfillment_type, public.money_minor_units, public.money_minor_units,
  public.iso_currency_code, boolean, boolean, boolean, integer, integer,
  smallint, public.product_target_player, jsonb, jsonb, jsonb
) from public, anon;
grant execute on function public.update_priced_golf_product_with_base_variant(
  uuid, public.product_status, boolean, text, text, text, text, text,
  public.product_condition, public.product_condition_grade, text, uuid, uuid,
  public.fulfillment_type, public.money_minor_units, public.money_minor_units,
  public.iso_currency_code, boolean, boolean, boolean, integer, integer,
  smallint, public.product_target_player, jsonb, jsonb, jsonb
) to authenticated;

create or replace function public.get_product_pricing_private(
  requested_product_id uuid
)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare result jsonb;
begin
  if not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'variantId', variants.id,
    'acquisitionCost', variants.cost,
    'acquisitionChannel', pricing.acquisition_channel,
    'conditioningCost', pricing.conditioning_cost,
    'packagingCost', pricing.packaging_cost,
    'shippingSubsidy', pricing.shipping_subsidy,
    'pricingRuleCode', pricing.pricing_rule_code,
    'marketReference', pricing.market_reference,
    'marketAverage', pricing.market_average,
    'marketLow', pricing.market_low,
    'marketHigh', pricing.market_high,
    'marketSampleSize', pricing.market_sample_size,
    'marketConfidence', pricing.market_confidence,
    'marketSource', pricing.market_source,
    'marketSourceUrl', pricing.market_source_url,
    'marketCheckedAt', pricing.market_checked_at,
    'marketProvider', pricing.market_provider,
    'marketResearchId', pricing.market_research_id,
    'financialPrice', pricing.financial_price,
    'suggestedPrice', pricing.suggested_price,
    'finalPrice', pricing.final_price,
    'estimatedPaymentFee', pricing.estimated_payment_fee,
    'expectedContribution', pricing.expected_contribution,
    'returnOnCostBps', pricing.return_on_cost_bps,
    'marginOnSaleBps', pricing.margin_on_sale_bps,
    'marketDeltaBps', pricing.market_delta_bps,
    'status', pricing.status,
    'health', pricing.health,
    'manualOverride', pricing.manual_override,
    'manualPriceReason', pricing.manual_price_reason,
    'version', pricing.version
  ) into result
  from public.product_variants variants
  left join public.product_pricing pricing on pricing.variant_id = variants.id
  where variants.product_id = requested_product_id
    and variants.active and variants.archived_at is null
  order by variants.sort_order, variants.id limit 1;
  return result;
end;
$$;

revoke all on function public.get_product_pricing_private(uuid) from public, anon;
grant execute on function public.get_product_pricing_private(uuid) to authenticated;

alter table public.pricing_rules enable row level security;
alter table public.payment_fee_configs enable row level security;
alter table public.category_pricing_profiles enable row level security;
alter table public.market_price_researches enable row level security;
alter table public.product_pricing enable row level security;
alter table public.pricing_calculations enable row level security;

create policy "catalog staff can read pricing rules" on public.pricing_rules
for select to authenticated using ((select public.can_manage_catalog()));
create policy "catalog staff can read payment fee configs"
on public.payment_fee_configs for select to authenticated
using ((select public.can_manage_catalog()));
create policy "catalog staff can read category pricing profiles"
on public.category_pricing_profiles for select to authenticated
using ((select public.can_manage_catalog()));
create policy "catalog staff can read market price researches"
on public.market_price_researches for select to authenticated
using ((select public.can_manage_catalog()));
create policy "catalog staff can read product pricing"
on public.product_pricing for select to authenticated
using ((select public.can_manage_catalog()));
create policy "catalog staff can read pricing calculations"
on public.pricing_calculations for select to authenticated
using ((select public.can_manage_catalog()));

revoke all on public.pricing_rules, public.payment_fee_configs,
  public.category_pricing_profiles, public.market_price_researches,
  public.product_pricing,
  public.pricing_calculations from public, anon, authenticated;
grant select on public.pricing_rules, public.payment_fee_configs,
  public.category_pricing_profiles, public.market_price_researches,
  public.product_pricing,
  public.pricing_calculations to authenticated;

comment on table public.product_pricing is
  'Private current pricing state. Acquisition cost remains sourced from product_variants.cost.';
comment on table public.pricing_calculations is
  'Private immutable-style calculation snapshots for pricing audit history.';
comment on table public.market_price_researches is
  'Private short-lived market research cache and source snapshot. Never exposed publicly.';
comment on function public.round_up_commercial_price(
  public.money_minor_units, public.money_minor_units
) is 'Selects the next Peter Golf commercial ending. If no ending fits below the optional market ceiling, returns the exact protected minimum.';
