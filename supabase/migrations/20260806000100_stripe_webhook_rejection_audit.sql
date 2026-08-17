-- Preserve successful webhook processing while wrapping permanent failures in
-- an outer transaction that can retain a normalized, PII-free rejection row.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated, service_role;

alter function public.process_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) set schema private;

alter function private.process_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) rename to apply_stripe_webhook_event;

revoke all on function private.apply_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) from public, anon, authenticated, service_role;

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
  rejection_code text;
  caught_code text;
  caught_message text;
  inserted_count integer;
  normalized_currency text := upper(btrim(requested_currency));
  normalized_payment_status text := lower(btrim(requested_payment_status));
begin
  if current_setting('role', true) <> 'service_role' then
    raise exception 'Stripe webhook role required'
      using errcode = '42501', hint = 'stripe_role_required';
  end if;

  select * into existing_event from public.stripe_webhook_events
  where stripe_event_id = requested_event_id;
  if found then
    if existing_event.payload_hash <> requested_payload_hash
      or existing_event.event_type <> requested_event_type
    then
      raise exception 'Stripe event id conflict'
        using errcode = '23505', hint = 'stripe_event_id_conflict';
    end if;
    return query select existing_event.processing_status = 'processed', true,
      coalesce(existing_event.error_code, existing_event.processing_status::text);
    return;
  end if;

  -- Checkout metadata is written by the server when the Session is created.
  -- Require it here so the provider Session, local attempt and payment form one
  -- identity tuple instead of trusting the provider Session ID alone.
  if requested_event_type = 'checkout.session.completed' then
    select s.* into selected_session
    from public.stripe_checkout_sessions s
    where s.stripe_checkout_session_id = requested_checkout_session_id;

    if found then
      select p.* into selected_payment
      from public.order_payments p where p.id = selected_session.payment_id;

      rejection_code := case
        when requested_checkout_attempt_id is null or requested_payment_id is null
          then 'completion_identity_missing'
        when requested_checkout_attempt_id <> selected_session.id
          or requested_payment_id <> selected_session.payment_id
          then 'completion_identity_mismatch'
        when normalized_payment_status is distinct from 'paid'
          then 'completion_payment_status'
        when requested_payment_intent_id is null
          or requested_payment_intent_id !~ '^pi_[A-Za-z0-9_]+$'
          then 'completion_payment_intent'
        when requested_amount is distinct from selected_payment.expected_amount
          then 'completion_amount'
        when normalized_currency is distinct from selected_payment.currency::text
          then 'completion_currency'
        when selected_payment.provider <> 'stripe'
          or selected_payment.method <> 'card'
          then 'payment_incoherent'
      end;
    end if;
  end if;

  if rejection_code is null then
    begin
      return query select * from private.apply_stripe_webhook_event(
        requested_event_id, requested_event_type, requested_event_created_at,
        requested_api_version, requested_livemode, requested_payload_hash,
        requested_checkout_session_id, requested_checkout_attempt_id,
        requested_payment_id, requested_payment_intent_id, requested_amount,
        requested_currency, requested_payment_status, requested_refund_id,
        requested_refund_status, requested_failure_reason,
        requested_refund_created_at
      );
      return;
    exception when others then
      get stacked diagnostics
        caught_code = returned_sqlstate,
        caught_message = message_text;

      rejection_code := case caught_message
        when 'Stripe live mode is forbidden' then 'live_mode_forbidden'
        when 'Stripe event envelope is invalid' then 'event_envelope_invalid'
        when 'Stripe event id conflict' then 'event_id_conflict'
        when 'Stripe Checkout completion mismatch' then 'completion_mismatch'
        when 'Stripe payment is incoherent' then 'payment_incoherent'
        when 'Stripe payment failure is invalid' then 'payment_failure_invalid'
        when 'Stripe refund is invalid' then 'refund_invalid'
        when 'Stripe refund amount mismatch' then 'refund_mismatch'
        when 'Stripe refund id conflict' then 'refund_id_conflict'
        when 'Stripe refunds exceed payment' then 'refund_exceeds_payment'
      end;

      if rejection_code is null then
        raise;
      end if;

      if caught_code not in ('22023', '23505', '23514') then
        raise;
      end if;
    end;
  end if;

  perform set_config('peter_golf.stripe_rpc_write', 'enabled', true);
  select * into existing_event from public.stripe_webhook_events
  where stripe_event_id = requested_event_id;
  if found then
    if existing_event.payload_hash <> requested_payload_hash
      or existing_event.event_type <> requested_event_type
    then
      perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
      raise exception 'Stripe event id conflict'
        using errcode = '23505', hint = 'stripe_event_id_conflict';
    end if;
    perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
    return query select existing_event.processing_status = 'processed', true,
      coalesce(existing_event.error_code, existing_event.processing_status::text);
    return;
  end if;

  insert into public.stripe_webhook_events (
    stripe_event_id, event_type, stripe_created_at, api_version, livemode,
    payload_hash, processing_status, error_code, processed_at
  ) values (
    requested_event_id, requested_event_type, requested_event_created_at,
    nullif(btrim(requested_api_version), ''), requested_livemode,
    requested_payload_hash, 'rejected', rejection_code, now()
  ) on conflict (stripe_event_id) do nothing;
  get diagnostics inserted_count = row_count;

  if inserted_count = 0 then
    select * into strict existing_event from public.stripe_webhook_events
    where stripe_event_id = requested_event_id;
    if existing_event.payload_hash <> requested_payload_hash
      or existing_event.event_type <> requested_event_type
    then
      perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
      raise exception 'Stripe event id conflict'
        using errcode = '23505', hint = 'stripe_event_id_conflict';
    end if;
  end if;

  perform set_config('peter_golf.stripe_rpc_write', 'disabled', true);
  return query select false, inserted_count = 0,
    case when inserted_count = 0
      then coalesce(existing_event.error_code, rejection_code)
      else rejection_code
    end;
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

comment on function public.process_stripe_webhook_event(
  text, text, timestamptz, text, boolean, text, text, uuid, uuid, text,
  bigint, text, text, text, text, text, timestamptz
) is 'Processes normalized Stripe events and retains permanent rejections without raw payload or PII.';
