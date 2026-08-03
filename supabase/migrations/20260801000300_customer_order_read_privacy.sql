-- Customer order reads are exposed only through reviewed projections. The
-- authenticated database role is shared by customers and operational users,
-- so RLS provides the role-aware boundary while the invoker RPCs provide the
-- customer column boundary.

drop policy if exists "users can read own orders" on public.orders;
drop policy if exists "users can read own order items" on public.order_items;
drop policy if exists "users can read own order status history"
  on public.order_status_history;
drop policy if exists "customers can read own checkout idempotency keys"
  on public.order_idempotency_keys;

create policy "customers can read checkout idempotency keys through rpc"
on public.order_idempotency_keys for select to authenticated
using (
  actor_id = (select auth.uid())
  and operation = 'checkout'
  and current_setting('peter_golf.checkout_rpc_read', true) = 'enabled'
);

create policy "customers can read own orders through safe rpc"
on public.orders for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and user_id = (select auth.uid())
  and origin = 'web'
);

create policy "customers can read own order checkout replay through rpc"
on public.orders for select to authenticated
using (
  current_setting('peter_golf.checkout_rpc_read', true) = 'enabled'
  and user_id = (select auth.uid())
  and origin = 'web'
);

create policy "customers can read own order items through safe rpc"
on public.order_items for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1
    from public.orders
    where orders.id = order_items.order_id
      and orders.user_id = (select auth.uid())
      and orders.origin = 'web'
  )
);

create policy "customers can read own order history through safe rpc"
on public.order_status_history for select to authenticated
using (
  current_setting('peter_golf.customer_order_read', true) = 'enabled'
  and exists (
    select 1
    from public.orders
    where orders.id = order_status_history.order_id
      and orders.user_id = (select auth.uid())
      and orders.origin = 'web'
  )
);

create or replace function public.list_customer_orders()
returns table (
  id uuid,
  order_number text,
  created_at timestamptz,
  updated_at timestamptz,
  status public.order_status,
  payment_status public.manual_payment_status,
  payment_method public.manual_payment_method,
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
      o.payment_status, o.payment_method, o.subtotal::numeric,
      o.shipping_total::numeric, o.discount_total::numeric,
      o.tax_total::numeric, o.total::numeric, o.currency::character(3),
      o.shipping_address_snapshot
    from public.orders o
    where o.user_id = auth.uid() and o.origin = 'web'
    order by o.created_at desc
    limit 100;
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
    'id', o.id,
    'order_number', o.order_number,
    'created_at', o.created_at,
    'updated_at', o.updated_at,
    'status', o.status,
    'payment_status', o.payment_status,
    'payment_method', o.payment_method,
    'subtotal', o.subtotal,
    'shipping_total', o.shipping_total,
    'discount_total', o.discount_total,
    'tax_total', o.tax_total,
    'total', o.total,
    'currency', o.currency,
    'shipping_address_snapshot', o.shipping_address_snapshot,
    'order_items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'sku_snapshot', oi.sku_snapshot,
        'product_name_snapshot', oi.product_name_snapshot,
        'variant_name_snapshot', oi.variant_name_snapshot,
        'condition_snapshot', oi.condition_snapshot,
        'condition_grade_snapshot', oi.condition_grade_snapshot,
        'unit_price_snapshot', oi.unit_price_snapshot,
        'currency', oi.currency,
        'quantity', oi.quantity,
        'line_total', oi.line_total
      ) order by oi.created_at, oi.sku_snapshot)
      from public.order_items oi
      where oi.order_id = o.id
    ), '[]'::jsonb),
    'history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'from_status', h.from_status,
        'to_status', h.to_status,
        'created_at', h.created_at
      ) order by h.created_at)
      from public.order_status_history h
      where h.order_id = o.id
    ), '[]'::jsonb)
  ) into result
  from public.orders o
  where o.id = requested_order_id
    and o.user_id = auth.uid()
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
