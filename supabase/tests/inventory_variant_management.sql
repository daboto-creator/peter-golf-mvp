-- Variant-level inventory verification. Runs entirely inside a rollback.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '14000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'inventory.variants.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
);
insert into public.user_roles (user_id, role_id)
select '14000000-0000-4000-8000-000000000001'::uuid, id
from public.roles where name = 'operator';

insert into public.brands (id, slug, name)
values ('24000000-0000-4000-8000-000000000001', 'variant-inventory-brand', 'Variant Inventory Brand');
insert into public.categories (id, slug, name)
values ('34000000-0000-4000-8000-000000000001', 'variant-inventory-category', 'Variant Inventory Category');
insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id,
  status, fulfillment_type, price, published
) values
  (
    '44000000-0000-4000-8000-000000000001', 'single-variant-inventory',
    'INV-SINGLE-P', 'Single Variant Product', 'new',
    '24000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001', 'active', 'in_stock', 10000, true
  ),
  (
    '44000000-0000-4000-8000-000000000002', 'multi-variant-inventory',
    'INV-MULTI-P', 'Multi Variant Product', 'new',
    '24000000-0000-4000-8000-000000000001',
    '34000000-0000-4000-8000-000000000001', 'active', 'in_stock', 20000, true
  );
insert into public.product_variants (
  id, product_id, sku, name, active, archived_at
) values
  (
    '54000000-0000-4000-8000-000000000001',
    '44000000-0000-4000-8000-000000000001', 'INV-SINGLE-V', 'Single', true, null
  ),
  (
    '54000000-0000-4000-8000-000000000002',
    '44000000-0000-4000-8000-000000000002', 'INV-MULTI-GRIS', 'Gris', true, null
  ),
  (
    '54000000-0000-4000-8000-000000000003',
    '44000000-0000-4000-8000-000000000002', 'INV-MULTI-VERDE', 'Verde', true, null
  ),
  (
    '54000000-0000-4000-8000-000000000004',
    '44000000-0000-4000-8000-000000000002', 'INV-MULTI-INACTIVE', 'Inactiva', false, null
  ),
  (
    '54000000-0000-4000-8000-000000000005',
    '44000000-0000-4000-8000-000000000002', 'INV-MULTI-ARCHIVED', 'Archivada', true, now()
  );

select set_config('request.jwt.claim.sub', '14000000-0000-4000-8000-000000000001', true);
set local role authenticated;

-- Existing single-variant behavior remains idempotent.
select * from public.initialize_inventory('54000000-0000-4000-8000-000000000001');
select * from public.adjust_inventory(
  '54000000-0000-4000-8000-000000000001', 'receipt', 4,
  'Recepción variante única', '64000000-0000-4000-8000-000000000001'
);

-- Each active variant of the same product initializes and adjusts separately.
select * from public.initialize_inventory('54000000-0000-4000-8000-000000000002');
select * from public.initialize_inventory('54000000-0000-4000-8000-000000000003');
select * from public.adjust_inventory(
  '54000000-0000-4000-8000-000000000002', 'receipt', 7,
  'Recepción variante gris', '64000000-0000-4000-8000-000000000002'
);
select * from public.adjust_inventory(
  '54000000-0000-4000-8000-000000000003', 'receipt', 11,
  'Recepción variante verde', '64000000-0000-4000-8000-000000000003'
);
select * from public.adjust_inventory(
  '54000000-0000-4000-8000-000000000002', 'adjustment', -2,
  'Conteo variante gris', '64000000-0000-4000-8000-000000000004'
);

do $$
declare
  single_balance integer;
  gray_balance integer;
  green_balance integer;
begin
  select quantity_on_hand into single_balance from public.inventory
  where variant_id = '54000000-0000-4000-8000-000000000001';
  select quantity_on_hand into gray_balance from public.inventory
  where variant_id = '54000000-0000-4000-8000-000000000002';
  select quantity_on_hand into green_balance from public.inventory
  where variant_id = '54000000-0000-4000-8000-000000000003';

  if single_balance <> 4 or gray_balance <> 5 or green_balance <> 11 then
    raise exception 'Variant balances were mixed: %, %, %',
      single_balance, gray_balance, green_balance;
  end if;
  if (select count(*) from public.inventory where variant_id in (
    '54000000-0000-4000-8000-000000000002',
    '54000000-0000-4000-8000-000000000003'
  )) <> 2 then
    raise exception 'Expected independent inventory rows for both variants';
  end if;
  if (select count(*) from public.inventory_movements where inventory_id = (
    select id from public.inventory
    where variant_id = '54000000-0000-4000-8000-000000000002'
  )) <> 2
    or (select count(*) from public.inventory_movements where inventory_id = (
      select id from public.inventory
      where variant_id = '54000000-0000-4000-8000-000000000003'
    )) <> 1
  then raise exception 'Variant movement histories were mixed'; end if;

  begin
    perform public.initialize_inventory('54000000-0000-4000-8000-000000000004');
    raise exception 'Expected inactive variant rejection';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.initialize_inventory('54000000-0000-4000-8000-000000000005');
    raise exception 'Expected archived variant rejection';
  exception when invalid_parameter_value then null; end;
end;
$$;

select 'inventory variant management checks passed' as result;
rollback;
