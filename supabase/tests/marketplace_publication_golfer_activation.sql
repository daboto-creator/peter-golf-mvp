-- PR10 derived publication, activation, privacy and stale-state gates.
-- Synthetic fixtures are transactional and never leave the local database.
begin;

insert into auth.users (
  id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) values
  ('73000000-0000-4000-8000-000000000001','authenticated','authenticated','publication-partner@example.test','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000002','authenticated','authenticated','publication-buyer@example.test','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000003','authenticated','authenticated','publication-operator@example.test','{}','{}',now(),now()),
  ('73000000-0000-4000-8000-000000000004','authenticated','authenticated','publication-admin@example.test','{}','{}',now(),now());

insert into public.user_roles(user_id, role_id)
select '73000000-0000-4000-8000-000000000003', id from public.roles where name='operator';
insert into public.user_roles(user_id, role_id)
select '73000000-0000-4000-8000-000000000004', id from public.roles where name='admin';
insert into public.partner_profiles(id,user_id,legal_type,status,verified_at)
values ('73100000-0000-4000-8000-000000000001','73000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now());

do $$
declare
  brand_id uuid;
  category_id uuid;
  model_id uuid;
  listing_id uuid := '73200000-0000-4000-8000-000000000001';
  version_id uuid := '73300000-0000-4000-8000-000000000001';
  image_id uuid;
  image_type text;
  sort_value integer := 0;
begin
  select id into strict brand_id from public.brands order by name limit 1;
  select id into strict category_id from public.categories where slug='driver';
  insert into public.catalog_product_models(brand_id,category_id,model_name,normalized_model_name)
  values(brand_id,category_id,'PR10 Synthetic Driver','pr10-synthetic-driver')
  returning id into model_id;
  insert into public.marketplace_listings(id,partner_id,status,lock_version)
  values(listing_id,'73100000-0000-4000-8000-000000000001','DRAFT',1);
  insert into public.marketplace_listing_versions(
    id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,
    title,description,condition,condition_grade,condition_notes,
    defects_acknowledged,specifications,declared_defects,accessories_included,
    quantity,fulfillment,custody,submitted_at,reviewed_at,created_by
  ) values(
    version_id,listing_id,1,'APPROVED',model_id,brand_id,category_id,
    'Driver sintético PR10','Driver usado aprobado para validar publicación segura.',
    'used','excellent','Marcas cosméticas menores declaradas.',true,
    '{"handedness":"right","shaftFlex":"regular","loftDegrees":10.5,"shaftModel":"Synthetic"}',
    '["Marca cosmética en la suela"]','["Headcover genérico"]',1,
    'PARTNER_FULFILLED','PARTNER_CUSTODY',now(),now(),
    '73000000-0000-4000-8000-000000000003'
  );
  update public.marketplace_listings set
    status='APPROVED',current_version_id=version_id,
    approved_version_id=version_id,approved_at=now()
  where id=listing_id;
  insert into public.marketplace_listing_inventory(listing_id,quantity_on_hand)
  values(listing_id,1);
  foreach image_type in array array['face','crown','sole','shaft','grip'] loop
    image_id := gen_random_uuid();
    insert into public.marketplace_listing_images(
      id,listing_id,storage_path,mime_type,size_bytes,sha256,uploaded_by
    ) values(
      image_id,listing_id,
      'listings/73100000-0000-4000-8000-000000000001/'||listing_id::text||'/'||version_id::text||'/'||image_id::text||'.jpg',
      'image/jpeg',100,repeat('a',64),'73000000-0000-4000-8000-000000000001'
    );
    insert into public.marketplace_listing_version_images(
      version_id,image_id,image_type,requirement,sort_order,alt_text,is_sensitive
    ) values(version_id,image_id,image_type,'REQUIRED',sort_value,'Vista aprobada del driver',false);
    if sort_value=0 then
      perform set_config('test.publication_image',image_id::text,true);
    end if;
    sort_value := sort_value + 1;
  end loop;
  perform set_config('test.publication_listing',listing_id::text,true);
  perform set_config('test.publication_version',version_id::text,true);
end;
$$;

-- PR5 remains the sole price authority.
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$ declare quote public.marketplace_pricing_quotes; begin
  quote:=public.create_marketplace_pricing_quote(
    current_setting('test.publication_listing')::uuid,
    current_setting('test.publication_version')::uuid,
    'PUBLIC_PRICE_PRIORITY',125000,null,null,
    '73400000-0000-4000-8000-000000000001'
  );
  quote:=public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'PARTNER_ACCEPTED',null);
  quote:=public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'UNDER_REVIEW',null);
  perform set_config('test.publication_quote',quote.id::text,true);
end $$;
reset role;

select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ declare quote public.marketplace_pricing_quotes; begin
  select * into strict quote from public.marketplace_pricing_quotes
  where id=current_setting('test.publication_quote')::uuid;
  quote:=public.transition_marketplace_pricing_quote(
    quote.id,quote.lock_version,'APPROVED','Cotización sintética aprobada para PR10'
  );
end $$;
reset role;

-- OFF is fail-closed for anonymous catalog, add-to-cart and image resolution.
set local role anon;
do $$ begin
  if exists(select 1 from public.get_public_marketplace_catalog()) then
    raise exception 'Marketplace OFF exposed a Partner listing';
  end if;
  begin perform 1 from public.marketplace_listings;
    raise exception 'Anonymous queried internal listing rows';
  exception when insufficient_privilege then null; end;
  begin perform 1 from public.partner_profiles;
    raise exception 'Anonymous queried Partner profiles';
  exception when insufficient_privilege then null; end;
  begin perform * from public.get_public_marketplace_image_path(
    current_setting('test.publication_listing')::uuid,gen_random_uuid()
  );
    raise exception 'Anonymous invoked private image resolver';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  begin
    perform public.add_marketplace_cart_item(
      current_setting('test.publication_listing')::uuid,
      current_setting('test.publication_quote')::uuid,1,
      '73500000-0000-4000-8000-000000000001'
    );
    raise exception 'Marketplace OFF allowed add to cart';
  exception when others then
    if sqlerrm not like '%Marketplace is disabled%' then raise; end if;
  end;
end $$;
reset role;

-- Operator can inspect readiness but cannot activate. Admin activation is
-- readiness-gated, staging-only and audited with old/new values.
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$ begin
  if not (select publication_ready from public.get_marketplace_publication_readiness(
      current_setting('test.publication_listing')::uuid))
    or (select published from public.get_marketplace_publication_readiness(
      current_setting('test.publication_listing')::uuid))
  then raise exception 'Derived OFF readiness was incorrect'; end if;
  begin perform public.set_marketplace_enabled(true,false,'ENABLE_MARKETPLACE','Operator attempt');
    raise exception 'Operator activated Marketplace';
  exception when insufficient_privilege then null; end;
end $$;
reset role;

update public.site_settings set value='{"mode":"test"}' where key='payments.mode';
update public.site_settings set value='{"mode":"test"}' where key='stripe.checkout.mode';

select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare activation record; begin
  if not (select ready from public.get_marketplace_activation_readiness()) then
    raise exception 'Safe staging activation readiness was blocked';
  end if;
  select * into activation from public.set_marketplace_enabled(
    true,false,'ENABLE_MARKETPLACE','Activación sintética PR10'
  );
  if not activation.enabled or not exists(
    select 1 from public.audit_logs audit
    where audit.id=activation.audit_id and audit.actor_id=auth.uid()
      and audit.action='marketplace.enabled'
      and audit.metadata->'before'='{"enabled":false}'::jsonb
      and audit.metadata->'after'='{"enabled":true}'::jsonb
  ) then raise exception 'Activation audit is incomplete'; end if;
end $$;
reset role;

-- ON exposes exactly one sanitized DTO and a service-role-only approved image.
set local role anon;
do $$ declare payload jsonb; begin
  select to_jsonb(catalog) into strict payload
  from public.get_public_marketplace_catalog() catalog;
  if payload::text ~* '(example[.]test|partner_id|legal_name|user_id|commission|partner_net|bank|comparable|risk)'
    or payload->>'title'<>'Driver sintético PR10'
    or payload->>'public_price'<>'125000'
  then raise exception 'Public catalog DTO leaked or changed authoritative price: %',payload; end if;
end $$;
reset role;

set local role service_role;
do $$ declare resolved_count integer; begin
  select count(*) into resolved_count
  from public.get_public_marketplace_image_path(
    current_setting('test.publication_listing')::uuid,
    current_setting('test.publication_image')::uuid
  );
  if resolved_count<>1 then raise exception 'Approved image did not resolve safely'; end if;
end $$;
reset role;

-- A stale buyer price requires an explicit server-authoritative refresh, and
-- that refresh remains idempotent within the historical PR6 operation enum.
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare cart_result record; begin
  select * into cart_result from public.add_marketplace_cart_item(
    current_setting('test.publication_listing')::uuid,
    current_setting('test.publication_quote')::uuid,1,
    '73500000-0000-4000-8000-000000000002'
  );
  perform set_config('test.publication_cart_version',cart_result.version::text,true);
  perform set_config('test.publication_cart_item',(
    select item.id::text from public.cart_items item
    where item.cart_id=cart_result.cart_id and item.item_source='MARKETPLACE_PARTNER'
  ),true);
end $$;
reset role;
select set_config('peter_golf.cart_rpc_write','enabled',true);
update public.cart_items set price_seen=124000
where id=current_setting('test.publication_cart_item')::uuid;
select set_config('peter_golf.cart_rpc_write','disabled',true);
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ declare refreshed record; begin
  select * into refreshed from public.refresh_marketplace_cart_item(
    current_setting('test.publication_cart_item')::uuid,1,
    current_setting('test.publication_cart_version')::integer,false,
    '73500000-0000-4000-8000-000000000003'
  );
  if refreshed.replayed or (select price_seen from public.cart_items
      where id=current_setting('test.publication_cart_item')::uuid)<>125000
  then raise exception 'Stale Marketplace price was not explicitly refreshed'; end if;
  select * into refreshed from public.refresh_marketplace_cart_item(
    current_setting('test.publication_cart_item')::uuid,1,
    current_setting('test.publication_cart_version')::integer,false,
    '73500000-0000-4000-8000-000000000003'
  );
  if not refreshed.replayed then raise exception 'Price refresh did not replay'; end if;
end $$;
reset role;
select set_config('peter_golf.cart_rpc_write','enabled',true);
delete from public.cart_idempotency_keys
where actor_id='73000000-0000-4000-8000-000000000002';
delete from public.cart_items
where id=current_setting('test.publication_cart_item')::uuid;
delete from public.carts
where user_id='73000000-0000-4000-8000-000000000002';
select set_config('peter_golf.cart_rpc_write','disabled',true);

-- Every mutable publication dependency invalidates immediately.
update public.partner_profiles set status='SUSPENDED',suspended_at=now()
where id='73100000-0000-4000-8000-000000000001';
do $$ begin if exists(select 1 from public.get_public_marketplace_catalog()) then
  raise exception 'Suspended Partner remained public'; end if; end $$;
update public.partner_profiles set status='VERIFIED'
where id='73100000-0000-4000-8000-000000000001';

update public.marketplace_listing_inventory set quantity_on_hand=0
where listing_id=current_setting('test.publication_listing')::uuid;
do $$ begin if exists(select 1 from public.get_public_marketplace_catalog()) then
  raise exception 'Zero inventory remained public'; end if; end $$;
update public.marketplace_listing_inventory set quantity_on_hand=1
where listing_id=current_setting('test.publication_listing')::uuid;

alter table public.marketplace_pricing_quotes disable trigger marketplace_pricing_quotes_guard;
update public.marketplace_pricing_quotes set expires_at=now()-interval '1 second'
where id=current_setting('test.publication_quote')::uuid;
alter table public.marketplace_pricing_quotes enable trigger marketplace_pricing_quotes_guard;
do $$ begin if exists(select 1 from public.get_public_marketplace_catalog()) then
  raise exception 'Expired quote remained public'; end if; end $$;
alter table public.marketplace_pricing_quotes disable trigger marketplace_pricing_quotes_guard;
update public.marketplace_pricing_quotes set expires_at=now()+interval '1 day'
where id=current_setting('test.publication_quote')::uuid;
alter table public.marketplace_pricing_quotes enable trigger marketplace_pricing_quotes_guard;

update public.marketplace_listings set current_version_id=null
where id=current_setting('test.publication_listing')::uuid;
do $$ begin if exists(select 1 from public.get_public_marketplace_catalog()) then
  raise exception 'Stale listing version remained public'; end if; end $$;
update public.marketplace_listings set current_version_id=approved_version_id
where id=current_setting('test.publication_listing')::uuid;

-- Deactivation changes only the setting/audit surface and leaves commerce data.
select set_config('request.jwt.claim.sub','73000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ declare before_orders bigint; activation record; begin
  select count(*) into before_orders from public.orders;
  select * into activation from public.set_marketplace_enabled(
    false,true,'DISABLE_MARKETPLACE','Prueba de desactivación PR10'
  );
  if activation.enabled or before_orders<>(select count(*) from public.orders)
    or not exists(select 1 from public.audit_logs where id=activation.audit_id
      and action='marketplace.disabled')
  then raise exception 'Deactivation mutated orders or missed audit'; end if;
end $$;
reset role;

set local role anon;
do $$ begin if exists(select 1 from public.get_public_marketplace_catalog()) then
  raise exception 'Marketplace remained public after deactivation'; end if; end $$;
reset role;

rollback;
