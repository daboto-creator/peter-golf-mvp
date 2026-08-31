-- Marketplace mixed checkout, immutable economics, reservations, fulfillment
-- privacy and payment replay. Fixtures are transactional.
begin;

insert into auth.users(id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
  ('6a000000-0000-4000-8000-000000000001','authenticated','authenticated','checkout-partner-a@example.test','{}','{}',now(),now()),
  ('6a000000-0000-4000-8000-000000000002','authenticated','authenticated','checkout-partner-b@example.test','{}','{}',now(),now()),
  ('6a000000-0000-4000-8000-000000000003','authenticated','authenticated','checkout-buyer-a@example.test','{}','{}',now(),now()),
  ('6a000000-0000-4000-8000-000000000004','authenticated','authenticated','checkout-buyer-b@example.test','{}','{}',now(),now()),
  ('6a000000-0000-4000-8000-000000000005','authenticated','authenticated','checkout-operator@example.test','{}','{}',now(),now());

insert into public.user_roles(user_id,role_id)
select '6a000000-0000-4000-8000-000000000005',id from public.roles where name='operator';
insert into public.partner_profiles(id,user_id,legal_type,status,verified_at) values
  ('6b000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now()),
  ('6b000000-0000-4000-8000-000000000002','6a000000-0000-4000-8000-000000000002','INDIVIDUAL','VERIFIED',now());

do $$
declare brand_id uuid; category_id uuid; model_id uuid; listing_a uuid:=gen_random_uuid();
  listing_b uuid:=gen_random_uuid(); version_a uuid:=gen_random_uuid(); version_b uuid:=gen_random_uuid();
  selected_variant_id uuid; inv public.inventory%rowtype;
begin
  select id into strict brand_id from public.brands order by name limit 1;
  select id into strict category_id from public.categories where slug='driver';
  insert into public.catalog_product_models(brand_id,category_id,model_name,normalized_model_name)
  values(brand_id,category_id,'Checkout Test Driver','checkout-test-driver') returning id into model_id;
  insert into public.marketplace_listings(id,partner_id,status,lock_version) values
    (listing_a,'6b000000-0000-4000-8000-000000000001','DRAFT',1),
    (listing_b,'6b000000-0000-4000-8000-000000000002','DRAFT',1);
  insert into public.marketplace_listing_versions(
    id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,title,description,
    condition,condition_grade,condition_notes,defects_acknowledged,specifications,
    declared_defects,accessories_included,quantity,fulfillment,custody,submitted_at,reviewed_at,created_by
  ) values
    (version_a,listing_a,1,'APPROVED',model_id,brand_id,category_id,'Partner A Driver','Driver seminuevo aprobado para checkout.',
      'used','excellent','Equipo revisado',true,'{"handedness":"right","shaftFlex":"regular","loftDegrees":10.5}','[]','[]',1,'PARTNER_FULFILLED','PARTNER_CUSTODY',now(),now(),'6a000000-0000-4000-8000-000000000005'),
    (version_b,listing_b,1,'APPROVED',model_id,brand_id,category_id,'Partner B Driver','Driver seminuevo aprobado para checkout.',
      'used','good','Equipo revisado',true,'{"handedness":"right","shaftFlex":"stiff","loftDegrees":9}','[]','[]',1,'PARTNER_FULFILLED','PARTNER_CUSTODY',now(),now(),'6a000000-0000-4000-8000-000000000005');
  update public.marketplace_listings set status='APPROVED',
    current_version_id=case id when listing_a then version_a else version_b end,
    approved_version_id=case id when listing_a then version_a else version_b end,approved_at=now()
    where id in(listing_a,listing_b);
  insert into public.marketplace_listing_inventory(listing_id,quantity_on_hand)
    values(listing_a,1),(listing_b,1);
  insert into public.marketplace_listing_images(
    id,listing_id,storage_path,mime_type,size_bytes,sha256,uploaded_by
  )
  select image_id, listing_id,
    'listings/' || partner_id || '/' || listing_id || '/' || version_id || '/' || image_id || '.jpg',
    'image/jpeg',100,repeat('a',64),'6a000000-0000-4000-8000-000000000005'::uuid
  from (values
    (gen_random_uuid(),listing_a,'6b000000-0000-4000-8000-000000000001'::uuid,version_a),
    (gen_random_uuid(),listing_a,'6b000000-0000-4000-8000-000000000001'::uuid,version_a),
    (gen_random_uuid(),listing_a,'6b000000-0000-4000-8000-000000000001'::uuid,version_a),
    (gen_random_uuid(),listing_a,'6b000000-0000-4000-8000-000000000001'::uuid,version_a),
    (gen_random_uuid(),listing_a,'6b000000-0000-4000-8000-000000000001'::uuid,version_a),
    (gen_random_uuid(),listing_b,'6b000000-0000-4000-8000-000000000002'::uuid,version_b),
    (gen_random_uuid(),listing_b,'6b000000-0000-4000-8000-000000000002'::uuid,version_b),
    (gen_random_uuid(),listing_b,'6b000000-0000-4000-8000-000000000002'::uuid,version_b),
    (gen_random_uuid(),listing_b,'6b000000-0000-4000-8000-000000000002'::uuid,version_b),
    (gen_random_uuid(),listing_b,'6b000000-0000-4000-8000-000000000002'::uuid,version_b)
  ) fixture(image_id,listing_id,partner_id,version_id);
  insert into public.marketplace_listing_version_images(
    version_id,image_id,image_type,requirement,sort_order,alt_text,is_sensitive
  )
  select image.listing_version_id,image.id,
    (array['face','crown','sole','shaft','grip'])[row_number() over(partition by image.listing_id order by image.id)],
    'REQUIRED',row_number() over(partition by image.listing_id order by image.id)-1,
    'Vista aprobada del driver',false
  from (
    select metadata.*, (storage.foldername(metadata.storage_path))[4]::uuid listing_version_id
    from public.marketplace_listing_images metadata
    where metadata.listing_id in(listing_a,listing_b)
  ) image;
  select v.id into strict selected_variant_id from public.product_variants v join public.products p on p.id=v.product_id
    where v.active and p.status='active' and p.published order by v.created_at limit 1;
  perform set_config('peter_golf.inventory_rpc_write','enabled',true);
  insert into public.inventory(variant_id,quantity_on_hand) values(selected_variant_id,5)
    on conflict(variant_id) do update set quantity_on_hand=5,quantity_reserved=0 returning * into inv;
  perform set_config('peter_golf.inventory_rpc_write','disabled',true);
  perform set_config('test.checkout_listing_a',listing_a::text,true);
  perform set_config('test.checkout_listing_b',listing_b::text,true);
  perform set_config('test.checkout_version_a',version_a::text,true);
  perform set_config('test.checkout_version_b',version_b::text,true);
  perform set_config('test.checkout_variant',selected_variant_id::text,true);
  perform set_config('test.checkout_product',(select product_id::text from public.product_variants where id=selected_variant_id),true);
end;
$$;

-- Create and submit one deterministic quote for each Partner.
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare q public.marketplace_pricing_quotes; begin
  q:=public.create_marketplace_pricing_quote(current_setting('test.checkout_listing_a')::uuid,
    current_setting('test.checkout_version_a')::uuid,'PUBLIC_PRICE_PRIORITY',100000,null,null,
    '6c000000-0000-4000-8000-000000000001');
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'PARTNER_ACCEPTED',null);
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'UNDER_REVIEW',null);
  perform set_config('test.checkout_quote_a',q.id::text,true);
end $$;
reset role;
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare q public.marketplace_pricing_quotes; begin
  q:=public.create_marketplace_pricing_quote(current_setting('test.checkout_listing_b')::uuid,
    current_setting('test.checkout_version_b')::uuid,'PUBLIC_PRICE_PRIORITY',120000,null,null,
    '6c000000-0000-4000-8000-000000000002');
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'PARTNER_ACCEPTED',null);
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'UNDER_REVIEW',null);
  perform set_config('test.checkout_quote_b',q.id::text,true);
end $$;
reset role;

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ declare q public.marketplace_pricing_quotes; begin
  select * into q from public.marketplace_pricing_quotes where id=current_setting('test.checkout_quote_a')::uuid;
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'APPROVED','Economía aprobada para checkout');
  select * into q from public.marketplace_pricing_quotes where id=current_setting('test.checkout_quote_b')::uuid;
  q:=public.transition_marketplace_pricing_quote(q.id,q.lock_version,'APPROVED','Economía aprobada para checkout');
end $$;
reset role;

update public.site_settings set value='{"enabled":true}' where key='marketplace.enabled';

-- Both buyers may add the last unit before reservation. Only checkout A wins.
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare c record; begin
  select * into c from public.add_customer_cart_item(current_setting('test.checkout_product')::uuid,current_setting('test.checkout_variant')::uuid,1,
    '6d000000-0000-4000-8000-000000000001');
  select * into c from public.add_marketplace_cart_item(current_setting('test.checkout_listing_a')::uuid,
    current_setting('test.checkout_quote_a')::uuid,1,'6d000000-0000-4000-8000-000000000002');
  select * into c from public.add_marketplace_cart_item(current_setting('test.checkout_listing_b')::uuid,
    current_setting('test.checkout_quote_b')::uuid,1,'6d000000-0000-4000-8000-000000000003');
  perform set_config('test.checkout_cart_a',c.cart_id::text,true);
  perform set_config('test.checkout_cart_a_version',c.version::text,true);
end $$;
reset role;

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare c record; begin
  select * into c from public.add_marketplace_cart_item(current_setting('test.checkout_listing_a')::uuid,
    current_setting('test.checkout_quote_a')::uuid,1,'6d000000-0000-4000-8000-000000000004');
  perform set_config('test.checkout_cart_b',c.cart_id::text,true);
  perform set_config('test.checkout_cart_b_version',c.version::text,true);
end $$;
reset role;

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare o record; method_id uuid; begin
  select shipping_method_id into strict method_id from public.get_customer_shipping_method();
  select * into o from public.create_marketplace_checkout_order(
    current_setting('test.checkout_cart_a')::uuid,current_setting('test.checkout_cart_a_version')::integer,
    method_id,null,'{"recipient_name":"Buyer A","phone":"5512345678","street":"Golf","exterior_number":"1","interior_number":"","neighborhood":"Centro","city":"CDMX","state":"CDMX","postal_code":"01000","references":"Recepción"}',
    false,'6e000000-0000-4000-8000-000000000001','bank_transfer');
  perform set_config('test.checkout_order',o.order_id::text,true);
  if (select count(*) from public.get_customer_order_fulfillment_summary(o.order_id))<>3 then
    raise exception 'Mixed order did not create exactly three fulfillment groups'; end if;
  select * into o from public.create_marketplace_checkout_order(
    current_setting('test.checkout_cart_a')::uuid,current_setting('test.checkout_cart_a_version')::integer,
    method_id,null,'{"recipient_name":"Buyer A","phone":"5512345678","street":"Golf","exterior_number":"1","interior_number":"","neighborhood":"Centro","city":"CDMX","state":"CDMX","postal_code":"01000","references":"Recepción"}',
    false,'6e000000-0000-4000-8000-000000000001','bank_transfer');
  if not o.replayed then raise exception 'Checkout retry created a new order'; end if;
end $$;
reset role;

do $$ begin
  if (select count(*) from public.inventory_reservations
    where order_id=current_setting('test.checkout_order')::uuid and status='ACTIVE')<>3
  then raise exception 'Mixed order did not reserve every item'; end if;
  if (select count(*) from public.marketplace_order_item_snapshots s
    join public.marketplace_pricing_quotes q on q.id=s.pricing_quote_id
    where s.fulfillment_id in(select id from public.order_fulfillments
      where order_id=current_setting('test.checkout_order')::uuid)
      and s.commission_rate_bps=q.commission_rate_bps and s.config_version_id=q.config_version_id)<>2
  then raise exception 'Marketplace economics snapshot did not match approved quotes'; end if;
end $$;

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare method_id uuid; begin
  select shipping_method_id into strict method_id from public.get_customer_shipping_method();
  begin
    perform public.create_marketplace_checkout_order(
      current_setting('test.checkout_cart_b')::uuid,current_setting('test.checkout_cart_b_version')::integer,
      method_id,null,'{"recipient_name":"Buyer B","phone":"5512345678","street":"Golf","exterior_number":"2","interior_number":"","neighborhood":"Centro","city":"CDMX","state":"CDMX","postal_code":"01000","references":"Recepción"}',
      false,'6e000000-0000-4000-8000-000000000002','bank_transfer');
    raise exception 'Last unit was oversold';
  exception when check_violation then null; end;
end $$;
reset role;

-- A paid event commits inventory and activates Partner fulfillments once.
update public.order_payments set status='paid',paid_at=now(),version=version+1
where order_id=current_setting('test.checkout_order')::uuid;
update public.order_payments set status='paid' where order_id=current_setting('test.checkout_order')::uuid;
do $$ begin
  if exists(select 1 from public.inventory_reservations
    where order_id=current_setting('test.checkout_order')::uuid and status<>'COMMITTED')
  then raise exception 'Payment did not commit reservations'; end if;
  if exists(select 1 from public.order_fulfillments
    where order_id=current_setting('test.checkout_order')::uuid and activated_at is null)
  then raise exception 'Payment did not activate fulfillments'; end if;
  if (select count(*) from public.marketplace_partner_payables
    where order_id=current_setting('test.checkout_order')::uuid)<>2
  then raise exception 'Payment replay did not create exactly one payable per Partner item'; end if;
  if exists(select 1 from public.marketplace_partner_payables p
    join public.marketplace_order_item_snapshots s on s.order_item_id=p.order_item_id
    where p.order_id=current_setting('test.checkout_order')::uuid
      and (p.original_amount_cents<>s.estimated_partner_net
        or p.currency<>s.currency or p.status<>'PENDING'))
  then raise exception 'Partner payable drifted from immutable PR6 snapshot'; end if;
  if exists(select 1 from public.marketplace_partner_payables p
    join public.order_items oi on oi.id=p.order_item_id
    where oi.item_source<>'MARKETPLACE_PARTNER')
  then raise exception 'First-party item created a Partner payable'; end if;
  begin
    update public.marketplace_order_item_snapshots set commission_rate_bps=1
      where fulfillment_id in(select id from public.order_fulfillments
        where order_id=current_setting('test.checkout_order')::uuid);
    raise exception 'Marketplace order economics were mutable';
  exception when object_not_in_prerequisite_state then null; end;
end $$;

-- Partner A sees only its safe fulfillment DTO and cannot mutate economics.
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare f public.order_fulfillments; replay public.order_fulfillments; begin
  if (select count(distinct fulfillment_id) from public.get_partner_marketplace_sales())<>1
    or exists(select 1 from public.marketplace_order_item_snapshots)
    or (select count(*) from public.marketplace_partner_payables)<>1
    or (select count(*) from public.marketplace_partner_ledger_entries)<>1
  then raise exception 'Partner fulfillment/economics isolation failed'; end if;
  select * into strict f from public.order_fulfillments where partner_id='6b000000-0000-4000-8000-000000000001';
  f:=public.transition_partner_fulfillment(f.id,f.version,'CONFIRM_AVAILABILITY','Disponibilidad confirmada',
    '6f000000-0000-4000-8000-000000000001');
  replay:=public.transition_partner_fulfillment(f.id,f.version-1,'CONFIRM_AVAILABILITY','Disponibilidad confirmada',
    '6f000000-0000-4000-8000-000000000001');
  if replay.id<>f.id or replay.version<>f.version then
    raise exception 'Partner fulfillment transition replay was not idempotent'; end if;
  f:=public.transition_partner_fulfillment(f.id,f.version,'START_PREPARING','Preparando producto',
    '6f000000-0000-4000-8000-000000000002');
  f:=public.transition_partner_fulfillment(f.id,f.version,'READY_FOR_CARRIER','Producto listo',
    '6f000000-0000-4000-8000-000000000003');
  f:=public.confirm_partner_fulfillment_shipment(f.id,f.version,'Paquetería Test','TRACK-TEST-001',
    now(),'Entregado al transportista','6f000000-0000-4000-8000-000000000004');
  replay:=public.confirm_partner_fulfillment_shipment(f.id,f.version-1,'Paquetería Test','TRACK-TEST-001',
    now(),'Entregado al transportista','6f000000-0000-4000-8000-000000000004');
  if f.status<>'SHIPPED' or f.carrier<>'Paquetería Test' or f.tracking_number<>'TRACK-TEST-001'
    or replay.id<>f.id or replay.version<>f.version then
    raise exception 'Partner shipment confirmation or replay failed'; end if;
  begin
    update public.order_fulfillments set status='COMPLETED';
    raise exception 'Partner bypassed fulfillment RPC';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- Operations financial commands preserve multiple holds, explicit release,
-- compensating reversals, exact balances and replay idempotency. Use Partner B
-- so Partner A's fulfillment transition regression above remains untouched.
select set_config('peter_golf.marketplace_order_write','enabled',true);
alter table public.order_fulfillments disable trigger order_fulfillments_sync_order;
update public.order_fulfillments set status='ACCEPTANCE_PENDING',version=version+1
where partner_id='6b000000-0000-4000-8000-000000000002';
alter table public.order_fulfillments enable trigger order_fulfillments_sync_order;
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ declare payable public.marketplace_partner_payables;
  held public.marketplace_partner_payables; released public.marketplace_partner_payables;
  first_hold uuid; second_hold uuid; remaining bigint; entry_count bigint;
begin
  select p.* into strict payable from public.marketplace_partner_payables p
    where p.partner_id='6b000000-0000-4000-8000-000000000002';
  held:=public.place_marketplace_partner_payable_hold(payable.id,'OPERATIONS',
    'Validación operativa visible','true','71000000-0000-4000-8000-000000000001');
  held:=public.place_marketplace_partner_payable_hold(payable.id,'RISK',
    'Revisión interna de riesgo','false','71000000-0000-4000-8000-000000000002');
  select id into strict first_hold from public.marketplace_partner_holds
    where placed_idempotency_key='71000000-0000-4000-8000-000000000001';
  select id into strict second_hold from public.marketplace_partner_holds
    where placed_idempotency_key='71000000-0000-4000-8000-000000000002';
  if held.status<>'ON_HOLD' or (select count(*) from public.marketplace_partner_holds
    where payable_id=payable.id and status='ACTIVE')<>2
  then raise exception 'Multiple holds were not preserved'; end if;
  begin
    perform public.release_marketplace_partner_payable(payable.id,'OPERATIONS_APPROVED',
      'Entrega aceptada por conciliación','71000000-0000-4000-8000-000000000003');
    raise exception 'Active hold did not block release';
  exception when check_violation then null; end;
  held:=public.release_marketplace_partner_payable_hold(first_hold,
    'Primera revisión completada','71000000-0000-4000-8000-000000000004');
  if held.status<>'ON_HOLD' then raise exception 'One remaining hold was ignored'; end if;
  held:=public.release_marketplace_partner_payable_hold(second_hold,
    'Riesgo descartado','71000000-0000-4000-8000-000000000005');
  if held.status<>'PENDING' then raise exception 'Last hold did not restore pending'; end if;
  released:=public.release_marketplace_partner_payable(payable.id,'OPERATIONS_APPROVED',
    'Entrega aceptada y obligación íntegra','71000000-0000-4000-8000-000000000006');
  entry_count:=(select count(*) from public.marketplace_partner_ledger_entries
    where payable_id=payable.id);
  released:=public.release_marketplace_partner_payable(payable.id,'OPERATIONS_APPROVED',
    'Entrega aceptada y obligación íntegra','71000000-0000-4000-8000-000000000006');
  if released.status<>'AVAILABLE' or entry_count<>(select count(*)
    from public.marketplace_partner_ledger_entries where payable_id=payable.id)
  then raise exception 'Payable release replay changed ledger impact'; end if;
  released:=public.reverse_marketplace_partner_payable(payable.id,100,
    'Ajuste parcial conciliado','71000000-0000-4000-8000-000000000007');
  if released.status<>'AVAILABLE' or released.reversed_amount_cents<>100
  then raise exception 'Partial available reversal was incorrect'; end if;
  remaining:=released.original_amount_cents-released.reversed_amount_cents;
  released:=public.reverse_marketplace_partner_payable(payable.id,remaining,
    'Reversión total conciliada','71000000-0000-4000-8000-000000000008');
  entry_count:=(select count(*) from public.marketplace_partner_ledger_entries
    where payable_id=payable.id);
  released:=public.reverse_marketplace_partner_payable(payable.id,remaining,
    'Reversión total conciliada','71000000-0000-4000-8000-000000000008');
  if released.status<>'REVERSED' or entry_count<>(select count(*)
    from public.marketplace_partner_ledger_entries where payable_id=payable.id)
  then raise exception 'Reversal replay changed ledger impact'; end if;
  if exists(select 1 from public.marketplace_partner_ledger_entries l
    where l.payable_id=payable.id and l.amount_cents<>
      l.pending_delta_cents+l.on_hold_delta_cents+l.available_delta_cents+l.paid_delta_cents)
  then raise exception 'Ledger money conservation failed'; end if;
end $$;
reset role;

-- Partner B can reconstruct only its own zero net position after reversal;
-- hidden risk hold details never cross the RLS boundary.
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare balance record; begin
  select * into balance from public.get_partner_marketplace_balance();
  if balance.pending_cents<>0 or balance.on_hold_cents<>0
    or balance.available_cents<>0 or balance.net_position_cents<>0
    or balance.reversed_cents<=0
  then raise exception 'Partner balance did not reconstruct from ledger'; end if;
  if exists(select 1 from public.marketplace_partner_holds where source='RISK')
    or exists(select 1 from public.marketplace_partner_ledger_entries
      where entry_type='PAYABLE_HELD' and metadata->>'partner_visible'='false')
    or exists(select 1 from public.marketplace_partner_payable_status_history
      where not partner_visible)
  then raise exception 'Internal hold reason leaked to Partner'; end if;
  begin
    update public.marketplace_partner_payables set original_amount_cents=1;
    raise exception 'Partner mutated financial obligation';
  exception when insufficient_privilege then null; end;
  begin
    perform public.release_marketplace_partner_payable(
      (select id from public.marketplace_partner_payables limit 1),
      'OPERATIONS_APPROVED','Intento Partner','71000000-0000-4000-8000-000000000009');
    raise exception 'Partner released own payable';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

-- PR9 manual payout: exact AVAILABLE selection, claim/hold race protection,
-- external transfer recording and one immutable AVAILABLE -> PAID movement.
select set_config('peter_golf.marketplace_order_write','enabled',true);
alter table public.order_fulfillments disable trigger order_fulfillments_sync_order;
update public.order_fulfillments set status='ACCEPTANCE_PENDING',version=version+1
where partner_id='6b000000-0000-4000-8000-000000000001';
alter table public.order_fulfillments enable trigger order_fulfillments_sync_order;
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ declare payable public.marketplace_partner_payables; payout public.marketplace_partner_payouts;
  settlement public.marketplace_partner_settlements; payable_hold uuid; payout_hold uuid;
  entry_count bigint; original bigint;
begin
  select * into strict payable from public.marketplace_partner_payables
    where partner_id='6b000000-0000-4000-8000-000000000001';
  payable:=public.release_marketplace_partner_payable(payable.id,'OPERATIONS_APPROVED',
    'Entrega aceptada para prueba de payout','72000000-0000-4000-8000-000000000001');
  original:=payable.original_amount_cents;
  payout:=public.create_marketplace_partner_payout(payable.partner_id,array[payable.id],
    '72000000-0000-4000-8000-000000000002');
  if payout.total_cents<>original or payout.item_count<>1 or payout.provider<>'MANUAL_BANK_TRANSFER'
  then raise exception 'Payout total did not equal exact AVAILABLE amount'; end if;
  perform public.add_marketplace_partner_payout_item(payout.id,payable.id,
    '72000000-0000-4000-8000-000000000003');
  if (select count(*) from public.marketplace_partner_payout_items
    where payout_id=payout.id and released_at is null)<>1
  then raise exception 'Duplicate payable was attached'; end if;
  payout:=public.mark_marketplace_partner_payout_ready(payout.id,'Payout revisado y listo',
    '72000000-0000-4000-8000-000000000004');
  perform public.place_marketplace_partner_payable_hold(payable.id,'RISK',
    'Hold tardío bloquea payout','true','72000000-0000-4000-8000-000000000005');
  select id into strict payable_hold from public.marketplace_partner_holds
    where placed_idempotency_key='72000000-0000-4000-8000-000000000005';
  select * into payout from public.marketplace_partner_payouts where id=payout.id;
  if payout.status<>'ON_HOLD' then raise exception 'Payable hold did not block prepared payout'; end if;
  begin
    perform public.record_marketplace_manual_transfer(payout.id,current_date,'Banco test','SPEI-PR9-001',original,
      'No mueve dinero','72000000-0000-4000-8000-000000000006');
    raise exception 'Held payout recorded transfer';
  exception when others then
    if sqlerrm='Held payout recorded transfer' then raise; end if;
  end;
  perform public.release_marketplace_partner_payable_hold(payable_hold,'Reclamo descartado',
    '72000000-0000-4000-8000-000000000007');
  select id into strict payout_hold from public.marketplace_partner_payout_holds
    where payout_id=payout.id and status='ACTIVE';
  payout:=public.release_marketplace_partner_payout_hold(payout_hold,'Bloqueo de claim retirado',
    '72000000-0000-4000-8000-000000000008');
  settlement:=public.record_marketplace_manual_transfer(payout.id,current_date,'Banco test','SPEI-PR9-001',original,
    'Transferencia externa test','72000000-0000-4000-8000-000000000009');
  if settlement.amount_cents<>original or settlement.status<>'PENDING'
  then raise exception 'Manual transfer evidence is invalid'; end if;
  begin
    perform public.record_marketplace_manual_transfer(payout.id,current_date,'Banco test','SPEI-WRONG',original-1,
      'Monto incorrecto','72000000-0000-4000-8000-000000000010');
    raise exception 'Mismatched transfer replay was accepted';
  exception when unique_violation then null; end;
  payout:=public.confirm_marketplace_payout_settlement(payout.id,'72000000-0000-4000-8000-000000000011');
  entry_count:=(select count(*) from public.marketplace_partner_ledger_entries where payable_id=payable.id and entry_type='PAYABLE_PAID');
  payout:=public.confirm_marketplace_payout_settlement(payout.id,'72000000-0000-4000-8000-000000000011');
  select * into payable from public.marketplace_partner_payables where id=payable.id;
  if payout.status<>'PAID' or payable.status<>'PAID' or payable.paid_amount_cents<>original
    or entry_count<>1 or entry_count<>(select count(*) from public.marketplace_partner_ledger_entries where payable_id=payable.id and entry_type='PAYABLE_PAID')
  then raise exception 'Settlement replay duplicated or drifted PAID ledger effect'; end if;
  if exists(select 1 from public.marketplace_partner_ledger_entries l where l.payable_id=payable.id
    and l.amount_cents<>l.pending_delta_cents+l.on_hold_delta_cents+l.available_delta_cents+l.paid_delta_cents)
  then raise exception 'Payout ledger conservation failed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.get_partner_marketplace_payouts())<>1
    or (select status from public.get_partner_marketplace_payouts())<>'PAID'
  then raise exception 'Partner A cannot read own paid payout'; end if;
  begin update public.marketplace_partner_payouts set total_cents=1;
    raise exception 'Partner mutated payout';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists(select 1 from public.get_partner_marketplace_payouts())
    or exists(select 1 from public.marketplace_partner_payouts)
  then raise exception 'Partner B read Partner A payout'; end if;
end $$;
reset role;

-- Restock only after proving the last-unit loser. Its same cart can retry and
-- an expired reservation releases atomically without a duplicate decrement.
select set_config('peter_golf.marketplace_order_write','enabled',true);
update public.marketplace_listing_inventory set quantity_on_hand=1,quantity_reserved=0
where listing_id=current_setting('test.checkout_listing_a')::uuid;
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare method_id uuid; o record; begin
  select shipping_method_id into strict method_id from public.get_customer_shipping_method();
  select * into o from public.create_marketplace_checkout_order(
    current_setting('test.checkout_cart_b')::uuid,current_setting('test.checkout_cart_b_version')::integer,
    method_id,null,'{"recipient_name":"Buyer B","phone":"5512345678","street":"Golf","exterior_number":"2","interior_number":"","neighborhood":"Centro","city":"CDMX","state":"CDMX","postal_code":"01000","references":"Recepción"}',
    false,'6e000000-0000-4000-8000-000000000003','bank_transfer');
  perform set_config('test.checkout_expiring_order',o.order_id::text,true);
end $$;
reset role;
select set_config('peter_golf.marketplace_order_write','enabled',true);
update public.inventory_reservations set reserved_at=now()-interval '1 hour',expires_at=now()-interval '1 minute'
where order_id=current_setting('test.checkout_expiring_order')::uuid;
select set_config('peter_golf.marketplace_order_write','disabled',true);
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000005',true);
set local role authenticated;
do $$ begin
  if public.release_expired_marketplace_reservations(10)<>1 then
    raise exception 'Expired reservation release count was incorrect'; end if;
  if exists(select 1 from public.inventory_reservations
    where order_id=current_setting('test.checkout_expiring_order')::uuid and status<>'EXPIRED')
  then raise exception 'Expired reservation was not released'; end if;
end $$;
reset role;

-- PR10 deactivation stops only new Marketplace commerce. The paid mixed order,
-- fulfillment groups and downstream PR7-PR9 records remain readable/manageable.
update public.site_settings set value='{"enabled":false}' where key='marketplace.enabled';
select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  if (select count(*) from public.get_customer_order_fulfillment_summary(
    current_setting('test.checkout_order')::uuid))<>3
  then raise exception 'Marketplace OFF damaged an existing mixed order'; end if;
  begin
    perform public.add_marketplace_cart_item(
      current_setting('test.checkout_listing_b')::uuid,
      current_setting('test.checkout_quote_b')::uuid,1,
      '6d000000-0000-4000-8000-000000000099'
    );
    raise exception 'Marketplace OFF allowed new Partner commerce';
  exception when others then
    if sqlerrm not like '%Marketplace is disabled%' then raise; end if;
  end;
end $$;
reset role;

-- Anonymous and the other buyer receive no private Marketplace data.
select set_config('request.jwt.claim.sub','',true);
set local role anon;
do $$ begin
  begin
    perform 1 from public.order_fulfillments;
    raise exception 'Anonymous read Marketplace fulfillment data';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.inventory_reservations;
    raise exception 'Anonymous read Marketplace reservation data';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

rollback;
