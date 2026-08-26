-- PR8 delivery acceptance, claims, financial integration and hosted security.
begin;

do $$
declare expected_tables text[]:=array[
  'marketplace_delivery_acceptances','marketplace_claims','marketplace_claim_events',
  'marketplace_claim_resolutions','marketplace_claim_evidence','marketplace_returns',
  'marketplace_return_events','marketplace_acceptance_job_runs'
]; missing text;
begin
  select string_agg(t,', ') into missing from unnest(expected_tables)t
  where not exists(select 1 from pg_tables where schemaname='public' and tablename=t);
  if missing is not null then raise exception 'PR8 tables missing: %',missing; end if;
  if exists(select 1 from pg_tables t where t.schemaname='public' and t.tablename=any(expected_tables)
    and not t.rowsecurity) then raise exception 'PR8 sensitive table lacks RLS'; end if;
  if exists(select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name=any(expected_tables)
      and grantee in('anon','authenticated') and privilege_type in('INSERT','UPDATE','DELETE'))
  then raise exception 'Browser role received direct PR8 mutation grant'; end if;
  if exists(select 1 from information_schema.routine_privileges
    where specific_schema='private' and routine_name in(
      'accept_marketplace_delivery_internal','place_marketplace_claim_hold_internal',
      'release_marketplace_claim_hold_internal','release_marketplace_partner_payable_internal',
      'run_marketplace_acceptance_job_internal')
      and grantee in('PUBLIC','anon','authenticated','service_role'))
  then raise exception 'Internal PR8 executor is externally executable'; end if;
  if to_regprocedure('public.transition_marketplace_return(uuid,public.marketplace_return_status,text,text,text,text,uuid)') is null
    or to_regprocedure('public.set_marketplace_claim_evidence_partner_visibility(uuid,boolean,text,uuid)') is null
  then raise exception 'Audited return/evidence Operations RPC missing'; end if;
  if has_function_privilege('anon','public.transition_marketplace_return(uuid,public.marketplace_return_status,text,text,text,text,uuid)','EXECUTE')
    or has_function_privilege('anon','public.set_marketplace_claim_evidence_partner_visibility(uuid,boolean,text,uuid)','EXECUTE')
  then raise exception 'Anonymous can execute protected return/evidence RPC'; end if;
  if pg_get_functiondef('private.sync_order_from_marketplace_fulfillments()'::regprocedure)
      not like '%confirmed_by=case when next_status=%'
  then raise exception 'Marketplace order aggregate confirmation audit fix missing'; end if;
  if (select count(*) from cron.job where jobname='best-round-marketplace-delivery-auto-accept-hourly')<>1
    then raise exception 'Auto-accept cron count is not one'; end if;
  if not exists(select 1 from cron.job where jobname='best-round-marketplace-delivery-auto-accept-hourly'
    and schedule='0 * * * *' and command like '%private.run_marketplace_acceptance_job_internal%')
    then raise exception 'Auto-accept cron target or schedule invalid'; end if;
  if not exists(select 1 from storage.buckets where id='marketplace-claim-evidence'
    and not public and file_size_limit=10485760
    and allowed_mime_types @> array['image/jpeg','image/png','image/webp'])
    then raise exception 'Private claim evidence bucket is invalid'; end if;
  if exists(select 1 from public.marketplace_operational_rules where acceptance_window_hours<>48)
    then raise exception 'Versioned 48-hour acceptance baseline missing'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname like '%marketplace%claim%'
      and not coalesce(array_to_string(p.proconfig,','),'') like 'search_path=%')
    then raise exception 'Private claim executor lacks empty search_path'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform 1 from public.marketplace_claims;
    raise exception 'Anonymous read Marketplace claims';
  exception when insufficient_privilege then null; end;
  begin perform public.run_marketplace_acceptance_job(now(),'anon-forbidden');
    raise exception 'Anonymous ran acceptance job';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- The hosted cron/internal path must not rely on auth.uid or session_user names.
do $$ begin
  if pg_get_functiondef('private.run_marketplace_acceptance_job_internal(timestamptz,text)'::regprocedure)
      ~* 'auth\.uid|session_user|cli_login_postgres|supabase_admin'
  then raise exception 'Hosted internal job depends on runtime/infrastructure identity'; end if;
  if pg_get_functiondef('private.accept_marketplace_delivery_internal(uuid,public.marketplace_acceptance_status,uuid,uuid)'::regprocedure)
      ~* 'auth\.uid|session_user|cli_login_postgres|supabase_admin'
  then raise exception 'Internal acceptance depends on runtime/infrastructure identity'; end if;
end $$;

rollback;
