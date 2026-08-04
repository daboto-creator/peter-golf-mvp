-- Align normalizer volatility with jsonb_build_object and remove an unused
-- row-lock target without changing normalization or payment behavior.

alter function public.normalize_manual_order_payload(jsonb) stable;
alter function public.normalize_checkout_address(jsonb) stable;
alter function public.normalize_customer_address(jsonb) stable;

create or replace function public.lock_customer_order_for_payment(
  requested_order_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  perform 1
  from public.orders
  where orders.id = requested_order_id
    and orders.user_id = auth.uid() and orders.origin = 'web'
  for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
end;
$$;
