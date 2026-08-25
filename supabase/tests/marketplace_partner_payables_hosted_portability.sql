-- Hosted Supabase migration identity regression for PR7 internal bootstrap.
-- Run as local supabase_admin; every temporary role/grant rolls back.
begin;

do $$
declare executor regprocedure :=
  'private.create_marketplace_partner_payables_internal(uuid,uuid,text)'::regprocedure;
begin
  if has_function_privilege('anon',executor,'EXECUTE')
    or has_function_privilege('authenticated',executor,'EXECUTE')
    or has_function_privilege('service_role',executor,'EXECUTE')
  then raise exception 'PR7 internal payable executor is exposed'; end if;
  if position('session_user' in pg_get_functiondef(executor::oid))>0
    or position('auth.uid()' in pg_get_functiondef(executor::oid))>0
  then raise exception 'PR7 bootstrap depends on runtime or infrastructure identity'; end if;
end $$;

create role marketplace_payables_hosted_cli_test noinherit;
grant usage on schema private to marketplace_payables_hosted_cli_test;
grant execute on function private.create_marketplace_partner_payables_internal(
  uuid,uuid,text
) to marketplace_payables_hosted_cli_test;

set session authorization marketplace_payables_hosted_cli_test;
do $$ begin
  if private.create_marketplace_partner_payables_internal(
    '72000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000002',
    'hosted-cli-no-op'
  )<>0 then raise exception 'Hosted no-op bootstrap returned unexpected rows'; end if;
end $$;
reset session authorization;

rollback;
