-- Reproducible local verification for secure inventory management.
-- Run after `npm run supabase:reset` with:
-- docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/inventory_management_foundation.sql

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '11000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'inventory.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '11000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'inventory.admin@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '11000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
    'inventory.customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_roles (user_id, role_id)
select '11000000-0000-4000-8000-000000000001'::uuid, roles.id
from public.roles where roles.name = 'operator'
union all
select '11000000-0000-4000-8000-000000000002'::uuid, roles.id
from public.roles where roles.name = 'admin';

insert into public.brands (id, slug, name)
values ('21000000-0000-4000-8000-000000000001', 'inventory-test-brand', 'Inventory Test Brand');

insert into public.categories (id, slug, name)
values ('31000000-0000-4000-8000-000000000001', 'inventory-test-category', 'Inventory Test Category');

insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id,
  status, fulfillment_type, price, published
)
values (
  '41000000-0000-4000-8000-000000000001',
  'inventory-test-product',
  'INV-TEST-PRODUCT',
  'Inventory Test Product',
  'new',
  '21000000-0000-4000-8000-000000000001',
  '31000000-0000-4000-8000-000000000001',
  'draft',
  'in_stock',
  10000,
  false
);

insert into public.product_variants (id, product_id, sku, name)
values (
  '51000000-0000-4000-8000-000000000001',
  '41000000-0000-4000-8000-000000000001',
  'INV-TEST-VARIANT',
  'Presentación base'
);

-- Customer cannot initialize or adjust inventory.
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000003', true);
set local role authenticated;

do $$
begin
  begin
    perform public.initialize_inventory('51000000-0000-4000-8000-000000000001');
    raise exception 'Expected customer initialization to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Operator initializes at zero, increments, decrements and receives an
-- idempotent replay instead of a duplicate movement.
reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000001', true);
set local role authenticated;

select * from public.initialize_inventory('51000000-0000-4000-8000-000000000001');

select * from public.adjust_inventory(
  '51000000-0000-4000-8000-000000000001',
  'receipt',
  10,
  'Recepción local de prueba',
  '61000000-0000-4000-8000-000000000001'
);

select * from public.adjust_inventory(
  '51000000-0000-4000-8000-000000000001',
  'adjustment',
  -3,
  '  Conteo físico local  ',
  '61000000-0000-4000-8000-000000000002',
  '  conteo_fisico  ',
  '71000000-0000-4000-8000-000000000001'
);

do $$
declare
  was_replayed boolean;
  current_balance integer;
  movement_count integer;
begin
  select replayed
  into was_replayed
  from public.adjust_inventory(
    '51000000-0000-4000-8000-000000000001',
    'adjustment',
    -3,
    'Conteo físico local',
    '61000000-0000-4000-8000-000000000002',
    'conteo_fisico',
    '71000000-0000-4000-8000-000000000001'
  );

  if was_replayed is distinct from true then
    raise exception 'Expected identical normalized payload to be replayed';
  end if;

  select quantity_on_hand into current_balance
  from public.inventory
  where variant_id = '51000000-0000-4000-8000-000000000001';

  select count(*) into movement_count
  from public.inventory_movements;

  if current_balance <> 7 or movement_count <> 2 then
    raise exception 'Unexpected balance or duplicate movement: %, %', current_balance, movement_count;
  end if;

  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      -2,
      'Conteo físico local',
      '61000000-0000-4000-8000-000000000002',
      'conteo_fisico',
      '71000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected changed quantity to conflict';
  exception
    when unique_violation then
      if sqlerrm <> 'Idempotency key conflict' then raise; end if;
  end;

  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      10,
      'Recepción local de prueba',
      '61000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected changed movement type to conflict';
  exception
    when unique_violation then
      if sqlerrm <> 'Idempotency key conflict' then raise; end if;
  end;

  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      -3,
      'Motivo diferente',
      '61000000-0000-4000-8000-000000000002',
      'conteo_fisico',
      '71000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected changed reason to conflict';
  exception
    when unique_violation then
      if sqlerrm <> 'Idempotency key conflict' then raise; end if;
  end;

  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      -3,
      'Conteo físico local',
      '61000000-0000-4000-8000-000000000002',
      'auditoria',
      '71000000-0000-4000-8000-000000000002'
    );
    raise exception 'Expected changed reference to conflict';
  exception
    when unique_violation then
      if sqlerrm <> 'Idempotency key conflict' then raise; end if;
  end;

  select quantity_on_hand into current_balance
  from public.inventory
  where variant_id = '51000000-0000-4000-8000-000000000001';

  select count(*) into movement_count
  from public.inventory_movements;

  if current_balance <> 7 or movement_count <> 2 then
    raise exception 'Conflicts changed balance or duplicated movement: %, %', current_balance, movement_count;
  end if;

  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      -8,
      'Ajuste negativo inválido',
      '61000000-0000-4000-8000-000000000003'
    );
    raise exception 'Expected negative inventory to fail';
  exception when check_violation then null;
  end;

  begin
    update public.inventory set quantity_on_hand = 99
    where variant_id = '51000000-0000-4000-8000-000000000001';
    raise exception 'Expected direct inventory update to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

-- Admin is also authorized.
reset role;
select set_config('request.jwt.claim.sub', '11000000-0000-4000-8000-000000000002', true);
set local role authenticated;

select * from public.adjust_inventory(
  '51000000-0000-4000-8000-000000000001',
  'adjustment',
  1,
  'Corrección autorizada por admin',
  '61000000-0000-4000-8000-000000000004'
);

do $$
declare
  current_balance integer;
  movement_count integer;
begin
  begin
    perform public.adjust_inventory(
      '51000000-0000-4000-8000-000000000001',
      'adjustment',
      -3,
      'Conteo físico local',
      '61000000-0000-4000-8000-000000000002',
      'conteo_fisico',
      '71000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected another actor to conflict';
  exception
    when unique_violation then
      if sqlerrm <> 'Idempotency key conflict' then raise; end if;
  end;

  select quantity_on_hand into current_balance
  from public.inventory
  where variant_id = '51000000-0000-4000-8000-000000000001';

  select count(*) into movement_count
  from public.inventory_movements;

  if current_balance <> 8 or movement_count <> 3 then
    raise exception 'Actor conflict changed balance or duplicated movement: %, %', current_balance, movement_count;
  end if;
end;
$$;

-- Historical movements remain immutable even to the migration owner.
reset role;
do $$
begin
  begin
    update public.inventory_movements set reason = 'Rewritten';
    raise exception 'Expected immutable movement update to fail';
  exception when object_not_in_prerequisite_state then null;
  end;

  begin
    delete from public.inventory_movements;
    raise exception 'Expected immutable movement delete to fail';
  exception when object_not_in_prerequisite_state then null;
  end;
end;
$$;

select 'inventory management foundation checks passed' as result;

rollback;
