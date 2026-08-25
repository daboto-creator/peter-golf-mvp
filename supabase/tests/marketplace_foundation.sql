-- Marketplace Partner foundation, config versioning, audit and adversarial RLS.
-- Run after `npm run supabase:reset`. Every fixture rolls back.

begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('2a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'partner-a@example.test', '{}', '{}', now(), now()),
  ('2a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'partner-b@example.test', '{}', '{}', now(), now()),
  ('2a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'golfer@example.test', '{}', '{}', now(), now()),
  ('2a000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'marketplace-operator@example.test', '{}', '{}', now(), now()),
  ('2a000000-0000-4000-8000-000000000005', 'authenticated', 'authenticated',
   'marketplace-admin@example.test', '{}', '{}', now(), now());

insert into public.user_roles (user_id, role_id)
select '2a000000-0000-4000-8000-000000000004'::uuid, id
from public.roles where name = 'operator'
union all
select '2a000000-0000-4000-8000-000000000005'::uuid, id
from public.roles where name = 'admin';

do $$
begin
  if public.is_marketplace_enabled() then
    raise exception 'Marketplace must be disabled after migration';
  end if;

  if (select public from storage.buckets where id = 'partner-kyc') then
    raise exception 'Partner KYC bucket must remain private';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

do $$
begin
  begin
    perform public.register_partner_profile('INDIVIDUAL');
    raise exception 'Expected disabled Marketplace registration to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
update public.site_settings
set value = '{"enabled": true}'::jsonb
where key = 'marketplace.enabled';

select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000001',
  true
);
set local role authenticated;

select public.register_partner_profile('INDIVIDUAL');

do $$
declare
  partner_id uuid;
  document_id uuid := '2d000000-0000-4000-8000-000000000001';
begin
  select id into strict partner_id
  from public.partner_profiles
  where user_id = (select auth.uid());

  perform set_config('test.partner_a_id', partner_id::text, true);

  if (select count(*) from public.partner_profiles) <> 1
    or (select count(*) from public.partner_status_history) <> 1
  then
    raise exception 'Partner A should see its profile and registration history';
  end if;

  if exists (select 1 from public.marketplace_financial_rules) then
    raise exception 'Partner must not read Marketplace financial configuration';
  end if;

  begin
    update public.partner_profiles set status = 'VERIFIED' where id = partner_id;
    raise exception 'Expected direct Partner status mutation to fail';
  exception when insufficient_privilege then null;
  end;

  insert into public.partner_documents (
    id, partner_id, document_kind, storage_path, mime_type, size_bytes,
    sha256, uploaded_by
  ) values (
    document_id,
    partner_id,
    'identity_document',
    'partners/' || partner_id::text || '/' || document_id::text || '.pdf',
    'application/pdf',
    1024,
    repeat('a', 64),
    (select auth.uid())
  );

  insert into storage.objects (bucket_id, name, owner)
  values (
    'partner-kyc',
    'partners/' || partner_id::text || '/' || document_id::text || '.pdf',
    (select auth.uid())
  );

  if (select count(*) from public.partner_documents) <> 1
    or (select count(*) from storage.objects where bucket_id = 'partner-kyc') <> 1
  then
    raise exception 'Partner A should read its own private KYC records';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

select public.register_partner_profile('SOLE_PROPRIETOR');

do $$
declare
  partner_a_id uuid := current_setting('test.partner_a_id')::uuid;
  partner_b_id uuid;
begin
  select id into strict partner_b_id
  from public.partner_profiles
  where user_id = (select auth.uid());
  perform set_config('test.partner_b_id', partner_b_id::text, true);

  if (select count(*) from public.partner_profiles) <> 1
    or exists (
      select 1 from public.partner_profiles where id = partner_a_id
    )
    or exists (select 1 from public.partner_documents)
    or exists (
      select 1 from storage.objects where bucket_id = 'partner-kyc'
    )
  then
    raise exception 'Partner B can read Partner A private data';
  end if;

  begin
    insert into public.partner_documents (
      partner_id, document_kind, storage_path, mime_type, size_bytes, uploaded_by
    ) values (
      partner_a_id,
      'identity_document',
      'partners/' || partner_a_id::text ||
        '/2d000000-0000-4000-8000-000000000002.pdf',
      'application/pdf',
      1024,
      (select auth.uid())
    );
    raise exception 'Expected cross-Partner metadata insert to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000003',
  true
);
set local role authenticated;

do $$
begin
  if exists (select 1 from public.partner_profiles)
    or exists (select 1 from public.partner_documents)
    or exists (select 1 from public.partner_status_history)
    or exists (select 1 from public.marketplace_config_versions)
  then
    raise exception 'Golfer can read private Marketplace data';
  end if;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000004',
  true
);
set local role authenticated;

do $$
declare
  partner_a_id uuid := current_setting('test.partner_a_id')::uuid;
begin
  if not public.can_manage_marketplace_partners()
    or public.can_manage_marketplace_configuration()
  then
    raise exception 'Operator capability boundary is incorrect';
  end if;

  if (select count(*) from public.partner_profiles) <> 2
    or (select count(*) from public.partner_documents) <> 1
    or exists (select 1 from public.marketplace_financial_rules)
  then
    raise exception 'Operator Marketplace access is incorrect';
  end if;

  perform public.transition_partner_status(
    partner_a_id, 1, 'IDENTITY_PENDING', 'Identity information received'
  );

  begin
    perform public.transition_partner_status(
      partner_a_id, 2, 'VERIFIED', 'Invalid transition test'
    );
    raise exception 'Expected invalid status transition to fail';
  exception when check_violation then null;
  end;

  perform public.transition_partner_status(
    partner_a_id, 2, 'UNDER_REVIEW', 'Review started'
  );
  perform public.transition_partner_status(
    partner_a_id, 3, 'VERIFIED', 'Verification approved'
  );

  begin
    perform public.transition_partner_status(
      partner_a_id, 3, 'SUSPENDED', 'Stale version test'
    );
    raise exception 'Expected optimistic concurrency conflict';
  exception when serialization_failure then null;
  end;

  if (select status from public.partner_profiles where id = partner_a_id)
      <> 'VERIFIED'
    or (select version from public.partner_profiles where id = partner_a_id) <> 4
    or (select count(*) from public.partner_status_history
        where partner_id = partner_a_id) <> 4
    or (select count(*) from public.audit_logs
        where entity_id = partner_a_id
          and action like 'marketplace.partner%') <> 4
  then
    raise exception 'Status history or audit trail is incomplete';
  end if;

  begin
    update public.partner_status_history
    set reason = 'Tampered history'
    where partner_id = partner_a_id;
    raise exception 'Expected immutable status history to reject update';
  exception when insufficient_privilege then null;
  end;

  begin
    perform public.create_marketplace_config_draft('Operator forbidden');
    raise exception 'Expected operator config mutation to fail';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config(
  'request.jwt.claim.sub',
  '2a000000-0000-4000-8000-000000000005',
  true
);
set local role authenticated;

do $$
declare
  draft_id uuid;
begin
  if not public.can_manage_marketplace_configuration()
    or (select count(*) from public.marketplace_tier_rules) <> 5
    or (select commission_rate_bps from public.marketplace_tier_rules
        where tier = 'BOGEY') <> 1500
    or (select commission_rate_bps from public.marketplace_tier_rules
        where tier = 'PAR') <> 1400
    or (select commission_rate_bps from public.marketplace_tier_rules
        where tier = 'BIRDIE') <> 1300
    or (select commission_rate_bps from public.marketplace_tier_rules
        where tier = 'ALBATROSS') <> 1200
    or (select commission_rate_bps from public.marketplace_tier_rules
        where tier = 'HOLE_IN_ONE') <> 1100
  then
    raise exception 'Approved commission baseline is incorrect';
  end if;

  if not exists (
    select 1 from public.marketplace_financial_rules
    where partner_processing_share_bps = 5000
      and admin_fee_bps = 75
      and admin_fixed_fee = 3900
      and minimum_marketplace_revenue is null
  ) or not exists (
    select 1 from public.marketplace_operational_rules
    where tier_averaging_window_days = 30
      and score_provisional_completed_orders is null
  ) or exists (select 1 from public.marketplace_score_weight_rules)
  then
    raise exception 'Foundation config or deferred score decisions are incorrect';
  end if;

  draft_id := public.create_marketplace_config_draft(
    'Prepare auditable configuration successor'
  );
  perform public.publish_marketplace_config_version(
    draft_id,
    'Publish cloned baseline for version invariant test'
  );

  if (select count(*) from public.marketplace_config_versions
      where status = 'PUBLISHED' and effective_to is null) <> 1
    or (select count(*) from public.marketplace_config_versions
        where status = 'RETIRED' and effective_to is not null) <> 1
    or not exists (
      select 1 from public.audit_logs
      where action = 'marketplace.configuration_published'
        and entity_id = draft_id
    )
  then
    raise exception 'Configuration publication invariant or audit failed';
  end if;
end;
$$;

rollback;
