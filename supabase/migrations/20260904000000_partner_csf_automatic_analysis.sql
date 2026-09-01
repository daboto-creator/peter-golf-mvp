-- Server-authoritative CSF analysis persistence. Partners retain read-only access
-- to their analysis summary and cannot manufacture automatic PASSED results.

create function public.record_automatic_partner_csf_analysis(
  requested_document_id uuid,
  requested_actor_id uuid,
  requested_result public.automatic_document_review_result,
  requested_extracted jsonb,
  requested_warning_codes text[],
  requested_normalized_output jsonb
) returns public.partner_document_analyses
language plpgsql
security definer
set search_path = ''
as $$
declare
  document_record public.partner_documents;
  partner_user_id uuid;
  result public.partner_document_analyses;
  qr_destination text;
begin
  if (select auth.role()) <> 'service_role' then
    raise exception 'Automatic CSF analysis access denied' using errcode = '42501';
  end if;
  if jsonb_typeof(requested_extracted) <> 'object'
    or jsonb_typeof(requested_normalized_output) <> 'object'
    or coalesce(cardinality(requested_warning_codes), 0) > 20
    or exists (
      select 1 from unnest(coalesce(requested_warning_codes, '{}'::text[])) code
      where code !~ '^[A-Z0-9_]{1,80}$'
    ) then
    raise exception 'Automatic CSF analysis input invalid' using errcode = '22023';
  end if;

  select d.* into document_record
  from public.partner_documents d
  where d.id = requested_document_id;
  if not found or document_record.document_kind <> 'fiscal_certificate' then
    raise exception 'Automatic CSF analysis target invalid' using errcode = '42501';
  end if;
  select p.user_id into partner_user_id
  from public.partner_profiles p
  where p.id = document_record.partner_id;
  if partner_user_id is distinct from requested_actor_id then
    raise exception 'Automatic CSF analysis target invalid' using errcode = '42501';
  end if;

  qr_destination := nullif(requested_extracted ->> 'officialQrDestination', '');
  if qr_destination is not null and qr_destination !~
    '^https://siat\.sat\.gob\.mx/app/qr/faces/pages/mobile/validadorqr\.jsf\?' then
    raise exception 'Automatic CSF analysis QR destination invalid' using errcode = '22023';
  end if;

  insert into public.partner_document_analyses (
    document_id,
    analysis_version,
    result,
    extracted_document_type,
    extracted_name,
    extracted_rfc,
    official_qr_destination,
    normalized_output,
    warning_codes,
    analyzed_by,
    analyzed_at
  ) values (
    requested_document_id,
    'csf-rules-v1',
    requested_result,
    'fiscal_certificate',
    nullif(left(requested_extracted ->> 'name', 240), ''),
    nullif(left(upper(requested_extracted ->> 'rfc'), 20), ''),
    qr_destination,
    requested_normalized_output,
    coalesce(requested_warning_codes, '{}'::text[]),
    requested_actor_id,
    clock_timestamp()
  ) returning * into result;

  return result;
end;
$$;

revoke all on function public.record_automatic_partner_csf_analysis(
  uuid,
  uuid,
  public.automatic_document_review_result,
  jsonb,
  text[],
  jsonb
) from public, anon, authenticated;

grant execute on function public.record_automatic_partner_csf_analysis(
  uuid,
  uuid,
  public.automatic_document_review_result,
  jsonb,
  text[],
  jsonb
) to service_role;
