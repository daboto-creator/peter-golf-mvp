-- PR9 hosted-safe schema, grants, cron and no-money-movement assertions.
begin;

do $$
declare expected_tables text[]:=array[
  'marketplace_payout_batches','marketplace_partner_payouts',
  'marketplace_partner_payout_items','marketplace_partner_payout_holds',
  'marketplace_partner_settlements','marketplace_partner_payout_events',
  'marketplace_payout_job_runs'
]; missing text;
begin
  select string_agg(name,', ') into missing from unnest(expected_tables) name
  where not exists(select 1 from pg_tables where schemaname='public' and tablename=name);
  if missing is not null then raise exception 'PR9 tables missing: %',missing; end if;
  if exists(select 1 from pg_tables where schemaname='public' and tablename=any(expected_tables) and not rowsecurity)
  then raise exception 'PR9 sensitive table lacks RLS'; end if;
  if exists(select 1 from information_schema.role_table_grants where table_schema='public'
    and table_name=any(expected_tables) and grantee in('anon','authenticated')
    and privilege_type in('INSERT','UPDATE','DELETE'))
  then raise exception 'Browser received direct payout mutation grant'; end if;
  if exists(select 1 from information_schema.routine_privileges where specific_schema='private'
    and routine_name in('create_marketplace_payout_internal','attach_marketplace_payable_to_payout_internal',
      'settle_marketplace_partner_payable_internal','run_marketplace_payout_job_internal')
    and grantee in('PUBLIC','anon','authenticated','service_role'))
  then raise exception 'Internal payout executor is externally executable'; end if;
  if (select count(*) from cron.job where jobname='best-round-marketplace-partner-payouts-weekly')<>1
  then raise exception 'Weekly payout cron count is not one'; end if;
  if not exists(select 1 from cron.job where jobname='best-round-marketplace-partner-payouts-weekly'
    and schedule='0 6 * * 1' and command like '%private.run_marketplace_payout_job_internal%')
  then raise exception 'Weekly payout cron target or schedule invalid'; end if;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname like '%marketplace%payout%'
      and not coalesce(array_to_string(p.proconfig,','),'') like 'search_path=%')
  then raise exception 'Private payout executor lacks safe search_path'; end if;
  if pg_get_functiondef('private.run_marketplace_payout_job_internal(date,text)'::regprocedure)
      ~* 'auth\.uid|session_user|cli_login_postgres|supabase_admin'
  then raise exception 'Hosted payout job depends on runtime/infrastructure identity'; end if;
  if pg_get_functiondef('public.record_marketplace_manual_transfer(uuid,date,text,text,bigint,text,uuid)'::regprocedure)
      ~* 'stripe|transfer[s]?\.create|bank.*api'
  then raise exception 'Manual provider contains an external money movement path'; end if;
  if not exists(select 1 from information_schema.columns where table_schema='public'
    and table_name='marketplace_partner_payables' and column_name='paid_amount_cents')
  then raise exception 'PR7 payable is not settlement-ready'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform 1 from public.marketplace_partner_payouts;
    raise exception 'Anonymous read payouts';
  exception when insufficient_privilege then null; end;
  begin perform public.get_partner_marketplace_payouts();
    raise exception 'Anonymous invoked payout DTO';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
