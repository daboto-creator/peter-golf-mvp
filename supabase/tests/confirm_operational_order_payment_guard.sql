-- Regression coverage for Stripe payment gating in operational confirmation.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '17000000-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
    'confirmation.customer@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    '17000000-0000-4000-8000-000000000002', 'authenticated', 'authenticated',
    'confirmation.operator@example.test', '{}'::jsonb, '{}'::jsonb, now(), now()
  );

insert into public.user_roles (user_id, role_id)
select '17000000-0000-4000-8000-000000000002'::uuid, roles.id
from public.roles
where roles.name = 'operator';

insert into public.brands (id, slug, name)
values (
  '27000000-0000-4000-8000-000000000001',
  'confirmation-guard-brand',
  'Confirmation Guard Brand'
);

insert into public.categories (id, slug, name)
values (
  '37000000-0000-4000-8000-000000000001',
  'confirmation-guard-category',
  'Confirmation Guard Category'
);

insert into public.products (
  id, slug, sku, name, condition, brand_id, category_id,
  status, fulfillment_type, price, published
)
values (
  '47000000-0000-4000-8000-000000000001',
  'confirmation-guard-product',
  'CONFIRM-GUARD-P1',
  'Confirmation Guard Product',
  'new',
  '27000000-0000-4000-8000-000000000001',
  '37000000-0000-4000-8000-000000000001',
  'active',
  'in_stock',
  12500,
  true
);

insert into public.product_variants (id, product_id, sku, name)
values (
  '57000000-0000-4000-8000-000000000001',
  '47000000-0000-4000-8000-000000000001',
  'CONFIRM-GUARD-V1',
  'Confirmation Guard Variant'
);

insert into public.inventory (id, variant_id, quantity_on_hand)
values (
  '67000000-0000-4000-8000-000000000001',
  '57000000-0000-4000-8000-000000000001',
  10
);

insert into public.orders (
  id, order_number, user_id, status, subtotal, total,
  shipping_address_snapshot, payment_status, payment_method, origin
)
values
  (
    '77000000-0000-4000-8000-000000000001',
    'PG-W-CONFIRM-STRIPE',
    '17000000-0000-4000-8000-000000000001',
    'pending_confirmation',
    25000,
    25000,
    '{"recipient_name":"Stripe Guard","street":"Prueba"}'::jsonb,
    'transfer_pending',
    'bank_transfer',
    'web'
  ),
  (
    '77000000-0000-4000-8000-000000000002',
    'PG-M-CONFIRM-MANUAL',
    null,
    'pending_confirmation',
    12500,
    12500,
    '{"recipient_name":"Manual Guard","street":"Prueba"}'::jsonb,
    'transfer_pending',
    'bank_transfer',
    'manual'
  );

insert into public.order_items (
  id, order_id, product_id, variant_id, sku_snapshot,
  product_name_snapshot, variant_name_snapshot, condition_snapshot,
  unit_price_snapshot, quantity, line_total
)
values
  (
    '87000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000001',
    '47000000-0000-4000-8000-000000000001',
    '57000000-0000-4000-8000-000000000001',
    'CONFIRM-GUARD-V1',
    'Confirmation Guard Product',
    'Confirmation Guard Variant',
    'new',
    12500,
    2,
    25000
  ),
  (
    '87000000-0000-4000-8000-000000000002',
    '77000000-0000-4000-8000-000000000002',
    '47000000-0000-4000-8000-000000000001',
    '57000000-0000-4000-8000-000000000001',
    'CONFIRM-GUARD-V1',
    'Confirmation Guard Product',
    'Confirmation Guard Variant',
    'new',
    12500,
    1,
    12500
  );

insert into public.order_payments (
  id, order_id, provider, method, status, expected_amount, currency
)
values
  (
    '97000000-0000-4000-8000-000000000001',
    '77000000-0000-4000-8000-000000000001',
    'stripe',
    'card',
    'pending',
    25000,
    'MXN'
  ),
  (
    '97000000-0000-4000-8000-000000000002',
    '77000000-0000-4000-8000-000000000002',
    'manual',
    'bank_transfer',
    'pending',
    12500,
    'MXN'
  );

insert into public.stripe_checkout_sessions (
  id, payment_id, attempt_number, idempotency_key, payload_hash,
  stripe_checkout_session_id, status, amount_total, currency, created_by,
  expires_at
)
values (
  'a7000000-0000-4000-8000-000000000001',
  '97000000-0000-4000-8000-000000000001',
  1,
  'b7000000-0000-4000-8000-000000000001',
  repeat('7', 64),
  'cs_test_operational_confirmation_guard',
  'open',
  25000,
  'MXN',
  '17000000-0000-4000-8000-000000000001',
  now() + interval '30 minutes'
);

update public.site_settings
set value = '{"mode":"test"}'::jsonb
where key = 'stripe.checkout.mode';

-- The replacement keeps the existing invoker model, signature and grants.
do $$
declare
  target regprocedure :=
    'public.confirm_operational_order(uuid,integer,uuid)'::regprocedure;
begin
  if (select prosecdef from pg_proc where oid = target)
    or not (select coalesce(proconfig, '{}'::text[]) @> array['search_path=""']
            from pg_proc where oid = target)
    or has_function_privilege('anon', target, 'EXECUTE')
    or not has_function_privilege('authenticated', target, 'EXECUTE')
  then
    raise exception 'Operational confirmation contract or grants changed';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

-- Pending Stripe payment is rejected before any operational side effect.
do $$
begin
  if not exists (
    select 1 from public.order_payments
    where order_id = '77000000-0000-4000-8000-000000000001'
      and provider = 'stripe' and status = 'pending'
  )
  then
    raise exception 'Stripe pending payment fixture is not visible';
  end if;

  begin
    perform public.confirm_operational_order(
      '77000000-0000-4000-8000-000000000001',
      1,
      'c7000000-0000-4000-8000-000000000001'
    );
    raise exception 'Expected unpaid Stripe confirmation rejection';
  exception
    when invalid_parameter_value then
      if sqlerrm <> 'Stripe payment is not paid' then
        raise;
      end if;
  end;

  if (select status from public.orders
      where id = '77000000-0000-4000-8000-000000000001') <> 'pending_confirmation'
    or (select quantity_on_hand from public.inventory
        where id = '67000000-0000-4000-8000-000000000001') <> 10
    or exists (
      select 1 from public.inventory_movements
      where reference_id = '77000000-0000-4000-8000-000000000001'
    )
  then
    raise exception 'Rejected Stripe confirmation changed operational state';
  end if;
end;
$$;

reset role;
set local role service_role;

-- Only the webhook mechanism marks the Stripe payment paid.
do $$
declare
  result record;
begin
  select * into result from public.process_stripe_webhook_event(
    'evt_operational_confirmation_guard',
    'checkout.session.completed',
    now(),
    '2026-07-29.dahlia',
    false,
    repeat('8', 64),
    'cs_test_operational_confirmation_guard',
    'a7000000-0000-4000-8000-000000000001',
    '97000000-0000-4000-8000-000000000001',
    'pi_operational_confirmation_guard',
    25000,
    'MXN',
    'paid',
    null,
    null,
    null,
    null
  );

  if not result.processed or result.replayed then
    raise exception 'Stripe webhook did not mark the payment paid';
  end if;
end;
$$;

reset role;

do $$
begin
  if (select status from public.order_payments
      where id = '97000000-0000-4000-8000-000000000001') <> 'paid'
  then
    raise exception 'Stripe webhook did not persist the paid status';
  end if;
end;
$$;

select set_config(
  'request.jwt.claim.sub',
  '17000000-0000-4000-8000-000000000002',
  true
);
set local role authenticated;

-- The paid Stripe order now confirms, and idempotent replay is unchanged.
do $$
declare
  result record;
begin
  select * into result from public.confirm_operational_order(
    '77000000-0000-4000-8000-000000000001',
    1,
    'c7000000-0000-4000-8000-000000000001'
  );
  if result.replayed or result.status <> 'preparing' then
    raise exception 'Paid Stripe order was not confirmed';
  end if;

  select * into result from public.confirm_operational_order(
    '77000000-0000-4000-8000-000000000001',
    1,
    'c7000000-0000-4000-8000-000000000001'
  );
  if not result.replayed or result.status <> 'preparing'
  then
    raise exception 'Stripe confirmation replay changed';
  end if;

  if (select quantity_on_hand from public.inventory
      where id = '67000000-0000-4000-8000-000000000001') <> 8
    or (select count(*) from public.inventory_movements
        where reference_id = '77000000-0000-4000-8000-000000000001'
          and movement_type = 'sale') <> 1
  then
    raise exception 'Paid Stripe confirmation inventory result is invalid';
  end if;
end;
$$;

-- Manual pending payments retain the pre-existing confirmation behavior.
do $$
declare
  result record;
begin
  select * into result from public.confirm_operational_order(
    '77000000-0000-4000-8000-000000000002',
    1,
    'c7000000-0000-4000-8000-000000000002'
  );

  if result.replayed or result.status <> 'preparing'
    or (select status from public.order_payments
        where id = '97000000-0000-4000-8000-000000000002') <> 'pending'
    or (select quantity_on_hand from public.inventory
        where id = '67000000-0000-4000-8000-000000000001') <> 7
    or (select count(*) from public.inventory_movements
        where reference_id = '77000000-0000-4000-8000-000000000002'
          and movement_type = 'sale') <> 1
  then
    raise exception 'Manual unpaid confirmation behavior changed';
  end if;
end;
$$;

reset role;

-- Operational confirmation does not rewrite the deprecated payment columns.
do $$
begin
  if exists (
    select 1 from public.orders
    where id in (
      '77000000-0000-4000-8000-000000000001',
      '77000000-0000-4000-8000-000000000002'
    )
      and (payment_status <> 'transfer_pending'
        or payment_method <> 'bank_transfer')
  )
  then
    raise exception 'Operational confirmation rewrote legacy payment columns';
  end if;
end;
$$;

select 'confirm operational order payment guard checks passed' as result;
rollback;
