-- Internal pricing authority, permissions, audit and commercial price flow.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('1a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'pricing.operator@example.test', '{}', '{}', now(), now()),
  ('1a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'pricing.admin@example.test', '{}', '{}', now(), now()),
  ('1a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'pricing.customer@example.test', '{}', '{}', now(), now());
insert into public.user_roles (user_id, role_id)
select '1a000000-0000-4000-8000-000000000001'::uuid, id
from public.roles where name = 'operator'
union all
select '1a000000-0000-4000-8000-000000000002'::uuid, id
from public.roles where name = 'admin';

select set_config('request.jwt.claim.sub', '1a000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select * from public.create_priced_golf_product_with_base_variant(
  'pricing-driver-test', 'PRICING-DRIVER-001', 'Pricing Driver Test',
  'Driver de prueba', 'Producto ficticio para pricing', 'new', null, null,
  (select id from public.brands where slug = 'marca-demo-norte'),
  (select id from public.categories where slug = 'driver'),
  'in_stock', 1139900, null, 'MXN', false, false, false, null, null,
  null, 'unisex',
  '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
  '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0}'::jsonb
);

reset role;
do $$
declare selected_product record; selected_pricing record; selected_cost numeric;
begin
  select id, price, cost into strict selected_product
  from public.products where slug = 'pricing-driver-test';
  select product_pricing.* into strict selected_pricing
  from public.product_pricing where product_id = selected_product.id;
  select cost into strict selected_cost from public.product_variants
  where product_id = selected_product.id;

  if selected_product.price <> 1139900
    or selected_product.cost is not null
    or selected_cost <> 800000
    or selected_pricing.pricing_rule_code <> 'DRIVER_NEW'
    or selected_pricing.financial_price <> 1139835
    or selected_pricing.suggested_price <> 1139900
    or selected_pricing.status <> 'NO_MARKET_REFERENCE'
    or selected_pricing.return_on_cost_bps <> 3000
    or selected_pricing.health <> 'GREEN'
  then raise exception 'Automatic pricing was not persisted correctly'; end if;

  if (select count(*) from public.pricing_calculations
      where product_id = selected_product.id) <> 1
  then raise exception 'Pricing calculation was not audited'; end if;
end;
$$;

-- A server-recorded market snapshot is authoritative and remains auditable.
do $$
declare product_row record; research_id uuid;
begin
  select id, status, published, slug, sku, name, short_description,
    description, condition, condition_grade, condition_notes, brand_id,
    category_id, fulfillment_type, currency, featured, price_is_estimate,
    lead_time_min_days, lead_time_max_days, condition_score, target_player
  into strict product_row from public.products
  where slug = 'pricing-driver-test';

  research_id := public.record_market_price_research(
    product_row.id, product_row.brand_id, product_row.category_id,
    product_row.condition, repeat('a', 64), 'serpapi',
    'Titleist GT3 Driver 10.5 nuevo México',
    '{"brand":"Marca Demo Norte","model":"Driver de prueba","market":"MX"}'::jsonb,
    '{"provider":"serpapi","medianPriceMxn":1500000,"averagePriceMxn":1510000,"lowPriceMxn":1450000,"highPriceMxn":1570000,"sampleSize":3,"confidence":"high","checkedAt":"2026-08-18T15:00:00Z","sources":[]}'::jsonb,
    1500000, 1510000, 1450000, 1570000, 3, 'high', 1,
    '2026-08-18T15:00:00Z', '2026-08-18T15:15:00Z'
  );

  perform public.update_priced_golf_product_with_base_variant(
    product_row.id, product_row.status, product_row.published,
    product_row.slug, product_row.sku, product_row.name,
    product_row.short_description, product_row.description,
    product_row.condition, product_row.condition_grade, product_row.condition_notes,
    product_row.brand_id, product_row.category_id, product_row.fulfillment_type,
    1500000, null, product_row.currency, product_row.featured,
    product_row.published, product_row.price_is_estimate,
    product_row.lead_time_min_days, product_row.lead_time_max_days,
    product_row.condition_score, product_row.target_player,
    '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
    jsonb_build_object(
      'acquisitionChannel', 'purchase', 'acquisitionCost', 800000,
      'conditioningCost', 20000, 'packagingCost', 10000,
      'shippingSubsidy', 15000, 'marketResearchId', research_id,
      'manualPriceReason', 'Precio alineado a mercado'
    )
  );

  if not exists (
    select 1 from public.product_pricing
    where product_id = product_row.id
      and market_research_id = research_id
      and market_reference = 1500000
      and market_average = 1510000
      and market_provider = 'serpapi'
  ) then raise exception 'Market research was not applied authoritatively'; end if;

  if not exists (
    select 1 from public.pricing_calculations
    where product_id = product_row.id
      and snapshot #>> '{market,researchId}' = research_id::text
      and snapshot #>> '{market,researchSnapshot,provider}' = 'serpapi'
  ) then raise exception 'Market research snapshot was not audited'; end if;
end;
$$;

-- Operator may override above financial, but not below it.
select set_config('request.jwt.claim.sub', '1a000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
declare product_row record;
begin
  select id, status, published, slug, sku, name, short_description,
    description, condition, condition_grade, condition_notes, brand_id,
    category_id, fulfillment_type, currency, featured, price_is_estimate,
    lead_time_min_days, lead_time_max_days, condition_score, target_player
  into strict product_row from public.products
  where slug = 'pricing-driver-test';
  perform public.update_priced_golf_product_with_base_variant(
    product_row.id, product_row.status, product_row.published,
    product_row.slug, product_row.sku, product_row.name,
    product_row.short_description, product_row.description,
    'used'::public.product_condition,
    'excellent'::public.product_condition_grade,
    'Set seminuevo de prueba', product_row.brand_id,
    (select id from public.categories where slug = 'complete-set'),
    product_row.fulfillment_type, 1239900::public.money_minor_units, null,
    product_row.currency, product_row.featured, product_row.published,
    product_row.price_is_estimate, product_row.lead_time_min_days,
    product_row.lead_time_max_days, 9::smallint, product_row.target_player,
    '{"setType":"complete_set","handedness":"right"}'::jsonb,
    '[{"componentKind":"club","clubType":"driver","quantity":1}]'::jsonb,
    '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0}'::jsonb
  );
  if not exists (
    select 1 from public.product_pricing
    where product_id = product_row.id and pricing_rule_code = 'COMPLETE_SET_USED'
  ) then raise exception 'Category change did not recalculate pricing rule'; end if;

  perform public.update_priced_golf_product_with_base_variant(
    product_row.id, product_row.status, product_row.published,
    product_row.slug, product_row.sku, product_row.name,
    product_row.short_description, product_row.description,
    'new'::public.product_condition, null, null,
    product_row.brand_id, product_row.category_id, product_row.fulfillment_type,
    1200000, null, product_row.currency, product_row.featured,
    product_row.published, product_row.price_is_estimate,
    product_row.lead_time_min_days, product_row.lead_time_max_days,
    null, product_row.target_player,
    '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
    '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0,"manualPriceReason":"Precio acordado"}'::jsonb
  );
  begin
    perform public.update_priced_golf_product_with_base_variant(
      product_row.id, product_row.status, product_row.published,
      product_row.slug, product_row.sku, product_row.name,
      product_row.short_description, product_row.description,
      'new'::public.product_condition, null, null,
      product_row.brand_id, product_row.category_id, product_row.fulfillment_type,
      1100000, null, product_row.currency, product_row.featured,
      product_row.published, product_row.price_is_estimate,
      product_row.lead_time_min_days, product_row.lead_time_max_days,
      null, product_row.target_player,
      '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
      '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0}'::jsonb
    );
    raise exception 'Expected operator floor override to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub', '1a000000-0000-4000-8000-000000000002', true);
set local role authenticated;

-- Admin may go below financial with reason, never below direct cost.
do $$
declare product_row record;
begin
  select id, status, published, slug, sku, name, short_description,
    description, condition, condition_grade, condition_notes, brand_id,
    category_id, fulfillment_type, currency, featured, price_is_estimate,
    lead_time_min_days, lead_time_max_days, condition_score, target_player
  into strict product_row from public.products
  where slug = 'pricing-driver-test';
  perform public.update_priced_golf_product_with_base_variant(
    product_row.id, product_row.status, product_row.published,
    product_row.slug, product_row.sku, product_row.name,
    product_row.short_description, product_row.description,
    product_row.condition, product_row.condition_grade, product_row.condition_notes,
    product_row.brand_id, product_row.category_id, product_row.fulfillment_type,
    1100000, null, product_row.currency, product_row.featured,
    product_row.published, product_row.price_is_estimate,
    product_row.lead_time_min_days, product_row.lead_time_max_days,
    product_row.condition_score, product_row.target_player,
    '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
    '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0,"manualPriceReason":"Autorización administrativa"}'::jsonb
  );
  begin
    perform public.update_priced_golf_product_with_base_variant(
      product_row.id, product_row.status, product_row.published,
      product_row.slug, product_row.sku, product_row.name,
      product_row.short_description, product_row.description,
      product_row.condition, product_row.condition_grade, product_row.condition_notes,
      product_row.brand_id, product_row.category_id, product_row.fulfillment_type,
      844999, null, product_row.currency, product_row.featured,
      product_row.published, product_row.price_is_estimate,
      product_row.lead_time_min_days, product_row.lead_time_max_days,
      product_row.condition_score, product_row.target_player,
      '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
      '{"acquisitionChannel":"purchase","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0,"manualPriceReason":"No basta"}'::jsonb
    );
    raise exception 'Expected below-cost price to fail';
  exception when check_violation then null;
  end;
end;
$$;

-- Trade-in overrides the normal category rule.
do $$
declare product_row record;
begin
  select id, status, published, slug, sku, name, short_description,
    description, condition, condition_grade, condition_notes, brand_id,
    category_id, fulfillment_type, currency, featured, price_is_estimate,
    lead_time_min_days, lead_time_max_days, condition_score, target_player
  into strict product_row from public.products
  where slug = 'pricing-driver-test';
  perform public.update_priced_golf_product_with_base_variant(
    product_row.id, product_row.status, product_row.published,
    product_row.slug, product_row.sku, product_row.name,
    product_row.short_description, product_row.description,
    'used'::public.product_condition,
    'excellent'::public.product_condition_grade,
    'Trade-in de prueba', product_row.brand_id,
    product_row.category_id, product_row.fulfillment_type,
    1329900::public.money_minor_units, null,
    product_row.currency, product_row.featured, product_row.published,
    product_row.price_is_estimate, product_row.lead_time_min_days,
    product_row.lead_time_max_days, 9::smallint, product_row.target_player,
    '{"clubType":"driver","loftDegrees":10.5}'::jsonb, '[]'::jsonb,
    '{"acquisitionChannel":"trade_in","acquisitionCost":800000,"conditioningCost":20000,"packagingCost":10000,"shippingSubsidy":15000,"marketConfidence":"unavailable","marketSampleSize":0}'::jsonb
  );
  if not exists (
    select 1 from public.product_pricing
    where product_id = product_row.id and pricing_rule_code = 'TRADE_IN'
  ) then raise exception 'Trade-in did not override taxonomy rule'; end if;
end;
$$;

-- Customers cannot read internal tables/costs or invoke the private reader.
reset role;
select set_config('request.jwt.claim.sub', '1a000000-0000-4000-8000-000000000003', true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.product_pricing) <> 0
    or (select count(*) from public.pricing_calculations) <> 0
    or (select count(*) from public.market_price_researches) <> 0
  then raise exception 'Customer can read internal pricing'; end if;
  begin
    perform public.get_product_pricing_private(
      (select id from public.products where slug = 'pricing-driver-test')
    );
    raise exception 'Customer invoked private pricing reader';
  exception when insufficient_privilege then null;
  end;
  begin
    perform cost from public.product_variants limit 1;
    raise exception 'Customer selected variant cost';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
do $$
declare selected_product_id uuid; selected_variant_id uuid; cart_price numeric;
begin
  select id, price into strict selected_product_id, cart_price from public.products
  where slug = 'pricing-driver-test';
  select id into strict selected_variant_id from public.product_variants
  where product_id = selected_product_id;
  if cart_price <> (
    select coalesce(product_variants.price, products.price)
    from public.product_variants join public.products
      on products.id = product_variants.product_id
    where product_variants.id = selected_variant_id
  ) then raise exception 'Commercial flow is not using published price'; end if;
end;
$$;

select 'internal product pricing checks passed' as result;
rollback;
