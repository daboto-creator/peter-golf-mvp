-- Marketplace pricing/economics, intelligence persistence and adversarial RLS.
-- Run after `npm run supabase:reset`; fixtures end in ROLLBACK.

begin;

insert into auth.users (
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
  ('5a000000-0000-4000-8000-000000000001','authenticated','authenticated','pricing-a@example.test','{}','{}',now(),now()),
  ('5a000000-0000-4000-8000-000000000002','authenticated','authenticated','pricing-b@example.test','{}','{}',now(),now()),
  ('5a000000-0000-4000-8000-000000000003','authenticated','authenticated','pricing-operator@example.test','{}','{}',now(),now()),
  ('5a000000-0000-4000-8000-000000000004','authenticated','authenticated','pricing-golfer@example.test','{}','{}',now(),now());

insert into public.user_roles (user_id,role_id)
select '5a000000-0000-4000-8000-000000000003',id from public.roles where name='operator';

insert into public.partner_profiles (id,user_id,legal_type,status,verified_at) values
  ('5b000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now()),
  ('5b000000-0000-4000-8000-000000000002','5a000000-0000-4000-8000-000000000002','INDIVIDUAL','VERIFIED',now());

do $$
declare brand_id uuid; category_id uuid; model_id uuid; listing_id uuid:=gen_random_uuid(); version_id uuid:=gen_random_uuid();
  version_a2 uuid:=gen_random_uuid();
  listing_b uuid:=gen_random_uuid(); version_b uuid:=gen_random_uuid();
begin
  select id into strict brand_id from public.brands order by name limit 1;
  select id into strict category_id from public.categories where slug='driver';
  insert into public.catalog_product_models (id,brand_id,category_id,model_name,normalized_model_name)
  values (gen_random_uuid(),brand_id,category_id,'Pricing Test GT3','pricing-test-gt3') returning id into model_id;

  insert into public.marketplace_listings (id,partner_id,status,lock_version)
  values (listing_id,'5b000000-0000-4000-8000-000000000001','DRAFT',1),
         (listing_b,'5b000000-0000-4000-8000-000000000002','DRAFT',1);
  insert into public.marketplace_listing_versions (
    id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,title,
    condition,condition_grade,condition_notes,defects_acknowledged,specifications,quantity,
    submitted_at,reviewed_at,created_by
  ) values
    (version_id,listing_id,1,'APPROVED',model_id,brand_id,category_id,'Pricing Test GT3 Driver',
     'used','excellent','Condition approved for pricing',true,
     '{"loft_degrees":9,"handedness":"right","shaft_flex":"regular"}',1,now(),now(),'5a000000-0000-4000-8000-000000000003'),
    (version_b,listing_b,1,'APPROVED',model_id,brand_id,category_id,'Private Partner B Driver',
     'used','excellent','Condition approved for pricing',true,'{}',1,now(),now(),'5a000000-0000-4000-8000-000000000003'),
    (version_a2,listing_id,2,'APPROVED',model_id,brand_id,category_id,'Pricing Test GT3 Driver changed',
     'used','good','Materially changed version',true,
     '{"loft_degrees":10.5,"handedness":"right","shaft_flex":"stiff"}',1,now(),now(),'5a000000-0000-4000-8000-000000000003');
  update public.marketplace_listings set status='APPROVED',current_version_id=version_id,
    approved_version_id=version_id,approved_at=now() where id=listing_id;
  update public.marketplace_listings set status='APPROVED',current_version_id=version_b,
    approved_version_id=version_b,approved_at=now() where id=listing_b;
  insert into public.marketplace_listing_inventory (listing_id,quantity_on_hand)
  values (listing_id,1),(listing_b,1);
  perform set_config('test.pricing_listing_a',listing_id::text,true);
  perform set_config('test.pricing_version_a',version_id::text,true);
  perform set_config('test.pricing_version_a2',version_a2::text,true);
  perform set_config('test.pricing_listing_b',listing_b::text,true);
end;
$$;

select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare analysis public.marketplace_market_analyses;
begin
  analysis:=public.request_marketplace_market_analysis(
    current_setting('test.pricing_listing_a')::uuid,
    current_setting('test.pricing_version_a')::uuid,
    '5c000000-0000-4000-8000-000000000001'
  );
  perform set_config('test.pricing_analysis',analysis.id::text,true);
  if analysis.status<>'REQUESTED' then raise exception 'Partner analysis request failed'; end if;
  if exists (select 1 from public.marketplace_market_comparables) then
    raise exception 'Partner can read proprietary comparables';
  end if;
  begin
    update public.marketplace_market_analyses set median_price=1 where id=analysis.id;
    raise exception 'Partner tampered market median';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
declare analysis public.marketplace_market_analyses;
begin
  if not public.can_manage_marketplace_pricing() or public.can_manage_marketplace_configuration() then
    raise exception 'Pricing Operations capability boundary failed';
  end if;
  analysis:=public.complete_marketplace_market_analysis(
    current_setting('test.pricing_analysis')::uuid,'serpapi','complete',repeat('a',64),
    '{"brand":"Titleist","model":"GT3","condition":"used"}',
    '{"status":"COMPLETE","confidence":"HIGH","medianPriceMinor":1000000,"averagePriceMinor":1000000,"lowMarketMinor":900000,"highMarketMinor":1100000,"recommendedPriceMinor":1000000,"flags":[],"analysisVersion":"marketplace-market-v1"}',
    '[{"source":"serpapi","title":"Titleist GT3 Driver Used","seller":"MX Golf","priceMinor":1000000,"condition":"used","availability":"in_stock","referenceUrl":"https://example.test/gt3","matchScore":95,"matchReasons":[],"observedAt":"2026-08-25T12:00:00Z"}]',0
  );
  if analysis.status<>'COMPLETE' or analysis.recommended_price<>1000000
    or (select count(*) from public.marketplace_market_comparables where analysis_id=analysis.id)<>1
  then raise exception 'Trusted provider result was not normalized/persisted'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000001',true);
set local role authenticated;

do $$
declare quote public.marketplace_pricing_quotes; retry_quote public.marketplace_pricing_quotes;
begin
  quote:=public.create_marketplace_pricing_quote(
    current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
    'PUBLIC_PRICE_PRIORITY',1000000,900000,current_setting('test.pricing_analysis')::uuid,
    '5d000000-0000-4000-8000-000000000001'
  );
  perform set_config('test.pricing_quote',quote.id::text,true);
  if quote.effective_partner_tier<>'BOGEY' or quote.commission_rate_bps<>1500
    or quote.commission_amount<>150000 or quote.commission_vat<>24000
    or quote.processing_total<>36300 or quote.partner_processing_share<>18150
    or quote.best_round_processing_share<>18150 or quote.admin_percentage_fee<>7500
    or quote.admin_fixed_fee_amount<>3900 or quote.estimated_partner_net<>796450
    or quote.estimated_best_round_revenue<>143250 or quote.viability<>'COMPETITIVE'
  then raise exception 'Marketplace financial snapshot is incorrect: %',row_to_json(quote); end if;
  retry_quote:=public.create_marketplace_pricing_quote(
    current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
    'PUBLIC_PRICE_PRIORITY',1000000,900000,current_setting('test.pricing_analysis')::uuid,
    '5d000000-0000-4000-8000-000000000001');
  if retry_quote.id<>quote.id or retry_quote.status<>'ANALYZED' then
    raise exception 'Pricing idempotency changed the quote'; end if;
  begin
    perform public.create_marketplace_pricing_quote(
      current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
      'PUBLIC_PRICE_PRIORITY',1,null,null,'5d000000-0000-4000-8000-000000000001');
    raise exception 'Idempotency key accepted different pricing inputs';
  exception when unique_violation then null;
  end;
  begin
    update public.marketplace_pricing_quotes set commission_rate_bps=1 where id=quote.id;
    raise exception 'Partner tampered commission';
  exception when insufficient_privilege or object_not_in_prerequisite_state then null;
  end;
  quote:=public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'PARTNER_ACCEPTED',null);
  quote:=public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'UNDER_REVIEW',null);
  if quote.status<>'UNDER_REVIEW' then raise exception 'Partner submission failed'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000002',true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.marketplace_pricing_quotes where id=current_setting('test.pricing_quote')::uuid)
    or exists (select 1 from public.marketplace_market_analyses where id=current_setting('test.pricing_analysis')::uuid)
  then raise exception 'Partner B can read Partner A pricing'; end if;
  begin
    perform public.create_marketplace_pricing_quote(
      current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
      'PUBLIC_PRICE_PRIORITY',1000000,null,null,gen_random_uuid());
    raise exception 'Partner B priced Partner A listing';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.request_marketplace_market_analysis(
      current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
      '5c000000-0000-4000-8000-000000000001');
    raise exception 'Partner B reused Partner A analysis idempotency key';
  exception when insufficient_privilege then null;
  end;
end; $$;

reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000004',true);
set local role authenticated;
do $$ begin
  if exists (select 1 from public.marketplace_pricing_quotes)
    or exists (select 1 from public.marketplace_market_analyses)
  then raise exception 'Golfer can read private Marketplace pricing'; end if;
end; $$;

reset role;
set local role anon;
do $$ begin
  begin perform 1 from public.marketplace_pricing_quotes; raise exception 'Anonymous read pricing';
  exception when insufficient_privilege then null; end;
end; $$;

reset role;
update public.marketplace_listings set
  current_version_id=current_setting('test.pricing_version_a2')::uuid,
  approved_version_id=current_setting('test.pricing_version_a2')::uuid
where id=current_setting('test.pricing_listing_a')::uuid;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare quote public.marketplace_pricing_quotes;
begin
  select * into strict quote from public.marketplace_pricing_quotes where id=current_setting('test.pricing_quote')::uuid;
  begin
    perform public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'APPROVED','Must reject stale listing version');
    raise exception 'Pricing approved for a different listing version';
  exception when check_violation then null;
  end;
end;
$$;

reset role;
update public.marketplace_listings set
  current_version_id=current_setting('test.pricing_version_a')::uuid,
  approved_version_id=current_setting('test.pricing_version_a')::uuid
where id=current_setting('test.pricing_listing_a')::uuid;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000003',true);
set local role authenticated;
do $$
declare quote public.marketplace_pricing_quotes; inverse_quote public.marketplace_pricing_quotes;
begin
  select * into strict quote from public.marketplace_pricing_quotes where id=current_setting('test.pricing_quote')::uuid;
  quote:=public.transition_marketplace_pricing_quote(quote.id,quote.lock_version,'APPROVED','Economics and market evidence approved');
  if quote.status<>'APPROVED' or quote.approved_at is null
    or (select status from public.marketplace_listings where id=quote.listing_id)<>'APPROVED'
  then raise exception 'Pricing approval published or failed'; end if;
  inverse_quote:=public.create_marketplace_pricing_quote(
    current_setting('test.pricing_listing_a')::uuid,current_setting('test.pricing_version_a')::uuid,
    'NET_PRIORITY',null,700000,current_setting('test.pricing_analysis')::uuid,
    '5d000000-0000-4000-8000-000000000002');
  if inverse_quote.estimated_partner_net<700000 then raise exception 'Inverse pricing missed desired net'; end if;
  if not exists (select 1 from public.audit_logs where entity_id=quote.id and action='marketplace.pricing_status_changed')
  then raise exception 'Pricing approval audit missing'; end if;
end;
$$;

rollback;
