-- Local-only regression checks for stale pre-Stripe Checkout attempts.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('17000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'stripe.recovery@example.test', '{}', '{}', now(), now()),
  ('17000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'stripe.recovery.other@example.test', '{}', '{}', now(), now());

insert into public.orders (
  id, order_number, user_id, status, subtotal, total,
  shipping_address_snapshot, confirmed_at, confirmed_by,
  payment_status, payment_method, origin
) values
  ('77000000-0000-4000-8000-000000000001', 'PG-W-RECOVERY-000001',
    '17000000-0000-4000-8000-000000000001', 'pending_confirmation', 12500, 12500,
    '{"recipient_name":"Recovery"}', now(),
    '17000000-0000-4000-8000-000000000001',
    'transfer_pending', 'bank_transfer', 'web'),
  ('77000000-0000-4000-8000-000000000002', 'PG-W-RECOVERY-000002',
    '17000000-0000-4000-8000-000000000001', 'pending_confirmation', 12500, 12500,
    '{"recipient_name":"Current"}', now(),
    '17000000-0000-4000-8000-000000000001',
    'transfer_pending', 'bank_transfer', 'web'),
  ('77000000-0000-4000-8000-000000000003', 'PG-W-RECOVERY-000003',
    '17000000-0000-4000-8000-000000000002', 'pending_confirmation', 12500, 12500,
    '{"recipient_name":"Other"}', now(),
    '17000000-0000-4000-8000-000000000002',
    'transfer_pending', 'bank_transfer', 'web'),
  ('77000000-0000-4000-8000-000000000004', 'PG-W-RECOVERY-MANUAL',
    '17000000-0000-4000-8000-000000000001', 'pending_confirmation', 12500, 12500,
    '{"recipient_name":"Manual"}', now(),
    '17000000-0000-4000-8000-000000000001',
    'transfer_pending', 'bank_transfer', 'web');

insert into public.order_payments (
  id, order_id, provider, method, status, expected_amount, currency
) values
  ('97000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000001', 'stripe', 'card', 'pending', 12500, 'MXN'),
  ('97000000-0000-4000-8000-000000000002',
    '77000000-0000-4000-8000-000000000002', 'stripe', 'card', 'pending', 12500, 'MXN'),
  ('97000000-0000-4000-8000-000000000003',
    '77000000-0000-4000-8000-000000000003', 'stripe', 'card', 'pending', 12500, 'MXN'),
  ('97000000-0000-4000-8000-000000000004',
    '77000000-0000-4000-8000-000000000004', 'manual', 'bank_transfer', 'pending', 12500, 'MXN');

insert into public.stripe_checkout_sessions (
  id, payment_id, attempt_number, idempotency_key, payload_hash, status,
  amount_total, currency, created_by, created_at, expires_at
) values (
  'a7000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001', 1,
  'b7000000-0000-4000-8000-000000000001', repeat('a', 64), 'creating',
  12500, 'MXN', '17000000-0000-4000-8000-000000000001',
  now() - interval '31 minutes', now() - interval '1 minute'
);

update public.site_settings set value = '{"mode":"test"}' where key = 'payments.mode';
update public.site_settings set value = '{"mode":"test"}' where key = 'stripe.checkout.mode';

create temp table recovery_invariants as
select
  (select row(o.status, o.version, o.updated_at)::text from public.orders o
    where o.id = '77000000-0000-4000-8000-000000000001') as stripe_order,
  (select row(p.status, p.version, p.updated_at)::text from public.order_payments p
    where p.id = '97000000-0000-4000-8000-000000000001') as stripe_payment,
  (select row(p.status, p.version, p.updated_at)::text from public.order_payments p
    where p.id = '97000000-0000-4000-8000-000000000004') as manual_payment,
  (select row(count(*), coalesce(sum(quantity_on_hand), 0),
    coalesce(sum(quantity_reserved), 0))::text from public.inventory) as inventory;

select set_config(
  'request.jwt.claim.sub', '17000000-0000-4000-8000-000000000001', true
);
set local role authenticated;

-- The safe projection derives an effective terminal state even before cleanup.
do $$ declare detail jsonb; begin
  detail := public.get_customer_order('77000000-0000-4000-8000-000000000001');
  if detail->'payment'->>'stripe_status' <> 'abandoned'
    or (detail->'payment'->>'stripe_expires_at')::timestamptz > now()
  then
    raise exception 'Projection exposed stale creating as active: %', detail;
  end if;
end $$;

-- Ownership and RLS remain enforced.
do $$ begin
  begin
    perform public.prepare_stripe_checkout_session(
      '77000000-0000-4000-8000-000000000003',
      'b7000000-0000-4000-8000-000000000003'
    );
    raise exception 'Expected ownership denial';
  exception when no_data_found then null; end;
  if (select count(*) from public.stripe_checkout_sessions) <> 0 then
    raise exception 'Customer Stripe rows leaked through RLS';
  end if;
end $$;

-- A stale creating row is closed in the same transaction and attempt 2 starts.
do $$ declare prepared record; replay record; begin
  select * into prepared from public.prepare_stripe_checkout_session(
    '77000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002'
  );
  if prepared.replayed
    or prepared.checkout_attempt_id = 'a7000000-0000-4000-8000-000000000001'
  then raise exception 'Stale attempt was reused'; end if;

  select * into replay from public.prepare_stripe_checkout_session(
    '77000000-0000-4000-8000-000000000001',
    'b7000000-0000-4000-8000-000000000002'
  );
  if not replay.replayed
    or replay.checkout_attempt_id <> prepared.checkout_attempt_id
  then raise exception 'Double execution was not idempotent'; end if;
end $$;

-- A current creating attempt blocks every second request, even with a new key.
do $$ declare first record; second record; begin
  select * into first from public.prepare_stripe_checkout_session(
    '77000000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000004'
  );
  select * into second from public.prepare_stripe_checkout_session(
    '77000000-0000-4000-8000-000000000002',
    'b7000000-0000-4000-8000-000000000005'
  );
  if not second.replayed or second.checkout_attempt_id <> first.checkout_attempt_id
  then raise exception 'Current creating attempt did not block a second attempt'; end if;
end $$;

reset role;

-- Verify audit fields, constraints, monotonic numbering and aggregate isolation.
do $$ begin
  if not exists (
    select 1 from public.stripe_checkout_sessions
    where id = 'a7000000-0000-4000-8000-000000000001'
      and status = 'abandoned' and abandoned_at is not null
      and stripe_checkout_session_id is null
      and stripe_payment_intent_id is null
  ) then raise exception 'Stale pre-Stripe attempt was not audibly abandoned'; end if;
  if not exists (
    select 1 from public.stripe_checkout_sessions
    where payment_id = '97000000-0000-4000-8000-000000000001'
      and attempt_number = 2 and status = 'creating'
  ) then raise exception 'Attempt number did not advance to 2'; end if;
  if (select count(*) from public.stripe_checkout_sessions
      where payment_id = '97000000-0000-4000-8000-000000000001'
        and status in ('creating', 'open')) <> 1
  then raise exception 'Payment has multiple active Checkout attempts'; end if;

  if (select row(o.status, o.version, o.updated_at)::text from public.orders o
      where o.id = '77000000-0000-4000-8000-000000000001')
      <> (select stripe_order from recovery_invariants)
    or (select row(p.status, p.version, p.updated_at)::text from public.order_payments p
      where p.id = '97000000-0000-4000-8000-000000000001')
      <> (select stripe_payment from recovery_invariants)
    or (select row(p.status, p.version, p.updated_at)::text from public.order_payments p
      where p.id = '97000000-0000-4000-8000-000000000004')
      <> (select manual_payment from recovery_invariants)
    or (select row(count(*), coalesce(sum(quantity_on_hand), 0),
      coalesce(sum(quantity_reserved), 0))::text from public.inventory)
      <> (select inventory from recovery_invariants)
  then raise exception 'Recovery changed an order, payment or inventory aggregate'; end if;
end $$;

-- The partial unique index is the final concurrency guard after row locking.
do $$ begin
  if not exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'stripe_checkout_sessions_one_active_payment_idx'
      and indexdef like '%UNIQUE%'
      and indexdef like '%status = ANY%creating%open%'
  ) then raise exception 'Active Checkout uniqueness index is missing'; end if;

  begin
    insert into public.stripe_checkout_sessions (
      payment_id, attempt_number, idempotency_key, payload_hash, status,
      amount_total, currency, created_by, expires_at
    ) values (
      '97000000-0000-4000-8000-000000000002', 2,
      'b7000000-0000-4000-8000-000000000006', repeat('b', 64), 'creating',
      12500, 'MXN', '17000000-0000-4000-8000-000000000001',
      now() + interval '30 minutes'
    );
    raise exception 'Expected concurrent-active uniqueness rejection';
  exception when unique_violation then null; end;
end $$;

select 'stripe abandoned Checkout recovery checks passed' as result;
rollback;
