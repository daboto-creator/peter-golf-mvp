-- Reproducible local verification for atomic product/base-variant updates.
-- Run after `npm run supabase:reset` with:
-- docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/catalog_base_variant_updates.sql

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '13000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'base-update.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '13000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'base-update.admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '13000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'base-update.customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_roles (user_id, role_id)
select '13000000-0000-4000-8000-000000000001'::uuid, roles.id
from public.roles where roles.name = 'operator'
union all
select '13000000-0000-4000-8000-000000000002'::uuid, roles.id
from public.roles where roles.name = 'admin';

insert into public.brands (id, slug, name)
values (
  '23000000-0000-4000-8000-000000000001',
  'base-update-test-brand',
  'Base Update Test Brand'
);

insert into public.categories (id, slug, name)
values (
  '33000000-0000-4000-8000-000000000001',
  'base-update-test-category',
  'Base Update Test Category'
);

-- Historical and non-base fixtures intentionally bypass the application flow.
insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id,
  status, fulfillment_type, price, published, archived_at
)
values
  (
    '43000000-0000-4000-8000-000000000001',
    'update-orphan-test', 'UPDATE-ORPHAN-001', 'Update Orphan Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'draft', 'in_stock', 10000, false, null
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    'update-multiple-test', 'UPDATE-MULTIPLE-001', 'Update Multiple Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'draft', 'in_stock', 10000, false, null
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    'update-archived-test', 'UPDATE-ARCHIVED-001', 'Update Archived Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'archived', 'in_stock', 10000, false, now()
  ),
  (
    '43000000-0000-4000-8000-000000000004',
    'update-state-test', 'UPDATE-STATE-001', 'Update State Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'active', 'in_stock', 10000, false, null
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    'update-collision-owner-test', 'UPDATE-COLLISION-OWNER-001',
    'Update Collision Owner Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'draft', 'in_stock', 10000, false, null
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    'update-noncanonical-test', 'UPDATE-NONCANONICAL-001',
    'Update Noncanonical Test', 'new',
    '23000000-0000-4000-8000-000000000001',
    '33000000-0000-4000-8000-000000000001',
    'draft', 'in_stock', 10000, false, null
  );

insert into public.product_variants (product_id, sku, name)
values
  (
    '43000000-0000-4000-8000-000000000002',
    'UPDATE-MULTIPLE-001', 'Update Multiple Test'
  ),
  (
    '43000000-0000-4000-8000-000000000002',
    'UPDATE-MULTIPLE-002', 'Second Variant'
  ),
  (
    '43000000-0000-4000-8000-000000000003',
    'UPDATE-ARCHIVED-001', 'Update Archived Test'
  ),
  (
    '43000000-0000-4000-8000-000000000004',
    'UPDATE-STATE-001', 'Update State Test'
  ),
  (
    '43000000-0000-4000-8000-000000000005',
    'UPDATE-VARIANT-COLLISION-001', 'Reserved Variant SKU'
  ),
  (
    '43000000-0000-4000-8000-000000000006',
    'UPDATE-NONCANONICAL-VARIANT', 'Different Variant Identity'
  );

-- Operator creates the normal base-flow target.
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select * from public.create_product_with_base_variant(
  'base-update-target', 'BASE-UPDATE-001', 'Base Update Target',
  null, null, 'new', null, null,
  '23000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

-- Name and SKU changes synchronize the same canonical variant.
select * from public.update_product_with_base_variant(
  (select id from public.products where slug = 'base-update-target'),
  'draft', false,
  'base-update-target', 'BASE-UPDATE-001', 'Base Update Renamed',
  null, null, 'new', null, null,
  '23000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

select * from public.update_product_with_base_variant(
  (select id from public.products where slug = 'base-update-target'),
  'draft', false,
  'base-update-target', '  base-update-002  ', 'Base Update Renamed',
  'Sin cambiar el SKU otra vez', null, 'new', null, null,
  '23000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

reset role;

do $$
declare
  selected_product record;
  selected_variant public.product_variants%rowtype;
  variant_count integer;
begin
  select id, sku, name, short_description into strict selected_product
  from public.products
  where slug = 'base-update-target';

  select count(*) into variant_count
  from public.product_variants
  where product_id = selected_product.id;

  select * into strict selected_variant
  from public.product_variants
  where product_id = selected_product.id;

  if selected_product.sku <> 'BASE-UPDATE-002'
    or selected_product.name <> 'Base Update Renamed'
    or selected_variant.sku <> selected_product.sku
    or selected_variant.name <> selected_product.name
    or variant_count <> 1
    or selected_variant.active is distinct from true
    or selected_variant.archived_at is not null
    or selected_variant.attributes <> '{}'::jsonb
    or selected_variant.sort_order <> 0
    or selected_variant.price is not null
    or selected_variant.compare_at_price is not null
    or selected_variant.cost is not null
  then
    raise exception 'Product and canonical variant were not synchronized';
  end if;
end;
$$;

-- Variant SKU collision must roll back the preceding product update.
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.update_product_with_base_variant(
      (select id from public.products where slug = 'base-update-target'),
      'draft', false,
      'base-update-target', 'UPDATE-VARIANT-COLLISION-001',
      'This Name Must Roll Back', null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected variant SKU collision';
  exception when unique_violation then null;
  end;
end;
$$;

reset role;

do $$
declare
  product_sku text;
  product_name text;
  variant_sku text;
  variant_name text;
begin
  select products.sku, products.name, product_variants.sku, product_variants.name
  into product_sku, product_name, variant_sku, variant_name
  from public.products
  inner join public.product_variants
    on product_variants.product_id = products.id
  where products.slug = 'base-update-target';

  if product_sku <> 'BASE-UPDATE-002'
    or variant_sku <> 'BASE-UPDATE-002'
    or product_name <> 'Base Update Renamed'
    or variant_name <> 'Base Update Renamed'
  then
    raise exception 'Variant collision left a partial product update';
  end if;
end;
$$;

-- Orphans, multiple variants, archived products and stale state are rejected.
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000001', true);
set local role authenticated;

do $$
begin
  begin
    perform public.update_product_with_base_variant(
      '43000000-0000-4000-8000-000000000001', 'draft', false,
      'update-orphan-test', 'UPDATE-ORPHAN-002', 'Orphan Changed',
      null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected orphan update to fail';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.update_product_with_base_variant(
      '43000000-0000-4000-8000-000000000002', 'draft', false,
      'update-multiple-test', 'UPDATE-MULTIPLE-NEW', 'Multiple Changed',
      null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected multiple-variant update to fail';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.update_product_with_base_variant(
      '43000000-0000-4000-8000-000000000003', 'archived', false,
      'update-archived-test', 'UPDATE-ARCHIVED-NEW', 'Archived Changed',
      null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected archived update to fail';
  exception when invalid_parameter_value then null;
  end;

  begin
    perform public.update_product_with_base_variant(
      '43000000-0000-4000-8000-000000000004', 'draft', false,
      'update-state-test', 'UPDATE-STATE-NEW', 'State Changed',
      null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected stale-state update to fail';
  exception when serialization_failure then null;
  end;

  begin
    perform public.update_product_with_base_variant(
      '43000000-0000-4000-8000-000000000006', 'draft', false,
      'update-noncanonical-test', 'UPDATE-NONCANONICAL-002',
      'Noncanonical Changed', null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected noncanonical-variant update to fail';
  exception when invalid_parameter_value then null;
  end;

  if (select name from public.products where id = '43000000-0000-4000-8000-000000000001')
      <> 'Update Orphan Test'
    or (select count(*) from public.product_variants where product_id = '43000000-0000-4000-8000-000000000002')
      <> 2
    or (select name from public.products where id = '43000000-0000-4000-8000-000000000003')
      <> 'Update Archived Test'
    or (select sku from public.products where id = '43000000-0000-4000-8000-000000000004')
      <> 'UPDATE-STATE-001'
    or (select name from public.products where id = '43000000-0000-4000-8000-000000000006')
      <> 'Update Noncanonical Test'
  then
    raise exception 'Rejected update modified a protected product';
  end if;
end;
$$;

-- Direct identity writes cannot bypass the synchronization RPC.
do $$
declare
  affected_rows integer;
begin
  begin
    update public.products
    set name = 'Direct Product Rename'
    where slug = 'base-update-target';
    raise exception 'Expected direct product identity update to fail';
  exception when insufficient_privilege then null;
  end;

  update public.product_variants
  set name = 'Direct Variant Rename'
  where product_id = (
    select id from public.products where slug = 'base-update-target'
  );
  get diagnostics affected_rows = row_count;

  if affected_rows <> 0 then
    raise exception 'Direct variant identity update bypassed the RPC';
  end if;
end;
$$;

-- Customer cannot invoke the update RPC.
reset role;
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.update_product_with_base_variant(
      (select id from public.products where slug = 'base-update-target'),
      'draft', false,
      'base-update-target', 'BASE-UPDATE-003', 'Customer Changed',
      null, null, 'new', null, null,
      '23000000-0000-4000-8000-000000000001',
      '33000000-0000-4000-8000-000000000001',
      'in_stock', 10000, null, 'MXN', false, false, false, null, null
    );
    raise exception 'Expected customer update to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Admin uses the same authorized synchronization path.
reset role;
select set_config('request.jwt.claim.sub', '13000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select * from public.create_product_with_base_variant(
  'base-update-admin', 'BASE-UPDATE-ADMIN-001', 'Base Update Admin',
  null, null, 'new', null, null,
  '23000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

select * from public.update_product_with_base_variant(
  (select id from public.products where slug = 'base-update-admin'),
  'draft', false,
  'base-update-admin', 'BASE-UPDATE-ADMIN-002', 'Base Update Admin Renamed',
  null, null, 'new', null, null,
  '23000000-0000-4000-8000-000000000001',
  '33000000-0000-4000-8000-000000000001',
  'in_stock', 10000, null, 'MXN', false, false, false, null, null
);

rollback;
