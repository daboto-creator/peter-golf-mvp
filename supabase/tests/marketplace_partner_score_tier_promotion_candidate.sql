-- Promotion stability belongs to a specific candidate tier. Fixtures remain
-- isolated and never alter published configuration because this suite rolls back.
begin;

insert into auth.users (
  id,aud,role,email,raw_app_meta_data,raw_user_meta_data,created_at,updated_at
) values
('6a000000-0000-4000-8000-000000000001','authenticated','authenticated','candidate-established@example.test','{}','{}',now(),now()),
('6a000000-0000-4000-8000-000000000002','authenticated','authenticated','candidate-provisional@example.test','{}','{}',now(),now()),
('6a000000-0000-4000-8000-000000000003','authenticated','authenticated','candidate-admin@example.test','{}','{}',now(),now());

insert into public.user_roles (user_id,role_id)
select '6a000000-0000-4000-8000-000000000003'::uuid,id
from public.roles where name='admin';

insert into public.partner_profiles (
  id,user_id,legal_type,status,verified_at
) values
('6b000000-0000-4000-8000-000000000001','6a000000-0000-4000-8000-000000000001','INDIVIDUAL','VERIFIED',now()),
('6b000000-0000-4000-8000-000000000002','6a000000-0000-4000-8000-000000000002','INDIVIDUAL','VERIFIED',now());

insert into public.partner_status_history (
  partner_id,from_status,to_status,actor_id,reason,version
) values
('6b000000-0000-4000-8000-000000000001','UNDER_REVIEW','VERIFIED','6a000000-0000-4000-8000-000000000003','Candidate regression fixture verified',1),
('6b000000-0000-4000-8000-000000000002','UNDER_REVIEW','VERIFIED','6a000000-0000-4000-8000-000000000003','Provisional candidate fixture verified',1);

-- Volume is not under test here. Setting all fixture thresholds to zero isolates
-- candidate tracking while preserving the real score thresholds and tier ranks.
update public.marketplace_tier_rules
set minimum_average_active_listings=0
where config_version_id=(
  select id from public.marketplace_config_versions
  where status='PUBLISHED' and effective_to is null
);

select set_config('request.jwt.claim.sub','6a000000-0000-4000-8000-000000000003',true);
set local role authenticated;

do $$
declare index integer;
begin
  for index in 1..5 loop
    perform public.record_partner_score_event(
      '6b000000-0000-4000-8000-000000000001','ORDER_COMPLETION',
      'COMPLETED_CORRECTLY','ORDER','candidate-order-'||index,now(),
      'marketplace_order',gen_random_uuid(),jsonb_build_object('eligible',true)
    );
  end loop;
end;
$$;

-- Case A: Par must remain the same candidate from day 1 through day 7.
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture Par eligibility',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+1,'candidate-a-day-1','6b000000-0000-4000-8000-000000000001','Start stable Par candidate'
);
select public.run_marketplace_score_tier_job(
  current_date+6,'candidate-a-day-6','6b000000-0000-4000-8000-000000000001','Keep stable Par candidate'
);
do $$
declare state public.partner_score_tier_state;
begin
  select * into strict state from public.partner_score_tier_state
  where partner_id='6b000000-0000-4000-8000-000000000001';
  if state.current_tier<>'BOGEY' or state.promotion_candidate_tier<>'PAR'
    or state.promotion_eligible_since<>current_date+1
  then raise exception 'Case A promoted early or changed the stable Par timer'; end if;
end;
$$;
select public.run_marketplace_score_tier_job(
  current_date+7,'candidate-a-day-7','6b000000-0000-4000-8000-000000000001','Complete stable Par candidate'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='PAR' and promotion_candidate_tier is null
      and promotion_eligible_since is null
  ) then raise exception 'Case A did not promote stable Par on day seven'; end if;
end;
$$;

-- Reset only the current cache between independent candidate scenarios.
reset role;
update public.partner_score_tier_state set current_tier='BOGEY',
  highest_eligible_tier='BOGEY',promotion_candidate_tier=null,
  promotion_eligible_since=null,tier_at_risk_since=null
where partner_id='6b000000-0000-4000-8000-000000000001';
set local role authenticated;

-- Case B: Par -> Birdie restarts on day 4 and cannot promote on day 7.
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture Par before Birdie',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+20,'candidate-b-day-1','6b000000-0000-4000-8000-000000000001','Start Par before Birdie'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',8000,null,
  'Fixture Birdie eligibility',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+23,'candidate-b-day-4','6b000000-0000-4000-8000-000000000001','Change candidate to Birdie'
);
select public.run_marketplace_score_tier_job(
  current_date+26,'candidate-b-day-7','6b000000-0000-4000-8000-000000000001','Birdie has only four stable days'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='BOGEY' and promotion_candidate_tier='BIRDIE'
      and promotion_eligible_since=current_date+23
  ) then raise exception 'Case B reused the Par timer for Birdie'; end if;
end;
$$;
select public.run_marketplace_score_tier_job(
  current_date+29,'candidate-b-birdie-day-7','6b000000-0000-4000-8000-000000000001','Complete seven Birdie days'
);
do $$
begin
  if (select current_tier from public.partner_score_tier_state
      where partner_id='6b000000-0000-4000-8000-000000000001')<>'BIRDIE'
  then raise exception 'Case B did not promote Birdie after seven Birdie days'; end if;
end;
$$;

reset role;
update public.partner_score_tier_state set current_tier='BOGEY',
  highest_eligible_tier='BOGEY',promotion_candidate_tier=null,
  promotion_eligible_since=null,tier_at_risk_since=null
where partner_id='6b000000-0000-4000-8000-000000000001';
set local role authenticated;

-- Case C: the original Par -> Hole in One blocker must start a new timer.
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture Par before Hole in One',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+40,'candidate-c-day-1','6b000000-0000-4000-8000-000000000001','Start Par before Hole in One'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',9500,null,
  'Fixture Hole in One eligibility',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+46,'candidate-c-day-7','6b000000-0000-4000-8000-000000000001','Change candidate to Hole in One'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='BOGEY' and promotion_candidate_tier='HOLE_IN_ONE'
      and promotion_eligible_since=current_date+46
  ) then raise exception 'Case C promoted Hole in One with the old Par timer'; end if;
end;
$$;

-- Case D: a candidate disappears when eligible tier is not above current tier.
reset role;
update public.partner_score_tier_state set current_tier='PAR',
  highest_eligible_tier='PAR',promotion_candidate_tier=null,
  promotion_eligible_since=null,tier_at_risk_since=null
where partner_id='6b000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',8000,null,
  'Fixture Birdie candidate loss',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+50,'candidate-d-birdie','6b000000-0000-4000-8000-000000000001','Start Birdie candidate before loss'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture return to current Par',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+54,'candidate-d-par','6b000000-0000-4000-8000-000000000001','Lose Birdie eligibility'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='PAR' and highest_eligible_tier='PAR'
      and promotion_candidate_tier is null and promotion_eligible_since is null
  ) then raise exception 'Case D retained a candidate without promotion eligibility'; end if;
end;
$$;

-- Cases E/F: every candidate change restarts; same job key is idempotent.
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',8000,null,
  'Fixture multiple candidate Birdie',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+60,'candidate-e-birdie','6b000000-0000-4000-8000-000000000001','Start Birdie candidate sequence'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',9000,null,
  'Fixture multiple candidate Albatross',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+62,'candidate-e-albatross','6b000000-0000-4000-8000-000000000001','Change candidate to Albatross'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',9500,null,
  'Fixture multiple candidate Hole in One',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+64,'candidate-e-hole-in-one','6b000000-0000-4000-8000-000000000001','Change candidate to Hole in One'
);
select public.run_marketplace_score_tier_job(
  current_date+64,'candidate-e-hole-in-one','6b000000-0000-4000-8000-000000000001','Change candidate to Hole in One'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='PAR' and promotion_candidate_tier='HOLE_IN_ONE'
      and promotion_eligible_since=current_date+64
  ) or (select count(*) from public.partner_score_snapshots
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and calculation_key='candidate-e-hole-in-one:6b000000-0000-4000-8000-000000000001')<>1
  then raise exception 'Cases E/F failed candidate reset or idempotency'; end if;
end;
$$;

-- Case G: downgrade at-risk, recovery, and fourteen-day downgrade remain unchanged.
reset role;
update public.partner_score_tier_state set current_tier='BIRDIE',
  highest_eligible_tier='BIRDIE',promotion_candidate_tier=null,
  promotion_eligible_since=null,tier_at_risk_since=null
where partner_id='6b000000-0000-4000-8000-000000000001';
set local role authenticated;
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture downgrade protection',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+70,'candidate-g-risk','6b000000-0000-4000-8000-000000000001','Start downgrade protection'
);
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',8000,null,
  'Fixture downgrade recovery',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+75,'candidate-g-recovery','6b000000-0000-4000-8000-000000000001','Recover during downgrade protection'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state
    where partner_id='6b000000-0000-4000-8000-000000000001'
      and current_tier='BIRDIE' and tier_at_risk_since is null
  ) then raise exception 'Case G did not clear risk after recovery'; end if;
end;
$$;
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000001','SCORE',7000,null,
  'Fixture completed downgrade grace',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+76,'candidate-g-risk-again','6b000000-0000-4000-8000-000000000001','Restart downgrade protection'
);
select public.run_marketplace_score_tier_job(
  current_date+89,'candidate-g-downgrade','6b000000-0000-4000-8000-000000000001','Complete downgrade protection'
);
do $$
begin
  if (select current_tier from public.partner_score_tier_state
      where partner_id='6b000000-0000-4000-8000-000000000001')<>'PAR'
  then raise exception 'Case G changed approved fourteen-day downgrade behavior'; end if;
end;
$$;

-- Case H: provisional cap limits both eligibility and candidate to Par.
select public.create_partner_score_tier_override(
  '6b000000-0000-4000-8000-000000000002','SCORE',10000,null,
  'Fixture provisional cap candidate',current_date+200
);
select public.run_marketplace_score_tier_job(
  current_date+90,'candidate-h-provisional','6b000000-0000-4000-8000-000000000002','Apply provisional candidate cap'
);
do $$
begin
  if not exists (
    select 1 from public.partner_score_tier_state state
    join public.partner_score_snapshots snapshot on snapshot.id=state.latest_score_snapshot_id
    where state.partner_id='6b000000-0000-4000-8000-000000000002'
      and snapshot.score_status='PROVISIONAL'
      and state.highest_eligible_tier='PAR'
      and state.promotion_candidate_tier='PAR'
      and state.promotion_eligible_since=current_date+90
  ) then raise exception 'Case H candidate exceeded provisional Par cap'; end if;
end;
$$;

rollback;
