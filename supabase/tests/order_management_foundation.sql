-- Reproducible local verification for manual order management.
-- Run after migrations with:
-- docker exec -i supabase_db_peter-golf-mvp psql -U postgres -d postgres \
--   -v ON_ERROR_STOP=1 < supabase/tests/order_management_foundation.sql

begin;

insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('12000000-0000-4000-8000-000000000001','authenticated','authenticated','orders.operator@example.test','{}','{}',now(),now()),
  ('12000000-0000-4000-8000-000000000002','authenticated','authenticated','orders.admin@example.test','{}','{}',now(),now()),
  ('12000000-0000-4000-8000-000000000003','authenticated','authenticated','orders.customer@example.test','{}','{}',now(),now());
insert into public.user_roles (user_id, role_id)
select '12000000-0000-4000-8000-000000000001'::uuid, id from public.roles where name='operator'
union all select '12000000-0000-4000-8000-000000000002'::uuid, id from public.roles where name='admin';

insert into public.brands (id,slug,name) values ('22000000-0000-4000-8000-000000000001','orders-test-brand','Orders Test Brand');
insert into public.categories (id,slug,name) values ('32000000-0000-4000-8000-000000000001','orders-test-category','Orders Test Category');
insert into public.products (id,slug,sku,name,condition,brand_id,category_id,status,fulfillment_type,price,published)
values
 ('42000000-0000-4000-8000-000000000001','orders-product-one','ORDER-P1','Order Product One','new','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','active','in_stock',10000,true),
 ('42000000-0000-4000-8000-000000000002','orders-product-two','ORDER-P2','Order Product Two','new','22000000-0000-4000-8000-000000000001','32000000-0000-4000-8000-000000000001','active','in_stock',25000,true);
insert into public.product_variants (id,product_id,sku,name,price)
values
 ('52000000-0000-4000-8000-000000000001','42000000-0000-4000-8000-000000000001','ORDER-V1','Order Variant One',null),
 ('52000000-0000-4000-8000-000000000002','42000000-0000-4000-8000-000000000002','ORDER-V2','Order Variant Two',26000);

-- Customer has no order management access and sees no manual orders.
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  if public.can_manage_orders() then raise exception 'Customer unexpectedly manages orders'; end if;
  begin
    perform public.create_manual_order('{"items":[]}'::jsonb,'62000000-0000-4000-8000-000000000001');
    raise exception 'Expected customer creation denial';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.orders where created_by is not null) <> 0 then
    raise exception 'Customer can read manual orders'; end if;
end $$;

-- Operator provisions test stock using the existing auditable RPC.
reset role;
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000001',true);
set local role authenticated;
select * from public.adjust_inventory('52000000-0000-4000-8000-000000000001','receipt',10,'Stock para pedidos','62000000-0000-4000-8000-000000000010');
select * from public.adjust_inventory('52000000-0000-4000-8000-000000000002','receipt',5,'Stock para pedidos','62000000-0000-4000-8000-000000000011');

do $$
declare
  payload jsonb := '{
    "customer_name":" Ana Pérez ","customer_email":" ANA@EXAMPLE.TEST ",
    "customer_phone":"4421234567","origin_channel":"whatsapp",
    "address":{"recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma","exterior_number":"10","interior_number":"","neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000","references":"Portón verde"},
    "shipping_total":1500,"discount_total":1000,"discount_reason":"Promoción manual",
    "internal_note":"Prueba local","items":[
      {"product_id":"42000000-0000-4000-8000-000000000001","variant_id":"52000000-0000-4000-8000-000000000001","quantity":2},
      {"product_id":"42000000-0000-4000-8000-000000000002","variant_id":"52000000-0000-4000-8000-000000000002","quantity":1}
    ]}'::jsonb;
  created record; replay record; selected public.orders%rowtype;
  movement_count integer; before_one integer; before_two integer;
  audited_order_id uuid;
begin
  select * into created from public.create_manual_order(payload,'62000000-0000-4000-8000-000000000020');
  audited_order_id := created.order_id;
  if created.replayed or created.order_number !~ '^PG-M-[A-F0-9]{12}$' then
    raise exception 'Creation result or number invalid'; end if;
  select * into selected from public.orders where id=created.order_id;
  if selected.status <> 'pending_confirmation' or selected.subtotal <> 46000
    or selected.discount_total <> 1000 or selected.shipping_total <> 1500
    or selected.total <> 46500 or selected.customer_email <> 'ana@example.test'
  then raise exception 'Server totals or normalized customer invalid: %', row_to_json(selected); end if;
  if (select count(*) from public.order_items where order_id=created.order_id) <> 2
    or (select unit_price_snapshot from public.order_items where order_id=created.order_id and variant_id='52000000-0000-4000-8000-000000000001') <> 10000
    or (select unit_price_snapshot from public.order_items where order_id=created.order_id and variant_id='52000000-0000-4000-8000-000000000002') <> 26000
  then raise exception 'Snapshots invalid'; end if;
  if (select count(*) from public.order_status_history where order_id=audited_order_id) <> 1
    or not exists (
      select 1 from public.order_status_history
      where order_id=audited_order_id
        and from_status is null
        and to_status='pending_confirmation'
        and changed_by='12000000-0000-4000-8000-000000000001'
    )
  then raise exception 'Draft status history audit is invalid'; end if;
  -- Rewrite the draft with the expected version, exercising optimistic
  -- concurrency before state transitions.
  perform public.update_manual_order_draft(created.order_id, 1, payload);
  select * into selected from public.orders where id=created.order_id;
  select quantity_on_hand into before_one from public.inventory where variant_id='52000000-0000-4000-8000-000000000001';
  if before_one <> 10 then raise exception 'Draft changed inventory'; end if;

  select * into replay from public.create_manual_order(payload,'62000000-0000-4000-8000-000000000020');
  if not replay.replayed or replay.order_id <> created.order_id then raise exception 'Create replay failed'; end if;
  begin
    perform public.create_manual_order(payload || '{"customer_phone":"4420000000"}', '62000000-0000-4000-8000-000000000020');
    raise exception 'Expected idempotency conflict';
  exception when unique_violation then null; end;

  -- Invalid, empty and mismatched items fail before any order persists.
  begin perform public.create_manual_order(payload || '{"items":[]}', '62000000-0000-4000-8000-000000000021');
    raise exception 'Expected empty rejection'; exception when invalid_parameter_value then null; end;
  begin perform public.create_manual_order(payload || '{"items":[{"product_id":"42000000-0000-4000-8000-000000000001","variant_id":"52000000-0000-4000-8000-000000000001","quantity":0}]}', '62000000-0000-4000-8000-000000000022');
    raise exception 'Expected quantity rejection'; exception when invalid_parameter_value then null; end;
  begin perform public.create_manual_order(payload || '{"items":[{"product_id":"42000000-0000-4000-8000-000000000002","variant_id":"52000000-0000-4000-8000-000000000001","quantity":1}]}', '62000000-0000-4000-8000-000000000023');
    raise exception 'Expected relationship rejection'; exception when invalid_parameter_value then null; end;

  perform public.confirm_manual_order(created.order_id,2,'62000000-0000-4000-8000-000000000030');
  select quantity_on_hand into before_one from public.inventory where variant_id='52000000-0000-4000-8000-000000000001';
  select quantity_on_hand into before_two from public.inventory where variant_id='52000000-0000-4000-8000-000000000002';
  select count(*) into movement_count from public.inventory_movements where reference_type='manual_order' and reference_id=created.order_id and movement_type='sale';
  if before_one<>8 or before_two<>4 or movement_count<>2 then raise exception 'Atomic confirmation incorrect'; end if;
  if (select count(*) from public.order_status_history where order_id=audited_order_id and from_status='pending_confirmation' and to_status='preparing' and changed_by='12000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.order_status_history where order_id=audited_order_id) <> 2
  then raise exception 'Confirmation status history audit is invalid'; end if;
  select * into replay from public.confirm_manual_order(created.order_id,2,'62000000-0000-4000-8000-000000000030');
  if not replay.replayed then raise exception 'Confirm replay failed'; end if;
  if (select count(*) from public.inventory_movements where reference_id=created.order_id and movement_type='sale')<>2 then raise exception 'Double sale'; end if;
  if (select count(*) from public.order_status_history where order_id=audited_order_id) <> 2
  then raise exception 'Confirm replay duplicated status history'; end if;
  begin perform public.update_manual_order_draft(created.order_id,3,payload); raise exception 'Expected confirmed edit denial';
    exception when invalid_parameter_value then null; end;

  perform public.cancel_manual_order(created.order_id,3,'Cliente desistió','62000000-0000-4000-8000-000000000040');
  if (select quantity_on_hand from public.inventory where variant_id='52000000-0000-4000-8000-000000000001')<>10
    or (select quantity_on_hand from public.inventory where variant_id='52000000-0000-4000-8000-000000000002')<>5
    or (select count(*) from public.inventory_movements where reference_id=created.order_id and movement_type='return')<>2
  then raise exception 'Cancellation return incorrect'; end if;
  if (select count(*) from public.order_status_history where order_id=audited_order_id and from_status='preparing' and to_status='cancelled' and changed_by='12000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.order_status_history where order_id=audited_order_id) <> 3
  then raise exception 'Cancellation status history audit is invalid'; end if;
  select * into replay from public.cancel_manual_order(created.order_id,3,'Cliente desistió','62000000-0000-4000-8000-000000000040');
  if not replay.replayed then raise exception 'Cancel replay failed'; end if;
  if (select count(*) from public.order_status_history where order_id=audited_order_id) <> 3
  then raise exception 'Cancel replay duplicated status history'; end if;
  begin perform public.confirm_manual_order(created.order_id,4,'62000000-0000-4000-8000-000000000041'); raise exception 'Expected cancelled confirm denial';
    exception when invalid_parameter_value then null; end;

  -- A multi-item shortage rolls back the earlier line and all movements.
  select * into created from public.create_manual_order(payload || '{"discount_total":0,"discount_reason":null,"items":[{"product_id":"42000000-0000-4000-8000-000000000001","variant_id":"52000000-0000-4000-8000-000000000001","quantity":1},{"product_id":"42000000-0000-4000-8000-000000000002","variant_id":"52000000-0000-4000-8000-000000000002","quantity":6}]}','62000000-0000-4000-8000-000000000050');
  begin perform public.confirm_manual_order(created.order_id,1,'62000000-0000-4000-8000-000000000051'); raise exception 'Expected shortage';
    exception when check_violation then null; end;
  if (select quantity_on_hand from public.inventory where variant_id='52000000-0000-4000-8000-000000000001')<>10
    or exists(select 1 from public.inventory_movements where reference_id=created.order_id)
  then raise exception 'Shortage was not atomic'; end if;

  begin delete from public.orders where id=created.order_id; raise exception 'Expected physical delete denial';
    exception when insufficient_privilege then null; end;
end $$;

-- The existing immutable-history trigger rejects physical rewrites even for
-- the table owner, independently of the operator's lack of write grants.
reset role;
do $$
declare history_id uuid;
begin
  select order_status_history.id into history_id
  from public.order_status_history
  inner join public.order_idempotency_keys
    on order_idempotency_keys.order_id = order_status_history.order_id
  where order_idempotency_keys.idempotency_key = '62000000-0000-4000-8000-000000000020'
  order by order_status_history.created_at
  limit 1;
  if history_id is null then raise exception 'Audited history entry not found'; end if;
  begin
    update public.order_status_history set note='Rewritten' where id=history_id;
    raise exception 'Expected status history update rejection';
  exception when object_not_in_prerequisite_state then null; end;
  begin
    delete from public.order_status_history where id=history_id;
    raise exception 'Expected status history delete rejection';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Admin is independently authorized to create a draft.
select set_config('request.jwt.claim.sub','12000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare created record; begin
  if not public.can_manage_orders() then raise exception 'Admin not authorized'; end if;
  select * into created from public.create_manual_order('{
    "customer_name":"Admin Test","customer_email":"","customer_phone":"4421234567","origin_channel":"in_person",
    "address":{"recipient_name":"Admin Test","phone":"4421234567","street":"Uno","exterior_number":"1","neighborhood":"Centro","city":"Querétaro","state":"Querétaro","postal_code":"76000"},
    "shipping_total":0,"discount_total":0,"items":[{"product_id":"42000000-0000-4000-8000-000000000001","variant_id":"52000000-0000-4000-8000-000000000001","quantity":1}]}'::jsonb,'62000000-0000-4000-8000-000000000060');
  if created.order_id is null then raise exception 'Admin creation failed'; end if;
end $$;

reset role;
select 'order management foundation checks passed' as result;
rollback;
