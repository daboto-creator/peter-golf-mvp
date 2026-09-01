-- Service-role persistence for deterministic analysis of CSF and address proofs.
create or replace function public.record_automatic_partner_document_analysis(
  requested_document_id uuid,
  requested_actor_id uuid,
  requested_analysis_version text,
  requested_result public.automatic_document_review_result,
  requested_extracted jsonb,
  requested_warning_codes text[],
  requested_normalized_output jsonb
) returns public.partner_document_analyses
language plpgsql security definer set search_path = '' as $$
declare d public.partner_documents; owner_id uuid; out_row public.partner_document_analyses;
begin
  if (select auth.role()) <> 'service_role' then raise exception 'Automatic document analysis access denied' using errcode='42501'; end if;
  if jsonb_typeof(requested_extracted) <> 'object' or jsonb_typeof(requested_normalized_output) <> 'object'
     or requested_analysis_version !~ '^[a-z0-9-]{3,40}$' or coalesce(cardinality(requested_warning_codes),0)>30
     or exists(select 1 from unnest(coalesce(requested_warning_codes,'{}'::text[])) c where c !~ '^[A-Z0-9_]{1,80}$') then
    raise exception 'Automatic document analysis input invalid' using errcode='22023';
  end if;
  select * into d from public.partner_documents where id=requested_document_id;
  if not found or d.document_kind not in ('fiscal_certificate','address_proof','company_address_proof') then raise exception 'Automatic document analysis target invalid' using errcode='42501'; end if;
  select user_id into owner_id from public.partner_profiles where id=d.partner_id;
  if owner_id is distinct from requested_actor_id then raise exception 'Automatic document analysis target invalid' using errcode='42501'; end if;
  insert into public.partner_document_analyses(document_id,analysis_version,result,extracted_document_type,extracted_name,extracted_address,extracted_document_date,extracted_rfc,official_qr_destination,normalized_output,warning_codes,analyzed_by,analyzed_at)
  values(requested_document_id,requested_analysis_version,requested_result,nullif(left(requested_extracted->>'documentType',80),''),nullif(left(requested_extracted->>'name',240),''),nullif(left(requested_extracted->>'address',500),''),(requested_extracted->>'documentDate')::date,nullif(left(upper(requested_extracted->>'rfc'),20),''),nullif(requested_extracted->>'officialQrDestination',''),requested_normalized_output,coalesce(requested_warning_codes,'{}'),requested_actor_id,clock_timestamp()) returning * into out_row;
  return out_row;
end; $$;
revoke all on function public.record_automatic_partner_document_analysis(uuid,uuid,text,public.automatic_document_review_result,jsonb,text[],jsonb) from public,anon,authenticated;
grant execute on function public.record_automatic_partner_document_analysis(uuid,uuid,text,public.automatic_document_review_result,jsonb,text[],jsonb) to service_role;
