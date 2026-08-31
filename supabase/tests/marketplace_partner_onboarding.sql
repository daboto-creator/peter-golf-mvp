-- Partner onboarding, review, document audit and adversarial access.
-- Run after `npm run supabase:reset`; all fixtures end in ROLLBACK.

begin;

do $$
declare
  allowed_mimes text[];
begin
  select allowed_mime_types into allowed_mimes
  from storage.buckets where id = 'partner-kyc' and not public;
  if allowed_mimes is null
    or (select file_size_limit from storage.buckets where id = 'partner-kyc') <> 10485760
    or allowed_mimes <> array[
      'application/pdf', 'image/jpeg', 'image/png', 'image/webp'
    ]::text[]
  then
    raise exception 'Private KYC bucket limits are incorrect';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('3a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'onboarding-partner-a@example.test', '{}',
   '{"first_name":"Ana","last_name":"Partner"}', now(), now()),
  ('3a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'onboarding-partner-b@example.test', '{}',
   '{"first_name":"Beto","last_name":"Partner"}', now(), now()),
  ('3a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'onboarding-golfer@example.test', '{}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'onboarding-operator@example.test', '{}', '{}', now(), now()),
  ('3a000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'onboarding-admin@example.test', '{}', '{}', now(), now());

insert into public.user_roles (user_id, role_id)
select '3a000000-0000-4000-8000-000000000004'::uuid, id
from public.roles where name = 'operator'
union all
select '3a000000-0000-4000-8000-000000000005'::uuid, id
from public.roles where name = 'admin';

update public.site_settings
set value = '{"enabled": true}'::jsonb
where key = 'marketplace.enabled';

select set_config(
  'request.jwt.claim.sub',
  '3a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.register_partner_profile('INDIVIDUAL');

do $$
declare
  partner_record public.partner_profiles;
  document_record public.partner_documents;
  readiness record;
  document_id uuid := '3d000000-0000-4000-8000-000000000001';
  oversized_document_id uuid := gen_random_uuid();
begin
  select * into strict partner_record
  from public.partner_profiles where user_id = (select auth.uid());
  perform set_config('test.onboarding_partner_a', partner_record.id::text, true);

  partner_record := public.save_partner_onboarding(
    'legal_type', partner_record.version,
    '{"legalType":"INDIVIDUAL"}'::jsonb
  );

  begin
    perform public.save_partner_onboarding(
      'basic', partner_record.version,
      '{"firstName":"Ana","lastName":"Partner","phone":"5512345678","countryCode":"MX","state":"Jalisco","city":"Guadalajara","commercialName":"","representativeName":"","status":"VERIFIED"}'::jsonb
    );
    raise exception 'Expected mass assignment field rejection';
  exception when invalid_parameter_value then null;
  end;

  partner_record := public.save_partner_onboarding(
    'basic', partner_record.version,
    '{"firstName":"Ana","lastName":"Partner","phone":"5512345678","countryCode":"MX","state":"Jalisco","city":"Guadalajara","commercialName":"","representativeName":""}'::jsonb
  );
  partner_record := public.record_partner_onboarding_consents(
    partner_record.version, true, true
  );

  if partner_record.status <> 'IDENTITY_PENDING'
    or partner_record.onboarding_step <> 3
  then
    raise exception 'Basic onboarding did not advance safely';
  end if;

  partner_record := public.save_partner_onboarding(
    'fiscal', partner_record.version,
    '{"taxId":"","legalName":"","fiscalAddressLine1":"","fiscalAddressLine2":"","fiscalCity":"","fiscalState":"","fiscalPostalCode":""}'::jsonb
  );

  begin
    perform public.register_partner_document(
      gen_random_uuid(), 'identity_document',
      'partners/' || partner_record.id::text || '/' || gen_random_uuid()::text || '.exe',
      'application/octet-stream', 1024, repeat('a', 64)
    );
    raise exception 'Expected invalid document metadata to fail';
  exception when invalid_parameter_value or check_violation then null;
  end;

  begin
    perform public.register_partner_document(
      oversized_document_id, 'identity_document',
      'partners/' || partner_record.id::text || '/' || oversized_document_id::text || '.pdf',
      'application/pdf', 10485761, repeat('a', 64)
    );
    raise exception 'Expected oversized document metadata to fail';
  exception when check_violation then null;
  end;

  insert into storage.objects (bucket_id, name, owner)
  values (
    'partner-kyc',
    'partners/' || partner_record.id::text || '/' || document_id::text || '.pdf',
    (select auth.uid())
  );

  document_record := public.register_partner_document(
    document_id,
    'address_proof',
    'partners/' || partner_record.id::text || '/' || document_id::text || '.pdf',
    'application/pdf',
    2048,
    repeat('b', 64)
  );

  perform public.register_partner_identity_session('DIDIT','onboarding-test-session','PERSON');
  perform set_config('test.onboarding_document_a', document_record.id::text, true);
end;
$$;

reset role;
set local role service_role;
select public.process_partner_identity_webhook(
  'DIDIT','3e000000-0000-4000-8000-000000000001',
  'onboarding-test-session','PASSED',
  '{"documentType":"PASSPORT","livenessPassed":true,"faceMatchPassed":true}'::jsonb,
  '{}'::text[],now(),repeat('c',64)
);

reset role;
select set_config('request.jwt.claim.sub','3a000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
declare partner_record public.partner_profiles; readiness record;
begin
  select * into strict partner_record from public.partner_profiles where user_id=auth.uid();
  select * into strict readiness from public.get_partner_onboarding_readiness(null);
  if not readiness.basic_complete or not readiness.fiscal_complete
    or not readiness.documents_complete or not readiness.review_ready
    or readiness.active_document_count<>1 then
    raise exception 'Individual onboarding readiness is incorrect';
  end if;
  if partner_record.status='VERIFIED' then
    raise exception 'Provider PASSED incorrectly auto-verified Partner';
  end if;
  partner_record:=public.save_partner_onboarding('documents',partner_record.version,'{}'::jsonb);
  partner_record:=public.submit_partner_for_review(partner_record.version);
  if partner_record.status<>'UNDER_REVIEW' or partner_record.submitted_at is null then
    raise exception 'Partner submission failed'; end if;
  begin
    perform public.save_partner_onboarding('legal_type',partner_record.version,
      '{"legalType":"LEGAL_ENTITY"}'::jsonb);
    raise exception 'Expected submitted onboarding to be read only';
  exception when check_violation then null; end;
  perform set_config('test.onboarding_partner_a_version',partner_record.version::text,true);
end $$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '3a000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.register_partner_profile('LEGAL_ENTITY');

do $$
declare
  partner_a_id uuid := current_setting('test.onboarding_partner_a')::uuid;
begin
  if exists (select 1 from public.partner_profiles where id = partner_a_id)
    or exists (
      select 1 from public.partner_documents
      where partner_id = partner_a_id
    )
    or exists (
      select 1 from storage.objects
      where bucket_id = 'partner-kyc'
    )
  then
    raise exception 'Partner B can access Partner A onboarding or KYC';
  end if;

  begin
    perform public.get_partner_onboarding_readiness(partner_a_id);
    raise exception 'Expected cross-Partner readiness access to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;

do $$
begin
  begin
    perform 1 from public.partner_profiles;
    raise exception 'Anonymous role can read Partner profiles';
  exception when insufficient_privilege then null;
  end;

  begin
    perform 1 from public.partner_documents;
    raise exception 'Anonymous role can read Partner documents';
  exception when insufficient_privilege then null;
  end;

  if exists (select 1 from storage.objects where bucket_id = 'partner-kyc') then
    raise exception 'Anonymous role can access private KYC Storage';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '3a000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.partner_profiles)
    or exists (select 1 from public.partner_documents)
  then
    raise exception 'Golfer can access Partner private data';
  end if;

  perform public.register_partner_profile('SOLE_PROPRIETOR');

  if (select count(*) from public.partner_profiles) <> 1 then
    raise exception 'Golfer could not create exactly one own Partner profile';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '3a000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;

do $$
declare
  document_record public.partner_documents;
  partner_record public.partner_profiles;
begin
  if not public.can_manage_marketplace_partners()
    or not public.can_review_partner_documents()
    or public.can_manage_marketplace_configuration()
  then
    raise exception 'Operations capabilities are incorrect';
  end if;

  if not exists (
    select 1 from storage.objects where bucket_id = 'partner-kyc'
  ) then
    raise exception 'Operations cannot access private Partner documents';
  end if;

  document_record := public.review_partner_document(
    current_setting('test.onboarding_document_a')::uuid,
    1,
    'REJECTED',
    'La imagen no permite confirmar la información'
  );

  select * into strict partner_record
  from public.transition_partner_status(
    current_setting('test.onboarding_partner_a')::uuid,
    current_setting('test.onboarding_partner_a_version')::integer,
    'IDENTITY_PENDING',
    'Se requiere actualizar un documento'
  );

  if document_record.status <> 'REJECTED'
    or document_record.version <> 2
    or partner_record.status <> 'IDENTITY_PENDING'
    or not exists (
      select 1 from public.audit_logs
      where action = 'marketplace.partner_document_reviewed'
        and entity_id = document_record.id
        and metadata ->> 'reason' =
          'La imagen no permite confirmar la información'
    )
  then
    raise exception 'Operations review or audit failed';
  end if;

  if not exists (
    select 1 from public.audit_logs
    where action = 'marketplace.partner_document_uploaded'
      and entity_id = document_record.id
      and not metadata ? 'storage_path'
      and not metadata ? 'sha256'
  ) then
    raise exception 'Document upload audit leaked data or is missing';
  end if;

  begin
    perform public.review_partner_document(
      document_record.id, 1, 'VERIFIED', 'Stale review'
    );
    raise exception 'Expected document version conflict';
  exception when serialization_failure then null;
  end;

  if exists (select 1 from public.marketplace_financial_rules) then
    raise exception 'Operator can read financial configuration';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '3a000000-0000-4000-8000-000000000005',
  true
);
set local role authenticated;

do $$
begin
  if not public.can_manage_marketplace_configuration()
    or not exists (select 1 from public.marketplace_financial_rules)
    or (select count(*) from public.partner_profiles) < 3
  then
    raise exception 'Admin access is incomplete';
  end if;
end;
$$;

rollback;
