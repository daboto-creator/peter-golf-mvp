-- Bind promotion stability to the specific candidate tier. Existing active
-- timers predate that invariant, so they are cleared conservatively.

alter table public.partner_score_tier_state
  add column promotion_candidate_tier public.marketplace_partner_tier;

update public.partner_score_tier_state
set promotion_eligible_since = null
where promotion_eligible_since is not null;

alter table public.partner_score_tier_state
  add constraint partner_score_tier_state_promotion_candidate_check check (
    (promotion_candidate_tier is null and promotion_eligible_since is null)
    or (promotion_candidate_tier is not null and promotion_eligible_since is not null)
  );

create or replace function private.recalculate_partner_score_tier_internal(
  requested_partner_id uuid, requested_as_of_date date,
  requested_calculation_key text, requested_reason text
) returns public.partner_score_tier_state
language plpgsql security definer set search_path = '' as $$
declare config_id uuid; config_number bigint; rules public.marketplace_score_rules;
  operational public.marketplace_operational_rules; component public.partner_score_component;
  component_result record; weight integer; contribution integer; raw_score integer := 0;
  penalty_total integer := 0; calculated_score integer; final_score integer;
  completed_orders integer; score_status public.partner_score_status;
  previous_score_status public.partner_score_status;
  snapshot public.partner_score_snapshots; existing_snapshot public.partner_score_snapshots;
  score_override public.partner_score_tier_overrides; tier_override public.partner_score_tier_overrides;
  rolling_average numeric(12,4) := 0; metric_day date; first_verified date;
  eligible_tier public.marketplace_partner_tier := 'BOGEY'; target_tier public.marketplace_partner_tier;
  state_record public.partner_score_tier_state; old_state public.partner_score_tier_state;
  old_tier public.marketplace_partner_tier; new_tier public.marketplace_partner_tier;
  previous_tier_at_risk date;
  critical_bypass boolean := false; expired_record record;
  metric_key text; reason_value text := btrim(requested_reason);
begin
  if char_length(reason_value) not between 3 and 500
    or requested_calculation_key !~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{5,199}$'
  then raise exception 'Valid calculation key and reason are required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('partner-score:' || requested_partner_id::text, 0));
  select * into existing_snapshot from public.partner_score_snapshots
  where partner_id = requested_partner_id and calculation_key = requested_calculation_key;
  if found then
    select * into strict state_record from public.partner_score_tier_state where partner_id = requested_partner_id;
    return state_record;
  end if;
  select id, version_number into strict config_id, config_number
  from public.marketplace_config_versions where status = 'PUBLISHED' and effective_to is null;
  select * into strict rules from public.marketplace_score_rules where config_version_id = config_id;
  select * into strict operational from public.marketplace_operational_rules where config_version_id = config_id;

  for expired_record in
    update public.partner_penalties set status = 'EXPIRED'
    where partner_id = requested_partner_id and status = 'ACTIVE'
      and expires_at is not null and expires_at < requested_as_of_date + interval '1 day'
    returning id
  loop
    perform private.write_marketplace_audit('marketplace.penalty_expired','partner_penalty',expired_record.id,'Configured decay elapsed',jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','EXPIRED'));
  end loop;
  for expired_record in
    update public.partner_score_tier_overrides set status = 'EXPIRED'
    where partner_id = requested_partner_id and status = 'ACTIVE'
      and expires_at is not null and expires_at < requested_as_of_date + interval '1 day'
    returning id
  loop
    perform private.write_marketplace_audit('marketplace.override_expired','partner_score_tier_override',expired_record.id,'Configured override expiry elapsed',jsonb_build_object('status','ACTIVE'),jsonb_build_object('status','EXPIRED'));
  end loop;

  select min(created_at::date) into first_verified from public.partner_status_history
  where partner_id = requested_partner_id and to_status = 'VERIFIED';
  if first_verified is null then
    select verified_at::date into first_verified from public.partner_profiles
    where id=requested_partner_id and verified_at is not null;
  end if;
  if first_verified is not null then
    for metric_day in select generate_series(
      greatest(first_verified, requested_as_of_date - (operational.tier_averaging_window_days - 1)),
      requested_as_of_date, interval '1 day'
    )::date loop
      perform private.capture_partner_daily_listing_metric(requested_partner_id, metric_day, config_id);
    end loop;
  end if;
  select coalesce(avg(active_listing_count),0)::numeric(12,4) into rolling_average
  from public.partner_daily_listing_metrics where partner_id = requested_partner_id
    and eligible and metric_date between requested_as_of_date - (operational.tier_averaging_window_days - 1) and requested_as_of_date;

  select count(*)::integer into completed_orders from public.partner_score_events
  where partner_id = requested_partner_id and counts_completed_order
    and occurred_at < requested_as_of_date + interval '1 day';
  score_status := case when completed_orders >= rules.established_completed_orders then 'ESTABLISHED' else 'PROVISIONAL' end;
  select previous.score_status into previous_score_status
  from public.partner_score_snapshots previous
  where previous.partner_id = requested_partner_id
  order by previous.calculated_at desc, previous.id desc
  limit 1;
  select coalesce(sum(penalty_bps),0)::integer into penalty_total from public.partner_penalties
  where partner_id = requested_partner_id and status = 'ACTIVE'
    and starts_at < requested_as_of_date + interval '1 day';

  insert into public.partner_score_snapshots (
    partner_id, score_status, completed_orders, raw_weighted_score_bps,
    active_penalties_bps, calculated_score_bps, final_score_bps,
    config_version_id, calculation_key, calculated_at
  ) values (requested_partner_id, score_status, completed_orders, 0,
    penalty_total, 0, 0, config_id, requested_calculation_key,
    requested_as_of_date + time '23:59:59') returning * into snapshot;

  foreach component in array enum_range(null::public.partner_score_component) loop
    select * into strict component_result from private.calculate_partner_component(requested_partner_id,component,config_id,requested_as_of_date);
    metric_key := lower(component::text);
    select weight_bps into strict weight from public.marketplace_score_weight_rules
    where config_version_id = config_id
      and marketplace_score_weight_rules.metric_code = metric_key;
    contribution := round(component_result.adjusted_score_bps::numeric * weight / 10000)::integer;
    raw_score := raw_score + contribution;
    insert into public.partner_score_component_snapshots values (
      snapshot.id, component, component_result.numerator_score_bps,
      component_result.observation_count, component_result.adjusted_score_bps,
      weight, contribution, component_result.evidence_summary
    );
  end loop;
  calculated_score := least(10000, greatest(0, raw_score - penalty_total));
  select * into score_override from public.partner_score_tier_overrides
  where partner_id = requested_partner_id and override_type = 'SCORE' and status = 'ACTIVE'
    and starts_at < requested_as_of_date + interval '1 day'
    and (expires_at is null or expires_at >= requested_as_of_date + interval '1 day')
  order by created_at desc limit 1;
  final_score := coalesce(score_override.score_bps, calculated_score);
  perform set_config('app.partner_score_snapshot_finalize','enabled',true);
  update public.partner_score_snapshots set raw_weighted_score_bps = raw_score,
    calculated_score_bps = calculated_score, final_score_bps = final_score,
    applied_override_id = score_override.id where id = snapshot.id returning * into snapshot;

  for eligible_tier in select tier from public.marketplace_tier_rules
    where config_version_id = config_id
      and coalesce(minimum_average_active_listings,0) <= rolling_average
      and coalesce(minimum_score,0) * 100 <= final_score
      and (score_status = 'ESTABLISHED' or private.marketplace_tier_rank(tier) <= private.marketplace_tier_rank(rules.provisional_tier_cap))
    order by private.marketplace_tier_rank(tier) desc limit 1
  loop null; end loop;
  eligible_tier := coalesce(eligible_tier,'BOGEY');
  select * into tier_override from public.partner_score_tier_overrides
  where partner_id = requested_partner_id and override_type = 'TIER' and status = 'ACTIVE'
    and starts_at < requested_as_of_date + interval '1 day'
    and (expires_at is null or expires_at >= requested_as_of_date + interval '1 day')
  order by created_at desc limit 1;
  target_tier := coalesce(tier_override.tier, eligible_tier);
  select exists (
    select 1 from public.partner_penalties penalty
    join public.marketplace_penalty_rules rule on rule.config_version_id = penalty.config_version_id and rule.event_code = penalty.event_code
    where penalty.partner_id = requested_partner_id and penalty.status = 'ACTIVE' and rule.bypasses_downgrade_grace
  ) into critical_bypass;

  insert into public.partner_score_tier_state (partner_id,current_config_version_id)
  values (requested_partner_id,config_id) on conflict (partner_id) do nothing;
  select * into strict old_state from public.partner_score_tier_state where partner_id = requested_partner_id for update;
  previous_tier_at_risk := old_state.tier_at_risk_since;
  old_tier := old_state.current_tier; new_tier := old_tier;
  if tier_override.id is not null then
    new_tier := target_tier;
    old_state.promotion_candidate_tier := null;
    old_state.promotion_eligible_since := null;
    old_state.tier_at_risk_since := null;
  elsif private.marketplace_tier_rank(target_tier) > private.marketplace_tier_rank(old_tier) then
    old_state.tier_at_risk_since := null;
    if old_state.promotion_candidate_tier is distinct from target_tier then
      old_state.promotion_candidate_tier := target_tier;
      old_state.promotion_eligible_since := requested_as_of_date;
    end if;
    if rules.promotion_stability_days = 0 or requested_as_of_date - old_state.promotion_eligible_since + 1 >= rules.promotion_stability_days then
      new_tier := target_tier;
      old_state.promotion_candidate_tier := null;
      old_state.promotion_eligible_since := null;
    end if;
  elsif private.marketplace_tier_rank(target_tier) < private.marketplace_tier_rank(old_tier) then
    old_state.promotion_candidate_tier := null;
    old_state.promotion_eligible_since := null;
    old_state.tier_at_risk_since := coalesce(old_state.tier_at_risk_since,requested_as_of_date);
    if critical_bypass or rules.downgrade_grace_days = 0 or requested_as_of_date - old_state.tier_at_risk_since + 1 >= rules.downgrade_grace_days then
      new_tier := target_tier; old_state.tier_at_risk_since := null;
    end if;
  else
    old_state.promotion_candidate_tier := null;
    old_state.promotion_eligible_since := null;
    old_state.tier_at_risk_since := null;
  end if;
  update public.partner_score_tier_state set latest_score_snapshot_id = snapshot.id,
    current_tier = new_tier, highest_eligible_tier = eligible_tier,
    rolling_average_active_listings = rolling_average,
    promotion_candidate_tier = old_state.promotion_candidate_tier,
    promotion_eligible_since = old_state.promotion_eligible_since,
    tier_at_risk_since = old_state.tier_at_risk_since,
    current_config_version_id = config_id, version = version + 1,
    calculated_at = snapshot.calculated_at
  where partner_id = requested_partner_id returning * into state_record;
  if new_tier is distinct from old_tier then
    insert into public.partner_tier_history (
      partner_id,old_tier,new_tier,reason,score_snapshot_id,
      rolling_average_active_listings,config_version_id,actor_id,effective_at
    ) values (requested_partner_id,old_tier,new_tier,
      case when tier_override.id is not null then 'Active administrative tier override'
        when private.marketplace_tier_rank(new_tier)>private.marketplace_tier_rank(old_tier) then 'Promotion stability period completed'
        when critical_bypass then 'Critical risk bypassed downgrade grace'
        else 'Downgrade grace period completed' end,
      snapshot.id,rolling_average,config_id,(select auth.uid()),snapshot.calculated_at);
    perform private.write_marketplace_audit(
      case when private.marketplace_tier_rank(new_tier)>private.marketplace_tier_rank(old_tier) then 'marketplace.tier_promoted' else 'marketplace.tier_downgraded' end,
      'partner_profile',requested_partner_id,reason_value,
      jsonb_build_object('tier',old_tier),jsonb_build_object('tier',new_tier,'score_snapshot_id',snapshot.id,'rolling_average',rolling_average)
    );
  elsif previous_tier_at_risk is null and state_record.tier_at_risk_since is not null then
    perform private.write_marketplace_audit('marketplace.tier_at_risk','partner_profile',requested_partner_id,reason_value,null,jsonb_build_object('tier',old_tier,'eligible_tier',eligible_tier,'since',state_record.tier_at_risk_since));
  end if;
  if previous_score_status is distinct from score_status then
    perform private.write_marketplace_audit(
      'marketplace.score_status_changed','partner_profile',requested_partner_id,
      reason_value,jsonb_build_object('score_status',previous_score_status),
      jsonb_build_object('score_status',score_status,'completed_orders',completed_orders)
    );
  end if;
  perform private.write_marketplace_audit('marketplace.score_recalculated','partner_profile',requested_partner_id,reason_value,null,jsonb_build_object('snapshot_id',snapshot.id,'score_status',score_status,'final_score_bps',final_score,'config_version',config_number));
  return state_record;
end;
$$;

drop function public.get_own_partner_score_summary();

create function public.get_own_partner_score_summary()
returns table (
  current_tier public.marketplace_partner_tier,
  highest_eligible_tier public.marketplace_partner_tier,
  promotion_candidate_tier public.marketplace_partner_tier,
  rolling_average_active_listings numeric,
  promotion_eligible_since date,
  tier_at_risk_since date,
  score_status public.partner_score_status,
  completed_orders integer,
  display_score_bps integer,
  component public.partner_score_component,
  component_display_score_bps integer
) language sql stable security definer set search_path='' as $$
  select state.current_tier,state.highest_eligible_tier,
    state.promotion_candidate_tier,
    round(state.rolling_average_active_listings,1),
    state.promotion_eligible_since,state.tier_at_risk_since,
    snapshot.score_status,snapshot.completed_orders,
    (round(snapshot.final_score_bps::numeric/100)*100)::integer,
    component.component,
    (round(component.adjusted_score_bps::numeric/100)*100)::integer
  from public.partner_profiles partner
  join public.partner_score_tier_state state on state.partner_id=partner.id
  join public.partner_score_snapshots snapshot on snapshot.id=state.latest_score_snapshot_id
  join public.partner_score_component_snapshots component on component.score_snapshot_id=snapshot.id
  where partner.user_id=(select auth.uid())
  order by component.component;
$$;

revoke all on function public.get_own_partner_score_summary() from public, anon;
grant execute on function public.get_own_partner_score_summary() to authenticated;

comment on column public.partner_score_tier_state.promotion_candidate_tier is
  'Specific tier whose consecutive promotion stability period is currently being measured.';
