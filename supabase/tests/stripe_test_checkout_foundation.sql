-- Local-only verification of hosted Stripe Checkout in test mode.
begin;

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('16000000-0000-4000-8000-000000000001','authenticated','authenticated','stripe.customer@example.test','{}','{}',now(),now()),
 ('16000000-0000-4000-8000-000000000002','authenticated','authenticated','stripe.other@example.test','{}','{}',now(),now()),
 ('16000000-0000-4000-8000-000000000003','authenticated','authenticated','stripe.operator@example.test','{}','{}',now(),now());
insert into public.user_roles (user_id,role_id)
select '16000000-0000-4000-8000-000000000003'::uuid,id
from public.roles where name='operator';

insert into public.brands (id,slug,name) values
 ('26000000-0000-4000-8000-000000000001','stripe-test-brand','Stripe Test Brand');
insert into public.categories (id,slug,name) values
 ('36000000-0000-4000-8000-000000000001','stripe-test-category','Stripe Test Category');
insert into public.products (
  id,slug,sku,name,condition,brand_id,category_id,status,fulfillment_type,price,published
) values (
  '46000000-0000-4000-8000-000000000001','stripe-test-product','STR-P1',
  'Stripe Product','new','26000000-0000-4000-8000-000000000001',
  '36000000-0000-4000-8000-000000000001','active','in_stock',12500,true
);
insert into public.product_variants (id,product_id,sku,name) values
 ('56000000-0000-4000-8000-000000000001','46000000-0000-4000-8000-000000000001','STR-V1','Stripe Variant');
insert into public.inventory (id,variant_id,quantity_on_hand) values
 ('66000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001',8);

insert into public.orders (
  id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,
  confirmed_at,confirmed_by,payment_status,payment_method,origin
) values
 ('76000000-0000-4000-8000-000000000001','PG-W-STRIPE-000001','16000000-0000-4000-8000-000000000001',
  'preparing',12500,12500,'{"recipient_name":"Stripe","street":"Prueba"}',now(),
  '16000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'),
 ('76000000-0000-4000-8000-000000000002','PG-W-STRIPE-000002','16000000-0000-4000-8000-000000000001',
  'pending_confirmation',12500,12500,'{"recipient_name":"Stripe","street":"Prueba"}',null,null,
  'transfer_pending','bank_transfer','web'),
 ('76000000-0000-4000-8000-000000000003','PG-W-STRIPE-000003','16000000-0000-4000-8000-000000000002',
  'preparing',12500,12500,'{"recipient_name":"Other","street":"Prueba"}',now(),
  '16000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'),
 ('76000000-0000-4000-8000-000000000004','PG-W-STRIPE-000004','16000000-0000-4000-8000-000000000001',
  'preparing',12500,12500,'{"recipient_name":"Sequence","street":"Prueba"}',now(),
  '16000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'),
 ('76000000-0000-4000-8000-000000000005','PG-W-MANUAL-000005','16000000-0000-4000-8000-000000000001',
  'preparing',12500,12500,'{"recipient_name":"Manual","street":"Prueba"}',now(),
  '16000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web');

insert into public.order_items (
  id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,
  variant_name_snapshot,condition_snapshot,unit_price_snapshot,quantity,line_total
) values
 ('86000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001',
  '46000000-0000-4000-8000-000000000001','56000000-0000-4000-8000-000000000001',
  'STR-V1','Stripe Product','Stripe Variant','new',12500,1,12500);

insert into public.order_payments (
  id,order_id,provider,method,status,expected_amount,currency
) values
 ('96000000-0000-4000-8000-000000000001','76000000-0000-4000-8000-000000000001','stripe','card','pending',12500,'MXN'),
 ('96000000-0000-4000-8000-000000000002','76000000-0000-4000-8000-000000000002','stripe','card','pending',12500,'MXN'),
 ('96000000-0000-4000-8000-000000000003','76000000-0000-4000-8000-000000000003','stripe','card','pending',12500,'MXN'),
 ('96000000-0000-4000-8000-000000000004','76000000-0000-4000-8000-000000000004','stripe','card','pending',12500,'MXN'),
 ('96000000-0000-4000-8000-000000000005','76000000-0000-4000-8000-000000000005','manual','bank_transfer','pending',12500,'MXN');

update public.site_settings set value='{"mode":"test"}' where key='payments.mode';
update public.site_settings set value='{"mode":"test"}' where key='stripe.checkout.mode';

-- Coherence constraints keep manual and Stripe aggregates separate.
do $$ begin
  begin
    insert into public.orders (id,order_number,status,subtotal,total,shipping_address_snapshot,origin)
    values ('76000000-0000-4000-8000-000000000099','PG-W-BAD-000099','created',1,1,'{}','web');
    insert into public.order_payments (order_id,provider,method,status,expected_amount,currency)
    values ('76000000-0000-4000-8000-000000000099','manual','card','pending',1,'MXN');
    raise exception 'Expected provider/method constraint';
  exception when check_violation then null; end;
end $$;

-- Anonymous, non-owner and not-yet-confirmed orders cannot prepare Checkout.
set local role anon;
do $$ begin
  begin perform public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000001');
    raise exception 'Expected anonymous denial';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin perform public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000003','a6000000-0000-4000-8000-000000000002');
    raise exception 'Expected ownership denial';
  exception when no_data_found then null; end;
  begin perform public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000002','a6000000-0000-4000-8000-000000000003');
    raise exception 'Expected operational confirmation guard';
  exception when invalid_parameter_value then null; end;
  begin perform public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000005','a6000000-0000-4000-8000-000000000004');
    raise exception 'Expected manual-provider denial';
  exception when no_data_found then null; end;
end $$;

-- Amount/currency come from the payment aggregate and are already minor units.
do $$ declare first record; replay record; duplicate record; begin
  select * into first from public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000005');
  if first.replayed or first.amount_minor_units<>12500 or first.currency<>'MXN'
    or first.stripe_checkout_session_id is not null
  then raise exception 'Preparation did not derive DB minor units'; end if;
  select * into replay from public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000005');
  if not replay.replayed or replay.checkout_attempt_id<>first.checkout_attempt_id
  then raise exception 'Stable idempotency replay failed'; end if;
  select * into duplicate from public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000001','a6000000-0000-4000-8000-000000000006');
  if not duplicate.replayed or duplicate.checkout_attempt_id<>first.checkout_attempt_id
  then raise exception 'Double click created an active session'; end if;
  begin perform public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000004','a6000000-0000-4000-8000-000000000005');
    raise exception 'Expected reused-key payload conflict';
  exception when unique_violation then null; end;
  perform public.link_stripe_checkout_session(
    first.checkout_attempt_id,'a6000000-0000-4000-8000-000000000005',
    'cs_test_primary',now()+interval '30 minutes');
  perform set_config('test.stripe_primary_attempt_id',first.checkout_attempt_id::text,true);
end $$;

-- Direct customer reads are private; the safe projection exposes only status.
do $$ declare detail jsonb; begin
  if (select count(*) from public.stripe_checkout_sessions)<>0
    or (select count(*) from public.stripe_refunds)<>0
    or (select count(*) from public.stripe_webhook_events)<>0
  then raise exception 'Stripe tables leak through RLS'; end if;
  detail:=public.get_customer_order('76000000-0000-4000-8000-000000000001');
  if detail->'payment'->>'provider'<>'stripe'
    or detail->'payment'->>'method'<>'card'
    or detail->'payment'->>'stripe_status'<>'open'
    or detail::text like '%cs_test_%' or detail::text like '%payload_hash%'
  then raise exception 'Unsafe Stripe customer projection: %',detail; end if;
end $$;
reset role;

-- Webhook events are normalized, atomic, idempotent and test-only.
create temp table stripe_invariants as
select o.status as order_status, i.quantity_on_hand
from public.orders o cross join public.inventory i
where o.id='76000000-0000-4000-8000-000000000001'
  and i.id='66000000-0000-4000-8000-000000000001';
set local role service_role;
do $$ declare
  result record;
  primary_attempt_id uuid:=current_setting('test.stripe_primary_attempt_id')::uuid;
begin
  select * into result from public.process_stripe_webhook_event(
    'evt_live','checkout.session.completed',now(),'2026-07-29.dahlia',true,repeat('a',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',12500,'MXN','paid',null,null,null,null);
  if result.processed or result.outcome<>'live_mode_forbidden'
  then raise exception 'Expected audited livemode rejection'; end if;
  select * into result from public.process_stripe_webhook_event(
    'evt_amount','checkout.session.completed',now(),'2026-07-29.dahlia',false,repeat('b',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',1250000,'MXN','paid',null,null,null,null);
  if result.processed or result.outcome<>'completion_amount'
  then raise exception 'Expected audited amount rejection'; end if;
  select * into result from public.process_stripe_webhook_event(
    'evt_currency','checkout.session.completed',now(),'2026-07-29.dahlia',false,repeat('c',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',12500,'USD','paid',null,null,null,null);
  if result.processed or result.outcome<>'completion_currency'
  then raise exception 'Expected audited currency rejection'; end if;

  select * into result from public.process_stripe_webhook_event(
    'evt_completed','checkout.session.completed',now(),'2026-07-29.dahlia',false,repeat('d',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',12500,'mxn','paid',null,null,null,null);
  if not result.processed or result.replayed then raise exception 'Completion failed'; end if;
  select * into result from public.process_stripe_webhook_event(
    'evt_completed','checkout.session.completed',now(),'2026-07-29.dahlia',false,repeat('d',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',12500,'mxn','paid',null,null,null,null);
  if not result.replayed then raise exception 'Event replay failed'; end if;
  begin perform public.process_stripe_webhook_event(
    'evt_completed','checkout.session.completed',now(),'2026-07-29.dahlia',false,repeat('e',64),
    'cs_test_primary',primary_attempt_id,'96000000-0000-4000-8000-000000000001',
    'pi_primary',12500,'MXN','paid',null,null,null,null);
    raise exception 'Expected event ID payload conflict';
  exception when unique_violation then null; end;
  perform public.process_stripe_webhook_event(
    'evt_expired_late','checkout.session.expired',now()+interval '1 second',
    '2026-07-29.dahlia',false,repeat('f',64),'cs_test_primary',null,null,null,null,null,null,null,null,null,null);
end $$;
reset role;
do $$ begin
  if (select status from public.stripe_checkout_sessions where stripe_checkout_session_id='cs_test_primary')<>'completed'
  then raise exception 'Expired event regressed completed session'; end if;
  if (select status from public.orders where id='76000000-0000-4000-8000-000000000001')
      <> (select order_status from stripe_invariants)
    or (select quantity_on_hand from public.inventory where id='66000000-0000-4000-8000-000000000001')
      <> (select quantity_on_hand from stripe_invariants)
  then raise exception 'Webhook changed order or inventory'; end if;
end $$;

-- Provider identifiers remain globally unique even across different payments.
do $$ begin
  begin
    insert into public.stripe_checkout_sessions (
      payment_id, attempt_number, idempotency_key, payload_hash,
      stripe_checkout_session_id, status, amount_total, currency, created_by,
      expires_at
    ) values (
      '96000000-0000-4000-8000-000000000003',1,
      'a6000000-0000-4000-8000-000000000099',repeat('9',64),
      'cs_test_primary','open',12500,'MXN',
      '16000000-0000-4000-8000-000000000002',now()+interval '30 minutes'
    );
    raise exception 'Expected duplicate Checkout Session ID rejection';
  exception when unique_violation then null; end;
  begin
    insert into public.stripe_checkout_sessions (
      payment_id, attempt_number, idempotency_key, payload_hash,
      stripe_checkout_session_id, stripe_payment_intent_id, status,
      amount_total, currency, created_by, expires_at, completed_at
    ) values (
      '96000000-0000-4000-8000-000000000003',1,
      'a6000000-0000-4000-8000-000000000098',repeat('8',64),
      'cs_test_duplicate_pi','pi_primary','completed',12500,'MXN',
      '16000000-0000-4000-8000-000000000002',now()+interval '30 minutes',now()
    );
    raise exception 'Expected duplicate PaymentIntent ID rejection';
  exception when unique_violation then null; end;
end $$;

-- Expired then completed, and payment_failed then completed, are monotonic.
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare attempt record; begin
  select * into attempt from public.prepare_stripe_checkout_session(
    '76000000-0000-4000-8000-000000000004','a6000000-0000-4000-8000-000000000007');
  perform public.link_stripe_checkout_session(
    attempt.checkout_attempt_id,'a6000000-0000-4000-8000-000000000007',
    'cs_test_sequence',now()+interval '30 minutes');
  perform set_config('test.stripe_attempt_id',attempt.checkout_attempt_id::text,true);
end $$;
reset role; set local role service_role;
do $$ declare attempt_id uuid:=current_setting('test.stripe_attempt_id')::uuid; begin
  perform public.process_stripe_webhook_event(
    'evt_expired_first','checkout.session.expired',now(),'2026-07-29.dahlia',false,repeat('1',64),
    'cs_test_sequence',null,null,null,null,null,null,null,null,null,null);
  perform public.process_stripe_webhook_event(
    'evt_failed_after_expiry','payment_intent.payment_failed',now()+interval '1 second',
    '2026-07-29.dahlia',false,repeat('2',64),null,attempt_id,
    '96000000-0000-4000-8000-000000000004','pi_sequence',null,null,null,null,null,null,null);
  perform public.process_stripe_webhook_event(
    'evt_completed_after_fail','checkout.session.completed',now()+interval '2 seconds',
    '2026-07-29.dahlia',false,repeat('3',64),'cs_test_sequence',attempt_id,
    '96000000-0000-4000-8000-000000000004',
    'pi_sequence',12500,'MXN','paid',null,null,null,null);
end $$;
reset role;
do $$ begin
  if (select status from public.order_payments where id='96000000-0000-4000-8000-000000000004')<>'paid'
    or (select status from public.stripe_checkout_sessions where stripe_checkout_session_id='cs_test_sequence')<>'completed'
  then raise exception 'Out-of-order Stripe events regressed state'; end if;
end $$;

-- Partial, failed and total refunds are auditable and do not restock.
set local role service_role;
do $$ begin
  perform public.process_stripe_webhook_event(
    'evt_refund_partial','refund.created',now(),'2026-07-29.dahlia',false,repeat('4',64),
    null,null,null,'pi_primary',2500,'MXN',null,'re_partial','succeeded',null,now());
  perform public.process_stripe_webhook_event(
    'evt_refund_failed','refund.failed',now()+interval '1 second','2026-07-29.dahlia',false,repeat('5',64),
    null,null,null,'pi_primary',1000,'MXN',null,'re_failed','failed','expired_or_canceled_card',now());
  perform public.process_stripe_webhook_event(
    'evt_refund_no_regression','refund.updated',now()+interval '2 seconds','2026-07-29.dahlia',false,repeat('7',64),
    null,null,null,'pi_primary',2500,'MXN',null,'re_partial','failed','late_incoherent_failure',now());
  perform public.process_stripe_webhook_event(
    'evt_refund_total','refund.updated',now()+interval '3 seconds','2026-07-29.dahlia',false,repeat('6',64),
    null,null,null,'pi_primary',10000,'MXN',null,'re_total','succeeded',null,now());
end $$;
reset role;
do $$ begin
  if (select status from public.order_payments where id='96000000-0000-4000-8000-000000000001')<>'refunded'
    or (select refunded_amount from public.order_payments where id='96000000-0000-4000-8000-000000000001')<>12500
    or (select quantity_on_hand from public.inventory where id='66000000-0000-4000-8000-000000000001')<>8
    or not exists (select 1 from public.stripe_refunds where stripe_refund_id='re_failed' and status='failed')
  then raise exception 'Refund audit or inventory isolation failed'; end if;
end $$;

-- A realistic MXN 1,149.00 card completion links all identities, leaves the
-- order and inventory aggregates alone, and replays idempotently.
insert into public.orders (
  id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,
  confirmed_at,confirmed_by,payment_status,payment_method,origin
) values (
  '76000000-0000-4000-8000-000000000006','PG-W-STRIPE-114900',
  '16000000-0000-4000-8000-000000000001','preparing',114900,114900,
  '{"recipient_name":"Stripe","street":"Prueba"}',now(),
  '16000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'
);
insert into public.order_payments (
  id,order_id,provider,method,status,expected_amount,currency
) values (
  '96000000-0000-4000-8000-000000000006','76000000-0000-4000-8000-000000000006',
  'stripe','card','pending',114900,'MXN'
);
insert into public.stripe_checkout_sessions (
  id,payment_id,attempt_number,idempotency_key,payload_hash,
  stripe_checkout_session_id,status,amount_total,currency,created_by,expires_at
) values (
  'a6000000-0000-4000-8000-000000000006','96000000-0000-4000-8000-000000000006',
  2,'b6000000-0000-4000-8000-000000000006',repeat('9',64),
  'cs_test_realistic114900','open',114900,'MXN',
  '16000000-0000-4000-8000-000000000001',now()+interval '30 minutes'
);
create temp table realistic_stripe_invariants as
select o.status as order_status,
  (select sum(quantity_on_hand) from public.inventory) as inventory_total
from public.orders o where o.id='76000000-0000-4000-8000-000000000006';
set local role service_role;
do $$ declare result record; begin
  select * into result from public.process_stripe_webhook_event(
    'evt_realistic114900','checkout.session.completed',now(),
    '2026-06-24.dahlia',false,repeat('8',64),'cs_test_realistic114900',
    'a6000000-0000-4000-8000-000000000006',
    '96000000-0000-4000-8000-000000000006',
    'pi_3RealisticPaymentIntent114900',114900,'mxn','paid',null,null,null,null);
  if not result.processed or result.replayed then
    raise exception 'Realistic completion was not processed';
  end if;
  select * into result from public.process_stripe_webhook_event(
    'evt_realistic114900','checkout.session.completed',now(),
    '2026-06-24.dahlia',false,repeat('8',64),'cs_test_realistic114900',
    'a6000000-0000-4000-8000-000000000006',
    '96000000-0000-4000-8000-000000000006',
    'pi_3RealisticPaymentIntent114900',114900,'MXN','paid',null,null,null,null);
  if not result.processed or not result.replayed then
    raise exception 'Realistic completion replay failed';
  end if;
end $$;
reset role;
do $$ begin
  if (select status from public.order_payments where id='96000000-0000-4000-8000-000000000006')<>'paid'
    or (select status from public.stripe_checkout_sessions where id='a6000000-0000-4000-8000-000000000006')<>'completed'
    or (select stripe_payment_intent_id from public.stripe_checkout_sessions where id='a6000000-0000-4000-8000-000000000006')<>'pi_3RealisticPaymentIntent114900'
    or (select status from public.orders where id='76000000-0000-4000-8000-000000000006')
      <> (select order_status from realistic_stripe_invariants)
    or (select sum(quantity_on_hand) from public.inventory)
      <> (select inventory_total from realistic_stripe_invariants)
  then raise exception 'Realistic completion changed incoherent aggregates'; end if;
  if not exists (
    select 1 from public.stripe_webhook_events
    where stripe_event_id='evt_amount' and processing_status='rejected'
      and error_code='completion_amount' and processed_at is not null
  ) then raise exception 'Permanent rejection disappeared from the ledger'; end if;
end $$;

-- A missing local Session remains retryable and rolls back its processing row.
set local role service_role;
do $$ begin
  begin
    perform public.process_stripe_webhook_event(
      'evt_transient_missing','checkout.session.completed',now(),
      '2026-07-29.dahlia',false,repeat('7',64),'cs_test_not_linked_yet',
      'a6000000-0000-4000-8000-000000000006',
      '96000000-0000-4000-8000-000000000006',
      'pi_3TransientPaymentIntent',114900,'MXN','paid',null,null,null,null);
    raise exception 'Expected retryable missing Session';
  exception when no_data_found then null; end;
end $$;
reset role;
do $$ begin
  if exists (select 1 from public.stripe_webhook_events where stripe_event_id='evt_transient_missing')
  then raise exception 'Transient event must be retried, not permanently rejected'; end if;
end $$;

-- Manual review cannot mutate Stripe payments; paid blocks cancellation until full refund.
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare canceled record; begin
  begin perform public.review_order_payment(
    '76000000-0000-4000-8000-000000000004',3,'refunded','Manual forbidden',
    'b6000000-0000-4000-8000-000000000001');
    raise exception 'Expected Stripe manual-review denial';
  exception when insufficient_privilege then null; end;
  begin perform public.cancel_operational_order(
    '76000000-0000-4000-8000-000000000004',1,'Pago Stripe vigente',
    'c6000000-0000-4000-8000-000000000001');
    raise exception 'Expected paid cancellation block';
  exception when check_violation then null; end;
  select * into canceled from public.cancel_operational_order(
    '76000000-0000-4000-8000-000000000001',1,'Reembolso Stripe completo',
    'c6000000-0000-4000-8000-000000000002');
  if canceled.replayed
    or (select quantity_on_hand from public.inventory where id='66000000-0000-4000-8000-000000000001')<>9
    or (select count(*) from public.inventory_movements where reference_id='76000000-0000-4000-8000-000000000001')<>1
  then raise exception 'Cancellation after full refund failed'; end if;
  select * into canceled from public.cancel_operational_order(
    '76000000-0000-4000-8000-000000000001',1,'Reembolso Stripe completo',
    'c6000000-0000-4000-8000-000000000002');
  if not canceled.replayed
    or (select count(*) from public.inventory_movements where reference_id='76000000-0000-4000-8000-000000000001')<>1
  then raise exception 'Cancellation replay returned inventory twice'; end if;
end $$;
reset role;

-- SECURITY DEFINER, empty search_path and minimum grants are explicit.
do $$ begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname='process_stripe_webhook_event'
      and p.prosecdef and p.proconfig = array['search_path=""']::text[]
  ) then raise exception 'Webhook RPC security settings invalid'; end if;
  if has_function_privilege('anon',
    'public.process_stripe_webhook_event(text,text,timestamptz,text,boolean,text,text,uuid,uuid,text,bigint,text,text,text,text,text,timestamptz)',
    'EXECUTE')
    or has_function_privilege('authenticated',
    'public.process_stripe_webhook_event(text,text,timestamptz,text,boolean,text,text,uuid,uuid,text,bigint,text,text,text,text,text,timestamptz)',
    'EXECUTE')
    or not has_function_privilege('service_role',
    'public.process_stripe_webhook_event(text,text,timestamptz,text,boolean,text,text,uuid,uuid,text,bigint,text,text,text,text,text,timestamptz)',
    'EXECUTE')
  then raise exception 'Webhook RPC grants invalid'; end if;
  if has_function_privilege('service_role','public.prepare_stripe_checkout_session(uuid,uuid)','EXECUTE')
  then raise exception 'Service role can prepare customer Checkout'; end if;
end $$;

select 'stripe test checkout foundation checks passed' as result;
rollback;
