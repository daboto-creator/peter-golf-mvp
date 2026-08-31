-- Marketplace workflow simplification. This migration is additive and keeps
-- every PR1-PR10 order, listing version, quote and fulfillment valid.

create type public.identity_verification_result as enum (
  'PENDING', 'PASSED', 'REVIEW_REQUIRED', 'FAILED'
);
create type public.automatic_document_review_result as enum (
  'PASSED', 'REVIEW_REQUIRED', 'FAILED'
);

alter table public.partner_profiles
  add column terms_accepted_at timestamptz,
  add column privacy_accepted_at timestamptz;

create table public.partner_identity_verifications (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  provider text not null,
  external_session_id text not null,
  session_kind text not null check (session_kind in ('PERSON','BUSINESS')),
  result public.identity_verification_result not null default 'PENDING',
  normalized_attributes jsonb not null default '{}'::jsonb,
  warning_codes text[] not null default '{}',
  liveness_passed boolean,
  face_match_passed boolean,
  completed_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(provider, external_session_id),
  constraint partner_identity_provider_format check (provider ~ '^[A-Z][A-Z0-9_]{1,39}$'),
  constraint partner_identity_attributes_object check (jsonb_typeof(normalized_attributes)='object'),
  constraint partner_identity_completion_consistent check (
    (result='PENDING' and completed_at is null) or
    (result<>'PENDING' and completed_at is not null)
  )
);

create table public.partner_identity_webhook_events (
  event_id uuid primary key,
  verification_id uuid not null references public.partner_identity_verifications(id) on delete restrict,
  provider text not null,
  external_session_id text not null,
  result public.identity_verification_result not null,
  payload_sha256 text not null check (payload_sha256 ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  processed_at timestamptz not null default now()
);

create table public.partner_document_analyses (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.partner_documents(id) on delete restrict,
  analysis_version text not null,
  result public.automatic_document_review_result not null,
  extracted_document_type text,
  extracted_name text,
  extracted_address text,
  extracted_document_date date,
  extracted_rfc text,
  official_qr_destination text,
  normalized_output jsonb not null default '{}'::jsonb,
  warning_codes text[] not null default '{}',
  analyzed_by uuid references public.profiles(id) on delete set null,
  analyzed_at timestamptz not null default now(),
  constraint partner_document_analysis_output_object check (jsonb_typeof(normalized_output)='object'),
  constraint partner_document_analysis_qr_https check (
    official_qr_destination is null or official_qr_destination ~ '^https://'
  )
);

create unique index partner_document_latest_analysis_idx
  on public.partner_document_analyses(document_id, analyzed_at desc);

create table public.marketplace_partner_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  channel text not null check (channel in ('INTERNAL','EMAIL')),
  recipient_user_id uuid references public.profiles(id) on delete restrict,
  recipient_email text,
  subject text not null,
  body_text text not null,
  deduplication_key text not null unique,
  status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  constraint marketplace_notification_recipient check (
    recipient_user_id is not null or recipient_email is not null
  )
);

alter table public.partner_identity_verifications enable row level security;
alter table public.partner_identity_webhook_events enable row level security;
alter table public.partner_document_analyses enable row level security;
alter table public.marketplace_partner_notification_outbox enable row level security;

create policy "Partner reads own identity summary"
on public.partner_identity_verifications for select to authenticated
using (
  exists(select 1 from public.partner_profiles p
    where p.id=partner_id and p.user_id=(select auth.uid()))
  or (select public.can_manage_marketplace_partners())
);
create policy "Operations reads identity webhook audit"
on public.partner_identity_webhook_events for select to authenticated
using ((select public.can_manage_marketplace_partners()));
create policy "Partner and Operations read document analysis"
on public.partner_document_analyses for select to authenticated
using (
  exists(select 1 from public.partner_documents d join public.partner_profiles p on p.id=d.partner_id
    where d.id=document_id and p.user_id=(select auth.uid()))
  or (select public.can_manage_marketplace_partners())
);
create policy "Operations reads Marketplace notification outbox"
on public.marketplace_partner_notification_outbox for select to authenticated
using ((select public.can_manage_marketplace_partners()));

revoke all on public.partner_identity_verifications,
  public.partner_identity_webhook_events, public.partner_document_analyses,
  public.marketplace_partner_notification_outbox from anon,authenticated;
grant select on public.partner_identity_verifications,
  public.partner_identity_webhook_events, public.partner_document_analyses,
  public.marketplace_partner_notification_outbox to authenticated;

create function private.queue_partner_document_rules_analysis()
returns trigger language plpgsql security definer set search_path='' as $$
declare analysis_id uuid;
begin
  insert into public.partner_document_analyses(
    document_id,analysis_version,result,normalized_output,warning_codes
  ) values(new.id,'rules-v1','REVIEW_REQUIRED',
    jsonb_build_object('status','CONTENT_EXTRACTION_PENDING','documentKind',new.document_kind),
    array['AUTOMATIC_CONTENT_EXTRACTION_PENDING']) returning id into analysis_id;
  insert into public.marketplace_partner_notification_outbox(
    event_type,channel,recipient_user_id,subject,body_text,deduplication_key
  ) select 'PARTNER_DOCUMENT_ALERT','INTERNAL',ur.user_id,'Documento Partner recibido',
    'Un documento espera análisis automático y revisión de Operations.',
    'document-alert:'||analysis_id::text||':'||ur.user_id::text
  from public.user_roles ur join public.roles r on r.id=ur.role_id
  where r.name in('operator','admin') on conflict(deduplication_key) do nothing;
  insert into public.marketplace_partner_notification_outbox(
    event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
  ) select 'PARTNER_DOCUMENT_ALERT','EMAIL',ur.user_id,u.email,'Documento Partner recibido',
    'Un documento espera análisis automático y revisión de Operations.',
    'document-alert-email:'||analysis_id::text||':'||ur.user_id::text
  from public.user_roles ur join public.roles r on r.id=ur.role_id
  join auth.users u on u.id=ur.user_id
  where r.name in('operator','admin') and u.email is not null
  on conflict(deduplication_key) do nothing;
  return new;
end $$;
create trigger partner_document_rules_analysis_queue
after insert on public.partner_documents for each row
execute function private.queue_partner_document_rules_analysis();

create or replace function public.record_partner_onboarding_consents(
  expected_version integer,
  requested_terms_accepted boolean,
  requested_privacy_accepted boolean
) returns public.partner_profiles
language plpgsql security definer set search_path='' as $$
declare selected public.partner_profiles;
begin
  if auth.uid() is null or not requested_terms_accepted or not requested_privacy_accepted then
    raise exception 'Terms and privacy acceptance are required' using errcode='22023';
  end if;
  select * into selected from public.partner_profiles where user_id=auth.uid() for update;
  if not found or selected.version<>expected_version or selected.status not in('REGISTERED','IDENTITY_PENDING') then
    raise exception 'Partner consent version conflict' using errcode='40001';
  end if;
  update public.partner_profiles set
    terms_accepted_at=coalesce(terms_accepted_at,now()),
    privacy_accepted_at=coalesce(privacy_accepted_at,now()),
    version=version+1
  where id=selected.id returning * into selected;
  perform private.write_marketplace_audit('marketplace.partner_consents_recorded','partner_profile',selected.id,
    'Partner accepted terms and privacy notice',null,
    jsonb_build_object('terms_accepted',true,'privacy_accepted',true,'version',selected.version));
  return selected;
end $$;

create or replace function public.register_partner_identity_session(
  requested_provider text,
  requested_external_session_id text,
  requested_session_kind text
) returns public.partner_identity_verifications
language plpgsql security definer set search_path='' as $$
declare partner_record public.partner_profiles; result public.partner_identity_verifications;
begin
  select * into partner_record from public.partner_profiles where user_id=auth.uid() for update;
  if not found or partner_record.status not in('REGISTERED','IDENTITY_PENDING')
    or requested_provider!~'^[A-Z][A-Z0-9_]{1,39}$'
    or requested_session_kind not in('PERSON','BUSINESS')
    or char_length(btrim(requested_external_session_id)) not between 3 and 200 then
    raise exception 'Identity session registration denied' using errcode='42501';
  end if;
  select * into result from public.partner_identity_verifications
    where provider=requested_provider and external_session_id=btrim(requested_external_session_id);
  if found then
    if result.partner_id<>partner_record.id then raise exception 'Identity session conflict' using errcode='23505'; end if;
    return result;
  end if;
  insert into public.partner_identity_verifications(
    partner_id,provider,external_session_id,session_kind,created_by
  ) values(partner_record.id,requested_provider,btrim(requested_external_session_id),requested_session_kind,auth.uid())
  returning * into result;
  perform private.write_marketplace_audit('marketplace.identity_session_created','partner_identity_verification',result.id,
    'Identity verification session created',null,
    jsonb_build_object('provider',result.provider,'session_kind',result.session_kind));
  return result;
end $$;

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
language plpgsql security definer set search_path='' as $$
declare verification public.partner_identity_verifications; is_person boolean;
begin
  if requested_provider!~'^[A-Z][A-Z0-9_]{1,39}$'
    or jsonb_typeof(requested_attributes)<>'object'
    or requested_payload_sha256!~'^[a-f0-9]{64}$' then
    raise exception 'Identity webhook payload invalid' using errcode='22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'identity-webhook:'||requested_event_id::text,0
  ));
  if exists(select 1 from public.partner_identity_webhook_events where event_id=requested_event_id) then return false; end if;
  select * into verification from public.partner_identity_verifications
    where provider=requested_provider and external_session_id=requested_external_session_id for update;
  if not found then raise exception 'Identity session not found' using errcode='P0002'; end if;
  is_person:=verification.session_kind='PERSON';
  if requested_result='PASSED' and is_person and (
    coalesce((requested_attributes->>'livenessPassed')::boolean,false)=false or
    coalesce((requested_attributes->>'faceMatchPassed')::boolean,false)=false
  ) then requested_result:='REVIEW_REQUIRED';
    requested_warning_codes:=array_append(requested_warning_codes,'LIVENESS_OR_FACE_MATCH_REQUIRED');
  end if;
  update public.partner_identity_verifications set
    result=requested_result,
    normalized_attributes=requested_attributes - array['documentNumber','personalNumber','dateOfBirth'],
    warning_codes=coalesce(requested_warning_codes,'{}'),
    liveness_passed=nullif(requested_attributes->>'livenessPassed','')::boolean,
    face_match_passed=nullif(requested_attributes->>'faceMatchPassed','')::boolean,
    completed_at=case when requested_result='PENDING' then null else requested_occurred_at end,
    updated_at=now()
  where id=verification.id;
  insert into public.partner_identity_webhook_events(
    event_id,verification_id,provider,external_session_id,result,payload_sha256,occurred_at
  ) values(requested_event_id,verification.id,requested_provider,requested_external_session_id,
    requested_result,requested_payload_sha256,requested_occurred_at);
  if requested_result in('REVIEW_REQUIRED','FAILED') then
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,subject,body_text,deduplication_key
    ) select 'PARTNER_IDENTITY_ALERT','INTERNAL',ur.user_id,'Alerta de verificación Partner',
      'Una verificación requiere revisión en Operations.',
      'identity-alert:'||requested_event_id::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id where r.name in('operator','admin')
    on conflict(deduplication_key) do nothing;
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
    ) select 'PARTNER_IDENTITY_ALERT','EMAIL',ur.user_id,u.email,'Alerta de verificación Partner',
      'Una verificación requiere revisión en Operations.',
      'identity-alert-email:'||requested_event_id::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id
    join auth.users u on u.id=ur.user_id
    where r.name in('operator','admin') and u.email is not null
    on conflict(deduplication_key) do nothing;
  end if;
  perform private.write_marketplace_audit('marketplace.identity_result_received','partner_identity_verification',verification.id,
    'Signed identity provider result received',null,
    jsonb_build_object('provider',requested_provider,'result',requested_result,'warning_count',cardinality(requested_warning_codes)));
  return true;
end $$;

create or replace function public.record_partner_document_analysis(
  requested_document_id uuid,
  requested_analysis_version text,
  requested_result public.automatic_document_review_result,
  requested_extracted jsonb,
  requested_warning_codes text[],
  requested_normalized_output jsonb
) returns public.partner_document_analyses
language plpgsql security definer set search_path='' as $$
declare result public.partner_document_analyses; partner_id_value uuid;
begin
  if not public.can_manage_marketplace_partners() or jsonb_typeof(requested_extracted)<>'object'
    or jsonb_typeof(requested_normalized_output)<>'object' then
    raise exception 'Document analysis access denied' using errcode='42501';
  end if;
  select partner_id into partner_id_value from public.partner_documents where id=requested_document_id;
  if not found then raise exception 'Partner document not found' using errcode='P0002'; end if;
  insert into public.partner_document_analyses(
    document_id,analysis_version,result,extracted_document_type,extracted_name,
    extracted_address,extracted_document_date,extracted_rfc,official_qr_destination,
    normalized_output,warning_codes,analyzed_by
  ) values(requested_document_id,left(requested_analysis_version,80),requested_result,
    requested_extracted->>'documentType',requested_extracted->>'name',requested_extracted->>'address',
    nullif(requested_extracted->>'documentDate','')::date,requested_extracted->>'rfc',
    requested_extracted->>'officialQrDestination',requested_normalized_output,
    coalesce(requested_warning_codes,'{}'),auth.uid()) returning * into result;
  if requested_result<>'PASSED' or cardinality(requested_warning_codes)>0 then
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,subject,body_text,deduplication_key
    ) select 'PARTNER_DOCUMENT_ALERT','INTERNAL',ur.user_id,'Alerta documental Partner',
      'Un documento requiere revisión en Operations.',
      'document-alert:'||result.id::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id where r.name in('operator','admin')
    on conflict(deduplication_key) do nothing;
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
    ) select 'PARTNER_DOCUMENT_ALERT','EMAIL',ur.user_id,u.email,'Alerta documental Partner',
      'Un documento requiere revisión en Operations.',
      'document-alert-email:'||result.id::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id
    join auth.users u on u.id=ur.user_id
    where r.name in('operator','admin') and u.email is not null
    on conflict(deduplication_key) do nothing;
  end if;
  return result;
end $$;

-- Provider PASSED is evidence only. This function is deliberately unchanged as
-- the sole human status authority: transition_partner_status(..., VERIFIED).

create or replace function private.queue_verified_partner_notifications()
returns trigger language plpgsql security definer set search_path='' as $$
declare partner_email text;
begin
  if new.status='VERIFIED' and old.status is distinct from 'VERIFIED' then
    select email into partner_email from auth.users where id=new.user_id;
    if partner_email is not null then
      insert into public.marketplace_partner_notification_outbox(
        event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
      ) values('PARTNER_VERIFIED','EMAIL',new.user_id,partner_email,
        'Tu cuenta Best Round Partner está lista','Tu cuenta Best Round Partner está lista.',
        'partner-verified:'||new.id::text||':'||new.version::text)
      on conflict(deduplication_key) do nothing;
    end if;
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,subject,body_text,deduplication_key
    ) select 'PARTNER_VERIFIED','INTERNAL',ur.user_id,'Partner verificado',
      'Un Partner completó la revisión de Operations.',
      'partner-verified-ops:'||new.id::text||':'||new.version::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id where r.name in('operator','admin')
    on conflict(deduplication_key) do nothing;
    insert into public.marketplace_partner_notification_outbox(
      event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
    ) select 'PARTNER_VERIFIED','EMAIL',ur.user_id,u.email,'Partner verificado',
      'Un Partner completó la revisión de Operations.',
      'partner-verified-ops-email:'||new.id::text||':'||new.version::text||':'||ur.user_id::text
    from public.user_roles ur join public.roles r on r.id=ur.role_id
    join auth.users u on u.id=ur.user_id
    where r.name in('operator','admin') and u.email is not null
    on conflict(deduplication_key) do nothing;
  end if;
  return new;
end $$;
create trigger partner_verified_notification_queue
after update of status on public.partner_profiles
for each row execute function private.queue_verified_partner_notifications();

alter table public.marketplace_market_analyses alter column canonical_product_model_id drop not null;
alter table public.marketplace_pricing_quotes alter column canonical_product_model_id drop not null;
alter type public.marketplace_listing_evaluation_source add value if not exists 'RULES';

-- Start the persisted market-research workflow while a Partner is still
-- composing the draft. The former approved-listing path remains valid.
create or replace function public.request_marketplace_market_analysis(
  requested_listing_id uuid,
  requested_listing_version_id uuid,
  requested_idempotency_key uuid
) returns public.marketplace_market_analyses
language plpgsql security definer set search_path='' as $$
declare listing_record public.marketplace_listings; version_record public.marketplace_listing_versions;
  partner_record public.partner_profiles; analysis_record public.marketplace_market_analyses;
  is_manager boolean:=public.can_manage_marketplace_pricing();
begin
  if requested_idempotency_key is null then
    raise exception 'Market analysis idempotency key is required' using errcode='22023';
  end if;
  select * into listing_record from public.marketplace_listings where id=requested_listing_id for update;
  if not found then raise exception 'Marketplace listing not found' using errcode='P0002'; end if;
  select * into strict partner_record from public.partner_profiles where id=listing_record.partner_id;
  if not is_manager and (not private.marketplace_pricing_owned_by_current_user(listing_record.partner_id)
    or partner_record.status<>'VERIFIED') then
    raise exception 'Marketplace pricing access denied' using errcode='42501';
  end if;
  select * into version_record from public.marketplace_listing_versions
    where id=requested_listing_version_id and listing_id=requested_listing_id for update;
  if not found or not (
    (listing_record.status in('DRAFT','CHANGES_REQUESTED')
      and listing_record.current_version_id=version_record.id and version_record.state='DRAFT')
    or (listing_record.status='APPROVED'
      and listing_record.approved_version_id=version_record.id and version_record.state='APPROVED')
  ) then raise exception 'Market analysis version is unavailable' using errcode='23514'; end if;
  if version_record.canonical_model_id is null then
    update public.marketplace_listing_versions v set canonical_model_id=m.id,brand_id=m.brand_id
    from public.catalog_product_models m join public.brands b on b.id=m.brand_id
    where v.id=version_record.id and m.category_id=v.category_id and m.status='active' and b.status='active'
      and m.normalized_model_name=private.normalize_catalog_model_name(v.proposed_model)
      and private.normalize_catalog_model_name(b.name)=private.normalize_catalog_model_name(v.proposed_brand)
      and (select count(*) from public.catalog_product_models candidate
        join public.brands candidate_brand on candidate_brand.id=candidate.brand_id
        where candidate.category_id=v.category_id and candidate.status='active'
          and candidate.normalized_model_name=private.normalize_catalog_model_name(v.proposed_model)
          and private.normalize_catalog_model_name(candidate_brand.name)=private.normalize_catalog_model_name(v.proposed_brand))=1;
    -- UPDATE ... RETURNING INTO clears the composite variable when no exact
    -- candidate exists. Reload the draft so a low-confidence canonical match
    -- can still enqueue analysis with a nullable model reference.
    select * into strict version_record
    from public.marketplace_listing_versions
    where id=requested_listing_version_id and listing_id=requested_listing_id;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(
    'marketplace-analysis:'||listing_record.partner_id::text||':'||requested_idempotency_key::text,0));
  select * into analysis_record from public.marketplace_market_analyses
    where partner_id=listing_record.partner_id and idempotency_key=requested_idempotency_key;
  if found then
    if analysis_record.listing_id<>requested_listing_id
      or analysis_record.listing_version_id<>requested_listing_version_id then
      raise exception 'Idempotency key belongs to different market analysis inputs' using errcode='23505';
    end if;
    return analysis_record;
  end if;
  insert into public.marketplace_market_analyses(
    listing_id,listing_version_id,partner_id,canonical_product_model_id,idempotency_key,requested_by
  ) values(listing_record.id,version_record.id,listing_record.partner_id,
    version_record.canonical_model_id,requested_idempotency_key,auth.uid()) returning * into analysis_record;
  perform private.write_marketplace_audit('marketplace.market_research_requested',
    'marketplace_market_analysis',analysis_record.id,'Market research requested during listing composition',null,
    jsonb_build_object('listing_id',listing_record.id,'listing_version_id',version_record.id,
      'canonical_pending',version_record.canonical_model_id is null));
  return analysis_record;
end $$;

create or replace function public.prepare_marketplace_listing_price(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_desired_public_price public.money_minor_units,
  requested_market_analysis_id uuid,
  requested_idempotency_key uuid
) returns public.marketplace_pricing_quotes
language plpgsql security definer set search_path='' as $$
declare listing_record public.marketplace_listings; version_record public.marketplace_listing_versions;
  config_id uuid; financial public.marketplace_financial_rules; pricing_rule public.marketplace_pricing_rules;
  tier_rule public.marketplace_tier_rules; fee public.payment_fee_configs; tier_state public.partner_score_tier_state;
  tier_override public.partner_score_tier_overrides;
  tier_value public.marketplace_partner_tier:='BOGEY'; tier_origin public.marketplace_tier_source:='CALCULATED';
  analysis public.marketplace_market_analyses; economics record; quote_number integer;
  market_ref bigint; lower_bound bigint; upper_bound bigint; delta_bps integer;
  viability public.marketplace_price_viability; result public.marketplace_pricing_quotes;
begin
  select * into listing_record from public.marketplace_listings where id=requested_listing_id for update;
  if not found or not private.marketplace_pricing_owned_by_current_user(listing_record.partner_id)
    or listing_record.status not in('DRAFT','CHANGES_REQUESTED')
    or listing_record.lock_version<>expected_lock_version
    or requested_desired_public_price<=0 or requested_idempotency_key is null then
    raise exception 'Marketplace draft pricing access denied' using errcode='42501';
  end if;
  select * into strict version_record from public.marketplace_listing_versions
    where id=listing_record.current_version_id and state='DRAFT';
  select * into result from public.marketplace_pricing_quotes
    where partner_id=listing_record.partner_id and idempotency_key=requested_idempotency_key;
  if found then return result; end if;
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  select * into strict financial from public.marketplace_financial_rules where config_version_id=config_id;
  select * into strict pricing_rule from public.marketplace_pricing_rules where config_version_id=config_id;
  select * into strict fee from public.payment_fee_configs where code=pricing_rule.payment_fee_config_code and active;
  select * into tier_state from public.partner_score_tier_state where partner_id=listing_record.partner_id;
  if found then tier_value:=tier_state.current_tier; end if;
  select * into tier_override from public.partner_score_tier_overrides
    where partner_id=listing_record.partner_id and status='ACTIVE' and override_type='TIER'
      and starts_at<=now() and (expires_at is null or expires_at>now())
    order by created_at desc limit 1 for share;
  if tier_override.id is not null then
    tier_value:=tier_override.tier;
    tier_origin:='OVERRIDE';
  end if;
  select * into strict tier_rule from public.marketplace_tier_rules where config_version_id=config_id and tier=tier_value;
  if requested_market_analysis_id is not null then
    select * into analysis from public.marketplace_market_analyses where id=requested_market_analysis_id
      and listing_id=listing_record.id and listing_version_id=version_record.id
      and status in('COMPLETE','INSUFFICIENT_DATA','PROVIDER_UNAVAILABLE')
      and (expires_at is null or expires_at>now());
    if not found then raise exception 'Market analysis is unavailable' using errcode='23514'; end if;
    market_ref:=analysis.recommended_price;
  end if;
  select * into economics from private.marketplace_calculate_economics(requested_desired_public_price::bigint,
    tier_rule.commission_rate_bps,financial.commission_tax_bps,fee.percentage_bps,fee.fixed_fee::bigint,
    financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee::bigint,
    financial.minimum_marketplace_revenue::bigint);
  if economics.meets_minimum is false then raise exception 'Marketplace hard financial minimum is not met' using errcode='23514'; end if;
  if market_ref is null then viability:='INSUFFICIENT_DATA';
  else
    lower_bound:=(market_ref*(10000-pricing_rule.market_tolerance_bps))/10000;
    upper_bound:=(market_ref*(10000+pricing_rule.market_tolerance_bps)+9999)/10000;
    delta_bps:=((requested_desired_public_price-market_ref)*10000/market_ref)::integer;
    viability:=case when requested_desired_public_price<lower_bound then 'UNDERPRICED'::public.marketplace_price_viability
      when requested_desired_public_price>upper_bound then 'OVERPRICED'::public.marketplace_price_viability
      else 'COMPETITIVE'::public.marketplace_price_viability end;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('marketplace-pricing:'||listing_record.id::text,0));
  select coalesce(max(quote_version),0)+1 into quote_number from public.marketplace_pricing_quotes where listing_id=listing_record.id;
  perform set_config('app.marketplace_pricing_transition_write','enabled',true);
  update public.marketplace_pricing_quotes set status='SUPERSEDED',lock_version=lock_version+1
    where listing_id=listing_record.id and status in('DRAFT','ANALYZED','CHANGES_REQUESTED','PARTNER_ACCEPTED');
  insert into public.marketplace_pricing_quotes(
    listing_id,listing_version_id,partner_id,canonical_product_model_id,quote_version,status,
    config_version_id,effective_partner_tier,tier_source,effective_tier_override_id,score_snapshot_id,
    commission_rate_bps,commission_tax_bps,payment_fee_config_code,payment_processing_bps,
    payment_processing_fixed_fee,partner_processing_share_bps,admin_fee_bps,admin_fixed_fee,
    minimum_marketplace_revenue,market_tolerance_bps,input_mode,desired_public_price,
    calculated_public_price,commission_base,commission_amount,commission_vat,processing_total,
    partner_processing_share,best_round_processing_share,admin_percentage_fee,admin_fixed_fee_amount,
    estimated_partner_net,gross_best_round_revenue,tax_pass_through,estimated_best_round_revenue,
    meets_minimum_marketplace_revenue,market_analysis_id,market_reference,market_lower_bound,
    market_upper_bound,market_delta_bps,viability,idempotency_key,created_by,expires_at
  ) values(listing_record.id,version_record.id,listing_record.partner_id,version_record.canonical_model_id,
    quote_number,case when requested_market_analysis_id is null then 'DRAFT'::public.marketplace_pricing_quote_status else 'ANALYZED' end,
    config_id,tier_value,tier_origin,tier_override.id,tier_state.latest_score_snapshot_id,tier_rule.commission_rate_bps,
    financial.commission_tax_bps,fee.code,fee.percentage_bps,fee.fixed_fee,
    financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee,
    financial.minimum_marketplace_revenue,pricing_rule.market_tolerance_bps,'PUBLIC_PRICE_PRIORITY',requested_desired_public_price,
    requested_desired_public_price,requested_desired_public_price,economics.commission_amount,economics.commission_vat,
    economics.processing_total,economics.partner_processing_share,economics.best_round_processing_share,
    economics.admin_percentage_fee,financial.admin_fixed_fee,economics.partner_net,economics.gross_best_round_revenue,
    economics.commission_vat,economics.estimated_best_round_revenue,economics.meets_minimum,
    requested_market_analysis_id,market_ref,lower_bound,upper_bound,delta_bps,viability,
    requested_idempotency_key,auth.uid(),now()+make_interval(days=>pricing_rule.quote_expiry_days))
  returning * into result;
  insert into public.marketplace_pricing_status_history(quote_id,to_status,actor_id,reason,lock_version)
    values(result.id,result.status,auth.uid(),'Partner desired price calculated deterministically',result.lock_version);
  return result;
end $$;

create or replace function public.submit_marketplace_listing_workflow(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_quote_id uuid
) returns public.marketplace_listings
language plpgsql security definer set search_path='' as $$
declare result public.marketplace_listings; quote_record public.marketplace_pricing_quotes;
  version_record public.marketplace_listing_versions; photo_count integer; duplicate_count integer;
  low_quality_count integer; photo_warnings text[]:='{}'; canonical_confidence text;
begin
  select * into quote_record from public.marketplace_pricing_quotes where id=requested_quote_id for update;
  if not found or quote_record.listing_id<>requested_listing_id
    or quote_record.status not in('DRAFT','ANALYZED','CHANGES_REQUESTED')
    or quote_record.expires_at<=now() or quote_record.meets_minimum_marketplace_revenue is false then
    raise exception 'Current viable pricing quote is required' using errcode='23514';
  end if;
  -- Exact canonical matches are safe to link automatically. Anything less
  -- certain remains visible to Operations and the existing approval guard.
  update public.marketplace_listing_versions v set
    canonical_model_id=m.id,brand_id=m.brand_id
  from public.catalog_product_models m join public.brands b on b.id=m.brand_id
  where v.id=quote_record.listing_version_id and v.canonical_model_id is null
    and m.category_id=v.category_id and m.status='active' and b.status='active'
    and m.normalized_model_name=private.normalize_catalog_model_name(v.proposed_model)
    and private.normalize_catalog_model_name(b.name)=private.normalize_catalog_model_name(v.proposed_brand)
    and (select count(*) from public.catalog_product_models candidate join public.brands candidate_brand on candidate_brand.id=candidate.brand_id
      where candidate.category_id=v.category_id and candidate.status='active'
        and candidate.normalized_model_name=private.normalize_catalog_model_name(v.proposed_model)
        and private.normalize_catalog_model_name(candidate_brand.name)=private.normalize_catalog_model_name(v.proposed_brand))=1;
  select * into strict version_record from public.marketplace_listing_versions
    where id=quote_record.listing_version_id for update;
  select count(*),count(*)-count(distinct image.sha256),
    count(*) filter(where image.width_pixels is null or image.height_pixels is null
      or least(image.width_pixels,image.height_pixels)<600)
  into photo_count,duplicate_count,low_quality_count
  from public.marketplace_listing_version_images vi
  join public.marketplace_listing_images image on image.id=vi.image_id
  where vi.version_id=version_record.id;
  if duplicate_count>0 then photo_warnings:=array_append(photo_warnings,'DUPLICATE_PHOTOS'); end if;
  if low_quality_count>0 then photo_warnings:=array_append(photo_warnings,'PHOTO_QUALITY_REVIEW_REQUIRED'); end if;
  canonical_confidence:=case when version_record.canonical_model_id is not null then 'HIGH' else 'LOW' end;
  update public.marketplace_listing_versions set
    evaluation_source='RULES',evaluation_status='COMPLETED',
    evaluation_confidence=case when cardinality(photo_warnings)=0 and canonical_confidence='HIGH' then 1 else 0.5 end,
    evaluation_summary=case when version_record.proposed_brand is not null or version_record.proposed_model is not null
      then 'Fotos consistentes pendientes de revisión con '||concat_ws(' ',version_record.proposed_brand,version_record.proposed_model)
      else 'Revisión automática de fotografías completada' end,
    evaluation_output=jsonb_build_object('version','rules-v1','photoCount',photo_count,
      'warnings',to_jsonb(photo_warnings),'canonicalConfidence',canonical_confidence,
      'authenticityClaimed',false),updated_at=now()
  where id=version_record.id;
  result:=public.submit_marketplace_listing(requested_listing_id,expected_lock_version);
  perform public.transition_marketplace_pricing_quote(quote_record.id,quote_record.lock_version,'PARTNER_ACCEPTED','Partner final review confirmed');
  select * into quote_record from public.marketplace_pricing_quotes where id=quote_record.id;
  perform public.transition_marketplace_pricing_quote(quote_record.id,quote_record.lock_version,'UNDER_REVIEW','Complete submission sent to Best Round');
  insert into public.marketplace_partner_notification_outbox(
    event_type,channel,recipient_user_id,subject,body_text,deduplication_key
  ) select 'LISTING_REVIEW_READY','INTERNAL',ur.user_id,'Publicación Partner lista para revisión',
    'Una publicación completa espera la revisión consolidada.',
    'listing-review:'||result.id::text||':'||result.lock_version::text||':'||ur.user_id::text
  from public.user_roles ur join public.roles role_record on role_record.id=ur.role_id
  where role_record.name in('operator','admin') on conflict(deduplication_key) do nothing;
  insert into public.marketplace_partner_notification_outbox(
    event_type,channel,recipient_user_id,recipient_email,subject,body_text,deduplication_key
  ) select 'LISTING_REVIEW_READY','EMAIL',ur.user_id,u.email,'Publicación Partner lista para revisión',
    'Una publicación completa espera la revisión consolidada.',
    'listing-review-email:'||result.id::text||':'||result.lock_version::text||':'||ur.user_id::text
  from public.user_roles ur join public.roles role_record on role_record.id=ur.role_id
  join auth.users u on u.id=ur.user_id
  where role_record.name in('operator','admin') and u.email is not null
  on conflict(deduplication_key) do nothing;
  return result;
end $$;

alter table public.marketplace_pricing_quotes
  add column market_analysis_override boolean not null default false,
  add column market_analysis_override_by uuid references public.profiles(id) on delete set null,
  add column market_analysis_override_email text,
  add column market_analysis_override_at timestamptz,
  add column market_analysis_override_reason text,
  add constraint marketplace_market_override_complete check (
    (not market_analysis_override and market_analysis_override_by is null and market_analysis_override_at is null)
    or (market_analysis_override and market_analysis_override_by is not null
      and market_analysis_override_at is not null
      and char_length(btrim(market_analysis_override_reason)) between 3 and 1000)
  );

create or replace function public.review_marketplace_submission(
  requested_listing_id uuid,
  expected_lock_version integer,
  requested_decision public.marketplace_listing_status,
  requested_reason text,
  requested_feedback jsonb,
  requested_market_analysis_override boolean default false,
  requested_internal_note text default null
) returns public.marketplace_listings
language plpgsql security definer set search_path='' as $$
declare result public.marketplace_listings; quote_record public.marketplace_pricing_quotes;
  actor_email text; reviewed_version_id uuid; current_status public.marketplace_listing_status;
  analysis_status public.marketplace_market_analysis_status;
begin
  if not public.can_manage_marketplace_listings() or not public.can_manage_marketplace_pricing()
    or requested_decision not in('APPROVED','CHANGES_REQUESTED','REJECTED') then
    raise exception 'Marketplace submission review denied' using errcode='42501';
  end if;
  select l.current_version_id,l.status into reviewed_version_id,current_status from public.marketplace_listings l
    where l.id=requested_listing_id and l.status in('SUBMITTED','UNDER_REVIEW')
      and l.lock_version=expected_lock_version for update;
  if not found then raise exception 'Marketplace submission version conflict' using errcode='40001'; end if;
  select * into quote_record from public.marketplace_pricing_quotes
    where listing_id=requested_listing_id and listing_version_id=reviewed_version_id and status='UNDER_REVIEW'
    order by quote_version desc limit 1 for update;
  if not found or quote_record.expires_at<=now() or quote_record.meets_minimum_marketplace_revenue is false then
    raise exception 'Valid hard financial quote is required' using errcode='23514';
  end if;
  if quote_record.market_analysis_id is not null then
    select status into analysis_status from public.marketplace_market_analyses
      where id=quote_record.market_analysis_id;
  end if;
  if requested_decision='APPROVED'
    and (quote_record.market_analysis_id is null or analysis_status is distinct from 'COMPLETE')
    and not requested_market_analysis_override then
    raise exception 'Explicit market analysis override is required' using errcode='23514';
  end if;
  if requested_market_analysis_override and char_length(btrim(requested_reason)) not between 3 and 1000 then
    raise exception 'Market analysis override reason is required' using errcode='22023';
  end if;
  if current_status='SUBMITTED' then
    result:=public.transition_marketplace_listing_status(requested_listing_id,expected_lock_version,'UNDER_REVIEW',
      'Revisión consolidada iniciada','[]'::jsonb,null);
  else
    select * into result from public.marketplace_listings where id=requested_listing_id;
  end if;
  result:=public.transition_marketplace_listing_status(requested_listing_id,result.lock_version,requested_decision,
    requested_reason,requested_feedback,requested_internal_note);
  perform set_config('app.marketplace_pricing_transition_write','enabled',true);
  if requested_market_analysis_override then
    select email into actor_email from auth.users where id=auth.uid();
    update public.marketplace_pricing_quotes set market_analysis_override=true,
      market_analysis_override_by=auth.uid(),market_analysis_override_email=actor_email,
      market_analysis_override_at=now(),market_analysis_override_reason=btrim(requested_reason)
      where id=quote_record.id;
  end if;
  perform public.transition_marketplace_pricing_quote(quote_record.id,quote_record.lock_version,
    case requested_decision when 'APPROVED' then 'APPROVED'::public.marketplace_pricing_quote_status
      when 'CHANGES_REQUESTED' then 'CHANGES_REQUESTED'::public.marketplace_pricing_quote_status
      else 'REJECTED'::public.marketplace_pricing_quote_status end,requested_reason);
  if requested_decision='CHANGES_REQUESTED' then
    -- The listing transition creates a new draft version. Carry forward the
    -- exact deterministic economics as an editable draft tied to that version
    -- so a Partner can correct only the requested fields. Market evidence is
    -- deliberately cleared because product/spec changes may invalidate it.
    insert into public.marketplace_pricing_quotes
    select (jsonb_populate_record(
      null::public.marketplace_pricing_quotes,
      to_jsonb(quote_record)||jsonb_build_object(
        'id',gen_random_uuid(),
        'listing_version_id',result.current_version_id,
        'quote_version',(select coalesce(max(q.quote_version),0)+1
          from public.marketplace_pricing_quotes q where q.listing_id=requested_listing_id),
        'status','DRAFT','lock_version',1,'idempotency_key',gen_random_uuid(),
        'market_analysis_id',null,'market_reference',null,'market_lower_bound',null,
        'market_upper_bound',null,'market_delta_bps',null,'viability','INSUFFICIENT_DATA',
        'submitted_at',null,'approved_by',null,'approved_at',null,'approval_reason',null,
        'market_analysis_override',false,'market_analysis_override_by',null,
        'market_analysis_override_email',null,'market_analysis_override_at',null,
        'market_analysis_override_reason',null,'created_at',now(),'updated_at',now()
      )
    )).*;
  end if;
  return result;
end $$;

-- Clubs require at least five distinct real-item photos in addition to any
-- category-specific shot requirements already configured.
create or replace function private.marketplace_listing_required_photos_complete(
  requested_version_id uuid, requested_category_id uuid,
  requested_condition public.product_condition
) returns boolean language sql stable set search_path='' as $$
  select
    (case when exists(select 1 from public.marketplace_listing_photo_requirements r
      where r.category_id=requested_category_id and r.requirement='REQUIRED'
        and (r.condition is null or r.condition=requested_condition))
    then not exists(select 1 from public.marketplace_listing_photo_requirements r
      where r.category_id=requested_category_id and r.requirement='REQUIRED'
        and (r.condition is null or r.condition=requested_condition)
        and not exists(select 1 from public.marketplace_listing_version_images vi
          where vi.version_id=requested_version_id and vi.image_type=r.image_type))
    else exists(select 1 from public.marketplace_listing_version_images vi where vi.version_id=requested_version_id) end)
    and (case when exists(select 1 from public.category_spec_profiles p
      where p.category_id=requested_category_id and p.family='club')
      then (select count(distinct vi.image_id)>=5 from public.marketplace_listing_version_images vi
        where vi.version_id=requested_version_id)
      else true end)
$$;

alter table public.order_fulfillments
  add column carrier_handoff_note text,
  add column carrier_handoff_actor_id uuid references public.profiles(id) on delete set null,
  add constraint order_fulfillment_handoff_note_length check (
    carrier_handoff_note is null or char_length(btrim(carrier_handoff_note)) between 1 and 500
  );

create or replace function public.confirm_partner_fulfillment_shipment(
  requested_fulfillment_id uuid,
  expected_version integer,
  requested_carrier text,
  requested_tracking_number text,
  requested_handoff_at timestamptz,
  requested_note text,
  requested_idempotency_key uuid
) returns public.order_fulfillments
language plpgsql security definer set search_path='' as $$
declare selected public.order_fulfillments; result public.order_fulfillments;
  score_value integer; config_id uuid;
begin
  if auth.uid() is null or requested_idempotency_key is null
    or char_length(btrim(requested_carrier)) not between 2 and 80
    or char_length(btrim(requested_tracking_number)) not between 3 and 120
    or requested_handoff_at>now()+interval '5 minutes'
    or requested_handoff_at<now()-interval '14 days'
    or char_length(coalesce(btrim(requested_note),''))>500 then
    raise exception 'Shipment confirmation input invalid' using errcode='22023';
  end if;
  if exists(select 1 from public.marketplace_fulfillment_idempotency_keys k
    where k.idempotency_key=requested_idempotency_key and k.fulfillment_id=requested_fulfillment_id
      and k.actor_id=auth.uid() and k.action='CONFIRM_SHIPMENT') then
    select * into result from public.order_fulfillments where id=requested_fulfillment_id; return result;
  elsif exists(select 1 from public.marketplace_fulfillment_idempotency_keys where idempotency_key=requested_idempotency_key) then
    raise exception 'Idempotency key conflict' using errcode='23505';
  end if;
  select f.* into selected from public.order_fulfillments f join public.partner_profiles p on p.id=f.partner_id
    where f.id=requested_fulfillment_id and p.user_id=auth.uid() and f.activated_at is not null for update of f;
  if not found or selected.status<>'READY_FOR_CARRIER' or selected.version<>expected_version then
    raise exception 'Fulfillment shipment version conflict' using errcode='40001';
  end if;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  update public.order_fulfillments set status='SHIPPED',carrier=btrim(requested_carrier),
    tracking_number=btrim(requested_tracking_number),shipped_at=requested_handoff_at,
    carrier_handoff_note=nullif(btrim(requested_note),''),carrier_handoff_actor_id=auth.uid(),
    version=version+1 where id=selected.id returning * into result;
  insert into public.marketplace_fulfillment_idempotency_keys(idempotency_key,fulfillment_id,actor_id,action)
    values(requested_idempotency_key,selected.id,auth.uid(),'CONFIRM_SHIPMENT');
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  select score_bps into strict score_value from public.marketplace_score_outcome_rules
    where config_version_id=config_id and component='SHIPPING_SLA'
      and outcome_code=case when requested_handoff_at<=selected.carrier_handoff_due_at
        then 'CARRIER_HANDOFF_ON_TIME' else 'CARRIER_HANDOFF_LATE' end;
  insert into public.partner_score_events(partner_id,component,outcome_code,score_bps,
    counts_completed_order,source,source_entity_type,source_entity_id,evidence,idempotency_key,occurred_at,recorded_by)
  values(selected.partner_id,'SHIPPING_SLA',case when requested_handoff_at<=selected.carrier_handoff_due_at
      then 'CARRIER_HANDOFF_ON_TIME' else 'CARRIER_HANDOFF_LATE' end,score_value,false,'FULFILLMENT',
    'order_fulfillment',selected.id,jsonb_build_object('deadline',selected.carrier_handoff_due_at),
    'fulfillment:'||selected.id::text||':carrier-handoff',requested_handoff_at,auth.uid())
  on conflict(idempotency_key) do nothing;
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform private.write_marketplace_audit('marketplace.partner_shipment_confirmed','order_fulfillment',selected.id,
    coalesce(nullif(btrim(requested_note),''),'Partner confirmed carrier handoff'),
    jsonb_build_object('status',selected.status,'version',selected.version),
    jsonb_build_object('status',result.status,'version',result.version,'carrier',result.carrier,'handoff_at',result.shipped_at));
  return result;
exception when others then perform set_config('peter_golf.marketplace_order_write','disabled',true); raise;
end $$;

drop function public.get_partner_marketplace_sales(uuid);
create function public.get_partner_marketplace_sales(
  requested_fulfillment_id uuid default null
) returns table(
  fulfillment_id uuid, order_number text, order_item_id uuid, listing_title text,
  quantity integer, status public.marketplace_fulfillment_status, version integer,
  inventory_confirmation_due_at timestamptz, carrier_handoff_due_at timestamptz,
  confirmed_at timestamptz, ready_for_carrier_at timestamptz,
  carrier text, tracking_number text, shipped_at timestamptz,
  estimated_partner_net numeric(14,0), public_line_total numeric(14,0),
  currency character(3), created_at timestamptz
) language sql stable security definer set search_path='' as $$
  select f.id,o.order_number,s.order_item_id,s.listing_title,s.quantity,
    f.status,f.version,f.inventory_confirmation_due_at,f.carrier_handoff_due_at,
    f.confirmed_at,f.ready_for_carrier_at,f.carrier,f.tracking_number,f.shipped_at,
    s.estimated_partner_net,s.public_line_total,s.currency,f.created_at
  from public.order_fulfillments f join public.partner_profiles p on p.id=f.partner_id
  join public.orders o on o.id=f.order_id join public.marketplace_order_item_snapshots s on s.fulfillment_id=f.id
  where p.user_id=auth.uid() and f.activated_at is not null
    and (requested_fulfillment_id is null or f.id=requested_fulfillment_id)
  order by f.created_at desc,s.order_item_id
$$;

drop function public.get_customer_order_fulfillment_summary(uuid);
create function public.get_customer_order_fulfillment_summary(requested_order_id uuid)
returns table(
  fulfillment_id uuid, source public.order_fulfillment_source,
  status public.marketplace_fulfillment_status, item_count bigint,
  carrier text, tracking_number text, shipped_at timestamptz
) language sql stable security definer set search_path='' as $$
  select f.id,f.source,f.status,count(oi.id),
    case when f.status in('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED') then f.carrier end,
    case when f.status in('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED') then f.tracking_number end,
    case when f.status in('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED') then f.shipped_at end
  from public.orders o join public.order_fulfillments f on f.order_id=o.id
  join public.order_items oi on oi.fulfillment_id=f.id
  where o.id=requested_order_id and o.user_id=auth.uid()
  group by f.id,f.source,f.status,f.carrier,f.tracking_number,f.shipped_at
  order by f.created_at
$$;

create or replace function private.partner_identity_documents_complete(
  partner_record public.partner_profiles
) returns boolean language plpgsql stable set search_path='' as $$
declare required_kinds text[]; identity_ready boolean;
begin
  required_kinds:=case partner_record.legal_type
    when 'LEGAL_ENTITY' then array['incorporation_deed','company_address_proof','fiscal_certificate','legal_representative_id']
    when 'SOLE_PROPRIETOR' then case when partner_record.country_code='MX'
      then array['address_proof','fiscal_certificate']
      else array['address_proof','fiscal_certificate','immigration_document'] end
    else case when partner_record.country_code='MX'
      then array['address_proof'] else array['address_proof','immigration_document'] end
  end;
  if exists(select 1 from unnest(required_kinds) kind where not exists(
    select 1 from public.partner_documents d where d.partner_id=partner_record.id
      and d.document_kind=kind and d.status<>'REJECTED')) then return false; end if;
  if partner_record.legal_type='LEGAL_ENTITY' then return true; end if;
  select exists(select 1 from public.partner_identity_verifications v
    where v.partner_id=partner_record.id and v.result in('PASSED','REVIEW_REQUIRED')
      and v.liveness_passed and v.face_match_passed) into identity_ready;
  return identity_ready;
end $$;

create function private.guard_partner_human_verification_evidence()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if old.status='UNDER_REVIEW' and new.status='VERIFIED' then
    if old.terms_accepted_at is null or old.privacy_accepted_at is null
      or not private.partner_identity_documents_complete(old)
      or exists(select 1 from unnest(case old.legal_type
          when 'LEGAL_ENTITY' then array['incorporation_deed','company_address_proof','fiscal_certificate','legal_representative_id']
          when 'SOLE_PROPRIETOR' then case when old.country_code='MX'
            then array['address_proof','fiscal_certificate'] else array['address_proof','fiscal_certificate','immigration_document'] end
          else case when old.country_code='MX' then array['address_proof']
            else array['address_proof','immigration_document'] end end) required_kind
        where not exists(select 1 from public.partner_documents d
          where d.partner_id=old.id and d.document_kind=required_kind and d.status='VERIFIED'))
      or exists(select 1 from public.partner_documents d
        join public.partner_document_analyses analysis on analysis.document_id=d.id
        where d.partner_id=old.id and analysis.id=(select latest.id
          from public.partner_document_analyses latest where latest.document_id=d.id
          order by latest.analyzed_at desc,latest.id desc limit 1)
          and analysis.result='FAILED') then
      raise exception 'Partner evidence requires completed Operations review' using errcode='23514';
    end if;
  end if;
  return new;
end $$;
create trigger partner_human_verification_evidence_guard
before update of status on public.partner_profiles for each row
execute function private.guard_partner_human_verification_evidence();

drop function public.get_partner_onboarding_readiness(uuid);
create function public.get_partner_onboarding_readiness(requested_partner_id uuid default null)
returns table(
  basic_complete boolean, fiscal_complete boolean, documents_complete boolean,
  review_ready boolean, active_document_count bigint
) language plpgsql stable security definer set search_path='' as $$
declare partner_record public.partner_profiles; document_count bigint; documents_ready boolean;
begin
  select * into partner_record from public.partner_profiles where id=coalesce(requested_partner_id,
    (select id from public.partner_profiles where user_id=auth.uid()));
  if not found then raise exception 'Partner unavailable' using errcode='P0002'; end if;
  if partner_record.user_id<>auth.uid() and not public.can_manage_marketplace_partners() then
    raise exception 'Marketplace Partner access denied' using errcode='42501'; end if;
  select count(*) into document_count from public.partner_documents
    where partner_id=partner_record.id and status<>'REJECTED';
  documents_ready:=private.partner_identity_documents_complete(partner_record);
  return query select private.partner_basic_information_complete(partner_record),
    private.partner_fiscal_information_complete(partner_record),documents_ready,
    private.partner_basic_information_complete(partner_record)
      and private.partner_fiscal_information_complete(partner_record)
      and documents_ready and partner_record.terms_accepted_at is not null
      and partner_record.privacy_accepted_at is not null,
    document_count;
end $$;

create or replace function public.submit_partner_for_review(expected_version integer)
returns public.partner_profiles language plpgsql security definer set search_path='' as $$
declare current_user_id uuid:=auth.uid(); partner_record public.partner_profiles;
begin
  if current_user_id is null or not public.is_marketplace_enabled() then
    raise exception 'Marketplace access denied' using errcode='42501'; end if;
  select * into partner_record from public.partner_profiles where user_id=current_user_id for update;
  if not found or partner_record.version<>expected_version or partner_record.status<>'IDENTITY_PENDING' then
    raise exception 'Partner is not ready to submit' using errcode='40001'; end if;
  if not private.partner_basic_information_complete(partner_record)
    or not private.partner_fiscal_information_complete(partner_record)
    or not private.partner_identity_documents_complete(partner_record)
    or partner_record.terms_accepted_at is null or partner_record.privacy_accepted_at is null then
    raise exception 'Partner onboarding is incomplete' using errcode='23514'; end if;
  perform set_config('app.marketplace_reason','Partner submitted onboarding for review',true);
  update public.partner_profiles set status='UNDER_REVIEW',onboarding_step=5,
    submitted_at=now(),version=version+1 where id=partner_record.id returning * into partner_record;
  insert into public.marketplace_partner_notification_outbox(
    event_type,channel,recipient_user_id,subject,body_text,deduplication_key
  ) select 'PARTNER_REVIEW_READY','INTERNAL',ur.user_id,'Partner listo para revisión',
    'Una solicitud Partner está lista para la revisión consolidada.',
    'partner-review:'||partner_record.id::text||':'||partner_record.version::text||':'||ur.user_id::text
  from public.user_roles ur join public.roles r on r.id=ur.role_id where r.name in('operator','admin')
  on conflict(deduplication_key) do nothing;
  return partner_record;
end $$;

revoke all on function public.record_partner_onboarding_consents(integer,boolean,boolean),
  public.register_partner_identity_session(text,text,text),
  public.process_partner_identity_webhook(text,uuid,text,public.identity_verification_result,jsonb,text[],timestamptz,text),
  public.record_partner_document_analysis(uuid,text,public.automatic_document_review_result,jsonb,text[],jsonb),
  public.prepare_marketplace_listing_price(uuid,integer,public.money_minor_units,uuid,uuid),
  public.submit_marketplace_listing_workflow(uuid,integer,uuid),
  public.review_marketplace_submission(uuid,integer,public.marketplace_listing_status,text,jsonb,boolean,text),
  public.confirm_partner_fulfillment_shipment(uuid,integer,text,text,timestamptz,text,uuid),
  public.get_partner_marketplace_sales(uuid),
  public.get_customer_order_fulfillment_summary(uuid),
  public.get_partner_onboarding_readiness(uuid),
  public.submit_partner_for_review(integer)
from public,anon;
grant execute on function public.record_partner_onboarding_consents(integer,boolean,boolean),
  public.register_partner_identity_session(text,text,text),
  public.prepare_marketplace_listing_price(uuid,integer,public.money_minor_units,uuid,uuid),
  public.submit_marketplace_listing_workflow(uuid,integer,uuid),
  public.review_marketplace_submission(uuid,integer,public.marketplace_listing_status,text,jsonb,boolean,text),
  public.confirm_partner_fulfillment_shipment(uuid,integer,text,text,timestamptz,text,uuid),
  public.get_partner_marketplace_sales(uuid),
  public.get_customer_order_fulfillment_summary(uuid),
  public.get_partner_onboarding_readiness(uuid),
  public.submit_partner_for_review(integer)
to authenticated;
grant execute on function public.process_partner_identity_webhook(text,uuid,text,public.identity_verification_result,jsonb,text[],timestamptz,text)
to service_role;
grant execute on function public.record_partner_document_analysis(uuid,text,public.automatic_document_review_result,jsonb,text[],jsonb)
to authenticated;

comment on table public.partner_identity_verifications is
  'Minimal normalized identity-provider result; provider PASSED never auto-verifies a Partner.';
comment on table public.marketplace_partner_notification_outbox is
  'Channel-neutral notification contract. MVP dispatches INTERNAL/EMAIL only; WhatsApp is intentionally absent.';
comment on function public.confirm_partner_fulfillment_shipment is
  'Partner-authoritative, idempotent READY_FOR_CARRIER to SHIPPED carrier handoff.';
