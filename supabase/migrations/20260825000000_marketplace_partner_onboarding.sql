-- Partner onboarding and Operations review on top of Marketplace Foundation.
-- No listings, marketplace inventory, pricing, checkout, ledger or payouts.

alter table public.partner_profiles
  add column onboarding_step smallint not null default 1,
  add column first_name text,
  add column last_name text,
  add column phone text,
  add column country_code character(2),
  add column state text,
  add column city text,
  add column commercial_name text,
  add column legal_name text,
  add column representative_name text,
  add column tax_id text,
  add column fiscal_address_line_1 text,
  add column fiscal_address_line_2 text,
  add column fiscal_city text,
  add column fiscal_state text,
  add column fiscal_postal_code text,
  add column submitted_at timestamptz,
  add constraint partner_profiles_onboarding_step_range
    check (onboarding_step between 1 and 5),
  add constraint partner_profiles_first_name_length
    check (first_name is null or char_length(first_name) between 1 and 80),
  add constraint partner_profiles_last_name_length
    check (last_name is null or char_length(last_name) between 1 and 80),
  add constraint partner_profiles_phone_length
    check (phone is null or char_length(phone) between 7 and 30),
  add constraint partner_profiles_country_code_format
    check (country_code is null or country_code ~ '^[A-Z]{2}$'),
  add constraint partner_profiles_state_length
    check (state is null or char_length(state) between 2 and 100),
  add constraint partner_profiles_city_length
    check (city is null or char_length(city) between 2 and 100),
  add constraint partner_profiles_commercial_name_length
    check (
      commercial_name is null
      or char_length(commercial_name) between 2 and 160
    ),
  add constraint partner_profiles_legal_name_length
    check (legal_name is null or char_length(legal_name) between 2 and 200),
  add constraint partner_profiles_representative_name_length
    check (
      representative_name is null
      or char_length(representative_name) between 2 and 160
    ),
  add constraint partner_profiles_tax_id_format
    check (tax_id is null or tax_id ~ '^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
  add constraint partner_profiles_fiscal_address_length
    check (
      fiscal_address_line_1 is null
      or char_length(fiscal_address_line_1) between 5 and 200
    ),
  add constraint partner_profiles_fiscal_address_line_2_length
    check (
      fiscal_address_line_2 is null
      or char_length(fiscal_address_line_2) between 1 and 120
    ),
  add constraint partner_profiles_fiscal_city_length
    check (fiscal_city is null or char_length(fiscal_city) between 2 and 100),
  add constraint partner_profiles_fiscal_state_length
    check (
      fiscal_state is null or char_length(fiscal_state) between 2 and 100
    ),
  add constraint partner_profiles_fiscal_postal_code_format
    check (
      fiscal_postal_code is null or fiscal_postal_code ~ '^[0-9]{5}$'
    );

alter table public.partner_documents
  add column version integer not null default 1,
  add constraint partner_documents_version_positive check (version > 0);

create index partner_profiles_updated_at_idx
  on public.partner_profiles (updated_at desc, id);

create index partner_documents_review_queue_idx
  on public.partner_documents (status, updated_at, id);

create or replace function private.partner_basic_information_complete(
  partner_record public.partner_profiles
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case partner_record.legal_type
    when 'LEGAL_ENTITY' then
      partner_record.commercial_name is not null
      and partner_record.representative_name is not null
      and partner_record.phone is not null
      and partner_record.country_code is not null
      and partner_record.state is not null
      and partner_record.city is not null
    else
      partner_record.first_name is not null
      and partner_record.last_name is not null
      and partner_record.phone is not null
      and partner_record.country_code is not null
      and partner_record.state is not null
      and partner_record.city is not null
  end;
$$;

create or replace function private.partner_fiscal_information_complete(
  partner_record public.partner_profiles
)
returns boolean
language sql
stable
set search_path = ''
as $$
  select case partner_record.legal_type
    when 'INDIVIDUAL' then true
    when 'SOLE_PROPRIETOR' then
      partner_record.tax_id is not null
      and partner_record.fiscal_address_line_1 is not null
      and partner_record.fiscal_city is not null
      and partner_record.fiscal_state is not null
      and partner_record.fiscal_postal_code is not null
    when 'LEGAL_ENTITY' then
      partner_record.tax_id is not null
      and partner_record.legal_name is not null
      and partner_record.fiscal_address_line_1 is not null
      and partner_record.fiscal_city is not null
      and partner_record.fiscal_state is not null
      and partner_record.fiscal_postal_code is not null
  end;
$$;

create or replace function public.get_partner_onboarding_readiness(
  requested_partner_id uuid default null
)
returns table (
  basic_complete boolean,
  fiscal_complete boolean,
  documents_complete boolean,
  review_ready boolean,
  active_document_count bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  partner_record public.partner_profiles;
  document_count bigint;
begin
  select * into partner_record
  from public.partner_profiles
  where id = coalesce(
    requested_partner_id,
    (
      select partner_profiles.id
      from public.partner_profiles
      where partner_profiles.user_id = (select auth.uid())
    )
  );

  if not found then
    raise exception 'Partner unavailable' using errcode = 'P0002';
  end if;

  if partner_record.user_id <> (select auth.uid())
    and not public.can_manage_marketplace_partners()
  then
    raise exception 'Marketplace Partner access denied' using errcode = '42501';
  end if;

  select count(*) into document_count
  from public.partner_documents
  where partner_id = partner_record.id
    and status <> 'REJECTED';

  return query select
    private.partner_basic_information_complete(partner_record),
    private.partner_fiscal_information_complete(partner_record),
    document_count > 0,
    private.partner_basic_information_complete(partner_record)
      and private.partner_fiscal_information_complete(partner_record)
      and document_count > 0,
    document_count;
end;
$$;

create or replace function public.save_partner_onboarding(
  requested_section text,
  expected_version integer,
  requested_payload jsonb
)
returns public.partner_profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  partner_record public.partner_profiles;
  allowed_keys text[];
  new_status public.partner_status;
begin
  if current_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not public.is_marketplace_enabled() then
    raise exception 'Marketplace is disabled' using errcode = '42501';
  end if;

  if jsonb_typeof(requested_payload) <> 'object' then
    raise exception 'Invalid onboarding payload' using errcode = '22023';
  end if;

  select * into partner_record
  from public.partner_profiles
  where user_id = current_user_id
  for update;

  if not found then
    raise exception 'Partner unavailable' using errcode = 'P0002';
  end if;

  if partner_record.version <> expected_version then
    raise exception 'Partner version conflict' using errcode = '40001';
  end if;

  if partner_record.status not in ('REGISTERED', 'IDENTITY_PENDING') then
    raise exception 'Partner onboarding is read only' using errcode = '23514';
  end if;

  case requested_section
    when 'legal_type' then
      allowed_keys := array['legalType'];
      if not requested_payload ? 'legalType' then
        raise exception 'Legal type is required' using errcode = '22023';
      end if;

      begin
        partner_record.legal_type :=
          (requested_payload ->> 'legalType')::public.partner_legal_type;
      exception when invalid_text_representation then
        raise exception 'Invalid legal type' using errcode = '22023';
      end;

      partner_record.onboarding_step := greatest(partner_record.onboarding_step, 2);

    when 'basic' then
      allowed_keys := array[
        'firstName', 'lastName', 'phone', 'countryCode', 'state', 'city',
        'commercialName', 'representativeName'
      ];

      partner_record.first_name :=
        nullif(btrim(requested_payload ->> 'firstName'), '');
      partner_record.last_name :=
        nullif(btrim(requested_payload ->> 'lastName'), '');
      partner_record.phone := nullif(btrim(requested_payload ->> 'phone'), '');
      partner_record.country_code :=
        nullif(upper(btrim(requested_payload ->> 'countryCode')), '');
      partner_record.state := nullif(btrim(requested_payload ->> 'state'), '');
      partner_record.city := nullif(btrim(requested_payload ->> 'city'), '');
      partner_record.commercial_name :=
        nullif(btrim(requested_payload ->> 'commercialName'), '');
      partner_record.representative_name :=
        nullif(btrim(requested_payload ->> 'representativeName'), '');
      partner_record.onboarding_step := greatest(partner_record.onboarding_step, 3);

      if not private.partner_basic_information_complete(partner_record) then
        raise exception 'Basic Partner information is incomplete'
          using errcode = '22023';
      end if;

    when 'fiscal' then
      allowed_keys := array[
        'taxId', 'legalName', 'fiscalAddressLine1', 'fiscalAddressLine2',
        'fiscalCity', 'fiscalState', 'fiscalPostalCode'
      ];

      partner_record.tax_id :=
        nullif(upper(btrim(requested_payload ->> 'taxId')), '');
      partner_record.legal_name :=
        nullif(btrim(requested_payload ->> 'legalName'), '');
      partner_record.fiscal_address_line_1 :=
        nullif(btrim(requested_payload ->> 'fiscalAddressLine1'), '');
      partner_record.fiscal_address_line_2 :=
        nullif(btrim(requested_payload ->> 'fiscalAddressLine2'), '');
      partner_record.fiscal_city :=
        nullif(btrim(requested_payload ->> 'fiscalCity'), '');
      partner_record.fiscal_state :=
        nullif(btrim(requested_payload ->> 'fiscalState'), '');
      partner_record.fiscal_postal_code :=
        nullif(btrim(requested_payload ->> 'fiscalPostalCode'), '');
      partner_record.onboarding_step := greatest(partner_record.onboarding_step, 4);

      if not private.partner_fiscal_information_complete(partner_record) then
        raise exception 'Fiscal Partner information is incomplete'
          using errcode = '22023';
      end if;

    when 'documents' then
      allowed_keys := array[]::text[];
      if not exists (
        select 1 from public.partner_documents
        where partner_id = partner_record.id and status <> 'REJECTED'
      ) then
        raise exception 'At least one current Partner document is required'
          using errcode = '23514';
      end if;
      partner_record.onboarding_step := 5;

    else
      raise exception 'Invalid onboarding section' using errcode = '22023';
  end case;

  if requested_payload - allowed_keys <> '{}'::jsonb then
    raise exception 'Unexpected onboarding fields' using errcode = '22023';
  end if;

  new_status := case
    when requested_section = 'basic' and partner_record.status = 'REGISTERED'
      then 'IDENTITY_PENDING'::public.partner_status
    else partner_record.status
  end;

  perform set_config(
    'app.marketplace_reason',
    case
      when new_status <> partner_record.status then 'Partner onboarding started'
      else 'Partner onboarding progress saved'
    end,
    true
  );

  update public.partner_profiles
  set legal_type = partner_record.legal_type,
      status = new_status,
      onboarding_step = partner_record.onboarding_step,
      first_name = partner_record.first_name,
      last_name = partner_record.last_name,
      phone = partner_record.phone,
      country_code = partner_record.country_code,
      state = partner_record.state,
      city = partner_record.city,
      commercial_name = partner_record.commercial_name,
      legal_name = partner_record.legal_name,
      representative_name = partner_record.representative_name,
      tax_id = partner_record.tax_id,
      fiscal_address_line_1 = partner_record.fiscal_address_line_1,
      fiscal_address_line_2 = partner_record.fiscal_address_line_2,
      fiscal_city = partner_record.fiscal_city,
      fiscal_state = partner_record.fiscal_state,
      fiscal_postal_code = partner_record.fiscal_postal_code,
      version = version + 1
  where id = partner_record.id
  returning * into partner_record;

  perform private.write_marketplace_audit(
    'marketplace.partner_onboarding_saved',
    'partner_profile',
    partner_record.id,
    null,
    null,
    jsonb_build_object(
      'section', requested_section,
      'version', partner_record.version,
      'onboarding_step', partner_record.onboarding_step
    )
  );

  return partner_record;
end;
$$;

create or replace function public.register_partner_document(
  requested_document_id uuid,
  requested_document_kind text,
  requested_storage_path text,
  requested_mime_type text,
  requested_size_bytes bigint,
  requested_sha256 text
)
returns public.partner_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
  partner_record public.partner_profiles;
  document_record public.partner_documents;
begin
  if current_user_id is null or not public.is_marketplace_enabled() then
    raise exception 'Marketplace document access denied' using errcode = '42501';
  end if;

  select * into partner_record
  from public.partner_profiles
  where user_id = current_user_id
  for share;

  if not found then
    raise exception 'Partner unavailable' using errcode = 'P0002';
  end if;

  if partner_record.status not in ('REGISTERED', 'IDENTITY_PENDING') then
    raise exception 'Partner documents are read only' using errcode = '23514';
  end if;

  if requested_storage_path !~ (
    '^partners/' || partner_record.id::text || '/' || requested_document_id::text
      || '\.(pdf|jpg|jpeg|png|webp)$'
  ) then
    raise exception 'Invalid Partner document path' using errcode = '22023';
  end if;

  insert into public.partner_documents (
    id, partner_id, document_kind, storage_path, mime_type, size_bytes,
    sha256, uploaded_by
  ) values (
    requested_document_id, partner_record.id, requested_document_kind,
    requested_storage_path, requested_mime_type, requested_size_bytes,
    requested_sha256, current_user_id
  )
  returning * into document_record;

  return document_record;
end;
$$;

create or replace function public.submit_partner_for_review(
  expected_version integer
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
  if current_user_id is null or not public.is_marketplace_enabled() then
    raise exception 'Marketplace access denied' using errcode = '42501';
  end if;

  select * into partner_record
  from public.partner_profiles
  where user_id = current_user_id
  for update;

  if not found then
    raise exception 'Partner unavailable' using errcode = 'P0002';
  end if;

  if partner_record.version <> expected_version then
    raise exception 'Partner version conflict' using errcode = '40001';
  end if;

  if partner_record.status <> 'IDENTITY_PENDING' then
    raise exception 'Partner is not ready to submit' using errcode = '23514';
  end if;

  if not private.partner_basic_information_complete(partner_record)
    or not private.partner_fiscal_information_complete(partner_record)
    or not exists (
      select 1 from public.partner_documents
      where partner_id = partner_record.id and status <> 'REJECTED'
    )
  then
    raise exception 'Partner onboarding is incomplete' using errcode = '23514';
  end if;

  perform set_config(
    'app.marketplace_reason',
    'Partner submitted onboarding for review',
    true
  );

  update public.partner_profiles
  set status = 'UNDER_REVIEW',
      onboarding_step = 5,
      submitted_at = now(),
      version = version + 1
  where id = partner_record.id
  returning * into partner_record;

  return partner_record;
end;
$$;

create or replace function private.audit_partner_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  change_reason text := nullif(current_setting('app.marketplace_reason', true), '');
begin
  if tg_op = 'INSERT' then
    perform private.write_marketplace_audit(
      'marketplace.partner_document_uploaded',
      'partner_document',
      new.id,
      null,
      null,
      jsonb_build_object(
        'partner_id', new.partner_id,
        'document_kind', new.document_kind,
        'status', new.status,
        'version', new.version
      )
    );
  elsif old.status is distinct from new.status then
    perform private.write_marketplace_audit(
      'marketplace.partner_document_reviewed',
      'partner_document',
      new.id,
      change_reason,
      jsonb_build_object('status', old.status, 'version', old.version),
      jsonb_build_object('status', new.status, 'version', new.version)
    );
  end if;

  return new;
end;
$$;

create trigger partner_documents_write_audit
after insert or update on public.partner_documents
for each row execute function private.audit_partner_document_change();

create or replace function public.review_partner_document(
  requested_document_id uuid,
  expected_version integer,
  requested_status public.partner_document_status,
  requested_reason text
)
returns public.partner_documents
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_record public.partner_documents;
  reason_value text := btrim(requested_reason);
begin
  if not public.can_review_partner_documents() then
    raise exception 'Partner document review denied' using errcode = '42501';
  end if;

  if requested_status not in ('UNDER_REVIEW', 'VERIFIED', 'REJECTED') then
    raise exception 'Invalid Partner document status' using errcode = '22023';
  end if;

  if char_length(reason_value) not between 3 and 500 then
    raise exception 'A reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select * into document_record
  from public.partner_documents
  where id = requested_document_id
  for update;

  if not found then
    raise exception 'Partner document unavailable' using errcode = 'P0002';
  end if;

  if document_record.version <> expected_version then
    raise exception 'Partner document version conflict' using errcode = '40001';
  end if;

  if not exists (
    select 1 from public.partner_profiles
    where id = document_record.partner_id and status = 'UNDER_REVIEW'
  ) then
    raise exception 'Partner is not under review' using errcode = '23514';
  end if;

  if document_record.status = requested_status then
    raise exception 'Partner document already has requested status'
      using errcode = '22023';
  end if;

  perform set_config('app.marketplace_reason', reason_value, true);

  update public.partner_documents
  set status = requested_status,
      reviewed_by = (select auth.uid()),
      reviewed_at = now(),
      review_reason = reason_value,
      version = version + 1
  where id = requested_document_id
  returning * into document_record;

  return document_record;
end;
$$;

revoke all on function private.partner_basic_information_complete(
  public.partner_profiles
) from public, anon, authenticated;
revoke all on function private.partner_fiscal_information_complete(
  public.partner_profiles
) from public, anon, authenticated;
revoke all on function private.audit_partner_document_change()
  from public, anon, authenticated;

revoke all on function public.get_partner_onboarding_readiness(uuid)
  from public, anon;
revoke all on function public.save_partner_onboarding(text, integer, jsonb)
  from public, anon;
revoke all on function public.register_partner_document(
  uuid, text, text, text, bigint, text
) from public, anon;
revoke all on function public.submit_partner_for_review(integer)
  from public, anon;
revoke all on function public.review_partner_document(
  uuid, integer, public.partner_document_status, text
) from public, anon;

grant execute on function public.get_partner_onboarding_readiness(uuid)
  to authenticated;
grant execute on function public.save_partner_onboarding(text, integer, jsonb)
  to authenticated;
grant execute on function public.register_partner_document(
  uuid, text, text, text, bigint, text
) to authenticated;
grant execute on function public.submit_partner_for_review(integer)
  to authenticated;
grant execute on function public.review_partner_document(
  uuid, integer, public.partner_document_status, text
) to authenticated;

comment on column public.partner_profiles.onboarding_step is
  'Last completed progressive onboarding step; status remains authoritative.';
comment on column public.partner_profiles.tax_id is
  'Private Partner fiscal identifier. Never include in logs or public output.';
comment on column public.partner_profiles.submitted_at is
  'Most recent human-review submission timestamp.';
comment on column public.partner_documents.version is
  'Optimistic concurrency version for Operations document review.';
