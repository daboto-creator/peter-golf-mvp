-- Independent, auditable order-payment aggregate for simulated bank transfers.
-- No real money is processed and no bank credentials are stored.

create type public.payment_method as enum (
  'bank_transfer', 'cash', 'external_terminal'
);

create type public.payment_status as enum (
  'pending', 'submitted', 'under_review', 'paid', 'rejected', 'refunded'
);

create table public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete restrict,
  method public.payment_method not null,
  status public.payment_status not null default 'pending',
  expected_amount public.money_minor_units not null,
  currency public.iso_currency_code not null,
  version integer not null default 1,
  submitted_at timestamptz,
  under_review_at timestamptz,
  paid_at timestamptz,
  rejected_at timestamptz,
  refunded_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_payments_version_positive check (version > 0)
);

create table public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete restrict,
  attempt_number integer not null,
  transfer_reference text not null,
  transferred_at timestamptz not null,
  sender_name text,
  sender_bank text,
  submitted_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (payment_id, attempt_number),
  constraint payment_submissions_attempt_positive check (attempt_number > 0),
  constraint payment_submissions_reference_length
    check (char_length(transfer_reference) between 3 and 120),
  constraint payment_submissions_sender_name_length
    check (sender_name is null or char_length(sender_name) between 2 and 120),
  constraint payment_submissions_sender_bank_length
    check (sender_bank is null or char_length(sender_bank) between 2 and 120)
);

create table public.payment_status_history (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.order_payments (id) on delete restrict,
  submission_id uuid references public.payment_submissions (id) on delete restrict,
  from_status public.payment_status,
  to_status public.payment_status not null,
  changed_by uuid references public.profiles (id) on delete set null,
  note text,
  created_at timestamptz not null default now(),
  constraint payment_status_history_actual_change
    check (from_status is null or from_status <> to_status),
  constraint payment_status_history_note_length
    check (note is null or char_length(note) between 3 and 500)
);

create table public.payment_idempotency_keys (
  idempotency_key uuid primary key,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  payment_id uuid not null references public.order_payments (id) on delete restrict,
  submission_id uuid references public.payment_submissions (id) on delete restrict,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  constraint payment_idempotency_operation_allowed check (
    operation in ('submit', 'start_review', 'approve', 'reject', 'refund')
  ),
  constraint payment_idempotency_payload_hash_format
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

create index order_payments_status_updated_at_idx
  on public.order_payments (status, updated_at desc);
create index payment_submissions_payment_created_at_idx
  on public.payment_submissions (payment_id, created_at desc);
create index payment_submissions_submitted_by_idx
  on public.payment_submissions (submitted_by);
create index payment_status_history_payment_created_at_idx
  on public.payment_status_history (payment_id, created_at desc);
create index payment_status_history_changed_by_idx
  on public.payment_status_history (changed_by);
create index payment_idempotency_actor_created_at_idx
  on public.payment_idempotency_keys (actor_id, created_at desc);

create trigger order_payments_set_updated_at
before update on public.order_payments
for each row execute function public.set_updated_at();

alter table public.order_payments enable row level security;
alter table public.payment_submissions enable row level security;
alter table public.payment_status_history enable row level security;
alter table public.payment_idempotency_keys enable row level security;

-- Database-side kill switch. It complements the server-only PAYMENTS_MODE flag
-- so a direct Supabase RPC call cannot bypass disabled mode.
insert into public.site_settings (key, value, description, is_public)
values (
  'payments.mode',
  '{"mode":"disabled"}'::jsonb,
  'Database-side guard for simulated payment submissions.',
  false
)
on conflict (key) do update set
  value = '{"mode":"disabled"}'::jsonb,
  description = excluded.description,
  is_public = false;

create or replace function public.payments_test_mode_enabled()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select site_settings.value->>'mode' = 'test'
    from public.site_settings
    where site_settings.key = 'payments.mode'
  ), false);
$$;

revoke all on function public.payments_test_mode_enabled()
from public, anon, authenticated;
grant execute on function public.payments_test_mode_enabled() to authenticated;

-- Backfill current informational states. Legacy columns remain temporarily for
-- compatibility but cease to be authoritative after this migration.
create or replace function public.backfill_legacy_order_payments()
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
insert into public.order_payments (
  order_id, method, status, expected_amount, currency,
  submitted_at, paid_at, created_at, updated_at
)
select
  orders.id,
  case orders.payment_method
    when 'bank_transfer' then 'bank_transfer'::public.payment_method
    when 'cash' then 'cash'::public.payment_method
    when 'external_terminal' then 'external_terminal'::public.payment_method
  end,
  case orders.payment_status
    when 'transfer_verified' then 'paid'::public.payment_status
    when 'cash_received' then 'paid'::public.payment_status
    when 'external_terminal_received' then 'paid'::public.payment_status
    else 'pending'::public.payment_status
  end,
  orders.total,
  orders.currency,
  case when orders.payment_status in (
    'transfer_verified', 'cash_received', 'external_terminal_received'
  ) then orders.updated_at end,
  case when orders.payment_status in (
    'transfer_verified', 'cash_received', 'external_terminal_received'
  ) then orders.updated_at end,
  orders.created_at,
  orders.updated_at
from public.orders
where orders.payment_method <> 'none'
on conflict (order_id) do nothing;

insert into public.payment_status_history (
  payment_id, from_status, to_status, changed_by, note, created_at
)
select order_payments.id, null, order_payments.status, null,
  'Migración compatible desde estado informativo legacy', order_payments.created_at
from public.order_payments
where not exists (
  select 1 from public.payment_status_history
  where payment_status_history.payment_id = order_payments.id
);
end;
$$;

select public.backfill_legacy_order_payments();
revoke all on function public.backfill_legacy_order_payments()
from public, anon, authenticated;

create or replace function public.record_payment_status_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_submission_id uuid := nullif(
    current_setting('peter_golf.payment_submission_id', true), ''
  )::uuid;
  selected_note text := nullif(
    current_setting('peter_golf.payment_transition_note', true), ''
  );
begin
  if tg_op = 'INSERT' then
    insert into public.payment_status_history (
      payment_id, submission_id, from_status, to_status, changed_by, note
    ) values (new.id, selected_submission_id, null, new.status, auth.uid(), selected_note);
  elsif new.status is distinct from old.status then
    insert into public.payment_status_history (
      payment_id, submission_id, from_status, to_status, changed_by, note
    ) values (
      new.id, selected_submission_id, old.status, new.status, auth.uid(), selected_note
    );
  end if;
  return new;
end;
$$;

create trigger order_payments_record_status_change
after insert or update of status on public.order_payments
for each row execute function public.record_payment_status_change();

revoke all on function public.record_payment_status_change()
from public, anon, authenticated;

create trigger payment_submissions_are_immutable
before update or delete on public.payment_submissions
for each row execute function public.reject_immutable_row_change();
create trigger payment_status_history_is_immutable
before update or delete on public.payment_status_history
for each row execute function public.reject_immutable_row_change();
create trigger payment_idempotency_keys_are_immutable
before update or delete on public.payment_idempotency_keys
for each row execute function public.reject_immutable_row_change();

create or replace function public.require_payment_rpc_write()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user = 'authenticated'
    and current_setting('peter_golf.payment_rpc_write', true) <> 'enabled'
  then
    raise exception 'Payment writes require the payment RPC' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger order_payments_require_payment_rpc
before insert or update or delete on public.order_payments
for each row execute function public.require_payment_rpc_write();
create trigger payment_submissions_require_payment_rpc
before insert or update or delete on public.payment_submissions
for each row execute function public.require_payment_rpc_write();
create trigger payment_idempotency_requires_payment_rpc
before insert or update or delete on public.payment_idempotency_keys
for each row execute function public.require_payment_rpc_write();

revoke all on function public.require_payment_rpc_write()
from public, anon, authenticated;

-- No table is directly visible to customers. Customer reads are available only
-- while the reviewed order projection RPC has its transaction-local marker.
create policy "order staff can read payments"
on public.order_payments for select to authenticated
using ((select public.can_manage_orders()));
create policy "customers can read own payments through safe rpc"
on public.order_payments for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1 from public.orders
    where orders.id = order_payments.order_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);
create policy "customers can access own payment through write rpc"
on public.order_payments for select to authenticated
using (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.orders
    where orders.id = order_payments.order_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);
create policy "payment actors can update through rpc"
on public.order_payments for update to authenticated
using (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and (
    (select public.can_manage_orders())
    or exists (
      select 1 from public.orders
      where orders.id = order_payments.order_id
        and orders.user_id = (select auth.uid()) and orders.origin = 'web'
    )
  )
)
with check (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and (
    (select public.can_manage_orders())
    or exists (
      select 1 from public.orders
      where orders.id = order_payments.order_id
        and orders.user_id = (select auth.uid()) and orders.origin = 'web'
    )
  )
);

create policy "order staff can read payment submissions"
on public.payment_submissions for select to authenticated
using ((select public.can_manage_orders()));
create policy "customers can read own payment submissions through safe rpc"
on public.payment_submissions for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1 from public.order_payments
    join public.orders on orders.id = order_payments.order_id
    where order_payments.id = payment_submissions.payment_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);
create policy "customers can read own payment submissions through write rpc"
on public.payment_submissions for select to authenticated
using (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.order_payments
    join public.orders on orders.id = order_payments.order_id
    where order_payments.id = payment_submissions.payment_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);
create policy "customers can create own payment submissions through rpc"
on public.payment_submissions for insert to authenticated
with check (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and submitted_by = (select auth.uid())
  and exists (
    select 1 from public.order_payments
    join public.orders on orders.id = order_payments.order_id
    where order_payments.id = payment_submissions.payment_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);

create policy "order staff can read payment history"
on public.payment_status_history for select to authenticated
using ((select public.can_manage_orders()));
create policy "customers can read own payment history through safe rpc"
on public.payment_status_history for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1 from public.order_payments
    join public.orders on orders.id = order_payments.order_id
    where order_payments.id = payment_status_history.payment_id
      and orders.user_id = (select auth.uid()) and orders.origin = 'web'
  )
);

create policy "payment actors can read idempotency through rpc"
on public.payment_idempotency_keys for select to authenticated
using (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and (
    actor_id = (select auth.uid())
    or (select public.can_manage_orders())
  )
);
create policy "payment actors can create idempotency through rpc"
on public.payment_idempotency_keys for insert to authenticated
with check (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and actor_id = (select auth.uid())
  and (
    (select public.can_manage_orders())
    or exists (
      select 1 from public.order_payments
      join public.orders on orders.id = order_payments.order_id
      where order_payments.id = payment_idempotency_keys.payment_id
        and orders.user_id = (select auth.uid()) and orders.origin = 'web'
    )
  )
);

create policy "customers can read own order through payment rpc"
on public.orders for select to authenticated
using (
  current_setting('peter_golf.payment_rpc_write', true) = 'enabled'
  and user_id = (select auth.uid()) and origin = 'web'
);

revoke all on public.order_payments, public.payment_submissions,
  public.payment_status_history, public.payment_idempotency_keys
from anon, authenticated;
grant select on public.order_payments, public.payment_submissions,
  public.payment_status_history, public.payment_idempotency_keys
to authenticated;
grant update (
  status, version, submitted_at, under_review_at, paid_at, rejected_at,
  refunded_at, reviewed_by
) on public.order_payments to authenticated;
grant insert on public.payment_submissions to authenticated;
grant insert on public.payment_idempotency_keys to authenticated;

-- A narrowly scoped definer helper obtains the order row lock that PostgreSQL
-- otherwise denies to customers under the orders UPDATE policy. It returns no
-- data and only locks an owned web order for the caller's current transaction.
create or replace function public.lock_customer_order_for_payment(
  requested_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_status public.order_status;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select orders.status into selected_status
  from public.orders
  where orders.id = requested_order_id
    and orders.user_id = auth.uid() and orders.origin = 'web'
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.lock_customer_order_for_payment(uuid)
from public, anon, authenticated;
grant execute on function public.lock_customer_order_for_payment(uuid)
to authenticated;

create or replace function public.submit_bank_transfer(
  requested_order_id uuid,
  expected_payment_version integer,
  requested_transfer_reference text,
  requested_transferred_at timestamptz,
  requested_sender_name text,
  requested_sender_bank text,
  requested_idempotency_key uuid
)
returns table (
  payment_id uuid, submission_id uuid, status public.payment_status,
  version integer, replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_order public.orders%rowtype;
  selected_payment public.order_payments%rowtype;
  existing public.payment_idempotency_keys%rowtype;
  normalized_reference text := btrim(requested_transfer_reference);
  normalized_sender_name text := nullif(btrim(requested_sender_name), '');
  normalized_sender_bank text := nullif(btrim(requested_sender_bank), '');
  payload_hash text;
  new_submission_id uuid := gen_random_uuid();
  next_attempt integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not public.payments_test_mode_enabled() then
    raise exception 'Payment submissions are disabled' using errcode = '42501';
  end if;
  if requested_idempotency_key is null or expected_payment_version < 1
    or char_length(normalized_reference) not between 3 and 120
    or requested_transferred_at is null
    or requested_transferred_at > now() + interval '5 minutes'
    or requested_transferred_at < now() - interval '90 days'
    or (normalized_sender_name is not null
      and char_length(normalized_sender_name) not between 2 and 120)
    or (normalized_sender_bank is not null
      and char_length(normalized_sender_bank) not between 2 and 120)
  then
    raise exception 'Transfer submission is invalid' using errcode = '22023';
  end if;

  payload_hash := encode(extensions.digest(jsonb_build_object(
    'order_id', requested_order_id,
    'expected_payment_version', expected_payment_version,
    'transfer_reference', normalized_reference,
    'transferred_at', requested_transferred_at,
    'sender_name', normalized_sender_name,
    'sender_bank', normalized_sender_bank
  )::text, 'sha256'), 'hex');

  perform set_config('peter_golf.payment_rpc_write', 'enabled', true);
  perform public.lock_customer_order_for_payment(requested_order_id);
  select * into selected_order from public.orders
  where id = requested_order_id and user_id = auth.uid() and origin = 'web';
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if selected_order.status <> 'preparing' then
    raise exception 'Order is not confirmed' using errcode = '22023';
  end if;

  select * into selected_payment from public.order_payments
  where order_id = selected_order.id for update;
  if not found or selected_payment.method <> 'bank_transfer' then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  select * into existing from public.payment_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'submit'
      or existing.payment_id <> selected_payment.id
      or existing.payload_hash <> payload_hash
    then
      raise exception 'Idempotency key conflict' using errcode = '23505';
    end if;
    return query select selected_payment.id, existing.submission_id,
      selected_payment.status, selected_payment.version, true;
    perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
    return;
  end if;

  if selected_payment.version <> expected_payment_version then
    raise exception 'Payment changed' using errcode = '40001';
  end if;
  if selected_payment.status not in ('pending', 'rejected') then
    raise exception 'Payment cannot be submitted' using errcode = '22023';
  end if;

  select coalesce(max(attempt_number), 0) + 1 into next_attempt
  from public.payment_submissions
  where payment_submissions.payment_id = selected_payment.id;
  insert into public.payment_submissions (
    id, payment_id, attempt_number, transfer_reference, transferred_at,
    sender_name, sender_bank, submitted_by
  ) values (
    new_submission_id, selected_payment.id, next_attempt, normalized_reference,
    requested_transferred_at, normalized_sender_name, normalized_sender_bank,
    auth.uid()
  );
  perform set_config('peter_golf.payment_submission_id', new_submission_id::text, true);
  perform set_config('peter_golf.payment_transition_note', '', true);
  update public.order_payments set
    status = 'submitted', submitted_at = now(), under_review_at = null,
    rejected_at = null, reviewed_by = null, version = order_payments.version + 1
  where id = selected_payment.id;
  insert into public.payment_idempotency_keys (
    idempotency_key, actor_id, operation, payment_id, submission_id, payload_hash
  ) values (
    requested_idempotency_key, auth.uid(), 'submit', selected_payment.id,
    new_submission_id, payload_hash
  );
  perform set_config('peter_golf.payment_submission_id', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  return query select selected_payment.id, new_submission_id,
    'submitted'::public.payment_status, selected_payment.version + 1, false;
exception when others then
  perform set_config('peter_golf.payment_submission_id', '', true);
  perform set_config('peter_golf.payment_transition_note', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  raise;
end;
$$;

create or replace function public.review_order_payment(
  requested_order_id uuid,
  expected_payment_version integer,
  requested_status public.payment_status,
  requested_reason text,
  requested_idempotency_key uuid
)
returns table (
  payment_id uuid, status public.payment_status, version integer, replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected_payment public.order_payments%rowtype;
  existing public.payment_idempotency_keys%rowtype;
  normalized_reason text := nullif(btrim(requested_reason), '');
  selected_operation text;
  payload_hash text;
begin
  if not public.can_manage_orders() then
    raise exception 'Order access denied' using errcode = '42501';
  end if;
  selected_operation := case requested_status
    when 'under_review' then 'start_review'
    when 'paid' then 'approve'
    when 'rejected' then 'reject'
    when 'refunded' then 'refund'
    else null
  end;
  if requested_idempotency_key is null or expected_payment_version < 1
    or selected_operation is null
    or (requested_status in ('rejected', 'refunded') and
      (normalized_reason is null or char_length(normalized_reason) not between 3 and 500))
    or (requested_status not in ('rejected', 'refunded') and normalized_reason is not null)
  then
    raise exception 'Payment review request is invalid' using errcode = '22023';
  end if;

  perform set_config('peter_golf.payment_rpc_write', 'enabled', true);
  select * into selected_payment from public.order_payments
  where order_id = requested_order_id for update;
  if not found then raise exception 'Payment not found' using errcode = 'P0002'; end if;

  payload_hash := encode(extensions.digest(jsonb_build_object(
    'order_id', requested_order_id,
    'expected_payment_version', expected_payment_version,
    'status', requested_status,
    'reason', normalized_reason
  )::text, 'sha256'), 'hex');
  select * into existing from public.payment_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> selected_operation
      or existing.payment_id <> selected_payment.id
      or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select selected_payment.id, selected_payment.status,
      selected_payment.version, true;
    perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
    return;
  end if;

  if selected_payment.version <> expected_payment_version then
    raise exception 'Payment changed' using errcode = '40001';
  end if;
  if not (
    (selected_payment.status = 'submitted' and requested_status in ('under_review', 'rejected'))
    or (selected_payment.status = 'under_review' and requested_status in ('paid', 'rejected'))
    or (selected_payment.status = 'paid' and requested_status = 'refunded')
  ) then
    raise exception 'Payment transition is invalid' using errcode = '22023';
  end if;

  perform set_config(
    'peter_golf.payment_transition_note', coalesce(normalized_reason, ''), true
  );
  update public.order_payments set
    status = requested_status,
    under_review_at = case when requested_status = 'under_review' then now()
      else under_review_at end,
    paid_at = case when requested_status = 'paid' then now() else paid_at end,
    rejected_at = case when requested_status = 'rejected' then now()
      else rejected_at end,
    refunded_at = case when requested_status = 'refunded' then now()
      else refunded_at end,
    reviewed_by = auth.uid(),
    version = order_payments.version + 1
  where id = selected_payment.id;
  insert into public.payment_idempotency_keys (
    idempotency_key, actor_id, operation, payment_id, payload_hash
  ) values (
    requested_idempotency_key, auth.uid(), selected_operation,
    selected_payment.id, payload_hash
  );
  perform set_config('peter_golf.payment_transition_note', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  return query select selected_payment.id, requested_status,
    selected_payment.version + 1, false;
exception when others then
  perform set_config('peter_golf.payment_transition_note', '', true);
  perform set_config('peter_golf.payment_rpc_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.submit_bank_transfer(
  uuid, integer, text, timestamptz, text, text, uuid
), public.review_order_payment(
  uuid, integer, public.payment_status, text, uuid
) from public, anon, authenticated;
grant execute on function public.submit_bank_transfer(
  uuid, integer, text, timestamptz, text, text, uuid
), public.review_order_payment(
  uuid, integer, public.payment_status, text, uuid
) to authenticated;

-- Keep the existing seven-argument checkout contract and create its payment in
-- the same transaction, deriving amount and currency from the inserted order.
create or replace function public.create_customer_checkout_order(
  requested_cart_id uuid,
  expected_version integer,
  requested_shipping_method_id uuid,
  requested_saved_address_id uuid,
  requested_address jsonb,
  requested_save_address boolean,
  requested_idempotency_key uuid
)
returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.addresses%rowtype;
  resolved_address jsonb;
  result record;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_saved_address_id is not null then
    select * into selected from public.addresses
    where id = requested_saved_address_id and user_id = auth.uid()
      and archived_at is null;
    if not found then
      raise exception 'Address is unavailable' using errcode = 'P0002';
    end if;
    resolved_address := jsonb_build_object(
      'recipient_name', selected.recipient_name, 'phone', selected.phone,
      'street', selected.line_1,
      'exterior_number', coalesce(selected.exterior_number, 'S/N'),
      'interior_number', selected.line_2, 'neighborhood', selected.neighborhood,
      'city', selected.city, 'state', selected.state,
      'postal_code', selected.postal_code,
      'references', selected.delivery_references, 'country_code', 'MX'
    );
    requested_save_address := false;
  else
    resolved_address := requested_address;
  end if;

  select * into result from public.create_customer_checkout_order(
    requested_cart_id, expected_version, requested_shipping_method_id,
    resolved_address, requested_save_address, requested_idempotency_key
  );

  if requested_saved_address_id is not null and not result.replayed then
    update public.orders set shipping_address_id = selected.id
    where id = result.order_id and user_id = auth.uid();
  elsif requested_saved_address_id is null and requested_save_address
    and not result.replayed then
    update public.addresses set
      line_1 = resolved_address->>'street',
      exterior_number = resolved_address->>'exterior_number',
      line_2 = nullif(resolved_address->>'interior_number', ''),
      delivery_references = nullif(resolved_address->>'references', '')
    where id = (select shipping_address_id from public.orders
      where id = result.order_id) and user_id = auth.uid();
  end if;

  insert into public.order_payments (
    order_id, method, status, expected_amount, currency
  )
  select orders.id, 'bank_transfer', 'pending', orders.total, orders.currency
  from public.orders
  where orders.id = result.order_id and orders.user_id = auth.uid()
    and orders.origin = 'web'
  on conflict on constraint order_payments_order_id_key do nothing;

  return query select result.order_id, result.order_number, result.replayed;
end;
$$;

revoke all on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid
) from public, anon;
grant execute on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid
) to authenticated;

-- Customer order projections expose safe payment data but no notes, actor IDs,
-- idempotency keys or operational audit fields.
drop function public.list_customer_orders();
create function public.list_customer_orders()
returns table (
  id uuid,
  order_number text,
  created_at timestamptz,
  updated_at timestamptz,
  status public.order_status,
  payment_status public.payment_status,
  payment_method public.payment_method,
  subtotal numeric,
  shipping_total numeric,
  discount_total numeric,
  tax_total numeric,
  total numeric,
  currency character(3),
  shipping_address_snapshot jsonb
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform set_config('peter_golf.customer_order_read', 'enabled', true);
  return query
    select o.id, o.order_number, o.created_at, o.updated_at, o.status,
      p.status, p.method, o.subtotal::numeric, o.shipping_total::numeric,
      o.discount_total::numeric, o.tax_total::numeric, o.total::numeric,
      o.currency::character(3), o.shipping_address_snapshot
    from public.orders o
    join public.order_payments p on p.order_id = o.id
    where o.user_id = auth.uid() and o.origin = 'web'
    order by o.created_at desc limit 100;
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
exception when others then
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  raise;
end;
$$;

create or replace function public.get_customer_order(requested_order_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform set_config('peter_golf.customer_order_read', 'enabled', true);
  select jsonb_build_object(
    'id', o.id, 'order_number', o.order_number,
    'created_at', o.created_at, 'updated_at', o.updated_at,
    'status', o.status, 'subtotal', o.subtotal,
    'shipping_total', o.shipping_total, 'discount_total', o.discount_total,
    'tax_total', o.tax_total, 'total', o.total, 'currency', o.currency,
    'shipping_address_snapshot', o.shipping_address_snapshot,
    'payment', jsonb_build_object(
      'id', p.id, 'method', p.method, 'status', p.status,
      'expected_amount', p.expected_amount, 'currency', p.currency,
      'version', p.version, 'submitted_at', p.submitted_at,
      'under_review_at', p.under_review_at, 'paid_at', p.paid_at,
      'rejected_at', p.rejected_at, 'refunded_at', p.refunded_at,
      'submissions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'attempt_number', s.attempt_number,
          'transfer_reference', s.transfer_reference,
          'transferred_at', s.transferred_at,
          'sender_name', s.sender_name, 'sender_bank', s.sender_bank,
          'created_at', s.created_at
        ) order by s.attempt_number)
        from public.payment_submissions s where s.payment_id = p.id
      ), '[]'::jsonb),
      'history', coalesce((
        select jsonb_agg(jsonb_build_object(
          'from_status', h.from_status, 'to_status', h.to_status,
          'created_at', h.created_at
        ) order by h.created_at)
        from public.payment_status_history h where h.payment_id = p.id
      ), '[]'::jsonb)
    ),
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sku_snapshot', oi.sku_snapshot,
        'product_name_snapshot', oi.product_name_snapshot,
        'variant_name_snapshot', oi.variant_name_snapshot,
        'condition_snapshot', oi.condition_snapshot,
        'condition_grade_snapshot', oi.condition_grade_snapshot,
        'unit_price_snapshot', oi.unit_price_snapshot,
        'currency', oi.currency, 'quantity', oi.quantity,
        'line_total', oi.line_total
      ) order by oi.created_at, oi.sku_snapshot)
      from public.order_items oi where oi.order_id = o.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', h.from_status, 'to_status', h.to_status,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.order_status_history h where h.order_id = o.id
    ), '[]'::jsonb)
  ) into result
  from public.orders o
  join public.order_payments p on p.order_id = o.id
  where o.id = requested_order_id and o.user_id = auth.uid()
    and o.origin = 'web';
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  return result;
exception when others then
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.list_customer_orders(),
  public.get_customer_order(uuid)
from public, anon, authenticated;
grant execute on function public.list_customer_orders(),
  public.get_customer_order(uuid)
to authenticated;

-- A paid order must be explicitly refunded before cancellation. This guard is
-- independent of inventory return logic and applies to every cancellation path.
create or replace function public.prevent_paid_order_cancellation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from 'cancelled'
    and exists (
      select 1 from public.order_payments
      where order_payments.order_id = new.id
        and order_payments.status = 'paid'
    )
  then
    raise exception 'Paid order must be refunded before cancellation'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger orders_block_paid_cancellation
before update of status on public.orders
for each row execute function public.prevent_paid_order_cancellation();
revoke all on function public.prevent_paid_order_cancellation()
from public, anon, authenticated;

-- Disable the old unrestricted informational update routes. Legacy columns and
-- enum types remain only for compatibility with historical rows.
revoke execute on function public.update_manual_order_payment(
  uuid, integer, public.manual_payment_status, public.manual_payment_method
), public.update_operational_order_payment(
  uuid, integer, public.manual_payment_status, public.manual_payment_method
) from authenticated;
