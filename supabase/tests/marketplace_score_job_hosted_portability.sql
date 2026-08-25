-- Hosted Supabase portability and authority boundaries for the Score/Tier job.
-- Run after `npm run supabase:reset`; every fixture and temporary grant rolls back.
begin;

do $$
declare
  internal_job regprocedure :=
    'private.run_marketplace_score_tier_job_internal(date,text,uuid,text)'::regprocedure;
  internal_recalculation regprocedure :=
    'private.recalculate_partner_score_tier_internal(uuid,date,text,text)'::regprocedure;
  cron_command text;
begin
  if has_function_privilege('anon', internal_job, 'EXECUTE')
    or has_function_privilege('authenticated', internal_job, 'EXECUTE')
    or has_function_privilege('anon', internal_recalculation, 'EXECUTE')
    or has_function_privilege('authenticated', internal_recalculation, 'EXECUTE')
  then
    raise exception 'Internal Score/Tier executors are exposed to runtime roles';
  end if;

  if position('session_user' in pg_get_functiondef(internal_job::oid)) > 0
    or position('session_user' in pg_get_functiondef(internal_recalculation::oid)) > 0
  then
    raise exception 'Internal execution still depends on infrastructure role names';
  end if;

  if (select count(*) from cron.job
      where jobname = 'best-round-marketplace-score-tiers-daily') <> 1
  then
    raise exception 'Expected exactly one Marketplace Score/Tier cron schedule';
  end if;

  select command into strict cron_command
  from cron.job
  where jobname = 'best-round-marketplace-score-tiers-daily'
    and schedule = '15 5 * * *';

  if position('private.run_marketplace_score_tier_job_internal' in cron_command) = 0
    or position('now() at time zone ''UTC''' in cron_command) = 0
  then
    raise exception 'Cron must use the private executor and a UTC calculation date';
  end if;
end;
$$;

-- Bootstrap is a safe, idempotent no-op when no Partner has ever been VERIFIED.
select private.run_marketplace_score_tier_job_internal(
  current_date,
  'portable-no-verified-partners',
  null,
  'No verified Partners bootstrap regression'
);
select private.run_marketplace_score_tier_job_internal(
  current_date,
  'portable-no-verified-partners',
  null,
  'No verified Partners bootstrap regression'
);
do $$
begin
  if (select count(*) from public.marketplace_score_job_runs
      where job_key = 'portable-no-verified-partners') <> 1
    or (select processed_partners from public.marketplace_score_job_runs
        where job_key = 'portable-no-verified-partners') <> 0
  then
    raise exception 'Empty bootstrap must complete once without processing Partners';
  end if;
end;
$$;

-- Runtime callers cannot use the internal executor or bypass the public wrapper.
set local role anon;
do $$
begin
  begin
    perform public.run_marketplace_score_tier_job(
      current_date,
      'portable-anon-denied',
      null,
      'Anonymous invocation must be denied'
    );
    raise exception 'Anonymous caller executed the public Score/Tier job';
  exception when insufficient_privilege then null;
  end;

  begin
    perform private.run_marketplace_score_tier_job_internal(
      current_date,
      'portable-anon-internal-denied',
      null,
      'Anonymous internal invocation must be denied'
    );
    raise exception 'Anonymous caller executed the internal Score/Tier job';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('7a000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
   'hosted-partner@example.test', '{}', '{}', now(), now()),
  ('7a000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
   'hosted-golfer@example.test', '{}', '{}', now(), now()),
  ('7a000000-0000-4000-8000-000000000003', 'authenticated', 'authenticated',
   'hosted-operator@example.test', '{}', '{}', now(), now()),
  ('7a000000-0000-4000-8000-000000000004', 'authenticated', 'authenticated',
   'hosted-admin@example.test', '{}', '{}', now(), now());

insert into public.user_roles (user_id, role_id)
select '7a000000-0000-4000-8000-000000000003'::uuid, id
from public.roles where name = 'operator'
union all
select '7a000000-0000-4000-8000-000000000004'::uuid, id
from public.roles where name = 'admin';

insert into public.partner_profiles (
  id, user_id, legal_type, status, verified_at
) values (
  '7b000000-0000-4000-8000-000000000001',
  '7a000000-0000-4000-8000-000000000001',
  'INDIVIDUAL',
  'VERIFIED',
  now()
);

insert into public.partner_status_history (
  partner_id, from_status, to_status, actor_id, reason, version
) values (
  '7b000000-0000-4000-8000-000000000001',
  'UNDER_REVIEW',
  'VERIFIED',
  '7a000000-0000-4000-8000-000000000003',
  'Hosted portability fixture verified',
  1
);

-- Partner and ordinary authenticated Golfer both fail the capability guard.
select set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000001', true);
set local role authenticated;
do $$
begin
  begin
    perform public.run_marketplace_score_tier_job(
      current_date,
      'portable-partner-denied',
      null,
      'Partner invocation must be denied'
    );
    raise exception 'Partner executed the public Score/Tier job';
  exception when insufficient_privilege then null;
  end;

  begin
    perform private.run_marketplace_score_tier_job_internal(
      current_date,
      'portable-partner-internal-denied',
      null,
      'Partner internal invocation must be denied'
    );
    raise exception 'Partner executed the internal Score/Tier job';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

select set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000002', true);
set local role authenticated;
do $$
begin
  begin
    perform public.run_marketplace_score_tier_job(
      current_date,
      'portable-golfer-denied',
      null,
      'Golfer invocation must be denied'
    );
    raise exception 'Golfer executed the public Score/Tier job';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

-- The authorized public wrapper remains compatible for Operations and Admin.
select set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000003', true);
set local role authenticated;
select public.run_marketplace_score_tier_job(
  current_date,
  'portable-operator-run',
  '7b000000-0000-4000-8000-000000000001',
  'Authorized Operations portability regression'
);
reset role;

select set_config('request.jwt.claim.sub', '7a000000-0000-4000-8000-000000000004', true);
set local role authenticated;
select public.run_marketplace_score_tier_job(
  current_date,
  'portable-admin-run',
  '7b000000-0000-4000-8000-000000000001',
  'Authorized Admin portability regression'
);
reset role;

-- Reproduce the hosted shape: an infrastructure session identity invokes the
-- SECURITY DEFINER internal executor. The temporary EXECUTE grant models the
-- migration statement; production runtime roles remain revoked above.
create role marketplace_hosted_cli_test noinherit;
grant usage on schema private to marketplace_hosted_cli_test;
grant execute on function private.run_marketplace_score_tier_job_internal(
  date, text, uuid, text
) to marketplace_hosted_cli_test;

select set_config('request.jwt.claim.sub', '', true);
set session authorization marketplace_hosted_cli_test;
select private.run_marketplace_score_tier_job_internal(
  current_date + 1,
  'portable-hosted-bootstrap',
  '7b000000-0000-4000-8000-000000000001',
  'Hosted migration identity bootstrap regression'
);
select private.run_marketplace_score_tier_job_internal(
  current_date + 1,
  'portable-hosted-bootstrap',
  '7b000000-0000-4000-8000-000000000001',
  'Hosted migration identity bootstrap regression'
);
reset session authorization;

do $$
begin
  if (select count(*) from public.marketplace_score_job_runs
      where job_key = 'portable-hosted-bootstrap') <> 1
    or (select count(*) from public.partner_score_snapshots
        where calculation_key =
          'portable-hosted-bootstrap:7b000000-0000-4000-8000-000000000001') <> 1
    or (select count(*) from public.partner_score_tier_state
        where partner_id = '7b000000-0000-4000-8000-000000000001'
          and latest_score_snapshot_id is not null) <> 1
  then
    raise exception 'Hosted bootstrap is not idempotent';
  end if;

  if (select final_score_bps
      from public.partner_score_snapshots
      where calculation_key =
        'portable-hosted-bootstrap:7b000000-0000-4000-8000-000000000001') <> 8000
  then
    raise exception 'Hosted bootstrap did not create the neutral Score baseline';
  end if;
end;
$$;

rollback;
