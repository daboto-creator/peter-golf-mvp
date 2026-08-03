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
 ('53000000-0000-4000-8000-000000000001','43000000-0000-4000-8000-000000000001','CHECKOUT-V1','Variante uno',null),
 ('53000000-0000-4000-8000-000000000002','43000000-0000-4000-8000-000000000002','CHECKOUT-V2','Variante dos',26000),
 ('53000000-0000-4000-8000-000000000003','43000000-0000-4000-8000-000000000001','CHECKOUT-INACTIVE','Variante inactiva',null),
 ('53000000-0000-4000-8000-000000000004','43000000-0000-4000-8000-000000000001','CHECKOUT-ARCHIVED','Variante archivada',null),
 ('53000000-0000-4000-8000-000000000005','43000000-0000-4000-8000-000000000003','CHECKOUT-DRAFT-V','Variante borrador',null);
update public.product_variants set active=false where id='53000000-0000-4000-8000-000000000003';
update public.product_variants set archived_at=now() where id='53000000-0000-4000-8000-000000000004';
insert into public.inventory (id,variant_id,quantity_on_hand,quantity_reserved)
values
 ('63000000-0000-4000-8000-000000000001','53000000-0000-4000-8000-000000000001',10,0),
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
select set_config('request.jwt.claim.sub','13000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare cart_json jsonb; selected_cart public.carts%rowtype; first_item uuid;
  result record; method_id uuid; order_id uuid; detail jsonb; address jsonb := '{
    "recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma",
    "exterior_number":"10","interior_number":null,"neighborhood":"Centro",
    "city":"Querétaro","state":"Querétaro","postal_code":"76000",
    "references":"Portón verde","country_code":"MX"}'::jsonb;
  stock_one integer; stock_two integer; saved record;
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
  perform public.change_customer_cart('update',first_item,3,selected_cart.version,
    '73000000-0000-4000-8000-000000000031');
  select * into selected_cart from public.carts where id=selected_cart.id;
  select quantity_on_hand into stock_one from public.inventory where variant_id='53000000-0000-4000-8000-000000000001';
  select quantity_on_hand into stock_two from public.inventory where variant_id='53000000-0000-4000-8000-000000000002';
  select * into result from public.create_customer_checkout_order(selected_cart.id,selected_cart.version,
    method_id,saved.address_id,
    jsonb_set(address, '{street}', '"CALLE DEL NAVEGADOR"'),
    false,'73000000-0000-4000-8000-000000000032');
  if result.replayed or result.order_number !~ '^PG-W-[A-F0-9]{12}$' then raise exception 'Checkout result invalid'; end if;
  order_id := result.order_id;
  detail := public.get_customer_order(order_id);
  if detail is null or detail->>'status' <> 'pending_confirmation'
    or detail->'payment'->>'status' <> 'pending'
    or detail->'payment'->>'method' <> 'bank_transfer'
    or (detail->'payment'->>'expected_amount')::integer <> 76900
    or (detail->>'subtotal')::integer <> 62000
    or (detail->>'shipping_total')::integer <> 14900
    or (detail->>'discount_total')::integer <> 0
    or (detail->>'tax_total')::integer <> 0
    or (detail->>'total')::integer <> 76900
  then raise exception 'Checkout order fields or totals invalid: %', detail; end if;
  if jsonb_array_length(detail->'payment'->'history') <> 1
  then raise exception 'Checkout payment was not created atomically'; end if;
  if detail->'shipping_address_snapshot'->>'street' <> 'Reforma'
  then raise exception 'Saved address was not resolved on the server: %', detail; end if;
  if jsonb_array_length(detail->'order_items') <> 2
    or (select (item->>'unit_price_snapshot')::integer
        from jsonb_array_elements(detail->'order_items') item
        where item->>'sku_snapshot'='CHECKOUT-V1') <> 12000
    or (select (item->>'line_total')::integer
        from jsonb_array_elements(detail->'order_items') item
        where item->>'sku_snapshot'='CHECKOUT-V2') <> 26000
  then raise exception 'Checkout snapshots invalid'; end if;
  if (select status from public.carts where id=selected_cart.id) <> 'converted'
    then raise exception 'Cart was not converted'; end if;
  if stock_one <> (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001')
    or stock_two <> (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000002')
  then raise exception 'Checkout changed inventory'; end if;
  if (select count(*) from public.addresses where user_id=auth.uid()) <> 1
    then raise exception 'Explicit address save failed'; end if;
  select * into result from public.create_customer_checkout_order(selected_cart.id,selected_cart.version,
    method_id,saved.address_id,address,false,'73000000-0000-4000-8000-000000000032');
  if not result.replayed or result.order_id <> order_id then raise exception 'Checkout replay failed'; end if;
  detail := public.get_customer_order(order_id);
  if (select count(*) from public.list_customer_orders()) <> 1
    or jsonb_array_length(detail->'history') <> 1
  then raise exception 'Checkout replay duplicated data'; end if;
end $$;

-- Customer owns only their order and cannot execute operational transitions.
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

-- Operator sees, confirms and cancels the unpaid web order. Stock is
-- deducted exactly on confirmation and returned exactly on cancellation.
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
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001') <> before_one-3
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000002') <> before_two-1
    or (select count(*) from public.inventory_movements where reference_id=selected.id and movement_type='sale') <> 2
  then raise exception 'Operational confirmation failed'; end if;
  perform public.cancel_operational_order(selected.id,selected.version,'Cancelación local','73000000-0000-4000-8000-000000000051');
  if (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000001') <> before_one
    or (select quantity_on_hand from public.inventory where variant_id='53000000-0000-4000-8000-000000000002') <> before_two
    or (select count(*) from public.order_status_history where order_id=selected.id) <> 3
  then raise exception 'Operational cancellation failed'; end if;
end $$;

rollback;
