-- Marketplace foundation: Partner identity, versioned configuration, private KYC
-- metadata/Storage, audit history and least-privilege access. Marketplace sales,
-- listings, score, tier calculation, checkout, ledger and payouts are deferred.

create schema if not exists private;

create type public.partner_legal_type as enum (
  'INDIVIDUAL',
  'SOLE_PROPRIETOR',
  'LEGAL_ENTITY'
);

create type public.partner_status as enum (
  'REGISTERED',
  'IDENTITY_PENDING',
  'UNDER_REVIEW',
  'VERIFIED',
  'SUSPENDED',
  'REJECTED'
);

create type public.partner_document_status as enum (
  'UPLOADED',
  'UNDER_REVIEW',
  'VERIFIED',
  'REJECTED'
);

create type public.marketplace_config_status as enum (
  'DRAFT',
  'PUBLISHED',
  'RETIRED'
);

create type public.marketplace_partner_tier as enum (
  'BOGEY',
  'PAR',
  'BIRDIE',
  'ALBATROSS',
  'HOLE_IN_ONE'
);

create table public.partner_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles (id) on delete restrict,
  legal_type public.partner_legal_type not null,
  status public.partner_status not null default 'REGISTERED',
  version integer not null default 1 check (version > 0),
  verified_at timestamptz,
  suspended_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_profiles_status_timestamps check (
    (status <> 'VERIFIED' or verified_at is not null)
    and (status <> 'SUSPENDED' or suspended_at is not null)
    and (status <> 'REJECTED' or rejected_at is not null)
  )
);

create table public.partner_status_history (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  from_status public.partner_status,
  to_status public.partner_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  version integer not null check (version > 0),
  created_at timestamptz not null default now(),
  constraint partner_status_history_reason_length check (
    reason is null or char_length(btrim(reason)) between 3 and 500
  )
);

create table public.partner_documents (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  document_kind text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  sha256 text,
  status public.partner_document_status not null default 'UPLOADED',
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  reviewed_by uuid references public.profiles (id) on delete set null,
  review_reason text,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_documents_kind_format check (
    document_kind ~ '^[a-z][a-z0-9_]{1,63}$'
  ),
  constraint partner_documents_path_format check (
    storage_path ~ '^partners/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
  ),
  constraint partner_documents_mime_type_allowed check (
    mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
  ),
  constraint partner_documents_sha256_format check (
    sha256 is null or sha256 ~ '^[0-9a-f]{64}$'
  ),
  constraint partner_documents_review_consistent check (
    (status = 'UPLOADED' and reviewed_by is null and reviewed_at is null)
    or (status <> 'UPLOADED' and reviewed_by is not null and reviewed_at is not null)
  ),
  constraint partner_documents_review_reason_length check (
    review_reason is null or char_length(btrim(review_reason)) between 3 and 500
  )
);

create sequence public.marketplace_config_version_number_seq;

create table public.marketplace_config_versions (
  id uuid primary key default gen_random_uuid(),
  version_number bigint not null unique
    default nextval('public.marketplace_config_version_number_seq'),
  status public.marketplace_config_status not null default 'DRAFT',
  effective_from timestamptz,
  effective_to timestamptz,
  created_by uuid references public.profiles (id) on delete set null,
  published_by uuid references public.profiles (id) on delete set null,
  publication_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_config_version_window check (
    effective_to is null or (
      effective_from is not null and effective_to > effective_from
    )
  ),
  constraint marketplace_config_publication_consistent check (
    (status = 'DRAFT' and effective_from is null and published_by is null)
    or (
      status in ('PUBLISHED', 'RETIRED')
      and effective_from is not null
      and publication_reason is not null
      and char_length(btrim(publication_reason)) between 3 and 500
    )
  )
);

create unique index marketplace_one_current_config_idx
  on public.marketplace_config_versions ((true))
  where status = 'PUBLISHED' and effective_to is null;

create table public.marketplace_tier_rules (
  config_version_id uuid not null
    references public.marketplace_config_versions (id) on delete cascade,
  tier public.marketplace_partner_tier not null,
  minimum_average_active_listings numeric(12, 4),
  maximum_average_active_listings numeric(12, 4),
  minimum_score numeric(5, 2),
  commission_rate_bps integer not null,
  primary key (config_version_id, tier),
  constraint marketplace_tier_listing_range check (
    (minimum_average_active_listings is null
      or minimum_average_active_listings >= 0)
    and (maximum_average_active_listings is null
      or maximum_average_active_listings >= minimum_average_active_listings)
  ),
  constraint marketplace_tier_score_range check (
    minimum_score is null or minimum_score between 0 and 100
  ),
  constraint marketplace_tier_commission_range check (
    commission_rate_bps between 0 and 10000
  )
);

create table public.marketplace_financial_rules (
  config_version_id uuid primary key
    references public.marketplace_config_versions (id) on delete cascade,
  partner_processing_share_bps integer not null,
  admin_fee_bps integer not null,
  admin_fixed_fee public.money_minor_units not null,
  commission_tax_bps integer,
  minimum_marketplace_revenue public.money_minor_units,
  currency public.iso_currency_code not null default 'MXN',
  constraint marketplace_partner_processing_share_range check (
    partner_processing_share_bps between 0 and 10000
  ),
  constraint marketplace_admin_fee_range check (
    admin_fee_bps between 0 and 10000
  ),
  constraint marketplace_commission_tax_range check (
    commission_tax_bps is null or commission_tax_bps between 0 and 10000
  )
);

create table public.marketplace_operational_rules (
  config_version_id uuid primary key
    references public.marketplace_config_versions (id) on delete cascade,
  tier_averaging_window_days integer not null,
  score_provisional_completed_orders integer,
  listing_expiry_days integer,
  acceptance_window_hours integer,
  payout_interval_days integer,
  constraint marketplace_tier_window_range check (
    tier_averaging_window_days between 1 and 365
  ),
  constraint marketplace_operational_positive_values check (
    (score_provisional_completed_orders is null
      or score_provisional_completed_orders > 0)
    and (listing_expiry_days is null or listing_expiry_days > 0)
    and (acceptance_window_hours is null or acceptance_window_hours > 0)
    and (payout_interval_days is null or payout_interval_days > 0)
  )
);

create table public.marketplace_score_weight_rules (
  config_version_id uuid not null
    references public.marketplace_config_versions (id) on delete cascade,
  metric_code text not null,
  weight_bps integer not null,
  primary key (config_version_id, metric_code),
  constraint marketplace_score_metric_format check (
    metric_code ~ '^[a-z][a-z0-9_]{1,63}$'
  ),
  constraint marketplace_score_weight_range check (
    weight_bps between 0 and 10000
  )
);

create index partner_profiles_status_idx
  on public.partner_profiles (status, created_at desc);
create index partner_status_history_partner_created_idx
  on public.partner_status_history (partner_id, created_at desc);
create index partner_status_history_actor_idx
  on public.partner_status_history (actor_id)
  where actor_id is not null;
create index partner_documents_partner_status_idx
  on public.partner_documents (partner_id, status, created_at desc);

create trigger partner_profiles_set_updated_at
before update on public.partner_profiles
for each row execute function public.set_updated_at();

create trigger partner_documents_set_updated_at
before update on public.partner_documents
for each row execute function public.set_updated_at();

create trigger marketplace_config_versions_set_updated_at
before update on public.marketplace_config_versions
for each row execute function public.set_updated_at();

create trigger partner_status_history_is_immutable
before update or delete on public.partner_status_history
for each row execute function public.reject_immutable_row_change();

insert into public.site_settings (key, value, description, is_public)
values (
  'marketplace.enabled',
  '{"enabled": false}'::jsonb,
  'Database kill switch for the Best Round Partner Marketplace',
  false
)
on conflict (key) do update
set value = '{"enabled": false}'::jsonb,
    description = excluded.description,
    is_public = false;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'partner-kyc',
  'partner-kyc',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

-- Only the approved financial baselines and the 30-day averaging window are
-- seeded. Tier score/volume thresholds and score weights remain unset for PR 4.
do $$
declare
  initial_config_id uuid := gen_random_uuid();
begin
  insert into public.marketplace_config_versions (
    id,
    status,
    effective_from,
    publication_reason
  ) values (
    initial_config_id,
    'PUBLISHED',
    now(),
    'Initial approved Marketplace foundation baseline'
  );

  insert into public.marketplace_tier_rules (
    config_version_id,
    tier,
    commission_rate_bps
  ) values
    (initial_config_id, 'BOGEY', 1500),
    (initial_config_id, 'PAR', 1400),
    (initial_config_id, 'BIRDIE', 1300),
    (initial_config_id, 'ALBATROSS', 1200),
    (initial_config_id, 'HOLE_IN_ONE', 1100);

  insert into public.marketplace_financial_rules (
    config_version_id,
    partner_processing_share_bps,
    admin_fee_bps,
    admin_fixed_fee
  ) values (initial_config_id, 5000, 75, 3900);

  insert into public.marketplace_operational_rules (
    config_version_id,
    tier_averaging_window_days
  ) values (initial_config_id, 30);
end;
$$;

create or replace function public.is_marketplace_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select (site_settings.value ->> 'enabled')::boolean
      from public.site_settings
      where site_settings.key = 'marketplace.enabled'
        and jsonb_typeof(site_settings.value -> 'enabled') = 'boolean'
    ),
    false
  );
$$;

create or replace function public.can_manage_marketplace_partners()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    inner join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name in ('operator', 'admin')
  );
$$;

create or replace function public.can_review_partner_documents()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.can_manage_marketplace_partners();
$$;

create or replace function public.can_manage_marketplace_configuration()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    inner join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name = 'admin'
  );
$$;

create or replace function private.write_marketplace_audit(
  requested_action text,
  requested_entity_type text,
  requested_entity_id uuid,
  requested_reason text,
  requested_before jsonb,
  requested_after jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if requested_action !~ '^marketplace\.[a-z0-9_]+$'
    or requested_entity_type !~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'
  then
    raise exception 'Invalid Marketplace audit identity' using errcode = '22023';
  end if;

  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    metadata
  ) values (
    (select auth.uid()),
    requested_action,
    requested_entity_type,
    requested_entity_id,
    jsonb_strip_nulls(jsonb_build_object(
      'reason', requested_reason,
      'before', requested_before,
      'after', requested_after
    ))
  );
end;
$$;

create or replace function private.audit_partner_profile_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_reason text := nullif(current_setting('app.marketplace_reason', true), '');
  change_actor uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    insert into public.partner_status_history (
      partner_id, from_status, to_status, actor_id, reason, version
    ) values (
      new.id, null, new.status, change_actor, change_reason, new.version
    );

    perform private.write_marketplace_audit(
      'marketplace.partner_registered',
      'partner_profile',
      new.id,
      change_reason,
      null,
      jsonb_build_object(
        'legal_type', new.legal_type,
        'status', new.status,
        'version', new.version
      )
    );
  elsif old.status is distinct from new.status then
    insert into public.partner_status_history (
      partner_id, from_status, to_status, actor_id, reason, version
    ) values (
      new.id, old.status, new.status, change_actor, change_reason, new.version
    );

    perform private.write_marketplace_audit(
      'marketplace.partner_status_changed',
      'partner_profile',
      new.id,
      change_reason,
      jsonb_build_object('status', old.status, 'version', old.version),
      jsonb_build_object('status', new.status, 'version', new.version)
    );
  end if;

  return new;
end;
$$;

create trigger partner_profiles_write_audit
after insert or update on public.partner_profiles
for each row execute function private.audit_partner_profile_change();

create or replace function public.register_partner_profile(
  requested_legal_type public.partner_legal_type
)
returns public.partner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  partner_record public.partner_profiles;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_marketplace_enabled() then
    raise exception 'Marketplace is disabled' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles where profiles.id = current_user_id
  ) then
    raise exception 'Profile required' using errcode = '23503';
  end if;

  perform set_config('app.marketplace_reason', 'Partner self-registration', true);

  insert into public.partner_profiles (user_id, legal_type)
  values (current_user_id, requested_legal_type)
  on conflict (user_id) do nothing
  returning * into partner_record;

  if partner_record.id is null then
    select * into strict partner_record
    from public.partner_profiles
    where user_id = current_user_id;

    if partner_record.legal_type <> requested_legal_type then
      raise exception 'Partner profile already exists with another legal type'
        using errcode = '23505';
    end if;
  end if;

  return partner_record;
end;
$$;

create or replace function public.transition_partner_status(
  requested_partner_id uuid,
  expected_version integer,
  requested_status public.partner_status,
  requested_reason text
)
returns public.partner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  partner_record public.partner_profiles;
  reason_value text := btrim(requested_reason);
begin
  if not public.can_manage_marketplace_partners() then
    raise exception 'Marketplace Partner access denied' using errcode = '42501';
  end if;

  if char_length(reason_value) not between 3 and 500 then
    raise exception 'A reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select * into partner_record
  from public.partner_profiles
  where id = requested_partner_id
  for update;

  if not found then
    raise exception 'Partner unavailable' using errcode = 'P0002';
  end if;

  if partner_record.version <> expected_version then
    raise exception 'Partner version conflict' using errcode = '40001';
  end if;

  if partner_record.status = requested_status then
    raise exception 'Partner already has requested status' using errcode = '22023';
  end if;

  if not (
    (partner_record.status = 'REGISTERED' and requested_status = 'IDENTITY_PENDING')
    or (partner_record.status = 'IDENTITY_PENDING' and requested_status = 'UNDER_REVIEW')
    or (partner_record.status = 'UNDER_REVIEW'
      and requested_status in ('IDENTITY_PENDING', 'VERIFIED', 'REJECTED'))
    or (partner_record.status = 'VERIFIED' and requested_status = 'SUSPENDED')
    or (partner_record.status = 'SUSPENDED'
      and requested_status in ('VERIFIED', 'REJECTED'))
    or (partner_record.status = 'REJECTED'
      and requested_status = 'IDENTITY_PENDING')
  ) then
    raise exception 'Invalid Partner status transition' using errcode = '23514';
  end if;

  perform set_config('app.marketplace_reason', reason_value, true);

  update public.partner_profiles
  set status = requested_status,
      version = version + 1,
      verified_at = case
        when requested_status = 'VERIFIED' then now()
        else verified_at
      end,
      suspended_at = case
        when requested_status = 'SUSPENDED' then now()
        else suspended_at
      end,
      rejected_at = case
        when requested_status = 'REJECTED' then now()
        else rejected_at
      end
  where id = requested_partner_id
  returning * into partner_record;

  return partner_record;
end;
$$;

create or replace function public.create_marketplace_config_draft(
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_config_id uuid;
  new_config_id uuid := gen_random_uuid();
  reason_value text := btrim(requested_reason);
begin
  if not public.can_manage_marketplace_configuration() then
    raise exception 'Marketplace configuration access denied'
      using errcode = '42501';
  end if;

  if char_length(reason_value) not between 3 and 500 then
    raise exception 'A reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select id into strict source_config_id
  from public.marketplace_config_versions
  where status = 'PUBLISHED' and effective_to is null
  for share;

  insert into public.marketplace_config_versions (id, created_by)
  values (new_config_id, (select auth.uid()));

  insert into public.marketplace_tier_rules
  select new_config_id, tier, minimum_average_active_listings,
    maximum_average_active_listings, minimum_score, commission_rate_bps
  from public.marketplace_tier_rules
  where config_version_id = source_config_id;

  insert into public.marketplace_financial_rules
  select new_config_id, partner_processing_share_bps, admin_fee_bps,
    admin_fixed_fee, commission_tax_bps, minimum_marketplace_revenue, currency
  from public.marketplace_financial_rules
  where config_version_id = source_config_id;

  insert into public.marketplace_operational_rules
  select new_config_id, tier_averaging_window_days,
    score_provisional_completed_orders, listing_expiry_days,
    acceptance_window_hours, payout_interval_days
  from public.marketplace_operational_rules
  where config_version_id = source_config_id;

  insert into public.marketplace_score_weight_rules
  select new_config_id, metric_code, weight_bps
  from public.marketplace_score_weight_rules
  where config_version_id = source_config_id;

  perform private.write_marketplace_audit(
    'marketplace.configuration_draft_created',
    'marketplace_config_version',
    new_config_id,
    reason_value,
    jsonb_build_object('source_config_id', source_config_id),
    jsonb_build_object('status', 'DRAFT')
  );

  return new_config_id;
end;
$$;

create or replace function public.publish_marketplace_config_version(
  requested_config_id uuid,
  requested_reason text
)
returns public.marketplace_config_versions
language plpgsql
security definer
set search_path = ''
as $$
declare
  config_record public.marketplace_config_versions;
  reason_value text := btrim(requested_reason);
  published_at timestamptz := now();
begin
  if not public.can_manage_marketplace_configuration() then
    raise exception 'Marketplace configuration access denied'
      using errcode = '42501';
  end if;

  if char_length(reason_value) not between 3 and 500 then
    raise exception 'A reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('marketplace-config-publish', 0));

  select * into config_record
  from public.marketplace_config_versions
  where id = requested_config_id
  for update;

  if not found then
    raise exception 'Marketplace configuration unavailable' using errcode = 'P0002';
  end if;

  if config_record.status <> 'DRAFT' then
    raise exception 'Only a draft configuration can be published'
      using errcode = '23514';
  end if;

  if (select count(*) from public.marketplace_tier_rules
      where config_version_id = requested_config_id) <> 5
    or not exists (
      select 1 from public.marketplace_financial_rules
      where config_version_id = requested_config_id
    )
    or not exists (
      select 1 from public.marketplace_operational_rules
      where config_version_id = requested_config_id
    )
  then
    raise exception 'Marketplace configuration is incomplete'
      using errcode = '23514';
  end if;

  update public.marketplace_config_versions
  set status = 'RETIRED', effective_to = published_at
  where status = 'PUBLISHED' and effective_to is null;

  update public.marketplace_config_versions
  set status = 'PUBLISHED',
      effective_from = published_at,
      published_by = (select auth.uid()),
      publication_reason = reason_value
  where id = requested_config_id
  returning * into config_record;

  perform private.write_marketplace_audit(
    'marketplace.configuration_published',
    'marketplace_config_version',
    requested_config_id,
    reason_value,
    jsonb_build_object('status', 'DRAFT'),
    jsonb_build_object(
      'status', 'PUBLISHED',
      'version_number', config_record.version_number,
      'effective_from', config_record.effective_from
    )
  );

  return config_record;
end;
$$;

alter table public.partner_profiles enable row level security;
alter table public.partner_status_history enable row level security;
alter table public.partner_documents enable row level security;
alter table public.marketplace_config_versions enable row level security;
alter table public.marketplace_tier_rules enable row level security;
alter table public.marketplace_financial_rules enable row level security;
alter table public.marketplace_operational_rules enable row level security;
alter table public.marketplace_score_weight_rules enable row level security;

create policy "Partners can read own profile"
on public.partner_profiles for select to authenticated
using (user_id = (select auth.uid()));

create policy "Marketplace staff can read Partner profiles"
on public.partner_profiles for select to authenticated
using ((select public.can_manage_marketplace_partners()));

create policy "Partners can read own status history"
on public.partner_status_history for select to authenticated
using (
  exists (
    select 1 from public.partner_profiles
    where partner_profiles.id = partner_status_history.partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace staff can read Partner status history"
on public.partner_status_history for select to authenticated
using ((select public.can_manage_marketplace_partners()));

create policy "Partners can read own document metadata"
on public.partner_documents for select to authenticated
using (
  exists (
    select 1 from public.partner_profiles
    where partner_profiles.id = partner_documents.partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Partners can register own document metadata"
on public.partner_documents for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and status = 'UPLOADED'
  and reviewed_by is null
  and reviewed_at is null
  and (storage.foldername(storage_path))[1] = 'partners'
  and (storage.foldername(storage_path))[2] = partner_id::text
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.id = partner_documents.partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Partners can delete unreviewed own document metadata"
on public.partner_documents for delete to authenticated
using (
  status = 'UPLOADED'
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.id = partner_documents.partner_id
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Marketplace reviewers can read Partner document metadata"
on public.partner_documents for select to authenticated
using ((select public.can_review_partner_documents()));

create policy "Marketplace admins can read config versions"
on public.marketplace_config_versions for select to authenticated
using ((select public.can_manage_marketplace_configuration()));

create policy "Marketplace admins can read tier rules"
on public.marketplace_tier_rules for select to authenticated
using ((select public.can_manage_marketplace_configuration()));

create policy "Marketplace admins can read financial rules"
on public.marketplace_financial_rules for select to authenticated
using ((select public.can_manage_marketplace_configuration()));

create policy "Marketplace admins can read operational rules"
on public.marketplace_operational_rules for select to authenticated
using ((select public.can_manage_marketplace_configuration()));

create policy "Marketplace admins can read score weight rules"
on public.marketplace_score_weight_rules for select to authenticated
using ((select public.can_manage_marketplace_configuration()));

create policy "Marketplace staff can read Marketplace audit"
on public.audit_logs for select to authenticated
using (
  action like 'marketplace.%'
  and (select public.can_manage_marketplace_partners())
);

create policy "Partners can read own private KYC objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'partner-kyc'
  and name ~ '^partners/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Partners can upload own private KYC objects"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'partner-kyc'
  and name ~ '^partners/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(pdf|jpg|jpeg|png|webp)$'
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and partner_profiles.user_id = (select auth.uid())
  )
);

create policy "Partners can delete own private KYC objects"
on storage.objects for delete to authenticated
using (
  bucket_id = 'partner-kyc'
  and exists (
    select 1 from public.partner_profiles
    where partner_profiles.id::text = (storage.foldername(storage.objects.name))[2]
      and partner_profiles.user_id = (select auth.uid())
  )
  and not exists (
    select 1 from public.partner_documents
    where partner_documents.storage_path = storage.objects.name
      and partner_documents.status <> 'UPLOADED'
  )
);

create policy "Marketplace reviewers can read private KYC objects"
on storage.objects for select to authenticated
using (
  bucket_id = 'partner-kyc'
  and (select public.can_review_partner_documents())
);

revoke all on public.partner_profiles from anon, authenticated;
revoke all on public.partner_status_history from anon, authenticated;
revoke all on public.partner_documents from anon, authenticated;
revoke all on public.marketplace_config_versions from anon, authenticated;
revoke all on public.marketplace_tier_rules from anon, authenticated;
revoke all on public.marketplace_financial_rules from anon, authenticated;
revoke all on public.marketplace_operational_rules from anon, authenticated;
revoke all on public.marketplace_score_weight_rules from anon, authenticated;

grant select on public.partner_profiles to authenticated;
grant select on public.partner_status_history to authenticated;
grant select on public.partner_documents to authenticated;
grant insert (
  id, partner_id, document_kind, storage_path, mime_type, size_bytes,
  sha256, uploaded_by
) on public.partner_documents to authenticated;
grant delete on public.partner_documents to authenticated;
grant select on public.marketplace_config_versions to authenticated;
grant select on public.marketplace_tier_rules to authenticated;
grant select on public.marketplace_financial_rules to authenticated;
grant select on public.marketplace_operational_rules to authenticated;
grant select on public.marketplace_score_weight_rules to authenticated;
grant select on public.audit_logs to authenticated;

revoke all on function public.is_marketplace_enabled() from public, anon;
revoke all on function public.can_manage_marketplace_partners() from public, anon;
revoke all on function public.can_review_partner_documents() from public, anon;
revoke all on function public.can_manage_marketplace_configuration()
  from public, anon;
revoke all on function public.register_partner_profile(public.partner_legal_type)
  from public, anon;
revoke all on function public.transition_partner_status(
  uuid, integer, public.partner_status, text
) from public, anon;
revoke all on function public.create_marketplace_config_draft(text)
  from public, anon;
revoke all on function public.publish_marketplace_config_version(uuid, text)
  from public, anon;
revoke all on function private.write_marketplace_audit(
  text, text, uuid, text, jsonb, jsonb
) from public, anon, authenticated;
revoke all on function private.audit_partner_profile_change()
  from public, anon, authenticated;

grant execute on function public.is_marketplace_enabled() to authenticated;
grant execute on function public.can_manage_marketplace_partners()
  to authenticated;
grant execute on function public.can_review_partner_documents()
  to authenticated;
grant execute on function public.can_manage_marketplace_configuration()
  to authenticated;
grant execute on function public.register_partner_profile(public.partner_legal_type)
  to authenticated;
grant execute on function public.transition_partner_status(
  uuid, integer, public.partner_status, text
) to authenticated;
grant execute on function public.create_marketplace_config_draft(text)
  to authenticated;
grant execute on function public.publish_marketplace_config_version(uuid, text)
  to authenticated;

comment on table public.partner_profiles is
  'Optional Best Round Partner mode for an existing profile; not an admin role.';
comment on table public.partner_documents is
  'Non-sensitive KYC document metadata. File bytes remain in private Storage.';
comment on table public.marketplace_config_versions is
  'Immutable-in-practice Marketplace configuration snapshots; publication is serialized.';
comment on table public.marketplace_score_weight_rules is
  'Versioned score-weight slots. PR 1 intentionally seeds no score formula.';
