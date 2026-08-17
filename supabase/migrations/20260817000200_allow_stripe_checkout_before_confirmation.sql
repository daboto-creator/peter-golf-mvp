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
  if selected_order.status <> 'pending_confirmation' then
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
