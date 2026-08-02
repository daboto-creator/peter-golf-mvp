-- Secure manual order management for operator/admin sessions.
-- Manual drafts do not reserve inventory. Confirmation atomically records a
-- sale; cancellation atomically records the exact inverse return.

create type public.manual_order_channel as enum (
  'whatsapp', 'instagram', 'phone', 'in_person', 'bank_transfer', 'other'
);
create type public.manual_payment_status as enum (
  'pending', 'transfer_pending', 'transfer_verified', 'cash_received',
  'external_terminal_received'
);
create type public.manual_payment_method as enum (
  'none', 'bank_transfer', 'cash', 'external_terminal'
);

alter table public.orders
  alter column user_id drop not null,
  alter column status set default 'pending_confirmation',
  add column customer_name text,
  add column customer_email text,
  add column customer_phone text,
  add column origin_channel public.manual_order_channel,
  add column origin_channel_detail text,
  add column delivery_type text not null default 'shipping',
  add column discount_reason text,
  add column payment_status public.manual_payment_status not null default 'pending',
  add column payment_method public.manual_payment_method not null default 'none',
  add column created_by uuid references public.profiles (id) on delete restrict,
  add column updated_by uuid references public.profiles (id) on delete restrict,
  add column confirmed_by uuid references public.profiles (id) on delete restrict,
  add column cancelled_by uuid references public.profiles (id) on delete restrict,
  add column cancellation_reason text,
  add column version integer not null default 1,
  add constraint orders_customer_name_length check (
    customer_name is null or char_length(customer_name) between 2 and 120
  ),
  add constraint orders_customer_email_length check (
    customer_email is null or char_length(customer_email) between 3 and 254
  ),
  add constraint orders_customer_phone_length check (
    customer_phone is null or char_length(customer_phone) between 7 and 30
  ),
  add constraint orders_manual_customer_complete check (
    created_by is null or (
      customer_name is not null and customer_phone is not null
      and origin_channel is not null
    )
  ),
  add constraint orders_origin_detail_consistent check (
    (origin_channel = 'other' and origin_channel_detail is not null
      and char_length(origin_channel_detail) between 2 and 80)
    or (origin_channel is distinct from 'other' and origin_channel_detail is null)
  ),
  add constraint orders_delivery_type_supported check (delivery_type = 'shipping'),
  add constraint orders_discount_reason_consistent check (
    (discount_total = 0 and discount_reason is null)
    or (discount_total > 0 and discount_reason is not null
      and char_length(discount_reason) between 3 and 300)
  ),
  add constraint orders_payment_consistent check (
    (payment_status = 'pending' and payment_method = 'none')
    or (payment_status = 'transfer_pending' and payment_method = 'bank_transfer')
    or (payment_status = 'transfer_verified' and payment_method = 'bank_transfer')
    or (payment_status = 'cash_received' and payment_method = 'cash')
    or (payment_status = 'external_terminal_received'
      and payment_method = 'external_terminal')
  ),
  add constraint orders_confirmation_audit_consistent check (
    (status = 'preparing' and confirmed_at is not null and confirmed_by is not null)
    or status <> 'preparing'
  ),
  add constraint orders_cancellation_audit_consistent check (
    (status = 'cancelled' and cancelled_at is not null
      and cancelled_by is not null and cancellation_reason is not null)
    or status <> 'cancelled'
  ),
  add constraint orders_version_positive check (version > 0);

create index orders_manual_search_idx
  on public.orders (created_at desc)
  where created_by is not null;
create index orders_origin_channel_created_at_idx
  on public.orders (origin_channel, created_at desc)
  where created_by is not null;
create index orders_payment_status_created_at_idx
  on public.orders (payment_status, created_at desc)
  where created_by is not null;

create table public.order_idempotency_keys (
  idempotency_key uuid primary key,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  order_id uuid references public.orders (id) on delete restrict,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  constraint order_idempotency_operation_allowed
    check (operation in ('create', 'confirm', 'cancel')),
  constraint order_idempotency_payload_hash_format
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

alter table public.order_idempotency_keys enable row level security;

create or replace function public.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    inner join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name in ('operator', 'admin')
  );
$$;

revoke all on function public.can_manage_orders() from public, anon;
grant execute on function public.can_manage_orders() to authenticated;

create policy "order staff can read manual orders"
on public.orders for select to authenticated
using (created_by is not null and (select public.can_manage_orders()));
create policy "order staff can read manual order items"
on public.order_items for select to authenticated
using (
  (select public.can_manage_orders()) and exists (
    select 1 from public.orders
    where orders.id = order_items.order_id and orders.created_by is not null
  )
);
create policy "order staff can read manual order history"
on public.order_status_history for select to authenticated
using (
  (select public.can_manage_orders()) and exists (
    select 1 from public.orders
    where orders.id = order_status_history.order_id and orders.created_by is not null
  )
);
create policy "order staff can read own idempotency keys"
on public.order_idempotency_keys for select to authenticated
using (actor_id = (select auth.uid()) and (select public.can_manage_orders()));

-- SECURITY INVOKER RPCs require narrow grants. RLS plus the transaction marker
-- and triggers below reject equivalent direct PostgREST writes.
revoke all on public.orders, public.order_items, public.order_idempotency_keys
from anon, authenticated;
grant select on public.orders, public.order_items to authenticated;
grant select (id, order_id, from_status, to_status, changed_by, note, created_at)
  on public.order_status_history to authenticated;
grant select on public.order_idempotency_keys to authenticated;
grant insert, update on public.orders to authenticated;
grant insert, update, delete on public.order_items to authenticated;
grant insert on public.order_idempotency_keys to authenticated;

create policy "order staff can create manual orders through rpc"
on public.orders for insert to authenticated
with check (
  (select public.can_manage_orders())
  and created_by = (select auth.uid())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);
create policy "order staff can update manual orders through rpc"
on public.orders for update to authenticated
using (created_by is not null and (select public.can_manage_orders()))
with check (
  created_by is not null and (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);
create policy "order staff can create manual items through rpc"
on public.order_items for insert to authenticated
with check (
  (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.orders where orders.id = order_items.order_id
      and orders.created_by is not null
  )
);
create policy "order staff can update manual items through rpc"
on public.order_items for update to authenticated
using ((select public.can_manage_orders()))
with check (
  (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);
create policy "order staff can delete draft manual items through rpc"
on public.order_items for delete to authenticated
using (
  (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.orders where orders.id = order_items.order_id
      and orders.status = 'pending_confirmation' and orders.created_by is not null
  )
);
create policy "order staff can create idempotency keys through rpc"
on public.order_idempotency_keys for insert to authenticated
with check (
  actor_id = (select auth.uid()) and (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);

create or replace function public.require_order_rpc_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated'
    and current_setting('peter_golf.order_rpc_write', true) <> 'enabled'
  then
    raise exception 'Order writes require the order RPC' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger orders_require_order_rpc
before insert or update or delete on public.orders
for each row execute function public.require_order_rpc_write();
create trigger order_items_require_order_rpc
before insert or update or delete on public.order_items
for each row execute function public.require_order_rpc_write();
create trigger order_idempotency_requires_order_rpc
before insert or update or delete on public.order_idempotency_keys
for each row execute function public.require_order_rpc_write();
revoke all on function public.require_order_rpc_write()
from public, anon, authenticated;

create or replace function public.normalize_manual_order_payload(requested_payload jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare
  normalized jsonb;
  item jsonb;
begin
  if jsonb_typeof(requested_payload) <> 'object'
    or jsonb_typeof(requested_payload->'items') <> 'array'
    or jsonb_array_length(requested_payload->'items') < 1
    or jsonb_array_length(requested_payload->'items') > 100
  then raise exception 'Order payload is invalid' using errcode = '22023'; end if;

  normalized := jsonb_build_object(
    'customer_name', btrim(requested_payload->>'customer_name'),
    'customer_email', nullif(lower(btrim(requested_payload->>'customer_email')), ''),
    'customer_phone', btrim(requested_payload->>'customer_phone'),
    'origin_channel', requested_payload->>'origin_channel',
    'origin_channel_detail', nullif(btrim(requested_payload->>'origin_channel_detail'), ''),
    'delivery_type', 'shipping',
    'address', jsonb_build_object(
      'recipient_name', btrim(requested_payload->'address'->>'recipient_name'),
      'phone', btrim(requested_payload->'address'->>'phone'),
      'street', btrim(requested_payload->'address'->>'street'),
      'exterior_number', btrim(requested_payload->'address'->>'exterior_number'),
      'interior_number', nullif(btrim(requested_payload->'address'->>'interior_number'), ''),
      'neighborhood', btrim(requested_payload->'address'->>'neighborhood'),
      'city', btrim(requested_payload->'address'->>'city'),
      'state', btrim(requested_payload->'address'->>'state'),
      'postal_code', btrim(requested_payload->'address'->>'postal_code'),
      'references', nullif(btrim(requested_payload->'address'->>'references'), ''),
      'country_code', 'MX'
    ),
    'shipping_total', coalesce((requested_payload->>'shipping_total')::numeric, 0),
    'discount_total', coalesce((requested_payload->>'discount_total')::numeric, 0),
    'discount_reason', nullif(btrim(requested_payload->>'discount_reason'), ''),
    'internal_note', nullif(btrim(requested_payload->>'internal_note'), ''),
    'items', requested_payload->'items'
  );

  if char_length(normalized->>'customer_name') not between 2 and 120
    or char_length(normalized->>'customer_phone') not between 7 and 30
    or (normalized->>'customer_email') is not null
      and ((normalized->>'customer_email') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
        or char_length(normalized->>'customer_email') > 254)
    or (normalized->>'origin_channel') not in
      ('whatsapp','instagram','phone','in_person','bank_transfer','other')
    or ((normalized->>'origin_channel') = 'other') is distinct from
      ((normalized->>'origin_channel_detail') is not null)
    or char_length(normalized->'address'->>'recipient_name') not between 2 and 120
    or char_length(normalized->'address'->>'phone') not between 7 and 30
    or char_length(normalized->'address'->>'street') not between 1 and 160
    or char_length(normalized->'address'->>'exterior_number') not between 1 and 30
    or (normalized->'address'->>'interior_number') is not null
      and char_length(normalized->'address'->>'interior_number') > 30
    or char_length(normalized->'address'->>'neighborhood') not between 1 and 120
    or char_length(normalized->'address'->>'city') not between 1 and 120
    or char_length(normalized->'address'->>'state') not between 1 and 120
    or normalized->'address'->>'postal_code' !~ '^[0-9]{5}$'
    or (normalized->'address'->>'references') is not null
      and char_length(normalized->'address'->>'references') > 500
    or (normalized->>'shipping_total')::numeric < 0
    or (normalized->>'shipping_total')::numeric > 100000000
    or (normalized->>'shipping_total')::numeric <> trunc((normalized->>'shipping_total')::numeric)
    or (normalized->>'discount_total')::numeric < 0
    or (normalized->>'discount_total')::numeric > 100000000
    or (normalized->>'discount_total')::numeric <> trunc((normalized->>'discount_total')::numeric)
    or (((normalized->>'discount_total')::numeric > 0)
      is distinct from ((normalized->>'discount_reason') is not null))
    or (normalized->>'discount_reason') is not null
      and char_length(normalized->>'discount_reason') not between 3 and 300
    or (normalized->>'internal_note') is not null
      and char_length(normalized->>'internal_note') > 2000
  then raise exception 'Order customer, address or totals are invalid'
    using errcode = '22023'; end if;

  for item in select value from jsonb_array_elements(normalized->'items') loop
    if jsonb_typeof(item) <> 'object'
      or coalesce(item->>'product_id', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or coalesce(item->>'variant_id', '') !~
        '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      or (item->>'quantity')::numeric <> trunc((item->>'quantity')::numeric)
      or (item->>'quantity')::numeric not between 1 and 1000000
    then raise exception 'Order item is invalid' using errcode = '22023'; end if;
  end loop;
  return normalized;
exception when invalid_text_representation or numeric_value_out_of_range then
  raise exception 'Order payload is invalid' using errcode = '22023';
end;
$$;
revoke all on function public.normalize_manual_order_payload(jsonb)
from public, anon, authenticated;
grant execute on function public.normalize_manual_order_payload(jsonb)
to authenticated;

create or replace function public.populate_manual_order(
  requested_order_id uuid, normalized_payload jsonb, replacing boolean
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  item jsonb;
  selected record;
  calculated_subtotal numeric(14,0) := 0;
  selected_price numeric(14,0);
  selected_currency character(3);
begin
  if replacing then delete from public.order_items where order_id = requested_order_id; end if;

  for item in select value from jsonb_array_elements(normalized_payload->'items') loop
    select products.id product_id, product_variants.id variant_id,
      product_variants.sku, products.name product_name,
      product_variants.name variant_name, products.condition,
      products.condition_grade, coalesce(product_variants.price, products.price) price,
      products.currency
    into selected
    from public.products
    inner join public.product_variants
      on product_variants.product_id = products.id
    where products.id = (item->>'product_id')::uuid
      and product_variants.id = (item->>'variant_id')::uuid
      and products.status = 'active' and products.published
      and products.archived_at is null and product_variants.active
      and product_variants.archived_at is null
    -- Product is the price/currency lock root. Variant price is not writable by
    -- the current operational model, so locking it would require broadening its
    -- deliberately narrow UPDATE policy.
    for share of products;
    if not found then raise exception 'Order item is not sellable'
      using errcode = '22023'; end if;

    if selected_currency is null then selected_currency := selected.currency;
    elsif selected_currency <> selected.currency then
      raise exception 'Order currencies must match' using errcode = '22023'; end if;
    selected_price := selected.price;
    calculated_subtotal := calculated_subtotal + selected_price * (item->>'quantity')::integer;
    if calculated_subtotal > 99999999999999 then
      raise exception 'Order total is out of range' using errcode = '22023'; end if;

    insert into public.order_items (
      order_id, product_id, variant_id, sku_snapshot, product_name_snapshot,
      variant_name_snapshot, condition_snapshot, condition_grade_snapshot,
      unit_price_snapshot, currency, quantity, line_total
    ) values (
      requested_order_id, selected.product_id, selected.variant_id, selected.sku,
      selected.product_name, selected.variant_name, selected.condition,
      selected.condition_grade, selected_price, selected.currency,
      (item->>'quantity')::integer,
      selected_price * (item->>'quantity')::integer
    );
  end loop;

  if (normalized_payload->>'discount_total')::numeric > calculated_subtotal then
    raise exception 'Discount exceeds subtotal' using errcode = '23514'; end if;

  update public.orders set
    customer_name = normalized_payload->>'customer_name',
    customer_email = normalized_payload->>'customer_email',
    customer_phone = normalized_payload->>'customer_phone',
    origin_channel = (normalized_payload->>'origin_channel')::public.manual_order_channel,
    origin_channel_detail = normalized_payload->>'origin_channel_detail',
    shipping_address_snapshot = normalized_payload->'address',
    subtotal = calculated_subtotal,
    discount_total = (normalized_payload->>'discount_total')::numeric,
    discount_reason = normalized_payload->>'discount_reason',
    shipping_total = (normalized_payload->>'shipping_total')::numeric,
    tax_total = 0,
    total = calculated_subtotal - (normalized_payload->>'discount_total')::numeric
      + (normalized_payload->>'shipping_total')::numeric,
    currency = selected_currency,
    internal_note = normalized_payload->>'internal_note',
    updated_by = auth.uid(),
    version = case when replacing then version + 1 else version end
  where id = requested_order_id;
end;
$$;
revoke all on function public.populate_manual_order(uuid, jsonb, boolean)
from public, anon, authenticated;
grant execute on function public.populate_manual_order(uuid, jsonb, boolean)
to authenticated;

create or replace function public.create_manual_order(
  requested_payload jsonb, requested_idempotency_key uuid
)
returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  normalized jsonb;
  payload_hash text;
  existing public.order_idempotency_keys%rowtype;
  new_order_id uuid := gen_random_uuid();
  new_order_number text;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied'
    using errcode = '42501'; end if;
  if requested_idempotency_key is null then raise exception 'Idempotency key is required'
    using errcode = '22023'; end if;
  normalized := public.normalize_manual_order_payload(requested_payload);
  payload_hash := encode(extensions.digest(normalized::text, 'sha256'), 'hex');

  select * into existing from public.order_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'create'
      or existing.payload_hash <> payload_hash or existing.order_id is null
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.order_number, true
      from public.orders where orders.id = existing.order_id;
    return;
  end if;

  new_order_number := 'PG-M-' || upper(substr(replace(new_order_id::text, '-', ''), 1, 12));
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  insert into public.orders (
    id, order_number, user_id, status, currency, subtotal, discount_total,
    shipping_total, tax_total, total, shipping_address_snapshot,
    customer_name, customer_email, customer_phone, origin_channel,
    origin_channel_detail, created_by, updated_by
  ) values (
    new_order_id, new_order_number, null, 'pending_confirmation', 'MXN', 0, 0,
    0, 0, 0, normalized->'address', normalized->>'customer_name',
    normalized->>'customer_email', normalized->>'customer_phone',
    (normalized->>'origin_channel')::public.manual_order_channel,
    normalized->>'origin_channel_detail', auth.uid(), auth.uid()
  );
  perform public.populate_manual_order(new_order_id, normalized, false);
  insert into public.order_idempotency_keys
    (idempotency_key, actor_id, operation, order_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'create', new_order_id, payload_hash);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select new_order_id, new_order_number, false;
end;
$$;

create or replace function public.update_manual_order_draft(
  requested_order_id uuid, expected_version integer, requested_payload jsonb
)
returns table (order_id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare normalized jsonb; selected public.orders%rowtype;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied'
    using errcode = '42501'; end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.created_by is null or selected.status <> 'pending_confirmation'
    then raise exception 'Order is not editable' using errcode = '22023'; end if;
  if selected.version <> expected_version then raise exception 'Order changed'
    using errcode = '40001'; end if;
  normalized := public.normalize_manual_order_payload(requested_payload);
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  perform public.populate_manual_order(requested_order_id, normalized, true);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select orders.id, orders.version from public.orders
    where orders.id = requested_order_id;
end;
$$;

create or replace function public.confirm_manual_order(
  requested_order_id uuid, expected_version integer, requested_idempotency_key uuid
)
returns table (order_id uuid, status public.order_status, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected public.orders%rowtype;
  existing public.order_idempotency_keys%rowtype;
  line record;
  inv public.inventory%rowtype;
  new_balance integer;
  payload_hash text := encode(extensions.digest(
    (requested_order_id::text || ':' || expected_version::text || ':confirm')::bytea,
    'sha256'), 'hex');
begin
  if not public.can_manage_orders() then raise exception 'Order access denied'
    using errcode = '42501'; end if;
  if requested_idempotency_key is null then raise exception 'Idempotency key is required'
    using errcode = '22023'; end if;
  select * into existing from public.order_idempotency_keys
    where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'confirm'
      or existing.order_id <> requested_order_id or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.status, true from public.orders
      where orders.id = requested_order_id; return;
  end if;

  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.created_by is null or selected.status <> 'pending_confirmation'
    then raise exception 'Order cannot be confirmed' using errcode = '22023'; end if;
  if selected.version <> expected_version then raise exception 'Order changed'
    using errcode = '40001'; end if;
  if not exists (
    select 1 from public.order_items
    where order_items.order_id = selected.id
  )
    then raise exception 'Empty order cannot be confirmed' using errcode = '23514'; end if;

  -- Deterministic locking order prevents deadlocks for multi-item orders.
  for line in select variant_id, sum(quantity)::integer quantity
    from public.order_items
    where order_items.order_id = selected.id
    group by variant_id order by variant_id
  loop
    select * into inv from public.inventory where variant_id = line.variant_id for update;
    if not found or inv.quantity_on_hand - inv.quantity_reserved < line.quantity
      then raise exception 'Insufficient inventory' using errcode = '23514'; end if;
    new_balance := inv.quantity_on_hand - line.quantity;
    perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
    update public.inventory set quantity_on_hand = new_balance where id = inv.id;
    insert into public.inventory_movements (
      inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
      quantity_reserved_after, reason, reference_type, reference_id, actor_id,
      idempotency_key
    ) values (
      inv.id, 'sale', -line.quantity, new_balance, inv.quantity_reserved,
      'Confirmación de pedido manual ' || selected.order_number,
      'manual_order', selected.id, auth.uid(),
      (substr(md5(requested_idempotency_key::text || line.variant_id::text), 1, 8)
        || '-' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 9, 4)
        || '-4' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 14, 3)
        || '-8' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 18, 3)
        || '-' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 21, 12))::uuid
    );
  end loop;
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  update public.orders set status = 'preparing', confirmed_at = now(),
    confirmed_by = auth.uid(), updated_by = auth.uid(), version = version + 1
    where id = selected.id;
  insert into public.order_idempotency_keys
    (idempotency_key, actor_id, operation, order_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'confirm', selected.id, payload_hash);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select selected.id, 'preparing'::public.order_status, false;
end;
$$;

create or replace function public.cancel_manual_order(
  requested_order_id uuid, expected_version integer,
  requested_reason text, requested_idempotency_key uuid
)
returns table (order_id uuid, status public.order_status, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected public.orders%rowtype;
  existing public.order_idempotency_keys%rowtype;
  line record; inv public.inventory%rowtype; new_balance integer;
  normalized_reason text := btrim(requested_reason);
  payload_hash text;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied'
    using errcode = '42501'; end if;
  if requested_idempotency_key is null or char_length(normalized_reason) not between 3 and 500
    then raise exception 'Cancellation request is invalid' using errcode = '22023'; end if;
  payload_hash := encode(extensions.digest((requested_order_id::text || ':' ||
    expected_version::text || ':cancel:' || normalized_reason)::bytea, 'sha256'), 'hex');
  select * into existing from public.order_idempotency_keys
    where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'cancel'
      or existing.order_id <> requested_order_id or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.status, true from public.orders
      where orders.id = requested_order_id; return;
  end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.created_by is null or selected.status not in ('pending_confirmation', 'preparing')
    then raise exception 'Order cannot be cancelled' using errcode = '22023'; end if;
  if selected.version <> expected_version then raise exception 'Order changed'
    using errcode = '40001'; end if;

  if selected.status = 'preparing' then
    for line in select variant_id, sum(quantity)::integer quantity
      from public.order_items
      where order_items.order_id = selected.id
      group by variant_id order by variant_id
    loop
      select * into inv from public.inventory where variant_id = line.variant_id for update;
      if not found then raise exception 'Inventory history is inconsistent'
        using errcode = '55000'; end if;
      new_balance := inv.quantity_on_hand + line.quantity;
      perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
      update public.inventory set quantity_on_hand = new_balance where id = inv.id;
      insert into public.inventory_movements (
        inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, reference_type, reference_id, actor_id,
        idempotency_key
      ) values (
        inv.id, 'return', line.quantity, new_balance, inv.quantity_reserved,
        'Cancelación de pedido manual ' || selected.order_number || ': ' || normalized_reason,
        'manual_order', selected.id, auth.uid(),
        (substr(md5(requested_idempotency_key::text || line.variant_id::text), 1, 8)
          || '-' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 9, 4)
          || '-4' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 14, 3)
          || '-8' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 18, 3)
          || '-' || substr(md5(requested_idempotency_key::text || line.variant_id::text), 21, 12))::uuid
      );
    end loop;
    perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  end if;
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  update public.orders set status = 'cancelled', cancelled_at = now(),
    cancelled_by = auth.uid(), cancellation_reason = normalized_reason,
    updated_by = auth.uid(), version = version + 1 where id = selected.id;
  insert into public.order_idempotency_keys
    (idempotency_key, actor_id, operation, order_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'cancel', selected.id, payload_hash);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select selected.id, 'cancelled'::public.order_status, false;
end;
$$;

create or replace function public.update_manual_order_payment(
  requested_order_id uuid, expected_version integer,
  requested_status public.manual_payment_status,
  requested_method public.manual_payment_method
)
returns table (order_id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare selected public.orders%rowtype;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied'
    using errcode = '42501'; end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.created_by is null or selected.status = 'cancelled'
    or selected.version <> expected_version
    then raise exception 'Order state changed' using errcode = '40001'; end if;
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  update public.orders set payment_status = requested_status,
    payment_method = requested_method, updated_by = auth.uid(),
    version = orders.version + 1
    where id = selected.id;
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select orders.id, orders.version from public.orders where id = selected.id;
end;
$$;

revoke all on function public.create_manual_order(jsonb, uuid),
  public.update_manual_order_draft(uuid, integer, jsonb),
  public.confirm_manual_order(uuid, integer, uuid),
  public.cancel_manual_order(uuid, integer, text, uuid),
  public.update_manual_order_payment(uuid, integer, public.manual_payment_status,
    public.manual_payment_method)
from public, anon;
grant execute on function public.create_manual_order(jsonb, uuid),
  public.update_manual_order_draft(uuid, integer, jsonb),
  public.confirm_manual_order(uuid, integer, uuid),
  public.cancel_manual_order(uuid, integer, text, uuid),
  public.update_manual_order_payment(uuid, integer, public.manual_payment_status,
    public.manual_payment_method)
to authenticated;
