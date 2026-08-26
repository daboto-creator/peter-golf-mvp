-- Marketplace delivery acceptance, claims, return preparation and exceptions.
-- Financial effects delegate to the immutable PR7 ledger; no pricing or tier
-- value is recalculated in this migration.

create type public.marketplace_acceptance_status as enum (
  'PENDING', 'BUYER_ACCEPTED', 'AUTO_ACCEPTED', 'PROBLEM_REPORTED'
);
create type public.marketplace_claim_reason as enum (
  'WRONG_ITEM', 'CONDITION_NOT_AS_DESCRIBED', 'UNDECLARED_DAMAGE',
  'COUNTERFEIT_SUSPECTED', 'WRONG_SPECS', 'NON_FUNCTIONAL',
  'OTHER_MANUAL_REVIEW'
);
create type public.marketplace_claim_status as enum (
  'OPEN', 'UNDER_REVIEW', 'EVIDENCE_REQUESTED',
  'PARTNER_RESPONSE_PENDING', 'RETURN_REQUIRED', 'RETURN_IN_TRANSIT',
  'RETURN_RECEIVED', 'RESOLVED', 'CANCELLED'
);
create type public.marketplace_claim_decision as enum (
  'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'
);
create type public.marketplace_claim_responsibility as enum (
  'PARTNER_RESPONSIBLE', 'BUYER_NOT_SUPPORTED',
  'BEST_ROUND_OPERATIONAL', 'INCONCLUSIVE', 'NO_FAULT'
);
create type public.marketplace_claim_financial_effect as enum (
  'NONE', 'FULL_REVERSAL', 'PARTIAL_REVERSAL'
);
create type public.marketplace_return_requirement as enum (
  'NO_RETURN_REQUIRED', 'RETURN_REQUIRED', 'RETURN_WAIVED', 'MANUAL_REVIEW'
);
create type public.marketplace_return_status as enum (
  'REQUESTED', 'AUTHORIZED', 'AWAITING_SHIPMENT', 'IN_TRANSIT',
  'RECEIVED', 'INSPECTING', 'ACCEPTED', 'REJECTED', 'CLOSED'
);
create type public.marketplace_return_shipping_responsibility as enum (
  'PARTNER_OR_BEST_ROUND', 'BUYER', 'MANUAL_REVIEW'
);
create type public.marketplace_claim_evaluation_source as enum (
  'MANUAL', 'AI', 'HYBRID'
);
create type public.marketplace_refund_preparation_status as enum (
  'REFUND_NOT_REQUIRED', 'REFUND_PENDING', 'REFUND_PREPARED',
  'REFUND_REQUIRES_MANUAL_ACTION', 'REFUND_COMPLETED'
);
create type public.marketplace_acceptance_job_status as enum (
  'RUNNING', 'COMPLETED'
);

-- PR1 reserved this versioned rule but intentionally left it unset. PR8 owns
-- the approved 48-hour baseline and makes future versions explicit.
update public.marketplace_operational_rules
set acceptance_window_hours=48 where acceptance_window_hours is null;
alter table public.marketplace_operational_rules
  alter column acceptance_window_hours set default 48,
  alter column acceptance_window_hours set not null,
  add constraint marketplace_acceptance_window_hours_valid
    check (acceptance_window_hours between 1 and 720);

create table public.marketplace_delivery_acceptances (
  id uuid primary key default gen_random_uuid(),
  fulfillment_id uuid not null unique references public.order_fulfillments(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  config_version_id uuid not null references public.marketplace_config_versions(id) on delete restrict,
  acceptance_window_hours integer not null check (acceptance_window_hours between 1 and 720),
  delivered_at timestamptz not null,
  acceptance_deadline timestamptz not null,
  status public.marketplace_acceptance_status not null default 'PENDING',
  accepted_at timestamptz,
  claim_opened_at timestamptz,
  finalized_at timestamptz,
  actor_id uuid references public.profiles(id) on delete set null,
  idempotency_key uuid unique,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_delivery_acceptance_deadline check (
    acceptance_deadline = delivered_at + make_interval(hours => acceptance_window_hours)
  ),
  constraint marketplace_delivery_acceptance_state check (
    (status = 'PENDING' and accepted_at is null and claim_opened_at is null and finalized_at is null)
    or (status in ('BUYER_ACCEPTED','AUTO_ACCEPTED') and accepted_at is not null and finalized_at is not null)
    or (status = 'PROBLEM_REPORTED' and claim_opened_at is not null)
  )
);

create table public.marketplace_claims (
  id uuid primary key default gen_random_uuid(),
  acceptance_id uuid not null references public.marketplace_delivery_acceptances(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.marketplace_order_item_snapshots(order_item_id) on delete restrict,
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete restrict,
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  buyer_id uuid not null references public.profiles(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  listing_version_id uuid not null references public.marketplace_listing_versions(id) on delete restrict,
  reason public.marketplace_claim_reason not null,
  status public.marketplace_claim_status not null default 'OPEN',
  description text not null,
  responsibility public.marketplace_claim_responsibility,
  financial_effect public.marketplace_claim_financial_effect,
  approved_adjustment_cents public.money_minor_units,
  return_requirement public.marketplace_return_requirement,
  refund_status public.marketplace_refund_preparation_status not null default 'REFUND_NOT_REQUIRED',
  evaluation_source public.marketplace_claim_evaluation_source not null default 'MANUAL',
  evaluation_confidence integer check (evaluation_confidence between 0 and 100),
  evaluation_notes text,
  claim_hold_id uuid references public.marketplace_partner_holds(id) on delete restrict,
  opened_at timestamptz not null default now(),
  finalized_at timestamptz,
  opened_idempotency_key uuid not null unique,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_claim_description_length check (char_length(btrim(description)) between 10 and 2000),
  constraint marketplace_claim_evaluation_notes_length check (evaluation_notes is null or char_length(btrim(evaluation_notes)) between 3 and 2000),
  constraint marketplace_claim_final_state check (
    (status in ('RESOLVED','CANCELLED') and finalized_at is not null)
    or (status not in ('RESOLVED','CANCELLED') and finalized_at is null)
  ),
  constraint marketplace_claim_financial_amount check (
    (financial_effect = 'PARTIAL_REVERSAL' and approved_adjustment_cents > 0)
    or (financial_effect <> 'PARTIAL_REVERSAL' and approved_adjustment_cents is null)
    or (financial_effect is null and approved_adjustment_cents is null)
  )
);
create unique index marketplace_claims_one_active_item_idx
  on public.marketplace_claims(order_item_id)
  where status not in ('RESOLVED','CANCELLED');

create table public.marketplace_claim_events (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.marketplace_claims(id) on delete restrict,
  event_type text not null check (event_type ~ '^[A-Z][A-Z0-9_]{2,63}$'),
  from_status public.marketplace_claim_status,
  to_status public.marketplace_claim_status,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_role text not null check (actor_role in ('BUYER','PARTNER','OPERATIONS','SYSTEM')),
  reason text,
  partner_visible boolean not null default true,
  buyer_visible boolean not null default true,
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_claim_event_reason_length check (reason is null or char_length(btrim(reason)) between 3 and 2000)
);

create table public.marketplace_claim_resolutions (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.marketplace_claims(id) on delete restrict,
  decision public.marketplace_claim_decision not null,
  responsibility public.marketplace_claim_responsibility not null,
  financial_effect public.marketplace_claim_financial_effect not null,
  adjustment_amount_cents public.money_minor_units,
  return_requirement public.marketplace_return_requirement not null,
  buyer_outcome text not null,
  evidence_summary text not null,
  reason text not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_claim_resolution_text check (
    char_length(btrim(reason)) between 3 and 2000
    and char_length(btrim(evidence_summary)) between 3 and 2000
    and char_length(btrim(buyer_outcome)) between 3 and 1000
  ),
  constraint marketplace_claim_resolution_amount check (
    (financial_effect = 'PARTIAL_REVERSAL' and adjustment_amount_cents > 0)
    or (financial_effect <> 'PARTIAL_REVERSAL' and adjustment_amount_cents is null)
  )
);

create table public.marketplace_claim_evidence (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references public.marketplace_claims(id) on delete restrict,
  submitted_by uuid not null references public.profiles(id) on delete restrict,
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg','image/png','image/webp')),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  partner_visible boolean not null default false,
  note text,
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_claim_evidence_path check (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$'),
  constraint marketplace_claim_evidence_note check (note is null or char_length(btrim(note)) between 3 and 500)
);

create table public.marketplace_returns (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null unique references public.marketplace_claims(id) on delete restrict,
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status public.marketplace_return_status not null default 'REQUESTED',
  shipping_responsibility public.marketplace_return_shipping_responsibility not null,
  carrier text,
  tracking_number text,
  label_status text not null default 'NOT_REQUESTED' check (label_status in ('NOT_REQUESTED','PENDING','READY','FAILED')),
  shipped_at timestamptz,
  received_at timestamptz,
  inspection_result text,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_return_shipping_fields check (
    (carrier is null or char_length(btrim(carrier)) between 2 and 80)
    and (tracking_number is null or char_length(btrim(tracking_number)) between 3 and 120)
    and (inspection_result is null or char_length(btrim(inspection_result)) between 3 and 2000)
  )
);

create table public.marketplace_return_events (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.marketplace_returns(id) on delete restrict,
  from_status public.marketplace_return_status,
  to_status public.marketplace_return_status not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null check (char_length(btrim(reason)) between 3 and 1000),
  idempotency_key uuid not null unique,
  created_at timestamptz not null default now()
);

create table public.marketplace_acceptance_job_runs (
  id uuid primary key default gen_random_uuid(),
  execution_key text not null unique,
  status public.marketplace_acceptance_job_status not null default 'RUNNING',
  processed_count integer not null default 0 check (processed_count >= 0),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  constraint marketplace_acceptance_job_completion check (
    (status = 'RUNNING' and completed_at is null)
    or (status = 'COMPLETED' and completed_at is not null and error_message is null)
  )
);

create index marketplace_acceptances_deadline_idx on public.marketplace_delivery_acceptances(acceptance_deadline) where status='PENDING';
create index marketplace_acceptances_buyer_idx on public.marketplace_delivery_acceptances(buyer_id, created_at desc);
create index marketplace_claims_buyer_idx on public.marketplace_claims(buyer_id, created_at desc);
create index marketplace_claims_partner_idx on public.marketplace_claims(partner_id, status, created_at desc);
create index marketplace_claims_operations_idx on public.marketplace_claims(status, opened_at);
create index marketplace_claim_events_claim_idx on public.marketplace_claim_events(claim_id, created_at);
create index marketplace_claim_evidence_claim_idx on public.marketplace_claim_evidence(claim_id, created_at);
create index marketplace_returns_status_idx on public.marketplace_returns(status, created_at);

create trigger marketplace_delivery_acceptances_set_updated_at before update on public.marketplace_delivery_acceptances for each row execute function public.set_updated_at();
create trigger marketplace_claims_set_updated_at before update on public.marketplace_claims for each row execute function public.set_updated_at();
create trigger marketplace_returns_set_updated_at before update on public.marketplace_returns for each row execute function public.set_updated_at();
create trigger marketplace_claim_events_immutable before update or delete on public.marketplace_claim_events for each row execute function public.reject_immutable_row_change();
create trigger marketplace_claim_resolutions_immutable before update or delete on public.marketplace_claim_resolutions for each row execute function public.reject_immutable_row_change();
create trigger marketplace_return_events_immutable before update or delete on public.marketplace_return_events for each row execute function public.reject_immutable_row_change();

create or replace function public.can_manage_marketplace_claims()
returns boolean language sql stable security definer set search_path='' as $$
  select public.can_manage_marketplace_orders() and public.can_manage_marketplace_payables()
$$;
revoke all on function public.can_manage_marketplace_claims() from public,anon;
grant execute on function public.can_manage_marketplace_claims() to authenticated;

-- PR6's aggregate trigger could move an order to PREPARING without populating
-- its mandatory confirmation actor. Preserve the aggregate semantics while
-- making an authenticated operational/Partner transition audit-consistent.
create or replace function private.sync_order_from_marketplace_fulfillments()
returns trigger language plpgsql security definer set search_path='' as $$
declare next_status public.order_status;
begin
  if exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id and f.status='CANCELLED') then
    update public.orders set marketplace_exception_status='PARTIAL_EXCEPTION' where id=new.order_id; return new;
  end if;
  if exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id and f.status='ON_HOLD') then
    update public.orders set marketplace_exception_status='ON_HOLD' where id=new.order_id; return new;
  end if;
  update public.orders set marketplace_exception_status='NONE' where id=new.order_id and marketplace_exception_status='ON_HOLD';
  if not exists(select 1 from public.order_payments p where p.order_id=new.order_id and p.status='paid') then return new; end if;
  if not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id and f.status not in('COMPLETED')) then next_status:='delivered';
  elsif not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id and f.status not in('SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED')) then next_status:='shipped';
  elsif not exists(select 1 from public.order_fulfillments f where f.order_id=new.order_id and f.status not in('CONFIRMED','PREPARING','READY_FOR_CARRIER','SHIPPED','DELIVERED','ACCEPTANCE_PENDING','COMPLETED')) then next_status:='preparing';
  else return new; end if;
  update public.orders set status=next_status,
    confirmed_at=case when next_status='preparing' then coalesce(confirmed_at,now()) else confirmed_at end,
    confirmed_by=case when next_status='preparing' then coalesce(confirmed_by,auth.uid()) else confirmed_by end,
    updated_by=coalesce(auth.uid(),updated_by),version=version+1
  where id=new.order_id and status is distinct from next_status
    and (next_status<>'preparing' or confirmed_by is not null or auth.uid() is not null);
  return new;
end $$;
revoke all on function private.sync_order_from_marketplace_fulfillments() from public,anon,authenticated,service_role;

create or replace function private.partner_owns_marketplace_claim(requested_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.marketplace_claims c
    join public.partner_profiles p on p.id=c.partner_id
    where c.id=requested_id and p.user_id=(select auth.uid()))
$$;
revoke all on function private.partner_owns_marketplace_claim(uuid) from public,anon,authenticated,service_role;
grant execute on function private.partner_owns_marketplace_claim(uuid) to authenticated;

create or replace function private.write_marketplace_claim_event(
  selected public.marketplace_claims, requested_type text,
  requested_from public.marketplace_claim_status,
  requested_to public.marketplace_claim_status, requested_actor uuid,
  requested_role text, requested_reason text, requested_key text,
  requested_metadata jsonb default '{}'::jsonb,
  requested_partner_visible boolean default true,
  requested_buyer_visible boolean default true
) returns public.marketplace_claim_events
language plpgsql security definer set search_path='' as $$
declare result public.marketplace_claim_events;
begin
  insert into public.marketplace_claim_events(claim_id,event_type,from_status,to_status,
    actor_id,actor_role,reason,idempotency_key,metadata,partner_visible,buyer_visible)
  values(selected.id,requested_type,requested_from,requested_to,requested_actor,
    requested_role,requested_reason,requested_key,coalesce(requested_metadata,'{}'::jsonb),
    requested_partner_visible,requested_buyer_visible)
  on conflict(idempotency_key) do nothing returning * into result;
  if result.id is null then
    select * into strict result from public.marketplace_claim_events where idempotency_key=requested_key;
  end if;
  return result;
end $$;
revoke all on function private.write_marketplace_claim_event(public.marketplace_claims,text,public.marketplace_claim_status,public.marketplace_claim_status,uuid,text,text,text,jsonb,boolean,boolean) from public,anon,authenticated,service_role;

create or replace function private.place_marketplace_claim_hold_internal(
  requested_payable_id uuid, requested_claim_id uuid, requested_reason text
) returns uuid language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_partner_payables; hold_id uuid;
  remaining bigint; pending_delta bigint:=0; available_delta bigint:=0;
  hold_key uuid:=private.marketplace_deterministic_uuid('claim-hold:'||requested_claim_id::text);
begin
  select * into selected from public.marketplace_partner_payables where id=requested_payable_id for update;
  if not found then raise exception 'Payable not found' using errcode='P0002'; end if;
  select id into hold_id from public.marketplace_partner_holds where placed_idempotency_key=hold_key;
  if hold_id is not null then return hold_id; end if;
  if selected.status not in ('PENDING','ON_HOLD','AVAILABLE') then raise exception 'Payable cannot be held' using errcode='22023'; end if;
  remaining:=selected.original_amount_cents-selected.reversed_amount_cents;
  perform set_config('peter_golf.partner_finance_write','enabled',true);
  insert into public.marketplace_partner_holds(payable_id,partner_id,source,reason,
    partner_visible,actor_id,placed_idempotency_key,metadata)
  values(selected.id,selected.partner_id,'CLAIM',requested_reason,true,null,hold_key,
    jsonb_build_object('claim_id',requested_claim_id)) returning id into hold_id;
  if selected.status<>'ON_HOLD' then
    if selected.status='PENDING' then pending_delta:=-remaining; else available_delta:=-remaining; end if;
    perform private.write_marketplace_partner_ledger_entry(selected,'PAYABLE_HELD','CLAIM',0,
      pending_delta,remaining,available_delta,0,0,requested_reason,null,requested_claim_id,
      'claim:hold:'||requested_claim_id::text,jsonb_build_object('claim_id',requested_claim_id));
    update public.marketplace_partner_payables set status='ON_HOLD',held_from_status=selected.status,
      version=version+1 where id=selected.id;
    select * into selected from public.marketplace_partner_payables where id=selected.id;
    perform private.write_marketplace_partner_payable_history(selected,selected.held_from_status,
      'ON_HOLD','CLAIM',null,requested_reason,'claim:hold:'||requested_claim_id::text,true);
  else
    perform private.write_marketplace_partner_ledger_entry(selected,'PAYABLE_HELD','CLAIM',0,
      0,0,0,0,0,requested_reason,null,requested_claim_id,
      'claim:hold:'||requested_claim_id::text,jsonb_build_object('additional_hold',true,'claim_id',requested_claim_id));
  end if;
  perform set_config('peter_golf.partner_finance_write','disabled',true);
  return hold_id;
exception when others then perform set_config('peter_golf.partner_finance_write','disabled',true); raise;
end $$;
revoke all on function private.place_marketplace_claim_hold_internal(uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function private.release_marketplace_claim_hold_internal(
  requested_hold_id uuid, requested_claim_id uuid, requested_reason text
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path='' as $$
declare h public.marketplace_partner_holds; selected public.marketplace_partner_payables;
  result public.marketplace_partner_payables; remaining bigint; pending_delta bigint:=0; available_delta bigint:=0;
  release_key uuid:=private.marketplace_deterministic_uuid('claim-hold-release:'||requested_claim_id::text);
begin
  select * into h from public.marketplace_partner_holds where id=requested_hold_id for update;
  if not found or h.source<>'CLAIM' or h.metadata->>'claim_id'<>requested_claim_id::text
    then raise exception 'Claim hold not found' using errcode='P0002'; end if;
  select * into strict selected from public.marketplace_partner_payables where id=h.payable_id for update;
  if h.status='RELEASED' then return selected; end if;
  perform set_config('peter_golf.partner_finance_write','enabled',true);
  update public.marketplace_partner_holds set status='RELEASED',released_at=now(),released_by=null,
    release_reason=requested_reason,release_idempotency_key=release_key where id=h.id;
  if not exists(select 1 from public.marketplace_partner_holds where payable_id=selected.id and status='ACTIVE') then
    remaining:=selected.original_amount_cents-selected.reversed_amount_cents;
    if selected.held_from_status='PENDING' then pending_delta:=remaining; else available_delta:=remaining; end if;
    perform private.write_marketplace_partner_ledger_entry(selected,'PAYABLE_HOLD_RELEASED','CLAIM',0,
      pending_delta,-remaining,available_delta,0,0,requested_reason,null,requested_claim_id,
      'claim:hold-release:'||requested_claim_id::text,jsonb_build_object('restored_status',selected.held_from_status));
    update public.marketplace_partner_payables set status=held_from_status,held_from_status=null,
      version=version+1 where id=selected.id returning * into result;
    perform private.write_marketplace_partner_payable_history(result,'ON_HOLD',result.status,'CLAIM',null,
      requested_reason,'claim:hold-release:'||requested_claim_id::text,true);
  else result:=selected; end if;
  perform set_config('peter_golf.partner_finance_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.partner_finance_write','disabled',true); raise;
end $$;
revoke all on function private.release_marketplace_claim_hold_internal(uuid,uuid,text) from public,anon,authenticated,service_role;

create or replace function private.release_marketplace_partner_payable_internal(
  requested_payable_id uuid, requested_basis public.marketplace_partner_release_basis,
  requested_actor_source public.marketplace_partner_finance_actor_source,
  requested_actor_id uuid, requested_reason text, requested_reference_event_id uuid,
  requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_partner_payables; result public.marketplace_partner_payables;
  remaining bigint; existing public.marketplace_partner_release_authorizations;
  fulfillment_status public.marketplace_fulfillment_status;
begin
  select * into selected from public.marketplace_partner_payables where id=requested_payable_id for update;
  if not found then raise exception 'Payable not found' using errcode='P0002'; end if;
  select * into existing from public.marketplace_partner_release_authorizations where idempotency_key=requested_idempotency_key;
  if found then
    if existing.payable_id<>selected.id or existing.basis<>requested_basis then raise exception 'Release idempotency key conflict' using errcode='23505'; end if;
    return selected;
  end if;
  if exists(select 1 from public.marketplace_partner_holds where payable_id=selected.id and status='ACTIVE')
    then raise exception 'Active hold blocks release' using errcode='23514'; end if;
  if selected.status<>'PENDING' then
    if selected.status='AVAILABLE' then return selected; end if;
    raise exception 'Payable is not pending' using errcode='22023';
  end if;
  select status into fulfillment_status from public.order_fulfillments where id=selected.fulfillment_id;
  if fulfillment_status not in ('DELIVERED','ACCEPTANCE_PENDING','COMPLETED') then raise exception 'Fulfillment lacks an explicit release condition' using errcode='23514'; end if;
  remaining:=selected.original_amount_cents-selected.reversed_amount_cents;
  perform set_config('peter_golf.partner_finance_write','enabled',true);
  insert into public.marketplace_partner_release_authorizations(payable_id,partner_id,basis,
    actor_source,actor_id,reason,reference_event_id,idempotency_key,consumed_at)
  values(selected.id,selected.partner_id,requested_basis,requested_actor_source,requested_actor_id,
    requested_reason,requested_reference_event_id,requested_idempotency_key,now());
  perform private.write_marketplace_partner_ledger_entry(selected,'PAYABLE_RELEASED',requested_actor_source,
    0,-remaining,0,remaining,0,0,requested_reason,requested_actor_id,requested_reference_event_id,
    'payable:release:'||requested_idempotency_key::text,jsonb_build_object('basis',requested_basis));
  update public.marketplace_partner_payables set status='AVAILABLE',version=version+1
    where id=selected.id returning * into result;
  perform set_config('peter_golf.partner_finance_write','disabled',true);
  perform private.write_marketplace_partner_payable_history(result,'PENDING','AVAILABLE',
    requested_actor_source,requested_actor_id,requested_reason,
    'payable:release:'||requested_idempotency_key::text);
  return result;
exception when others then perform set_config('peter_golf.partner_finance_write','disabled',true); raise;
end $$;
revoke all on function private.release_marketplace_partner_payable_internal(uuid,public.marketplace_partner_release_basis,public.marketplace_partner_finance_actor_source,uuid,text,uuid,uuid) from public,anon,authenticated,service_role;

-- Keep the PR7 public contract strict while centralizing the financial mutation.
create or replace function public.release_marketplace_partner_payable(
  requested_payable_id uuid, requested_basis public.marketplace_partner_release_basis,
  requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_payables() then raise exception 'Marketplace payable access denied' using errcode='42501'; end if;
  if requested_basis<>'OPERATIONS_APPROVED' or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Release authorization is invalid' using errcode='22023'; end if;
  return private.release_marketplace_partner_payable_internal(requested_payable_id,requested_basis,
    'OPERATIONS',auth.uid(),btrim(requested_reason),null,requested_idempotency_key);
end $$;

create or replace function public.record_marketplace_delivery(
  requested_fulfillment_id uuid, requested_delivered_at timestamptz,
  requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_delivery_acceptances
language plpgsql security definer set search_path='' as $$
declare f public.order_fulfillments; o public.orders; config_id uuid; window_hours integer;
  result public.marketplace_delivery_acceptances;
begin
  if not public.can_manage_marketplace_claims() then raise exception 'Marketplace claim access denied' using errcode='42501'; end if;
  if requested_idempotency_key is null or requested_delivered_at is null or requested_delivered_at>now()+interval '5 minutes'
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Delivery input is invalid' using errcode='22023'; end if;
  select * into f from public.order_fulfillments where id=requested_fulfillment_id and source='PARTNER' for update;
  if not found then raise exception 'Fulfillment not found' using errcode='P0002'; end if;
  select * into strict o from public.orders where id=f.order_id for update;
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  select acceptance_window_hours into strict window_hours from public.marketplace_operational_rules where config_version_id=config_id;
  select * into result from public.marketplace_delivery_acceptances where fulfillment_id=f.id;
  if found then return result; end if;
  if f.status not in ('SHIPPED','DELIVERED','ACCEPTANCE_PENDING') then raise exception 'Fulfillment is not deliverable' using errcode='22023'; end if;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  update public.order_fulfillments set status='ACCEPTANCE_PENDING',delivered_at=requested_delivered_at,
    acceptance_due_at=requested_delivered_at+make_interval(hours=>window_hours),version=version+1
    where id=f.id;
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  insert into public.marketplace_delivery_acceptances(fulfillment_id,order_id,buyer_id,partner_id,
    config_version_id,acceptance_window_hours,delivered_at,acceptance_deadline,idempotency_key,actor_id)
  values(f.id,f.order_id,o.user_id,f.partner_id,config_id,window_hours,requested_delivered_at,
    requested_delivered_at+make_interval(hours=>window_hours),requested_idempotency_key,auth.uid())
  returning * into result;
  return result;
exception when others then perform set_config('peter_golf.marketplace_order_write','disabled',true); raise;
end $$;

create or replace function private.accept_marketplace_delivery_internal(
  requested_acceptance_id uuid, requested_method public.marketplace_acceptance_status,
  requested_actor uuid, requested_idempotency_key uuid
) returns public.marketplace_delivery_acceptances
language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_delivery_acceptances; result public.marketplace_delivery_acceptances;
  payable public.marketplace_partner_payables; release_basis public.marketplace_partner_release_basis;
begin
  if requested_method not in ('BUYER_ACCEPTED','AUTO_ACCEPTED') then raise exception 'Acceptance method is invalid' using errcode='22023'; end if;
  select * into selected from public.marketplace_delivery_acceptances where id=requested_acceptance_id for update;
  if not found then raise exception 'Acceptance not found' using errcode='P0002'; end if;
  if selected.status=requested_method then return selected; end if;
  if selected.status<>'PENDING' then raise exception 'Acceptance is already finalized' using errcode='22023'; end if;
  if requested_method='BUYER_ACCEPTED' and now()>selected.acceptance_deadline then raise exception 'Acceptance window expired' using errcode='22023'; end if;
  if exists(select 1 from public.marketplace_claims where acceptance_id=selected.id and status not in('RESOLVED','CANCELLED'))
    then raise exception 'Open claim blocks acceptance' using errcode='23514'; end if;
  if exists(select 1 from public.order_fulfillments where id=selected.fulfillment_id and status='ON_HOLD')
    then raise exception 'Fulfillment hold blocks acceptance' using errcode='23514'; end if;
  if exists(select 1 from public.marketplace_partner_payables p join public.marketplace_partner_holds h on h.payable_id=p.id
    where p.fulfillment_id=selected.fulfillment_id and h.status='ACTIVE')
    then raise exception 'Financial hold blocks acceptance' using errcode='23514'; end if;
  release_basis:=case when requested_method='AUTO_ACCEPTED' then 'AUTO_ACCEPTED' else 'DELIVERY_ACCEPTED' end;
  for payable in select * from public.marketplace_partner_payables where fulfillment_id=selected.fulfillment_id order by id for update loop
    perform private.release_marketplace_partner_payable_internal(payable.id,release_basis,
      (case when requested_method='AUTO_ACCEPTED' then 'SYSTEM' else 'CLAIM' end)::public.marketplace_partner_finance_actor_source,
      requested_actor,'Entrega aceptada sin reclamo.',selected.id,
      private.marketplace_deterministic_uuid('acceptance-release:'||selected.id::text||':'||payable.id::text));
  end loop;
  update public.marketplace_delivery_acceptances set status=requested_method,accepted_at=now(),
    finalized_at=now(),actor_id=requested_actor,idempotency_key=coalesce(idempotency_key,requested_idempotency_key),
    version=version+1 where id=selected.id returning * into result;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  update public.order_fulfillments set status='COMPLETED',completed_at=now(),version=version+1
    where id=selected.fulfillment_id and status in('DELIVERED','ACCEPTANCE_PENDING');
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  return result;
exception when others then perform set_config('peter_golf.marketplace_order_write','disabled',true); raise;
end $$;
revoke all on function private.accept_marketplace_delivery_internal(uuid,public.marketplace_acceptance_status,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.accept_marketplace_delivery(
  requested_fulfillment_id uuid, requested_idempotency_key uuid
) returns public.marketplace_delivery_acceptances
language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_delivery_acceptances;
begin
  if requested_idempotency_key is null then
    raise exception 'Acceptance idempotency key is required' using errcode='22023';
  end if;
  select * into selected from public.marketplace_delivery_acceptances
    where fulfillment_id=requested_fulfillment_id and buyer_id=auth.uid();
  if not found or auth.uid() is null then raise exception 'Acceptance access denied' using errcode='42501'; end if;
  return private.accept_marketplace_delivery_internal(selected.id,'BUYER_ACCEPTED',auth.uid(),requested_idempotency_key);
end $$;

create or replace function public.set_marketplace_claim_evidence_partner_visibility(
  requested_evidence_id uuid, requested_partner_visible boolean,
  requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_claim_evidence language plpgsql security definer set search_path='' as $$
declare evidence public.marketplace_claim_evidence; selected public.marketplace_claims;
begin
  if not public.can_manage_marketplace_claims() or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Evidence visibility access denied' using errcode='42501'; end if;
  select * into evidence from public.marketplace_claim_evidence where id=requested_evidence_id for update;
  if not found then raise exception 'Evidence not found' using errcode='P0002'; end if;
  select * into strict selected from public.marketplace_claims where id=evidence.claim_id;
  if exists(select 1 from public.marketplace_claim_events
    where idempotency_key='claim:evidence-visibility:'||requested_idempotency_key::text)
  then return evidence; end if;
  if evidence.partner_visible=requested_partner_visible then return evidence; end if;
  update public.marketplace_claim_evidence set partner_visible=requested_partner_visible
    where id=evidence.id returning * into evidence;
  perform private.write_marketplace_claim_event(selected,'EVIDENCE_VISIBILITY_CHANGED',selected.status,
    selected.status,auth.uid(),'OPERATIONS',btrim(requested_reason),
    'claim:evidence-visibility:'||requested_idempotency_key::text,
    jsonb_build_object('evidence_id',evidence.id,'partner_visible',requested_partner_visible),false,false);
  return evidence;
end $$;

create or replace function public.transition_marketplace_return(
  requested_return_id uuid, requested_status public.marketplace_return_status,
  requested_carrier text, requested_tracking_number text,
  requested_inspection_result text, requested_reason text,
  requested_idempotency_key uuid
) returns public.marketplace_returns language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_returns; result public.marketplace_returns;
begin
  if not public.can_manage_marketplace_claims() or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Return transition access denied' using errcode='42501'; end if;
  select * into selected from public.marketplace_returns where id=requested_return_id for update;
  if not found then raise exception 'Return not found' using errcode='P0002'; end if;
  if exists(select 1 from public.marketplace_return_events
    where idempotency_key=requested_idempotency_key and return_id=selected.id)
  then return selected; end if;
  if exists(select 1 from public.marketplace_return_events where idempotency_key=requested_idempotency_key)
  then raise exception 'Return idempotency key belongs to another return' using errcode='23505'; end if;
  if not ((selected.status='AUTHORIZED' and requested_status='AWAITING_SHIPMENT')
    or (selected.status='AWAITING_SHIPMENT' and requested_status='IN_TRANSIT')
    or (selected.status='IN_TRANSIT' and requested_status='RECEIVED')
    or (selected.status='RECEIVED' and requested_status='INSPECTING')
    or (selected.status='INSPECTING' and requested_status in('ACCEPTED','REJECTED'))
    or (selected.status in('ACCEPTED','REJECTED') and requested_status='CLOSED'))
  then raise exception 'Return status transition is invalid' using errcode='22023'; end if;
  if requested_status='IN_TRANSIT' and
    (nullif(btrim(requested_carrier),'') is null or nullif(btrim(requested_tracking_number),'') is null)
  then raise exception 'Carrier and tracking are required' using errcode='22023'; end if;
  if requested_status in('ACCEPTED','REJECTED') and nullif(btrim(requested_inspection_result),'') is null
  then raise exception 'Inspection result is required' using errcode='22023'; end if;
  update public.marketplace_returns set status=requested_status,
    carrier=coalesce(nullif(btrim(requested_carrier),''),carrier),
    tracking_number=coalesce(nullif(btrim(requested_tracking_number),''),tracking_number),
    shipped_at=case when requested_status='IN_TRANSIT' then now() else shipped_at end,
    received_at=case when requested_status='RECEIVED' then now() else received_at end,
    inspection_result=coalesce(nullif(btrim(requested_inspection_result),''),inspection_result),
    version=version+1 where id=selected.id returning * into result;
  insert into public.marketplace_return_events(return_id,from_status,to_status,actor_id,reason,idempotency_key)
  values(selected.id,selected.status,requested_status,auth.uid(),btrim(requested_reason),requested_idempotency_key);
  update public.marketplace_claims set status=case
      when requested_status='IN_TRANSIT' then 'RETURN_IN_TRANSIT'::public.marketplace_claim_status
      when requested_status='RECEIVED' then 'RETURN_RECEIVED'::public.marketplace_claim_status
      else status end,
    version=version+1 where id=selected.claim_id and status not in('RESOLVED','CANCELLED');
  return result;
end $$;

create or replace function public.open_marketplace_claim(
  requested_order_item_id uuid, requested_reason public.marketplace_claim_reason,
  requested_description text, requested_idempotency_key uuid
) returns public.marketplace_claims
language plpgsql security definer set search_path='' as $$
declare acceptance_record public.marketplace_delivery_acceptances; snapshot public.marketplace_order_item_snapshots;
  payable public.marketplace_partner_payables; result public.marketplace_claims; hold_id uuid;
begin
  if auth.uid() is null or requested_reason='OTHER_MANUAL_REVIEW' or requested_idempotency_key is null
    or char_length(btrim(requested_description)) not between 10 and 2000
  then raise exception 'Claim input is invalid' using errcode='22023'; end if;
  select s.* into snapshot from public.marketplace_order_item_snapshots s where s.order_item_id=requested_order_item_id;
  if not found then raise exception 'Marketplace item not found' using errcode='P0002'; end if;
  select acceptance_row.* into acceptance_record from public.marketplace_delivery_acceptances acceptance_row
    where acceptance_row.fulfillment_id=snapshot.fulfillment_id and acceptance_row.buyer_id=auth.uid() for update;
  if not found then raise exception 'Claim access denied' using errcode='42501'; end if;
  select * into result from public.marketplace_claims where opened_idempotency_key=requested_idempotency_key;
  if found then return result; end if;
  if acceptance_record.status<>'PENDING' or now()>acceptance_record.acceptance_deadline then raise exception 'Claim window is closed' using errcode='22023'; end if;
  select * into strict payable from public.marketplace_partner_payables where order_item_id=snapshot.order_item_id for update;
  insert into public.marketplace_claims(acceptance_id,order_id,order_item_id,fulfillment_id,payable_id,
    buyer_id,partner_id,listing_version_id,reason,description,opened_idempotency_key)
  values(acceptance_record.id,acceptance_record.order_id,snapshot.order_item_id,acceptance_record.fulfillment_id,payable.id,acceptance_record.buyer_id,
    acceptance_record.partner_id,snapshot.listing_version_id,requested_reason,btrim(requested_description),requested_idempotency_key)
  returning * into result;
  hold_id:=private.place_marketplace_claim_hold_internal(payable.id,result.id,'Reclamo Marketplace en revisión.');
  update public.marketplace_claims set claim_hold_id=hold_id where id=result.id returning * into result;
  update public.marketplace_delivery_acceptances set status='PROBLEM_REPORTED',claim_opened_at=now(),
    version=version+1 where id=acceptance_record.id;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  update public.order_fulfillments set status='ON_HOLD',hold_reason='Reclamo Marketplace en revisión.',
    version=version+1 where id=acceptance_record.fulfillment_id;
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform private.write_marketplace_claim_event(result,'CLAIM_OPENED',null,'OPEN',auth.uid(),'BUYER',
    'Problema reportado por comprador.','claim:open:'||result.id::text,
    jsonb_build_object('reason',requested_reason));
  return result;
exception when others then perform set_config('peter_golf.marketplace_order_write','disabled',true); raise;
end $$;

create or replace function public.submit_marketplace_claim_partner_response(
  requested_claim_id uuid, requested_response text, requested_idempotency_key uuid
) returns public.marketplace_claims language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_claims;
begin
  if requested_idempotency_key is null or char_length(btrim(requested_response)) not between 10 and 2000
    or not private.partner_owns_marketplace_claim(requested_claim_id)
  then raise exception 'Claim response access denied' using errcode='42501'; end if;
  select * into selected from public.marketplace_claims where id=requested_claim_id for update;
  if selected.status in('RESOLVED','CANCELLED') then raise exception 'Claim is finalized' using errcode='22023'; end if;
  perform private.write_marketplace_claim_event(selected,'PARTNER_RESPONSE',selected.status,selected.status,
    auth.uid(),'PARTNER',btrim(requested_response),'claim:partner-response:'||requested_idempotency_key::text,'{}'::jsonb,true,false);
  return selected;
end $$;

create or replace function public.register_marketplace_claim_evidence(
  requested_claim_id uuid, requested_storage_path text, requested_mime_type text,
  requested_size_bytes integer, requested_note text, requested_idempotency_key uuid
) returns public.marketplace_claim_evidence language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_claims; result public.marketplace_claim_evidence; evidence_count integer;
begin
  select * into selected from public.marketplace_claims where id=requested_claim_id for update;
  if not found or auth.uid() is null or selected.buyer_id<>auth.uid() or selected.status in('RESOLVED','CANCELLED')
    then raise exception 'Evidence access denied' using errcode='42501'; end if;
  select count(*) into evidence_count from public.marketplace_claim_evidence where claim_id=selected.id;
  if evidence_count>=8 or requested_idempotency_key is null or requested_size_bytes not between 1 and 10485760
    or requested_mime_type not in('image/jpeg','image/png','image/webp')
    or requested_storage_path !~ ('^'||auth.uid()::text||'/'||selected.id::text||'/[0-9a-f-]{36}\.(jpg|jpeg|png|webp)$')
  then raise exception 'Evidence input is invalid' using errcode='22023'; end if;
  insert into public.marketplace_claim_evidence(claim_id,submitted_by,storage_path,mime_type,
    size_bytes,note,idempotency_key) values(selected.id,auth.uid(),requested_storage_path,
    requested_mime_type,requested_size_bytes,nullif(btrim(requested_note),''),requested_idempotency_key)
  on conflict(idempotency_key) do update set idempotency_key=excluded.idempotency_key returning * into result;
  return result;
end $$;

create or replace function public.resolve_marketplace_claim(
  requested_claim_id uuid, requested_decision public.marketplace_claim_decision,
  requested_responsibility public.marketplace_claim_responsibility,
  requested_adjustment_cents bigint, requested_return_requirement public.marketplace_return_requirement,
  requested_reason text, requested_evidence_summary text, requested_buyer_outcome text,
  requested_idempotency_key uuid
) returns public.marketplace_claims language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_claims; payable public.marketplace_partner_payables;
  result public.marketplace_claims; effect public.marketplace_claim_financial_effect;
  adjustment bigint; score_code text; score_value integer; config_id uuid;
begin
  if not public.can_manage_marketplace_claims() or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 2000
    or char_length(btrim(requested_evidence_summary)) not between 3 and 2000
    or char_length(btrim(requested_buyer_outcome)) not between 3 and 1000
  then raise exception 'Claim resolution access denied' using errcode='42501'; end if;
  select * into selected from public.marketplace_claims where id=requested_claim_id for update;
  if not found then raise exception 'Claim not found' using errcode='P0002'; end if;
  if exists(select 1 from public.marketplace_claim_resolutions
    where idempotency_key=requested_idempotency_key and claim_id=selected.id) then return selected; end if;
  if exists(select 1 from public.marketplace_claim_resolutions where idempotency_key=requested_idempotency_key)
    then raise exception 'Resolution idempotency key belongs to another claim' using errcode='23505'; end if;
  if selected.status in('RESOLVED','CANCELLED') then raise exception 'Claim is already finalized' using errcode='22023'; end if;
  select * into strict payable from public.marketplace_partner_payables where id=selected.payable_id for update;
  if requested_decision='REJECTED' then effect:='NONE'; adjustment:=null;
  elsif requested_decision='APPROVED' then effect:='FULL_REVERSAL'; adjustment:=null;
  else
    effect:='PARTIAL_REVERSAL'; adjustment:=requested_adjustment_cents;
    if adjustment is null or adjustment<=0 or adjustment>payable.original_amount_cents-payable.reversed_amount_cents
      then raise exception 'Partial adjustment is invalid' using errcode='22023'; end if;
  end if;
  if requested_decision<>'REJECTED' and requested_responsibility not in('PARTNER_RESPONSIBLE','BEST_ROUND_OPERATIONAL','INCONCLUSIVE')
    then raise exception 'Approval responsibility is invalid' using errcode='22023'; end if;
  insert into public.marketplace_claim_resolutions(claim_id,decision,responsibility,financial_effect,
    adjustment_amount_cents,return_requirement,buyer_outcome,evidence_summary,reason,actor_id,idempotency_key)
  values(selected.id,requested_decision,requested_responsibility,effect,adjustment,
    requested_return_requirement,btrim(requested_buyer_outcome),btrim(requested_evidence_summary),
    btrim(requested_reason),auth.uid(),requested_idempotency_key);
  if requested_return_requirement='RETURN_REQUIRED' then
    insert into public.marketplace_returns(claim_id,fulfillment_id,order_item_id,quantity,
      shipping_responsibility,status)
    select selected.id,selected.fulfillment_id,selected.order_item_id,s.quantity,
      case when requested_responsibility='PARTNER_RESPONSIBLE' then 'PARTNER_OR_BEST_ROUND'::public.marketplace_return_shipping_responsibility
        else 'MANUAL_REVIEW'::public.marketplace_return_shipping_responsibility end,
      'AUTHORIZED'
    from public.marketplace_order_item_snapshots s where s.order_item_id=selected.order_item_id
    on conflict(claim_id) do nothing;
  end if;
  if requested_decision in('REJECTED','PARTIALLY_APPROVED') then
    perform set_config('peter_golf.marketplace_order_write','enabled',true);
    update public.order_fulfillments set status='ACCEPTANCE_PENDING',hold_reason=null,
      version=version+1 where id=selected.fulfillment_id and status='ON_HOLD';
    perform set_config('peter_golf.marketplace_order_write','disabled',true);
  end if;
  if requested_decision='REJECTED' then
    perform private.release_marketplace_claim_hold_internal(selected.claim_hold_id,selected.id,'Reclamo rechazado; se retira únicamente el hold del reclamo.');
    if not exists(select 1 from public.marketplace_partner_holds where payable_id=payable.id and status='ACTIVE') then
      perform private.release_marketplace_partner_payable_internal(payable.id,'CLAIM_RESOLVED','CLAIM',auth.uid(),
        'Reclamo rechazado y obligación liberable.',selected.id,
        private.marketplace_deterministic_uuid('claim-rejected-release:'||selected.id::text));
    end if;
  else
    perform private.reverse_marketplace_partner_payable_internal(payable.id,
      (case when effect='FULL_REVERSAL' then payable.original_amount_cents-payable.reversed_amount_cents else adjustment end)::bigint,
      'CLAIM'::public.marketplace_partner_finance_actor_source,auth.uid(),btrim(requested_reason),selected.id,'claim:reversal:'||selected.id::text);
    if effect='PARTIAL_REVERSAL' then
      perform private.release_marketplace_claim_hold_internal(selected.claim_hold_id,selected.id,
        'Ajuste parcial registrado; se retira únicamente el hold del reclamo.');
      if not exists(select 1 from public.marketplace_partner_holds where payable_id=payable.id and status='ACTIVE') then
        perform private.release_marketplace_partner_payable_internal(payable.id,'CLAIM_RESOLVED','CLAIM',auth.uid(),
          'Reclamo parcial resuelto; remanente liberable.',selected.id,
          private.marketplace_deterministic_uuid('claim-partial-release:'||selected.id::text));
      end if;
    end if;
  end if;
  update public.marketplace_claims set status='RESOLVED',responsibility=requested_responsibility,
    financial_effect=effect,approved_adjustment_cents=adjustment,
    return_requirement=requested_return_requirement,
    refund_status=case when requested_decision='REJECTED' then 'REFUND_NOT_REQUIRED'::public.marketplace_refund_preparation_status else 'REFUND_REQUIRES_MANUAL_ACTION'::public.marketplace_refund_preparation_status end,
    finalized_at=now(),version=version+1 where id=selected.id returning * into result;
  update public.marketplace_delivery_acceptances set finalized_at=now(),version=version+1 where id=selected.acceptance_id;
  perform set_config('peter_golf.marketplace_order_write','enabled',true);
  update public.order_fulfillments set status=case when requested_decision='REJECTED' then 'COMPLETED'::public.marketplace_fulfillment_status else 'ON_HOLD'::public.marketplace_fulfillment_status end,
    completed_at=case when requested_decision='REJECTED' then now() else completed_at end,
    hold_reason=case when requested_decision='REJECTED' then null else 'Reclamo resuelto con excepción financiera.' end,
    version=version+1 where id=selected.fulfillment_id;
  perform set_config('peter_golf.marketplace_order_write','disabled',true);
  perform private.write_marketplace_claim_event(result,'CLAIM_RESOLVED',selected.status,'RESOLVED',auth.uid(),'OPERATIONS',
    requested_reason,'claim:resolution:'||requested_idempotency_key::text,
    jsonb_build_object('decision',requested_decision,'financial_effect',effect,'adjustment_cents',adjustment));
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  score_code:=case when requested_responsibility='PARTNER_RESPONSIBLE' then 'PARTNER_FAULT' else 'NO_PARTNER_FAULT' end;
  select score_bps into strict score_value from public.marketplace_score_outcome_rules
    where config_version_id=config_id and component='CLAIMS_RETURNS' and outcome_code=score_code;
  insert into public.partner_score_events(partner_id,component,outcome_code,score_bps,counts_completed_order,
    source,source_entity_type,source_entity_id,evidence,idempotency_key,occurred_at,recorded_by)
  values(selected.partner_id,'CLAIMS_RETURNS',score_code,score_value,false,'DISPUTE','marketplace_claim',selected.id,
    jsonb_build_object('reason',selected.reason,'responsibility',requested_responsibility),
    'claim-resolution:'||selected.id::text,now(),auth.uid()) on conflict(idempotency_key) do nothing;
  return result;
exception when others then perform set_config('peter_golf.marketplace_order_write','disabled',true); raise;
end $$;

create or replace function public.update_marketplace_claim_review(
  requested_claim_id uuid, requested_status public.marketplace_claim_status,
  requested_reason text, requested_idempotency_key uuid
) returns public.marketplace_claims language plpgsql security definer set search_path='' as $$
declare selected public.marketplace_claims; result public.marketplace_claims;
begin
  if not public.can_manage_marketplace_claims() or requested_status not in('UNDER_REVIEW','EVIDENCE_REQUESTED','PARTNER_RESPONSE_PENDING')
    or requested_idempotency_key is null or char_length(btrim(requested_reason)) not between 3 and 2000
  then raise exception 'Claim review access denied' using errcode='42501'; end if;
  select * into selected from public.marketplace_claims where id=requested_claim_id for update;
  if selected.status in('RESOLVED','CANCELLED') then raise exception 'Claim is finalized' using errcode='22023'; end if;
  if exists(select 1 from public.marketplace_claim_events
    where idempotency_key='claim:review:'||requested_idempotency_key::text)
  then return selected; end if;
  update public.marketplace_claims set status=requested_status,version=version+1 where id=selected.id returning * into result;
  perform private.write_marketplace_claim_event(result,'CLAIM_REVIEW_UPDATED',selected.status,requested_status,
    auth.uid(),'OPERATIONS',requested_reason,'claim:review:'||requested_idempotency_key::text);
  return result;
end $$;

create or replace function private.run_marketplace_acceptance_job_internal(
  requested_now timestamptz, requested_execution_key text
) returns public.marketplace_acceptance_job_runs
language plpgsql security definer set search_path='' as $$
declare job public.marketplace_acceptance_job_runs; a public.marketplace_delivery_acceptances; processed integer:=0;
begin
  if requested_now is null or requested_execution_key is null or char_length(requested_execution_key) not between 8 and 160
    then raise exception 'Acceptance job input is invalid' using errcode='22023'; end if;
  if not pg_try_advisory_xact_lock(hashtextextended('best-round-marketplace-delivery-auto-accept',0))
    then raise exception 'Acceptance job is already running' using errcode='55P03'; end if;
  select * into job from public.marketplace_acceptance_job_runs where execution_key=requested_execution_key;
  if found then return job; end if;
  insert into public.marketplace_acceptance_job_runs(execution_key) values(requested_execution_key) returning * into job;
  for a in select * from public.marketplace_delivery_acceptances x
    where x.status='PENDING' and x.acceptance_deadline<=requested_now
      and not exists(select 1 from public.marketplace_claims c where c.acceptance_id=x.id and c.status not in('RESOLVED','CANCELLED'))
      and not exists(select 1 from public.order_fulfillments f where f.id=x.fulfillment_id and f.status='ON_HOLD')
      and not exists(select 1 from public.marketplace_partner_payables p join public.marketplace_partner_holds h on h.payable_id=p.id where p.fulfillment_id=x.fulfillment_id and h.status='ACTIVE')
    order by x.acceptance_deadline,x.id for update skip locked
  loop
    perform private.accept_marketplace_delivery_internal(a.id,'AUTO_ACCEPTED',null,
      private.marketplace_deterministic_uuid('auto-accept:'||a.id::text));
    processed:=processed+1;
  end loop;
  update public.marketplace_acceptance_job_runs set status='COMPLETED',processed_count=processed,
    completed_at=now() where id=job.id returning * into job;
  return job;
end $$;
revoke all on function private.run_marketplace_acceptance_job_internal(timestamptz,text) from public,anon,authenticated,service_role;

create or replace function public.run_marketplace_acceptance_job(
  requested_now timestamptz, requested_execution_key text
) returns public.marketplace_acceptance_job_runs language plpgsql security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_claims() then raise exception 'Acceptance job access denied' using errcode='42501'; end if;
  return private.run_marketplace_acceptance_job_internal(requested_now,requested_execution_key);
end $$;

create or replace function public.get_customer_marketplace_claim_context(requested_order_id uuid)
returns table(fulfillment_id uuid,order_item_id uuid,listing_title text,fulfillment_status public.marketplace_fulfillment_status,
  acceptance_status public.marketplace_acceptance_status,acceptance_deadline timestamptz,claim_id uuid,
  claim_status public.marketplace_claim_status,claim_reason public.marketplace_claim_reason)
language sql stable security definer set search_path='' as $$
  select f.id,s.order_item_id,s.listing_title,f.status,a.status,a.acceptance_deadline,c.id,c.status,c.reason
  from public.orders o join public.order_fulfillments f on f.order_id=o.id and f.source='PARTNER'
  join public.marketplace_order_item_snapshots s on s.fulfillment_id=f.id
  left join public.marketplace_delivery_acceptances a on a.fulfillment_id=f.id
  left join lateral(select * from public.marketplace_claims x where x.order_item_id=s.order_item_id order by x.created_at desc limit 1)c on true
  where o.id=requested_order_id and o.user_id=auth.uid()
$$;

create or replace function public.get_partner_marketplace_claims(requested_claim_id uuid default null)
returns setof public.marketplace_claims language sql stable security definer set search_path='' as $$
  select c.* from public.marketplace_claims c join public.partner_profiles p on p.id=c.partner_id
  where p.user_id=auth.uid() and (requested_claim_id is null or c.id=requested_claim_id)
  order by c.created_at desc
$$;

create or replace function public.get_marketplace_claims_for_operations(requested_claim_id uuid default null)
returns setof public.marketplace_claims language plpgsql stable security definer set search_path='' as $$
begin
  if not public.can_manage_marketplace_claims() then raise exception 'Marketplace claim access denied' using errcode='42501'; end if;
  return query select * from public.marketplace_claims c where requested_claim_id is null or c.id=requested_claim_id order by c.created_at desc;
end $$;

-- Private evidence bucket. The application validates binary signatures before upload.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('marketplace-claim-evidence','marketplace-claim-evidence',false,10485760,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

alter table public.marketplace_delivery_acceptances enable row level security;
alter table public.marketplace_claims enable row level security;
alter table public.marketplace_claim_events enable row level security;
alter table public.marketplace_claim_resolutions enable row level security;
alter table public.marketplace_claim_evidence enable row level security;
alter table public.marketplace_returns enable row level security;
alter table public.marketplace_return_events enable row level security;
alter table public.marketplace_acceptance_job_runs enable row level security;

create policy "Buyers read own delivery acceptances" on public.marketplace_delivery_acceptances for select to authenticated using(buyer_id=auth.uid());
create policy "Partners read own delivery acceptances" on public.marketplace_delivery_acceptances for select to authenticated using(exists(select 1 from public.partner_profiles p where p.id=partner_id and p.user_id=auth.uid()));
create policy "Claim staff read delivery acceptances" on public.marketplace_delivery_acceptances for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Buyers read own claims" on public.marketplace_claims for select to authenticated using(buyer_id=auth.uid());
create policy "Partners read own claims" on public.marketplace_claims for select to authenticated using(private.partner_owns_marketplace_claim(id));
create policy "Claim staff read claims" on public.marketplace_claims for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Buyers read own claim events" on public.marketplace_claim_events for select to authenticated using(buyer_visible and exists(select 1 from public.marketplace_claims c where c.id=claim_id and c.buyer_id=auth.uid()));
create policy "Partners read visible own claim events" on public.marketplace_claim_events for select to authenticated using(partner_visible and private.partner_owns_marketplace_claim(claim_id));
create policy "Claim staff read claim events" on public.marketplace_claim_events for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Claim staff read resolutions" on public.marketplace_claim_resolutions for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Buyers read own resolutions" on public.marketplace_claim_resolutions for select to authenticated using(exists(select 1 from public.marketplace_claims c where c.id=claim_id and c.buyer_id=auth.uid()));
create policy "Partners read own resolutions" on public.marketplace_claim_resolutions for select to authenticated using(private.partner_owns_marketplace_claim(claim_id));
create policy "Buyers read own evidence" on public.marketplace_claim_evidence for select to authenticated using(submitted_by=auth.uid());
create policy "Partners read visible own evidence" on public.marketplace_claim_evidence for select to authenticated using(partner_visible and private.partner_owns_marketplace_claim(claim_id));
create policy "Claim staff read evidence" on public.marketplace_claim_evidence for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Claim parties read returns" on public.marketplace_returns for select to authenticated using(exists(select 1 from public.marketplace_claims c where c.id=claim_id and (c.buyer_id=auth.uid() or private.partner_owns_marketplace_claim(c.id))) or public.can_manage_marketplace_claims());
create policy "Claim staff read return events" on public.marketplace_return_events for select to authenticated using(public.can_manage_marketplace_claims());
create policy "Claim staff read acceptance jobs" on public.marketplace_acceptance_job_runs for select to authenticated using(public.can_manage_marketplace_claims());

create policy "Claim owners upload evidence objects" on storage.objects for insert to authenticated with check(
  bucket_id='marketplace-claim-evidence' and (storage.foldername(name))[1]=auth.uid()::text
  and exists(select 1 from public.marketplace_claims c where c.id=((storage.foldername(name))[2])::uuid and c.buyer_id=auth.uid() and c.status not in('RESOLVED','CANCELLED'))
);
create policy "Claim owners read evidence objects" on storage.objects for select to authenticated using(
  bucket_id='marketplace-claim-evidence' and (storage.foldername(name))[1]=auth.uid()::text
);
create policy "Claim staff read evidence objects" on storage.objects for select to authenticated using(
  bucket_id='marketplace-claim-evidence' and public.can_manage_marketplace_claims()
);
create policy "Partners read permitted evidence objects" on storage.objects for select to authenticated using(
  bucket_id='marketplace-claim-evidence' and exists(select 1 from public.marketplace_claim_evidence e
    where e.storage_path=name and e.partner_visible and private.partner_owns_marketplace_claim(e.claim_id))
);

revoke all on public.marketplace_delivery_acceptances,public.marketplace_claims,
  public.marketplace_claim_events,public.marketplace_claim_resolutions,
  public.marketplace_claim_evidence,public.marketplace_returns,
  public.marketplace_return_events,public.marketplace_acceptance_job_runs
from public,anon,authenticated;
grant select on public.marketplace_delivery_acceptances,public.marketplace_claims,
  public.marketplace_claim_events,public.marketplace_claim_resolutions,
  public.marketplace_claim_evidence,public.marketplace_returns,
  public.marketplace_return_events,public.marketplace_acceptance_job_runs to authenticated;

revoke all on function public.record_marketplace_delivery(uuid,timestamptz,text,uuid),
  public.accept_marketplace_delivery(uuid,uuid),
  public.open_marketplace_claim(uuid,public.marketplace_claim_reason,text,uuid),
  public.submit_marketplace_claim_partner_response(uuid,text,uuid),
  public.register_marketplace_claim_evidence(uuid,text,text,integer,text,uuid),
  public.set_marketplace_claim_evidence_partner_visibility(uuid,boolean,text,uuid),
  public.transition_marketplace_return(uuid,public.marketplace_return_status,text,text,text,text,uuid),
  public.resolve_marketplace_claim(uuid,public.marketplace_claim_decision,public.marketplace_claim_responsibility,bigint,public.marketplace_return_requirement,text,text,text,uuid),
  public.update_marketplace_claim_review(uuid,public.marketplace_claim_status,text,uuid),
  public.run_marketplace_acceptance_job(timestamptz,text),
  public.get_customer_marketplace_claim_context(uuid),
  public.get_partner_marketplace_claims(uuid),
  public.get_marketplace_claims_for_operations(uuid)
from public,anon;
grant execute on function public.record_marketplace_delivery(uuid,timestamptz,text,uuid),
  public.accept_marketplace_delivery(uuid,uuid),
  public.open_marketplace_claim(uuid,public.marketplace_claim_reason,text,uuid),
  public.submit_marketplace_claim_partner_response(uuid,text,uuid),
  public.register_marketplace_claim_evidence(uuid,text,text,integer,text,uuid),
  public.set_marketplace_claim_evidence_partner_visibility(uuid,boolean,text,uuid),
  public.transition_marketplace_return(uuid,public.marketplace_return_status,text,text,text,text,uuid),
  public.resolve_marketplace_claim(uuid,public.marketplace_claim_decision,public.marketplace_claim_responsibility,bigint,public.marketplace_return_requirement,text,text,text,uuid),
  public.update_marketplace_claim_review(uuid,public.marketplace_claim_status,text,uuid),
  public.run_marketplace_acceptance_job(timestamptz,text),
  public.get_customer_marketplace_claim_context(uuid),
  public.get_partner_marketplace_claims(uuid),
  public.get_marketplace_claims_for_operations(uuid)
to authenticated;

do $$ begin
  if exists(select 1 from cron.job where jobname='best-round-marketplace-delivery-auto-accept-hourly') then
    perform cron.unschedule('best-round-marketplace-delivery-auto-accept-hourly');
  end if;
  perform cron.schedule('best-round-marketplace-delivery-auto-accept-hourly','0 * * * *',
    $cron$select private.run_marketplace_acceptance_job_internal(
      now(), 'auto-accept:' || to_char(now() at time zone 'UTC','YYYY-MM-DD"T"HH24'))$cron$);
end $$;
