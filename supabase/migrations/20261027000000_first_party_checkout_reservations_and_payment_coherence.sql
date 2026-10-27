-- First Party web checkout shares the existing Marketplace reservation ledger.
-- A new order item cannot be paid for until its stock is reserved in this
-- checkout transaction; payment status changes commit/release that reservation.

create or replace function private.reserve_first_party_checkout_inventory()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.orders%rowtype;
  selected_inventory public.inventory%rowtype;
  reservation_minutes integer;
begin
  if new.item_source <> 'FIRST_PARTY' then
    return new;
  end if;

  -- The Marketplace checkout RPC reserves First Party lines itself, in its
  -- deterministic multi-domain lock loop. Keep this trigger for FP-only web
  -- checkout and avoid a second reservation in mixed checkout.
  if current_setting('peter_golf.marketplace_order_write', true) = 'enabled' then
    return new;
  end if;

  -- Only the authenticated customer checkout RPC sets this marker. Manual and
  -- operational order-item inserts (including legacy web fixtures) must not
  -- create reservations as a side effect.
  if current_setting('peter_golf.first_party_checkout_reservation', true)
      is distinct from 'enabled' then
    return new;
  end if;

  select * into selected_order
  from public.orders
  where id = new.order_id;
  if not found or selected_order.origin <> 'web'
    or selected_order.user_id is distinct from (select auth.uid())
    or selected_order.created_by is not null
  then
    raise exception 'First-party checkout order is invalid'
      using errcode = '42501';
  end if;

  if new.variant_id is null or new.product_id is null or new.quantity < 1
    or not exists (
      select 1 from public.product_variants v
      where v.id = new.variant_id and v.product_id = new.product_id
    )
  then
    raise exception 'First-party checkout item is invalid'
      using errcode = '22023';
  end if;

  if exists (
    select 1 from public.inventory_reservations r
    where r.order_item_id = new.id
  ) then
    raise exception 'Inventory reservation already exists for order item'
      using errcode = '23505';
  end if;

  select i.* into selected_inventory
  from public.inventory i
  where i.variant_id = new.variant_id
  for update;
  if not found or selected_inventory.quantity_on_hand
      - selected_inventory.quantity_reserved < new.quantity
  then
    raise exception 'Insufficient inventory'
      using errcode = '23514';
  end if;

  select r.checkout_reservation_minutes into strict reservation_minutes
  from public.marketplace_operational_rules r
  join public.marketplace_config_versions c on c.id = r.config_version_id
  where c.status = 'PUBLISHED' and c.effective_to is null;

  perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
  update public.inventory
  set quantity_reserved = quantity_reserved + new.quantity
  where id = selected_inventory.id;
  insert into public.inventory_movements (
    inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
    quantity_reserved_after, reason, reference_type, reference_id, actor_id,
    idempotency_key
  ) values (
    selected_inventory.id, 'reservation', 0,
    selected_inventory.quantity_on_hand,
    selected_inventory.quantity_reserved + new.quantity,
    'Reserva checkout First Party', 'order_item', new.id, (select auth.uid()),
    private.marketplace_deterministic_uuid('reserve:' || new.id::text)
  ) on conflict (idempotency_key) where idempotency_key is not null do nothing;
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);

  perform set_config('peter_golf.marketplace_order_write', 'enabled', true);
  insert into public.inventory_reservations (
    order_id, order_item_id, source, inventory_id, quantity,
    idempotency_key, expires_at
  ) values (
    new.order_id, new.id, 'FIRST_PARTY', selected_inventory.id, new.quantity,
    'checkout:' || new.order_id::text || ':' || new.id::text,
    now() + make_interval(mins => reservation_minutes)
  );
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  return new;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  perform set_config('peter_golf.marketplace_order_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function private.reserve_first_party_checkout_inventory()
from public, anon, authenticated, service_role;

drop trigger if exists order_items_reserve_first_party_checkout_inventory
  on public.order_items;
create trigger order_items_reserve_first_party_checkout_inventory
after insert on public.order_items
for each row execute function private.reserve_first_party_checkout_inventory();

-- Mark only the authenticated checkout path while the underlying order and
-- order-item writes run. Keep the existing API, pricing, cart hash/version,
-- payment creation, and all security/grant contracts unchanged.
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

  perform set_config('peter_golf.first_party_checkout_reservation', 'enabled', true);
  select * into result from public.create_customer_checkout_order(
    requested_cart_id, expected_version, requested_shipping_method_id,
    resolved_address, requested_save_address, requested_idempotency_key
  );
  perform set_config('peter_golf.first_party_checkout_reservation', 'disabled', true);

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
exception when others then
  perform set_config('peter_golf.first_party_checkout_reservation', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid
) from public, anon;
grant execute on function public.create_customer_checkout_order(
  uuid, integer, uuid, uuid, jsonb, boolean, uuid
) to authenticated;

-- The six-argument implementation is the internal transactional core. Prevent
-- clients from bypassing the reservation marker via its legacy overload.
revoke all on function public.create_customer_checkout_order(
  uuid, integer, uuid, jsonb, boolean, uuid
) from public, anon, authenticated;

-- The payment aggregate is authoritative. Legacy order payment columns cannot
-- represent card payments, so web card orders use the valid neutral legacy
-- pair (pending/none); they never claim bank transfer. Bank-transfer state is
-- projected only where the legacy enum has an equivalent representation.
create or replace function private.project_web_order_payment_compatibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_order public.orders%rowtype;
  projected_method public.manual_payment_method;
  projected_status public.manual_payment_status;
begin
  select * into selected_order
  from public.orders
  where id = new.order_id;
  if not found or selected_order.origin <> 'web' then
    return new;
  end if;

  if new.method = 'card' then
    projected_method := 'none';
    projected_status := 'pending';
  elsif new.method = 'bank_transfer' then
    if new.status = 'paid' then
      projected_method := 'bank_transfer';
      projected_status := 'transfer_verified';
    elsif new.status in ('pending', 'submitted', 'under_review', 'rejected') then
      projected_method := 'bank_transfer';
      projected_status := 'transfer_pending';
    else
      -- The legacy enum cannot express refund/failure states. Neutralize it;
      -- Operations must use order_payments for any financial decision.
      projected_method := 'none';
      projected_status := 'pending';
    end if;
  else
    return new;
  end if;

  if selected_order.payment_method is distinct from projected_method
    or selected_order.payment_status is distinct from projected_status
  then
    perform set_config('peter_golf.order_rpc_write', 'enabled', true);
    update public.orders
    set payment_method = projected_method,
        payment_status = projected_status
    where id = selected_order.id;
    perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  end if;
  return new;
exception when others then
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function private.project_web_order_payment_compatibility()
from public, anon, authenticated, service_role;

drop trigger if exists order_payments_project_web_order_compatibility
  on public.order_payments;
create trigger order_payments_project_web_order_compatibility
after insert or update of method, status on public.order_payments
for each row execute function private.project_web_order_payment_compatibility();

-- Stock was committed by the paid-payment transition for reservation-backed
-- web orders. Operations confirms their order/fulfillment lifecycle only; the
-- legacy direct inventory sale stays for historical/manual unreserved orders.
create or replace function public.confirm_operational_order(
  requested_order_id uuid, expected_version integer,
  requested_idempotency_key uuid
)
returns table (
  order_id uuid,
  status public.order_status,
  replayed boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  selected public.orders%rowtype;
  selected_payment public.order_payments%rowtype;
  existing public.order_idempotency_keys%rowtype;
  line record;
  inv public.inventory%rowtype;
  new_balance integer;
  has_reservations boolean;
  payload_hash text := encode(extensions.digest(
    (requested_order_id::text || ':' || expected_version::text || ':confirm')::bytea,
    'sha256'), 'hex');
begin
  if not public.can_manage_orders() then
    raise exception 'Order access denied' using errcode = '42501';
  end if;
  if requested_idempotency_key is null then
    raise exception 'Idempotency key is required' using errcode = '22023';
  end if;

  select * into existing from public.order_idempotency_keys
  where idempotency_key = requested_idempotency_key;
  if found then
    if existing.actor_id <> auth.uid() or existing.operation <> 'confirm'
      or existing.order_id <> requested_order_id
      or existing.payload_hash <> payload_hash
    then
      raise exception 'Idempotency key conflict' using errcode = '23505';
    end if;
    return query select o.id, o.status, true
      from public.orders o where o.id = requested_order_id;
    return;
  end if;

  select * into selected from public.orders
  where id = requested_order_id for update;
  if not found then raise exception 'Order not found' using errcode = 'P0002'; end if;
  if exists (
    select 1 from public.order_items oi
    where oi.order_id = selected.id and oi.item_source = 'MARKETPLACE_PARTNER'
  ) or exists (
    select 1 from public.inventory_reservations r
    where r.order_id = selected.id and r.source = 'MARKETPLACE_PARTNER'
  ) then
    raise exception 'Marketplace orders use fulfillment confirmation'
      using errcode = '22023';
  end if;
  if selected.status <> 'pending_confirmation' then
    raise exception 'Order cannot be confirmed' using errcode = '22023';
  end if;
  if selected.version <> expected_version then
    raise exception 'Order changed' using errcode = '40001';
  end if;

  select p.* into selected_payment from public.order_payments p
  where p.order_id = selected.id;
  if selected_payment.id is not null and selected_payment.provider = 'stripe'
    and selected_payment.status <> 'paid'
  then
    raise exception 'Stripe payment is not paid' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.order_items oi where oi.order_id = selected.id
  ) then
    raise exception 'Empty order cannot be confirmed' using errcode = '23514';
  end if;

  select exists (
    select 1 from public.inventory_reservations r
    where r.order_id = selected.id
  ) into has_reservations;

  if has_reservations then
    if selected_payment.id is null or selected_payment.status <> 'paid'
      or exists (
        select 1 from public.inventory_reservations r
        where r.order_id = selected.id and r.status <> 'COMMITTED'
      )
      or exists (
        select 1 from public.order_items oi
        where oi.order_id = selected.id and oi.item_source = 'FIRST_PARTY'
          and not exists (
            select 1 from public.inventory_reservations r
            where r.order_item_id = oi.id and r.source = 'FIRST_PARTY'
              and r.status = 'COMMITTED' and r.quantity = oi.quantity
          )
      )
    then
      raise exception 'Order inventory reservation is not committed'
        using errcode = '23514';
    end if;
    -- Payment transition consumed the reserved stock exactly once.
  else
    -- Compatibility for pre-reservation web orders and operationally entered
    -- orders. New First Party web checkout always has a reservation.
    for line in
      select variant_id, sum(quantity)::integer quantity
      from public.order_items oi
      where oi.order_id = selected.id and oi.item_source = 'FIRST_PARTY'
      group by variant_id order by variant_id
    loop
      select * into inv from public.inventory
      where variant_id = line.variant_id for update;
      if not found or inv.quantity_on_hand - inv.quantity_reserved < line.quantity
      then
        raise exception 'Insufficient inventory' using errcode = '23514';
      end if;
      new_balance := inv.quantity_on_hand - line.quantity;
      perform set_config('peter_golf.inventory_rpc_write', 'enabled', true);
      update public.inventory set quantity_on_hand = new_balance where id = inv.id;
      insert into public.inventory_movements (
        inventory_id, movement_type, quantity_delta, quantity_on_hand_after,
        quantity_reserved_after, reason, reference_type, reference_id,
        actor_id, idempotency_key
      ) values (
        inv.id, 'sale', -line.quantity, new_balance, inv.quantity_reserved,
        'Confirmación de pedido ' || selected.order_number,
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
  update public.orders set status = 'preparing', confirmed_at = now(),
    confirmed_by = auth.uid(), updated_by = auth.uid(), version = version + 1
  where id = selected.id;
  insert into public.order_idempotency_keys (
    idempotency_key, actor_id, operation, order_id, payload_hash
  ) values (
    requested_idempotency_key, auth.uid(), 'confirm', selected.id, payload_hash
  );
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  return query select selected.id, 'preparing'::public.order_status, false;
exception when others then
  perform set_config('peter_golf.inventory_rpc_write', 'disabled', true);
  perform set_config('peter_golf.order_rpc_write', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.confirm_operational_order(uuid, integer, uuid)
from public, anon;
grant execute on function public.confirm_operational_order(uuid, integer, uuid)
to authenticated;

-- Cancellation before payment releases active reservations; committed stock is
-- left to the existing refund/restock lifecycle and is never un-reserved.
create or replace function private.release_active_reservations_on_cancel()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'cancelled' and old.status is distinct from new.status
    and exists (
      select 1 from public.inventory_reservations r
      where r.order_id = new.id and r.status = 'ACTIVE'
    )
  then
    perform private.release_order_reservations_internal(
      new.id, 'RELEASED', coalesce(nullif(btrim(new.cancellation_reason), ''),
        'Pedido cancelado antes del pago.')
    );
  end if;
  return new;
end;
$$;

revoke all on function private.release_active_reservations_on_cancel()
from public, anon, authenticated, service_role;

drop trigger if exists orders_release_active_reservations_on_cancel
  on public.orders;
create trigger orders_release_active_reservations_on_cancel
after update of status on public.orders
for each row execute function private.release_active_reservations_on_cancel();
