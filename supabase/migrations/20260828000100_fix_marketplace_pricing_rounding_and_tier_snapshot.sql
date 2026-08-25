-- Correct Marketplace pricing monotonicity and bind effective tier overrides
-- atomically to immutable quote snapshots. All financial intermediates use
-- exact PostgreSQL numeric arithmetic; persisted money remains integer cents.

alter table public.marketplace_pricing_quotes
  add column effective_tier_override_id uuid
    references public.partner_score_tier_overrides (id) on delete restrict;

comment on column public.marketplace_pricing_quotes.effective_tier_override_id is
  'Active tier override resolved atomically with effective_partner_tier; null for calculated tiers.';

create or replace function private.marketplace_calculate_economics(
  requested_public_price bigint,
  commission_bps integer,
  commission_vat_bps integer,
  processing_bps integer,
  processing_fixed bigint,
  partner_processing_bps integer,
  admin_bps integer,
  admin_fixed bigint,
  minimum_revenue bigint
)
returns table (
  commission_amount bigint, commission_vat bigint, processing_total bigint,
  partner_processing_share bigint, best_round_processing_share bigint,
  admin_percentage_fee bigint, partner_net bigint,
  gross_best_round_revenue bigint, estimated_best_round_revenue bigint,
  meets_minimum boolean
)
language plpgsql immutable set search_path = '' as $$
declare
  denominator constant numeric := 100000000;
  commission_numerator numeric;
  commission_vat_numerator numeric;
  processing_total_numerator numeric;
  partner_processing_numerator numeric;
  admin_percentage_numerator numeric;
  rounded_commission bigint;
  rounded_commission_and_vat bigint;
  rounded_through_partner_processing bigint;
  rounded_variable_partner_deductions bigint;
  variable_partner_rate_numerator numeric;
begin
  if requested_public_price <= 0 or requested_public_price > 99999999999999 then
    raise exception 'Marketplace price is outside allowed bounds' using errcode='22003';
  end if;
  if commission_bps not between 0 and 9999
    or commission_vat_bps not between 0 and 9999
    or processing_bps not between 0 and 9999
    or partner_processing_bps not between 0 and 9999
    or admin_bps not between 0 and 9999
    or processing_fixed < 0 or admin_fixed < 0
  then
    raise exception 'Marketplace economics configuration is invalid' using errcode='22023';
  end if;

  variable_partner_rate_numerator :=
    commission_bps::numeric * 10000
    + commission_bps::numeric * commission_vat_bps
    + processing_bps::numeric * partner_processing_bps
    + admin_bps::numeric * 10000;
  if variable_partner_rate_numerator >= denominator then
    raise exception 'Marketplace variable Partner deductions must be below public price'
      using errcode='23514';
  end if;

  commission_numerator := requested_public_price::numeric * commission_bps * 10000;
  commission_vat_numerator := requested_public_price::numeric * commission_bps * commission_vat_bps;
  processing_total_numerator :=
    requested_public_price::numeric * processing_bps * 10000
    + processing_fixed::numeric * denominator;
  partner_processing_numerator :=
    requested_public_price::numeric * processing_bps * partner_processing_bps
    + processing_fixed::numeric * partner_processing_bps * 10000;
  admin_percentage_numerator := requested_public_price::numeric * admin_bps * 10000;

  -- Cumulative ceiling is the single monetary rounding policy. Marginal
  -- component amounts are differences between consecutive rounded totals.
  -- Therefore total variable deductions can rise by at most one cent whenever
  -- public price rises by one cent, while every displayed cent is conserved.
  rounded_commission := ceil(commission_numerator / denominator)::bigint;
  rounded_commission_and_vat :=
    ceil((commission_numerator + commission_vat_numerator) / denominator)::bigint;
  rounded_through_partner_processing :=
    ceil((commission_numerator + commission_vat_numerator + partner_processing_numerator) / denominator)::bigint;
  rounded_variable_partner_deductions :=
    ceil((commission_numerator + commission_vat_numerator + partner_processing_numerator
      + admin_percentage_numerator) / denominator)::bigint;

  commission_amount := rounded_commission;
  commission_vat := rounded_commission_and_vat - rounded_commission;
  processing_total := ceil(processing_total_numerator / denominator)::bigint;
  partner_processing_share :=
    rounded_through_partner_processing - rounded_commission_and_vat;
  best_round_processing_share := processing_total - partner_processing_share;
  admin_percentage_fee :=
    rounded_variable_partner_deductions - rounded_through_partner_processing;
  partner_net := requested_public_price - rounded_variable_partner_deductions - admin_fixed;
  gross_best_round_revenue := commission_amount + admin_percentage_fee + admin_fixed;
  estimated_best_round_revenue := gross_best_round_revenue - best_round_processing_share;

  if partner_processing_share < 0
    or best_round_processing_share < 0
    or partner_processing_share + best_round_processing_share <> processing_total
    or partner_net < 0
    or estimated_best_round_revenue < 0
  then
    raise exception 'Marketplace economics are not viable' using errcode='23514';
  end if;
  meets_minimum := case when minimum_revenue is null then null
    else estimated_best_round_revenue >= minimum_revenue end;
  return next;
end;
$$;

create or replace function private.marketplace_solve_price_for_net(
  desired_net bigint,
  commission_bps integer,
  commission_vat_bps integer,
  processing_bps integer,
  processing_fixed bigint,
  partner_processing_bps integer,
  admin_bps integer,
  admin_fixed bigint,
  minimum_revenue bigint
)
returns bigint language plpgsql immutable set search_path = '' as $$
declare
  low_price bigint := 1;
  high_price bigint := greatest(desired_net + admin_fixed, 100);
  middle_price bigint;
  economics record;
begin
  if desired_net <= 0 then
    raise exception 'Desired net must be positive' using errcode='22023';
  end if;
  loop
    begin
      select * into economics from private.marketplace_calculate_economics(
        high_price,commission_bps,commission_vat_bps,processing_bps,processing_fixed,
        partner_processing_bps,admin_bps,admin_fixed,minimum_revenue);
      if economics.partner_net >= desired_net then exit; end if;
    exception when check_violation then null;
    end;
    if high_price >= 49999999999999 then
      raise exception 'Desired net exceeds allowed bounds' using errcode='22003';
    end if;
    high_price := high_price * 2;
  end loop;
  while low_price < high_price loop
    middle_price := low_price + ((high_price-low_price)/2);
    begin
      select * into economics from private.marketplace_calculate_economics(
        middle_price,commission_bps,commission_vat_bps,processing_bps,processing_fixed,
        partner_processing_bps,admin_bps,admin_fixed,minimum_revenue);
      if economics.partner_net >= desired_net then high_price := middle_price;
      else low_price := middle_price + 1; end if;
    exception when check_violation then low_price := middle_price + 1;
    end;
  end loop;
  return low_price;
end;
$$;

create or replace function public.create_marketplace_pricing_quote(
  requested_listing_id uuid, requested_listing_version_id uuid,
  requested_input_mode public.marketplace_pricing_input_mode,
  requested_desired_public_price public.money_minor_units,
  requested_desired_partner_net public.money_minor_units,
  requested_market_analysis_id uuid,
  requested_idempotency_key uuid
)
returns public.marketplace_pricing_quotes
language plpgsql security definer set search_path = '' as $$
declare
  listing_record public.marketplace_listings;
  version_record public.marketplace_listing_versions;
  config_id uuid;
  financial public.marketplace_financial_rules;
  pricing_rule public.marketplace_pricing_rules;
  tier_rule public.marketplace_tier_rules;
  fee public.payment_fee_configs;
  tier_state public.partner_score_tier_state;
  tier_override public.partner_score_tier_overrides;
  tier_value public.marketplace_partner_tier := 'BOGEY';
  tier_origin public.marketplace_tier_source := 'CALCULATED';
  analysis public.marketplace_market_analyses;
  economics record;
  public_price bigint;
  quote_number integer;
  market_ref bigint;
  lower_bound bigint;
  upper_bound bigint;
  delta_bps integer;
  viability public.marketplace_price_viability;
  quote_record public.marketplace_pricing_quotes;
  quote_status public.marketplace_pricing_quote_status;
  quote_expires_at timestamptz;
begin
  select * into listing_record from public.marketplace_listings where id=requested_listing_id for update;
  if not found then raise exception 'Marketplace listing not found' using errcode='P0002'; end if;
  if not (private.marketplace_pricing_owned_by_current_user(listing_record.partner_id) or public.can_manage_marketplace_pricing()) then
    raise exception 'Marketplace pricing access denied' using errcode='42501'; end if;
  if listing_record.status<>'APPROVED' or listing_record.approved_version_id<>requested_listing_version_id then
    raise exception 'Pricing requires the approved listing version' using errcode='23514'; end if;
  select * into strict version_record from public.marketplace_listing_versions where id=requested_listing_version_id
    and listing_id=requested_listing_id and state='APPROVED' and canonical_model_id is not null;
  perform pg_advisory_xact_lock(hashtextextended(
    'marketplace-quote:'||listing_record.partner_id::text||':'||requested_idempotency_key::text,0
  ));
  select * into quote_record from public.marketplace_pricing_quotes
    where partner_id=listing_record.partner_id and idempotency_key=requested_idempotency_key;
  if found then
    if quote_record.listing_id<>requested_listing_id or quote_record.listing_version_id<>requested_listing_version_id
      or quote_record.input_mode<>requested_input_mode
      or quote_record.desired_public_price is distinct from requested_desired_public_price
      or quote_record.desired_partner_net is distinct from requested_desired_partner_net
      or quote_record.market_analysis_id is distinct from requested_market_analysis_id then
      raise exception 'Idempotency key belongs to different pricing inputs' using errcode='23505';
    end if;
    return quote_record;
  end if;

  select id into strict config_id from public.marketplace_config_versions where status='PUBLISHED' and effective_to is null;
  select * into strict financial from public.marketplace_financial_rules where config_version_id=config_id;
  select * into strict pricing_rule from public.marketplace_pricing_rules where config_version_id=config_id;
  select * into fee from public.payment_fee_configs where code=pricing_rule.payment_fee_config_code and active;
  if not found then raise exception 'Payment fee configuration is unavailable' using errcode='23514'; end if;

  select * into tier_state from public.partner_score_tier_state
  where partner_id=listing_record.partner_id
  for share;
  if found then tier_value:=tier_state.current_tier; end if;
  select * into tier_override
  from public.partner_score_tier_overrides
  where partner_id=listing_record.partner_id
    and status='ACTIVE'
    and override_type='TIER'
    and starts_at<=now()
    and (expires_at is null or expires_at>now())
  order by created_at desc
  limit 1
  for share;
  if tier_override.id is not null then
    tier_value:=tier_override.tier;
    tier_origin:='OVERRIDE';
  end if;
  select * into strict tier_rule from public.marketplace_tier_rules where config_version_id=config_id and tier=tier_value;

  quote_expires_at:=now()+make_interval(days=>pricing_rule.quote_expiry_days);
  if requested_market_analysis_id is not null then
    select * into analysis from public.marketplace_market_analyses where id=requested_market_analysis_id
      and listing_id=requested_listing_id and listing_version_id=requested_listing_version_id;
    if not found or analysis.status not in ('COMPLETE','INSUFFICIENT_DATA','PROVIDER_UNAVAILABLE') then
      raise exception 'Market analysis is unavailable for this listing version' using errcode='23514'; end if;
    if analysis.expires_at is not null and analysis.expires_at<=now() then
      raise exception 'Market analysis is stale and must be refreshed' using errcode='23514';
    end if;
    market_ref:=analysis.recommended_price;
    if analysis.expires_at is not null then
      quote_expires_at:=least(quote_expires_at,analysis.expires_at);
    end if;
  end if;

  if requested_input_mode='NET_PRIORITY' then
    public_price:=private.marketplace_solve_price_for_net(requested_desired_partner_net::bigint,
      tier_rule.commission_rate_bps,financial.commission_tax_bps,fee.percentage_bps,fee.fixed_fee::bigint,
      financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee::bigint,
      financial.minimum_marketplace_revenue::bigint);
  else public_price:=requested_desired_public_price::bigint; end if;
  select * into economics from private.marketplace_calculate_economics(public_price,
    tier_rule.commission_rate_bps,financial.commission_tax_bps,fee.percentage_bps,fee.fixed_fee::bigint,
    financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee::bigint,
    financial.minimum_marketplace_revenue::bigint);

  if market_ref is null then viability:='INSUFFICIENT_DATA';
  else
    lower_bound:=(market_ref*(10000-pricing_rule.market_tolerance_bps))/10000;
    upper_bound:=(market_ref*(10000+pricing_rule.market_tolerance_bps)+9999)/10000;
    delta_bps:=((public_price-market_ref)*10000/market_ref)::integer;
    viability:=case when public_price < lower_bound then 'UNDERPRICED'::public.marketplace_price_viability
      when public_price > upper_bound then 'OVERPRICED'::public.marketplace_price_viability
      else 'COMPETITIVE'::public.marketplace_price_viability end;
  end if;
  quote_status:=case when requested_market_analysis_id is null then 'DRAFT'::public.marketplace_pricing_quote_status
    else 'ANALYZED'::public.marketplace_pricing_quote_status end;

  perform pg_advisory_xact_lock(hashtextextended('marketplace-pricing:'||requested_listing_id::text,0));
  select coalesce(max(quote_version),0)+1 into quote_number from public.marketplace_pricing_quotes where listing_id=requested_listing_id;
  perform set_config('app.marketplace_pricing_transition_write','enabled',true);
  update public.marketplace_pricing_quotes set status='SUPERSEDED',lock_version=lock_version+1
    where listing_id=requested_listing_id and status in ('DRAFT','ANALYZED','CHANGES_REQUESTED','PARTNER_ACCEPTED');
  insert into public.marketplace_pricing_quotes (
    listing_id,listing_version_id,partner_id,canonical_product_model_id,quote_version,status,
    config_version_id,effective_partner_tier,tier_source,effective_tier_override_id,score_snapshot_id,
    commission_rate_bps,commission_tax_bps,payment_fee_config_code,payment_processing_bps,
    payment_processing_fixed_fee,partner_processing_share_bps,admin_fee_bps,admin_fixed_fee,
    minimum_marketplace_revenue,market_tolerance_bps,input_mode,desired_public_price,desired_partner_net,
    calculated_public_price,commission_base,commission_amount,commission_vat,processing_total,
    partner_processing_share,best_round_processing_share,admin_percentage_fee,admin_fixed_fee_amount,
    estimated_partner_net,gross_best_round_revenue,tax_pass_through,estimated_best_round_revenue,
    meets_minimum_marketplace_revenue,market_analysis_id,market_reference,market_lower_bound,
    market_upper_bound,market_delta_bps,viability,calculation_version,idempotency_key,created_by,expires_at
  ) values (
    listing_record.id,version_record.id,listing_record.partner_id,version_record.canonical_model_id,quote_number,quote_status,
    config_id,tier_value,tier_origin,tier_override.id,tier_state.latest_score_snapshot_id,
    tier_rule.commission_rate_bps,financial.commission_tax_bps,fee.code,fee.percentage_bps,
    fee.fixed_fee,financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee,
    financial.minimum_marketplace_revenue,pricing_rule.market_tolerance_bps,requested_input_mode,requested_desired_public_price,requested_desired_partner_net,
    public_price,public_price,economics.commission_amount,economics.commission_vat,economics.processing_total,
    economics.partner_processing_share,economics.best_round_processing_share,economics.admin_percentage_fee,financial.admin_fixed_fee,
    economics.partner_net,economics.gross_best_round_revenue,economics.commission_vat,economics.estimated_best_round_revenue,
    economics.meets_minimum,requested_market_analysis_id,market_ref,lower_bound,upper_bound,delta_bps,viability,
    'marketplace-economics-v2-cumulative-rounding',requested_idempotency_key,(select auth.uid()),quote_expires_at
  ) on conflict (partner_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into quote_record;
  insert into public.marketplace_pricing_status_history (quote_id,to_status,actor_id,reason,lock_version)
    values (quote_record.id,quote_record.status,(select auth.uid()),'Deterministic Marketplace calculation created',quote_record.lock_version)
    on conflict do nothing;
  perform private.write_marketplace_audit('marketplace.pricing_quote_created','marketplace_pricing_quote',quote_record.id,
    'Deterministic Marketplace calculation created',null,jsonb_build_object(
      'listing_version_id',version_record.id,'tier',tier_value,'tier_source',tier_origin,
      'tier_override_id',tier_override.id,'status',quote_record.status));
  return quote_record;
end;
$$;

create or replace function private.guard_marketplace_pricing_quote_change()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op='DELETE' then
    raise exception 'Marketplace pricing quotes are immutable' using errcode='55000';
  end if;
  if current_setting('app.marketplace_pricing_transition_write',true)<>'enabled' then
    raise exception 'Marketplace pricing quotes are immutable' using errcode='55000';
  end if;
  if row(old.listing_id,old.listing_version_id,old.partner_id,old.canonical_product_model_id,
    old.config_version_id,old.effective_partner_tier,old.tier_source,old.effective_tier_override_id,
    old.score_snapshot_id,old.commission_rate_bps,old.commission_tax_bps,old.payment_fee_config_code,
    old.payment_processing_bps,old.payment_processing_fixed_fee,old.partner_processing_share_bps,
    old.admin_fee_bps,old.admin_fixed_fee,old.minimum_marketplace_revenue,old.market_tolerance_bps,
    old.input_mode,old.desired_public_price,old.desired_partner_net,old.calculated_public_price,
    old.commission_base,old.commission_amount,old.commission_vat,old.processing_total,
    old.partner_processing_share,old.best_round_processing_share,old.admin_percentage_fee,
    old.admin_fixed_fee_amount,old.other_configured_fees,old.estimated_partner_net,
    old.gross_best_round_revenue,old.tax_pass_through,old.estimated_best_round_revenue,
    old.meets_minimum_marketplace_revenue,old.market_analysis_id,old.market_reference,
    old.market_lower_bound,old.market_upper_bound,old.market_delta_bps,old.viability,
    old.calculation_version,old.expires_at)
    is distinct from row(new.listing_id,new.listing_version_id,new.partner_id,new.canonical_product_model_id,
    new.config_version_id,new.effective_partner_tier,new.tier_source,new.effective_tier_override_id,
    new.score_snapshot_id,new.commission_rate_bps,new.commission_tax_bps,new.payment_fee_config_code,
    new.payment_processing_bps,new.payment_processing_fixed_fee,new.partner_processing_share_bps,
    new.admin_fee_bps,new.admin_fixed_fee,new.minimum_marketplace_revenue,new.market_tolerance_bps,
    new.input_mode,new.desired_public_price,new.desired_partner_net,new.calculated_public_price,
    new.commission_base,new.commission_amount,new.commission_vat,new.processing_total,
    new.partner_processing_share,new.best_round_processing_share,new.admin_percentage_fee,
    new.admin_fixed_fee_amount,new.other_configured_fees,new.estimated_partner_net,
    new.gross_best_round_revenue,new.tax_pass_through,new.estimated_best_round_revenue,
    new.meets_minimum_marketplace_revenue,new.market_analysis_id,new.market_reference,
    new.market_lower_bound,new.market_upper_bound,new.market_delta_bps,new.viability,
    new.calculation_version,new.expires_at)
  then
    raise exception 'Marketplace pricing economics are immutable' using errcode='55000';
  end if;
  return new;
end;
$$;

comment on function private.marketplace_calculate_economics(bigint,integer,integer,integer,bigint,integer,integer,bigint,bigint) is
  'Marketplace economics v2: exact rational inputs, cumulative ceiling waterfall, monotonic Partner net and conserved processing cents.';
