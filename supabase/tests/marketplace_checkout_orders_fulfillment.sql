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
    id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,title,
    condition,condition_grade,condition_notes,defects_acknowledged,specifications,
    declared_defects,accessories_included,quantity,fulfillment,custody,submitted_at,reviewed_at,created_by
  ) values
    (version_a,listing_a,1,'APPROVED',model_id,brand_id,category_id,'Partner A Driver',
      'used','excellent','Equipo revisado',true,'{}','[]','[]',1,'PARTNER_FULFILLED','PARTNER_CUSTODY',now(),now(),'6a000000-0000-4000-8000-000000000005'),
    (version_b,listing_b,1,'APPROVED',model_id,brand_id,category_id,'Partner B Driver',
      'used','good','Equipo revisado',true,'{}','[]','[]',1,'PARTNER_FULFILLED','PARTNER_CUSTODY',now(),now(),'6a000000-0000-4000-8000-000000000005');
  update public.marketplace_listings set status='APPROVED',
    current_version_id=case id when listing_a then version_a else version_b end,
    approved_version_id=case id when listing_a then version_a else version_b end,approved_at=now()
    where id in(listing_a,listing_b);
  insert into public.marketplace_listing_inventory(listing_id,quantity_on_hand)
    values(listing_a,1),(listing_b,1);
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
  then raise exception 'Partner fulfillment/economics isolation failed'; end if;
  select * into strict f from public.order_fulfillments where partner_id='6b000000-0000-4000-8000-000000000001';
  f:=public.transition_partner_fulfillment(f.id,f.version,'CONFIRM_AVAILABILITY','Disponibilidad confirmada',
    '6f000000-0000-4000-8000-000000000001');
  replay:=public.transition_partner_fulfillment(f.id,f.version-1,'CONFIRM_AVAILABILITY','Disponibilidad confirmada',
    '6f000000-0000-4000-8000-000000000001');
  if replay.id<>f.id or replay.version<>f.version then
    raise exception 'Partner fulfillment transition replay was not idempotent'; end if;
  begin
    update public.order_fulfillments set status='COMPLETED';
    raise exception 'Partner bypassed fulfillment RPC';
  exception when insufficient_privilege then null; end;
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
