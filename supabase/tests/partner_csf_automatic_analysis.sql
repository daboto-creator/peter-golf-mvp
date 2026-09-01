begin;

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values (
  '00000000-0000-0000-0000-000000000000',
  '4c000000-0000-4000-8000-000000000001',
  'authenticated', 'authenticated', 'csf.synthetic@example.test',
  extensions.crypt('SyntheticOnly123!', extensions.gen_salt('bf')), now(),
  '', '', '', '', '{"provider":"email","providers":["email"]}', '{}', now(), now()
);

insert into public.partner_profiles (
  id, user_id, legal_type, tax_id, legal_name
) values (
  '4c000000-0000-4000-8000-000000000010',
  '4c000000-0000-4000-8000-000000000001',
  'SOLE_PROPRIETOR', 'TEXA900101AB1', 'ANA PRUEBA SINTETICA'
);

insert into public.partner_documents (
  id, partner_id, document_kind, storage_path, mime_type, size_bytes,
  sha256, uploaded_by
) values (
  '4c000000-0000-4000-8000-000000000020',
  '4c000000-0000-4000-8000-000000000010',
  'fiscal_certificate',
  'partners/4c000000-0000-4000-8000-000000000010/4c000000-0000-4000-8000-000000000020.pdf',
  'application/pdf', 100, repeat('a', 64),
  '4c000000-0000-4000-8000-000000000001'
);

do $$
begin
  if has_function_privilege(
    'authenticated',
    'public.record_automatic_partner_csf_analysis(uuid,uuid,public.automatic_document_review_result,jsonb,text[],jsonb)',
    'EXECUTE'
  ) or has_function_privilege(
    'anon',
    'public.record_automatic_partner_csf_analysis(uuid,uuid,public.automatic_document_review_result,jsonb,text[],jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Public roles must not execute authoritative CSF analysis';
  end if;
  if not has_function_privilege(
    'service_role',
    'public.record_automatic_partner_csf_analysis(uuid,uuid,public.automatic_document_review_result,jsonb,text[],jsonb)',
    'EXECUTE'
  ) then
    raise exception 'Service role must execute authoritative CSF analysis';
  end if;
end;
$$;

set local role service_role;
select set_config('request.jwt.claims', '{"role":"service_role"}', true);

select public.record_automatic_partner_csf_analysis(
  '4c000000-0000-4000-8000-000000000020',
  '4c000000-0000-4000-8000-000000000001',
  'PASSED',
  jsonb_build_object(
    'name', 'ANA PRUEBA SINTETICA',
    'rfc', 'TEXA900101AB1',
    'officialQrDestination',
    'https://siat.sat.gob.mx/app/qr/faces/pages/mobile/validadorqr.jsf?D3=100000_TEXA900101AB1'
  ),
  '{}'::text[],
  '{"qrStatus":"VERIFIED","rfcMatches":true,"nameMatches":true}'::jsonb
);

reset role;

do $$
declare analysis public.partner_document_analyses;
begin
  select * into analysis
  from public.partner_document_analyses
  where document_id = '4c000000-0000-4000-8000-000000000020'
  order by analyzed_at desc, id desc
  limit 1;
  if analysis.result <> 'PASSED'
    or analysis.extracted_rfc <> 'TEXA900101AB1'
    or analysis.analyzed_by <> '4c000000-0000-4000-8000-000000000001'
    or analysis.normalized_output ->> 'qrStatus' <> 'VERIFIED' then
    raise exception 'Authoritative CSF analysis was not persisted correctly';
  end if;
  if (select status from public.partner_profiles
      where id = '4c000000-0000-4000-8000-000000000010') <> 'REGISTERED' then
    raise exception 'Automatic CSF analysis must not verify the Partner';
  end if;
end;
$$;

rollback;
