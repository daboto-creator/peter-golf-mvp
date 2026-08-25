-- Partner Score/Tier configuration, jobs, history and adversarial RLS.
-- Run after `npm run supabase:reset`; all fixtures end in ROLLBACK.
begin;

insert into auth.users (id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('5a000000-0000-4000-8000-000000000001','authenticated','authenticated','score-a@example.test','{}','{}',now(),now()),
('5a000000-0000-4000-8000-000000000002','authenticated','authenticated','score-b@example.test','{}','{}',now(),now()),
('5a000000-0000-4000-8000-000000000003','authenticated','authenticated','score-operator@example.test','{}','{}',now(),now()),
('5a000000-0000-4000-8000-000000000004','authenticated','authenticated','score-admin@example.test','{}','{}',now(),now());

insert into public.user_roles (user_id,role_id)
select '5a000000-0000-4000-8000-000000000003'::uuid,id from public.roles where name='operator'
union all select '5a000000-0000-4000-8000-000000000004'::uuid,id from public.roles where name='admin';

insert into public.partner_profiles (id,user_id,legal_type,status,verified_at) values
('5b000000-0000-4000-8000-000000000001','5a000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now()),
('5b000000-0000-4000-8000-000000000002','5a000000-0000-4000-8000-000000000002','LEGAL_ENTITY','VERIFIED',now());

do $$
declare config_id uuid; total_weight integer; rules public.marketplace_score_rules;
begin
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  select * into strict rules from public.marketplace_score_rules where config_version_id=config_id;
  select sum(weight_bps) into total_weight from public.marketplace_score_weight_rules where config_version_id=config_id;
  if rules.neutral_score_bps<>8000 or rules.prior_observations<>10
    or rules.prior_success_equivalent<>8 or rules.established_completed_orders<>5
    or rules.promotion_stability_days<>7 or rules.downgrade_grace_days<>14
    or rules.provisional_tier_cap<>'PAR' or total_weight<>10000
  then raise exception 'Approved score configuration baseline is incorrect'; end if;
  if (select count(*) from cron.job where jobname='best-round-marketplace-score-tiers-daily')<>1 then
    raise exception 'Daily idempotent score job is not scheduled';
  end if;
end;
$$;

-- Create 16 real, approved, inventory-backed listings for Partner A.
do $$
declare category_id uuid; brand_id uuid; model_id uuid; listing_id uuid;
  version_id uuid; inventory_id uuid; index integer;
begin
  select id into strict category_id from public.categories where slug='driver';
  select id into strict brand_id from public.brands order by name limit 1;
  insert into public.catalog_product_models (brand_id,category_id,model_name,normalized_model_name)
  values (brand_id,category_id,'Score Test Model','score-test-model') returning id into model_id;
  for index in 1..16 loop
    listing_id:=gen_random_uuid(); version_id:=gen_random_uuid();
    insert into public.marketplace_listings (id,partner_id,status) values (listing_id,'5b000000-0000-4000-8000-000000000001','DRAFT');
    insert into public.marketplace_listing_versions (
      id,listing_id,version_number,state,canonical_model_id,brand_id,category_id,
      title,description,condition,condition_grade,condition_notes,
      defects_acknowledged,specifications,quantity,submitted_at,reviewed_at,created_by
    ) values (version_id,listing_id,1,'APPROVED',model_id,brand_id,category_id,
      'Approved score listing '||index,'Approved inventory-backed listing for score tests.',
      'used','excellent','Condition verified for score tests.',true,
      '{"handedness":"right","shaftFlex":"regular","loftDegrees":9}'::jsonb,
      1,now(),now(),'5a000000-0000-4000-8000-000000000003');
    update public.marketplace_listings set status='APPROVED',current_version_id=version_id,
      approved_version_id=version_id,approved_at=now() where id=listing_id;
    insert into public.marketplace_listing_inventory (listing_id,quantity_on_hand)
    values (listing_id,1) returning id into inventory_id;
    insert into public.marketplace_listing_inventory_movements (
      inventory_id,listing_version_id,movement_type,quantity_on_hand_delta,
      quantity_reserved_delta,quantity_on_hand_after,quantity_reserved_after,
      actor_id,reason
    ) values (
      inventory_id,version_id,'INITIAL',1,0,1,0,
      '5a000000-0000-4000-8000-000000000003','Score fixture inventory initialized'
    );
    insert into public.marketplace_listing_status_history (
      listing_id,listing_version_id,from_status,to_status,actor_id,reason,lock_version
    ) values (listing_id,version_id,'UNDER_REVIEW','APPROVED','5a000000-0000-4000-8000-000000000003','Approved for score eligibility',2);
  end loop;
end;
$$;

select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
declare index integer; event_record public.partner_score_events;
  first_event public.partner_score_events; run_one public.marketplace_score_job_runs;
begin
  if not public.can_manage_marketplace_score_tiers() or public.can_override_marketplace_score_tiers() then
    raise exception 'Operator score capabilities are incorrect'; end if;
  for index in 1..5 loop
    event_record:=public.record_partner_score_event(
      '5b000000-0000-4000-8000-000000000001','ORDER_COMPLETION','COMPLETED_CORRECTLY',
      'ORDER','score-order-'||index,now()+interval '1 day','marketplace_order',gen_random_uuid(),
      jsonb_build_object('eligible',true)
    );
    if index=1 then first_event:=event_record; end if;
  end loop;
  -- Idempotent event and job keys never duplicate sources/snapshots.
  perform public.record_partner_score_event(
    '5b000000-0000-4000-8000-000000000001','ORDER_COMPLETION','COMPLETED_CORRECTLY',
    'ORDER','score-order-1',first_event.occurred_at,'marketplace_order',
    first_event.source_entity_id,jsonb_build_object('eligible',true)
  );
  if (select count(*) from public.partner_score_events where partner_id='5b000000-0000-4000-8000-000000000001')<>5 then
    raise exception 'Score event idempotency failed'; end if;
  run_one:=public.run_marketplace_score_tier_job(current_date+1,'score-test-day-1',null,'Score integration day one');
  perform public.run_marketplace_score_tier_job(current_date+1,'score-test-day-1',null,'Score integration day one');
  if (select count(*) from public.marketplace_score_job_runs where job_key='score-test-day-1')<>1
    or (select count(*) from public.partner_score_snapshots where calculation_key like 'score-test-day-1:%')<>2
  then raise exception 'Daily job idempotency failed'; end if;
end;
$$;

do $$
declare state public.partner_score_tier_state; snapshot public.partner_score_snapshots;
begin
  perform public.run_marketplace_score_tier_job(current_date+7,'score-test-day-7',null,'Complete promotion stability period');
  select * into strict state from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000001';
  select * into strict snapshot from public.partner_score_snapshots where id=state.latest_score_snapshot_id;
  if snapshot.score_status<>'ESTABLISHED' or snapshot.final_score_bps<8000
    or state.current_tier<>'BIRDIE' or state.rolling_average_active_listings<>16
  then raise exception 'Established score, rolling average or Birdie promotion failed: %, %, %, %',snapshot.score_status,snapshot.final_score_bps,state.current_tier,state.rolling_average_active_listings; end if;
  select * into strict state from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000002';
  select * into strict snapshot from public.partner_score_snapshots where id=state.latest_score_snapshot_id;
  if snapshot.score_status<>'PROVISIONAL' or snapshot.final_score_bps<>8000 or state.current_tier<>'BOGEY' then
    raise exception 'New Partner neutral/provisional fallback failed'; end if;
end;
$$;

reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000004',true);
set local role authenticated;

do $$
declare override_record public.partner_score_tier_overrides; penalty public.partner_penalties;
begin
  if not public.can_override_marketplace_score_tiers() then raise exception 'Admin override capability missing'; end if;
  override_record:=public.create_partner_score_tier_override(
    '5b000000-0000-4000-8000-000000000001','SCORE',7000,null,
    'Test high volume with insufficient score',current_date+40
  );
  perform public.run_marketplace_score_tier_job(current_date+8,'score-test-risk-day-1','5b000000-0000-4000-8000-000000000001','Start downgrade protection');
  if (select current_tier from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000001')<>'BIRDIE'
    or (select highest_eligible_tier from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000001')<>'PAR'
    or (select tier_at_risk_since from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000001') is null
  then raise exception 'High volume/low score grace behavior failed'; end if;
  perform public.run_marketplace_score_tier_job(current_date+21,'score-test-risk-day-14','5b000000-0000-4000-8000-000000000001','Complete downgrade grace');
  if (select current_tier from public.partner_score_tier_state where partner_id='5b000000-0000-4000-8000-000000000001')<>'PAR' then
    raise exception 'Downgrade after grace failed'; end if;
  penalty:=public.create_partner_penalty('5b000000-0000-4000-8000-000000000001',
    'REPEATED_LATE_SHIPMENT','score-minor-penalty','Repeated late shipment test',current_date-interval '91 days');
  perform public.create_partner_penalty('5b000000-0000-4000-8000-000000000001',
    'CONFIRMED_COUNTERFEIT','score-critical-penalty','Confirmed counterfeit requires review',current_date-interval '400 days');
  perform public.run_marketplace_score_tier_job(current_date+22,'score-test-penalty-decay','5b000000-0000-4000-8000-000000000001','Apply penalty decay');
  if (select status from public.partner_penalties where id=penalty.id)<>'EXPIRED'
    or (select status from public.partner_penalties where idempotency_key='score-critical-penalty')<>'ACTIVE'
    or not exists (select 1 from public.partner_risk_flags where partner_id='5b000000-0000-4000-8000-000000000001' and flag_code='SUSPENSION_REVIEW')
  then raise exception 'Penalty decay or critical review flag failed'; end if;
end;
$$;

-- Partner A sees explanations but cannot manipulate sources or Partner B.
reset role;
select set_config('request.jwt.claim.sub','5a000000-0000-4000-8000-000000000001',true);
set local role authenticated;
do $$
begin
  if (select count(*) from public.get_own_partner_score_summary())<>7
    or exists (select 1 from public.partner_score_tier_state)
    or exists (select 1 from public.partner_score_snapshots)
    or exists (select 1 from public.partner_score_component_snapshots)
    or exists (select 1 from public.partner_daily_listing_metrics)
    or exists (select 1 from public.partner_tier_history)
    or exists (select 1 from public.partner_score_events)
    or exists (select 1 from public.partner_score_tier_overrides)
    or exists (select 1 from public.partner_penalties where event_code='CONFIRMED_COUNTERFEIT')
  then raise exception 'Partner score RLS disclosure is incorrect'; end if;
  begin
    insert into public.partner_score_events (
      partner_id,component,outcome_code,score_bps,source,idempotency_key,occurred_at
    ) values ('5b000000-0000-4000-8000-000000000001','ORDER_COMPLETION','COMPLETED_CORRECTLY',10000,'OPERATIONS','partner-forged-score',now());
    raise exception 'Partner inserted a forged score event';
  exception when insufficient_privilege then null; end;
end;
$$;

reset role;
set local role anon;
do $$ begin
  begin
    perform 1 from public.partner_score_snapshots;
    raise exception 'Anonymous can read private score snapshots';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.partner_score_tier_state;
    raise exception 'Anonymous can read private tier state';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
do $$
begin
  if not exists (select 1 from public.partner_tier_history where partner_id='5b000000-0000-4000-8000-000000000001')
    or not exists (select 1 from public.audit_logs where action='marketplace.score_recalculated')
  then raise exception 'Score/tier history or audit is missing'; end if;
  begin
    update public.partner_score_snapshots set final_score_bps=10000 where partner_id='5b000000-0000-4000-8000-000000000001';
    raise exception 'Score snapshot mutation should fail';
  exception when object_not_in_prerequisite_state then null; end;
end;
$$;

rollback;
