-- Stripe orders can enter operational preparation only after the webhook has
-- recorded a paid payment. Manual payments retain their existing behavior.

create or replace function public.confirm_operational_order(
  requested_order_id uuid, expected_version integer, requested_idempotency_key uuid
)
returns table (order_id uuid, status public.order_status, replayed boolean)
language plpgsql security invoker set search_path = '' as $$
declare
  selected public.orders%rowtype;
  selected_payment public.order_payments%rowtype;
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
  select * into selected_payment from public.order_payments
    where order_payments.order_id = selected.id;
  if selected_payment.id is not null and selected_payment.provider = 'stripe'
    and selected_payment.status <> 'paid'
  then
    raise exception 'Stripe payment is not paid' using errcode = '22023';
  end if;
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

revoke all on function public.confirm_operational_order(uuid, integer, uuid)
from public, anon;
grant execute on function public.confirm_operational_order(uuid, integer, uuid)
to authenticated;
