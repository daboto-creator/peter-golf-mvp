-- Auditable Stripe Checkout integration restricted to Stripe test mode.
-- Orders and inventory remain exclusively controlled by operational order RPCs.

create type public.payment_provider as enum ('manual', 'stripe');
create type public.stripe_checkout_status as enum (
  'creating', 'open', 'payment_failed', 'completed', 'expired'
);
create type public.stripe_event_processing_status as enum (
  'processing', 'processed', 'rejected'
);
create type public.stripe_refund_status as enum (
  'pending', 'requires_action', 'succeeded', 'failed', 'canceled'
);

alter type public.payment_method add value 'card';
alter type public.payment_status add value 'failed';
alter type public.payment_status add value 'partially_refunded';

alter table public.order_payments
  add column provider public.payment_provider not null default 'manual',
  add column refunded_amount public.money_minor_units not null default 0;

alter table public.order_payments
  add constraint order_payments_provider_method_coherent check (
    (provider = 'stripe' and method::text = 'card')
    or (provider = 'manual' and method::text <> 'card')
  ),
  add constraint order_payments_refunded_amount_valid check (
    refunded_amount >= 0 and refunded_amount <= expected_amount
  ),
  add constraint order_payments_refund_status_coherent check (
    (status::text = 'partially_refunded'
      and refunded_amount > 0 and refunded_amount < expected_amount)
    or (status::text = 'refunded' and (
      refunded_amount = expected_amount
      or (provider = 'manual' and refunded_amount = 0)
    ))
    or (status::text not in ('partially_refunded', 'refunded'))
  );

create table public.stripe_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete restrict,
  attempt_number integer not null,
  idempotency_key uuid not null unique,
  payload_hash text not null,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  status public.stripe_checkout_status not null default 'creating',
  amount_total public.money_minor_units not null,
  currency public.iso_currency_code not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  expires_at timestamptz not null,
  completed_at timestamptz,
  expired_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (payment_id, attempt_number),
  constraint stripe_checkout_sessions_attempt_positive check (attempt_number > 0),
  constraint stripe_checkout_sessions_payload_hash_format
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint stripe_checkout_sessions_session_id_format check (
    stripe_checkout_session_id is null
    or stripe_checkout_session_id ~ '^cs_test_[A-Za-z0-9_]+$'
  ),
  constraint stripe_checkout_sessions_payment_intent_id_format check (
    stripe_payment_intent_id is null
    or stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'
  ),
  constraint stripe_checkout_sessions_expiration_window check (
    expires_at >= created_at + interval '29 minutes'
    and expires_at <= created_at + interval '31 minutes'
  ),
  constraint stripe_checkout_sessions_state_timestamps check (
    (status = 'creating' and completed_at is null and expired_at is null and failed_at is null)
    or (status = 'open' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is null and failed_at is null)
    or (status = 'payment_failed' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is null and failed_at is not null)
    or (status = 'completed' and stripe_checkout_session_id is not null
      and stripe_payment_intent_id is not null and completed_at is not null)
    or (status = 'expired' and stripe_checkout_session_id is not null
      and completed_at is null and expired_at is not null)
  )
);

create table public.stripe_webhook_events (
  id uuid primary key default gen_random_uuid(),
  stripe_event_id text not null unique,
  event_type text not null,
  stripe_created_at timestamptz not null,
  api_version text,
  livemode boolean not null,
  payload_hash text not null,
  processing_status public.stripe_event_processing_status not null
    default 'processing',
  error_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint stripe_webhook_events_event_id_format
    check (stripe_event_id ~ '^evt_[A-Za-z0-9_]+$'),
  constraint stripe_webhook_events_allowed_type check (event_type in (
    'checkout.session.completed',
    'checkout.session.expired',
    'payment_intent.payment_failed',
    'refund.created',
    'refund.updated',
    'refund.failed'
  )),
  constraint stripe_webhook_events_payload_hash_format
    check (payload_hash ~ '^[0-9a-f]{64}$'),
  constraint stripe_webhook_events_api_version_length
    check (api_version is null or char_length(api_version) between 1 and 64),
  constraint stripe_webhook_events_error_code_format check (
    error_code is null or error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  constraint stripe_webhook_events_processing_coherent check (
    (processing_status = 'processing' and processed_at is null and error_code is null)
    or (processing_status = 'processed' and processed_at is not null and error_code is null)
    or (processing_status = 'rejected' and processed_at is not null and error_code is not null)
  )
);

create table public.stripe_refunds (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete restrict,
  stripe_refund_id text not null unique,
  stripe_payment_intent_id text not null,
  amount public.money_minor_units not null,
  currency public.iso_currency_code not null,
  status public.stripe_refund_status not null,
  failure_reason text,
  stripe_created_at timestamptz not null,
  last_event_created_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint stripe_refunds_refund_id_format
    check (stripe_refund_id ~ '^re_[A-Za-z0-9_]+$'),
  constraint stripe_refunds_payment_intent_id_format
    check (stripe_payment_intent_id ~ '^pi_[A-Za-z0-9_]+$'),
  constraint stripe_refunds_amount_positive check (amount > 0),
  constraint stripe_refunds_failure_reason_length
    check (failure_reason is null or char_length(failure_reason) between 1 and 120),
  constraint stripe_refunds_failure_reason_coherent check (
    (status = 'failed' and failure_reason is not null)
    or (status <> 'failed' and failure_reason is null)
  )
);

create index order_payments_provider_status_idx
  on public.order_payments (provider, status, updated_at desc);
create index stripe_checkout_sessions_payment_created_idx
  on public.stripe_checkout_sessions (payment_id, created_at desc);
create index stripe_checkout_sessions_status_expires_idx
  on public.stripe_checkout_sessions (status, expires_at);
create index stripe_webhook_events_status_created_idx
  on public.stripe_webhook_events (processing_status, created_at desc);
create index stripe_refunds_payment_updated_idx
  on public.stripe_refunds (payment_id, updated_at desc);

create trigger stripe_checkout_sessions_set_updated_at
before update on public.stripe_checkout_sessions
for each row execute function public.set_updated_at();
create trigger stripe_refunds_set_updated_at
before update on public.stripe_refunds
for each row execute function public.set_updated_at();

alter table public.stripe_checkout_sessions enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_refunds enable row level security;

insert into public.site_settings (key, value, description, is_public)
values (
  'stripe.checkout.mode',
  '{"mode":"disabled"}'::jsonb,
  'Database-side guard for Stripe test Checkout session preparation.',
  false
)
on conflict (key) do update set
  value = '{"mode":"disabled"}'::jsonb,
  description = excluded.description,
  is_public = false;

create or replace function public.stripe_checkout_test_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select site_settings.value->>'mode' = 'test'
    from public.site_settings
    where site_settings.key = 'stripe.checkout.mode'
  ), false);
$$;

revoke all on function public.stripe_checkout_test_mode_enabled()
from public, anon, authenticated;
grant execute on function public.stripe_checkout_test_mode_enabled()
to authenticated;

create or replace function public.require_stripe_rpc_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user in ('authenticated', 'service_role')
    and current_setting('peter_golf.stripe_rpc_write', true) <> 'enabled'
  then
    raise exception 'Stripe writes require an authorized RPC' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger stripe_checkout_sessions_require_rpc
before insert or update or delete on public.stripe_checkout_sessions
for each row execute function public.require_stripe_rpc_write();
create trigger stripe_webhook_events_require_rpc
before insert or update or delete on public.stripe_webhook_events
for each row execute function public.require_stripe_rpc_write();
create trigger stripe_refunds_require_rpc
before insert or update or delete on public.stripe_refunds
for each row execute function public.require_stripe_rpc_write();

revoke all on function public.require_stripe_rpc_write()
from public, anon, authenticated;

create policy "order staff can read stripe checkout sessions"
on public.stripe_checkout_sessions for select to authenticated
using ((select public.can_manage_orders()));
create policy "customers can read own stripe sessions through safe rpc"
on public.stripe_checkout_sessions for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1 from public.order_payments p
    join public.orders o on o.id = p.order_id
    where p.id = stripe_checkout_sessions.payment_id
      and o.user_id = (select auth.uid()) and o.origin = 'web'
  )
);
create policy "customers can prepare own stripe sessions through rpc"
on public.stripe_checkout_sessions for select to authenticated
using (
  current_setting('peter_golf.stripe_checkout_prepare', true) = 'enabled'
  and created_by = (select auth.uid())
);
create policy "customers can insert own stripe sessions through rpc"
on public.stripe_checkout_sessions for insert to authenticated
with check (
  current_setting('peter_golf.stripe_checkout_prepare', true) = 'enabled'
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.order_payments p
    join public.orders o on o.id = p.order_id
    where p.id = stripe_checkout_sessions.payment_id
      and o.user_id = (select auth.uid()) and o.origin = 'web'
  )
);
create policy "customers can update own stripe sessions through rpc"
on public.stripe_checkout_sessions for update to authenticated
using (
  current_setting('peter_golf.stripe_checkout_prepare', true) = 'enabled'
  and created_by = (select auth.uid())
)
with check (
  current_setting('peter_golf.stripe_checkout_prepare', true) = 'enabled'
  and created_by = (select auth.uid())
);

create policy "order staff can read stripe webhook events"
on public.stripe_webhook_events for select to authenticated
using ((select public.can_manage_orders()));

create policy "order staff can read stripe refunds"
on public.stripe_refunds for select to authenticated
using ((select public.can_manage_orders()));
create policy "customers can read own stripe refunds through safe rpc"
on public.stripe_refunds for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1 from public.order_payments p
    join public.orders o on o.id = p.order_id
    where p.id = stripe_refunds.payment_id
      and o.user_id = (select auth.uid()) and o.origin = 'web'
  )
);

revoke all on public.stripe_checkout_sessions, public.stripe_webhook_events,
  public.stripe_refunds from anon, authenticated;
grant select on public.stripe_checkout_sessions, public.stripe_refunds
to authenticated;
grant select on public.stripe_webhook_events to authenticated;
grant insert (
  id, payment_id, attempt_number, idempotency_key, payload_hash, status,
  amount_total, currency, created_by, expires_at
) on public.stripe_checkout_sessions to authenticated;
grant update (
  stripe_checkout_session_id, status, expires_at, updated_at
) on public.stripe_checkout_sessions to authenticated;
grant update (refunded_amount) on public.order_payments to authenticated;

-- The eight-argument checkout fixes the payment method at order creation.
-- The previous seven-argument contract remains the bank-transfer default.
create or replace function public.create_customer_checkout_order(
  requested_cart_id uuid,
  expected_version integer,
  requested_shipping_method_id uuid,
  requested_saved_address_id uuid,
  requested_address jsonb,
  requested_save_address boolean,
  requested_idempotency_key uuid,
  requested_payment_method public.payment_method
)
returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  result record;
  selected_payment public.order_payments%rowtype;
  selected_provider public.payment_provider;
begin
  if requested_payment_method not in ('bank_transfer', 'card') then
    raise exception 'Checkout payment method is invalid' using errcode = '22023';
  end if;
  if requested_payment_method = 'card' and not public.stripe_checkout_test_mode_enabled() then
    raise exception 'Stripe Checkout is disabled' using errcode = '42501';
  end if;
  selected_provider := case requested_payment_method
    when 'card' then 'stripe'::public.payment_provider
    else 'manual'::public.payment_provider
  end;

  select * into result from public.create_customer_checkout_order(
    requested_cart_id, expected_version, requested_shipping_method_id,
    requested_saved_address_id, requested_address, requested_save_address,
    requested_idempotency_key
  );

  select * into strict selected_payment from public.order_payments
  where order_payments.order_id = result.order_id for update;
  if result.replayed then
    if selected_payment.method <> requested_payment_method
      or selected_payment.provider <> selected_provider
    then
      raise exception 'Checkout idempotency key conflict' using errcode = '23505';
    end if;
  else
    update public.order_payments set
      method = requested_payment_method,
      provider = selected_provider
    where id = selected_payment.id;
  end if;
  return query select result.order_id, result.order_number, result.replayed;
end;
$$;

revoke all on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid, public.payment_method
) from public, anon;
grant execute on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid, public.payment_method
) to authenticated;

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
  select * into existing from public.stripe_checkout_sessions
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.payment_id <> selected_payment.id
      or existing.created_by <> auth.uid()
      or existing.payload_hash <> normalized_hash
    then
      raise exception 'Stripe idempotency key conflict' using errcode = '23505';
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

revoke all on function public.prepare_stripe_checkout_session(uuid, uuid),
  public.link_stripe_checkout_session(uuid, uuid, text, timestamptz)
from public, anon, authenticated;
grant execute on function public.prepare_stripe_checkout_session(uuid, uuid),
  public.link_stripe_checkout_session(uuid, uuid, text, timestamptz)
to authenticated;

-- Stripe webhooks provide only normalized scalar fields. Raw event bodies and
-- customer/card data are never persisted. One call records and applies an event.
create or replace function public.process_stripe_webhook_event(
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
    if not found then raise exception 'Stripe Checkout session not found' using errcode = 'P0002'; end if;
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
        status = 'completed', stripe_payment_intent_id = requested_payment_intent_id,
        completed_at = coalesce(completed_at, requested_event_created_at),
        expired_at = null, failed_at = failed_at
      where id = selected_session.id and status <> 'completed';
      if selected_payment.status in ('pending', 'failed') then
        update public.order_payments set
          status = 'paid', paid_at = coalesce(paid_at, requested_event_created_at),
          version = version + 1
        where id = selected_payment.id;
      end if;
    else
      if selected_session.status <> 'completed' then
        update public.stripe_checkout_sessions set
          status = 'expired', expired_at = coalesce(expired_at, requested_event_created_at),
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
    if not found then raise exception 'Stripe Checkout attempt not found' using errcode = 'P0002'; end if;
    select * into strict selected_payment from public.order_payments
    where id = selected_session.payment_id for update;
    if selected_payment.status in ('pending', 'failed')
      and selected_session.status <> 'completed'
    then
      update public.stripe_checkout_sessions set
        status = 'payment_failed',
        stripe_payment_intent_id = coalesce(stripe_payment_intent_id, requested_payment_intent_id),
        failed_at = greatest(coalesce(failed_at, requested_event_created_at), requested_event_created_at),
        expired_at = null
      where id = selected_session.id;
      if selected_payment.status <> 'failed' then
        update public.order_payments set status = 'failed', version = version + 1
        where id = selected_payment.id;
      end if;
    end if;

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
    if not found then raise exception 'Stripe payment not found' using errcode = 'P0002'; end if;
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
      when successful_refunds = selected_payment.expected_amount then 'refunded'::public.payment_status
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

revoke all on function public.process_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.process_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) to service_role;

-- Manual payment review remains available only for manual-provider payments.
create or replace function public.review_order_payment(
  requested_order_id uuid,
  expected_payment_version integer,
  requested_status public.payment_status,
  requested_reason text,
  requested_idempotency_key uuid
)
returns table (
  payment_id uuid, status public.payment_status, version integer, replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_payment public.order_payments%rowtype;
  existing public.payment_idempotency_keys%rowtype;
  normalized_reason text := nullif(btrim(requested_reason), '');
  selected_operation text;
  payload_hash text;
begin
  if not public.can_manage_orders() then
    raise exception 'Order access denied' using errcode = '42501';
  end if;
  selected_operation := case requested_status
    when 'under_review' then 'start_review'
    when 'paid' then 'approve'
    when 'rejected' then 'reject'
    when 'refunded' then 'refund'
    else null
  end;
  if requested_idempotency_key is null or expected_payment_version < 1
    or selected_operation is null
    or (requested_status in ('rejected', 'refunded') and
      (normalized_reason is null or char_length(normalized_reason) not between 3 and 500))
    or (requested_status not in ('rejected', 'refunded') and normalized_reason is not null)
  then
    raise exception 'Payment review request is invalid' using errcode = '22023';
  end if;

  perform set_config('peter_golf.payment_rpc_write', 'enabled', true);
  select * into selected_payment from public.order_payments
  where order_id = requested_order_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;
  if selected_payment.provider <> 'manual' then
    raise exception 'Stripe payments cannot be reviewed manually' using errcode = '42501';
  end if;

  payload_hash := encode(extensions.digest(jsonb_build_object(
    'order_id', requested_order_id,
    'expected_payment_version', expected_payment_version,
    'status', requested_status,
    'reason', normalized_reason
  )::text, 'sha256'), 'hex');
  select * into existing from public.payment_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> selected_operation
      or existing.payment_id <> selected_payment.id
      or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select selected_payment.id, selected_payment.status,
      selected_payment.version, true;
    return;
  end if;
  if selected_payment.version <> expected_payment_version then
    raise exception 'Payment changed' using errcode = '40001';
  end if;
  if not (
    (selected_payment.status = 'submitted' and requested_status in ('under_review', 'rejected'))
    or (selected_payment.status = 'under_review' and requested_status in ('paid', 'rejected'))
    or (selected_payment.status = 'paid' and requested_status = 'refunded')
  ) then
    raise exception 'Payment transition is invalid' using errcode = '22023';
  end if;

  perform set_config('peter_golf.payment_transition_note', coalesce(normalized_reason, ''), true);
  update public.order_payments set
    status = requested_status,
    under_review_at = case when requested_status = 'under_review' then now() else under_review_at end,
    paid_at = case when requested_status = 'paid' then now() else paid_at end,
    rejected_at = case when requested_status = 'rejected' then now() else rejected_at end,
    refunded_amount = case when requested_status = 'refunded' then expected_amount else refunded_amount end,
    refunded_at = case when requested_status = 'refunded' then now() else refunded_at end,
    reviewed_by = auth.uid(), version = order_payments.version + 1
  where id = selected_payment.id;
  insert into public.payment_idempotency_keys (
    idempotency_key, actor_id, operation, payment_id, payload_hash
  ) values (
    requested_idempotency_key, auth.uid(), selected_operation,
    selected_payment.id, payload_hash
  );
  perform set_config('peter_golf.payment_transition_note', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  return query select selected_payment.id, requested_status,
    selected_payment.version + 1, false;
exception when others then
  perform set_config('peter_golf.payment_transition_note', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  raise;
end;
$$;

-- A partially refunded order is still paid. Only a full refund permits cancel.
create or replace function public.prevent_paid_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
    and exists (
      select 1 from public.order_payments
      where order_payments.order_id = new.id
        and order_payments.status in ('paid', 'partially_refunded')
    )
  then
    raise exception 'Paid order must be fully refunded before cancellation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

-- Extend safe customer projections with provider, refund totals and latest
-- Checkout state. No Stripe URL, event body, metadata or actor identifiers leak.
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
        select s.status from public.stripe_checkout_sessions s
        where s.payment_id = p.id order by s.created_at desc limit 1
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
