-- Recover Checkout attempts that expired before they were linked to Stripe.
-- The payment aggregate, order state and inventory are intentionally untouched.

create type public.stripe_checkout_status_replacement as enum (
  'creating', 'open', 'payment_failed', 'completed', 'expired', 'abandoned'
);

alter table public.stripe_checkout_sessions
  drop constraint stripe_checkout_sessions_state_timestamps;

alter table public.stripe_checkout_sessions
  alter column status drop default,
  alter column status type public.stripe_checkout_status_replacement
    using status::text::public.stripe_checkout_status_replacement,
  alter column status set default 'creating';

drop type public.stripe_checkout_status;
alter type public.stripe_checkout_status_replacement
  rename to stripe_checkout_status;

alter table public.stripe_checkout_sessions
  add column abandoned_at timestamptz;

-- Make existing stale local attempts auditable as part of the migration. An
-- open attempt already has a real Stripe Session, so its terminal state remains
-- expired rather than abandoned.
update public.stripe_checkout_sessions
set status = 'abandoned', abandoned_at = now()
where status = 'creating' and expires_at <= now();

update public.stripe_checkout_sessions
set status = 'expired', expired_at = coalesce(expired_at, now())
where status = 'open' and expires_at <= now();

alter table public.stripe_checkout_sessions
  add constraint stripe_checkout_sessions_state_timestamps check (
    (status = 'creating'
      and stripe_checkout_session_id is null
      and stripe_payment_intent_id is null
      and completed_at is null and expired_at is null
      and failed_at is null and abandoned_at is null)
    or (status = 'open' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is null
      and failed_at is null and abandoned_at is null)
    or (status = 'payment_failed' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is null
      and failed_at is not null and abandoned_at is null)
    or (status = 'completed' and stripe_checkout_session_id is not null
      and stripe_payment_intent_id is not null and completed_at is not null
      and abandoned_at is null)
    or (status = 'expired' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is not null
      and abandoned_at is null)
    or (status = 'abandoned'
      and stripe_checkout_session_id is null
      and stripe_payment_intent_id is null
      and completed_at is null and expired_at is null and failed_at is null
      and abandoned_at is not null)
  );

comment on column public.stripe_checkout_sessions.abandoned_at is
  'Terminal timestamp for a local Checkout attempt that expired before Stripe linked a Session.';

grant update (abandoned_at, expired_at)
on public.stripe_checkout_sessions to authenticated;

create unique index stripe_checkout_sessions_one_active_payment_idx
  on public.stripe_checkout_sessions (payment_id)
  where status in ('creating', 'open');

create or replace function public.prepare_stripe_checkout_session(
  requested_order_id uuid,
  requested_idempotency_key uuid
)
returns table (
  payment_id uuid,
  checkout_attempt_id uuid,
  checkout_idempotency_key uuid,
  amount_minor_units bigint,
  currency character(3),
  stripe_checkout_session_id text,
  stripe_idempotency_key text,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_order public.orders%rowtype;
  selected_payment public.order_payments%rowtype;
  existing public.stripe_checkout_sessions%rowtype;
  active_attempt public.stripe_checkout_sessions%rowtype;
  normalized_hash text;
  new_attempt_id uuid := gen_random_uuid();
  next_attempt integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_idempotency_key is null then
    raise exception 'Stripe Checkout request is invalid' using errcode = '22023';
  end if;
  if not public.payments_test_mode_enabled()
    or not public.stripe_checkout_test_mode_enabled()
  then
    raise exception 'Stripe Checkout is disabled' using errcode = '42501';
  end if;

  perform set_config('peter_golf.payment_rpc_write', 'enabled', true);
  perform public.lock_customer_order_for_payment(requested_order_id);
  select * into selected_order from public.orders
  where id = requested_order_id and user_id = auth.uid() and origin = 'web';
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected_order.status <> 'preparing' then
    raise exception 'Order is not ready for payment' using errcode = '22023';
  end if;

  select * into selected_payment from public.order_payments
  where order_id = selected_order.id for update;
  if not found or selected_payment.provider <> 'stripe'
    or selected_payment.method <> 'card'
  then
    raise exception 'Stripe payment not found' using errcode = 'P0002';
  end if;
  if selected_payment.status not in ('pending', 'failed') then
    raise exception 'Stripe payment cannot start Checkout' using errcode = '22023';
  end if;

  normalized_hash := encode(extensions.digest(jsonb_build_object(
    'order_id', selected_order.id,
    'payment_id', selected_payment.id,
    'amount_minor_units', selected_payment.expected_amount,
    'currency', selected_payment.currency
  )::text, 'sha256'), 'hex');

  perform set_config('peter_golf.stripe_checkout_prepare', 'enabled', true);
  perform set_config('peter_golf.stripe_rpc_write', 'enabled', true);

  -- The payment row serializes callers. Lock every existing attempt as well so
  -- cleanup, idempotency lookup and attempt numbering share one transaction.
  perform 1 from public.stripe_checkout_sessions
  where stripe_checkout_sessions.payment_id = selected_payment.id
  order by attempt_number
  for update;

  update public.stripe_checkout_sessions as sessions set
    status = 'abandoned', abandoned_at = now()
  where sessions.payment_id = selected_payment.id
    and sessions.status = 'creating' and sessions.expires_at <= now();

  update public.stripe_checkout_sessions as sessions set
    status = 'expired', expired_at = coalesce(expired_at, now())
  where sessions.payment_id = selected_payment.id
    and sessions.status = 'open' and sessions.expires_at <= now();

  select * into existing from public.stripe_checkout_sessions
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.payment_id <> selected_payment.id
      or existing.created_by <> auth.uid()
      or existing.payload_hash <> normalized_hash
    then
      raise exception 'Stripe idempotency key conflict' using errcode = '23505';
    end if;
    if existing.status not in ('creating', 'open')
      or existing.expires_at <= now()
    then
      raise exception 'Stripe Checkout request is no longer active'
        using errcode = '22023';
    end if;
    return query select selected_payment.id, existing.id, existing.idempotency_key,
      existing.amount_total::bigint, existing.currency::character(3),
      existing.stripe_checkout_session_id, 'pg_checkout_' || existing.id::text,
      true;
    perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
    perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
    perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
    return;
  end if;

  select * into active_attempt from public.stripe_checkout_sessions
  where stripe_checkout_sessions.payment_id = selected_payment.id
    and status in ('creating', 'open') and expires_at > now()
  order by created_at desc limit 1 for update;
  if found then
    return query select selected_payment.id, active_attempt.id,
      active_attempt.idempotency_key,
      active_attempt.amount_total::bigint, active_attempt.currency::character(3),
      active_attempt.stripe_checkout_session_id,
      'pg_checkout_' || active_attempt.id::text, true;
    perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
    perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
    perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
    return;
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt
  from public.stripe_checkout_sessions
  where stripe_checkout_sessions.payment_id = selected_payment.id;
  insert into public.stripe_checkout_sessions (
    id, payment_id, attempt_number, idempotency_key, payload_hash, status,
    amount_total, currency, created_by, expires_at
  ) values (
    new_attempt_id, selected_payment.id, next_attempt, requested_idempotency_key,
    normalized_hash, 'creating', selected_payment.expected_amount,
    selected_payment.currency, auth.uid(), now() + interval '30 minutes'
  );
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  return query select selected_payment.id, new_attempt_id, requested_idempotency_key,
    selected_payment.expected_amount::bigint,
    selected_payment.currency::character(3), null::text,
    'pg_checkout_' || new_attempt_id::text, false;
exception when others then
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  raise;
end;
$$;

-- Linking is allowed only while the exact local reservation is still current.
-- This closes the race between a delayed Stripe response and stale cleanup.
create or replace function public.link_stripe_checkout_session(
  requested_checkout_attempt_id uuid,
  requested_idempotency_key uuid,
  requested_stripe_checkout_session_id text,
  requested_expires_at timestamptz
)
returns table (checkout_attempt_id uuid, linked boolean)
language plpgsql
security invoker
set search_path = ''
as $$
declare selected public.stripe_checkout_sessions%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_stripe_checkout_session_id !~ '^cs_test_[A-Za-z0-9_]+$'
    or requested_expires_at is null
  then
    raise exception 'Stripe Checkout link is invalid' using errcode = '22023';
  end if;
  perform set_config('peter_golf.stripe_checkout_prepare', 'enabled', true);
  perform set_config('peter_golf.stripe_rpc_write', 'enabled', true);
  select * into selected from public.stripe_checkout_sessions
  where id = requested_checkout_attempt_id and created_by = auth.uid()
  for update;
  if not found then raise exception 'Checkout attempt not found' using errcode = 'P0002'; end if;
  if selected.idempotency_key <> requested_idempotency_key then
    raise exception 'Stripe idempotency key conflict' using errcode = '23505';
  end if;
  if abs(extract(epoch from (selected.expires_at - requested_expires_at))) > 5 then
    raise exception 'Stripe Checkout expiration mismatch' using errcode = '22023';
  end if;
  if selected.stripe_checkout_session_id is not null then
    if selected.stripe_checkout_session_id <> requested_stripe_checkout_session_id then
      raise exception 'Stripe Checkout session conflict' using errcode = '23505';
    end if;
    perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
    perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
    return query select selected.id, false;
    return;
  end if;
  if selected.status <> 'creating' or selected.expires_at <= now() then
    raise exception 'Checkout attempt is no longer active' using errcode = '22023';
  end if;
  update public.stripe_checkout_sessions set
    stripe_checkout_session_id = requested_stripe_checkout_session_id,
    status = 'open', expires_at = requested_expires_at
  where id = selected.id;
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
  return query select selected.id, true;
exception when others then
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  perform set_config('peter_golf.stripe_checkout_prepare', 'disabled', true);
  raise;
end;
$$;

-- Safe projection returns both the effective state and its expiry boundary.
create or replace function public.get_customer_order(requested_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform set_config('peter_golf.customer_order_read', 'enabled', true);
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'status', o.status, 'subtotal', o.subtotal,
    'shipping_total', o.shipping_total, 'discount_total', o.discount_total,
    'tax_total', o.tax_total, 'total', o.total, 'currency', o.currency,
    'shipping_address_snapshot', o.shipping_address_snapshot,
    'payment', jsonb_build_object(
      'id', p.id, 'provider', p.provider, 'method', p.method, 'status', p.status,
      'expected_amount', p.expected_amount, 'refunded_amount', p.refunded_amount,
      'currency', p.currency, 'version', p.version,
      'submitted_at', p.submitted_at, 'under_review_at', p.under_review_at,
      'paid_at', p.paid_at, 'rejected_at', p.rejected_at,
      'refunded_at', p.refunded_at,
      'stripe_status', (
        select case
          when s.status = 'creating' and s.expires_at <= now()
            then 'abandoned'::public.stripe_checkout_status
          when s.status = 'open' and s.expires_at <= now()
            then 'expired'::public.stripe_checkout_status
          else s.status
        end
        from public.stripe_checkout_sessions s
        where s.payment_id = p.id
        order by s.attempt_number desc limit 1
      ),
      'stripe_expires_at', (
        select s.expires_at from public.stripe_checkout_sessions s
        where s.payment_id = p.id
        order by s.attempt_number desc limit 1
      ),
      'submissions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'attempt_number', s.attempt_number,
          'transfer_reference', s.transfer_reference,
          'transferred_at', s.transferred_at,
          'sender_name', s.sender_name, 'sender_bank', s.sender_bank,
          'created_at', s.created_at
        ) order by s.attempt_number)
        from public.payment_submissions s where s.payment_id = p.id
      ), '[]'::jsonb),
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
          'from_status', h.from_status, 'to_status', h.to_status,
          'created_at', h.created_at
        ) order by h.created_at)
        from public.payment_status_history h where h.payment_id = p.id
      ), '[]'::jsonb)
    ),
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sku_snapshot', oi.sku_snapshot,
        'product_name_snapshot', oi.product_name_snapshot,
        'variant_name_snapshot', oi.variant_name_snapshot,
        'condition_snapshot', oi.condition_snapshot,
        'condition_grade_snapshot', oi.condition_grade_snapshot,
        'unit_price_snapshot', oi.unit_price_snapshot,
        'currency', oi.currency, 'quantity', oi.quantity,
        'line_total', oi.line_total
      ) order by oi.created_at, oi.sku_snapshot)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', h.from_status, 'to_status', h.to_status,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb)
  ) into result
  from public.orders o
  join public.order_payments p on p.order_id = o.id
  where o.id = requested_order_id and o.user_id = auth.uid()
    and o.origin = 'web';
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  return result;
exception when others then
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  raise;
end;
$$;
