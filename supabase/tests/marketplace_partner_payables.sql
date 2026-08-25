-- PR7 schema, grants, immutable ledger and hosted-safe internal authority.
begin;

do $$ begin
  if not exists(select 1 from pg_tables where schemaname='public'
    and tablename='marketplace_partner_payables')
    or not exists(select 1 from pg_tables where schemaname='public'
      and tablename='marketplace_partner_ledger_entries')
    or not exists(select 1 from pg_tables where schemaname='public'
      and tablename='marketplace_partner_holds')
  then raise exception 'PR7 financial tables are incomplete'; end if;
  if exists(select 1 from information_schema.role_table_grants
    where table_schema='public'
      and table_name in ('marketplace_partner_payables','marketplace_partner_ledger_entries',
        'marketplace_partner_holds','marketplace_partner_payable_status_history')
      and grantee in ('anon','authenticated')
      and privilege_type in ('INSERT','UPDATE','DELETE'))
  then raise exception 'Browser role received direct financial mutation grants'; end if;
  if exists(select 1 from information_schema.routine_privileges
    where specific_schema='private'
      and routine_name in ('create_marketplace_partner_payables_internal',
        'reverse_marketplace_partner_payable_internal',
        'write_marketplace_partner_ledger_entry')
      and grantee in ('PUBLIC','anon','authenticated','service_role'))
  then raise exception 'Internal financial executor is externally executable'; end if;
  if (select count(*) from pg_trigger t join pg_class c on c.oid=t.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname='marketplace_partner_ledger_entries'
      and not t.tgisinternal and t.tgname='marketplace_partner_ledger_immutable')<>1
  then raise exception 'Ledger immutability trigger missing'; end if;
  if exists(select 1 from public.marketplace_partner_payables p
    join public.marketplace_order_item_snapshots s on s.order_item_id=p.order_item_id
    where p.original_amount_cents<>s.estimated_partner_net)
  then raise exception 'Bootstrapped payable differs from PR6 snapshot'; end if;
end $$;

set local role anon;
do $$ begin
  begin perform 1 from public.marketplace_partner_payables;
    raise exception 'Anonymous read payables';
  exception when insufficient_privilege then null; end;
  begin perform public.get_partner_marketplace_balance();
    raise exception 'Anonymous invoked balance RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
