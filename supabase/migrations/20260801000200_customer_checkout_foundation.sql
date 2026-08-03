-- Authenticated customer cart and checkout foundation. No payment is collected
-- and carts do not reserve inventory. Operational confirmation remains the
-- only transition that records a sale and decreases quantity_on_hand.

create type public.order_origin as enum ('manual', 'web');

alter table public.orders
  add column origin public.order_origin not null default 'manual';

alter table public.carts
  add column version integer not null default 1,
  add constraint carts_version_positive check (version > 0);

alter table public.cart_items
  add column price_seen public.money_minor_units not null default 0,
  add column currency_seen public.iso_currency_code not null default 'MXN';

create table public.cart_idempotency_keys (
  idempotency_key uuid primary key,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  cart_id uuid references public.carts (id) on delete restrict,
  cart_item_id uuid references public.cart_items (id) on delete set null,
  payload_hash text not null,
  created_at timestamptz not null default now(),
  constraint cart_idempotency_operation_allowed
    check (operation in ('add', 'update', 'remove', 'clear')),
  constraint cart_idempotency_payload_hash_format
    check (payload_hash ~ '^[0-9a-f]{64}$')
);

alter table public.cart_idempotency_keys enable row level security;

alter table public.order_idempotency_keys
  drop constraint order_idempotency_operation_allowed,
  add constraint order_idempotency_operation_allowed
    check (operation in ('create', 'checkout', 'confirm', 'cancel'));

-- One explicit, temporary nationwide shipping rule for this phase. The amount
-- is MXN 149.00 in minor units and is always resolved again in SQL.
insert into public.shipping_methods (
  code, name, description, base_price, currency, active, sort_order
) values (
  'envio_nacional_temporal',
  'Envío nacional temporal',
  'Tarifa fija temporal para el MVP; Peter Golf confirmará la logística.',
  14900,
  'MXN',
  true,
  0
)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  base_price = excluded.base_price,
  currency = excluded.currency,
  active = excluded.active,
  sort_order = excluded.sort_order;

drop policy if exists "users can create own carts" on public.carts;
drop policy if exists "users can update own carts" on public.carts;
drop policy if exists "users can delete own carts" on public.carts;
drop policy if exists "users can create own cart items" on public.cart_items;
drop policy if exists "users can update own cart items" on public.cart_items;
drop policy if exists "users can delete own cart items" on public.cart_items;

create policy "users can create own carts through rpc"
on public.carts for insert to authenticated
with check (
  user_id = (select auth.uid())
  and current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
);
create policy "users can update own carts through rpc"
on public.carts for update to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
);
create policy "users can create own cart items through rpc"
on public.cart_items for insert to authenticated
with check (
  current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
      and carts.status = 'active'
  )
);
create policy "users can update own cart items through rpc"
on public.cart_items for update to authenticated
using (exists (
  select 1 from public.carts
  where carts.id = cart_items.cart_id
    and carts.user_id = (select auth.uid())
))
with check (
  current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
      and carts.status = 'active'
  )
);
create policy "users can delete own cart items through rpc"
on public.cart_items for delete to authenticated
using (
  current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
  and exists (
    select 1 from public.carts
    where carts.id = cart_items.cart_id
      and carts.user_id = (select auth.uid())
      and carts.status = 'active'
  )
);
create policy "users can read own cart idempotency keys"
on public.cart_idempotency_keys for select to authenticated
using (actor_id = (select auth.uid()));
create policy "users can create own cart idempotency keys through rpc"
on public.cart_idempotency_keys for insert to authenticated
with check (
  actor_id = (select auth.uid())
  and current_setting('peter_golf.cart_rpc_write', true) = 'enabled'
);

-- Marker policies exist only to support SECURITY INVOKER functions. A direct
-- PostgREST request cannot establish the transaction-local marker.
create policy "checkout rpc can read inventory"
on public.inventory for select to authenticated
using (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled');
create policy "checkout rpc can lock inventory"
on public.inventory for update to authenticated
using (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled')
with check (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled');
create policy "checkout rpc can read shipping methods"
on public.shipping_methods for select to authenticated
using (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled');
create policy "checkout rpc can lock sellable products"
on public.products for update to authenticated
using (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled')
with check (current_setting('peter_golf.checkout_rpc_read', true) = 'enabled');
create policy "checkout rpc can save own address"
on public.addresses for insert to authenticated
with check (
  user_id = (select auth.uid())
  and current_setting('peter_golf.checkout_rpc_write', true) = 'enabled'
);

revoke insert, update, delete on public.carts, public.cart_items
from anon, authenticated;
grant select on public.carts, public.cart_items to authenticated;
grant insert, update on public.carts to authenticated;
grant insert, update, delete on public.cart_items to authenticated;
grant select on public.cart_idempotency_keys to authenticated;
grant insert on public.cart_idempotency_keys to authenticated;
grant select on public.inventory, public.shipping_methods to authenticated;
grant select on public.addresses to authenticated;
grant insert on public.addresses to authenticated;

create or replace function public.require_cart_rpc_write()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated'
    and current_setting('peter_golf.cart_rpc_write', true) <> 'enabled'
  then
    raise exception 'Cart writes require the cart RPC' using errcode = '42501';
  end if;
  return coalesce(new, old);
end;
$$;
create trigger carts_require_cart_rpc
before insert or update or delete on public.carts
for each row execute function public.require_cart_rpc_write();
create trigger cart_items_require_cart_rpc
before insert or update or delete on public.cart_items
for each row execute function public.require_cart_rpc_write();
create trigger cart_idempotency_requires_cart_rpc
before insert or update or delete on public.cart_idempotency_keys
for each row execute function public.require_cart_rpc_write();
revoke all on function public.require_cart_rpc_write()
from public, anon, authenticated;

create or replace function public.cart_payload_hash(payload jsonb)
returns text language sql immutable set search_path = '' as $$
  select encode(extensions.digest(payload::text, 'sha256'), 'hex');
$$;
revoke all on function public.cart_payload_hash(jsonb)
from public, anon, authenticated;

create or replace function public.get_or_create_active_cart()
returns public.carts language plpgsql security invoker set search_path = '' as $$
declare selected public.carts%rowtype;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into selected from public.carts
  where user_id = auth.uid() and status = 'active' for update;
  if found then return selected; end if;
  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  insert into public.carts (user_id, status, currency)
  values (auth.uid(), 'active', 'MXN') returning * into selected;
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  return selected;
exception when unique_violation then
  select * into selected from public.carts
  where user_id = auth.uid() and status = 'active' for update;
  return selected;
end;
$$;
revoke all on function public.get_or_create_active_cart()
from public, anon, authenticated;

create or replace function public.add_customer_cart_item(
  requested_product_id uuid,
  requested_variant_id uuid,
  requested_quantity integer,
  requested_idempotency_key uuid
)
returns table (cart_id uuid, cart_item_id uuid, quantity integer, version integer, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected_cart public.carts%rowtype;
  selected_item public.cart_items%rowtype;
  selected_price numeric(14,0);
  selected_currency character(3);
  available integer;
  payload jsonb;
  payload_hash text;
  existing public.cart_idempotency_keys%rowtype;
  item_exists boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if requested_idempotency_key is null or requested_quantity not between 1 and 99 then
    raise exception 'Cart quantity is invalid' using errcode = '22023';
  end if;
  payload := jsonb_build_object('product_id', requested_product_id,
    'variant_id', requested_variant_id, 'quantity', requested_quantity);
  payload_hash := public.cart_payload_hash(payload);
  select * into existing from public.cart_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'add'
      or existing.payload_hash <> payload_hash or existing.cart_item_id is null
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select ci.cart_id, ci.id, ci.quantity, c.version, true
      from public.cart_items ci join public.carts c on c.id = ci.cart_id
      where ci.id = existing.cart_item_id;
    return;
  end if;
  perform set_config('peter_golf.checkout_rpc_read', 'enabled', true);
  select coalesce(v.price, p.price), p.currency
    into selected_price, selected_currency
  from public.products p join public.product_variants v on v.product_id = p.id
  where p.id = requested_product_id and v.id = requested_variant_id
    and p.status = 'active' and p.published and p.archived_at is null
    and v.active and v.archived_at is null for share of p;
  if not found or selected_currency <> 'MXN' then
    raise exception 'Product variant is unavailable' using errcode = '22023';
  end if;
  select quantity_on_hand - quantity_reserved into available
  from public.inventory where variant_id = requested_variant_id for update;
  if not found or available < requested_quantity then
    raise exception 'Product is unavailable' using errcode = '23514';
  end if;
  select * into selected_cart from public.carts
  where user_id = auth.uid() and status = 'active' for update;
  if not found then
    perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
    begin
      insert into public.carts (user_id, status, currency)
      values (auth.uid(), 'active', 'MXN') returning * into selected_cart;
    exception when unique_violation then
      select * into selected_cart from public.carts
      where user_id = auth.uid() and status = 'active' for update;
    end;
  end if;
  select * into selected_item from public.cart_items
  where cart_items.cart_id = selected_cart.id
    and cart_items.variant_id = requested_variant_id for update;
  item_exists := found;
  if item_exists and selected_item.quantity + requested_quantity > 99 then
    raise exception 'Cart quantity is invalid' using errcode = '22023';
  end if;
  if item_exists and available < selected_item.quantity + requested_quantity then
    raise exception 'Product is unavailable' using errcode = '23514';
  end if;
  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  if item_exists then
    update public.cart_items set quantity = cart_items.quantity + requested_quantity,
      price_seen = selected_price, currency_seen = selected_currency
    where id = selected_item.id returning * into selected_item;
  else
    insert into public.cart_items (cart_id, variant_id, quantity, price_seen, currency_seen)
    values (selected_cart.id, requested_variant_id, requested_quantity,
      selected_price, selected_currency) returning * into selected_item;
  end if;
  update public.carts set version = carts.version + 1
  where id = selected_cart.id returning * into selected_cart;
  insert into public.cart_idempotency_keys
    (idempotency_key, actor_id, operation, cart_id, cart_item_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'add', selected_cart.id,
    selected_item.id, payload_hash);
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
  return query select selected_cart.id, selected_item.id, selected_item.quantity,
    selected_cart.version, false;
end;
$$;

create or replace function public.change_customer_cart(
  requested_operation text,
  requested_cart_item_id uuid,
  requested_quantity integer,
  expected_version integer,
  requested_idempotency_key uuid
)
returns table (cart_id uuid, version integer, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected_cart public.carts%rowtype;
  selected_item public.cart_items%rowtype;
  selected_price numeric(14,0);
  selected_currency character(3);
  available integer;
  payload jsonb;
  payload_hash text;
  existing public.cart_idempotency_keys%rowtype;
begin
  if auth.uid() is null or requested_idempotency_key is null
    or requested_operation not in ('update', 'remove')
    or expected_version < 1
    or (requested_operation = 'update' and requested_quantity not between 1 and 99)
  then raise exception 'Cart request is invalid' using errcode = '22023'; end if;
  payload := jsonb_build_object('operation', requested_operation,
    'item_id', requested_cart_item_id, 'quantity', case when requested_operation = 'update' then requested_quantity else null end,
    'expected_version', expected_version);
  payload_hash := public.cart_payload_hash(payload);
  select * into existing from public.cart_idempotency_keys
    where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> requested_operation
      or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select c.id, c.version, true from public.carts c
      where c.id = existing.cart_id; return;
  end if;
  select * into selected_cart from public.carts
  where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Cart not found' using errcode = 'P0002'; end if;
  if selected_cart.version <> expected_version then
    raise exception 'Cart changed' using errcode = '40001';
  end if;
  select * into selected_item from public.cart_items
  where id = requested_cart_item_id and cart_items.cart_id = selected_cart.id for update;
  if not found then raise exception 'Cart item not found' using errcode = 'P0002'; end if;
  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  if requested_operation = 'remove' then
    delete from public.cart_items where id = selected_item.id;
  else
    perform set_config('peter_golf.checkout_rpc_read', 'enabled', true);
    select coalesce(v.price, p.price), p.currency into selected_price, selected_currency
    from public.product_variants v join public.products p on p.id = v.product_id
    where v.id = selected_item.variant_id and v.active and v.archived_at is null
      and p.status = 'active' and p.published and p.archived_at is null for share of p;
    if not found or selected_currency <> selected_cart.currency then
      raise exception 'Cart item is unavailable' using errcode = '22023';
    end if;
    select quantity_on_hand - quantity_reserved into available
    from public.inventory where variant_id = selected_item.variant_id for update;
    if not found or available < requested_quantity then
      raise exception 'Product is unavailable' using errcode = '23514';
    end if;
    update public.cart_items set quantity = requested_quantity,
      price_seen = selected_price, currency_seen = selected_currency
    where id = selected_item.id;
  end if;
  update public.carts set version = carts.version + 1
    where id = selected_cart.id returning * into selected_cart;
  insert into public.cart_idempotency_keys
    (idempotency_key, actor_id, operation, cart_id, cart_item_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), requested_operation,
    selected_cart.id, case when requested_operation = 'remove' then null else selected_item.id end,
    payload_hash);
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
  return query select selected_cart.id, selected_cart.version, false;
end;
$$;

create or replace function public.clear_customer_cart(
  expected_version integer, requested_idempotency_key uuid
)
returns table (cart_id uuid, version integer, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare selected public.carts%rowtype; existing public.cart_idempotency_keys%rowtype;
  payload_hash text;
begin
  if auth.uid() is null or requested_idempotency_key is null or expected_version < 1 then
    raise exception 'Cart request is invalid' using errcode = '22023'; end if;
  payload_hash := public.cart_payload_hash(jsonb_build_object('expected_version', expected_version));
  select * into existing from public.cart_idempotency_keys where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'clear'
      or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select c.id, c.version, true from public.carts c where c.id = existing.cart_id; return;
  end if;
  select * into selected from public.carts where user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Cart not found' using errcode = 'P0002'; end if;
  if selected.version <> expected_version then raise exception 'Cart changed' using errcode = '40001'; end if;
  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  delete from public.cart_items where cart_items.cart_id = selected.id;
  update public.carts set version = carts.version + 1 where id = selected.id returning * into selected;
  insert into public.cart_idempotency_keys
    (idempotency_key, actor_id, operation, cart_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'clear', selected.id, payload_hash);
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  return query select selected.id, selected.version, false;
end;
$$;

create or replace function public.get_customer_cart()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare selected public.carts%rowtype; result jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  select * into selected from public.carts where user_id = auth.uid() and status = 'active';
  if not found then return jsonb_build_object('cart_id', null, 'version', null,
    'currency', 'MXN', 'unit_count', 0, 'subtotal', 0, 'has_issues', false, 'items', '[]'::jsonb); end if;
  perform set_config('peter_golf.checkout_rpc_read', 'enabled', true);
  select jsonb_build_object(
    'cart_id', selected.id, 'version', selected.version, 'currency', selected.currency,
    'unit_count', coalesce(sum(ci.quantity), 0),
    'subtotal', coalesce(sum(coalesce(v.price, p.price) * ci.quantity), 0),
    'has_issues', coalesce(bool_or(
      p.id is null or v.id is null or inv.id is null
      or inv.quantity_on_hand - inv.quantity_reserved < ci.quantity
      or ci.price_seen <> coalesce(v.price, p.price)
      or ci.currency_seen <> p.currency or p.currency <> selected.currency
    ), false),
    'items', coalesce(jsonb_agg(jsonb_build_object(
      'id', ci.id, 'product_id', p.id, 'variant_id', v.id, 'slug', p.slug,
      'product_name', coalesce(p.name, 'Producto no disponible'),
      'variant_name', coalesce(v.name, 'Variante no disponible'),
      'sku', coalesce(v.sku, ''), 'quantity', ci.quantity,
      'unit_price', coalesce(v.price, p.price, ci.price_seen),
      'line_total', coalesce(v.price, p.price, ci.price_seen) * ci.quantity,
      'price_changed', ci.price_seen <> coalesce(v.price, p.price, ci.price_seen)
        or ci.currency_seen <> coalesce(p.currency, ci.currency_seen),
      'availability', case
        when p.id is null or v.id is null or inv.id is null then 'unavailable'
        when inv.quantity_on_hand - inv.quantity_reserved < ci.quantity then 'insufficient'
        when inv.quantity_on_hand - inv.quantity_reserved <= 3 then 'low'
        else 'available' end,
      'image_path', image.storage_path
    ) order by ci.created_at), '[]'::jsonb)
  ) into result
  from public.cart_items ci
  left join public.product_variants v on v.id = ci.variant_id
    and v.active and v.archived_at is null
  left join public.products p on p.id = v.product_id
    and p.status = 'active' and p.published and p.archived_at is null
  left join public.inventory inv on inv.variant_id = v.id
  left join lateral (
    select product_images.storage_path from public.product_images
    where product_images.product_id = p.id
    order by product_images.is_primary desc, product_images.sort_order limit 1
  ) image on true
  where ci.cart_id = selected.id;
  perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
  return result;
end;
$$;

create or replace function public.get_customer_shipping_method()
returns table (
  shipping_method_id uuid,
  name text,
  description text,
  base_price numeric(14,0),
  currency character(3)
)
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  perform set_config('peter_golf.checkout_rpc_read', 'enabled', true);
  return query select shipping_methods.id, shipping_methods.name,
    shipping_methods.description, shipping_methods.base_price::numeric(14,0),
    shipping_methods.currency::character(3)
  from public.shipping_methods
  where shipping_methods.code = 'envio_nacional_temporal'
    and shipping_methods.active
  order by shipping_methods.sort_order, shipping_methods.id limit 1;
  perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
end;
$$;

-- Customer checkout writes the existing order model through the same guarded
-- order context used by operational orders.
create policy "customers can create web orders through checkout rpc"
on public.orders for insert to authenticated
with check (
  user_id = (select auth.uid()) and created_by is null and origin = 'web'
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);
create policy "customers can create web order items through checkout rpc"
on public.order_items for insert to authenticated
with check (
  current_setting('peter_golf.order_rpc_write', true) = 'enabled'
  and exists (select 1 from public.orders
    where orders.id = order_items.order_id and orders.user_id = (select auth.uid())
      and orders.origin = 'web' and orders.created_by is null)
);
create policy "customers can create checkout idempotency keys"
on public.order_idempotency_keys for insert to authenticated
with check (
  actor_id = (select auth.uid()) and operation = 'checkout'
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);
create policy "customers can read own checkout idempotency keys"
on public.order_idempotency_keys for select to authenticated
using (actor_id = (select auth.uid()) and operation = 'checkout');

drop policy if exists "order staff can read manual orders" on public.orders;
drop policy if exists "order staff can read manual order items" on public.order_items;
drop policy if exists "order staff can read manual order history" on public.order_status_history;
create policy "order staff can read operational orders"
on public.orders for select to authenticated using ((select public.can_manage_orders()));
create policy "order staff can read operational order items"
on public.order_items for select to authenticated using (
  (select public.can_manage_orders()) and exists (
    select 1 from public.orders where orders.id = order_items.order_id));
create policy "order staff can read operational order history"
on public.order_status_history for select to authenticated using (
  (select public.can_manage_orders()) and exists (
    select 1 from public.orders where orders.id = order_status_history.order_id));

drop policy if exists "order staff can update manual orders through rpc" on public.orders;
create policy "order staff can update operational orders through rpc"
on public.orders for update to authenticated
using ((select public.can_manage_orders()))
with check (
  (select public.can_manage_orders())
  and current_setting('peter_golf.order_rpc_write', true) = 'enabled'
);

create or replace function public.normalize_checkout_address(requested jsonb)
returns jsonb language plpgsql immutable set search_path = '' as $$
declare normalized jsonb;
begin
  if jsonb_typeof(requested) <> 'object' then
    raise exception 'Shipping address is invalid' using errcode = '22023'; end if;
  normalized := jsonb_build_object(
    'recipient_name', btrim(requested->>'recipient_name'),
    'phone', btrim(requested->>'phone'),
    'street', btrim(requested->>'street'),
    'exterior_number', btrim(requested->>'exterior_number'),
    'interior_number', nullif(btrim(requested->>'interior_number'), ''),
    'neighborhood', btrim(requested->>'neighborhood'),
    'city', btrim(requested->>'city'), 'state', btrim(requested->>'state'),
    'postal_code', btrim(requested->>'postal_code'),
    'references', nullif(btrim(requested->>'references'), ''), 'country_code', 'MX');
  if char_length(normalized->>'recipient_name') not between 2 and 120
    or char_length(normalized->>'phone') not between 7 and 30
    or char_length(normalized->>'street') not between 1 and 160
    or char_length(normalized->>'exterior_number') not between 1 and 30
    or (normalized->>'interior_number') is not null and char_length(normalized->>'interior_number') > 30
    or char_length(normalized->>'neighborhood') not between 1 and 120
    or char_length(normalized->>'city') not between 1 and 120
    or char_length(normalized->>'state') not between 1 and 120
    or normalized->>'postal_code' !~ '^[0-9]{5}$'
    or (normalized->>'references') is not null and char_length(normalized->>'references') > 500
  then raise exception 'Shipping address is invalid' using errcode = '22023'; end if;
  return normalized;
end;
$$;
revoke all on function public.normalize_checkout_address(jsonb)
from public, anon, authenticated;
grant execute on function public.cart_payload_hash(jsonb),
  public.normalize_checkout_address(jsonb) to authenticated;

create or replace function public.create_customer_checkout_order(
  requested_cart_id uuid,
  expected_version integer,
  requested_shipping_method_id uuid,
  requested_address jsonb,
  requested_save_address boolean,
  requested_idempotency_key uuid
)
returns table (order_id uuid, order_number text, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected_cart public.carts%rowtype;
  selected_method public.shipping_methods%rowtype;
  normalized_address jsonb;
  payload_hash text;
  existing public.order_idempotency_keys%rowtype;
  line record;
  inv public.inventory%rowtype;
  calculated_subtotal numeric(14,0) := 0;
  selected_currency character(3);
  new_order_id uuid := gen_random_uuid();
  new_order_number text;
  saved_address_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if requested_idempotency_key is null or expected_version < 1 then
    raise exception 'Checkout request is invalid' using errcode = '22023'; end if;
  normalized_address := public.normalize_checkout_address(requested_address);
  payload_hash := public.cart_payload_hash(jsonb_build_object(
    'cart_id', requested_cart_id, 'expected_version', expected_version,
    'shipping_method_id', requested_shipping_method_id,
    'address', normalized_address, 'save_address', requested_save_address));
  perform set_config('peter_golf.checkout_rpc_read', 'enabled', true);
  select * into existing from public.order_idempotency_keys
    where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'checkout'
      or existing.payload_hash <> payload_hash or existing.order_id is null
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.order_number, true from public.orders
      where orders.id = existing.order_id and orders.user_id = auth.uid();
    perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
    return;
  end if;
  select * into selected_cart from public.carts
    where id = requested_cart_id and user_id = auth.uid() and status = 'active' for update;
  if not found then raise exception 'Cart is unavailable' using errcode = 'P0002'; end if;
  if selected_cart.version <> expected_version then raise exception 'Cart changed' using errcode = '40001'; end if;
  if not exists (select 1 from public.cart_items where cart_id = selected_cart.id) then
    raise exception 'Cart is empty' using errcode = '23514'; end if;
  perform 1 from public.cart_items where cart_id = selected_cart.id for update;
  select * into selected_method from public.shipping_methods
  where id = requested_shipping_method_id and code = 'envio_nacional_temporal'
    and active and currency = selected_cart.currency;
  if not found then raise exception 'Shipping method is unavailable' using errcode = '22023'; end if;
  for line in
    select ci.*, p.id product_id, p.name product_name, p.condition,
      p.condition_grade, p.currency product_currency, v.id selected_variant_id,
      v.sku, v.name variant_name, coalesce(v.price, p.price) current_price
    from public.cart_items ci
    join public.product_variants v on v.id = ci.variant_id
    join public.products p on p.id = v.product_id
    where ci.cart_id = selected_cart.id and p.status = 'active' and p.published
      and p.archived_at is null and v.active and v.archived_at is null
    order by v.id for share of p
  loop
    if line.currency_seen <> line.product_currency or line.product_currency <> selected_cart.currency
      or line.price_seen <> line.current_price then
      raise exception 'Cart price changed' using errcode = '40001'; end if;
    select * into inv from public.inventory where variant_id = line.selected_variant_id for update;
    if not found or inv.quantity_on_hand - inv.quantity_reserved < line.quantity then
      raise exception 'Insufficient inventory' using errcode = '23514'; end if;
    calculated_subtotal := calculated_subtotal + line.current_price * line.quantity;
    selected_currency := line.product_currency;
  end loop;
  if (select count(*) from public.cart_items where cart_id = selected_cart.id) <>
    (select count(*) from public.cart_items ci join public.product_variants v on v.id = ci.variant_id
      join public.products p on p.id = v.product_id where ci.cart_id = selected_cart.id
      and p.status = 'active' and p.published and p.archived_at is null
      and v.active and v.archived_at is null)
  then raise exception 'Cart item is unavailable' using errcode = '22023'; end if;
  if requested_save_address then
    perform set_config('peter_golf.checkout_rpc_write', 'enabled', true);
    insert into public.addresses (user_id, label, recipient_name, phone, line_1,
      line_2, neighborhood, city, state, postal_code, country_code)
    values (auth.uid(), 'Envío', normalized_address->>'recipient_name',
      normalized_address->>'phone', concat_ws(' ', normalized_address->>'street', normalized_address->>'exterior_number'),
      normalized_address->>'interior_number', normalized_address->>'neighborhood',
      normalized_address->>'city', normalized_address->>'state',
      normalized_address->>'postal_code', 'MX') returning id into saved_address_id;
    perform set_config('peter_golf.checkout_rpc_write', 'disabled', true);
  end if;
  new_order_number := 'PG-W-' || upper(substr(replace(new_order_id::text, '-', ''), 1, 12));
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  insert into public.orders (
    id, order_number, user_id, shipping_address_id, shipping_method_id, status,
    currency, subtotal, discount_total, shipping_total, tax_total, total,
    shipping_address_snapshot, customer_name, customer_email, customer_phone,
    payment_status, payment_method, origin, created_by, updated_by
  ) values (
    new_order_id, new_order_number, auth.uid(), saved_address_id, selected_method.id,
    'pending_confirmation', selected_currency, calculated_subtotal, 0,
    selected_method.base_price, 0, calculated_subtotal + selected_method.base_price,
    normalized_address, normalized_address->>'recipient_name',
    nullif(auth.jwt()->>'email', ''), normalized_address->>'phone',
    'transfer_pending', 'bank_transfer', 'web', null, null
  );
  insert into public.order_items (
    order_id, product_id, variant_id, sku_snapshot, product_name_snapshot,
    variant_name_snapshot, condition_snapshot, condition_grade_snapshot,
    unit_price_snapshot, currency, quantity, line_total
  ) select new_order_id, p.id, v.id, v.sku, p.name, v.name, p.condition,
    p.condition_grade, coalesce(v.price, p.price), p.currency, ci.quantity,
    coalesce(v.price, p.price) * ci.quantity
  from public.cart_items ci join public.product_variants v on v.id = ci.variant_id
  join public.products p on p.id = v.product_id where ci.cart_id = selected_cart.id;
  insert into public.order_idempotency_keys
    (idempotency_key, actor_id, operation, order_id, payload_hash)
  values (requested_idempotency_key, auth.uid(), 'checkout', new_order_id, payload_hash);
  perform set_config('peter_golf.cart_rpc_write', 'enabled', true);
  update public.carts set status = 'converted', version = carts.version + 1
    where id = selected_cart.id;
  perform set_config('peter_golf.cart_rpc_write', 'disabled', true);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  perform set_config('peter_golf.checkout_rpc_read', 'disabled', true);
  return query select new_order_id, new_order_number, false;
end;
$$;

revoke all on function public.add_customer_cart_item(uuid, uuid, integer, uuid),
  public.change_customer_cart(text, uuid, integer, integer, uuid),
  public.clear_customer_cart(integer, uuid), public.get_customer_cart(),
  public.get_customer_shipping_method(),
  public.create_customer_checkout_order(uuid, integer, uuid, jsonb, boolean, uuid)
from public, anon;
grant execute on function public.add_customer_cart_item(uuid, uuid, integer, uuid),
  public.change_customer_cart(text, uuid, integer, integer, uuid),
  public.clear_customer_cart(integer, uuid), public.get_customer_cart(),
  public.get_customer_shipping_method(),
  public.create_customer_checkout_order(uuid, integer, uuid, jsonb, boolean, uuid)
to authenticated;

create or replace function public.confirm_operational_order(
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
  if not public.can_manage_orders() then raise exception 'Order access denied' using errcode = '42501'; end if;
  if requested_idempotency_key is null then raise exception 'Idempotency key is required' using errcode = '22023'; end if;
  select * into existing from public.order_idempotency_keys where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'confirm'
      or existing.order_id <> requested_order_id or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.status, true from public.orders where orders.id = requested_order_id; return;
  end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.status <> 'pending_confirmation' then raise exception 'Order cannot be confirmed' using errcode = '22023'; end if;
  if selected.version <> expected_version then raise exception 'Order changed' using errcode = '40001'; end if;
  if not exists (select 1 from public.order_items where order_items.order_id = selected.id) then
    raise exception 'Empty order cannot be confirmed' using errcode = '23514'; end if;
  for line in select variant_id, sum(quantity)::integer quantity from public.order_items
    where order_items.order_id = selected.id group by variant_id order by variant_id
  loop
    select * into inv from public.inventory where variant_id = line.variant_id for update;
    if not found or inv.quantity_on_hand - inv.quantity_reserved < line.quantity then
      raise exception 'Insufficient inventory' using errcode = '23514'; end if;
    new_balance := inv.quantity_on_hand - line.quantity;
    perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
    update public.inventory set quantity_on_hand = new_balance where id = inv.id;
    insert into public.inventory_movements (
      inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
      quantity_reserved_after, reason, reference_type, reference_id, actor_id,
      idempotency_key
    ) values (
      inv.id, 'sale', -line.quantity, new_balance, inv.quantity_reserved,
      'Confirmación de pedido ' || selected.order_number, 'order', selected.id,
      auth.uid(), (substr(md5(requested_idempotency_key::text || line.variant_id::text), 1, 8)
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

create or replace function public.cancel_operational_order(
  requested_order_id uuid, expected_version integer,
  requested_reason text, requested_idempotency_key uuid
)
returns table (order_id uuid, status public.order_status, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected public.orders%rowtype;
  existing public.order_idempotency_keys%rowtype;
  line record; inv public.inventory%rowtype; new_balance integer;
  normalized_reason text := btrim(requested_reason); payload_hash text;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied' using errcode = '42501'; end if;
  if requested_idempotency_key is null or char_length(normalized_reason) not between 3 and 500 then
    raise exception 'Cancellation request is invalid' using errcode = '22023'; end if;
  payload_hash := encode(extensions.digest((requested_order_id::text || ':' ||
    expected_version::text || ':cancel:' || normalized_reason)::bytea, 'sha256'), 'hex');
  select * into existing from public.order_idempotency_keys where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'cancel'
      or existing.order_id <> requested_order_id or existing.payload_hash <> payload_hash
    then raise exception 'Idempotency key conflict' using errcode = '23505'; end if;
    return query select orders.id, orders.status, true from public.orders where orders.id = requested_order_id; return;
  end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.status not in ('pending_confirmation', 'preparing') then
    raise exception 'Order cannot be cancelled' using errcode = '22023'; end if;
  if selected.version <> expected_version then raise exception 'Order changed' using errcode = '40001'; end if;
  if selected.status = 'preparing' then
    for line in select variant_id, sum(quantity)::integer quantity from public.order_items
      where order_items.order_id = selected.id group by variant_id order by variant_id
    loop
      select * into inv from public.inventory where variant_id = line.variant_id for update;
      if not found then raise exception 'Inventory history is inconsistent' using errcode = '55000'; end if;
      new_balance := inv.quantity_on_hand + line.quantity;
      perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
      update public.inventory set quantity_on_hand = new_balance where id = inv.id;
      insert into public.inventory_movements (
        inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, reference_type, reference_id, actor_id,
        idempotency_key
      ) values (
        inv.id, 'return', line.quantity, new_balance, inv.quantity_reserved,
        'Cancelación de pedido ' || selected.order_number || ': ' || normalized_reason,
        'order', selected.id, auth.uid(),
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

create or replace function public.update_operational_order_payment(
  requested_order_id uuid, expected_version integer,
  requested_status public.manual_payment_status,
  requested_method public.manual_payment_method
)
returns table (order_id uuid, version integer)
language plpgsql security invoker set search_path = '' as $$
declare selected public.orders%rowtype;
begin
  if not public.can_manage_orders() then raise exception 'Order access denied' using errcode = '42501'; end if;
  select * into selected from public.orders where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if selected.status = 'cancelled' or selected.version <> expected_version then
    raise exception 'Order state changed' using errcode = '40001'; end if;
  perform set_config('peter_golf.order_rpc_write', 'enabled', true);
  update public.orders set payment_status = requested_status,
    payment_method = requested_method, updated_by = auth.uid(), version = orders.version + 1
    where id = selected.id;
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select orders.id, orders.version from public.orders where id = selected.id;
end;
$$;

revoke all on function public.confirm_operational_order(uuid, integer, uuid),
  public.cancel_operational_order(uuid, integer, text, uuid),
  public.update_operational_order_payment(uuid, integer,
    public.manual_payment_status, public.manual_payment_method)
from public, anon;
grant execute on function public.confirm_operational_order(uuid, integer, uuid),
  public.cancel_operational_order(uuid, integer, text, uuid),
  public.update_operational_order_payment(uuid, integer,
    public.manual_payment_status, public.manual_payment_method)
to authenticated;
