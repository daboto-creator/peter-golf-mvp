-- Reproducible local verification for authenticated customer cart + checkout.
-- Runs entirely in a transaction and always ends with ROLLBACK.

begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('13000000-0000-4000-8000-000000000001','authenticated','authenticated','checkout.one@example.test','{}','{}',now(),now()),
  ('13000000-0000-4000-8000-000000000002','authenticated','authenticated','checkout.two@example.test','{}','{}',now(),now()),
  ('13000000-0000-4000-8000-000000000003','authenticated','authenticated','checkout.operator@example.test','{}','{}',now(),now());
insert into public.user_roles (user_id, role_id)
select '13000000-0000-4000-8000-000000000003'::uuid, id from public.roles where name='operator';

insert into public.brands (id,slug,name) values ('23000000-0000-4000-8000-000000000001','checkout-brand','Checkout Brand');
insert into public.categories (id,slug,name) values ('33000000-0000-4000-8000-000000000001','checkout-category','Checkout Category');
insert into public.products (id,slug,sku,name,condition,condition_grade,condition_notes,brand_id,category_id,status,fulfillment_type,price,published)
values
 ('43000000-0000-4000-8000-000000000001','checkout-one','CHECKOUT-P1','Checkout One','new',null,null,'23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','active','in_stock',10000,true),
 ('43000000-0000-4000-8000-000000000002','checkout-two','CHECKOUT-P2','Checkout Two','used','good','Desgaste ficticio de prueba','23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','active','in_stock',25000,true),
 ('43000000-0000-4000-8000-000000000003','checkout-draft','CHECKOUT-P3','Checkout Draft','new',null,null,'23000000-0000-4000-8000-000000000001','33000000-0000-4000-8000-000000000001','draft','in_stock',9000,false);
insert into public.product_variants (id,product_id,sku,name,price)
values
 ('53000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','BRPS-CHK-DRV-SNAPSHOT-090-R-N-999','Variante uno',null),
 ('53000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','CHECKOUT-V2','Variante dos',26000),
 ('53000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000001','CHECKOUT-INACTIVE','Variante inactiva',null),
 ('53000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000001','CHECKOUT-ARCHIVED','Variante archivada',null),
 ('53000000-0000-4000-8000-000000000005','43000000-0000-4000-8000-000000000003','CHECKOUT-DRAFT-V','Variante borrador',null);
update public.product_variants set active=false where id='53000000-0000-4000-8000-000000000003';
update public.product_variants set archived_at=now() where id='53000000-0000-4000-8000-000000000004';
insert into public.inventory (id,variant_id,quantity_on_hand,quantity_reserved)
values
 ('63000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',3,0),
 ('63000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',5,0),
 ('63000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000003',5,0),
 ('63000000-0000-4000-8000-000000000004','53000000-0000-4000-8000-000000000004',5,0),
 ('63000000-0000-4000-8000-000000000005','53000000-0000-4000-8000-000000000005',5,0);

-- Anonymous callers cannot invoke cart RPCs.
set local role anon;
do $$ begin
  begin
    perform public.add_customer_cart_item(
      '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',1,
      '73000000-0000-4000-8000-000000000001');
    raise exception 'Expected anonymous rejection';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare added record; replay record; cart_one uuid; cart_version integer; cart_json jsonb;
begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',2,
    '73000000-0000-4000-8000-000000000010');
  cart_one := added.cart_id; cart_version := added.version;
  if added.quantity <> 2 or added.replayed then raise exception 'Initial add failed'; end if;

  select * into replay from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',2,
    '73000000-0000-4000-8000-000000000010');
  if not replay.replayed or replay.quantity <> 2 then raise exception 'Add replay failed'; end if;
  begin
    perform public.add_customer_cart_item(
      '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',1,
      '73000000-0000-4000-8000-000000000010');
    raise exception 'Expected add idempotency conflict';
  exception when unique_violation then null; end;

  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',1,
    '73000000-0000-4000-8000-000000000011');
  if added.quantity <> 3 or (select count(*) from public.cart_items where cart_id=cart_one) <> 1
    then raise exception 'Duplicate variant was not incremented'; end if;
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',1,
    '73000000-0000-4000-8000-000000000012');
  if (select count(*) from public.cart_items where cart_id=cart_one) <> 2
    then raise exception 'Second variant was not added'; end if;
  if (select count(*) from public.carts where user_id=auth.uid() and status='active') <> 1
    then raise exception 'More than one active cart exists'; end if;

  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',0,
    '73000000-0000-4000-8000-000000000013'); raise exception 'Expected zero rejection';
  exception when invalid_parameter_value then null; end;
  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000001',1,
    '73000000-0000-4000-8000-000000000014'); raise exception 'Expected product/variant rejection';
  exception when invalid_parameter_value then null; end;
  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',11,
    '73000000-0000-4000-8000-000000000015'); raise exception 'Expected stock rejection';
  exception when check_violation then null; end;
  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000003',1,
    '73000000-0000-4000-8000-000000000016'); raise exception 'Expected inactive variant rejection';
  exception when invalid_parameter_value then null; end;
  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000004',1,
    '73000000-0000-4000-8000-000000000017'); raise exception 'Expected archived variant rejection';
  exception when invalid_parameter_value then null; end;
  begin perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000003','53000000-0000-4000-8000-000000000005',1,
    '73000000-0000-4000-8000-000000000018'); raise exception 'Expected unpublished product rejection';
  exception when invalid_parameter_value then null; end;

  cart_json := public.get_customer_cart();
  if (cart_json->>'subtotal')::integer <> 56000
    or (cart_json->>'unit_count')::integer <> 4
    or (cart_json->>'has_issues')::boolean then raise exception 'Cart server totals invalid: %', cart_json; end if;
end $$;

-- A second customer cannot see or mutate the first cart.
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.carts) <> 0 or (select count(*) from public.cart_items) <> 0
    then raise exception 'Customer can read another cart'; end if;
  begin
    perform public.change_customer_cart('update',
      (select id from public.cart_items limit 1), 1, 1,
      '73000000-0000-4000-8000-000000000020');
    raise exception 'Expected foreign cart rejection';
  exception when no_data_found or invalid_parameter_value then null;
    when others then if sqlstate <> 'P0002' then raise; end if; end;
end $$;

do $$
declare added record; selected public.carts%rowtype; item_id uuid;
begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',1,
    '73000000-0000-4000-8000-000000000021');
  select * into selected from public.carts where id=added.cart_id;
  select id into item_id from public.cart_items where cart_id=selected.id;
  perform public.change_customer_cart('update',item_id,2,selected.version,
    '73000000-0000-4000-8000-000000000022');
  select * into selected from public.carts where id=selected.id;
  if (select quantity from public.cart_items where id=item_id) <> 2 then
    raise exception 'Explicit quantity update failed'; end if;
  perform public.change_customer_cart('remove',item_id,1,selected.version,
    '73000000-0000-4000-8000-000000000023');
  select * into selected from public.carts where id=selected.id;
  if exists(select 1 from public.cart_items where id=item_id) then
    raise exception 'Explicit item removal failed'; end if;
  perform public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000002','53000000-0000-4000-8000-000000000002',1,
    '73000000-0000-4000-8000-000000000024');
  select * into selected from public.carts where id=selected.id;
  perform public.clear_customer_cart(selected.version,'73000000-0000-4000-8000-000000000025');
  if exists(select 1 from public.cart_items where cart_id=selected.id) then
    raise exception 'Explicit cart clear failed'; end if;
end $$;

-- Price changes are visible and block checkout until the owner accepts them.
reset role;
update public.products set price=12000 where id='43000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare added record; begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',2,
    '73000000-0000-4000-8000-000000000060');
end $$;
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare cart_json jsonb; selected_cart public.carts%rowtype; first_item uuid;
  result record; method_id uuid; checkout_order_id uuid; detail jsonb; address jsonb := '{
    "recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma",
    "exterior_number":"10","interior_number":null,"neighborhood":"Centro",
    "city":"Querétaro","state":"Querétaro","postal_code":"76000",
    "references":"Portón verde","country_code":"MX"}'::jsonb;
  saved record;
begin
  cart_json := public.get_customer_cart();
  if not (cart_json->>'has_issues')::boolean
    or not exists (select 1 from jsonb_array_elements(cart_json->'items') item where (item->>'price_changed')::boolean)
  then raise exception 'Price change was not detected'; end if;
  select * into selected_cart from public.carts where user_id=auth.uid() and status='active';
  select id into first_item from public.cart_items where cart_id=selected_cart.id
    and variant_id='53000000-0000-4000-8000-000000000001';
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  select * into saved from public.manage_customer_address('create', null, null,
    '{"label":"Casa","recipient_name":"Ana Pérez","phone":"4421234567",
      "street":"Reforma","exterior_number":"10","interior_number":null,
      "neighborhood":"Centro","city":"Querétaro","state":"Querétaro",
      "postal_code":"76000","references":"Portón verde","country_code":"MX",
      "is_default":true}'::jsonb);
  begin perform public.create_customer_checkout_order(selected_cart.id,selected_cart.version,
    method_id,saved.address_id,address,false,'73000000-0000-4000-8000-000000000030');
    raise exception 'Expected changed price checkout rejection';
  exception when serialization_failure then null; end;
  perform public.change_customer_cart('update',first_item,2,selected_cart.version,
    '73000000-0000-4000-8000-000000000031');
  select * into selected_cart from public.carts where id=selected_cart.id;
  select * into result from public.create_customer_checkout_order(selected_cart.id,selected_cart.version,
    method_id,saved.address_id,
    jsonb_set(address, '{street}', '"CALLE DEL NAVEGADOR"'),
    false,'73000000-0000-4000-8000-000000000032');
  if result.replayed or result.order_number !~ '^PG-W-[A-F0-9]{12}$' then raise exception 'Checkout result invalid'; end if;
  checkout_order_id := result.order_id;
  detail := public.get_customer_order(checkout_order_id);
  if detail is null or detail->>'status' <> 'pending_confirmation'
    or detail->'payment'->>'status' <> 'pending'
    or detail->'payment'->>'method' <> 'bank_transfer'
    or (detail->'payment'->>'expected_amount')::integer <> 64900
    or (detail->>'subtotal')::integer <> 50000
    or (detail->>'shipping_total')::integer <> 14900
    or (detail->>'discount_total')::integer <> 0
    or (detail->>'tax_total')::integer <> 0
    or (detail->>'total')::integer <> 64900
  then raise exception 'Checkout order fields or totals invalid: %', detail; end if;
  if (select o.payment_method from public.orders o where o.id=checkout_order_id)<>'bank_transfer'
    or (select o.payment_status from public.orders o where o.id=checkout_order_id)<>'transfer_pending'
  then raise exception 'Bank-transfer compatibility projection is inconsistent'; end if;
  if jsonb_array_length(detail->'payment'->'history') <> 1
  then raise exception 'Checkout payment was not created atomically'; end if;
  if detail->'shipping_address_snapshot'->>'street' <> 'Reforma'
  then raise exception 'Saved address was not resolved on the server: %', detail; end if;
  if jsonb_array_length(detail->'order_items') <> 2
    or (select (item->>'unit_price_snapshot')::integer
        from jsonb_array_elements(detail->'order_items') item
        where item->>'sku_snapshot'='BRPS-CHK-DRV-SNAPSHOT-090-R-N-999') <> 12000
    or (select (item->>'line_total')::integer
        from jsonb_array_elements(detail->'order_items') item
        where item->>'sku_snapshot'='CHECKOUT-V2') <> 26000
  then raise exception 'Checkout snapshots invalid'; end if;
  if (select status from public.carts where id=selected_cart.id) <> 'converted'
    then raise exception 'Cart was not converted'; end if;
  if (select count(*) from public.addresses where user_id=auth.uid()) <> 1
    then raise exception 'Explicit address save failed'; end if;
  select * into result from public.create_customer_checkout_order(selected_cart.id,selected_cart.version,
    method_id,saved.address_id,address,false,'73000000-0000-4000-8000-000000000032');
  if not result.replayed or result.order_id <> checkout_order_id then raise exception 'Checkout replay failed'; end if;
  detail := public.get_customer_order(checkout_order_id);
  if (select count(*) from public.list_customer_orders()) <> 1
    or jsonb_array_length(detail->'history') <> 1
  then raise exception 'Checkout replay duplicated data'; end if;
end $$;

-- A second buyer may prepare a cart before stock is reserved, but checkout loses
-- safely after the first buyer reserves two of the final three units.
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare selected_cart public.carts%rowtype; method_id uuid;
begin
  select * into selected_cart from public.carts
  where user_id=auth.uid() and status='active';
  if selected_cart.id is null then raise exception 'Second buyer cart fixture is missing'; end if;
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  begin
    perform public.create_customer_checkout_order(
      selected_cart.id,selected_cart.version,method_id,null,
      '{"recipient_name":"Beatriz","phone":"5512345678","street":"Reforma",
        "exterior_number":"11","neighborhood":"Centro","city":"CDMX",
        "state":"CDMX","postal_code":"01000","country_code":"MX"}'::jsonb,
      false,'73000000-0000-4000-8000-000000000061','bank_transfer');
    raise exception 'Competing checkout reserved stock twice';
  exception when check_violation then null; end;
  if (select status from public.carts where id=selected_cart.id)<>'active'
    or exists(select 1 from public.orders where user_id=auth.uid())
    or exists(select 1 from public.order_payments p join public.orders o on o.id=p.order_id
      where o.user_id=auth.uid())
  then raise exception 'Failed checkout left an order/payment or converted cart'; end if;
end $$;

-- Customer owns only their order and cannot execute operational transitions.
reset role;
do $$ begin
  if (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>3
    or (select quantity_reserved from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>2
    or (select count(*) from public.inventory_reservations r
      join public.orders o on o.id=r.order_id
      where o.user_id='13000000-0000-4000-8000-000000000001'
        and r.source='FIRST_PARTY' and r.status='ACTIVE')<>2
  then raise exception 'Competing buyer changed the first buyer reservation'; end if;
  if (select count(*) from public.inventory_reservations r
      join public.order_idempotency_keys k on k.order_id=r.order_id
      where k.idempotency_key='73000000-0000-4000-8000-000000000032'
        and r.source='FIRST_PARTY' and r.status='ACTIVE')<>2
  then raise exception 'Checkout did not create one active reservation per order item'; end if;
  if (select count(*) from public.inventory_movements m
      join public.inventory_reservations r on r.order_item_id=m.reference_id
      join public.order_idempotency_keys k on k.order_id=r.order_id
      where k.idempotency_key='73000000-0000-4000-8000-000000000032'
        and m.movement_type='reservation')<>2
  then raise exception 'Checkout reservation movements are not atomic'; end if;
end $$;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare owned uuid; begin
  select id into owned from public.list_customer_orders();
  if owned is null or (select count(*) from public.orders) <> 0
    or (select count(*) from public.order_items) <> 0
    then raise exception 'Customer order read policy failed'; end if;
  begin perform public.confirm_operational_order(owned,1,'73000000-0000-4000-8000-000000000040');
    raise exception 'Expected customer confirm denial'; exception when insufficient_privilege then null; end;
  begin perform public.cancel_operational_order(owned,1,'No autorizado','73000000-0000-4000-8000-000000000041');
    raise exception 'Expected customer cancel denial'; exception when insufficient_privilege then null; end;
end $$;

reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.orders) <> 0
    or (select count(*) from public.list_customer_orders()) <> 0
  then raise exception 'Foreign order is visible'; end if;
end $$;

-- The paid-payment transition consumes the reservation once. Operations
-- confirms order lifecycle without consuming First Party inventory again.
reset role;
update public.order_payments set status='paid', paid_at=now(), version=version+1
where order_id=(select id from public.orders
  where origin='web' and user_id='13000000-0000-4000-8000-000000000001');
do $$ begin
  if exists(select 1 from public.inventory_reservations r
    where r.order_id=(select id from public.orders
      where origin='web' and user_id='13000000-0000-4000-8000-000000000001')
      and r.status<>'COMMITTED')
    or exists(select 1 from public.inventory i join public.product_variants v on v.id=i.variant_id
      where v.id='53000000-0000-4000-8000-000000000001'
        and (i.quantity_on_hand<>1 or i.quantity_reserved<>0))
    or (select count(*) from public.inventory_movements m
      join public.inventory_reservations r on r.id=m.reference_id
      where r.order_id=(select id from public.orders
        where origin='web' and user_id='13000000-0000-4000-8000-000000000001')
        and m.movement_type='sale')<>2
  then raise exception 'Payment did not commit each First Party reservation exactly once'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare selected public.orders%rowtype; before_one integer; before_two integer;
begin
  select * into selected from public.orders
  where origin='web' and user_id='13000000-0000-4000-8000-000000000001';
  if selected.id is null then raise exception 'Operator cannot read web order'; end if;
  select quantity_on_hand into before_one from public.inventory where variant_id='53000000-0000-4000-8000-000000000001';
  select quantity_on_hand into before_two from public.inventory where variant_id='53000000-0000-4000-8000-000000000002';
  perform public.confirm_operational_order(selected.id,selected.version,'73000000-0000-4000-8000-000000000050');
  select * into selected from public.orders where id=selected.id;
  if selected.status <> 'preparing'
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001') <> before_one
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000002') <> before_two
    or (select count(*) from public.inventory_movements m
        join public.inventory_reservations r on r.id=m.reference_id
        where r.order_id=selected.id and m.movement_type='sale') <> 2
  then raise exception 'Operational confirmation failed'; end if;
  if (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001') <> before_one
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000002') <> before_two
    or exists(select 1 from public.inventory_reservations
      where order_id=selected.id and status<>'COMMITTED')
  then raise exception 'Operations confirmation consumed committed First Party stock twice'; end if;
end $$;

-- The competing buyer can now check out. A rejected payment releases only the
-- reservation and leaves on-hand stock unchanged.
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$
declare selected_cart public.carts%rowtype; method_id uuid; result record; cart_item_id uuid;
begin
  select * into selected_cart from public.carts
  where user_id=auth.uid() and status='active';
  select id into cart_item_id from public.cart_items where cart_id=selected_cart.id;
  perform public.change_customer_cart('update',cart_item_id,1,selected_cart.version,
    '73000000-0000-4000-8000-000000000067');
  select * into selected_cart from public.carts where id=selected_cart.id;
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  select * into result from public.create_customer_checkout_order(
    selected_cart.id,selected_cart.version,method_id,null,
    '{"recipient_name":"Beatriz","phone":"5512345678","street":"Reforma",
      "exterior_number":"11","neighborhood":"Centro","city":"CDMX",
      "state":"CDMX","postal_code":"01000","country_code":"MX"}'::jsonb,
    false,'73000000-0000-4000-8000-000000000062','bank_transfer');
  if result.replayed then raise exception 'Retry after stock release replayed an old order'; end if;
  perform set_config('test.checkout_rejected_order',result.order_id::text,true);
end $$;
reset role;
update public.order_payments set status='rejected',rejected_at=now(),version=version+1
where order_id=current_setting('test.checkout_rejected_order')::uuid;
do $$ begin
  if (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>1
    or (select quantity_reserved from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>0
    or (select status from public.inventory_reservations
      where order_id=current_setting('test.checkout_rejected_order')::uuid)<>'RELEASED'
  then raise exception 'Rejected payment did not release First Party reservation'; end if;
end $$;

-- Cancellation before payment releases an ACTIVE First Party reservation.
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare added record; selected_cart public.carts%rowtype; method_id uuid; result record; begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',1,
    '73000000-0000-4000-8000-000000000068');
  select * into selected_cart from public.carts where id=added.cart_id;
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  select * into result from public.create_customer_checkout_order(
    selected_cart.id,selected_cart.version,method_id,null,
    '{"recipient_name":"Beatriz","phone":"5512345678","street":"Reforma",
      "exterior_number":"11","neighborhood":"Centro","city":"CDMX",
      "state":"CDMX","postal_code":"01000","country_code":"MX"}'::jsonb,
    false,'73000000-0000-4000-8000-000000000069','bank_transfer');
  perform set_config('test.checkout_cancel_order',result.order_id::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  perform public.cancel_operational_order(
    current_setting('test.checkout_cancel_order')::uuid,1,
    'Cancelación antes del pago','73000000-0000-4000-8000-000000000070');
end $$;
reset role;
do $$ begin
  if (select status from public.inventory_reservations
      where order_id=current_setting('test.checkout_cancel_order')::uuid)<>'RELEASED'
    or (select quantity_on_hand from public.inventory
      where variant_id='53000000-0000-4000-8000-000000000001')<>1
    or (select quantity_reserved from public.inventory
      where variant_id='53000000-0000-4000-8000-000000000001')<>0
  then raise exception 'Pre-payment cancellation did not release First Party reservation'; end if;
end $$;

-- The shared expiry RPC also releases FIRST_PARTY reservations, then another
-- authenticated buyer can reserve the restored stock.
reset role;
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare added record; selected_cart public.carts%rowtype; method_id uuid; result record; begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000001',
    '53000000-0000-4000-8000-000000000001',1,
    '73000000-0000-4000-8000-000000000063');
  select * into selected_cart from public.carts where id=added.cart_id;
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  select * into result from public.create_customer_checkout_order(
    selected_cart.id,selected_cart.version,method_id,null,
    '{"recipient_name":"Ana","phone":"4421234567","street":"Reforma",
      "exterior_number":"10","neighborhood":"Centro","city":"Queretaro",
      "state":"Queretaro","postal_code":"76000","country_code":"MX"}'::jsonb,
    false,'73000000-0000-4000-8000-000000000064','bank_transfer');
  perform set_config('test.checkout_expired_order',result.order_id::text,true);
end $$;
reset role;
select set_config('peter_golf.marketplace_order_write','enabled',true);
update public.inventory_reservations set reserved_at=now()-interval '1 hour',
  expires_at=now()-interval '1 minute'
where order_id=current_setting('test.checkout_expired_order')::uuid;
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  if public.release_expired_marketplace_reservations(10)<>1 then
    raise exception 'Shared expiry RPC did not release one First Party reservation'; end if;
end $$;
reset role;
do $$ begin
  if (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>1
    or (select quantity_reserved from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')<>0
    or (select status from public.inventory_reservations
      where order_id=current_setting('test.checkout_expired_order')::uuid)<>'EXPIRED'
  then raise exception 'Expiry did not release First Party stock'; end if;
end $$;

-- Card pricing remains server-computed; the legacy order columns stay neutral
-- because their enums cannot express card. order_payments is authoritative.
insert into public.site_settings(key,value)
values ('stripe.checkout.mode','{"mode":"test"}'::jsonb)
on conflict(key) do update set value=excluded.value;
select set_config('peter_golf.inventory_rpc_write','enabled',true);
update public.inventory set quantity_on_hand=1,quantity_reserved=0
where variant_id='53000000-0000-4000-8000-000000000002';
select set_config('peter_golf.inventory_rpc_write','disabled',true);
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare added record; selected_cart public.carts%rowtype; method_id uuid; result record; begin
  select * into added from public.add_customer_cart_item(
    '43000000-0000-4000-8000-000000000002',
    '53000000-0000-4000-8000-000000000002',1,
    '73000000-0000-4000-8000-000000000065');
  select * into selected_cart from public.carts where id=added.cart_id;
  select shipping_method_id into method_id from public.get_customer_shipping_method();
  select * into result from public.create_customer_checkout_order(
    selected_cart.id,selected_cart.version,method_id,null,
    '{"recipient_name":"Beatriz","phone":"5512345678","street":"Reforma",
      "exterior_number":"11","neighborhood":"Centro","city":"CDMX",
      "state":"CDMX","postal_code":"01000","country_code":"MX"}'::jsonb,
    false,'73000000-0000-4000-8000-000000000066','card');
  perform set_config('test.checkout_card_order',result.order_id::text,true);
end $$;
reset role;
do $$ begin
  if (select p.method from public.order_payments p
      where p.order_id=current_setting('test.checkout_card_order')::uuid)<>'card'
    or (select p.provider from public.order_payments p
      where p.order_id=current_setting('test.checkout_card_order')::uuid)<>'stripe'
    or (select o.payment_method from public.orders o
      where o.id=current_setting('test.checkout_card_order')::uuid)<>'none'
    or (select o.payment_status from public.orders o
      where o.id=current_setting('test.checkout_card_order')::uuid)<>'pending'
  then raise exception 'Card order/payment compatibility projection is inconsistent'; end if;
end $$;
insert into public.stripe_checkout_sessions (
  payment_id,attempt_number,idempotency_key,payload_hash,
  stripe_checkout_session_id,status,amount_total,currency,created_by,expires_at
)
select p.id,1,'73000000-0000-4000-8000-000000000071',repeat('a',64),
  'cs_test_pr87_expiry_0001','open',p.expected_amount,p.currency,
  '13000000-0000-4000-8000-000000000002',now()+interval '30 minutes'
from public.order_payments p
where p.order_id=current_setting('test.checkout_card_order')::uuid;

do $$ begin
  if exists (
    select 1 from public.inventory_reservations r
    join public.order_payments p on p.order_id=r.order_id
    join public.stripe_checkout_sessions s on s.payment_id=p.id
    where r.order_id=current_setting('test.checkout_card_order')::uuid
      and r.expires_at<s.expires_at
  ) then raise exception 'Reservation expiry precedes payable Checkout expiry'; end if;
end $$;

do $$ declare attempt_id uuid; payment_id uuid; begin
  select s.id,s.payment_id into strict attempt_id,payment_id
  from public.stripe_checkout_sessions s
  where s.idempotency_key='73000000-0000-4000-8000-000000000071';
  perform set_config('test.checkout_fp_attempt',attempt_id::text,true);
  perform set_config('test.checkout_fp_payment',payment_id::text,true);
end $$;
set local role service_role;
do $$ begin
  perform public.process_stripe_webhook_event(
    'evt_pr88_fp_decline','payment_intent.payment_failed',now(),
    '2026-07-29.dahlia',false,repeat('b',64),null,
    current_setting('test.checkout_fp_attempt')::uuid,
    current_setting('test.checkout_fp_payment')::uuid,
    'pi_pr88_fp_decline',null,null,null,null,null,null,null);
  perform public.process_stripe_webhook_event(
    'evt_pr88_fp_decline','payment_intent.payment_failed',now(),
    '2026-07-29.dahlia',false,repeat('b',64),null,
    current_setting('test.checkout_fp_attempt')::uuid,
    current_setting('test.checkout_fp_payment')::uuid,
    'pi_pr88_fp_decline',null,null,null,null,null,null,null);
end $$;
reset role;
do $$ begin
  if (select p.status from public.order_payments p
      where p.order_id=current_setting('test.checkout_card_order')::uuid)<>'pending'
    or (select s.status from public.stripe_checkout_sessions s
      join public.order_payments p on p.id=s.payment_id
      where p.order_id=current_setting('test.checkout_card_order')::uuid)<>'open'
    or (select r.status from public.inventory_reservations r
      where r.order_id=current_setting('test.checkout_card_order')::uuid)<>'ACTIVE'
    or (select quantity_reserved from public.inventory
      where variant_id='53000000-0000-4000-8000-000000000002')<>1
    or exists(select 1 from public.inventory_movements m
      join public.inventory_reservations r on r.id=m.reference_id
      where r.order_id=current_setting('test.checkout_card_order')::uuid
        and m.movement_type='release')
  then raise exception 'First Party decline released or closed retryable Checkout'; end if;
end $$;

-- The other buyer remains blocked before a second order/Session can be made.
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin
    perform public.add_customer_cart_item(
      '43000000-0000-4000-8000-000000000002',
      '53000000-0000-4000-8000-000000000002',1,
      '73000000-0000-4000-8000-000000000072');
    raise exception 'Competing buyer acquired reserved last unit';
  exception when check_violation then null; end;
end $$;
reset role;

-- Operations cannot release stock while the same provider Session is payable.
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  begin
    perform public.cancel_operational_order(
      current_setting('test.checkout_card_order')::uuid,1,
      'Intento durante Checkout vigente',
      '73000000-0000-4000-8000-000000000073');
    raise exception 'Cancellation released a payable Stripe reservation';
  exception when check_violation then null; end;
end $$;
reset role;

set local role service_role;
do $$ begin
  perform public.process_stripe_webhook_event(
    'evt_pr88_fp_expired','checkout.session.expired',now()+interval '30 minutes',
    '2026-07-29.dahlia',false,repeat('c',64),
    'cs_test_pr87_expiry_0001',null,null,null,null,null,null,null,null,null,null);
end $$;
reset role;
do $$ begin
  if (select status from public.inventory_reservations
      where order_id=current_setting('test.checkout_card_order')::uuid)<>'EXPIRED'
    or (select quantity_reserved from public.inventory
      where variant_id='53000000-0000-4000-8000-000000000002')<>0
    or (select status from public.order_payments
      where order_id=current_setting('test.checkout_card_order')::uuid)<>'pending'
  then raise exception 'Decline then Stripe expiry did not release First Party stock once'; end if;
end $$;

rollback;
