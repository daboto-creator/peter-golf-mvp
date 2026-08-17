-- Keep customer order summaries aligned with the one-to-one payment aggregate.
-- Legacy payment columns on orders remain unchanged for compatibility only.

create or replace function public.list_customer_orders()
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
    order by o.created_at desc
    limit 100;
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
exception when others then
  perform set_config('peter_golf.customer_order_read', 'disabled', true);
  raise;
end;
$$;

revoke all on function public.list_customer_orders()
from public, anon, authenticated;
grant execute on function public.list_customer_orders()
to authenticated;
