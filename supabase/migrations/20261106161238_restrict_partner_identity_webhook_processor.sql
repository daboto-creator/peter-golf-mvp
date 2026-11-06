-- This processor is called only after the identity-provider signature is
-- verified by the server-side webhook route. Keep its database boundary equal
-- to the internal Stripe webhook processor boundary.
create or replace function public.process_partner_identity_webhook(
  requested_provider text,
  requested_event_id uuid,
  requested_external_session_id text,
  requested_result public.identity_verification_result,
  requested_attributes jsonb,
  requested_warning_codes text[],
  requested_occurred_at timestamptz,
  requested_payload_sha256 text
) returns boolean
language plpgsql security definer set search_path = '' as $$
declare verification public.partner_identity_verifications; is_person boolean;
begin
  if current_setting('role', true) is distinct from 'service_role' then
    raise exception 'Identity webhook role required' using errcode = '42501';
  end if;

  if requested_provider !~ '^[A-Z][A-Z0-9_]{1,39}$'
    or jsonb_typeof(requested_attributes) <> 'object'
    or requested_payload_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'Identity webhook payload invalid' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'identity-webhook:' || requested_event_id::text, 0
  ));
  if exists (
    select 1 from public.partner_identity_webhook_events
    where event_id = requested_event_id
  ) then
    return false;
  end if;
  select * into verification from public.partner_identity_verifications
  where provider = requested_provider
    and external_session_id = requested_external_session_id
  for update;
  if not found then
    raise exception 'Identity session not found' using errcode = 'P0002';
  end if;
  is_person := verification.session_kind = 'PERSON';
  if requested_result = 'PASSED' and is_person and (
    coalesce((requested_attributes ->> 'livenessPassed')::boolean, false) = false
    or coalesce((requested_attributes ->> 'faceMatchPassed')::boolean, false) = false
  ) then
    requested_result := 'REVIEW_REQUIRED';
    requested_warning_codes := array_append(
      requested_warning_codes, 'LIVENESS_OR_FACE_MATCH_REQUIRED'
    );
  end if;
  update public.partner_identity_verifications set
    result = requested_result,
    normalized_attributes = requested_attributes
      - array['documentNumber', 'personalNumber', 'dateOfBirth'],
    warning_codes = coalesce(requested_warning_codes, '{}'),
    liveness_passed = nullif(requested_attributes ->> 'livenessPassed', '')::boolean,
    face_match_passed = nullif(requested_attributes ->> 'faceMatchPassed', '')::boolean,
    completed_at = case when requested_result = 'PENDING' then null else requested_occurred_at end,
    updated_at = now()
  where id = verification.id;
  insert into public.partner_identity_webhook_events(
    event_id, verification_id, provider, external_session_id, result,
    payload_sha256, occurred_at
  ) values (
    requested_event_id, verification.id, requested_provider,
    requested_external_session_id, requested_result,
    requested_payload_sha256, requested_occurred_at
  );
  if requested_result in ('REVIEW_REQUIRED', 'FAILED') then
    insert into public.marketplace_partner_notification_outbox(
      event_type, channel, recipient_user_id, subject, body_text, deduplication_key
    ) select 'PARTNER_IDENTITY_ALERT', 'INTERNAL', ur.user_id,
      'Alerta de verificación Partner',
      'Una verificación requiere revisión en Operations.',
      'identity-alert:' || requested_event_id::text || ':' || ur.user_id::text
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where r.name in ('operator', 'admin')
    on conflict (deduplication_key) do nothing;
    insert into public.marketplace_partner_notification_outbox(
      event_type, channel, recipient_user_id, recipient_email,
      subject, body_text, deduplication_key
    ) select 'PARTNER_IDENTITY_ALERT', 'EMAIL', ur.user_id, u.email,
      'Alerta de verificación Partner',
      'Una verificación requiere revisión en Operations.',
      'identity-alert-email:' || requested_event_id::text || ':' || ur.user_id::text
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join auth.users u on u.id = ur.user_id
    where r.name in ('operator', 'admin') and u.email is not null
    on conflict (deduplication_key) do nothing;
  end if;
  perform private.write_marketplace_audit(
    'marketplace.identity_result_received',
    'partner_identity_verification', verification.id,
    'Signed identity provider result received', null,
    jsonb_build_object(
      'provider', requested_provider,
      'result', requested_result,
      'warning_count', cardinality(requested_warning_codes)
    )
  );
  return true;
end;
$$;

revoke all on function public.process_partner_identity_webhook(
  text, uuid, text, public.identity_verification_result,
  jsonb, text[], timestamptz, text
) from public, anon, authenticated, service_role;

grant execute on function public.process_partner_identity_webhook(
  text, uuid, text, public.identity_verification_result,
  jsonb, text[], timestamptz, text
) to service_role;
