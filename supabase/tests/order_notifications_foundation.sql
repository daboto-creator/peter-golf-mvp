-- Local-only verification for the transactional notification outbox.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('16000000-0000-4000-8000-000000000001','authenticated','authenticated',
   'notify.customer@example.test','{}','{"first_name":"Ana","last_name":"Prueba"}',now(),now()),
  ('16000000-0000-4000-8000-000000000002','authenticated','authenticated',
   'notify.operator@peter-golf.test','{}','{"first_name":"Ope","last_name":"Prueba"}',now(),now());
insert into public.user_roles (user_id, role_id)
select '16000000-0000-4000-8000-000000000002'::uuid, id
from public.roles where name = 'operator';

insert into public.orders (
  id, order_number, user_id, status, subtotal, total,
  shipping_address_snapshot, customer_name, customer_email, customer_phone, origin
) values
  ('76000000-0000-4000-8000-000000000001','PG-W-NOTIFY-000001',
   '16000000-0000-4000-8000-000000000001','pending_confirmation',12500,12500,
   '{"recipient_name":"Ana","street":"Prueba"}','Ana Prueba',
   'notify.customer@example.test','4420000000','web'),
  ('76000000-0000-4000-8000-000000000002','PG-M-NOTIFY-000002',null,
   'pending_confirmation',25000,25000,'{"recipient_name":"Manual","street":"Prueba"}',
   'Cliente Manual','manual@example.test','4420000001','manual'),
  ('76000000-0000-4000-8000-000000000003','PG-M-NOTIFY-000003',null,
   'pending_confirmation',30000,30000,'{"recipient_name":"Sin correo","street":"Prueba"}',
   'Cliente Sin Correo',null,'4420000002','manual');

-- Execute deferred outbox triggers without committing this rollback-only test.
set constraints all immediate;

do $$ begin
  if (select count(*) from public.notification_events
      where event_type = 'order_created'
        and order_id in (
          '76000000-0000-4000-8000-000000000001',
          '76000000-0000-4000-8000-000000000002',
          '76000000-0000-4000-8000-000000000003'
        )) <> 3 then
    raise exception 'Each created order must produce one event';
  end if;
  if (select count(*) from public.notification_deliveries d
      join public.notification_events e on e.id = d.notification_event_id
      where e.order_id in (
        '76000000-0000-4000-8000-000000000001',
        '76000000-0000-4000-8000-000000000002',
        '76000000-0000-4000-8000-000000000003'
      )) <> 2 then
    raise exception 'Only orders with email must produce deliveries';
  end if;
  if exists (
    select 1 from public.notification_deliveries d
    join public.notification_events e on e.id = d.notification_event_id
    where e.order_id = '76000000-0000-4000-8000-000000000003'
  ) then raise exception 'Manual order without email produced a delivery'; end if;
end $$;

update public.orders set status = 'preparing', confirmed_at = now(),
  confirmed_by = '16000000-0000-4000-8000-000000000002', version = version + 1
where id = '76000000-0000-4000-8000-000000000001';
update public.orders set status = 'cancelled', cancelled_at = now(),
  cancelled_by = '16000000-0000-4000-8000-000000000002',
  cancellation_reason = 'Cancelación de prueba', version = version + 1
where id = '76000000-0000-4000-8000-000000000002';

insert into public.order_payments (
  id, order_id, method, status, expected_amount, currency
) values (
  '96000000-0000-4000-8000-000000000001',
  '76000000-0000-4000-8000-000000000001',
  'bank_transfer','pending',12500,'MXN'
);
update public.order_payments set status = 'submitted', version = version + 1
where id = '96000000-0000-4000-8000-000000000001';
update public.order_payments set status = 'under_review', version = version + 1
where id = '96000000-0000-4000-8000-000000000001';
update public.order_payments set status = 'paid', version = version + 1
where id = '96000000-0000-4000-8000-000000000001';
update public.order_payments set status = 'refunded', version = version + 1
where id = '96000000-0000-4000-8000-000000000001';
update public.orders set status = 'cancelled', cancelled_at = now(),
  cancelled_by = '16000000-0000-4000-8000-000000000002',
  cancellation_reason = 'Cancelación después del reembolso', version = version + 1
where id = '76000000-0000-4000-8000-000000000001';

-- A second payment covers rejection and a legitimate resubmission.
insert into public.orders (
  id, order_number, user_id, status, subtotal, total, shipping_address_snapshot,
  customer_name, customer_email, customer_phone, origin, confirmed_at, confirmed_by
) values (
  '76000000-0000-4000-8000-000000000004','PG-W-NOTIFY-000004',
  '16000000-0000-4000-8000-000000000001','preparing',17500,17500,
  '{"recipient_name":"Ana","street":"Prueba"}','Ana Prueba',
  'notify.customer@example.test','4420000000','web',now(),
  '16000000-0000-4000-8000-000000000002'
);
insert into public.order_payments (
  id, order_id, method, status, expected_amount, currency
) values (
  '96000000-0000-4000-8000-000000000002',
  '76000000-0000-4000-8000-000000000004','bank_transfer','pending',17500,'MXN'
);
update public.order_payments set status = 'submitted', version = version + 1
where id = '96000000-0000-4000-8000-000000000002';
update public.order_payments set status = 'rejected', version = version + 1
where id = '96000000-0000-4000-8000-000000000002';
update public.order_payments set status = 'submitted', version = version + 1
where id = '96000000-0000-4000-8000-000000000002';

do $$ declare before_count integer; begin
  select count(*) into before_count from public.notification_events;
  -- An ineffective replay creates no history and therefore no outbox event.
  update public.order_payments set status = status
  where id = '96000000-0000-4000-8000-000000000002';
  if (select count(*) from public.notification_events) <> before_count then
    raise exception 'Ineffective replay duplicated an event';
  end if;
  if (select count(*) from public.notification_events
      where event_type = 'transfer_submitted'
        and payment_id = '96000000-0000-4000-8000-000000000002') <> 2 then
    raise exception 'Rejection and resubmission events are inconsistent';
  end if;
  if exists (
    select 1 from public.notification_events
    where order_id::text like '76000000-0000-4000-8000-%'
      and template_data::text ~* '(phone|address|reference|sender|bank|internal|reason|actor|inventory|cost|idempotency)'
  ) then raise exception 'Template data contains prohibited PII or metadata'; end if;
end $$;

-- Outbox rows are immutable and unique by source/channel.
do $$ declare selected_event uuid; selected_history uuid; begin
  select id, order_status_history_id into selected_event, selected_history
  from public.notification_events
  where event_type = 'order_created'
    and order_id = '76000000-0000-4000-8000-000000000001'
  limit 1;
  begin update public.notification_events set payload_version = 2 where id = selected_event;
    raise exception 'Expected immutable event rejection';
  exception when object_not_in_prerequisite_state then null; end;
  begin insert into public.notification_events (
      event_type, order_id, order_status_history_id, template_data, occurred_at
    ) select event_type, order_id, selected_history, template_data, occurred_at
      from public.notification_events where id = selected_event;
    raise exception 'Expected source uniqueness rejection';
  exception when unique_violation then null; end;
  begin insert into public.notification_deliveries (notification_event_id, recipient_email)
    values (selected_event, 'duplicate@example.test');
    raise exception 'Expected delivery uniqueness rejection';
  exception when unique_violation then null; end;
end $$;

-- Customers cannot inspect or mutate the private outbox.
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  begin perform 1 from public.notification_events;
    raise exception 'Customer read notification events';
  exception when insufficient_privilege then null; end;
  begin perform public.claim_notification_deliveries(1);
    raise exception 'Customer claimed a delivery';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Operator claims are leased; sequential workers receive different rows.
-- Keep pre-existing local deliveries out of this rollback-only scenario.
update public.notification_deliveries d
set next_attempt_at = now() + interval '1 day'
from public.notification_events e
where e.id = d.notification_event_id
  and d.status in ('pending', 'failed')
  and e.order_id not in (
    '76000000-0000-4000-8000-000000000001',
    '76000000-0000-4000-8000-000000000002',
    '76000000-0000-4000-8000-000000000003',
    '76000000-0000-4000-8000-000000000004'
  );
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000002',true);
set local role authenticated;
create temporary table claimed_notifications (delivery_id uuid, lease_token uuid);
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(1);
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(1);
do $$ begin
  if (select count(distinct delivery_id) from claimed_notifications) <> 2 then
    raise exception 'Two workers claimed the same delivery';
  end if;
end $$;
select public.complete_notification_delivery(
  (select lease_token from claimed_notifications order by delivery_id limit 1),
  '<notification-test@peter-golf.test>'
);
select * from public.fail_notification_delivery(
  (select lease_token from claimed_notifications order by delivery_id desc limit 1),
  'smtp_unavailable'
);
create temporary table retry_target as
select delivery_id from claimed_notifications order by delivery_id desc limit 1;
do $$ begin
  if (select count(*) from public.list_operational_notification_deliveries(200) l
      join claimed_notifications c on c.delivery_id = l.delivery_id
      where l.status = 'sent') <> 1
    or (select count(*) from public.list_operational_notification_deliveries(200) l
      join claimed_notifications c on c.delivery_id = l.delivery_id
      where l.status = 'failed') <> 1
  then raise exception 'Completion/failure states are inconsistent'; end if;
end $$;

-- Exercise all retries until dead-letter without changing business aggregates.
select public.retry_failed_notification_deliveries();
truncate claimed_notifications;
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(50);
select * from public.fail_notification_delivery(
  (select c.lease_token from claimed_notifications c
    join retry_target t using (delivery_id)), 'smtp_unavailable');
select public.retry_failed_notification_deliveries();
truncate claimed_notifications;
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(50);
select * from public.fail_notification_delivery(
  (select c.lease_token from claimed_notifications c
    join retry_target t using (delivery_id)), 'smtp_unavailable');
select public.retry_failed_notification_deliveries();
truncate claimed_notifications;
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(50);
select * from public.fail_notification_delivery(
  (select c.lease_token from claimed_notifications c
    join retry_target t using (delivery_id)), 'smtp_unavailable');
select public.retry_failed_notification_deliveries();
truncate claimed_notifications;
insert into claimed_notifications select delivery_id, lease_token
from public.claim_notification_deliveries(50);
select * from public.fail_notification_delivery(
  (select c.lease_token from claimed_notifications c
    join retry_target t using (delivery_id)), 'smtp_unavailable');

do $$ begin
  if not exists (
    select 1 from public.list_operational_notification_deliveries(200)
    where delivery_id = (select delivery_id from retry_target)
      and status = 'dead_letter' and attempt_count = 5
      and next_attempt_at is null and last_error_code = 'smtp_unavailable'
  ) then raise exception 'Fifth failure did not reach dead-letter'; end if;
  if (select status from public.orders
      where id='76000000-0000-4000-8000-000000000001') <> 'cancelled'
    or (select status from public.order_payments
      where id='96000000-0000-4000-8000-000000000001') <> 'refunded'
  then raise exception 'Delivery failures changed order or payment state'; end if;
end $$;
reset role;

-- Expired processing leases are recovered without exposing raw errors.
update public.notification_deliveries
set processing_started_at = now() - interval '6 minutes'
where status = 'processing';
select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000002',true);
set local role authenticated;
select public.recover_expired_notification_leases();
do $$ begin
  if exists (
    select 1 from public.list_operational_notification_deliveries(200)
    where status = 'processing' and processing_started_at <= now() - interval '5 minutes'
  ) then raise exception 'Expired lease was not recovered'; end if;
end $$;
reset role;

rollback;
