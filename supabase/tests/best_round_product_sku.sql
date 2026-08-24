-- Best Round product SKU reservation, collision handling and legacy compatibility.
-- Run after `npm run supabase:reset`.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  (
    '1a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'brps-sku.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '1a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'brps-sku.customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_roles (user_id, role_id)
select '1a000000-0000-4000-8000-000000000001', id
from public.roles where name = 'operator';

select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.reserve_brps_product_sku('BRPS-TIT-DRV-GT3-090-R-N');
    raise exception 'Expected a customer SKU reservation to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $$
declare
  first_sku text;
  second_sku text;
begin
  first_sku := public.reserve_brps_product_sku('brps-tit-drv-gt3-090-r-n');
  second_sku := public.reserve_brps_product_sku('BRPS-TIT-DRV-GT3-090-R-N');

  if first_sku !~ '^BRPS-TIT-DRV-GT3-090-R-N-[0-9]{3,}$'
    or second_sku !~ '^BRPS-TIT-DRV-GT3-090-R-N-[0-9]{3,}$'
    or first_sku = second_sku
  then
    raise exception 'Sequence reservation did not produce distinct BRPS SKUs';
  end if;
end;
$$;

reset role;

-- Occupy the next sequence candidate to verify collision retry. Sequence values
-- intentionally survive ROLLBACK, so derive the candidate instead of assuming 003.
do $$
declare
  occupied_sku text;
  next_sequence_value bigint;
begin
  select last_value + 1 into next_sequence_value
  from public.brps_product_sku_sequence;
  occupied_sku := 'BRPS-CAL-WDG-SM10-560-S-N-'
    || lpad(next_sequence_value::text, 3, '0');

  insert into public.products (
    slug, sku, name, condition, brand_id, category_id, status,
    fulfillment_type, price, published
  ) values (
    'brps-sequence-collision-test', occupied_sku,
    'BRPS sequence collision test', 'new',
    (select id from public.brands where slug = 'marca-demo-norte'),
    (select id from public.categories where slug = 'palos-demo'),
    'draft', 'in_stock', 10000, false
  );
  perform set_config('test.brps_collision_candidate', occupied_sku, true);
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '1a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $$
declare
  collision_safe_sku text;
  legacy_sku text;
begin
  collision_safe_sku := public.reserve_brps_product_sku(
    'BRPS-CAL-WDG-SM10-560-S-N'
  );
  if collision_safe_sku = current_setting('test.brps_collision_candidate')
    or collision_safe_sku !~ '^BRPS-CAL-WDG-SM10-560-S-N-[0-9]{3,}$'
  then
    raise exception 'Existing SKU collision was not skipped: %', collision_safe_sku;
  end if;

  select sku into strict legacy_sku
  from public.products where slug = 'set-hierros-iniciacion-demo';
  if legacy_sku <> 'PG-DEMO-HIERROS-001' then
    raise exception 'Legacy product SKU changed unexpectedly';
  end if;
end;
$$;

rollback;
