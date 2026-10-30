-- Transactional regression for First Party refund inventory disposition.
begin;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('19000000-0000-4000-8000-000000000001','authenticated','authenticated','recovery.buyer@example.test','{}','{}',now(),now()),
 ('19000000-0000-4000-8000-000000000002','authenticated','authenticated','recovery.ops@example.test','{}','{}',now(),now()),
 ('19000000-0000-4000-8000-000000000003','authenticated','authenticated','recovery.partner@example.test','{}','{}',now(),now());
insert into public.user_roles(user_id,role_id)
select '19000000-0000-4000-8000-000000000002',id from public.roles where name='operator';

insert into public.brands(id,slug,name) values('29000000-0000-4000-8000-000000000001','recovery-brand','Recovery Brand');
insert into public.categories(id,slug,name) values('39000000-0000-4000-8000-000000000001','recovery-category','Recovery Category');
insert into public.products(id,slug,sku,name,condition,brand_id,category_id,status,fulfillment_type,price,published)
values('49000000-0000-4000-8000-000000000001','recovery-product','REC-P1','Recovery Product','new',
 '29000000-0000-4000-8000-000000000001','39000000-0000-4000-8000-000000000001','active','in_stock',10000,true);
insert into public.product_variants(id,product_id,sku,name)
values('59000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','REC-V1','Recovery Variant');
insert into public.inventory(id,variant_id,quantity_on_hand)
values('69000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001',20);
insert into public.partner_profiles(user_id,legal_type)
values('19000000-0000-4000-8000-000000000003','INDIVIDUAL');

insert into public.orders(id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,
 confirmed_at,confirmed_by,origin)
values
 ('79000000-0000-4000-8000-000000000001','PG-W-RECOVERY-0001','19000000-0000-4000-8000-000000000001','preparing',10000,10000,'{"recipient_name":"Buyer","street":"Test"}',now(),'19000000-0000-4000-8000-000000000002','web'),
 ('79000000-0000-4000-8000-000000000002','PG-W-RECOVERY-0002','19000000-0000-4000-8000-000000000001','preparing',10000,10000,'{"recipient_name":"Buyer","street":"Test"}',now(),'19000000-0000-4000-8000-000000000002','web'),
 ('79000000-0000-4000-8000-000000000003','PG-W-RECOVERY-0003','19000000-0000-4000-8000-000000000001','preparing',10000,10000,'{"recipient_name":"Buyer","street":"Test"}',now(),'19000000-0000-4000-8000-000000000002','web'),
 ('79000000-0000-4000-8000-000000000004','PG-W-RECOVERY-0004','19000000-0000-4000-8000-000000000001','preparing',10000,10000,'{"recipient_name":"Buyer","street":"Test"}',now(),'19000000-0000-4000-8000-000000000002','web');

insert into public.order_fulfillments(id,order_id,source,status,shipped_at)
values
 ('89000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','BEST_ROUND','PREPARING',null),
 ('89000000-0000-4000-8000-000000000002','79000000-0000-4000-8000-000000000002','BEST_ROUND','SHIPPED',now()),
 ('89000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000003','BEST_ROUND','DELIVERED',now()),
 ('89000000-0000-4000-8000-000000000004','79000000-0000-4000-8000-000000000004','BEST_ROUND','PREPARING',null);

insert into public.order_items(id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,
 variant_name_snapshot,condition_snapshot,unit_price_snapshot,quantity,line_total,fulfillment_id)
values
 ('99000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001','REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'89000000-0000-4000-8000-000000000001'),
 ('99000000-0000-4000-8000-000000000002','79000000-0000-4000-8000-000000000002','49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001','REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'89000000-0000-4000-8000-000000000002'),
 ('99000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000003','49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001','REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'89000000-0000-4000-8000-000000000003'),
 ('99000000-0000-4000-8000-000000000004','79000000-0000-4000-8000-000000000004','49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001','REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'89000000-0000-4000-8000-000000000004');

insert into public.order_payments(id,order_id,provider,method,status,expected_amount,currency,paid_at)
values
 ('a9000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000001','stripe','card','pending',10000,'MXN',null),
 ('a9000000-0000-4000-8000-000000000002','79000000-0000-4000-8000-000000000002','stripe','card','paid',10000,'MXN',now()),
 ('a9000000-0000-4000-8000-000000000003','79000000-0000-4000-8000-000000000003','stripe','card','paid',10000,'MXN',now()),
 ('a9000000-0000-4000-8000-000000000004','79000000-0000-4000-8000-000000000004','stripe','card','paid',10000,'MXN',now());

-- One unpaid checkout reservation plus three already-sold units. The first
-- line will be committed by the real Stripe completion event below.
update public.inventory set quantity_on_hand=17,quantity_reserved=1 where id='69000000-0000-4000-8000-000000000001';
insert into public.inventory_reservations(order_id,order_item_id,source,inventory_id,quantity,
 idempotency_key,expires_at)
values('79000000-0000-4000-8000-000000000001','99000000-0000-4000-8000-000000000001',
 'FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'recovery-test:order-1',now()+interval '30 minutes');
insert into public.inventory_reservations(order_id,order_item_id,source,inventory_id,quantity,
 status,idempotency_key,expires_at,committed_at)
values
 ('79000000-0000-4000-8000-000000000002','99000000-0000-4000-8000-000000000002','FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'COMMITTED','recovery-test:order-2',now()+interval '30 minutes',now()),
 ('79000000-0000-4000-8000-000000000003','99000000-0000-4000-8000-000000000003','FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'COMMITTED','recovery-test:order-3',now()+interval '30 minutes',now()),
 ('79000000-0000-4000-8000-000000000004','99000000-0000-4000-8000-000000000004','FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'COMMITTED','recovery-test:order-4',now()+interval '30 minutes',now());
insert into public.stripe_checkout_sessions(payment_id,attempt_number,idempotency_key,payload_hash,
 stripe_checkout_session_id,stripe_payment_intent_id,status,amount_total,currency,created_by,expires_at)
values('a9000000-0000-4000-8000-000000000001',1,'d9000000-0000-4000-8000-000000000001',repeat('a',64),
 'cs_test_recovery_pre','pi_recovery_pre','open',10000,'MXN','19000000-0000-4000-8000-000000000001',now()+interval '30 minutes');
insert into public.inventory_movements(inventory_id,movement_type,quantity_delta,quantity_on_hand_after,
 quantity_reserved_after,reason,reference_type,reference_id,actor_id,idempotency_key)
values
 ('69000000-0000-4000-8000-000000000001','sale',-1,19,1,'Fixture sale','order','79000000-0000-4000-8000-000000000002','19000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000002'),
 ('69000000-0000-4000-8000-000000000001','sale',-1,18,1,'Fixture sale','order','79000000-0000-4000-8000-000000000003','19000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000003'),
 ('69000000-0000-4000-8000-000000000001','sale',-1,17,1,'Fixture sale','order','79000000-0000-4000-8000-000000000004','19000000-0000-4000-8000-000000000002','b9000000-0000-4000-8000-000000000004');

-- A real Stripe completion commits the reservation. The subsequent successful
-- Stripe refund webhook creates and resolves the physical recovery atomically.
select set_config('test.recovery_attempt_id',
  (select id::text from public.stripe_checkout_sessions
    where stripe_checkout_session_id='cs_test_recovery_pre'),true);
set local role service_role;
do $$ begin
 perform public.process_stripe_webhook_event('evt_recovery_paid','checkout.session.completed',now(),
   '2026-07-29.dahlia',false,repeat('b',64),'cs_test_recovery_pre',
   current_setting('test.recovery_attempt_id')::uuid,'a9000000-0000-4000-8000-000000000001',
   'pi_recovery_pre',10000,'MXN','paid',null,null,null,null);
 perform public.process_stripe_webhook_event('evt_recovery_refund','refund.updated',now()+interval '1 second',
   '2026-07-29.dahlia',false,repeat('c',64),null,null,null,'pi_recovery_pre',10000,'MXN',null,
   're_recovery_pre','succeeded',null,now());
 perform public.process_stripe_webhook_event('evt_recovery_refund','refund.updated',now()+interval '1 second',
   '2026-07-29.dahlia',false,repeat('c',64),null,null,null,'pi_recovery_pre',10000,'MXN',null,
   're_recovery_pre','succeeded',null,now());
end $$;
reset role;
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>17
   or (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000001')<>'RESTOCKED'
   or (select count(*) from public.inventory_movements where reference_type='inventory_recovery')<>1
 then raise exception 'Pre-handoff refund did not restore exactly once'; end if;
end $$;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare o public.orders%rowtype; begin
 select * into strict o from public.orders where id='79000000-0000-4000-8000-000000000001';
 perform public.cancel_operational_order(o.id,o.version,'Refund confirmed before fulfillment',
   'c9000000-0000-4000-8000-000000000006');
 perform public.cancel_operational_order(o.id,o.version,'Refund confirmed before fulfillment',
   'c9000000-0000-4000-8000-000000000006');
end $$;
reset role;
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>17
   or (select status from public.orders where id='79000000-0000-4000-8000-000000000001')<>'cancelled'
 then raise exception 'Post-refund cancellation duplicated pre-handoff recovery'; end if;
end $$;
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>17
 then raise exception 'Refund webhook replay duplicated stock'; end if;
end $$;

-- A refund after handoff creates a pending case without changing sellable stock.
select set_config('peter_golf.payment_rpc_write','enabled',true);
update public.order_payments set status='refunded',refunded_amount=expected_amount,refunded_at=now(),version=version+1
where id='a9000000-0000-4000-8000-000000000002';
select set_config('peter_golf.payment_rpc_write','disabled',true);
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>17
   or (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002')<>'PENDING'
 then raise exception 'Post-handoff refund changed sellable stock or failed to queue disposition'; end if;
end $$;

-- Anonymous callers cannot invoke the Ops recovery RPC.
select set_config('test.recovery_pending_case_id',
  (select id::text from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002'),true);
set local role anon;
do $$ begin
 begin perform public.resolve_first_party_inventory_recovery(current_setting('test.recovery_pending_case_id')::uuid,1,'RESTOCKABLE','Anonymous attempt denied',
   'c9000000-0000-4000-8000-000000000005');
   raise exception 'Anonymous caller unexpectedly resolved recovery';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Only Ops can restore physically received stock. Same-key replay is safe.
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare c public.inventory_recovery_cases%rowtype; begin
 select * into c from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002';
 if (select count(*) from public.get_order_inventory_recovery_cases(c.order_id))<>1 then
   raise exception 'Ops recovery read projection is incomplete'; end if;
 perform public.resolve_first_party_inventory_recovery(c.id,c.version,'RESTOCKABLE','Physical return inspected and accepted',
   'c9000000-0000-4000-8000-000000000001');
 perform public.resolve_first_party_inventory_recovery(c.id,c.version,'RESTOCKABLE','Physical return inspected and accepted',
   'c9000000-0000-4000-8000-000000000001');
end $$;
reset role;
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>18
   or (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002')<>'RESTOCKED'
   or (select count(*) from public.inventory_movements where reference_id=(select id from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002'))<>1
 then raise exception 'Ops restock or replay was not exactly once: qty %, status %, movements %',
   (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001'),
   (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002'),
   (select count(*) from public.inventory_movements where reference_id=(select id from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000002'));
 end if;
end $$;

-- A non-restockable return resolves without inventory increase.
select set_config('peter_golf.payment_rpc_write','enabled',true);
update public.order_payments set status='refunded',refunded_amount=expected_amount,refunded_at=now(),version=version+1
where id='a9000000-0000-4000-8000-000000000003';
select set_config('peter_golf.payment_rpc_write','disabled',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare c public.inventory_recovery_cases%rowtype; begin
 select * into c from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000003';
 perform public.resolve_first_party_inventory_recovery(c.id,c.version,'DAMAGED','Packaging and club head are damaged',
   'c9000000-0000-4000-8000-000000000002');
end $$;
reset role;
do $$ begin
 if (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>18
   or (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000003')<>'NOT_RESTOCKED'
 then raise exception 'Non-restockable disposition changed stock'; end if;
end $$;

-- Failed financial refund cannot create an operational recovery case.
insert into public.stripe_refunds(payment_id,stripe_refund_id,stripe_payment_intent_id,amount,currency,status,
 stripe_created_at,last_event_created_at,failure_reason)
values('a9000000-0000-4000-8000-000000000004','re_recovery_failed','pi_recovery_failed',10000,'MXN','failed',now(),now(),'card_declined');
do $$ begin
 if exists(select 1 from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000004')
   or (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>18
 then raise exception 'Failed refund triggered inventory recovery'; end if;
end $$;

-- Unauthorized buyer and Partner cannot resolve an Ops case.
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare c public.inventory_recovery_cases%rowtype; begin
 select * into c from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000003';
 begin perform public.resolve_first_party_inventory_recovery(c.id,c.version,'OTHER','Denied buyer action',
   'c9000000-0000-4000-8000-000000000003');
   raise exception 'Buyer unexpectedly resolved recovery';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
do $$ declare direct_count integer; begin
 begin update public.inventory_recovery_cases set status='RESTOCKED'
   where order_item_id='99000000-0000-4000-8000-000000000003';
   raise exception 'Direct recovery table update unexpectedly succeeded';
 exception when insufficient_privilege then null; end;
 begin select count(*) into strict direct_count from public.get_order_inventory_recovery_cases(
   '79000000-0000-4000-8000-000000000003');
   raise exception 'Partner called the Ops recovery read';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare c public.inventory_recovery_cases%rowtype; begin
 select * into c from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000003';
 begin perform public.resolve_first_party_inventory_recovery(c.id,c.version,'OTHER','Denied Partner action',
   'c9000000-0000-4000-8000-000000000004');
   raise exception 'Partner unexpectedly resolved recovery';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Normal Stripe checkout remains pending_confirmation and has no fulfillment
-- row yet. A full successful refund in this real pre-confirmation domain state
-- must return committed stock exactly once.
insert into public.orders(id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,origin)
values('79000000-0000-4000-8000-000000000005','PG-W-RECOVERY-0005',
 '19000000-0000-4000-8000-000000000001','pending_confirmation',10000,10000,
 '{"recipient_name":"Buyer","street":"Test"}','web');
insert into public.order_items(id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,
 variant_name_snapshot,condition_snapshot,unit_price_snapshot,quantity,line_total,item_source)
values('99000000-0000-4000-8000-000000000005','79000000-0000-4000-8000-000000000005',
 '49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001',
 'REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'FIRST_PARTY');
insert into public.order_payments(id,order_id,provider,method,status,expected_amount,refunded_amount,currency,paid_at)
values('a9000000-0000-4000-8000-000000000005','79000000-0000-4000-8000-000000000005',
 'stripe','card','pending',10000,0,'MXN',null);
select set_config('peter_golf.inventory_rpc_write','enabled',true);
update public.inventory set quantity_reserved=1 where id='69000000-0000-4000-8000-000000000001';
select set_config('peter_golf.marketplace_order_write','enabled',true);
insert into public.inventory_reservations(order_id,order_item_id,source,inventory_id,quantity,status,
 idempotency_key,expires_at,committed_at)
values('79000000-0000-4000-8000-000000000005','99000000-0000-4000-8000-000000000005',
 'FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'ACTIVE','recovery-test:order-5',now()+interval '30 minutes',null);
select set_config('peter_golf.marketplace_order_write','disabled',true);
insert into public.stripe_checkout_sessions(id,payment_id,attempt_number,idempotency_key,payload_hash,
 stripe_checkout_session_id,status,amount_total,currency,created_by,expires_at)
values('2c000000-0000-4000-8000-000000000005','a9000000-0000-4000-8000-000000000005',1,
 'd9000000-0000-4000-8000-000000000005',repeat('d',64),
 'cs_test_recovery_preconfirm','open',10000,'MXN',
 '19000000-0000-4000-8000-000000000001',now()+interval '30 minutes');
set local role service_role;
do $$ begin
 perform public.process_stripe_webhook_event('evt_recovery_preconfirm_paid','checkout.session.completed',now(),
   '2026-07-29.dahlia',false,repeat('e',64),'cs_test_recovery_preconfirm',
   '2c000000-0000-4000-8000-000000000005','a9000000-0000-4000-8000-000000000005',
   'pi_recovery_preconfirm',10000,'MXN','paid',null,null,null,null);
end $$;
reset role;
do $$ begin
 if (select status from public.order_payments where id='a9000000-0000-4000-8000-000000000005')<>'paid'
   or not exists(select 1 from public.stripe_checkout_sessions where stripe_checkout_session_id='cs_test_recovery_preconfirm'
      and stripe_payment_intent_id='pi_recovery_preconfirm' and status='completed')
 then raise exception 'Pending-confirmation test completion state: payment %, session %, PI %',
   (select status from public.order_payments where id='a9000000-0000-4000-8000-000000000005'),
   (select status from public.stripe_checkout_sessions where stripe_checkout_session_id='cs_test_recovery_preconfirm'),
   (select stripe_payment_intent_id from public.stripe_checkout_sessions where stripe_checkout_session_id='cs_test_recovery_preconfirm'); end if;
end $$;
set local role service_role;
do $$ begin
 perform public.process_stripe_webhook_event('evt_recovery_preconfirm_refund','refund.updated',now(),
   '2026-07-29.dahlia',false,repeat('f',64),null,null,null,'pi_recovery_preconfirm',
   10000,'MXN',null,'re_recovery_preconfirm','succeeded',null,now());
end $$;
reset role;
do $$ begin
 if (select status from public.order_payments where id='a9000000-0000-4000-8000-000000000005')<>'refunded'
   or (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000005')<>'RESTOCKED'
   or (select disposition from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000005')<>'RESTOCKABLE'
   or (select status from public.inventory_reservations where order_item_id='99000000-0000-4000-8000-000000000005')<>'COMMITTED'
   or (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>18
   or (select count(*) from public.inventory_movements where reference_type='inventory_recovery')<>3
 then raise exception 'Pending-confirmation refund did not recover stock exactly once'; end if;
end $$;

-- A real First Party handoff is recorded only through the Ops RPC. Once the
-- order crosses to shipped, a successful refund must queue disposition and
-- leave sellable stock untouched.
insert into public.orders(id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,
  confirmed_at,confirmed_by,origin)
values('79000000-0000-4000-8000-000000000006','PG-W-RECOVERY-0006',
 '19000000-0000-4000-8000-000000000001','preparing',10000,10000,
 '{"recipient_name":"Buyer","street":"Test"}',now(),'19000000-0000-4000-8000-000000000002','web');
insert into public.order_items(id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,
 variant_name_snapshot,condition_snapshot,unit_price_snapshot,quantity,line_total,item_source)
values('99000000-0000-4000-8000-000000000006','79000000-0000-4000-8000-000000000006',
 '49000000-0000-4000-8000-000000000001','59000000-0000-4000-8000-000000000001',
 'REC-V1','Recovery Product','Recovery Variant','new',10000,1,10000,'FIRST_PARTY');
insert into public.order_payments(id,order_id,provider,method,status,expected_amount,refunded_amount,currency,paid_at)
values('a9000000-0000-4000-8000-000000000006','79000000-0000-4000-8000-000000000006',
 'stripe','card','paid',10000,0,'MXN',now());
select set_config('peter_golf.marketplace_order_write','enabled',true);
insert into public.inventory_reservations(order_id,order_item_id,source,inventory_id,quantity,status,
 idempotency_key,expires_at,committed_at)
values('79000000-0000-4000-8000-000000000006','99000000-0000-4000-8000-000000000006',
 'FIRST_PARTY','69000000-0000-4000-8000-000000000001',1,'COMMITTED','recovery-test:order-6',now()+interval '30 minutes',now());
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin perform public.record_first_party_order_handoff('79000000-0000-4000-8000-000000000006',1,'Test Carrier','TEST-TRACK-0006',
    'c9000000-0000-4000-8000-000000000007');
    raise exception 'Buyer unexpectedly recorded First Party handoff';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','19000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare o public.orders%rowtype; begin
  select * into strict o from public.orders where id='79000000-0000-4000-8000-000000000006';
  perform public.record_first_party_order_handoff(o.id,o.version,'Test Carrier','TEST-TRACK-0006',
    'c9000000-0000-4000-8000-000000000007');
  perform public.record_first_party_order_handoff(o.id,o.version,'Test Carrier','TEST-TRACK-0006',
    'c9000000-0000-4000-8000-000000000007');
end $$;
reset role;
do $$ begin
  if (select status from public.orders where id='79000000-0000-4000-8000-000000000006')<>'shipped'
    or not exists(select 1 from public.order_status_history where order_id='79000000-0000-4000-8000-000000000006'
      and from_status='preparing' and to_status='shipped' and changed_by='19000000-0000-4000-8000-000000000002')
    or (select count(*) from public.order_idempotency_keys where idempotency_key='c9000000-0000-4000-8000-000000000007')<>1
  then raise exception 'Authorized First Party handoff or replay was not recorded'; end if;
end $$;
insert into public.stripe_refunds(payment_id,stripe_refund_id,stripe_payment_intent_id,amount,currency,status,
 stripe_created_at,last_event_created_at)
values('a9000000-0000-4000-8000-000000000006','re_recovery_handoff','pi_recovery_handoff',10000,'MXN','succeeded',now(),now());
select set_config('peter_golf.payment_rpc_write','enabled',true);
update public.order_payments set status='refunded',refunded_amount=expected_amount,refunded_at=now(),version=version+1
where id='a9000000-0000-4000-8000-000000000006';
select set_config('peter_golf.payment_rpc_write','disabled',true);
do $$ begin
  if (select status from public.inventory_recovery_cases where order_item_id='99000000-0000-4000-8000-000000000006')<>'PENDING'
    or (select quantity_on_hand from public.inventory where id='69000000-0000-4000-8000-000000000001')<>18
  then raise exception 'Post-handoff refund auto-restocked First Party inventory'; end if;
end $$;

do $$ begin
 if (select status from public.order_payments where id='a9000000-0000-4000-8000-000000000004')<>'paid'
   or (select count(*) from public.inventory_recovery_case_history)<>9
 then raise exception 'Financial or recovery audit history is incoherent'; end if;
end $$;

select 'refund operational recovery checks passed' as result;
rollback;
