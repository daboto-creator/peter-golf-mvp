-- Configurable Partner Score + Tier engine. Marketplace pricing and public
-- reputation remain intentionally out of scope.

create extension if not exists pg_cron with schema pg_catalog;

create type public.partner_score_status as enum ('PROVISIONAL', 'ESTABLISHED');
create type public.partner_score_component as enum (
  'ORDER_COMPLETION', 'SHIPPING_SLA', 'AVAILABILITY',
  'LISTING_ACCURACY', 'CLAIMS_RETURNS', 'GOLFER_RATING',
  'DOCUMENTATION_TENURE'
);
create type public.partner_score_event_source as enum (
  'ORDER', 'FULFILLMENT', 'LISTING_REVIEW', 'DISPUTE',
  'RATING', 'DOCUMENTATION', 'OPERATIONS', 'JOB'
);
create type public.partner_penalty_severity as enum (
  'MINOR', 'MEDIUM', 'MAJOR', 'CRITICAL'
);
create type public.partner_penalty_status as enum (
  'ACTIVE', 'EXPIRED', 'CLEARED'
);
create type public.partner_override_type as enum ('SCORE', 'TIER');
create type public.partner_override_status as enum (
  'ACTIVE', 'EXPIRED', 'CLEARED'
);
create type public.partner_risk_flag_status as enum ('OPEN', 'RESOLVED');
create type public.marketplace_score_job_status as enum (
  'RUNNING', 'COMPLETED'
);

create table public.marketplace_score_rules (
  config_version_id uuid primary key references public.marketplace_config_versions (id) on delete cascade,
  neutral_score_bps integer not null check (neutral_score_bps between 0 and 10000),
  prior_observations integer not null check (prior_observations > 0),
  prior_success_equivalent integer not null check (
    prior_success_equivalent between 0 and prior_observations
  ),
  established_completed_orders integer not null check (established_completed_orders > 0),
  public_rating_min_reviews integer not null check (public_rating_min_reviews > 0),
  shipping_inventory_confirmation_weight_bps integer not null,
  shipping_carrier_handoff_weight_bps integer not null,
  documentation_weight_bps integer not null,
  tenure_weight_bps integer not null,
  promotion_stability_days integer not null check (promotion_stability_days >= 0),
  downgrade_grace_days integer not null check (downgrade_grace_days >= 0),
  provisional_tier_cap public.marketplace_partner_tier not null,
  tier_eligible_listing_statuses public.marketplace_listing_status[] not null,
  constraint marketplace_score_shipping_split check (
    shipping_inventory_confirmation_weight_bps + shipping_carrier_handoff_weight_bps = 10000
  ),
  constraint marketplace_score_documentation_split check (
    documentation_weight_bps + tenure_weight_bps = 10000
  ),
  constraint marketplace_score_neutral_matches_prior check (
    neutral_score_bps = round(prior_success_equivalent::numeric * 10000 / prior_observations)
  ),
  constraint marketplace_score_eligible_statuses check (
    cardinality(tier_eligible_listing_statuses) > 0
    and tier_eligible_listing_statuses <@ array['APPROVED', 'PUBLISHED']::public.marketplace_listing_status[]
  )
);

create table public.marketplace_score_outcome_rules (
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete cascade,
  component public.partner_score_component not null,
  outcome_code text not null,
  score_bps integer not null check (score_bps between 0 and 10000),
  counts_completed_order boolean not null default false,
  primary key (config_version_id, component, outcome_code),
  constraint marketplace_score_outcome_code_format check (
    outcome_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
  )
);

create table public.marketplace_penalty_rules (
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete cascade,
  event_code text not null,
  severity public.partner_penalty_severity not null,
  penalty_bps integer not null check (penalty_bps between 0 and 10000),
  decay_days integer,
  requires_suspension_review boolean not null default false,
  bypasses_downgrade_grace boolean not null default false,
  primary key (config_version_id, event_code),
  constraint marketplace_penalty_event_code_format check (
    event_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
  ),
  constraint marketplace_penalty_decay check (
    (severity = 'CRITICAL' and decay_days is null)
    or (severity <> 'CRITICAL' and decay_days > 0)
  )
);

create table public.marketplace_tenure_score_rules (
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete cascade,
  minimum_days integer not null check (minimum_days >= 0),
  maximum_days integer,
  score_bps integer not null check (score_bps between 0 and 10000),
  primary key (config_version_id, minimum_days),
  constraint marketplace_tenure_days check (
    maximum_days is null or maximum_days >= minimum_days
  )
);

create table public.partner_score_events (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  component public.partner_score_component not null,
  outcome_code text not null,
  score_bps integer not null check (score_bps between 0 and 10000),
  counts_completed_order boolean not null default false,
  source public.partner_score_event_source not null,
  source_entity_type text,
  source_entity_id uuid,
  evidence jsonb not null default '{}'::jsonb,
  idempotency_key text not null unique,
  occurred_at timestamptz not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_score_event_outcome_format check (
    outcome_code ~ '^[A-Z][A-Z0-9_]{1,63}$'
    and idempotency_key ~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{5,199}$'
  ),
  constraint partner_score_event_evidence_object check (jsonb_typeof(evidence) = 'object'),
  constraint partner_score_event_source_identity check (
    (source_entity_type is null and source_entity_id is null)
    or (source_entity_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$' and source_entity_id is not null)
  )
);

create table public.partner_ratings (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  product_as_described smallint not null check (product_as_described between 1 and 5),
  overall_experience smallint not null check (overall_experience between 1 and 5),
  delivery_experience smallint not null check (delivery_experience between 1 and 5),
  source_entity_type text not null,
  source_entity_id uuid not null,
  idempotency_key text not null unique,
  occurred_at timestamptz not null,
  recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_rating_source_type check (source_entity_type ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$')
);

create table public.partner_penalties (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  source_event_id uuid references public.partner_score_events (id) on delete restrict,
  event_code text not null,
  severity public.partner_penalty_severity not null,
  penalty_bps integer not null check (penalty_bps between 0 and 10000),
  status public.partner_penalty_status not null default 'ACTIVE',
  partner_visible boolean not null default true,
  reason text not null,
  starts_at timestamptz not null,
  expires_at timestamptz,
  cleared_at timestamptz,
  cleared_by uuid references public.profiles (id) on delete set null,
  clearance_reason text,
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete restrict,
  idempotency_key text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint partner_penalty_reason_length check (char_length(btrim(reason)) between 3 and 500),
  constraint partner_penalty_expiry check (
    (severity = 'CRITICAL' and expires_at is null)
    or (severity <> 'CRITICAL' and expires_at > starts_at)
  ),
  constraint partner_penalty_clearance check (
    (status <> 'CLEARED' and cleared_at is null and cleared_by is null)
    or (status = 'CLEARED' and cleared_at is not null and clearance_reason is not null)
  )
);

create table public.partner_risk_flags (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  penalty_id uuid not null unique references public.partner_penalties (id) on delete restrict,
  flag_code text not null,
  status public.partner_risk_flag_status not null default 'OPEN',
  reason text not null,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null,
  resolution_reason text,
  created_at timestamptz not null default now()
);

create table public.partner_daily_listing_metrics (
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  metric_date date not null,
  eligible boolean not null,
  active_listing_count integer not null check (active_listing_count >= 0),
  eligibility_started_at date,
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete restrict,
  calculated_at timestamptz not null default now(),
  primary key (partner_id, metric_date),
  constraint partner_daily_listing_eligibility check (
    (eligible and eligibility_started_at is not null)
    or (not eligible and active_listing_count = 0)
  )
);

create table public.partner_score_snapshots (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  score_status public.partner_score_status not null,
  completed_orders integer not null check (completed_orders >= 0),
  raw_weighted_score_bps integer not null check (raw_weighted_score_bps between 0 and 10000),
  active_penalties_bps integer not null check (active_penalties_bps >= 0),
  calculated_score_bps integer not null check (calculated_score_bps between 0 and 10000),
  final_score_bps integer not null check (final_score_bps between 0 and 10000),
  applied_override_id uuid,
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete restrict,
  calculation_key text not null,
  calculated_at timestamptz not null,
  unique (partner_id, calculation_key)
);

create table public.partner_score_component_snapshots (
  score_snapshot_id uuid not null references public.partner_score_snapshots (id) on delete restrict,
  component public.partner_score_component not null,
  numerator_score_bps bigint not null check (numerator_score_bps >= 0),
  observation_count integer not null check (observation_count >= 0),
  adjusted_score_bps integer not null check (adjusted_score_bps between 0 and 10000),
  weight_bps integer not null check (weight_bps between 0 and 10000),
  weighted_contribution_bps integer not null check (weighted_contribution_bps between 0 and 10000),
  evidence_summary jsonb not null default '{}'::jsonb,
  primary key (score_snapshot_id, component),
  constraint partner_score_component_evidence_object check (jsonb_typeof(evidence_summary) = 'object')
);

create table public.partner_score_tier_overrides (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  override_type public.partner_override_type not null,
  score_bps integer,
  tier public.marketplace_partner_tier,
  status public.partner_override_status not null default 'ACTIVE',
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  cleared_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete restrict,
  cleared_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint partner_override_value check (
    (override_type = 'SCORE' and score_bps between 0 and 10000 and tier is null)
    or (override_type = 'TIER' and tier is not null and score_bps is null)
  ),
  constraint partner_override_reason_length check (char_length(btrim(reason)) between 3 and 500),
  constraint partner_override_expiry check (expires_at is null or expires_at > starts_at)
);
create unique index partner_one_active_override_type_idx
  on public.partner_score_tier_overrides (partner_id, override_type)
  where status = 'ACTIVE';

create table public.partner_score_tier_state (
  partner_id uuid primary key references public.partner_profiles (id) on delete restrict,
  latest_score_snapshot_id uuid references public.partner_score_snapshots (id) on delete restrict,
  current_tier public.marketplace_partner_tier not null default 'BOGEY',
  highest_eligible_tier public.marketplace_partner_tier not null default 'BOGEY',
  rolling_average_active_listings numeric(12, 4) not null default 0,
  promotion_eligible_since date,
  tier_at_risk_since date,
  current_config_version_id uuid references public.marketplace_config_versions (id) on delete restrict,
  version integer not null default 1 check (version > 0),
  calculated_at timestamptz,
  updated_at timestamptz not null default now()
);

create table public.partner_tier_history (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partner_profiles (id) on delete restrict,
  old_tier public.marketplace_partner_tier,
  new_tier public.marketplace_partner_tier not null,
  reason text not null,
  score_snapshot_id uuid references public.partner_score_snapshots (id) on delete restrict,
  rolling_average_active_listings numeric(12, 4) not null,
  config_version_id uuid not null references public.marketplace_config_versions (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  effective_at timestamptz not null default now()
);

create table public.marketplace_score_job_runs (
  id uuid primary key default gen_random_uuid(),
  job_key text not null unique,
  as_of_date date not null,
  status public.marketplace_score_job_status not null default 'RUNNING',
  requested_partner_id uuid references public.partner_profiles (id) on delete restrict,
  processed_partners integer not null default 0 check (processed_partners >= 0),
  actor_id uuid references public.profiles (id) on delete set null,
  reason text not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index partner_score_events_partner_component_idx on public.partner_score_events (partner_id, component, occurred_at);
create index partner_penalties_partner_status_idx on public.partner_penalties (partner_id, status, expires_at);
create index partner_daily_listing_metrics_window_idx on public.partner_daily_listing_metrics (partner_id, metric_date desc) where eligible;
create index partner_score_snapshots_partner_idx on public.partner_score_snapshots (partner_id, calculated_at desc);
create index partner_tier_history_partner_idx on public.partner_tier_history (partner_id, effective_at desc);

create trigger partner_score_events_immutable before update or delete on public.partner_score_events for each row execute function public.reject_immutable_row_change();
create trigger partner_ratings_immutable before update or delete on public.partner_ratings for each row execute function public.reject_immutable_row_change();
create or replace function private.guard_partner_score_snapshot_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and current_setting('app.partner_score_snapshot_finalize',true) = 'enabled'
    and old.raw_weighted_score_bps = 0 and old.calculated_score_bps = 0
    and old.final_score_bps = 0
    and row(old.id,old.partner_id,old.score_status,old.completed_orders,
      old.active_penalties_bps,old.config_version_id,old.calculation_key,
      old.calculated_at)
      is not distinct from
      row(new.id,new.partner_id,new.score_status,new.completed_orders,
      new.active_penalties_bps,new.config_version_id,new.calculation_key,
      new.calculated_at)
  then return new; end if;
  raise exception 'Partner score snapshots are immutable' using errcode='55000';
end;
$$;
create trigger partner_score_snapshots_immutable before update or delete on public.partner_score_snapshots for each row execute function private.guard_partner_score_snapshot_change();
create trigger partner_score_component_snapshots_immutable before update or delete on public.partner_score_component_snapshots for each row execute function public.reject_immutable_row_change();
create trigger partner_tier_history_immutable before update or delete on public.partner_tier_history for each row execute function public.reject_immutable_row_change();
create trigger partner_penalties_updated_at before update on public.partner_penalties for each row execute function public.set_updated_at();
create trigger partner_score_tier_state_updated_at before update on public.partner_score_tier_state for each row execute function public.set_updated_at();

create or replace function public.can_manage_marketplace_score_tiers()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name in ('operator', 'admin')
  );
$$;

create or replace function public.can_override_marketplace_score_tiers()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid()) and roles.name = 'admin'
  );
$$;

create or replace function private.marketplace_tier_rank(requested_tier public.marketplace_partner_tier)
returns integer language sql immutable set search_path = '' as $$
  select case requested_tier when 'BOGEY' then 1 when 'PAR' then 2
    when 'BIRDIE' then 3 when 'ALBATROSS' then 4 when 'HOLE_IN_ONE' then 5 end;
$$;

create or replace function private.smoothed_score_bps(
  score_sum_bps bigint, observations integer, prior_observations integer,
  prior_success_equivalent integer
) returns integer language sql immutable set search_path = '' as $$
  select least(10000, greatest(0, round(
    (coalesce(score_sum_bps, 0) + prior_success_equivalent::numeric * 10000)
    / (greatest(observations, 0) + prior_observations)
  )::integer));
$$;

create or replace function private.partner_verified_on_date(requested_partner_id uuid, requested_date date)
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(
    (
      select to_status = 'VERIFIED' from public.partner_status_history
      where partner_id = requested_partner_id
        and created_at < requested_date + interval '1 day'
        and exists (
          select 1 from public.partner_status_history verified_history
          where verified_history.partner_id=requested_partner_id
            and verified_history.to_status='VERIFIED'
            and verified_history.created_at < requested_date + interval '1 day'
        )
      order by version desc, created_at desc, id desc limit 1
    ),
    (
      select status='VERIFIED' and verified_at::date<=requested_date
      from public.partner_profiles where id=requested_partner_id
    ),
    false
  );
$$;

-- Publish the first complete score/tier config as a new immutable version.
do $$
declare source_id uuid; config_id uuid := gen_random_uuid(); published_at timestamptz := now();
begin
  select id into strict source_id from public.marketplace_config_versions
  where status = 'PUBLISHED' and effective_to is null for update;
  update public.marketplace_config_versions set status = 'RETIRED', effective_to = published_at where id = source_id;
  insert into public.marketplace_config_versions (
    id, status, effective_from, publication_reason
  ) values (config_id, 'PUBLISHED', published_at, 'Approved Partner Score and Tier baseline');
  insert into public.marketplace_tier_rules
  select config_id, tier,
    case tier when 'BOGEY' then 0 when 'PAR' then 6 when 'BIRDIE' then 16 when 'ALBATROSS' then 31 when 'HOLE_IN_ONE' then 76 end,
    case tier when 'BOGEY' then null when 'PAR' then 15 when 'BIRDIE' then 30 when 'ALBATROSS' then 75 else null end,
    case tier when 'BOGEY' then null when 'PAR' then 65 when 'BIRDIE' then 75 when 'ALBATROSS' then 85 when 'HOLE_IN_ONE' then 92 end,
    commission_rate_bps
  from public.marketplace_tier_rules where config_version_id = source_id;
  insert into public.marketplace_financial_rules select config_id, partner_processing_share_bps, admin_fee_bps, admin_fixed_fee, commission_tax_bps, minimum_marketplace_revenue, currency from public.marketplace_financial_rules where config_version_id = source_id;
  insert into public.marketplace_operational_rules select config_id, tier_averaging_window_days, 5, listing_expiry_days, acceptance_window_hours, payout_interval_days from public.marketplace_operational_rules where config_version_id = source_id;
  insert into public.marketplace_score_weight_rules values
    (config_id, 'order_completion', 2500), (config_id, 'shipping_sla', 2000),
    (config_id, 'availability', 1500), (config_id, 'listing_accuracy', 1500),
    (config_id, 'claims_returns', 1000), (config_id, 'golfer_rating', 1000),
    (config_id, 'documentation_tenure', 500);
  insert into public.marketplace_score_rules values (
    config_id, 8000, 10, 8, 5, 5, 3000, 7000, 6000, 4000,
    7, 14, 'PAR', array['APPROVED']::public.marketplace_listing_status[]
  );
  insert into public.marketplace_score_outcome_rules values
    (config_id,'ORDER_COMPLETION','COMPLETED_CORRECTLY',10000,true),
    (config_id,'ORDER_COMPLETION','PARTNER_FAILURE',0,false),
    (config_id,'SHIPPING_SLA','INVENTORY_CONFIRMED_ON_TIME',10000,false),
    (config_id,'SHIPPING_SLA','INVENTORY_CONFIRMATION_LATE',0,false),
    (config_id,'SHIPPING_SLA','CARRIER_HANDOFF_ON_TIME',10000,false),
    (config_id,'SHIPPING_SLA','CARRIER_HANDOFF_LATE',0,false),
    (config_id,'AVAILABILITY','AVAILABLE',10000,false),
    (config_id,'AVAILABILITY','INVENTORY_FAILURE',0,false),
    (config_id,'LISTING_ACCURACY','ACCURATE',10000,false),
    (config_id,'LISTING_ACCURACY','MINOR_MISMATCH',7000,false),
    (config_id,'LISTING_ACCURACY','MAJOR_MISMATCH',0,false),
    (config_id,'CLAIMS_RETURNS','NO_PARTNER_FAULT',10000,false),
    (config_id,'CLAIMS_RETURNS','PARTNER_FAULT',0,false);
  insert into public.marketplace_penalty_rules values
    (config_id,'REPEATED_LATE_SHIPMENT','MINOR',200,90,false,false),
    (config_id,'POST_PAYMENT_CANCELLATION','MEDIUM',500,180,false,false),
    (config_id,'MAJOR_MISMATCH','MEDIUM',500,180,false,false),
    (config_id,'PARTNER_ATTRIBUTABLE_RETURN','MEDIUM',400,180,false,false),
    (config_id,'LOST_PARTNER_ATTRIBUTABLE_DISPUTE','MAJOR',500,365,false,false),
    (config_id,'CONFIRMED_COUNTERFEIT','CRITICAL',2500,null,true,true),
    (config_id,'DELIBERATE_MANIPULATION','CRITICAL',2000,null,true,true);
  insert into public.marketplace_tenure_score_rules values
    (config_id,0,29,5000), (config_id,30,89,7000),
    (config_id,90,180,8500), (config_id,181,null,10000);
end;
$$;

-- Remaining functions, policies and the daily job are defined below.

alter table public.partner_score_snapshots
  add constraint partner_score_snapshots_override_fk
  foreign key (applied_override_id) references public.partner_score_tier_overrides (id) on delete restrict;

create or replace function private.capture_partner_daily_listing_metric(
  requested_partner_id uuid, requested_date date, requested_config_id uuid
) returns public.partner_daily_listing_metrics
language plpgsql security definer set search_path = '' as $$
declare metric public.partner_daily_listing_metrics; eligible_statuses public.marketplace_listing_status[];
  first_verified date; is_eligible boolean; listing_count integer := 0;
begin
  select tier_eligible_listing_statuses into strict eligible_statuses
  from public.marketplace_score_rules where config_version_id = requested_config_id;
  select min(created_at::date) into first_verified from public.partner_status_history
  where partner_id = requested_partner_id and to_status = 'VERIFIED';
  if first_verified is null then
    select verified_at::date into first_verified from public.partner_profiles
    where id=requested_partner_id and verified_at is not null;
  end if;
  is_eligible := first_verified is not null and requested_date >= first_verified
    and private.partner_verified_on_date(requested_partner_id, requested_date);
  if is_eligible then
    select count(*)::integer into listing_count
    from public.marketplace_listings listing
    where listing.partner_id = requested_partner_id
      and listing.created_at < requested_date + interval '1 day'
      and listing.approved_version_id is not null
      and exists (
        select 1 from public.marketplace_listing_versions approved_version
        where approved_version.id = listing.approved_version_id
          and approved_version.canonical_model_id is not null
      )
      and exists (
        select 1
        from public.marketplace_listing_inventory inventory
        join lateral (
          select movement.quantity_on_hand_after - movement.quantity_reserved_after as quantity_available
          from public.marketplace_listing_inventory_movements movement
          where movement.inventory_id = inventory.id
            and movement.created_at < requested_date + interval '1 day'
          order by movement.created_at desc, movement.id desc
          limit 1
        ) inventory_at_date on true
        where inventory.listing_id = listing.id
          and inventory_at_date.quantity_available > 0
      )
      and coalesce((
        select history.to_status from public.marketplace_listing_status_history history
        where history.listing_id = listing.id
          and history.created_at < requested_date + interval '1 day'
        order by history.lock_version desc, history.created_at desc, history.id desc limit 1
      ), listing.status) = any(eligible_statuses);
  end if;
  insert into public.partner_daily_listing_metrics (
    partner_id, metric_date, eligible, active_listing_count,
    eligibility_started_at, config_version_id, calculated_at
  ) values (
    requested_partner_id, requested_date, is_eligible, listing_count,
    first_verified, requested_config_id, now()
  ) on conflict (partner_id, metric_date) do update set
    eligible = excluded.eligible,
    active_listing_count = excluded.active_listing_count,
    eligibility_started_at = excluded.eligibility_started_at,
    config_version_id = excluded.config_version_id,
    calculated_at = now()
  returning * into metric;
  return metric;
end;
$$;

create or replace function public.record_partner_score_event(
  requested_partner_id uuid,
  requested_component public.partner_score_component,
  requested_outcome_code text,
  requested_source public.partner_score_event_source,
  requested_idempotency_key text,
  requested_occurred_at timestamptz,
  requested_source_entity_type text default null,
  requested_source_entity_id uuid default null,
  requested_evidence jsonb default '{}'::jsonb
) returns public.partner_score_events
language plpgsql security definer set search_path = '' as $$
declare config_id uuid; outcome public.marketplace_score_outcome_rules;
  event_record public.partner_score_events; inserted_event boolean := false;
begin
  if not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace score event access denied' using errcode = '42501';
  end if;
  select id into strict config_id from public.marketplace_config_versions
  where status = 'PUBLISHED' and effective_to is null;
  select * into strict outcome from public.marketplace_score_outcome_rules
  where config_version_id = config_id and component = requested_component
    and outcome_code = requested_outcome_code;
  insert into public.partner_score_events (
    partner_id, component, outcome_code, score_bps, counts_completed_order,
    source, source_entity_type, source_entity_id, evidence,
    idempotency_key, occurred_at, recorded_by
  ) values (
    requested_partner_id, requested_component, requested_outcome_code,
    outcome.score_bps, outcome.counts_completed_order, requested_source,
    requested_source_entity_type, requested_source_entity_id,
    requested_evidence, requested_idempotency_key, requested_occurred_at,
    (select auth.uid())
  ) on conflict (idempotency_key) do nothing returning * into event_record;
  inserted_event := found;
  if event_record.id is null then
    select * into strict event_record from public.partner_score_events
    where idempotency_key=requested_idempotency_key;
    if event_record.partner_id is distinct from requested_partner_id
      or event_record.component is distinct from requested_component
      or event_record.outcome_code is distinct from requested_outcome_code
      or event_record.source is distinct from requested_source
      or event_record.source_entity_type is distinct from requested_source_entity_type
      or event_record.source_entity_id is distinct from requested_source_entity_id
      or event_record.occurred_at is distinct from requested_occurred_at
    then raise exception 'Score event idempotency conflict' using errcode = '23505'; end if;
  end if;
  if inserted_event then
    perform private.write_marketplace_audit(
      'marketplace.score_event_recorded', 'partner_score_event', event_record.id,
      null, null, jsonb_build_object('partner_id', requested_partner_id,
        'component', requested_component, 'outcome_code', requested_outcome_code)
    );
  end if;
  return event_record;
end;
$$;

create or replace function public.record_partner_rating(
  requested_partner_id uuid, requested_product_as_described smallint,
  requested_overall_experience smallint, requested_delivery_experience smallint,
  requested_source_entity_type text, requested_source_entity_id uuid,
  requested_idempotency_key text, requested_occurred_at timestamptz
) returns public.partner_ratings
language plpgsql security definer set search_path = '' as $$
declare rating public.partner_ratings;
begin
  if not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace rating access denied' using errcode = '42501';
  end if;
  insert into public.partner_ratings (
    partner_id, product_as_described, overall_experience, delivery_experience,
    source_entity_type, source_entity_id, idempotency_key, occurred_at, recorded_by
  ) values (
    requested_partner_id, requested_product_as_described,
    requested_overall_experience, requested_delivery_experience,
    requested_source_entity_type, requested_source_entity_id,
    requested_idempotency_key, requested_occurred_at, (select auth.uid())
  ) on conflict (idempotency_key) do nothing returning * into rating;
  if rating.id is null then
    select * into strict rating from public.partner_ratings
    where idempotency_key=requested_idempotency_key;
    if rating.partner_id is distinct from requested_partner_id
      or rating.product_as_described is distinct from requested_product_as_described
      or rating.overall_experience is distinct from requested_overall_experience
      or rating.delivery_experience is distinct from requested_delivery_experience
      or rating.source_entity_type is distinct from requested_source_entity_type
      or rating.source_entity_id is distinct from requested_source_entity_id
      or rating.occurred_at is distinct from requested_occurred_at
    then raise exception 'Partner rating idempotency conflict' using errcode = '23505'; end if;
  end if;
  return rating;
end;
$$;

create or replace function public.create_partner_penalty(
  requested_partner_id uuid, requested_event_code text,
  requested_idempotency_key text, requested_reason text,
  requested_starts_at timestamptz default now(),
  requested_source_event_id uuid default null
) returns public.partner_penalties
language plpgsql security definer set search_path = '' as $$
declare config_id uuid; rule public.marketplace_penalty_rules;
  penalty public.partner_penalties; inserted_penalty boolean := false;
begin
  if not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace penalty access denied' using errcode = '42501';
  end if;
  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Penalty reason is required' using errcode = '22023';
  end if;
  select id into strict config_id from public.marketplace_config_versions
  where status = 'PUBLISHED' and effective_to is null;
  select * into strict rule from public.marketplace_penalty_rules
  where config_version_id = config_id and event_code = requested_event_code;
  insert into public.partner_penalties (
    partner_id, source_event_id, event_code, severity, penalty_bps, reason,
    starts_at, expires_at, config_version_id, idempotency_key, created_by,
    partner_visible
  ) values (
    requested_partner_id, requested_source_event_id, requested_event_code,
    rule.severity, rule.penalty_bps, btrim(requested_reason), requested_starts_at,
    case when rule.decay_days is null then null else requested_starts_at + make_interval(days => rule.decay_days) end,
    config_id, requested_idempotency_key, (select auth.uid()),
    not rule.requires_suspension_review
  ) on conflict (idempotency_key) do nothing returning * into penalty;
  inserted_penalty := found;
  if penalty.id is null then
    select * into strict penalty from public.partner_penalties
    where idempotency_key=requested_idempotency_key;
    if penalty.partner_id is distinct from requested_partner_id
      or penalty.event_code is distinct from requested_event_code
      or penalty.source_event_id is distinct from requested_source_event_id
    then raise exception 'Partner penalty idempotency conflict' using errcode = '23505'; end if;
  end if;
  if rule.requires_suspension_review then
    insert into public.partner_risk_flags (partner_id, penalty_id, flag_code, reason)
    values (requested_partner_id, penalty.id, 'SUSPENSION_REVIEW', btrim(requested_reason))
    on conflict (penalty_id) do nothing;
  end if;
  if inserted_penalty then
    perform private.write_marketplace_audit(
      'marketplace.penalty_created', 'partner_penalty', penalty.id,
      requested_reason, null, jsonb_build_object('partner_id', requested_partner_id,
        'event_code', requested_event_code, 'severity', rule.severity,
        'penalty_bps', rule.penalty_bps, 'expires_at', penalty.expires_at)
    );
  end if;
  return penalty;
end;
$$;

create or replace function public.clear_partner_penalty(
  requested_penalty_id uuid, requested_reason text
) returns public.partner_penalties
language plpgsql security definer set search_path = '' as $$
declare penalty public.partner_penalties;
begin
  if not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace penalty access denied' using errcode = '42501';
  end if;
  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Clearance reason is required' using errcode = '22023';
  end if;
  update public.partner_penalties set status = 'CLEARED', cleared_at = now(),
    cleared_by = (select auth.uid()), clearance_reason = btrim(requested_reason)
  where id = requested_penalty_id and status = 'ACTIVE' returning * into penalty;
  if not found then raise exception 'Active penalty unavailable' using errcode = 'P0002'; end if;
  perform private.write_marketplace_audit(
    'marketplace.penalty_cleared', 'partner_penalty', penalty.id,
    requested_reason, jsonb_build_object('status','ACTIVE'),
    jsonb_build_object('status','CLEARED')
  );
  return penalty;
end;
$$;

create or replace function public.create_partner_score_tier_override(
  requested_partner_id uuid, requested_type public.partner_override_type,
  requested_score_bps integer, requested_tier public.marketplace_partner_tier,
  requested_reason text, requested_expires_at timestamptz default null
) returns public.partner_score_tier_overrides
language plpgsql security definer set search_path = '' as $$
declare override_record public.partner_score_tier_overrides; old_value jsonb;
begin
  if not public.can_override_marketplace_score_tiers() then
    raise exception 'Marketplace override access denied' using errcode = '42501';
  end if;
  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Override reason is required' using errcode = '22023';
  end if;
  select jsonb_build_object('id',id,'score_bps',score_bps,'tier',tier)
  into old_value from public.partner_score_tier_overrides
  where partner_id = requested_partner_id and override_type = requested_type and status = 'ACTIVE';
  update public.partner_score_tier_overrides set status = 'CLEARED', cleared_at = now(), cleared_by = (select auth.uid())
  where partner_id = requested_partner_id and override_type = requested_type and status = 'ACTIVE';
  insert into public.partner_score_tier_overrides (
    partner_id, override_type, score_bps, tier, reason, expires_at, created_by
  ) values (
    requested_partner_id, requested_type, requested_score_bps, requested_tier,
    btrim(requested_reason), requested_expires_at, (select auth.uid())
  ) returning * into override_record;
  perform private.write_marketplace_audit(
    'marketplace.override_created', 'partner_score_tier_override', override_record.id,
    requested_reason, old_value,
    jsonb_build_object('partner_id',requested_partner_id,'type',requested_type,
      'score_bps',requested_score_bps,'tier',requested_tier,'expires_at',requested_expires_at)
  );
  return override_record;
end;
$$;

create or replace function public.clear_partner_score_tier_override(
  requested_override_id uuid, requested_reason text
) returns public.partner_score_tier_overrides
language plpgsql security definer set search_path = '' as $$
declare override_record public.partner_score_tier_overrides;
begin
  if not public.can_override_marketplace_score_tiers() then
    raise exception 'Marketplace override access denied' using errcode = '42501';
  end if;
  if char_length(btrim(requested_reason)) not between 3 and 500 then
    raise exception 'Override clearance reason is required' using errcode = '22023';
  end if;
  update public.partner_score_tier_overrides set status = 'CLEARED', cleared_at = now(), cleared_by = (select auth.uid())
  where id = requested_override_id and status = 'ACTIVE' returning * into override_record;
  if not found then raise exception 'Active override unavailable' using errcode = 'P0002'; end if;
  perform private.write_marketplace_audit(
    'marketplace.override_cleared', 'partner_score_tier_override', override_record.id,
    requested_reason, jsonb_build_object('status','ACTIVE'), jsonb_build_object('status','CLEARED')
  );
  return override_record;
end;
$$;

create or replace function private.calculate_partner_component(
  requested_partner_id uuid, requested_component public.partner_score_component,
  requested_config_id uuid, requested_as_of_date date
) returns table (
  numerator_score_bps bigint, observation_count integer,
  adjusted_score_bps integer, evidence_summary jsonb
) language plpgsql stable security definer set search_path = '' as $$
declare rules public.marketplace_score_rules; score_sum bigint := 0; observations integer := 0;
  inventory_sum bigint := 0; inventory_count integer := 0;
  handoff_sum bigint := 0; handoff_count integer := 0;
  inventory_score integer; handoff_score integer; first_verified date;
  tenure_days integer := 0; tenure_score integer := 5000; documentation_score integer := 0;
begin
  select * into strict rules from public.marketplace_score_rules where config_version_id = requested_config_id;
  if requested_component = 'SHIPPING_SLA' then
    select coalesce(sum(score_bps),0), count(*)::integer into inventory_sum, inventory_count
    from public.partner_score_events where partner_id = requested_partner_id
      and component = requested_component
      and outcome_code in ('INVENTORY_CONFIRMED_ON_TIME','INVENTORY_CONFIRMATION_LATE')
      and occurred_at < requested_as_of_date + interval '1 day';
    select coalesce(sum(score_bps),0), count(*)::integer into handoff_sum, handoff_count
    from public.partner_score_events where partner_id = requested_partner_id
      and component = requested_component
      and outcome_code in ('CARRIER_HANDOFF_ON_TIME','CARRIER_HANDOFF_LATE')
      and occurred_at < requested_as_of_date + interval '1 day';
    inventory_score := private.smoothed_score_bps(inventory_sum, inventory_count, rules.prior_observations, rules.prior_success_equivalent);
    handoff_score := private.smoothed_score_bps(handoff_sum, handoff_count, rules.prior_observations, rules.prior_success_equivalent);
    numerator_score_bps := inventory_sum + handoff_sum;
    observation_count := inventory_count + handoff_count;
    adjusted_score_bps := round((inventory_score::numeric * rules.shipping_inventory_confirmation_weight_bps + handoff_score::numeric * rules.shipping_carrier_handoff_weight_bps) / 10000)::integer;
    evidence_summary := jsonb_build_object('inventory_confirmation_observations',inventory_count,'carrier_handoff_observations',handoff_count);
    return next; return;
  elsif requested_component = 'GOLFER_RATING' then
    select coalesce(sum(round((product_as_described + overall_experience + delivery_experience)::numeric * 10000 / 15)),0), count(*)::integer
      into score_sum, observations
    from public.partner_ratings where partner_id = requested_partner_id
      and occurred_at < requested_as_of_date + interval '1 day';
  elsif requested_component = 'DOCUMENTATION_TENURE' then
    select min(created_at::date) into first_verified from public.partner_status_history
    where partner_id = requested_partner_id and to_status = 'VERIFIED';
    if first_verified is null then
      select verified_at::date into first_verified from public.partner_profiles
      where id=requested_partner_id and verified_at is not null;
    end if;
    tenure_days := greatest(0, requested_as_of_date - coalesce(first_verified, requested_as_of_date));
    select score_bps into tenure_score from public.marketplace_tenure_score_rules
    where config_version_id = requested_config_id and minimum_days <= tenure_days
      and (maximum_days is null or maximum_days >= tenure_days)
    order by minimum_days desc limit 1;
    documentation_score := case when private.partner_verified_on_date(requested_partner_id, requested_as_of_date) then 10000 else 0 end;
    adjusted_score_bps := round((documentation_score::numeric * rules.documentation_weight_bps + tenure_score::numeric * rules.tenure_weight_bps) / 10000)::integer;
    numerator_score_bps := adjusted_score_bps; observation_count := 1;
    evidence_summary := jsonb_build_object('documentation_compliant',documentation_score=10000,'tenure_days',tenure_days,'tenure_score_bps',tenure_score);
    return next; return;
  else
    select coalesce(sum(score_bps),0), count(*)::integer into score_sum, observations
    from public.partner_score_events where partner_id = requested_partner_id
      and component = requested_component
      and occurred_at < requested_as_of_date + interval '1 day';
  end if;
  numerator_score_bps := score_sum; observation_count := observations;
  adjusted_score_bps := private.smoothed_score_bps(score_sum, observations, rules.prior_observations, rules.prior_success_equivalent);
  evidence_summary := jsonb_build_object('observations',observations);
  return next;
end;
$$;

create or replace function public.recalculate_partner_score_tier(
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
  if (select auth.uid()) is not null and not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace score recalculation denied' using errcode = '42501';
  end if;
  if (select auth.uid()) is null and session_user not in ('postgres','supabase_admin') then
    raise exception 'Marketplace score job denied' using errcode = '42501';
  end if;
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
    old_state.promotion_eligible_since := null; old_state.tier_at_risk_since := null;
  elsif private.marketplace_tier_rank(target_tier) > private.marketplace_tier_rank(old_tier) then
    old_state.tier_at_risk_since := null;
    old_state.promotion_eligible_since := coalesce(old_state.promotion_eligible_since,requested_as_of_date);
    if rules.promotion_stability_days = 0 or requested_as_of_date - old_state.promotion_eligible_since + 1 >= rules.promotion_stability_days then
      new_tier := target_tier; old_state.promotion_eligible_since := null;
    end if;
  elsif private.marketplace_tier_rank(target_tier) < private.marketplace_tier_rank(old_tier) then
    old_state.promotion_eligible_since := null;
    old_state.tier_at_risk_since := coalesce(old_state.tier_at_risk_since,requested_as_of_date);
    if critical_bypass or rules.downgrade_grace_days = 0 or requested_as_of_date - old_state.tier_at_risk_since + 1 >= rules.downgrade_grace_days then
      new_tier := target_tier; old_state.tier_at_risk_since := null;
    end if;
  else
    old_state.promotion_eligible_since := null; old_state.tier_at_risk_since := null;
  end if;
  update public.partner_score_tier_state set latest_score_snapshot_id = snapshot.id,
    current_tier = new_tier, highest_eligible_tier = eligible_tier,
    rolling_average_active_listings = rolling_average,
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

create or replace function public.run_marketplace_score_tier_job(
  requested_as_of_date date, requested_job_key text,
  requested_partner_id uuid default null,
  requested_reason text default 'Daily Marketplace score and tier recalculation'
) returns public.marketplace_score_job_runs
language plpgsql security definer set search_path = '' as $$
declare run_record public.marketplace_score_job_runs; partner_record record; processed integer := 0;
begin
  if (select auth.uid()) is not null and not public.can_manage_marketplace_score_tiers() then
    raise exception 'Marketplace score job access denied' using errcode = '42501';
  end if;
  if (select auth.uid()) is null and session_user not in ('postgres','supabase_admin') then
    raise exception 'Marketplace score job access denied' using errcode = '42501';
  end if;
  if requested_job_key !~ '^[a-zA-Z0-9][a-zA-Z0-9:_-]{5,199}$'
    or char_length(btrim(requested_reason)) not between 3 and 500
  then raise exception 'Valid job key and reason are required' using errcode = '22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('marketplace-score-job:' || requested_job_key,0));
  select * into run_record from public.marketplace_score_job_runs where job_key = requested_job_key;
  if found then
    if run_record.as_of_date is distinct from requested_as_of_date
      or run_record.requested_partner_id is distinct from requested_partner_id
    then raise exception 'Marketplace score job idempotency conflict' using errcode='23505'; end if;
    if run_record.status = 'COMPLETED' then return run_record; end if;
  end if;
  if not found then
    insert into public.marketplace_score_job_runs (
      job_key,as_of_date,requested_partner_id,actor_id,reason
    ) values (requested_job_key,requested_as_of_date,requested_partner_id,(select auth.uid()),btrim(requested_reason))
    returning * into run_record;
  end if;
  for partner_record in
    select id from public.partner_profiles partner
    where (requested_partner_id is null or partner.id = requested_partner_id)
      and exists (select 1 from public.partner_status_history history where history.partner_id = partner.id and history.to_status = 'VERIFIED')
    order by id
  loop
    perform public.recalculate_partner_score_tier(
      partner_record.id,requested_as_of_date,
      requested_job_key || ':' || partner_record.id::text,requested_reason
    );
    processed := processed + 1;
  end loop;
  update public.marketplace_score_job_runs set status = 'COMPLETED',
    processed_partners = processed, completed_at = now()
  where id = run_record.id returning * into run_record;
  return run_record;
end;
$$;

create or replace function public.get_partner_tier_progress(requested_partner_id uuid)
returns table (
  tier public.marketplace_partner_tier,
  minimum_average_active_listings numeric,
  minimum_score_bps integer,
  promotion_stability_days integer,
  downgrade_grace_days integer
) language plpgsql stable security definer set search_path = '' as $$
declare config_id uuid;
begin
  if not exists (
      select 1 from public.partner_profiles where id=requested_partner_id and user_id=(select auth.uid())
    ) and not public.can_manage_marketplace_score_tiers()
  then raise exception 'Partner tier progress unavailable' using errcode='42501'; end if;
  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  return query select rule.tier,coalesce(rule.minimum_average_active_listings,0),
    (coalesce(rule.minimum_score,0)*100)::integer,score_rule.promotion_stability_days,
    score_rule.downgrade_grace_days
  from public.marketplace_tier_rules rule
  join public.marketplace_score_rules score_rule on score_rule.config_version_id=rule.config_version_id
  where rule.config_version_id=config_id
  order by private.marketplace_tier_rank(rule.tier);
end;
$$;

create or replace function private.initialize_verified_partner_score()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status='VERIFIED' and old.status is distinct from new.status then
    perform public.recalculate_partner_score_tier(
      new.id,(now() at time zone 'UTC')::date,
      'verification:' || new.id::text || ':' || new.version::text,
      'Initialize score after Partner verification'
    );
  end if;
  return new;
end;
$$;
create trigger zz_partner_profiles_initialize_score
after update on public.partner_profiles
for each row execute function private.initialize_verified_partner_score();

create or replace function public.create_marketplace_config_draft(requested_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source_config_id uuid; new_config_id uuid := gen_random_uuid(); reason_value text := btrim(requested_reason);
begin
  if not public.can_manage_marketplace_configuration() then raise exception 'Marketplace configuration access denied' using errcode='42501'; end if;
  if char_length(reason_value) not between 3 and 500 then raise exception 'A reason between 3 and 500 characters is required' using errcode='22023'; end if;
  select id into strict source_config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null for share;
  insert into public.marketplace_config_versions (id,created_by) values (new_config_id,(select auth.uid()));
  insert into public.marketplace_tier_rules select new_config_id,tier,minimum_average_active_listings,maximum_average_active_listings,minimum_score,commission_rate_bps from public.marketplace_tier_rules where config_version_id=source_config_id;
  insert into public.marketplace_financial_rules select new_config_id,partner_processing_share_bps,admin_fee_bps,admin_fixed_fee,commission_tax_bps,minimum_marketplace_revenue,currency from public.marketplace_financial_rules where config_version_id=source_config_id;
  insert into public.marketplace_operational_rules select new_config_id,tier_averaging_window_days,score_provisional_completed_orders,listing_expiry_days,acceptance_window_hours,payout_interval_days from public.marketplace_operational_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_weight_rules select new_config_id,metric_code,weight_bps from public.marketplace_score_weight_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_rules select new_config_id,neutral_score_bps,prior_observations,prior_success_equivalent,established_completed_orders,public_rating_min_reviews,shipping_inventory_confirmation_weight_bps,shipping_carrier_handoff_weight_bps,documentation_weight_bps,tenure_weight_bps,promotion_stability_days,downgrade_grace_days,provisional_tier_cap,tier_eligible_listing_statuses from public.marketplace_score_rules where config_version_id=source_config_id;
  insert into public.marketplace_score_outcome_rules select new_config_id,component,outcome_code,score_bps,counts_completed_order from public.marketplace_score_outcome_rules where config_version_id=source_config_id;
  insert into public.marketplace_penalty_rules select new_config_id,event_code,severity,penalty_bps,decay_days,requires_suspension_review,bypasses_downgrade_grace from public.marketplace_penalty_rules where config_version_id=source_config_id;
  insert into public.marketplace_tenure_score_rules select new_config_id,minimum_days,maximum_days,score_bps from public.marketplace_tenure_score_rules where config_version_id=source_config_id;
  perform private.write_marketplace_audit('marketplace.configuration_draft_created','marketplace_config_version',new_config_id,reason_value,jsonb_build_object('source_config_id',source_config_id),jsonb_build_object('status','DRAFT'));
  return new_config_id;
end;
$$;

create or replace function public.publish_marketplace_config_version(requested_config_id uuid, requested_reason text)
returns public.marketplace_config_versions language plpgsql security definer set search_path = '' as $$
declare config_record public.marketplace_config_versions; reason_value text := btrim(requested_reason); published_at timestamptz := now();
begin
  if not public.can_manage_marketplace_configuration() then raise exception 'Marketplace configuration access denied' using errcode='42501'; end if;
  if char_length(reason_value) not between 3 and 500 then raise exception 'A reason between 3 and 500 characters is required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('marketplace-config-publish',0));
  select * into config_record from public.marketplace_config_versions where id=requested_config_id for update;
  if not found or config_record.status <> 'DRAFT' then raise exception 'Only an available draft configuration can be published' using errcode='23514'; end if;
  if (select count(*) from public.marketplace_tier_rules where config_version_id=requested_config_id) <> 5
    or (select count(*) from public.marketplace_score_weight_rules where config_version_id=requested_config_id) <> 7
    or (select coalesce(sum(weight_bps),0) from public.marketplace_score_weight_rules where config_version_id=requested_config_id) <> 10000
    or not exists (select 1 from public.marketplace_financial_rules where config_version_id=requested_config_id)
    or not exists (select 1 from public.marketplace_operational_rules where config_version_id=requested_config_id and score_provisional_completed_orders > 0)
    or not exists (select 1 from public.marketplace_score_rules where config_version_id=requested_config_id)
    or (select count(*) from public.marketplace_tenure_score_rules where config_version_id=requested_config_id) <> 4
    or (select count(*) from public.marketplace_penalty_rules where config_version_id=requested_config_id) < 7
    or exists (
      select 1 from (values ('BOGEY',1),('PAR',2),('BIRDIE',3),('ALBATROSS',4),('HOLE_IN_ONE',5)) expected(tier_name,tier_rank)
      left join public.marketplace_tier_rules rule on rule.config_version_id=requested_config_id and rule.tier::text=expected.tier_name
      where rule.tier is null
    )
    or exists (
      select 1
      from (values
        ('order_completion'),('shipping_sla'),('availability'),
        ('listing_accuracy'),('claims_returns'),('golfer_rating'),
        ('documentation_tenure')
      ) expected(metric_code)
      left join public.marketplace_score_weight_rules weight_rule
        on weight_rule.config_version_id=requested_config_id
        and weight_rule.metric_code=expected.metric_code
      where weight_rule.metric_code is null
    )
  then raise exception 'Marketplace score/tier configuration is incomplete or invalid' using errcode='23514'; end if;
  if exists (
    select 1 from public.marketplace_tier_rules lower_rule
    join public.marketplace_tier_rules upper_rule on upper_rule.config_version_id=lower_rule.config_version_id
      and private.marketplace_tier_rank(upper_rule.tier)=private.marketplace_tier_rank(lower_rule.tier)+1
    where lower_rule.config_version_id=requested_config_id
      and (coalesce(upper_rule.minimum_average_active_listings,0) < coalesce(lower_rule.minimum_average_active_listings,0)
        or coalesce(upper_rule.minimum_score,0) < coalesce(lower_rule.minimum_score,0))
  ) then raise exception 'Marketplace tier thresholds must be ordered' using errcode='23514'; end if;
  update public.marketplace_config_versions set status='RETIRED',effective_to=published_at where status='PUBLISHED' and effective_to is null;
  update public.marketplace_config_versions set status='PUBLISHED',effective_from=published_at,published_by=(select auth.uid()),publication_reason=reason_value where id=requested_config_id returning * into config_record;
  perform private.write_marketplace_audit('marketplace.configuration_published','marketplace_config_version',requested_config_id,reason_value,jsonb_build_object('status','DRAFT'),jsonb_build_object('status','PUBLISHED','version_number',config_record.version_number,'effective_from',config_record.effective_from));
  return config_record;
end;
$$;

alter table public.marketplace_score_rules enable row level security;
alter table public.marketplace_score_outcome_rules enable row level security;
alter table public.marketplace_penalty_rules enable row level security;
alter table public.marketplace_tenure_score_rules enable row level security;
alter table public.partner_score_events enable row level security;
alter table public.partner_ratings enable row level security;
alter table public.partner_penalties enable row level security;
alter table public.partner_risk_flags enable row level security;
alter table public.partner_daily_listing_metrics enable row level security;
alter table public.partner_score_snapshots enable row level security;
alter table public.partner_score_component_snapshots enable row level security;
alter table public.partner_score_tier_overrides enable row level security;
alter table public.partner_score_tier_state enable row level security;
alter table public.partner_tier_history enable row level security;
alter table public.marketplace_score_job_runs enable row level security;

create policy "Marketplace admins can read score rules" on public.marketplace_score_rules for select to authenticated using ((select public.can_manage_marketplace_configuration()));
create policy "Marketplace admins can read score outcomes" on public.marketplace_score_outcome_rules for select to authenticated using ((select public.can_manage_marketplace_configuration()));
create policy "Marketplace admins can read penalty rules" on public.marketplace_penalty_rules for select to authenticated using ((select public.can_manage_marketplace_configuration()));
create policy "Marketplace admins can read tenure rules" on public.marketplace_tenure_score_rules for select to authenticated using ((select public.can_manage_marketplace_configuration()));

create policy "Score staff can read events" on public.partner_score_events for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read ratings" on public.partner_ratings for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Partners can read visible own penalties" on public.partner_penalties for select to authenticated using (
  partner_visible and exists (select 1 from public.partner_profiles where partner_profiles.id=partner_penalties.partner_id and partner_profiles.user_id=(select auth.uid()))
);
create policy "Score staff can read penalties" on public.partner_penalties for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read risk flags" on public.partner_risk_flags for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read listing metrics" on public.partner_daily_listing_metrics for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read score snapshots" on public.partner_score_snapshots for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read component snapshots" on public.partner_score_component_snapshots for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read overrides" on public.partner_score_tier_overrides for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read score tier state" on public.partner_score_tier_state for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read tier history" on public.partner_tier_history for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));
create policy "Score staff can read job runs" on public.marketplace_score_job_runs for select to authenticated using ((select public.can_manage_marketplace_score_tiers()));

create or replace function public.get_own_partner_score_summary()
returns table (
  current_tier public.marketplace_partner_tier,
  highest_eligible_tier public.marketplace_partner_tier,
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

create or replace function public.get_own_partner_tier_history()
returns table (
  old_tier public.marketplace_partner_tier,
  new_tier public.marketplace_partner_tier,
  reason text,
  rolling_average_active_listings numeric,
  effective_at timestamptz
) language sql stable security definer set search_path='' as $$
  select history.old_tier,history.new_tier,history.reason,
    round(history.rolling_average_active_listings,1),history.effective_at
  from public.partner_profiles partner
  join public.partner_tier_history history on history.partner_id=partner.id
  where partner.user_id=(select auth.uid())
  order by history.effective_at desc
  limit 12;
$$;

revoke all on public.marketplace_score_rules, public.marketplace_score_outcome_rules,
  public.marketplace_penalty_rules, public.marketplace_tenure_score_rules,
  public.partner_score_events, public.partner_ratings, public.partner_penalties,
  public.partner_risk_flags, public.partner_daily_listing_metrics,
  public.partner_score_snapshots, public.partner_score_component_snapshots,
  public.partner_score_tier_overrides, public.partner_score_tier_state,
  public.partner_tier_history, public.marketplace_score_job_runs
from anon, authenticated;

grant select on public.marketplace_score_rules, public.marketplace_score_outcome_rules,
  public.marketplace_penalty_rules, public.marketplace_tenure_score_rules,
  public.partner_score_events, public.partner_ratings, public.partner_penalties,
  public.partner_risk_flags, public.partner_daily_listing_metrics,
  public.partner_score_snapshots, public.partner_score_component_snapshots,
  public.partner_score_tier_overrides, public.partner_score_tier_state,
  public.partner_tier_history, public.marketplace_score_job_runs
to authenticated;

revoke all on function public.can_manage_marketplace_score_tiers() from public, anon;
revoke all on function public.can_override_marketplace_score_tiers() from public, anon;
revoke all on function public.record_partner_score_event(uuid,public.partner_score_component,text,public.partner_score_event_source,text,timestamptz,text,uuid,jsonb) from public, anon;
revoke all on function public.record_partner_rating(uuid,smallint,smallint,smallint,text,uuid,text,timestamptz) from public, anon;
revoke all on function public.create_partner_penalty(uuid,text,text,text,timestamptz,uuid) from public, anon;
revoke all on function public.clear_partner_penalty(uuid,text) from public, anon;
revoke all on function public.create_partner_score_tier_override(uuid,public.partner_override_type,integer,public.marketplace_partner_tier,text,timestamptz) from public, anon;
revoke all on function public.clear_partner_score_tier_override(uuid,text) from public, anon;
revoke all on function public.recalculate_partner_score_tier(uuid,date,text,text) from public, anon;
revoke all on function public.run_marketplace_score_tier_job(date,text,uuid,text) from public, anon;
revoke all on function public.get_partner_tier_progress(uuid) from public, anon;
revoke all on function public.get_own_partner_score_summary() from public, anon;
revoke all on function public.get_own_partner_tier_history() from public, anon;
revoke all on function private.capture_partner_daily_listing_metric(uuid,date,uuid) from public, anon, authenticated;
revoke all on function private.calculate_partner_component(uuid,public.partner_score_component,uuid,date) from public, anon, authenticated;
revoke all on function private.partner_verified_on_date(uuid,date) from public, anon, authenticated;
revoke all on function private.marketplace_tier_rank(public.marketplace_partner_tier) from public, anon, authenticated;
revoke all on function private.smoothed_score_bps(bigint,integer,integer,integer) from public, anon, authenticated;
revoke all on function private.guard_partner_score_snapshot_change() from public, anon, authenticated;
revoke all on function private.initialize_verified_partner_score() from public, anon, authenticated;

grant execute on function public.can_manage_marketplace_score_tiers() to authenticated;
grant execute on function public.can_override_marketplace_score_tiers() to authenticated;
grant execute on function public.record_partner_score_event(uuid,public.partner_score_component,text,public.partner_score_event_source,text,timestamptz,text,uuid,jsonb) to authenticated;
grant execute on function public.record_partner_rating(uuid,smallint,smallint,smallint,text,uuid,text,timestamptz) to authenticated;
grant execute on function public.create_partner_penalty(uuid,text,text,text,timestamptz,uuid) to authenticated;
grant execute on function public.clear_partner_penalty(uuid,text) to authenticated;
grant execute on function public.create_partner_score_tier_override(uuid,public.partner_override_type,integer,public.marketplace_partner_tier,text,timestamptz) to authenticated;
grant execute on function public.clear_partner_score_tier_override(uuid,text) to authenticated;
grant execute on function public.recalculate_partner_score_tier(uuid,date,text,text) to authenticated;
grant execute on function public.run_marketplace_score_tier_job(date,text,uuid,text) to authenticated;
grant execute on function public.get_partner_tier_progress(uuid) to authenticated;
grant execute on function public.get_own_partner_score_summary() to authenticated;
grant execute on function public.get_own_partner_tier_history() to authenticated;

comment on table public.partner_score_events is 'Append-only structured operational evidence; Partners cannot insert or read raw anti-gaming inputs.';
comment on table public.partner_score_snapshots is 'Immutable, config-versioned Partner score explanation snapshot.';
comment on table public.partner_daily_listing_metrics is 'Daily eligible listing count; pre-verification days are excluded from rolling averages.';
comment on table public.partner_score_tier_state is 'Current cache only; snapshots, metrics and tier history remain reconstructible sources.';

select public.run_marketplace_score_tier_job(
  (now() at time zone 'UTC')::date,
  'bootstrap:' || to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD'),
  null,
  'Initialize existing verified Partners with approved neutral score baseline'
);

select cron.schedule(
  'best-round-marketplace-score-tiers-daily',
  '15 5 * * *',
  $cron$select public.run_marketplace_score_tier_job(
    (now() at time zone 'UTC')::date,
    'daily:' || to_char((now() at time zone 'UTC')::date,'YYYY-MM-DD'),
    null,
    'Daily Marketplace score and tier recalculation'
  );$cron$
);
