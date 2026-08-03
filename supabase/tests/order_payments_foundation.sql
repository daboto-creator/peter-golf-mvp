-- Local verification for simulated order payments. No real money is processed.
begin;

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
 ('15000000-0000-4000-8000-000000000001','authenticated','authenticated','pay.customer@example.test','{}','{}',now(),now()),
 ('15000000-0000-4000-8000-000000000002','authenticated','authenticated','pay.other@example.test','{}','{}',now(),now()),
 ('15000000-0000-4000-8000-000000000003','authenticated','authenticated','pay.operator@example.test','{}','{}',now(),now()),
 ('15000000-0000-4000-8000-000000000004','authenticated','authenticated','pay.admin@example.test','{}','{}',now(),now());
insert into public.user_roles (user_id,role_id)
select '15000000-0000-4000-8000-000000000003'::uuid,id from public.roles where name='operator'
union all select '15000000-0000-4000-8000-000000000004'::uuid,id from public.roles where name='admin';

insert into public.brands (id,slug,name) values
 ('25000000-0000-4000-8000-000000000001','pay-test-brand','Pay Test Brand');
insert into public.categories (id,slug,name) values
 ('35000000-0000-4000-8000-000000000001','pay-test-category','Pay Test Category');
insert into public.products (id,slug,sku,name,condition,brand_id,category_id,status,fulfillment_type,price,published)
values ('45000000-0000-4000-8000-000000000001','pay-test-product','PAY-P1','Pay Product','new',
 '25000000-0000-4000-8000-000000000001','35000000-0000-4000-8000-000000000001','active','in_stock',12500,true);
insert into public.product_variants (id,product_id,sku,name) values
 ('55000000-0000-4000-8000-000000000001','45000000-0000-4000-8000-000000000001','PAY-V1','Pay Variant');
insert into public.inventory (id,variant_id,quantity_on_hand) values
 ('65000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001',9);

insert into public.orders (id,order_number,user_id,status,subtotal,total,shipping_address_snapshot,
 confirmed_at,confirmed_by,payment_status,payment_method,origin)
values
 ('75000000-0000-4000-8000-000000000001','PG-W-PAYMENT-000001','15000000-0000-4000-8000-000000000001',
  'preparing',12500,12500,'{"recipient_name":"Cliente","street":"Prueba"}',now(),
  '15000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'),
 ('75000000-0000-4000-8000-000000000002','PG-W-PAYMENT-000002','15000000-0000-4000-8000-000000000001',
  'pending_confirmation',12500,12500,'{"recipient_name":"Cliente","street":"Prueba"}',null,null,
  'transfer_pending','bank_transfer','web'),
 ('75000000-0000-4000-8000-000000000003','PG-W-PAYMENT-000003','15000000-0000-4000-8000-000000000002',
  'preparing',12500,12500,'{"recipient_name":"Otro","street":"Prueba"}',now(),
  '15000000-0000-4000-8000-000000000003','transfer_pending','bank_transfer','web'),
 ('75000000-0000-4000-8000-000000000004','PG-M-PAYMENT-000004','15000000-0000-4000-8000-000000000002',
  'pending_confirmation',12500,12500,'{"recipient_name":"Legacy","street":"Prueba"}',null,null,
  'cash_received','cash','manual');
insert into public.order_items (id,order_id,product_id,variant_id,sku_snapshot,product_name_snapshot,
 variant_name_snapshot,condition_snapshot,unit_price_snapshot,quantity,line_total)
values ('85000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001',
 '45000000-0000-4000-8000-000000000001','55000000-0000-4000-8000-000000000001',
 'PAY-V1','Pay Product','Pay Variant','new',12500,1,12500);
insert into public.order_payments (id,order_id,method,status,expected_amount,currency)
values
 ('95000000-0000-4000-8000-000000000001','75000000-0000-4000-8000-000000000001','bank_transfer','pending',12500,'MXN'),
 ('95000000-0000-4000-8000-000000000002','75000000-0000-4000-8000-000000000002','bank_transfer','pending',12500,'MXN'),
 ('95000000-0000-4000-8000-000000000003','75000000-0000-4000-8000-000000000003','bank_transfer','submitted',12500,'MXN');

-- The owner-only compatibility helper maps legacy rows without duplicates.
select public.backfill_legacy_order_payments();
do $$ begin
 if not exists (
   select 1 from public.order_payments
   where order_id='75000000-0000-4000-8000-000000000004'
     and method='cash' and status='paid' and expected_amount=12500 and currency='MXN'
 ) or (select count(*) from public.payment_status_history h
       join public.order_payments p on p.id=h.payment_id
       where p.order_id='75000000-0000-4000-8000-000000000004')<>1
 then raise exception 'Legacy payment backfill failed'; end if;
 perform public.backfill_legacy_order_payments();
 if (select count(*) from public.order_payments
     where order_id='75000000-0000-4000-8000-000000000004')<>1
 then raise exception 'Legacy backfill is not idempotent'; end if;
end $$;

-- Private tables and the database kill switch resist direct browser calls.
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.order_payments)<>0
   or (select count(*) from public.payment_submissions)<>0
   or (select count(*) from public.payment_status_history)<>0
   or (select count(*) from public.payment_idempotency_keys)<>0
 then raise exception 'Customer reads private payment tables'; end if;
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',1,
   'DISABLED',now(),null,null,'a5000000-0000-4000-8000-000000000001');
   raise exception 'Expected disabled rejection'; exception when insufficient_privilege then null; end;
 update public.order_payments set status='paid' where id='95000000-0000-4000-8000-000000000001';
 if found then raise exception 'Customer performed a direct payment update'; end if;
end $$;
reset role;
update public.site_settings set value='{"mode":"test"}' where key='payments.mode';

-- Ownership, operational confirmation, validation, idempotency and safe reads.
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare first record; replay record; detail jsonb; transferred timestamptz:=date_trunc('second',now()-interval '1 day'); begin
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000002',1,
   'NOT-CONFIRMED',transferred,null,null,'a5000000-0000-4000-8000-000000000002');
   raise exception 'Expected confirmation guard'; exception when invalid_parameter_value then null; end;
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000003',1,
   'NOT-OWNER',transferred,null,null,'a5000000-0000-4000-8000-000000000003');
   raise exception 'Expected ownership guard'; exception when no_data_found then null; end;
 select * into first from public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',1,
   ' TEST-REF-001 ',transferred,' Cliente Prueba ',' Banco Prueba ',
   'a5000000-0000-4000-8000-000000000004');
 if first.replayed or first.status<>'submitted' or first.version<>2
   or (select count(*) from public.payment_submissions)<>0
 then raise exception 'Submission or post-RPC RLS invalid'; end if;
 select * into replay from public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',1,
   ' TEST-REF-001 ',transferred,' Cliente Prueba ',' Banco Prueba ',
   'a5000000-0000-4000-8000-000000000004');
 if not replay.replayed or replay.submission_id<>first.submission_id then raise exception 'Replay failed'; end if;
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',1,
   'DIFFERENT',transferred,null,null,'a5000000-0000-4000-8000-000000000004');
   raise exception 'Expected key conflict'; exception when unique_violation then null; end;
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',1,
   'STALE',transferred,null,null,'a5000000-0000-4000-8000-000000000005');
   raise exception 'Expected stale version'; exception when serialization_failure then null; end;
 detail:=public.get_customer_order('75000000-0000-4000-8000-000000000001');
 if detail->'payment'->>'status'<>'submitted'
   or (detail->'payment'->>'expected_amount')::integer<>12500
   or jsonb_array_length(detail->'payment'->'submissions')<>1
   or detail::text like '%idempotency_key%' or detail::text like '%reviewed_by%'
   or detail::text like '%submitted_by%' or detail::text like '%"note"%'
 then raise exception 'Unsafe customer projection: %',detail; end if;
end $$;

-- Operators use the exact matrix; payment review is independent of order/inventory.
reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare result record; begin
 if (select count(*) from public.order_payments)<>4 then raise exception 'Operator cannot read payments'; end if;
 begin perform public.review_order_payment('75000000-0000-4000-8000-000000000001',2,'paid',null,
   'b5000000-0000-4000-8000-000000000001'); raise exception 'Expected invalid jump';
   exception when invalid_parameter_value then null; end;
 select * into result from public.review_order_payment('75000000-0000-4000-8000-000000000001',2,
   'under_review',null,'b5000000-0000-4000-8000-000000000002');
 if result.version<>3 or result.replayed then raise exception 'Review failed'; end if;
 select * into result from public.review_order_payment('75000000-0000-4000-8000-000000000001',2,
   'under_review',null,'b5000000-0000-4000-8000-000000000002');
 if not result.replayed or result.version<>3 then raise exception 'Review replay failed'; end if;
 begin perform public.review_order_payment('75000000-0000-4000-8000-000000000001',3,'rejected',null,
   'b5000000-0000-4000-8000-000000000003'); raise exception 'Expected reason requirement';
   exception when invalid_parameter_value then null; end;
 perform public.review_order_payment('75000000-0000-4000-8000-000000000001',3,'rejected',
   'Referencia no localizada','b5000000-0000-4000-8000-000000000004');
 if (select status from public.orders where id='75000000-0000-4000-8000-000000000001')<>'preparing'
   or (select version from public.orders where id='75000000-0000-4000-8000-000000000001')<>1
   or (select quantity_on_hand from public.inventory where id='65000000-0000-4000-8000-000000000001')<>9
 then raise exception 'Payment mutated order or inventory'; end if;
end $$;

-- Rejected payments may be resubmitted.
reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare result record; begin
 select * into result from public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',4,
  'TEST-REF-002',now()-interval '2 hours',null,null,'a5000000-0000-4000-8000-000000000006');
 if result.version<>5 then raise exception 'Resubmission failed'; end if;
end $$;

-- paid blocks cancellation atomically; refunded does not restock; cancellation does once.
reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare result record; begin
 perform public.review_order_payment('75000000-0000-4000-8000-000000000001',5,'under_review',null,
  'b5000000-0000-4000-8000-000000000005');
 perform public.review_order_payment('75000000-0000-4000-8000-000000000001',6,'paid',null,
  'b5000000-0000-4000-8000-000000000006');
 begin perform public.cancel_operational_order('75000000-0000-4000-8000-000000000001',1,
  'Cancelación pagada','c5000000-0000-4000-8000-000000000001');
  raise exception 'Expected paid cancellation block'; exception when check_violation then null; end;
 if (select quantity_on_hand from public.inventory where id='65000000-0000-4000-8000-000000000001')<>9
   or exists(select 1 from public.inventory_movements where reference_id='75000000-0000-4000-8000-000000000001')
 then raise exception 'Blocked cancellation changed stock'; end if;
 perform public.review_order_payment('75000000-0000-4000-8000-000000000001',7,'refunded',
  'Reembolso simulado','b5000000-0000-4000-8000-000000000007');
 if (select quantity_on_hand from public.inventory where id='65000000-0000-4000-8000-000000000001')<>9
 then raise exception 'Refund restocked'; end if;
 select * into result from public.cancel_operational_order('75000000-0000-4000-8000-000000000001',1,
  'Después del reembolso','c5000000-0000-4000-8000-000000000002');
 if result.replayed or (select quantity_on_hand from public.inventory where id='65000000-0000-4000-8000-000000000001')<>10
   or (select count(*) from public.inventory_movements where reference_id='75000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Cancellation after refund failed'; end if;
 select * into result from public.cancel_operational_order('75000000-0000-4000-8000-000000000001',1,
  'Después del reembolso','c5000000-0000-4000-8000-000000000002');
 if not result.replayed or (select count(*) from public.inventory_movements where reference_id='75000000-0000-4000-8000-000000000001')<>1
 then raise exception 'Cancellation replay duplicated stock'; end if;
 if (select count(*) from public.payment_submissions where payment_id='95000000-0000-4000-8000-000000000001')<>2
   or (select count(*) from public.payment_status_history where payment_id='95000000-0000-4000-8000-000000000001')<>8
 then raise exception 'Audit cardinality invalid: submissions %, history %',
   (select count(*) from public.payment_submissions where payment_id='95000000-0000-4000-8000-000000000001'),
   (select count(*) from public.payment_status_history where payment_id='95000000-0000-4000-8000-000000000001'); end if;
end $$;

-- Admin authorization, anonymous denial and immutable append-only audit.
reset role;
select set_config('request.jwt.claim.sub','15000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
 if not public.can_manage_orders() then raise exception 'Admin unauthorized'; end if;
 perform public.review_order_payment('75000000-0000-4000-8000-000000000003',1,'under_review',null,
  'd5000000-0000-4000-8000-000000000001');
end $$;
reset role; set local role anon;
do $$ begin
 begin perform public.submit_bank_transfer('75000000-0000-4000-8000-000000000001',8,'ANON',now(),null,null,
  'e5000000-0000-4000-8000-000000000001'); raise exception 'Expected anon denial';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
do $$ declare sid uuid; hid uuid; kid uuid; begin
 if (select count(*) from public.payment_idempotency_keys
     where payment_id='95000000-0000-4000-8000-000000000001')<>7
 then raise exception 'Idempotency audit cardinality invalid'; end if;
 select id into sid from public.payment_submissions limit 1;
 select id into hid from public.payment_status_history limit 1;
 select idempotency_key into kid from public.payment_idempotency_keys limit 1;
 begin update public.payment_submissions set transfer_reference='REWRITE' where id=sid;
  raise exception 'Mutable submission'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.payment_status_history where id=hid;
  raise exception 'Mutable history'; exception when object_not_in_prerequisite_state then null; end;
 begin delete from public.payment_idempotency_keys where idempotency_key=kid;
  raise exception 'Mutable idempotency'; exception when object_not_in_prerequisite_state then null; end;
end $$;

select 'order payment foundation checks passed' as result;
rollback;
