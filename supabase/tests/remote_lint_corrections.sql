-- Regression coverage for the compensating remote-lint migration.
-- Runs entirely in a transaction and always ends with ROLLBACK.

begin;

do $$
declare
  target regprocedure;
begin
  foreach target in array array[
    'public.normalize_manual_order_payload(jsonb)'::regprocedure,
    'public.normalize_checkout_address(jsonb)'::regprocedure,
    'public.normalize_customer_address(jsonb)'::regprocedure
  ]
  loop
    if (select provolatile from pg_proc where oid = target) <> 's' then
      raise exception '% is not STABLE', target;
    end if;
  end loop;

  target := 'public.lock_customer_order_for_payment(uuid)'::regprocedure;
  if not (select prosecdef from pg_proc where oid = target) then
    raise exception 'Payment order lock helper is not SECURITY DEFINER';
  end if;
  if not (select coalesce(proconfig, '{}'::text[]) @> array['search_path=""']
          from pg_proc where oid = target) then
    raise exception 'Payment order lock helper does not preserve an empty search_path';
  end if;
  if (select prorettype from pg_proc where oid = target) <> 'void'::regtype
    or (select pronargs from pg_proc where oid = target) <> 1
    or (select oidvectortypes(proargtypes) from pg_proc where oid = target) <> 'uuid'
  then
    raise exception 'Payment order lock helper signature changed';
  end if;
  if (select pg_get_userbyid(proowner) from pg_proc where oid = target) <> 'postgres' then
    raise exception 'Payment order lock helper owner changed';
  end if;
  if (select prosrc from pg_proc where oid = target) !~* 'perform\s+1'
    or (select prosrc from pg_proc where oid = target) !~* 'for update'
    or (select prosrc from pg_proc where oid = target) ~* 'selected_status'
  then
    raise exception 'Payment order lock helper no longer uses the intended row lock';
  end if;
end;
$$;

do $$
declare
  normalized jsonb;
begin
  normalized := public.normalize_manual_order_payload('{
    "customer_name":" Ana Pérez ",
    "customer_email":" ANA@EXAMPLE.TEST ",
    "customer_phone":" 4421234567 ",
    "origin_channel":"whatsapp",
    "origin_channel_detail":"",
    "address":{
      "recipient_name":" Ana Pérez ","phone":" 4421234567 ",
      "street":" Reforma ","exterior_number":" 10 ","interior_number":" ",
      "neighborhood":" Centro ","city":" Querétaro ","state":" Querétaro ",
      "postal_code":" 76000 ","references":" Portón verde "
    },
    "shipping_total":1500,"discount_total":1000,
    "discount_reason":" Promoción manual ","internal_note":" Nota interna ",
    "items":[{
      "product_id":"42000000-0000-4000-8000-000000000001",
      "variant_id":"52000000-0000-4000-8000-000000000001","quantity":2
    }]
  }'::jsonb);
  if normalized <> '{
    "customer_name":"Ana Pérez","customer_email":"ana@example.test",
    "customer_phone":"4421234567","origin_channel":"whatsapp",
    "origin_channel_detail":null,"delivery_type":"shipping",
    "address":{
      "recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma",
      "exterior_number":"10","interior_number":null,"neighborhood":"Centro",
      "city":"Querétaro","state":"Querétaro","postal_code":"76000",
      "references":"Portón verde","country_code":"MX"
    },
    "shipping_total":1500,"discount_total":1000,
    "discount_reason":"Promoción manual","internal_note":"Nota interna",
    "items":[{
      "product_id":"42000000-0000-4000-8000-000000000001",
      "variant_id":"52000000-0000-4000-8000-000000000001","quantity":2
    }]
  }'::jsonb then
    raise exception 'Manual order normalization changed: %', normalized;
  end if;
  if jsonb_typeof(normalized->'shipping_total') <> 'number'
    or jsonb_typeof(normalized->'discount_total') <> 'number'
    or jsonb_typeof(normalized->'items'->0->'quantity') <> 'number'
  then
    raise exception 'Manual order numeric JSON types changed';
  end if;

  normalized := public.normalize_checkout_address('{
    "recipient_name":" Ana Pérez ","phone":" 4421234567 ",
    "street":" Reforma ","exterior_number":" 10 ","interior_number":" ",
    "neighborhood":" Centro ","city":" Querétaro ","state":" Querétaro ",
    "postal_code":" 76000 ","references":" Portón verde "
  }'::jsonb);
  if normalized <> '{
    "recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma",
    "exterior_number":"10","interior_number":null,"neighborhood":"Centro",
    "city":"Querétaro","state":"Querétaro","postal_code":"76000",
    "references":"Portón verde","country_code":"MX"
  }'::jsonb then
    raise exception 'Checkout address normalization changed: %', normalized;
  end if;

  normalized := public.normalize_customer_address('{
    "label":" Casa principal ","recipient_name":" Ana   Pérez ",
    "phone":" 442   123 4567 ","street":" Paseo   de la Reforma ",
    "exterior_number":" 10 ","interior_number":"   ",
    "neighborhood":" Centro ","city":" Ciudad   de México ",
    "state":" Ciudad   de México ","postal_code":" 06000 ",
    "references":" Portón   verde ","is_default":true
  }'::jsonb);
  if normalized <> '{
    "label":"Casa principal","recipient_name":"Ana Pérez","phone":"442 123 4567",
    "street":"Paseo de la Reforma","exterior_number":"10","interior_number":null,
    "neighborhood":"Centro","city":"Ciudad de México","state":"Ciudad de México",
    "postal_code":"06000","references":"Portón verde","country_code":"MX",
    "is_default":true
  }'::jsonb then
    raise exception 'Customer address normalization changed: %', normalized;
  end if;
  if jsonb_typeof(normalized->'is_default') <> 'boolean'
    or not (normalized->>'is_default')::boolean
  then
    raise exception 'Customer address boolean JSON type changed';
  end if;

  begin
    perform public.normalize_manual_order_payload('{"items":[]}'::jsonb);
    raise exception 'Invalid manual order payload was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.normalize_checkout_address('{
      "recipient_name":"Ana Pérez","phone":"4421234567","street":"Reforma",
      "exterior_number":"10","neighborhood":"Centro","city":"Querétaro",
      "state":"Querétaro","postal_code":"invalid"
    }'::jsonb);
    raise exception 'Invalid checkout address was accepted';
  exception when sqlstate '22023' then null;
  end;
  begin
    perform public.normalize_customer_address('{
      "label":"Casa","recipient_name":"Ana Pérez","phone":"4421234567",
      "street":"Reforma","exterior_number":"10","neighborhood":"Centro",
      "city":"Querétaro","state":"Querétaro","postal_code":"invalid",
      "is_default":false
    }'::jsonb);
    raise exception 'Invalid customer address was accepted';
  exception when sqlstate '22023' then null;
  end;
end;
$$;

do $$
declare
  target regprocedure;
begin
  foreach target in array array[
    'public.normalize_manual_order_payload(jsonb)'::regprocedure,
    'public.normalize_checkout_address(jsonb)'::regprocedure,
    'public.normalize_customer_address(jsonb)'::regprocedure,
    'public.lock_customer_order_for_payment(uuid)'::regprocedure
  ]
  loop
    if has_function_privilege('anon', target, 'EXECUTE') then
      raise exception 'anon gained EXECUTE on %', target;
    end if;
    if (select pg_get_userbyid(proowner) from pg_proc where oid = target) <> 'postgres' then
      raise exception 'Owner changed for %', target;
    end if;
  end loop;

  if not has_function_privilege(
      'authenticated', 'public.normalize_manual_order_payload(jsonb)', 'EXECUTE')
    or not has_function_privilege(
      'authenticated', 'public.normalize_checkout_address(jsonb)', 'EXECUTE')
    or has_function_privilege(
      'authenticated', 'public.normalize_customer_address(jsonb)', 'EXECUTE')
    or not has_function_privilege(
      'authenticated', 'public.lock_customer_order_for_payment(uuid)', 'EXECUTE')
  then
    raise exception 'Function grants changed';
  end if;
end;
$$;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('16000000-0000-4000-8000-000000000001','authenticated','authenticated',
   'lint.owner@example.test','{}','{}',now(),now()),
  ('16000000-0000-4000-8000-000000000002','authenticated','authenticated',
   'lint.other@example.test','{}','{}',now(),now());

insert into public.orders (
  id, order_number, user_id, status, subtotal, total, shipping_address_snapshot,
  confirmed_at, confirmed_by, payment_status, payment_method, origin
)
values
  ('76000000-0000-4000-8000-000000000001','PG-W-LINT-000001',
   '16000000-0000-4000-8000-000000000001','preparing',1000,1000,
   '{"recipient_name":"Cliente","street":"Prueba"}',now(),
   '16000000-0000-4000-8000-000000000001','transfer_pending','bank_transfer','web'),
  ('76000000-0000-4000-8000-000000000002','PG-W-LINT-000002',
   '16000000-0000-4000-8000-000000000002','preparing',1000,1000,
   '{"recipient_name":"Otro","street":"Prueba"}',now(),
   '16000000-0000-4000-8000-000000000002','transfer_pending','bank_transfer','web'),
  ('76000000-0000-4000-8000-000000000003','PG-M-LINT-000003',
   '16000000-0000-4000-8000-000000000001','pending_confirmation',1000,1000,
   '{"recipient_name":"Cliente","street":"Prueba"}',null,null,
   'pending','none','manual'),
  ('76000000-0000-4000-8000-000000000004','PG-W-LINT-000004',
   '16000000-0000-4000-8000-000000000001','pending_confirmation',1000,1000,
   '{"recipient_name":"Cliente","street":"Prueba"}',null,null,
   'transfer_pending','bank_transfer','web');

insert into public.order_payments (
  id, order_id, method, status, expected_amount, currency
)
values (
  '96000000-0000-4000-8000-000000000004',
  '76000000-0000-4000-8000-000000000004',
  'bank_transfer','pending',1000,'MXN'
);

set local role authenticated;
do $$ begin
  begin
    perform public.lock_customer_order_for_payment(
      '76000000-0000-4000-8000-000000000001');
    raise exception 'Unauthenticated helper call was accepted';
  exception when insufficient_privilege then
    if sqlstate <> '42501' then raise; end if;
  end;
end $$;

select set_config('request.jwt.claim.sub','16000000-0000-4000-8000-000000000001',true);
do $$ begin
  begin
    perform public.lock_customer_order_for_payment(
      '76000000-0000-4000-8000-000000000099');
    raise exception 'Missing order was accepted';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;
  begin
    perform public.lock_customer_order_for_payment(
      '76000000-0000-4000-8000-000000000002');
    raise exception 'Foreign order was accepted';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;
  begin
    perform public.lock_customer_order_for_payment(
      '76000000-0000-4000-8000-000000000003');
    raise exception 'Non-web order was accepted';
  exception when no_data_found then null;
    when others then if sqlstate <> 'P0002' then raise; end if;
  end;

  perform public.lock_customer_order_for_payment(
    '76000000-0000-4000-8000-000000000001');
end $$;

reset role;
update public.site_settings set value = '{"mode":"test"}' where key = 'payments.mode';
set local role authenticated;
do $$ begin
  begin
    perform public.submit_bank_transfer(
      '76000000-0000-4000-8000-000000000004',1,'LINT-STATE-GUARD',
      now(),null,null,'a6000000-0000-4000-8000-000000000001');
    raise exception 'Unconfirmed order reached payment submission';
  exception when invalid_parameter_value then
    if sqlstate <> '22023' then raise; end if;
  end;
end $$;

reset role;
select 'remote lint correction checks passed' as result;
rollback;
