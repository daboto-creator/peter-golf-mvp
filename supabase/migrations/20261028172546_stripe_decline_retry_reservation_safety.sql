-- Stripe Checkout owns the reservation lifetime. A failed PaymentIntent is a
-- retryable card attempt while the hosted Checkout Session remains open; only
-- Checkout completion, Checkout expiry, or an authorized safe cancellation is
-- terminal for the inventory reservation.

create or replace function private.apply_stripe_webhook_event(
  requested_event_id text,
  requested_event_type text,
  requested_event_created_at timestamptz,
  requested_api_version text,
  requested_livemode boolean,
  requested_payload_hash text,
  requested_checkout_session_id text,
  requested_checkout_attempt_id uuid,
  requested_payment_id uuid,
  requested_payment_intent_id text,
  requested_amount bigint,
  requested_currency text,
  requested_payment_status text,
  requested_refund_id text,
  requested_refund_status text,
  requested_failure_reason text,
  requested_refund_created_at timestamptz
)
returns table (processed boolean, replayed boolean, outcome text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_event public.stripe_webhook_events%rowtype;
  selected_session public.stripe_checkout_sessions%rowtype;
  selected_payment public.order_payments%rowtype;
  selected_refund public.stripe_refunds%rowtype;
  normalized_currency text := upper(btrim(requested_currency));
  normalized_refund_status public.stripe_refund_status;
  successful_refunds bigint;
  next_payment_status public.payment_status;
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'Stripe webhook role required' using errcode = '42501';
  end if;
  if requested_livemode then
    raise exception 'Stripe live mode is forbidden' using errcode = '22023';
  end if;
  if requested_event_id !~ '^evt_[A-Za-z0-9_]+$'
    or requested_payload_hash !~ '^[0-9a-f]{64}$'
    or requested_event_type not in (
      'checkout.session.completed', 'checkout.session.expired',
      'payment_intent.payment_failed', 'refund.created', 'refund.updated',
      'refund.failed'
    )
  then
    raise exception 'Stripe event envelope is invalid' using errcode = '22023';
  end if;

  perform set_config('peter_golf.stripe_rpc_write', 'enabled', true);
  select * into existing_event from public.stripe_webhook_events
  where stripe_event_id = requested_event_id;
  if found then
    if existing_event.payload_hash <> requested_payload_hash
      or existing_event.event_type <> requested_event_type
    then
      raise exception 'Stripe event id conflict' using errcode = '23505';
    end if;
    return query select existing_event.processing_status = 'processed', true,
      existing_event.processing_status::text;
    perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
    return;
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id, event_type, stripe_created_at, api_version, livemode,
    payload_hash
  ) values (
    requested_event_id, requested_event_type, requested_event_created_at,
    nullif(btrim(requested_api_version), ''), requested_livemode,
    requested_payload_hash
  );

  if requested_event_type like 'checkout.session.%' then
    select * into selected_session from public.stripe_checkout_sessions
    where stripe_checkout_session_id = requested_checkout_session_id
    for update;
    if not found then
      raise exception 'Stripe Checkout session not found' using errcode = 'P0002';
    end if;
    select * into strict selected_payment from public.order_payments
    where id = selected_session.payment_id for update;

    if requested_event_type = 'checkout.session.completed' then
      if requested_payment_status <> 'paid'
        or requested_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
        or requested_amount <> selected_payment.expected_amount
        or normalized_currency <> selected_payment.currency
      then
        raise exception 'Stripe Checkout completion mismatch' using errcode = '22023';
      end if;
      if selected_payment.provider <> 'stripe' or selected_payment.method <> 'card' then
        raise exception 'Stripe payment is incoherent' using errcode = '23514';
      end if;
      update public.stripe_checkout_sessions set
        status = 'completed',
        stripe_payment_intent_id = requested_payment_intent_id,
        completed_at = coalesce(completed_at, requested_event_created_at),
        expired_at = null,
        failed_at = failed_at
      where id = selected_session.id and status <> 'completed';
      if selected_payment.status in ('pending', 'failed') then
        update public.order_payments set
          status = 'paid',
          paid_at = coalesce(paid_at, requested_event_created_at),
          version = version + 1
        where id = selected_payment.id;
      end if;
    else
      if selected_session.status <> 'completed' then
        update public.stripe_checkout_sessions set
          status = 'expired',
          expired_at = coalesce(expired_at, requested_event_created_at),
          failed_at = null
        where id = selected_session.id and status <> 'expired';
      end if;
    end if;

  elsif requested_event_type = 'payment_intent.payment_failed' then
    if requested_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
      or requested_checkout_attempt_id is null or requested_payment_id is null
    then
      raise exception 'Stripe payment failure is invalid' using errcode = '22023';
    end if;
    select * into selected_session from public.stripe_checkout_sessions
    where id = requested_checkout_attempt_id and payment_id = requested_payment_id
    for update;
    if not found then
      raise exception 'Stripe Checkout attempt not found' using errcode = 'P0002';
    end if;
    select * into strict selected_payment from public.order_payments
    where id = selected_session.payment_id for update;
    if selected_payment.provider <> 'stripe' or selected_payment.method <> 'card' then
      raise exception 'Stripe payment is incoherent' using errcode = '23514';
    end if;
    -- A PaymentIntent failure is one retryable card attempt. The persisted,
    -- idempotent webhook event is the audit record; the Checkout Session stays
    -- open and the payment aggregate stays pending. Completed/expired states are
    -- likewise never downgraded by a delayed failure event.

  else
    if requested_refund_id !~ '^re_[A-Za-z0-9_]+$'
      or requested_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
      or requested_amount is null or requested_amount <= 0
      or requested_refund_created_at is null
      or requested_refund_status not in (
        'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
      )
    then
      raise exception 'Stripe refund is invalid' using errcode = '22023';
    end if;
    normalized_refund_status := requested_refund_status::public.stripe_refund_status;
    select p.* into selected_payment from public.order_payments p
    join public.stripe_checkout_sessions s on s.payment_id = p.id
    where s.stripe_payment_intent_id = requested_payment_intent_id
    limit 1 for update of p;
    if not found then
      raise exception 'Stripe payment not found' using errcode = 'P0002';
    end if;
    if normalized_currency <> selected_payment.currency
      or requested_amount > selected_payment.expected_amount
      or selected_payment.provider <> 'stripe'
    then
      raise exception 'Stripe refund amount mismatch' using errcode = '22023';
    end if;
    if normalized_refund_status = 'failed'
      and nullif(btrim(requested_failure_reason), '') is null
    then
      requested_failure_reason := 'stripe_refund_failed';
    end if;

    select * into selected_refund from public.stripe_refunds
    where stripe_refund_id = requested_refund_id for update;
    if not found then
      insert into public.stripe_refunds (
        payment_id, stripe_refund_id, stripe_payment_intent_id, amount,
        currency, status, failure_reason, stripe_created_at,
        last_event_created_at
      ) values (
        selected_payment.id, requested_refund_id, requested_payment_intent_id,
        requested_amount, normalized_currency, normalized_refund_status,
        case when normalized_refund_status = 'failed'
          then left(btrim(requested_failure_reason), 120) end,
        requested_refund_created_at, requested_event_created_at
      );
    elsif requested_event_created_at >= selected_refund.last_event_created_at then
      if selected_refund.payment_id <> selected_payment.id
        or selected_refund.amount <> requested_amount
        or selected_refund.currency <> normalized_currency
      then
        raise exception 'Stripe refund id conflict' using errcode = '23505';
      end if;
      if selected_refund.status not in ('succeeded', 'failed', 'canceled')
        or selected_refund.status = normalized_refund_status
      then
        update public.stripe_refunds set
          status = normalized_refund_status,
          failure_reason = case when normalized_refund_status = 'failed'
            then left(btrim(requested_failure_reason), 120) end,
          last_event_created_at = requested_event_created_at
        where id = selected_refund.id;
      end if;
    end if;

    select coalesce(sum(amount), 0) into successful_refunds
    from public.stripe_refunds
    where payment_id = selected_payment.id and status = 'succeeded';
    if successful_refunds > selected_payment.expected_amount then
      raise exception 'Stripe refunds exceed payment' using errcode = '23514';
    end if;
    next_payment_status := case
      when successful_refunds = selected_payment.expected_amount
        then 'refunded'::public.payment_status
      when successful_refunds > 0 then 'partially_refunded'::public.payment_status
      else selected_payment.status
    end;
    if successful_refunds <> selected_payment.refunded_amount
      or next_payment_status <> selected_payment.status
    then
      update public.order_payments set
        refunded_amount = successful_refunds,
        status = next_payment_status,
        refunded_at = case when next_payment_status = 'refunded'
          then requested_event_created_at else null end,
        version = version + 1
      where id = selected_payment.id;
    end if;
  end if;

  update public.stripe_webhook_events set
    processing_status = 'processed', processed_at = now()
  where stripe_event_id = requested_event_id;
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  return query select true, false, 'processed'::text;
exception when others then
  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function private.apply_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;

-- A local attempt is created before the provider call and is then linked to the
-- provider's authoritative expiry. Extend every ACTIVE reservation atomically
-- at both points so generic expiry can never precede a payable Session.
create or replace function private.sync_stripe_checkout_reservation_expiry()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order_id uuid;
begin
  if new.status not in ('creating', 'open') then
    return new;
  end if;

  select p.order_id into selected_order_id
  from public.order_payments p
  where p.id = new.payment_id;

  if selected_order_id is null or not exists (
    select 1 from public.inventory_reservations r
    where r.order_id = selected_order_id
  ) then
    return new;
  end if;

  perform 1 from public.inventory_reservations r
  where r.order_id = selected_order_id
  order by r.id
  for update;

  if exists (
    select 1 from public.inventory_reservations r
    where r.order_id = selected_order_id and r.status <> 'ACTIVE'
  ) then
    raise exception 'Stripe Checkout reservation is not active'
      using errcode = '23514';
  end if;

  perform set_config('peter_golf.marketplace_order_write', 'enabled', true);
  update public.inventory_reservations r
  set expires_at = greatest(r.expires_at, new.expires_at)
  where r.order_id = selected_order_id
    and r.status = 'ACTIVE'
    and r.expires_at < new.expires_at;
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  return new;
exception when others then
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function private.sync_stripe_checkout_reservation_expiry()
from public, anon, authenticated, service_role;

drop trigger if exists stripe_checkout_sync_reservation_expiry
  on public.stripe_checkout_sessions;
create trigger stripe_checkout_sync_reservation_expiry
after insert or update
on public.stripe_checkout_sessions
for each row execute function private.sync_stripe_checkout_reservation_expiry();

-- The existing Operations cancellation path cannot close a remote Checkout
-- Session. Refuse cancellation while any linked or in-flight attempt can still
-- become paid; expiry remains the safe terminal path that releases inventory.
create or replace function private.guard_cancel_with_payable_stripe_checkout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status
    and exists (
      select 1
      from public.order_payments p
      join public.stripe_checkout_sessions s on s.payment_id = p.id
      where p.order_id = new.id
        and p.provider = 'stripe'
        and p.status = 'pending'
        and s.status in ('creating', 'open', 'payment_failed')
        and s.expires_at > now()
    )
  then
    raise exception 'Payable Stripe Checkout must expire before cancellation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function private.guard_cancel_with_payable_stripe_checkout()
from public, anon, authenticated, service_role;

drop trigger if exists orders_guard_payable_stripe_checkout_cancel
  on public.orders;
create trigger orders_guard_payable_stripe_checkout_cancel
before update of status on public.orders
for each row execute function private.guard_cancel_with_payable_stripe_checkout();

comment on function private.apply_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) is 'Applies normalized Stripe events. PaymentIntent failures are auditable, retryable attempts and do not change Checkout, payment, or reservation state.';
