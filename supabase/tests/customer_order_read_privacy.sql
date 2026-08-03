-- Customer order projections and operational compatibility.
-- Runs entirely in a transaction and always ends with ROLLBACK.

begin;

insert into auth.users
  (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('14000000-0000-4000-8000-000000000001','authenticated','authenticated','privacy.one@example.test','{}','{}',now(),now()),
  ('14000000-0000-4000-8000-000000000002','authenticated','authenticated','privacy.two@example.test','{}','{}',now(),now()),
  ('14000000-0000-4000-8000-000000000003','authenticated','authenticated','privacy.operator@example.test','{}','{}',now(),now()),
  ('14000000-0000-4000-8000-000000000004','authenticated','authenticated','privacy.admin@example.test','{}','{}',now(),now());

insert into public.user_roles (user_id, role_id)
select '14000000-0000-4000-8000-000000000003'::uuid, id
from public.roles where name = 'operator';
insert into public.user_roles (user_id, role_id)
select '14000000-0000-4000-8000-000000000004'::uuid, id
from public.roles where name = 'admin';

insert into public.brands (id, slug, name)
values ('24000000-0000-4000-8000-000000000001','privacy-brand','Privacy Brand');
insert into public.categories (id, slug, name)
values ('34000000-0000-4000-8000-000000000001','privacy-category','Privacy Category');
insert into public.products
  (id, slug, sku, name, condition, brand_id, category_id, status,
   fulfillment_type, price, published)
values
  ('44000000-0000-4000-8000-000000000001','privacy-product','PRIVACY-P1',
   'Privacy Product','new','24000000-0000-4000-8000-000000000001',
   '34000000-0000-4000-8000-000000000001','active','in_stock',10000,true);
insert into public.product_variants (id, product_id, sku, name)
values
  ('54000000-0000-4000-8000-000000000001','44000000-0000-4000-8000-000000000001',
   'PRIVACY-V1','Privacy Variant');
insert into public.inventory (id, variant_id, quantity_on_hand, quantity_reserved)
values
  ('64000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',10,0);

insert into public.orders (
  id, order_number, user_id, status, currency, subtotal, shipping_total,
  discount_total, discount_reason, tax_total, total,
  shipping_address_snapshot, customer_name, customer_email, customer_phone,
  customer_note, internal_note, payment_status, payment_method, origin,
  created_by, updated_by
) values
  ('74000000-0000-4000-8000-000000000001','PG-W-PRIVACY0001',
   '14000000-0000-4000-8000-000000000001','pending_confirmation','MXN',10000,14900,
   100,'descuento interno',0,24800,
   '{"recipient_name":"Cliente Uno","phone":"4421234567","street":"Reforma","exterior_number":"10","interior_number":null,"neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000","references":null,"country_code":"MX"}',
   'Cliente Uno','privacy.one@example.test','4421234567','nota cliente interna',
   'nota operativa privada','transfer_pending','bank_transfer','web',null,
   '14000000-0000-4000-8000-000000000003'),
  ('74000000-0000-4000-8000-000000000002','PG-W-PRIVACY0002',
   '14000000-0000-4000-8000-000000000002','pending_confirmation','MXN',10000,14900,
   100,'otro descuento interno',0,24800,
   '{"recipient_name":"Cliente Dos","phone":"4427654321","street":"Juárez","exterior_number":"20","interior_number":null,"neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000","references":null,"country_code":"MX"}',
   'Cliente Dos','privacy.two@example.test','4427654321','otra nota cliente',
   'otra nota operativa','transfer_pending','bank_transfer','web',null,
   '14000000-0000-4000-8000-000000000003');

insert into public.order_payments (
  id, order_id, method, status, expected_amount, currency
) values
  ('75000000-0000-4000-8000-000000000001',
   '74000000-0000-4000-8000-000000000001','bank_transfer','pending',24800,'MXN'),
  ('75000000-0000-4000-8000-000000000002',
   '74000000-0000-4000-8000-000000000002','bank_transfer','pending',24800,'MXN');

insert into public.order_items (
  id, order_id, product_id, variant_id, sku_snapshot, product_name_snapshot,
  variant_name_snapshot, condition_snapshot, unit_price_snapshot, currency,
  quantity, line_total
) values
  ('84000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',
   '44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',
   'PRIVACY-V1','Privacy Product','Privacy Variant','new',10000,'MXN',1,10000),
  ('84000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002',
   '44000000-0000-4000-8000-000000000001','54000000-0000-4000-8000-000000000001',
   'PRIVACY-V1','Privacy Product','Privacy Variant','new',10000,'MXN',1,10000);

insert into public.order_status_history
  (id, order_id, from_status, to_status, changed_by, note)
values
  ('94000000-0000-4000-8000-000000000001','74000000-0000-4000-8000-000000000001',
   null,'pending_confirmation','14000000-0000-4000-8000-000000000003','historial privado'),
  ('94000000-0000-4000-8000-000000000002','74000000-0000-4000-8000-000000000002',
   null,'pending_confirmation','14000000-0000-4000-8000-000000000003','otro historial privado');

insert into public.order_idempotency_keys
  (idempotency_key, actor_id, operation, order_id, payload_hash)
values
  ('a4000000-0000-4000-8000-000000000001','14000000-0000-4000-8000-000000000001',
   'checkout','74000000-0000-4000-8000-000000000001',
   'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');

select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare listed record; detail jsonb;
begin
  select * into listed from public.list_customer_orders();
  if listed.id <> '74000000-0000-4000-8000-000000000001'::uuid
    or (select count(*) from public.list_customer_orders()) <> 1
  then raise exception 'Customer list projection failed'; end if;
  if to_jsonb(listed) ?| array['internal_note','customer_note','created_by','updated_by',
    'confirmed_by','cancelled_by','cancellation_reason','discount_reason']
  then raise exception 'Customer list exposes internal fields'; end if;

  detail := public.get_customer_order('74000000-0000-4000-8000-000000000001');
  if detail is null or detail->>'order_number' <> 'PG-W-PRIVACY0001'
    or jsonb_array_length(detail->'order_items') <> 1
    or jsonb_array_length(detail->'history') < 1
  then raise exception 'Customer detail projection failed: %', detail; end if;
  if detail ?| array['internal_note','customer_note','created_by','updated_by',
    'confirmed_by','cancelled_by','cancellation_reason','discount_reason',
    'idempotency_key']
    or exists (
      select 1 from jsonb_array_elements(detail->'history') entry
      where entry ?| array['id','changed_by','note'])
    or (detail->'order_items'->0) ? 'id'
  then raise exception 'Customer detail exposes internal fields: %', detail; end if;
  if public.get_customer_order('74000000-0000-4000-8000-000000000002') is not null
    then raise exception 'Customer can read a foreign order'; end if;

  -- The RPC disables its local context before returning. Direct PostgREST-style
  -- table reads therefore disclose neither safe nor internal rows.
  if (select count(*) from public.orders where internal_note is not null) <> 0
    or (select count(*) from public.orders where updated_by is not null) <> 0
    or (select count(*) from public.order_items) <> 0
    or (select count(*) from public.order_status_history
        where changed_by is not null or note is not null) <> 0
    or (select count(*) from public.order_idempotency_keys) <> 0
    or (select count(*) from public.order_payments) <> 0
    or (select count(*) from public.payment_status_history) <> 0
  then raise exception 'Direct customer read exposed operational data'; end if;
end $$;

reset role;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.list_customer_orders()) <> 1
    or public.get_customer_order('74000000-0000-4000-8000-000000000001') is not null
  then raise exception 'Customer ownership boundary failed'; end if;
end $$;

-- Operator keeps full direct operational reads and all three operational routes.
reset role;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare selected public.orders%rowtype;
begin
  select * into selected from public.orders
  where id = '74000000-0000-4000-8000-000000000001';
  if selected.internal_note <> 'nota operativa privada'
    or selected.customer_note <> 'nota cliente interna'
    or selected.updated_by <> '14000000-0000-4000-8000-000000000003'::uuid
    or not exists (
      select 1 from public.order_status_history
      where order_id = selected.id
        and changed_by = '14000000-0000-4000-8000-000000000003'::uuid
        and note = 'historial privado')
  then raise exception 'Operator lost full operational detail'; end if;

  perform public.confirm_operational_order(selected.id, selected.version,
    'a4000000-0000-4000-8000-000000000010');
  select * into selected from public.orders where id = selected.id;
  perform public.cancel_operational_order(selected.id, selected.version,
    'Cancelación de prueba','a4000000-0000-4000-8000-000000000011');
  select * into selected from public.orders where id = selected.id;
  if selected.status <> 'cancelled'
    or (select status from public.order_payments where order_id=selected.id) <> 'pending'
    or selected.cancelled_by <> auth.uid()
    or selected.cancellation_reason <> 'Cancelación de prueba'
  then raise exception 'Operational routes failed'; end if;
end $$;

-- Admin keeps the same complete operational read after the transitions.
reset role;
select set_config('request.jwt.claim.sub','14000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
  if not exists (
    select 1 from public.orders
    where id = '74000000-0000-4000-8000-000000000001'
      and internal_note = 'nota operativa privada'
      and cancelled_by = '14000000-0000-4000-8000-000000000003'::uuid
      and cancellation_reason = 'Cancelación de prueba')
    or not exists (
      select 1 from public.order_status_history
      where order_id = '74000000-0000-4000-8000-000000000001'
        and changed_by = '14000000-0000-4000-8000-000000000003'::uuid)
  then raise exception 'Admin lost full operational detail'; end if;
end $$;

rollback;
