-- Reproducible local verification for atomic catalog base variants.
-- Run after `npm run supabase:reset` with:
-- docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_foundation.sql

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '12000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'base-variant.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '12000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'base-variant.admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '12000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'base-variant.customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_roles (user_id, role_id)
select '12000000-0000-4000-8000-000000000001'::uuid, roles.id
from public.roles where roles.name = 'operator'
union all
select '12000000-0000-4000-8000-000000000002'::uuid, roles.id
from public.roles where roles.name = 'admin';

insert into public.brands (id, slug, name)
values (
  '22000000-0000-4000-8000-000000000001',
  'base-variant-test-brand',
  'Base Variant Test Brand'
);

insert into public.categories (id, slug, name)
values (
  '32000000-0000-4000-8000-000000000001',
  'base-variant-test-category',
  'Base Variant Test Category'
);

-- These rows emulate historical products created before the atomic RPC.
insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id,
  status, fulfillment_type, price, published, archived_at
)
values
  (
    '42000000-0000-4000-8000-000000000001',
    'orphan-product-test',
    'ORPHAN-TEST-001',
    'Orphan Product Test',
    'new',
    '22000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'draft',
    'in_stock',
    10000,
    false,
    null
  ),
  (
    '42000000-0000-4000-8000-000000000002',
    'archived-orphan-product-test',
    'ARCHIVED-ORPHAN-001',
    'Archived Orphan Product Test',
    'new',
    '22000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'archived',
    'in_stock',
    10000,
    false,
    now()
  ),
  (
    '42000000-0000-4000-8000-000000000003',
    'variant-sku-owner-test',
    'VARIANT-OWNER-001',
    'Variant SKU Owner Test',
    'new',
    '22000000-0000-4000-8000-000000000001',
    '32000000-0000-4000-8000-000000000001',
    'draft',
    'in_stock',
    10000,
    false,
    null
  );

insert into public.product_variants (product_id, sku, name)
values (
  '42000000-0000-4000-8000-000000000003',
  'ATOMIC-COLLISION-001',
  'Existing collision variant'
);

-- Customer cannot create products or repair historical orphans.
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.create_product_with_base_variant(
      'customer-product-test', 'CUSTOMER-TEST-001', 'Customer Product Test',
      null, null, 'new', null, null,
      '22000000-0000-4000-8000-000000000001',
      '32000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected customer product creation to fail';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.repair_product_base_variant(
      '42000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected customer repair to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Operator creates one product and one canonical variant atomically.
reset role;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select * from public.create_product_with_base_variant(
  'atomic-product-test', '  atomic-test-001  ', '  Atomic Product Test  ',
  'Descripción corta', 'Descripción completa', 'new', null, null,
  '22000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'in_stock', 159900, null, 'MXN', false, false, false, null, null
);

do $$
declare
  selected_product record;
  selected_variant record;
  variant_count integer;
begin
  select id, sku, name into strict selected_product
  from public.products
  where slug = 'atomic-product-test';

  select count(*) into variant_count
  from public.product_variants
  where product_id = selected_product.id;

  select product_id, sku, name, active, archived_at, attributes, sort_order
  into strict selected_variant
  from public.product_variants
  where product_id = selected_product.id;

  if variant_count <> 1
    or selected_product.sku <> 'ATOMIC-TEST-001'
    or selected_product.name <> 'Atomic Product Test'
    or selected_variant.product_id <> selected_product.id
    or selected_variant.sku <> selected_product.sku
    or selected_variant.name <> selected_product.name
    or selected_variant.active is distinct from true
    or selected_variant.archived_at is not null
    or selected_variant.attributes <> '{}'::jsonb
    or selected_variant.sort_order <> 0
  then
    raise exception 'Product and canonical base variant were not created correctly';
  end if;

  begin
    perform public.create_product_with_base_variant(
      'atomic-product-test', 'ATOMIC-TEST-001', 'Atomic Product Test',
      'Descripción corta', 'Descripción completa', 'new', null, null,
      '22000000-0000-4000-8000-000000000001',
      '32000000-0000-4000-8000-000000000001',
      'in_stock', 159900, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected duplicate submission to fail';
  exception when unique_violation then null;
  end;

  select count(*) into variant_count
  from public.product_variants
  where product_id = selected_product.id;
  if variant_count <> 1 then
    raise exception 'Duplicate submission created another variant';
  end if;

  update public.products
  set short_description = 'Edición sin variantes nuevas'
  where id = selected_product.id;

  select count(*) into variant_count
  from public.product_variants
  where product_id = selected_product.id;
  if variant_count <> 1 then
    raise exception 'Product edit created another variant';
  end if;
end;
$$;

-- A variant SKU collision rolls the preceding product insert back.
do $$
begin
  begin
    perform public.create_product_with_base_variant(
      'rolled-back-product-test', 'ATOMIC-COLLISION-001',
      'Rolled Back Product Test', null, null, 'new', null, null,
      '22000000-0000-4000-8000-000000000001',
      '32000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected variant SKU collision';
  exception when unique_violation then null;
  end;

  if exists (
    select 1 from public.products where slug = 'rolled-back-product-test'
  ) then
    raise exception 'Product insert was not rolled back after variant failure';
  end if;
end;
$$;

-- Historical orphan repair is explicit and idempotent.
do $$
declare
  first_created boolean;
  replay_created boolean;
  variant_count integer;
begin
  select created into first_created
  from public.repair_product_base_variant(
    '42000000-0000-4000-8000-000000000001'
  );
  select created into replay_created
  from public.repair_product_base_variant(
    '42000000-0000-4000-8000-000000000001'
  );

  select count(*) into variant_count
  from public.product_variants
  where product_id = '42000000-0000-4000-8000-000000000001';

  if first_created is distinct from true
    or replay_created is distinct from false
    or variant_count <> 1
  then
    raise exception 'Orphan repair was not idempotent';
  end if;

  begin
    perform public.repair_product_base_variant(
      '42000000-0000-4000-8000-000000000002'
    );
    raise exception 'Expected archived orphan repair to fail';
  exception
    when invalid_parameter_value then null;
  end;
end;
$$;

-- Admin receives the same authorized atomic creation path.
reset role;
select set_config('request.jwt.claim.sub', '12000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select * from public.create_product_with_base_variant(
  'admin-product-test', 'ADMIN-TEST-001', 'Admin Product Test',
  null, null, 'new', null, null,
  '22000000-0000-4000-8000-000000000001',
  '32000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

do $$
begin
  if (
    select count(*)
    from public.product_variants
    inner join public.products on products.id = product_variants.product_id
    where products.slug = 'admin-product-test'
  ) <> 1 then
    raise exception 'Admin creation did not produce exactly one base variant';
  end if;
end;
$$;

rollback;
