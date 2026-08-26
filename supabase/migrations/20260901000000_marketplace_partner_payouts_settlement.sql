-- Marketplace Partner payouts and settlement operations.
-- This migration records external manual bank transfers; it never moves money.

create type public.marketplace_payout_provider as enum (
  'MANUAL_BANK_TRANSFER', 'STRIPE_CONNECT', 'OTHER_PROVIDER'
);
create type public.marketplace_payout_batch_status as enum (
  'DRAFT', 'READY', 'COMPLETED', 'CANCELLED'
);
create type public.marketplace_partner_payout_status as enum (
  'DRAFT', 'READY', 'ON_HOLD', 'AWAITING_CONFIRMATION', 'PAID',
  'FAILED', 'CANCELLED', 'RECONCILIATION_REQUIRED'
);
create type public.marketplace_partner_settlement_status as enum (
  'PENDING', 'CONFIRMED', 'FAILED', 'RECONCILIATION_REQUIRED',
  'REVERSED_EXTERNALLY'
);
create type public.marketplace_partner_payout_event_type as enum (
  'PAYOUT_CREATED', 'ITEM_ATTACHED', 'ITEM_REMOVED', 'PAYOUT_READY',
  'PAYOUT_HELD', 'PAYOUT_HOLD_RELEASED', 'TRANSFER_RECORDED',
  'PAYOUT_FAILED', 'SETTLEMENT_CONFIRMED', 'RECONCILIATION_REQUIRED',
  'PAYOUT_CANCELLED'
);

alter table public.marketplace_partner_payables
  add column paid_amount_cents public.money_minor_units not null default 0;
alter table public.marketplace_partner_payables
  add constraint marketplace_partner_payables_paid_amount_bounds check (
    paid_amount_cents >= 0
    and paid_amount_cents + reversed_amount_cents <= original_amount_cents
  ),
  add constraint marketplace_partner_payables_paid_state check (
    (status = 'PAID') = (
      paid_amount_cents > 0
      and paid_amount_cents + reversed_amount_cents = original_amount_cents
    )
  );

alter table public.marketplace_operational_rules
  add column payout_weekday_utc smallint not null default 1
    check (payout_weekday_utc between 0 and 6),
  add column payout_hour_utc smallint not null default 6
    check (payout_hour_utc between 0 and 23);

create sequence public.marketplace_partner_payout_reference_sequence;
revoke all on sequence public.marketplace_partner_payout_reference_sequence from public, anon, authenticated;

create table public.marketplace_payout_batches (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  period_start date not null,
  period_end date not null,
  provider public.marketplace_payout_provider not null default 'MANUAL_BANK_TRANSFER',
  status public.marketplace_payout_batch_status not null default 'DRAFT',
  currency public.iso_currency_code not null default 'MXN',
  payout_count integer not null default 0 check (payout_count >= 0),
  total_cents public.money_minor_units not null default 0 check (total_cents >= 0),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_payout_batches_period check (period_end >= period_start),
  constraint marketplace_payout_batches_mxn check (currency = 'MXN'),
  constraint marketplace_payout_batches_manual_only check (provider = 'MANUAL_BANK_TRANSFER')
);

create table public.marketplace_partner_payouts (
  id uuid primary key default gen_random_uuid(),
  payout_reference text not null unique,
  batch_id uuid references public.marketplace_payout_batches(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  provider public.marketplace_payout_provider not null default 'MANUAL_BANK_TRANSFER',
  status public.marketplace_partner_payout_status not null default 'DRAFT',
  held_from_status public.marketplace_partner_payout_status,
  currency public.iso_currency_code not null default 'MXN',
  total_cents public.money_minor_units not null default 0 check (total_cents >= 0),
  item_count integer not null default 0 check (item_count >= 0),
  idempotency_key text not null unique,
  created_by uuid references public.profiles(id) on delete set null,
  ready_at timestamptz,
  paid_at timestamptz,
  failed_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_partner_payouts_idempotency_length
    check (char_length(idempotency_key) between 8 and 240),
  constraint marketplace_partner_payouts_mxn check (currency = 'MXN'),
  constraint marketplace_partner_payouts_manual_only check (provider = 'MANUAL_BANK_TRANSFER'),
  constraint marketplace_partner_payouts_hold_state check (
    (status = 'ON_HOLD' and held_from_status in ('DRAFT','READY'))
    or (status <> 'ON_HOLD' and held_from_status is null)
  ),
  constraint marketplace_partner_payouts_terminal_times check (
    (status = 'PAID') = (paid_at is not null)
    and (status = 'FAILED') = (failed_at is not null)
    and (status = 'CANCELLED') = (cancelled_at is not null)
  )
);

create table public.marketplace_partner_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.marketplace_partner_payouts(id) on delete restrict,
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  settlement_amount_cents public.money_minor_units not null check (settlement_amount_cents > 0),
  currency public.iso_currency_code not null default 'MXN',
  released_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_payout_items_one_per_payout unique (payout_id, payable_id),
  constraint marketplace_partner_payout_items_mxn check (currency = 'MXN'),
  constraint marketplace_partner_payout_items_lifecycle check (
    not (released_at is not null and settled_at is not null)
  )
);
create unique index marketplace_partner_payout_items_one_active_payable_idx
  on public.marketplace_partner_payout_items(payable_id)
  where released_at is null and settled_at is null;

create table public.marketplace_partner_payout_holds (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.marketplace_partner_payouts(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  source public.marketplace_partner_hold_source not null,
  status public.marketplace_partner_hold_status not null default 'ACTIVE',
  reason text not null,
  source_reference_key text,
  partner_visible boolean not null default false,
  actor_id uuid references public.profiles(id) on delete set null,
  placed_idempotency_key uuid not null unique,
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  release_reason text,
  release_idempotency_key uuid unique,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_payout_holds_reason check (char_length(btrim(reason)) between 3 and 1000),
  constraint marketplace_partner_payout_holds_source_reference unique (payout_id, source_reference_key),
  constraint marketplace_partner_payout_holds_release_state check (
    (status='ACTIVE' and released_at is null and release_reason is null and release_idempotency_key is null)
    or (status='RELEASED' and released_at is not null and release_reason is not null and release_idempotency_key is not null)
  )
);

create table public.marketplace_partner_settlements (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null unique references public.marketplace_partner_payouts(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  provider public.marketplace_payout_provider not null,
  status public.marketplace_partner_settlement_status not null default 'PENDING',
  amount_cents public.money_minor_units not null check (amount_cents > 0),
  currency public.iso_currency_code not null default 'MXN',
  transfer_date date not null,
  bank_label text not null,
  external_reference text not null unique,
  operations_note text,
  recorded_by uuid not null references public.profiles(id) on delete restrict,
  record_idempotency_key uuid not null unique,
  confirmation_idempotency_key uuid unique,
  confirmed_by uuid references public.profiles(id) on delete restrict,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_settlements_mxn check (currency='MXN'),
  constraint marketplace_partner_settlements_manual_only check (provider='MANUAL_BANK_TRANSFER'),
  constraint marketplace_partner_settlements_bank_label check (char_length(btrim(bank_label)) between 2 and 120),
  constraint marketplace_partner_settlements_reference check (char_length(btrim(external_reference)) between 4 and 160),
  constraint marketplace_partner_settlements_note check (operations_note is null or char_length(btrim(operations_note)) between 3 and 1000),
  constraint marketplace_partner_settlements_confirmation check (
    (status='CONFIRMED' and confirmed_by is not null and confirmed_at is not null and confirmation_idempotency_key is not null)
    or status<>'CONFIRMED'
  )
);

create table public.marketplace_partner_payout_events (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.marketplace_partner_payouts(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  event_type public.marketplace_partner_payout_event_type not null,
  from_status public.marketplace_partner_payout_status,
  to_status public.marketplace_partner_payout_status,
  reason text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_source public.marketplace_partner_finance_actor_source not null,
  reference_event_id uuid,
  idempotency_key text not null unique,
  partner_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_payout_events_reason check (char_length(btrim(reason)) between 3 and 1000),
  constraint marketplace_partner_payout_events_metadata check (jsonb_typeof(metadata)='object')
);

create table public.marketplace_payout_job_runs (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  calculation_date date not null,
  status text not null default 'RUNNING' check (status in ('RUNNING','COMPLETED','FAILED')),
  batch_id uuid references public.marketplace_payout_batches(id) on delete restrict,
  payout_count integer not null default 0,
  payable_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_payout_job_runs_key check (char_length(execution_key) between 8 and 160)
);

create index marketplace_partner_payouts_partner_status_idx on public.marketplace_partner_payouts(partner_id,status,created_at desc);
create index marketplace_partner_payouts_batch_idx on public.marketplace_partner_payouts(batch_id,partner_id);
create index marketplace_partner_payout_items_payout_idx on public.marketplace_partner_payout_items(payout_id,created_at);
create index marketplace_partner_payout_holds_active_idx on public.marketplace_partner_payout_holds(payout_id,created_at) where status='ACTIVE';
create index marketplace_partner_settlements_status_idx on public.marketplace_partner_settlements(status,transfer_date desc);
create index marketplace_partner_payout_events_idx on public.marketplace_partner_payout_events(payout_id,created_at,id);

create trigger marketplace_payout_batches_updated_at before update on public.marketplace_payout_batches for each row execute function public.set_updated_at();
create trigger marketplace_partner_payouts_updated_at before update on public.marketplace_partner_payouts for each row execute function public.set_updated_at();
create trigger marketplace_partner_payout_events_immutable before update or delete on public.marketplace_partner_payout_events for each row execute function public.reject_immutable_row_change();
create trigger marketplace_payout_job_runs_immutable before delete on public.marketplace_payout_job_runs for each row execute function public.reject_immutable_row_change();

create or replace function public.can_manage_marketplace_payouts()
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id
    where ur.user_id=(select auth.uid()) and r.name in('operator','admin'));
$$;
revoke all on function public.can_manage_marketplace_payouts() from public,anon;
grant execute on function public.can_manage_marketplace_payouts() to authenticated;

create or replace function private.guard_marketplace_payout_write()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if current_setting('peter_golf.partner_payout_write',true)<>'enabled' then
    raise exception 'Partner payout writes require an authorized executor' using errcode='42501';
  end if;
  if tg_table_name='marketplace_partner_settlements' and tg_op in('UPDATE','DELETE')
    and to_jsonb(old)->>'status'='CONFIRMED' then
    raise exception 'Confirmed settlement is immutable' using errcode='42501';
  end if;
  return coalesce(new,old);
end $$;
revoke all on function private.guard_marketplace_payout_write() from public,anon,authenticated,service_role;

create trigger marketplace_payout_batches_guard before insert or update or delete on public.marketplace_payout_batches for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_partner_payouts_guard before insert or update or delete on public.marketplace_partner_payouts for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_partner_payout_items_guard before insert or update or delete on public.marketplace_partner_payout_items for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_partner_payout_holds_guard before insert or update or delete on public.marketplace_partner_payout_holds for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_partner_settlements_guard before insert or update or delete on public.marketplace_partner_settlements for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_partner_payout_events_guard before insert or update or delete on public.marketplace_partner_payout_events for each row execute function private.guard_marketplace_payout_write();
create trigger marketplace_payout_job_runs_guard before insert or update or delete on public.marketplace_payout_job_runs for each row execute function private.guard_marketplace_payout_write();

create or replace function private.next_marketplace_payout_reference()
returns text language sql security definer set search_path='' as $$
  select 'BRP-'||to_char((now() at time zone 'UTC'),'YYYY')||'-'||lpad(nextval('public.marketplace_partner_payout_reference_sequence')::text,6,'0')
$$;
revoke all on function private.next_marketplace_payout_reference() from public,anon,authenticated,service_role;

create or replace function private.write_marketplace_payout_event(
  requested_payout public.marketplace_partner_payouts,
  requested_type public.marketplace_partner_payout_event_type,
  requested_from public.marketplace_partner_payout_status,
  requested_to public.marketplace_partner_payout_status,
  requested_reason text, requested_actor uuid,
  requested_source public.marketplace_partner_finance_actor_source,
  requested_reference uuid, requested_idempotency text,
  requested_partner_visible boolean default true,
  requested_metadata jsonb default '{}'::jsonb
) returns public.marketplace_partner_payout_events
language plpgsql security definer set search_path='' as $$
declare result public.marketplace_partner_payout_events;
begin
  insert into public.marketplace_partner_payout_events(payout_id,partner_id,event_type,from_status,to_status,
    reason,actor_id,actor_source,reference_event_id,idempotency_key,partner_visible,metadata)
  values(requested_payout.id,requested_payout.partner_id,requested_type,requested_from,requested_to,
    btrim(requested_reason),requested_actor,requested_source,requested_reference,requested_idempotency,
    requested_partner_visible,coalesce(requested_metadata,'{}'::jsonb))
  on conflict(idempotency_key) do nothing returning * into result;
  if result.id is null then select * into strict result from public.marketplace_partner_payout_events where idempotency_key=requested_idempotency; end if;
  return result;
end $$;
revoke all on function private.write_marketplace_payout_event(public.marketplace_partner_payouts,
  public.marketplace_partner_payout_event_type,public.marketplace_partner_payout_status,
  public.marketplace_partner_payout_status,text,uuid,public.marketplace_partner_finance_actor_source,
  uuid,text,boolean,jsonb) from public,anon,authenticated,service_role;

create or replace function private.refresh_marketplace_payout_totals(requested_payout_id uuid)
returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare result public.marketplace_partner_payouts;
begin
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payouts p set
    total_cents=coalesce((select sum(i.settlement_amount_cents) from public.marketplace_partner_payout_items i where i.payout_id=p.id and i.released_at is null),0),
    item_count=(select count(*) from public.marketplace_partner_payout_items i where i.payout_id=p.id and i.released_at is null),
    version=version+1 where p.id=requested_payout_id returning * into result;
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;
revoke all on function private.refresh_marketplace_payout_totals(uuid) from public,anon,authenticated,service_role;

create or replace function private.attach_marketplace_payable_to_payout_internal(
  requested_payout_id uuid, requested_payable_id uuid, requested_actor uuid, requested_idempotency text
) returns public.marketplace_partner_payout_items
language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; payable public.marketplace_partner_payables;
  result public.marketplace_partner_payout_items; remaining bigint;
begin
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  select * into strict payable from public.marketplace_partner_payables where id=requested_payable_id for update;
  if payout.status<>'DRAFT' or payout.provider<>'MANUAL_BANK_TRANSFER' then raise exception 'Payout items are locked' using errcode='22023'; end if;
  if payout.partner_id<>payable.partner_id or payout.currency<>payable.currency then raise exception 'Cross-Partner or mixed-currency payout denied' using errcode='42501'; end if;
  if payable.status<>'AVAILABLE' then raise exception 'Only AVAILABLE payables are eligible' using errcode='23514'; end if;
  if exists(select 1 from public.marketplace_partner_holds h where h.payable_id=payable.id and h.status='ACTIVE') then raise exception 'Active hold blocks payout' using errcode='23514'; end if;
  if not exists(select 1 from public.partner_profiles pp where pp.id=payable.partner_id and pp.status='VERIFIED') then raise exception 'Partner is not payout eligible' using errcode='23514'; end if;
  remaining:=payable.original_amount_cents-payable.reversed_amount_cents-payable.paid_amount_cents;
  if remaining<=0 then raise exception 'Payable has no available amount' using errcode='23514'; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  insert into public.marketplace_partner_payout_items(payout_id,payable_id,partner_id,settlement_amount_cents,currency)
    values(payout.id,payable.id,payable.partner_id,remaining,payable.currency)
    on conflict(payout_id,payable_id) do update set released_at=null
      where public.marketplace_partner_payout_items.released_at is not null
    returning * into result;
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  payout:=private.refresh_marketplace_payout_totals(payout.id);
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  perform private.write_marketplace_payout_event(payout,'ITEM_ATTACHED',payout.status,payout.status,
    'Obligación AVAILABLE agregada al payout.',requested_actor,'OPERATIONS',payable.id,requested_idempotency,true,
    jsonb_build_object('payable_id',payable.id,'amount_cents',remaining));
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return result;
exception when others then
  perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;
revoke all on function private.attach_marketplace_payable_to_payout_internal(uuid,uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function private.create_marketplace_payout_internal(
  requested_partner_id uuid, requested_payable_ids uuid[], requested_batch_id uuid,
  requested_actor uuid, requested_idempotency text
) returns public.marketplace_partner_payouts
language plpgsql security definer set search_path='' as $$
declare result public.marketplace_partner_payouts; payable_id uuid;
begin
  select * into result from public.marketplace_partner_payouts where idempotency_key=requested_idempotency;
  if found then return result; end if;
  if not exists(select 1 from public.partner_profiles where id=requested_partner_id and status='VERIFIED') then raise exception 'Partner is not payout eligible' using errcode='23514'; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  insert into public.marketplace_partner_payouts(payout_reference,batch_id,partner_id,idempotency_key,created_by)
    values(private.next_marketplace_payout_reference(),requested_batch_id,requested_partner_id,requested_idempotency,requested_actor)
    returning * into result;
  perform private.write_marketplace_payout_event(result,'PAYOUT_CREATED',null,'DRAFT','Payout manual creado.',requested_actor,
    (case when requested_actor is null then 'SYSTEM' else 'OPERATIONS' end)::public.marketplace_partner_finance_actor_source,
    null,requested_idempotency||':created',true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  foreach payable_id in array coalesce(requested_payable_ids,array[]::uuid[]) loop
    perform private.attach_marketplace_payable_to_payout_internal(result.id,payable_id,requested_actor,
      requested_idempotency||':item:'||payable_id::text);
  end loop;
  result:=private.refresh_marketplace_payout_totals(result.id);
  if result.item_count=0 then raise exception 'Payout requires at least one eligible payable' using errcode='23514'; end if;
  return result;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;
revoke all on function private.create_marketplace_payout_internal(uuid,uuid[],uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function public.create_marketplace_partner_payout(
  requested_partner_id uuid, requested_payable_ids uuid[], requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  if requested_idempotency_key is null then raise exception 'Payout idempotency key required' using errcode='22023'; end if;
  return private.create_marketplace_payout_internal(requested_partner_id,requested_payable_ids,null,auth.uid(),
    'payout:create:'||requested_idempotency_key::text);
end $$;

create or replace function public.add_marketplace_partner_payout_item(
  requested_payout_id uuid, requested_payable_id uuid, requested_idempotency_key uuid
) returns public.marketplace_partner_payout_items language plpgsql security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  return private.attach_marketplace_payable_to_payout_internal(requested_payout_id,requested_payable_id,auth.uid(),
    'payout:item:add:'||requested_idempotency_key::text);
end $$;

create or replace function public.remove_marketplace_partner_payout_item(
  requested_payout_id uuid, requested_payable_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; item public.marketplace_partner_payout_items;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status<>'DRAFT' then raise exception 'Payout items are locked' using errcode='22023'; end if;
  select * into strict item from public.marketplace_partner_payout_items where payout_id=payout.id and payable_id=requested_payable_id and released_at is null for update;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payout_items set released_at=now() where id=item.id;
  perform private.write_marketplace_payout_event(payout,'ITEM_REMOVED','DRAFT','DRAFT',requested_reason,auth.uid(),'OPERATIONS',
    item.id,'payout:item:remove:'||requested_idempotency_key::text,true,jsonb_build_object('payable_id',item.payable_id));
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return private.refresh_marketplace_payout_totals(payout.id);
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.mark_marketplace_partner_payout_ready(
  requested_payout_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; result public.marketplace_partner_payouts;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status='READY' then return payout; end if;
  if payout.status<>'DRAFT' or payout.item_count=0 or payout.total_cents<=0 then raise exception 'Payout cannot become READY' using errcode='23514'; end if;
  if exists(select 1 from public.marketplace_partner_payout_items i join public.marketplace_partner_payables p on p.id=i.payable_id
    where i.payout_id=payout.id and i.released_at is null and (p.status<>'AVAILABLE' or exists(select 1 from public.marketplace_partner_holds h where h.payable_id=p.id and h.status='ACTIVE')))
  then raise exception 'Payout contains an ineligible payable' using errcode='23514'; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payouts set status='READY',ready_at=now(),version=version+1 where id=payout.id returning * into result;
  perform private.write_marketplace_payout_event(result,'PAYOUT_READY','DRAFT','READY',requested_reason,auth.uid(),'OPERATIONS',null,
    'payout:ready:'||requested_idempotency_key::text,true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.place_marketplace_partner_payout_hold(
  requested_payout_id uuid, requested_source public.marketplace_partner_hold_source, requested_reason text,
  requested_partner_visible boolean, requested_idempotency_key uuid
) returns public.marketplace_partner_payout_holds language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; result public.marketplace_partner_payout_holds; prior public.marketplace_partner_payout_status;
begin
  if not public.can_manage_marketplace_payouts() or requested_source not in('OPERATIONS','RISK','RECONCILIATION') then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status in('PAID','FAILED','CANCELLED') then raise exception 'Payout cannot be held' using errcode='22023'; end if;
  prior:=case when payout.status='ON_HOLD' then payout.held_from_status else payout.status end;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  insert into public.marketplace_partner_payout_holds(payout_id,partner_id,source,reason,partner_visible,actor_id,placed_idempotency_key)
    values(payout.id,payout.partner_id,requested_source,btrim(requested_reason),requested_partner_visible,auth.uid(),requested_idempotency_key)
    on conflict(placed_idempotency_key) do update set placed_idempotency_key=excluded.placed_idempotency_key returning * into result;
  update public.marketplace_partner_payouts set status='ON_HOLD',held_from_status=prior,version=version+1 where id=payout.id and status<>'ON_HOLD';
  select * into payout from public.marketplace_partner_payouts where id=payout.id;
  perform private.write_marketplace_payout_event(payout,'PAYOUT_HELD',prior,'ON_HOLD',requested_reason,auth.uid(),'OPERATIONS',result.id,
    'payout:hold:'||requested_idempotency_key::text,requested_partner_visible);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.release_marketplace_partner_payout_hold(
  requested_hold_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare hold_record public.marketplace_partner_payout_holds; payout public.marketplace_partner_payouts; target public.marketplace_partner_payout_status;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict hold_record from public.marketplace_partner_payout_holds where id=requested_hold_id for update;
  select * into strict payout from public.marketplace_partner_payouts where id=hold_record.payout_id for update;
  if hold_record.status='RELEASED' then return payout; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payout_holds set status='RELEASED',released_at=now(),released_by=auth.uid(),
    release_reason=btrim(requested_reason),release_idempotency_key=requested_idempotency_key where id=hold_record.id;
  if not exists(select 1 from public.marketplace_partner_payout_holds where payout_id=payout.id and status='ACTIVE') and payout.status='ON_HOLD' then
    target:=payout.held_from_status;
    update public.marketplace_partner_payouts set status=target,held_from_status=null,version=version+1 where id=payout.id returning * into payout;
  end if;
  perform private.write_marketplace_payout_event(payout,'PAYOUT_HOLD_RELEASED','ON_HOLD',payout.status,requested_reason,auth.uid(),'OPERATIONS',hold_record.id,
    'payout:hold:release:'||requested_idempotency_key::text,true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return payout;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.record_marketplace_manual_transfer(
  requested_payout_id uuid, requested_transfer_date date, requested_bank_label text,
  requested_external_reference text, requested_confirmed_amount_cents bigint,
  requested_note text, requested_idempotency_key uuid
) returns public.marketplace_partner_settlements language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; result public.marketplace_partner_settlements;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  select * into result from public.marketplace_partner_settlements where payout_id=payout.id;
  if found then
    if result.record_idempotency_key<>requested_idempotency_key
      or result.amount_cents<>requested_confirmed_amount_cents
      or result.external_reference<>btrim(requested_external_reference)
      or result.transfer_date<>requested_transfer_date
    then raise exception 'Transfer record idempotency conflict' using errcode='23505'; end if;
    return result;
  end if;
  if payout.status<>'READY' or payout.provider<>'MANUAL_BANK_TRANSFER' then raise exception 'Payout is not ready for manual transfer recording' using errcode='22023'; end if;
  if requested_confirmed_amount_cents<>payout.total_cents then raise exception 'Transfer amount does not match payout total' using errcode='23514'; end if;
  if exists(select 1 from public.marketplace_partner_payout_holds where payout_id=payout.id and status='ACTIVE')
    or exists(select 1 from public.marketplace_partner_payout_items i join public.marketplace_partner_holds h on h.payable_id=i.payable_id and h.status='ACTIVE' where i.payout_id=payout.id and i.released_at is null)
  then raise exception 'Active hold blocks transfer recording' using errcode='23514'; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  insert into public.marketplace_partner_settlements(payout_id,partner_id,provider,amount_cents,currency,transfer_date,
    bank_label,external_reference,operations_note,recorded_by,record_idempotency_key)
  values(payout.id,payout.partner_id,payout.provider,payout.total_cents,payout.currency,requested_transfer_date,
    btrim(requested_bank_label),btrim(requested_external_reference),nullif(btrim(requested_note),''),auth.uid(),requested_idempotency_key) returning * into result;
  update public.marketplace_partner_payouts set status='AWAITING_CONFIRMATION',version=version+1 where id=payout.id returning * into payout;
  perform private.write_marketplace_payout_event(payout,'TRANSFER_RECORDED','READY','AWAITING_CONFIRMATION',
    'Transferencia externa registrada; settlement pendiente de confirmación.',auth.uid(),'OPERATIONS',result.id,
    'payout:transfer:'||requested_idempotency_key::text,true,jsonb_build_object('transfer_date',requested_transfer_date));
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function private.settle_marketplace_partner_payable_internal(
  requested_payable_id uuid, requested_amount_cents bigint, requested_settlement_id uuid,
  requested_actor_id uuid, requested_idempotency_key text
) returns public.marketplace_partner_payables language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_partner_payables; result public.marketplace_partner_payables; remaining bigint;
  next_status public.marketplace_partner_payable_status;
begin
  select * into strict selected from public.marketplace_partner_payables where id=requested_payable_id for update;
  if exists(select 1 from public.marketplace_partner_ledger_entries where idempotency_key=requested_idempotency_key) then return selected; end if;
  if selected.status<>'AVAILABLE' or exists(select 1 from public.marketplace_partner_holds where payable_id=selected.id and status='ACTIVE') then raise exception 'Payable is not settlement eligible' using errcode='23514'; end if;
  remaining:=selected.original_amount_cents-selected.reversed_amount_cents-selected.paid_amount_cents;
  if requested_amount_cents<=0 or requested_amount_cents>remaining then raise exception 'Settlement amount is invalid' using errcode='22023'; end if;
  next_status:=case when requested_amount_cents=remaining then 'PAID' else 'AVAILABLE' end;
  perform private.write_marketplace_partner_ledger_entry(selected,'PAYABLE_PAID','PAYOUT',0,0,0,-requested_amount_cents,
    requested_amount_cents,0,'Settlement manual confirmado.',requested_actor_id,requested_settlement_id,requested_idempotency_key,
    jsonb_build_object('settlement_id',requested_settlement_id,'partial',requested_amount_cents<remaining));
  perform set_config('peter_golf.partner_finance_write','enabled',true);
  update public.marketplace_partner_payables set paid_amount_cents=paid_amount_cents+requested_amount_cents,
    status=next_status,version=version+1 where id=selected.id returning * into result;
  perform set_config('peter_golf.partner_finance_write','disabled',true);
  if next_status='PAID' then perform private.write_marketplace_partner_payable_history(result,'AVAILABLE','PAID','PAYOUT',
    requested_actor_id,'Settlement manual confirmado.',requested_idempotency_key); end if;
  return result;
exception when others then perform set_config('peter_golf.partner_finance_write','disabled',true); raise;
end $$;
revoke all on function private.settle_marketplace_partner_payable_internal(uuid,bigint,uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function public.confirm_marketplace_payout_settlement(
  requested_payout_id uuid, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; settlement public.marketplace_partner_settlements; item public.marketplace_partner_payout_items;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  select * into strict settlement from public.marketplace_partner_settlements where payout_id=payout.id for update;
  if settlement.status='CONFIRMED' then
    if settlement.confirmation_idempotency_key<>requested_idempotency_key
    then raise exception 'Settlement confirmation idempotency conflict' using errcode='23505'; end if;
    return payout;
  end if;
  if payout.status<>'AWAITING_CONFIRMATION' or settlement.status<>'PENDING' or settlement.amount_cents<>payout.total_cents then raise exception 'Settlement is not confirmable' using errcode='23514'; end if;
  if exists(select 1 from public.marketplace_partner_payout_holds where payout_id=payout.id and status='ACTIVE')
    or exists(select 1 from public.marketplace_partner_payout_items i join public.marketplace_partner_holds h on h.payable_id=i.payable_id and h.status='ACTIVE' where i.payout_id=payout.id and i.released_at is null)
  then raise exception 'Active hold blocks settlement' using errcode='23514'; end if;
  for item in select * from public.marketplace_partner_payout_items where payout_id=payout.id and released_at is null and settled_at is null order by id for update loop
    perform private.settle_marketplace_partner_payable_internal(item.payable_id,item.settlement_amount_cents::bigint,settlement.id,
      auth.uid(),'payable:paid:'||settlement.id::text||':'||item.payable_id::text);
  end loop;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payout_items set settled_at=now() where payout_id=payout.id and released_at is null and settled_at is null;
  update public.marketplace_partner_settlements set status='CONFIRMED',confirmation_idempotency_key=requested_idempotency_key,
    confirmed_by=auth.uid(),confirmed_at=now() where id=settlement.id;
  update public.marketplace_partner_payouts set status='PAID',paid_at=now(),version=version+1 where id=payout.id returning * into payout;
  perform private.write_marketplace_payout_event(payout,'SETTLEMENT_CONFIRMED','AWAITING_CONFIRMATION','PAID',
    'Settlement manual confirmado; payables movidos a PAID.',auth.uid(),'PAYOUT',settlement.id,
    'payout:settlement:'||requested_idempotency_key::text,true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return payout;
exception when others then
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  perform set_config('peter_golf.partner_finance_write','disabled',true); raise;
end $$;

create or replace function private.release_marketplace_payout_items_internal(requested_payout_id uuid)
returns void language plpgsql security definer set search_path='' as $$
begin
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payout_items set released_at=now()
    where payout_id=requested_payout_id and released_at is null and settled_at is null;
  perform set_config('peter_golf.partner_payout_write','disabled',true);
end $$;
revoke all on function private.release_marketplace_payout_items_internal(uuid) from public,anon,authenticated,service_role;

create or replace function public.cancel_marketplace_partner_payout(
  requested_payout_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status='CANCELLED' then return payout; end if;
  if payout.status not in('DRAFT','READY','ON_HOLD') then raise exception 'Payout cannot be cancelled' using errcode='22023'; end if;
  perform private.release_marketplace_payout_items_internal(payout.id);
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_payouts set status='CANCELLED',held_from_status=null,cancelled_at=now(),version=version+1 where id=payout.id returning * into payout;
  perform private.write_marketplace_payout_event(payout,'PAYOUT_CANCELLED',null,'CANCELLED',requested_reason,auth.uid(),'OPERATIONS',null,
    'payout:cancel:'||requested_idempotency_key::text,true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return payout;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.fail_marketplace_partner_payout(
  requested_payout_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status='FAILED' then return payout; end if;
  if payout.status not in('READY','AWAITING_CONFIRMATION') then raise exception 'Payout cannot fail from current state' using errcode='22023'; end if;
  perform private.release_marketplace_payout_items_internal(payout.id);
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_settlements set status='FAILED' where payout_id=payout.id and status='PENDING';
  update public.marketplace_partner_payouts set status='FAILED',failed_at=now(),version=version+1 where id=payout.id returning * into payout;
  perform private.write_marketplace_payout_event(payout,'PAYOUT_FAILED',null,'FAILED',requested_reason,auth.uid(),'OPERATIONS',null,
    'payout:failed:'||requested_idempotency_key::text,true);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return payout;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function public.flag_marketplace_payout_reconciliation(
  requested_payout_id uuid, requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payouts language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts;
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  select * into strict payout from public.marketplace_partner_payouts where id=requested_payout_id for update;
  if payout.status='PAID' then raise exception 'Confirmed payout requires compensating reconciliation' using errcode='22023'; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_partner_settlements set status='RECONCILIATION_REQUIRED' where payout_id=payout.id and status='PENDING';
  update public.marketplace_partner_payouts set status='RECONCILIATION_REQUIRED',held_from_status=null,version=version+1 where id=payout.id returning * into payout;
  perform private.write_marketplace_payout_event(payout,'RECONCILIATION_REQUIRED',null,'RECONCILIATION_REQUIRED',requested_reason,auth.uid(),'RECONCILIATION',null,
    'payout:reconcile:'||requested_idempotency_key::text,false);
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return payout;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;

create or replace function private.sync_marketplace_payout_from_payable_hold()
returns trigger language plpgsql security definer set search_path='' as $$
declare payout public.marketplace_partner_payouts; hold_id uuid;
begin
  if new.status<>'ACTIVE' or (tg_op='UPDATE' and old.status='ACTIVE') then return new; end if;
  for payout in select p.* from public.marketplace_partner_payouts p join public.marketplace_partner_payout_items i on i.payout_id=p.id
    where i.payable_id=new.payable_id and i.released_at is null and i.settled_at is null and p.status in('DRAFT','READY','AWAITING_CONFIRMATION') for update of p
  loop
    perform set_config('peter_golf.partner_payout_write','enabled',true);
    if payout.status='AWAITING_CONFIRMATION' then
      update public.marketplace_partner_settlements set status='RECONCILIATION_REQUIRED' where payout_id=payout.id and status='PENDING';
      update public.marketplace_partner_payouts set status='RECONCILIATION_REQUIRED',version=version+1 where id=payout.id;
    else
      insert into public.marketplace_partner_payout_holds(payout_id,partner_id,source,reason,source_reference_key,partner_visible,
        placed_idempotency_key)
      values(payout.id,payout.partner_id,new.source,'Payable bloqueado antes del payout.','payable-hold:'||new.id::text,
        new.partner_visible,private.marketplace_deterministic_uuid('payout:payable-hold:'||payout.id::text||':'||new.id::text))
      on conflict(payout_id,source_reference_key) do nothing returning id into hold_id;
      update public.marketplace_partner_payouts set status='ON_HOLD',held_from_status=payout.status,version=version+1 where id=payout.id;
    end if;
    perform set_config('peter_golf.partner_payout_write','disabled',true);
  end loop;
  return new;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;
revoke all on function private.sync_marketplace_payout_from_payable_hold() from public,anon,authenticated,service_role;
create trigger zz_sync_marketplace_payout_from_payable_hold after insert or update of status on public.marketplace_partner_holds
for each row execute function private.sync_marketplace_payout_from_payable_hold();

create or replace function private.run_marketplace_payout_job_internal(requested_date date,requested_execution_key text)
returns public.marketplace_payout_job_runs language plpgsql security definer set search_path='' as $$
declare job public.marketplace_payout_job_runs; batch public.marketplace_payout_batches; partner_record record;
  payout public.marketplace_partner_payouts; ids uuid[]; payouts integer:=0; payables integer:=0;
begin
  if requested_date is null or requested_execution_key is null or char_length(requested_execution_key) not between 8 and 160 then raise exception 'Payout job input is invalid' using errcode='22023'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('best-round-marketplace-weekly-payouts',0)) then raise exception 'Payout job is already running' using errcode='55P03'; end if;
  select * into job from public.marketplace_payout_job_runs where execution_key=requested_execution_key;
  if found then return job; end if;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  insert into public.marketplace_payout_job_runs(execution_key,calculation_date) values(requested_execution_key,requested_date) returning * into job;
  insert into public.marketplace_payout_batches(execution_key,period_start,period_end)
    values('batch:'||requested_execution_key,requested_date-6,requested_date) returning * into batch;
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  for partner_record in
    select p.partner_id,array_agg(p.id order by p.created_at,p.id) ids
    from public.marketplace_partner_payables p join public.partner_profiles pp on pp.id=p.partner_id and pp.status='VERIFIED'
    where p.status='AVAILABLE' and p.currency='MXN'
      and not exists(select 1 from public.marketplace_partner_holds h where h.payable_id=p.id and h.status='ACTIVE')
      and not exists(select 1 from public.marketplace_partner_payout_items i where i.payable_id=p.id and i.released_at is null and i.settled_at is null)
    group by p.partner_id order by p.partner_id
  loop
    ids:=partner_record.ids;
    payout:=private.create_marketplace_payout_internal(partner_record.partner_id,ids,batch.id,null,
      'payout:weekly:'||requested_execution_key||':'||partner_record.partner_id::text);
    payouts:=payouts+1; payables:=payables+cardinality(ids);
  end loop;
  perform set_config('peter_golf.partner_payout_write','enabled',true);
  update public.marketplace_payout_batches set payout_count=payouts,total_cents=coalesce((select sum(total_cents) from public.marketplace_partner_payouts where batch_id=batch.id),0),
    status=(case when payouts>0 then 'READY' else 'COMPLETED' end)::public.marketplace_payout_batch_status
    where id=batch.id;
  update public.marketplace_payout_job_runs set status='COMPLETED',batch_id=batch.id,payout_count=payouts,payable_count=payables,
    completed_at=now() where id=job.id returning * into job;
  perform set_config('peter_golf.partner_payout_write','disabled',true);
  return job;
exception when others then perform set_config('peter_golf.partner_payout_write','disabled',true); raise;
end $$;
revoke all on function private.run_marketplace_payout_job_internal(date,text) from public,anon,authenticated,service_role;

create or replace function public.run_marketplace_payout_job(requested_date date,requested_execution_key text)
returns public.marketplace_payout_job_runs language plpgsql security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_payouts() then raise exception 'Marketplace payout access denied' using errcode='42501'; end if;
  return private.run_marketplace_payout_job_internal(requested_date,requested_execution_key);
end $$;

create or replace function public.get_partner_marketplace_payouts(requested_payout_id uuid default null)
returns table(payout_id uuid,payout_reference text,status public.marketplace_partner_payout_status,total_cents bigint,
  currency character(3),provider public.marketplace_payout_provider,item_count integer,created_at timestamptz,paid_at timestamptz,
  transfer_date date,bank_label text,external_reference text,settlement_status public.marketplace_partner_settlement_status)
language sql stable security definer set search_path='' as $$
  select p.id,p.payout_reference,p.status,p.total_cents::bigint,p.currency,p.provider,p.item_count,p.created_at,p.paid_at,
    s.transfer_date,s.bank_label,s.external_reference,s.status
  from public.marketplace_partner_payouts p join public.partner_profiles pp on pp.id=p.partner_id
  left join public.marketplace_partner_settlements s on s.payout_id=p.id
  where pp.user_id=auth.uid() and (requested_payout_id is null or p.id=requested_payout_id)
  order by p.created_at desc,p.id
$$;

-- RLS is defense in depth; financial mutations are RPC-only and trigger-guarded.
alter table public.marketplace_payout_batches enable row level security;
alter table public.marketplace_partner_payouts enable row level security;
alter table public.marketplace_partner_payout_items enable row level security;
alter table public.marketplace_partner_payout_holds enable row level security;
alter table public.marketplace_partner_settlements enable row level security;
alter table public.marketplace_partner_payout_events enable row level security;
alter table public.marketplace_payout_job_runs enable row level security;

create policy "Payout staff read batches" on public.marketplace_payout_batches for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Partners read own payouts" on public.marketplace_partner_payouts for select to authenticated using(exists(select 1 from public.partner_profiles pp where pp.id=partner_id and pp.user_id=auth.uid()));
create policy "Payout staff read payouts" on public.marketplace_partner_payouts for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Partners read own payout items" on public.marketplace_partner_payout_items for select to authenticated using(exists(select 1 from public.partner_profiles pp where pp.id=partner_id and pp.user_id=auth.uid()));
create policy "Payout staff read payout items" on public.marketplace_partner_payout_items for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Partners read visible payout holds" on public.marketplace_partner_payout_holds for select to authenticated using(partner_visible and exists(select 1 from public.partner_profiles pp where pp.id=partner_id and pp.user_id=auth.uid()));
create policy "Payout staff read payout holds" on public.marketplace_partner_payout_holds for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Payout staff read settlements" on public.marketplace_partner_settlements for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Partners read visible payout events" on public.marketplace_partner_payout_events for select to authenticated using(partner_visible and exists(select 1 from public.partner_profiles pp where pp.id=partner_id and pp.user_id=auth.uid()));
create policy "Payout staff read payout events" on public.marketplace_partner_payout_events for select to authenticated using(public.can_manage_marketplace_payouts());
create policy "Payout staff read jobs" on public.marketplace_payout_job_runs for select to authenticated using(public.can_manage_marketplace_payouts());

revoke all on public.marketplace_payout_batches,public.marketplace_partner_payouts,public.marketplace_partner_payout_items,
  public.marketplace_partner_payout_holds,public.marketplace_partner_settlements,public.marketplace_partner_payout_events,
  public.marketplace_payout_job_runs from public,anon,authenticated;
grant select on public.marketplace_payout_batches,public.marketplace_partner_payouts,public.marketplace_partner_payout_items,
  public.marketplace_partner_payout_holds,public.marketplace_partner_settlements,public.marketplace_partner_payout_events,
  public.marketplace_payout_job_runs to authenticated;

revoke all on function public.create_marketplace_partner_payout(uuid,uuid[],uuid),
  public.add_marketplace_partner_payout_item(uuid,uuid,uuid),
  public.remove_marketplace_partner_payout_item(uuid,uuid,text,uuid),
  public.mark_marketplace_partner_payout_ready(uuid,text,uuid),
  public.place_marketplace_partner_payout_hold(uuid,public.marketplace_partner_hold_source,text,boolean,uuid),
  public.release_marketplace_partner_payout_hold(uuid,text,uuid),
  public.record_marketplace_manual_transfer(uuid,date,text,text,bigint,text,uuid),
  public.confirm_marketplace_payout_settlement(uuid,uuid),
  public.cancel_marketplace_partner_payout(uuid,text,uuid),
  public.fail_marketplace_partner_payout(uuid,text,uuid),
  public.flag_marketplace_payout_reconciliation(uuid,text,uuid),
  public.run_marketplace_payout_job(date,text),public.get_partner_marketplace_payouts(uuid)
from public,anon;
grant execute on function public.create_marketplace_partner_payout(uuid,uuid[],uuid),
  public.add_marketplace_partner_payout_item(uuid,uuid,uuid),
  public.remove_marketplace_partner_payout_item(uuid,uuid,text,uuid),
  public.mark_marketplace_partner_payout_ready(uuid,text,uuid),
  public.place_marketplace_partner_payout_hold(uuid,public.marketplace_partner_hold_source,text,boolean,uuid),
  public.release_marketplace_partner_payout_hold(uuid,text,uuid),
  public.record_marketplace_manual_transfer(uuid,date,text,text,bigint,text,uuid),
  public.confirm_marketplace_payout_settlement(uuid,uuid),
  public.cancel_marketplace_partner_payout(uuid,text,uuid),
  public.fail_marketplace_partner_payout(uuid,text,uuid),
  public.flag_marketplace_payout_reconciliation(uuid,text,uuid),
  public.run_marketplace_payout_job(date,text),public.get_partner_marketplace_payouts(uuid)
to authenticated;

do $$ begin
  if exists(select 1 from cron.job where jobname='best-round-marketplace-partner-payouts-weekly') then
    perform cron.unschedule('best-round-marketplace-partner-payouts-weekly');
  end if;
  perform cron.schedule('best-round-marketplace-partner-payouts-weekly','0 6 * * 1',
    $command$select private.run_marketplace_payout_job_internal(
      (now() at time zone 'UTC')::date,
      'weekly:'||to_char((now() at time zone 'UTC')::date,'IYYY-IW'))$command$);
end $$;

comment on table public.marketplace_partner_payouts is 'One Partner payout intent. MANUAL_BANK_TRANSFER records an external operation and never executes money movement.';
comment on table public.marketplace_partner_settlements is 'Evidence and confirmation of an externally performed transfer; confirmed rows are immutable.';
comment on column public.marketplace_partner_payables.paid_amount_cents is 'Cumulative amount moved from AVAILABLE to PAID by immutable payout settlement ledger entries.';
comment on column public.marketplace_operational_rules.payout_weekday_utc is 'Versioned weekly payout preparation weekday; 1 = Monday.';
