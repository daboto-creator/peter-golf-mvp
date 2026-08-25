-- Marketplace Partner payables and append-only ledger foundation.
-- Financial truth is copied exactly from PR6 immutable order snapshots. No
-- current tier, pricing rule, or Marketplace configuration is consulted here.

create type public.marketplace_partner_payable_status as enum (
  'PENDING', 'ON_HOLD', 'AVAILABLE', 'PAID', 'REVERSED'
);
create type public.marketplace_partner_ledger_entry_type as enum (
  'PAYABLE_CREATED', 'PAYABLE_HELD', 'PAYABLE_HOLD_RELEASED',
  'PAYABLE_RELEASED', 'PAYABLE_REVERSED', 'PAYABLE_PAID',
  'PAYABLE_ADJUSTED'
);
create type public.marketplace_partner_hold_source as enum (
  'SYSTEM', 'OPERATIONS', 'RISK', 'CLAIM', 'RECONCILIATION'
);
create type public.marketplace_partner_hold_status as enum ('ACTIVE', 'RELEASED');
create type public.marketplace_partner_release_basis as enum (
  'DELIVERY_ACCEPTED', 'AUTO_ACCEPTED', 'CLAIM_RESOLVED',
  'OPERATIONS_APPROVED'
);
create type public.marketplace_partner_finance_actor_source as enum (
  'PAYMENT', 'SYSTEM', 'OPERATIONS', 'RISK', 'CLAIM',
  'RECONCILIATION', 'PAYOUT'
);

create table public.marketplace_partner_payables (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.marketplace_order_item_snapshots(order_item_id) on delete restrict,
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete restrict,
  payment_id uuid not null references public.order_payments(id) on delete restrict,
  pricing_quote_id uuid not null references public.marketplace_pricing_quotes(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  original_amount_cents public.money_minor_units not null check (original_amount_cents >= 0),
  reversed_amount_cents public.money_minor_units not null default 0
    check (reversed_amount_cents >= 0),
  status public.marketplace_partner_payable_status not null default 'PENDING',
  held_from_status public.marketplace_partner_payable_status,
  currency public.iso_currency_code not null default 'MXN',
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_partner_payables_one_obligation unique (order_item_id),
  constraint marketplace_partner_payables_amount_bounds check (
    reversed_amount_cents <= original_amount_cents
  ),
  constraint marketplace_partner_payables_mxn_only check (currency = 'MXN'),
  constraint marketplace_partner_payables_hold_state check (
    (status = 'ON_HOLD' and held_from_status in ('PENDING', 'AVAILABLE'))
    or (status <> 'ON_HOLD' and held_from_status is null)
  ),
  constraint marketplace_partner_payables_reversed_state check (
    (status = 'REVERSED') = (reversed_amount_cents = original_amount_cents)
  )
);

create table public.marketplace_partner_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  order_item_id uuid not null references public.order_items(id) on delete restrict,
  fulfillment_id uuid not null references public.order_fulfillments(id) on delete restrict,
  entry_type public.marketplace_partner_ledger_entry_type not null,
  actor_source public.marketplace_partner_finance_actor_source not null,
  amount_cents bigint not null,
  pending_delta_cents bigint not null default 0,
  on_hold_delta_cents bigint not null default 0,
  available_delta_cents bigint not null default 0,
  paid_delta_cents bigint not null default 0,
  reversed_delta_cents bigint not null default 0,
  currency public.iso_currency_code not null default 'MXN',
  reason text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reference_event_id uuid,
  idempotency_key text not null unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_ledger_reason_length
    check (char_length(btrim(reason)) between 3 and 1000),
  constraint marketplace_partner_ledger_mxn_only check (currency = 'MXN'),
  constraint marketplace_partner_ledger_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint marketplace_partner_ledger_amount_conservation check (
    amount_cents = pending_delta_cents + on_hold_delta_cents
      + available_delta_cents + paid_delta_cents
  ),
  constraint marketplace_partner_ledger_reversal_reporting check (
    reversed_delta_cents >= 0
    and (entry_type = 'PAYABLE_REVERSED' or reversed_delta_cents = 0)
  )
);

create table public.marketplace_partner_payable_status_history (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  from_status public.marketplace_partner_payable_status,
  to_status public.marketplace_partner_payable_status not null,
  amount_remaining_cents public.money_minor_units not null check (amount_remaining_cents >= 0),
  actor_source public.marketplace_partner_finance_actor_source not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  partner_visible boolean not null default true,
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_payable_history_change
    check (from_status is null or from_status <> to_status),
  constraint marketplace_partner_payable_history_reason
    check (char_length(btrim(reason)) between 3 and 1000)
);

create table public.marketplace_partner_holds (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  source public.marketplace_partner_hold_source not null,
  status public.marketplace_partner_hold_status not null default 'ACTIVE',
  reason text not null,
  partner_visible boolean not null default false,
  actor_id uuid references public.profiles(id) on delete set null,
  placed_idempotency_key uuid not null unique,
  released_at timestamptz,
  released_by uuid references public.profiles(id) on delete set null,
  release_reason text,
  release_idempotency_key uuid unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_holds_reason
    check (char_length(btrim(reason)) between 3 and 1000),
  constraint marketplace_partner_holds_release_reason
    check (release_reason is null or char_length(btrim(release_reason)) between 3 and 1000),
  constraint marketplace_partner_holds_metadata_object
    check (jsonb_typeof(metadata) = 'object'),
  constraint marketplace_partner_holds_release_state check (
    (status = 'ACTIVE' and released_at is null and released_by is null
      and release_reason is null and release_idempotency_key is null)
    or (status = 'RELEASED' and released_at is not null
      and release_reason is not null and release_idempotency_key is not null)
  )
);

create table public.marketplace_partner_release_authorizations (
  id uuid primary key default gen_random_uuid(),
  payable_id uuid not null references public.marketplace_partner_payables(id) on delete restrict,
  partner_id uuid not null references public.partner_profiles(id) on delete restrict,
  basis public.marketplace_partner_release_basis not null,
  actor_source public.marketplace_partner_finance_actor_source not null,
  actor_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  reference_event_id uuid,
  idempotency_key uuid not null unique,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_partner_release_authorization_reason
    check (char_length(btrim(reason)) between 3 and 1000)
);

create index marketplace_partner_payables_partner_status_idx
  on public.marketplace_partner_payables(partner_id, status, created_at desc);
create index marketplace_partner_payables_order_idx
  on public.marketplace_partner_payables(order_id, order_item_id);
create index marketplace_partner_payables_fulfillment_idx
  on public.marketplace_partner_payables(fulfillment_id, status);
create index marketplace_partner_payables_payout_ready_idx
  on public.marketplace_partner_payables(partner_id, created_at, id)
  where status = 'AVAILABLE';
create index marketplace_partner_ledger_partner_created_idx
  on public.marketplace_partner_ledger_entries(partner_id, created_at desc, id);
create index marketplace_partner_ledger_payable_idx
  on public.marketplace_partner_ledger_entries(payable_id, created_at, id);
create index marketplace_partner_payable_history_idx
  on public.marketplace_partner_payable_status_history(payable_id, created_at, id);
create index marketplace_partner_holds_active_idx
  on public.marketplace_partner_holds(payable_id, created_at)
  where status = 'ACTIVE';
create index marketplace_partner_holds_partner_idx
  on public.marketplace_partner_holds(partner_id, status, created_at desc);
create index marketplace_partner_release_authorizations_idx
  on public.marketplace_partner_release_authorizations(payable_id, created_at desc);

create trigger marketplace_partner_payables_set_updated_at
before update on public.marketplace_partner_payables
for each row execute function public.set_updated_at();
create trigger marketplace_partner_ledger_immutable
before update or delete on public.marketplace_partner_ledger_entries
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_partner_payable_history_immutable
before update or delete on public.marketplace_partner_payable_status_history
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_partner_release_authorizations_immutable
before update or delete on public.marketplace_partner_release_authorizations
for each row execute function public.reject_immutable_row_change();

create or replace function public.can_manage_marketplace_payables()
returns boolean language sql stable security definer set search_path = '' as $$
  select public.can_manage_marketplace_orders()
    and public.can_manage_marketplace_pricing();
$$;
revoke all on function public.can_manage_marketplace_payables() from public, anon;
grant execute on function public.can_manage_marketplace_payables() to authenticated;

create or replace function private.guard_marketplace_partner_finance_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_setting('peter_golf.partner_finance_write', true) <> 'enabled' then
    raise exception 'Partner finance writes require an authorized executor'
      using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.guard_marketplace_partner_finance_write()
from public, anon, authenticated, service_role;

create trigger marketplace_partner_payables_require_executor
before insert or update or delete on public.marketplace_partner_payables
for each row execute function private.guard_marketplace_partner_finance_write();
create trigger marketplace_partner_holds_require_executor
before insert or update or delete on public.marketplace_partner_holds
for each row execute function private.guard_marketplace_partner_finance_write();

create or replace function private.partner_owns_marketplace_payable(requested_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.marketplace_partner_payables p
    join public.partner_profiles pp on pp.id = p.partner_id
    where p.id = requested_id and pp.user_id = (select auth.uid())
  );
$$;
revoke all on function private.partner_owns_marketplace_payable(uuid)
from public, anon, authenticated, service_role;
grant execute on function private.partner_owns_marketplace_payable(uuid) to authenticated;

create or replace function private.write_marketplace_partner_ledger_entry(
  requested_payable public.marketplace_partner_payables,
  requested_entry_type public.marketplace_partner_ledger_entry_type,
  requested_actor_source public.marketplace_partner_finance_actor_source,
  requested_amount_cents numeric,
  requested_pending_delta numeric,
  requested_on_hold_delta numeric,
  requested_available_delta numeric,
  requested_paid_delta numeric,
  requested_reversed_delta numeric,
  requested_reason text,
  requested_actor_id uuid,
  requested_reference_event_id uuid,
  requested_idempotency_key text,
  requested_metadata jsonb default '{}'::jsonb
) returns public.marketplace_partner_ledger_entries
language plpgsql security definer set search_path = '' as $$
declare result public.marketplace_partner_ledger_entries;
begin
  if requested_idempotency_key is null or char_length(requested_idempotency_key) not between 8 and 240
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Ledger entry input is invalid' using errcode = '22023'; end if;
  insert into public.marketplace_partner_ledger_entries(
    payable_id, partner_id, order_id, order_item_id, fulfillment_id,
    entry_type, actor_source, amount_cents, pending_delta_cents,
    on_hold_delta_cents, available_delta_cents, paid_delta_cents,
    reversed_delta_cents, currency, reason, actor_id, reference_event_id,
    idempotency_key, metadata
  ) values (
    requested_payable.id, requested_payable.partner_id, requested_payable.order_id,
    requested_payable.order_item_id, requested_payable.fulfillment_id,
    requested_entry_type, requested_actor_source, requested_amount_cents,
    requested_pending_delta, requested_on_hold_delta,
    requested_available_delta, requested_paid_delta, requested_reversed_delta,
    requested_payable.currency, btrim(requested_reason), requested_actor_id,
    requested_reference_event_id, requested_idempotency_key,
    coalesce(requested_metadata, '{}'::jsonb)
  ) on conflict(idempotency_key) do nothing returning * into result;
  if result.id is null then
    select * into strict result from public.marketplace_partner_ledger_entries
      where idempotency_key = requested_idempotency_key;
    if result.payable_id <> requested_payable.id
      or result.entry_type <> requested_entry_type
      or result.amount_cents <> requested_amount_cents
    then raise exception 'Ledger idempotency key conflict' using errcode = '23505'; end if;
  end if;
  return result;
end;
$$;
revoke all on function private.write_marketplace_partner_ledger_entry(
  public.marketplace_partner_payables,
  public.marketplace_partner_ledger_entry_type,
  public.marketplace_partner_finance_actor_source,
  numeric,numeric,numeric,numeric,numeric,numeric,text,uuid,uuid,text,jsonb
) from public, anon, authenticated, service_role;

create or replace function private.write_marketplace_partner_payable_history(
  requested_payable public.marketplace_partner_payables,
  requested_from public.marketplace_partner_payable_status,
  requested_to public.marketplace_partner_payable_status,
  requested_actor_source public.marketplace_partner_finance_actor_source,
  requested_actor_id uuid,
  requested_reason text,
  requested_idempotency_key text,
  requested_partner_visible boolean default true
) returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.marketplace_partner_payable_status_history(
    payable_id, partner_id, from_status, to_status, amount_remaining_cents,
    actor_source, actor_id, reason, partner_visible, idempotency_key
  ) values (
    requested_payable.id, requested_payable.partner_id, requested_from,
    requested_to,
    requested_payable.original_amount_cents - requested_payable.reversed_amount_cents,
    requested_actor_source, requested_actor_id, btrim(requested_reason),
    requested_partner_visible,
    requested_idempotency_key
  ) on conflict(idempotency_key) do nothing;
end;
$$;
revoke all on function private.write_marketplace_partner_payable_history(
  public.marketplace_partner_payables, public.marketplace_partner_payable_status,
  public.marketplace_partner_payable_status,
  public.marketplace_partner_finance_actor_source, uuid, text, text, boolean
) from public, anon, authenticated, service_role;

create or replace function private.create_marketplace_partner_payables_internal(
  requested_order_id uuid,
  requested_payment_id uuid,
  requested_reference_key text
) returns integer
language plpgsql security definer set search_path = '' as $$
declare snapshot_record record; payable_record public.marketplace_partner_payables;
  payment_record public.order_payments; created_count integer := 0;
begin
  perform pg_advisory_xact_lock(hashtextextended('partner-payables:' || requested_order_id::text, 0));
  select * into payment_record from public.order_payments
    where id = requested_payment_id and order_id = requested_order_id and status = 'paid';
  if not found then return 0; end if;
  perform set_config('peter_golf.partner_finance_write', 'enabled', true);
  for snapshot_record in
    select s.*
    from public.marketplace_order_item_snapshots s
    join public.order_items oi on oi.id = s.order_item_id and oi.order_id = requested_order_id
    join public.order_fulfillments f on f.id = s.fulfillment_id
    join public.inventory_reservations r on r.order_item_id = s.order_item_id
    where f.order_id = requested_order_id and f.activated_at is not null
      and r.status = 'COMMITTED'
    order by s.order_item_id
  loop
    payable_record := null;
    insert into public.marketplace_partner_payables(
      partner_id, order_id, order_item_id, fulfillment_id, payment_id,
      pricing_quote_id, quantity, original_amount_cents, currency
    ) values (
      snapshot_record.partner_id, requested_order_id, snapshot_record.order_item_id,
      snapshot_record.fulfillment_id, requested_payment_id,
      snapshot_record.pricing_quote_id, snapshot_record.quantity,
      snapshot_record.estimated_partner_net, snapshot_record.currency
    ) on conflict(order_item_id) do nothing returning * into payable_record;
    if payable_record.id is not null then
      perform private.write_marketplace_partner_ledger_entry(
        payable_record, 'PAYABLE_CREATED', 'PAYMENT',
        payable_record.original_amount_cents, payable_record.original_amount_cents,
        0, 0, 0, 0, 'Pago confirmado; obligación Partner registrada.',
        null, requested_payment_id,
        'payable:create:' || snapshot_record.order_item_id::text,
        jsonb_build_object('payment_id', requested_payment_id,
          'reference_key', requested_reference_key)
      );
      perform private.write_marketplace_partner_payable_history(
        payable_record, null, 'PENDING', 'PAYMENT', null,
        'Pago confirmado; obligación Partner registrada.',
        'payable:create:' || snapshot_record.order_item_id::text
      );
      perform private.write_marketplace_audit(
        'marketplace.partner_payable_created', 'marketplace_partner_payable',
        payable_record.id, 'Obligación creada desde snapshot inmutable de orden.',
        null, jsonb_build_object('order_id', requested_order_id,
          'order_item_id', snapshot_record.order_item_id,
          'amount_cents', payable_record.original_amount_cents)
      );
      created_count := created_count + 1;
    end if;
  end loop;
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  return created_count;
exception when others then
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  raise;
end;
$$;
revoke all on function private.create_marketplace_partner_payables_internal(uuid,uuid,text)
from public, anon, authenticated, service_role;

create or replace function private.reverse_marketplace_partner_payable_internal(
  requested_payable_id uuid,
  requested_amount_cents bigint,
  requested_actor_source public.marketplace_partner_finance_actor_source,
  requested_actor_id uuid,
  requested_reason text,
  requested_reference_event_id uuid,
  requested_idempotency_key text
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path = '' as $$
declare selected public.marketplace_partner_payables; result public.marketplace_partner_payables;
  remaining bigint; pending_delta bigint := 0; hold_delta bigint := 0;
  available_delta bigint := 0; next_status public.marketplace_partner_payable_status;
begin
  select * into selected from public.marketplace_partner_payables
    where id = requested_payable_id for update;
  if not found then raise exception 'Payable not found' using errcode = 'P0002'; end if;
  if exists(select 1 from public.marketplace_partner_ledger_entries
    where idempotency_key = requested_idempotency_key)
  then return selected; end if;
  remaining := selected.original_amount_cents - selected.reversed_amount_cents;
  if requested_amount_cents <= 0 or requested_amount_cents > remaining
  then raise exception 'Reversal amount is invalid' using errcode = '22023'; end if;
  if selected.status not in ('PENDING','ON_HOLD','AVAILABLE')
  then raise exception 'Payable cannot be reversed' using errcode = '22023'; end if;
  if selected.status = 'PENDING' then pending_delta := -requested_amount_cents;
  elsif selected.status = 'ON_HOLD' then hold_delta := -requested_amount_cents;
  else available_delta := -requested_amount_cents; end if;
  next_status := case when requested_amount_cents = remaining then 'REVERSED'
    else selected.status end;
  perform private.write_marketplace_partner_ledger_entry(
    selected, 'PAYABLE_REVERSED', requested_actor_source,
    -requested_amount_cents, pending_delta, hold_delta, available_delta, 0,
    requested_amount_cents, requested_reason, requested_actor_id,
    requested_reference_event_id, requested_idempotency_key,
    jsonb_build_object('partial', requested_amount_cents < remaining)
  );
  perform set_config('peter_golf.partner_finance_write', 'enabled', true);
  update public.marketplace_partner_payables set
    reversed_amount_cents = reversed_amount_cents + requested_amount_cents,
    status = next_status,
    held_from_status = case when next_status = 'REVERSED' then null else held_from_status end,
    version = version + 1
  where id = selected.id returning * into result;
  if next_status = 'REVERSED' and selected.status = 'ON_HOLD' then
    update public.marketplace_partner_holds set status = 'RELEASED',
      released_at = now(), released_by = requested_actor_id,
      release_reason = 'Payable revertido por completo.',
      release_idempotency_key = private.marketplace_deterministic_uuid(
        requested_idempotency_key || ':hold:' || id::text)
    where payable_id = selected.id and status = 'ACTIVE';
  end if;
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  if next_status is distinct from selected.status then
    perform private.write_marketplace_partner_payable_history(
      result, selected.status, next_status, requested_actor_source,
      requested_actor_id, requested_reason, requested_idempotency_key
    );
  end if;
  perform private.write_marketplace_audit(
    'marketplace.partner_payable_reversed', 'marketplace_partner_payable',
    selected.id, requested_reason,
    jsonb_build_object('status', selected.status,
      'reversed_amount_cents', selected.reversed_amount_cents),
    jsonb_build_object('status', result.status,
      'reversed_amount_cents', result.reversed_amount_cents)
  );
  return result;
exception when others then
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  raise;
end;
$$;
revoke all on function private.reverse_marketplace_partner_payable_internal(
  uuid,bigint,public.marketplace_partner_finance_actor_source,uuid,text,uuid,text
) from public, anon, authenticated, service_role;

create or replace function private.sync_marketplace_partner_payables_from_payment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payable_record public.marketplace_partner_payables; remaining bigint;
begin
  if new.status = 'paid' and (tg_op = 'INSERT' or new.status is distinct from old.status) then
    perform private.create_marketplace_partner_payables_internal(
      new.order_id, new.id, 'payment:' || new.id::text
    );
  elsif tg_op = 'UPDATE' and old.status = 'paid'
    and new.status in ('failed','rejected','refunded')
  then
    for payable_record in select * from public.marketplace_partner_payables
      where payment_id = new.id and status in ('PENDING','ON_HOLD','AVAILABLE')
      order by id for update
    loop
      remaining := payable_record.original_amount_cents - payable_record.reversed_amount_cents;
      if remaining > 0 then
        perform private.reverse_marketplace_partner_payable_internal(
          payable_record.id, remaining, 'PAYMENT', null,
          'Pago revertido o rechazado después de su confirmación.', new.id,
          'payment-reversal:' || new.id::text || ':' || payable_record.id::text
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.sync_marketplace_partner_payables_from_payment()
from public, anon, authenticated, service_role;
create trigger zz_order_payments_sync_marketplace_partner_payables
after insert or update of status on public.order_payments
for each row execute function private.sync_marketplace_partner_payables_from_payment();

create or replace function private.reverse_payables_from_cancelled_fulfillment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare payable_record public.marketplace_partner_payables; remaining bigint;
begin
  if new.status = 'CANCELLED' and new.status is distinct from old.status then
    for payable_record in select * from public.marketplace_partner_payables
      where fulfillment_id = new.id and status in ('PENDING','ON_HOLD','AVAILABLE')
      order by id for update
    loop
      remaining := payable_record.original_amount_cents - payable_record.reversed_amount_cents;
      if remaining > 0 then
        perform private.reverse_marketplace_partner_payable_internal(
          payable_record.id, remaining, 'SYSTEM', (select auth.uid()),
          coalesce(new.cancellation_reason, 'Fulfillment cancelado.'), new.id,
          'fulfillment-cancel:' || new.id::text || ':' || payable_record.id::text
        );
      end if;
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function private.reverse_payables_from_cancelled_fulfillment()
from public, anon, authenticated, service_role;
create trigger order_fulfillments_reverse_partner_payables
after update of status on public.order_fulfillments
for each row execute function private.reverse_payables_from_cancelled_fulfillment();

create or replace function public.place_marketplace_partner_payable_hold(
  requested_payable_id uuid,
  requested_source public.marketplace_partner_hold_source,
  requested_reason text,
  requested_partner_visible boolean,
  requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path = '' as $$
declare selected public.marketplace_partner_payables; result public.marketplace_partner_payables;
  existing public.marketplace_partner_holds; remaining bigint;
  pending_delta bigint := 0; available_delta bigint := 0;
begin
  if not public.can_manage_marketplace_payables() then
    raise exception 'Marketplace payable access denied' using errcode = '42501'; end if;
  if requested_source not in ('OPERATIONS','RISK','RECONCILIATION')
    or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Hold input is invalid' using errcode = '22023'; end if;
  select * into selected from public.marketplace_partner_payables
    where id = requested_payable_id for update;
  if not found then raise exception 'Payable not found' using errcode = 'P0002'; end if;
  select * into existing from public.marketplace_partner_holds
    where placed_idempotency_key = requested_idempotency_key;
  if found then
    if existing.payable_id <> selected.id or existing.source <> requested_source
    then raise exception 'Hold idempotency key conflict' using errcode = '23505'; end if;
    return selected;
  end if;
  if selected.status not in ('PENDING','ON_HOLD','AVAILABLE')
  then raise exception 'Payable cannot be held' using errcode = '22023'; end if;
  remaining := selected.original_amount_cents - selected.reversed_amount_cents;
  perform set_config('peter_golf.partner_finance_write', 'enabled', true);
  insert into public.marketplace_partner_holds(
    payable_id, partner_id, source, reason, partner_visible, actor_id,
    placed_idempotency_key
  ) values (
    selected.id, selected.partner_id, requested_source, btrim(requested_reason),
    requested_partner_visible, auth.uid(), requested_idempotency_key
  );
  if selected.status <> 'ON_HOLD' then
    if selected.status = 'PENDING' then pending_delta := -remaining;
    else available_delta := -remaining; end if;
    perform private.write_marketplace_partner_ledger_entry(
      selected, 'PAYABLE_HELD',
      case when requested_source='RISK' then 'RISK'::public.marketplace_partner_finance_actor_source
        else 'OPERATIONS'::public.marketplace_partner_finance_actor_source end,
      0, pending_delta, remaining, available_delta, 0, 0,
      requested_reason, auth.uid(), null, 'hold:place:' || requested_idempotency_key::text,
      jsonb_build_object('source', requested_source,
        'partner_visible', requested_partner_visible)
    );
    update public.marketplace_partner_payables set status = 'ON_HOLD',
      held_from_status = selected.status, version = version + 1
    where id = selected.id returning * into result;
    perform private.write_marketplace_partner_payable_history(
      result, selected.status, 'ON_HOLD', 'OPERATIONS', auth.uid(),
      requested_reason, 'hold:place:' || requested_idempotency_key::text,
      requested_partner_visible
    );
  else
    perform private.write_marketplace_partner_ledger_entry(
      selected, 'PAYABLE_HELD', 'OPERATIONS', 0, 0, 0, 0, 0, 0,
      requested_reason, auth.uid(), null, 'hold:place:' || requested_idempotency_key::text,
      jsonb_build_object('additional_hold', true, 'source', requested_source,
        'partner_visible', requested_partner_visible)
    );
    result := selected;
  end if;
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  perform private.write_marketplace_audit(
    'marketplace.partner_payable_held', 'marketplace_partner_payable', selected.id,
    requested_reason, jsonb_build_object('status', selected.status),
    jsonb_build_object('status', result.status, 'source', requested_source)
  );
  return result;
exception when others then
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  raise;
end;
$$;

create or replace function public.release_marketplace_partner_payable_hold(
  requested_hold_id uuid,
  requested_reason text,
  requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path = '' as $$
declare selected_hold public.marketplace_partner_holds;
  selected public.marketplace_partner_payables; result public.marketplace_partner_payables;
  remaining bigint; pending_delta bigint := 0; available_delta bigint := 0;
begin
  if not public.can_manage_marketplace_payables() then
    raise exception 'Marketplace payable access denied' using errcode = '42501'; end if;
  if requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Hold release input is invalid' using errcode = '22023'; end if;
  select * into selected_hold from public.marketplace_partner_holds
    where id = requested_hold_id for update;
  if not found then raise exception 'Hold not found' using errcode = 'P0002'; end if;
  select * into strict selected from public.marketplace_partner_payables
    where id = selected_hold.payable_id for update;
  if selected_hold.status = 'RELEASED' then
    if selected_hold.release_idempotency_key = requested_idempotency_key then return selected; end if;
    raise exception 'Hold is already released' using errcode = '22023';
  end if;
  perform set_config('peter_golf.partner_finance_write', 'enabled', true);
  update public.marketplace_partner_holds set status = 'RELEASED',
    released_at = now(), released_by = auth.uid(), release_reason = btrim(requested_reason),
    release_idempotency_key = requested_idempotency_key
  where id = selected_hold.id;
  if not exists(select 1 from public.marketplace_partner_holds
    where payable_id = selected.id and status = 'ACTIVE')
  then
    remaining := selected.original_amount_cents - selected.reversed_amount_cents;
    if selected.held_from_status = 'PENDING' then pending_delta := remaining;
    else available_delta := remaining; end if;
    perform private.write_marketplace_partner_ledger_entry(
      selected, 'PAYABLE_HOLD_RELEASED', 'OPERATIONS', 0,
      pending_delta, -remaining, available_delta, 0, 0,
      requested_reason, auth.uid(), selected_hold.id,
      'hold:release:' || requested_idempotency_key::text,
      jsonb_build_object('restored_status', selected.held_from_status,
        'partner_visible', selected_hold.partner_visible)
    );
    update public.marketplace_partner_payables set status = held_from_status,
      held_from_status = null, version = version + 1
    where id = selected.id returning * into result;
    perform private.write_marketplace_partner_payable_history(
      result, 'ON_HOLD', result.status, 'OPERATIONS', auth.uid(),
      requested_reason, 'hold:release:' || requested_idempotency_key::text,
      selected_hold.partner_visible
    );
  else result := selected; end if;
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  perform private.write_marketplace_audit(
    'marketplace.partner_payable_hold_released', 'marketplace_partner_payable',
    selected.id, requested_reason, jsonb_build_object('hold_id', selected_hold.id),
    jsonb_build_object('status', result.status)
  );
  return result;
exception when others then
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  raise;
end;
$$;

create or replace function public.release_marketplace_partner_payable(
  requested_payable_id uuid,
  requested_basis public.marketplace_partner_release_basis,
  requested_reason text,
  requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path = '' as $$
declare selected public.marketplace_partner_payables; result public.marketplace_partner_payables;
  remaining bigint; existing public.marketplace_partner_release_authorizations;
  fulfillment_status public.marketplace_fulfillment_status;
begin
  if not public.can_manage_marketplace_payables() then
    raise exception 'Marketplace payable access denied' using errcode = '42501'; end if;
  if requested_basis <> 'OPERATIONS_APPROVED' or requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Release authorization is invalid' using errcode = '22023'; end if;
  select * into selected from public.marketplace_partner_payables
    where id = requested_payable_id for update;
  if not found then raise exception 'Payable not found' using errcode = 'P0002'; end if;
  select * into existing from public.marketplace_partner_release_authorizations
    where idempotency_key = requested_idempotency_key;
  if found then
    if existing.payable_id <> selected.id or existing.basis <> requested_basis
    then raise exception 'Release idempotency key conflict' using errcode = '23505'; end if;
    return selected;
  end if;
  if exists(select 1 from public.marketplace_partner_holds
    where payable_id = selected.id and status = 'ACTIVE')
  then raise exception 'Active hold blocks release' using errcode = '23514'; end if;
  if selected.status <> 'PENDING' then
    raise exception 'Payable is not pending' using errcode = '22023'; end if;
  select status into fulfillment_status from public.order_fulfillments
    where id = selected.fulfillment_id;
  if fulfillment_status not in ('DELIVERED','ACCEPTANCE_PENDING','COMPLETED') then
    raise exception 'Fulfillment lacks an explicit release condition' using errcode = '23514';
  end if;
  remaining := selected.original_amount_cents - selected.reversed_amount_cents;
  perform set_config('peter_golf.partner_finance_write', 'enabled', true);
  insert into public.marketplace_partner_release_authorizations(
    payable_id, partner_id, basis, actor_source, actor_id, reason,
    idempotency_key, consumed_at
  ) values (
    selected.id, selected.partner_id, requested_basis, 'OPERATIONS', auth.uid(),
    btrim(requested_reason), requested_idempotency_key, now()
  );
  perform private.write_marketplace_partner_ledger_entry(
    selected, 'PAYABLE_RELEASED', 'OPERATIONS', 0,
    -remaining, 0, remaining, 0, 0, requested_reason, auth.uid(), null,
    'payable:release:' || requested_idempotency_key::text,
    jsonb_build_object('basis', requested_basis)
  );
  update public.marketplace_partner_payables set status = 'AVAILABLE',
    version = version + 1 where id = selected.id returning * into result;
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  perform private.write_marketplace_partner_payable_history(
    result, 'PENDING', 'AVAILABLE', 'OPERATIONS', auth.uid(), requested_reason,
    'payable:release:' || requested_idempotency_key::text
  );
  perform private.write_marketplace_audit(
    'marketplace.partner_payable_released', 'marketplace_partner_payable',
    selected.id, requested_reason, jsonb_build_object('status','PENDING'),
    jsonb_build_object('status','AVAILABLE','basis',requested_basis)
  );
  return result;
exception when others then
  perform set_config('peter_golf.partner_finance_write', 'disabled', true);
  raise;
end;
$$;

create or replace function public.reverse_marketplace_partner_payable(
  requested_payable_id uuid,
  requested_amount_cents bigint,
  requested_reason text,
  requested_idempotency_key uuid
) returns public.marketplace_partner_payables
language plpgsql security definer set search_path = '' as $$
begin
  if not public.can_manage_marketplace_payables() then
    raise exception 'Marketplace payable access denied' using errcode = '42501'; end if;
  if requested_idempotency_key is null
    or char_length(btrim(requested_reason)) not between 3 and 1000
  then raise exception 'Reversal input is invalid' using errcode = '22023'; end if;
  return private.reverse_marketplace_partner_payable_internal(
    requested_payable_id, requested_amount_cents, 'OPERATIONS', auth.uid(),
    requested_reason, null, 'payable:reverse:' || requested_idempotency_key::text
  );
end;
$$;

create or replace function public.get_partner_marketplace_balance()
returns table(
  pending_cents bigint, on_hold_cents bigint, available_cents bigint,
  paid_historical_cents bigint, reversed_cents bigint, net_position_cents bigint,
  currency character(3)
) language sql stable security definer set search_path = '' as $$
  select coalesce(sum(l.pending_delta_cents),0)::bigint,
    coalesce(sum(l.on_hold_delta_cents),0)::bigint,
    coalesce(sum(l.available_delta_cents),0)::bigint,
    coalesce(sum(l.paid_delta_cents),0)::bigint,
    coalesce(sum(l.reversed_delta_cents),0)::bigint,
    coalesce(sum(l.pending_delta_cents + l.on_hold_delta_cents
      + l.available_delta_cents + l.paid_delta_cents),0)::bigint,
    'MXN'::character(3)
  from public.marketplace_partner_ledger_entries l
  join public.partner_profiles p on p.id = l.partner_id
  where p.user_id = (select auth.uid())
$$;

create or replace function public.get_partner_marketplace_payables(
  requested_payable_id uuid default null
) returns table(
  payable_id uuid, order_id uuid, order_number text, order_item_id uuid,
  fulfillment_id uuid, listing_title text, quantity integer,
  public_line_total numeric(14,0), commission_amount numeric(14,0),
  commission_vat numeric(14,0), partner_processing_share numeric(14,0),
  admin_percentage_fee numeric(14,0), admin_fixed_fee numeric(14,0),
  payable_amount_cents numeric(14,0), reversed_amount_cents numeric(14,0),
  status public.marketplace_partner_payable_status, currency character(3),
  created_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select p.id, p.order_id, o.order_number, p.order_item_id, p.fulfillment_id,
    s.listing_title, p.quantity, s.public_line_total, s.commission_amount,
    s.commission_vat, s.partner_processing_share, s.admin_percentage_fee,
    s.admin_fixed_fee, p.original_amount_cents, p.reversed_amount_cents,
    p.status, p.currency, p.created_at
  from public.marketplace_partner_payables p
  join public.partner_profiles pp on pp.id = p.partner_id
  join public.orders o on o.id = p.order_id
  join public.marketplace_order_item_snapshots s on s.order_item_id = p.order_item_id
  where pp.user_id = (select auth.uid())
    and (requested_payable_id is null or p.id = requested_payable_id)
  order by p.created_at desc, p.id
$$;

create or replace function public.get_partner_marketplace_payable_holds(
  requested_payable_id uuid
) returns table(
  hold_id uuid, source public.marketplace_partner_hold_source,
  status public.marketplace_partner_hold_status, reason text,
  created_at timestamptz, released_at timestamptz
) language sql stable security definer set search_path = '' as $$
  select h.id, h.source, h.status, h.reason, h.created_at, h.released_at
  from public.marketplace_partner_holds h
  join public.partner_profiles p on p.id = h.partner_id
  where h.payable_id = requested_payable_id and h.partner_visible
    and p.user_id = (select auth.uid())
  order by h.created_at desc
$$;

-- Bootstrap any already-paid, committed Marketplace orders without relying on
-- auth.uid() or infrastructure role names. This is hosted-CLI portable and
-- idempotent because order_item_id is the economic-obligation key.
do $$
declare payment_record public.order_payments;
begin
  for payment_record in
    select distinct on (p.order_id) p.*
    from public.order_payments p
    where p.status = 'paid'
      and exists(select 1 from public.marketplace_order_item_snapshots s
        join public.order_items oi on oi.id = s.order_item_id
        where oi.order_id = p.order_id)
    order by p.order_id, p.paid_at desc nulls last, p.created_at desc
  loop
    perform private.create_marketplace_partner_payables_internal(
      payment_record.order_id, payment_record.id,
      'migration-bootstrap:' || payment_record.id::text
    );
  end loop;
end;
$$;

alter table public.marketplace_partner_payables enable row level security;
alter table public.marketplace_partner_ledger_entries enable row level security;
alter table public.marketplace_partner_payable_status_history enable row level security;
alter table public.marketplace_partner_holds enable row level security;
alter table public.marketplace_partner_release_authorizations enable row level security;

create policy "Partners read own Marketplace payables"
on public.marketplace_partner_payables for select to authenticated
using ((select private.partner_owns_marketplace_payable(id)));
create policy "Payable staff read Marketplace payables"
on public.marketplace_partner_payables for select to authenticated
using ((select public.can_manage_marketplace_payables()));
create policy "Partners read own Marketplace ledger"
on public.marketplace_partner_ledger_entries for select to authenticated
using ((select private.partner_owns_marketplace_payable(payable_id))
  and (entry_type not in ('PAYABLE_HELD','PAYABLE_HOLD_RELEASED')
    or coalesce((metadata ->> 'partner_visible')::boolean, false)));
create policy "Payable staff read Marketplace ledger"
on public.marketplace_partner_ledger_entries for select to authenticated
using ((select public.can_manage_marketplace_payables()));
create policy "Partners read own Marketplace payable history"
on public.marketplace_partner_payable_status_history for select to authenticated
using (partner_visible
  and (select private.partner_owns_marketplace_payable(payable_id)));
create policy "Payable staff read Marketplace payable history"
on public.marketplace_partner_payable_status_history for select to authenticated
using ((select public.can_manage_marketplace_payables()));
create policy "Partners read visible own Marketplace holds"
on public.marketplace_partner_holds for select to authenticated
using (partner_visible and (select private.partner_owns_marketplace_payable(payable_id)));
create policy "Payable staff read Marketplace holds"
on public.marketplace_partner_holds for select to authenticated
using ((select public.can_manage_marketplace_payables()));
create policy "Payable staff read release authorizations"
on public.marketplace_partner_release_authorizations for select to authenticated
using ((select public.can_manage_marketplace_payables()));

revoke all on public.marketplace_partner_payables,
  public.marketplace_partner_ledger_entries,
  public.marketplace_partner_payable_status_history,
  public.marketplace_partner_holds,
  public.marketplace_partner_release_authorizations
from public, anon, authenticated;
grant select on public.marketplace_partner_payables,
  public.marketplace_partner_ledger_entries,
  public.marketplace_partner_payable_status_history,
  public.marketplace_partner_holds,
  public.marketplace_partner_release_authorizations
to authenticated;

revoke all on function public.place_marketplace_partner_payable_hold(
  uuid,public.marketplace_partner_hold_source,text,boolean,uuid),
  public.release_marketplace_partner_payable_hold(uuid,text,uuid),
  public.release_marketplace_partner_payable(
    uuid,public.marketplace_partner_release_basis,text,uuid),
  public.reverse_marketplace_partner_payable(uuid,bigint,text,uuid),
  public.get_partner_marketplace_balance(),
  public.get_partner_marketplace_payables(uuid),
  public.get_partner_marketplace_payable_holds(uuid)
from public, anon, authenticated;
grant execute on function public.place_marketplace_partner_payable_hold(
  uuid,public.marketplace_partner_hold_source,text,boolean,uuid),
  public.release_marketplace_partner_payable_hold(uuid,text,uuid),
  public.release_marketplace_partner_payable(
    uuid,public.marketplace_partner_release_basis,text,uuid),
  public.reverse_marketplace_partner_payable(uuid,bigint,text,uuid),
  public.get_partner_marketplace_balance(),
  public.get_partner_marketplace_payables(uuid),
  public.get_partner_marketplace_payable_holds(uuid)
to authenticated;

comment on table public.marketplace_partner_payables is
  'One immutable-source Partner obligation per PR6 Marketplace order item snapshot. Amount never uses current tier or config.';
comment on table public.marketplace_partner_ledger_entries is
  'Append-only signed financial movements. Bucket deltas reconstruct Partner balances exactly; corrections use compensation.';
comment on table public.marketplace_partner_holds is
  'Multiple auditable holds may block one payable. The last active hold must be released before funds can become available.';
comment on column public.marketplace_partner_payables.original_amount_cents is
  'Exact copy of marketplace_order_item_snapshots.estimated_partner_net in integer MXN cents.';
comment on column public.marketplace_partner_payables.status is
  'PR7 records PENDING/ON_HOLD/AVAILABLE/REVERSED. PAID is schema-ready for the future payout owner and has no Partner action.';
