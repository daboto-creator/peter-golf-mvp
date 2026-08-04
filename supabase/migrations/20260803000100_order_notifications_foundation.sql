-- Transactional outbox for local/test customer email notifications.
-- SMTP delivery is deliberately outside business transactions.

create type public.notification_event_type as enum (
  'order_created',
  'order_confirmed',
  'transfer_submitted',
  'payment_under_review',
  'payment_paid',
  'payment_rejected',
  'payment_refunded',
  'order_cancelled'
);

create type public.notification_channel as enum ('email');

create type public.notification_delivery_status as enum (
  'pending', 'processing', 'sent', 'failed', 'dead_letter'
);

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  event_type public.notification_event_type not null,
  order_id uuid not null references public.orders (id) on delete restrict,
  payment_id uuid references public.order_payments (id) on delete restrict,
  order_status_history_id uuid
    references public.order_status_history (id) on delete restrict,
  payment_status_history_id uuid
    references public.payment_status_history (id) on delete restrict,
  payload_version integer not null default 1,
  template_data jsonb not null,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint notification_events_one_source check (
    num_nonnulls(order_status_history_id, payment_status_history_id) = 1
  ),
  constraint notification_events_source_matches_aggregate check (
    (order_status_history_id is not null and payment_id is null)
    or (payment_status_history_id is not null and payment_id is not null)
  ),
  constraint notification_events_payload_version check (payload_version = 1),
  constraint notification_events_template_data_object
    check (jsonb_typeof(template_data) = 'object'),
  constraint notification_events_template_data_keys check (
    template_data - array[
      'order_number', 'origin', 'total', 'currency',
      'expected_amount', 'payment_currency'
    ]::text[] = '{}'::jsonb
  )
);

create unique index notification_events_order_history_uidx
  on public.notification_events (order_status_history_id)
  where order_status_history_id is not null;
create unique index notification_events_payment_history_uidx
  on public.notification_events (payment_status_history_id)
  where payment_status_history_id is not null;
create index notification_events_order_created_idx
  on public.notification_events (order_id, created_at desc);
create index notification_events_payment_created_idx
  on public.notification_events (payment_id, created_at desc)
  where payment_id is not null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  notification_event_id uuid not null
    references public.notification_events (id) on delete restrict,
  channel public.notification_channel not null default 'email',
  recipient_email text not null,
  status public.notification_delivery_status not null default 'pending',
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz default now(),
  lease_token uuid,
  processing_started_at timestamptz,
  sent_at timestamptz,
  provider text,
  provider_message_id text,
  last_error_code text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notification_deliveries_event_channel_unique
    unique (notification_event_id, channel),
  constraint notification_deliveries_recipient_length
    check (char_length(recipient_email) between 3 and 254),
  constraint notification_deliveries_recipient_format
    check (recipient_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  constraint notification_deliveries_attempts
    check (attempt_count between 0 and max_attempts and max_attempts = 5),
  constraint notification_deliveries_provider_length
    check (provider is null or char_length(provider) between 1 and 40),
  constraint notification_deliveries_provider_message_length
    check (provider_message_id is null or char_length(provider_message_id) <= 255),
  constraint notification_deliveries_error_code_format check (
    last_error_code is null
    or last_error_code ~ '^[a-z0-9_]{1,80}$'
  ),
  constraint notification_deliveries_state_consistent check (
    (status = 'pending' and attempt_count = 0 and lease_token is null
      and processing_started_at is null and sent_at is null
      and next_attempt_at is not null)
    or (status = 'processing' and attempt_count > 0 and lease_token is not null
      and processing_started_at is not null and sent_at is null
      and next_attempt_at is null)
    or (status = 'sent' and lease_token is null
      and processing_started_at is null and sent_at is not null
      and next_attempt_at is null)
    or (status = 'failed' and attempt_count > 0 and lease_token is null
      and processing_started_at is null and sent_at is null
      and next_attempt_at is not null and last_error_code is not null)
    or (status = 'dead_letter' and attempt_count > 0 and lease_token is null
      and processing_started_at is null and sent_at is null
      and next_attempt_at is null and last_error_code is not null)
  )
);

create index notification_deliveries_queue_idx
  on public.notification_deliveries (status, next_attempt_at, created_at);
create index notification_deliveries_event_idx
  on public.notification_deliveries (notification_event_id);

create trigger notification_deliveries_set_updated_at
before update on public.notification_deliveries
for each row execute function public.set_updated_at();

alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

create trigger notification_events_are_immutable
before update or delete on public.notification_events
for each row execute function public.reject_immutable_row_change();

create or replace function public.enqueue_order_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_type public.notification_event_type;
  selected_order public.orders%rowtype;
  new_event_id uuid;
begin
  selected_type := case
    when new.from_status is null then 'order_created'::public.notification_event_type
    when new.from_status = 'pending_confirmation' and new.to_status = 'preparing'
      then 'order_confirmed'::public.notification_event_type
    when new.to_status = 'cancelled'
      then 'order_cancelled'::public.notification_event_type
    else null
  end;
  if selected_type is null then return new; end if;

  select * into strict selected_order
  from public.orders where id = new.order_id;

  insert into public.notification_events (
    event_type, order_id, order_status_history_id, template_data, occurred_at
  ) values (
    selected_type, selected_order.id, new.id,
    jsonb_build_object(
      'order_number', selected_order.order_number,
      'origin', selected_order.origin,
      'total', selected_order.total,
      'currency', selected_order.currency
    ),
    new.created_at
  ) returning id into new_event_id;

  if selected_order.customer_email is not null then
    insert into public.notification_deliveries (
      notification_event_id, recipient_email
    ) values (new_event_id, lower(btrim(selected_order.customer_email)));
  end if;
  return new;
end;
$$;

create or replace function public.enqueue_payment_notification_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_type public.notification_event_type;
  selected_payment public.order_payments%rowtype;
  selected_order public.orders%rowtype;
  new_event_id uuid;
begin
  selected_type := case new.to_status
    when 'submitted' then 'transfer_submitted'::public.notification_event_type
    when 'under_review' then 'payment_under_review'::public.notification_event_type
    when 'paid' then 'payment_paid'::public.notification_event_type
    when 'rejected' then 'payment_rejected'::public.notification_event_type
    when 'refunded' then 'payment_refunded'::public.notification_event_type
    else null
  end;
  if selected_type is null then return new; end if;

  select * into strict selected_payment
  from public.order_payments where id = new.payment_id;
  select * into strict selected_order
  from public.orders where id = selected_payment.order_id;

  insert into public.notification_events (
    event_type, order_id, payment_id, payment_status_history_id,
    template_data, occurred_at
  ) values (
    selected_type, selected_order.id, selected_payment.id, new.id,
    jsonb_build_object(
      'order_number', selected_order.order_number,
      'origin', selected_order.origin,
      'total', selected_order.total,
      'currency', selected_order.currency,
      'expected_amount', selected_payment.expected_amount,
      'payment_currency', selected_payment.currency
    ),
    new.created_at
  ) returning id into new_event_id;

  if selected_order.customer_email is not null then
    insert into public.notification_deliveries (
      notification_event_id, recipient_email
    ) values (new_event_id, lower(btrim(selected_order.customer_email)));
  end if;
  return new;
end;
$$;

create constraint trigger order_history_enqueues_notification
after insert on public.order_status_history
deferrable initially deferred
for each row execute function public.enqueue_order_notification_event();

create constraint trigger payment_history_enqueues_notification
after insert on public.payment_status_history
deferrable initially deferred
for each row execute function public.enqueue_payment_notification_event();

revoke all on function public.enqueue_order_notification_event(),
  public.enqueue_payment_notification_event()
from public, anon, authenticated;

create or replace function public.mask_notification_email(email text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when position('@' in email) <= 1 then '***'
    else left(email, 1) || '***@' || split_part(email, '@', 2)
  end;
$$;
revoke all on function public.mask_notification_email(text)
from public, anon, authenticated;

create or replace function public.list_operational_notification_deliveries(
  requested_limit integer default 100
)
returns table (
  delivery_id uuid,
  order_number text,
  event_type public.notification_event_type,
  recipient_email_masked text,
  status public.notification_delivery_status,
  attempt_count integer,
  max_attempts integer,
  next_attempt_at timestamptz,
  processing_started_at timestamptz,
  sent_at timestamptz,
  last_error_code text,
  occurred_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  if requested_limit not between 1 and 200 then
    raise exception 'Notification limit is invalid' using errcode = '22023';
  end if;
  return query
  select d.id, e.template_data->>'order_number', e.event_type,
    public.mask_notification_email(d.recipient_email), d.status,
    d.attempt_count, d.max_attempts, d.next_attempt_at,
    d.processing_started_at, d.sent_at, d.last_error_code,
    e.occurred_at, d.created_at, d.updated_at
  from public.notification_deliveries d
  join public.notification_events e on e.id = d.notification_event_id
  order by d.created_at desc
  limit requested_limit;
end;
$$;

create or replace function public.recover_expired_notification_leases()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare recovered integer;
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  update public.notification_deliveries
  set status = case when attempt_count >= max_attempts
      then 'dead_letter'::public.notification_delivery_status
      else 'failed'::public.notification_delivery_status end,
    next_attempt_at = case when attempt_count >= max_attempts then null else now() end,
    lease_token = null,
    processing_started_at = null,
    last_error_code = 'lease_expired',
    last_error_at = now()
  where status = 'processing'
    and processing_started_at <= now() - interval '5 minutes';
  get diagnostics recovered = row_count;
  return recovered;
end;
$$;

create or replace function public.claim_notification_deliveries(
  requested_limit integer default 20
)
returns table (
  delivery_id uuid,
  lease_token uuid,
  event_type public.notification_event_type,
  recipient_email text,
  customer_name text,
  order_id uuid,
  order_origin public.order_origin,
  template_data jsonb,
  occurred_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  if requested_limit not between 1 and 50 then
    raise exception 'Notification claim limit is invalid' using errcode = '22023';
  end if;
  perform public.recover_expired_notification_leases();
  return query
  with candidates as (
    select d.id
    from public.notification_deliveries d
    where d.status in ('pending', 'failed')
      and d.next_attempt_at <= now()
      and d.attempt_count < d.max_attempts
    order by d.next_attempt_at, d.created_at
    for update skip locked
    limit requested_limit
  ), claimed as (
    update public.notification_deliveries d
    set status = 'processing', attempt_count = d.attempt_count + 1,
      next_attempt_at = null, lease_token = gen_random_uuid(),
      processing_started_at = now()
    from candidates
    where d.id = candidates.id
    returning d.*
  )
  select c.id, c.lease_token, e.event_type, c.recipient_email,
    o.customer_name, o.id, o.origin, e.template_data, e.occurred_at,
    c.attempt_count
  from claimed c
  join public.notification_events e on e.id = c.notification_event_id
  join public.orders o on o.id = e.order_id
  order by c.created_at;
end;
$$;

create or replace function public.retry_failed_notification_deliveries()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare retried integer;
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  update public.notification_deliveries
  set next_attempt_at = now()
  where status = 'failed' and attempt_count < max_attempts;
  get diagnostics retried = row_count;
  return retried;
end;
$$;

create or replace function public.complete_notification_delivery(
  requested_lease_token uuid,
  requested_provider_message_id text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare completed_id uuid; normalized_message_id text := btrim(requested_provider_message_id);
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  if requested_lease_token is null or char_length(normalized_message_id) not between 1 and 255 then
    raise exception 'Notification completion is invalid' using errcode = '22023';
  end if;
  update public.notification_deliveries
  set status = 'sent', sent_at = now(), provider = 'smtp',
    provider_message_id = normalized_message_id,
    lease_token = null, processing_started_at = null,
    next_attempt_at = null, last_error_code = null, last_error_at = null
  where lease_token = requested_lease_token and status = 'processing'
  returning id into completed_id;
  if completed_id is null then
    raise exception 'Notification lease not found' using errcode = 'P0002';
  end if;
  return completed_id;
end;
$$;

create or replace function public.fail_notification_delivery(
  requested_lease_token uuid,
  requested_error_code text
)
returns table (
  delivery_id uuid,
  status public.notification_delivery_status,
  next_attempt_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected public.notification_deliveries%rowtype;
  normalized_code text := lower(btrim(requested_error_code));
  permanent boolean;
  retry_at timestamptz;
  target_status public.notification_delivery_status;
begin
  if not public.can_manage_orders() then
    raise exception 'Notification access denied' using errcode = '42501';
  end if;
  if requested_lease_token is null or normalized_code !~ '^[a-z0-9_]{1,80}$' then
    raise exception 'Notification failure is invalid' using errcode = '22023';
  end if;
  select d.* into selected from public.notification_deliveries d
  where d.lease_token = requested_lease_token and d.status = 'processing'
  for update;
  if not found then
    raise exception 'Notification lease not found' using errcode = 'P0002';
  end if;
  permanent := normalized_code in (
    'invalid_recipient', 'recipient_domain_not_allowed',
    'notifications_disabled', 'transport_disabled', 'template_invalid'
    , 'smtp_permanent'
  );
  if permanent or selected.attempt_count >= selected.max_attempts then
    target_status := 'dead_letter';
    retry_at := null;
  else
    target_status := 'failed';
    retry_at := now() + case selected.attempt_count
      when 1 then interval '1 minute'
      when 2 then interval '5 minutes'
      when 3 then interval '15 minutes'
      else interval '1 hour'
    end;
  end if;
  update public.notification_deliveries
  set status = target_status, next_attempt_at = retry_at,
    lease_token = null, processing_started_at = null,
    last_error_code = normalized_code, last_error_at = now()
  where id = selected.id;
  return query select selected.id, target_status, retry_at;
end;
$$;

revoke all on public.notification_events, public.notification_deliveries
from public, anon, authenticated;

revoke all on function public.list_operational_notification_deliveries(integer),
  public.recover_expired_notification_leases(),
  public.claim_notification_deliveries(integer),
  public.retry_failed_notification_deliveries(),
  public.complete_notification_delivery(uuid, text),
  public.fail_notification_delivery(uuid, text)
from public, anon;

grant execute on function public.list_operational_notification_deliveries(integer),
  public.recover_expired_notification_leases(),
  public.claim_notification_deliveries(integer),
  public.retry_failed_notification_deliveries(),
  public.complete_notification_delivery(uuid, text),
  public.fail_notification_delivery(uuid, text)
to authenticated;
