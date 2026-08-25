-- Marketplace pricing is additive and remains isolated from first-party
-- product_pricing. Monetary values are integer MXN cents.

create type public.marketplace_pricing_input_mode as enum (
  'PUBLIC_PRICE_PRIORITY', 'NET_PRIORITY'
);
create type public.marketplace_pricing_quote_status as enum (
  'DRAFT', 'ANALYZED', 'PARTNER_ACCEPTED', 'UNDER_REVIEW',
  'CHANGES_REQUESTED', 'APPROVED', 'REJECTED', 'SUPERSEDED', 'EXPIRED'
);
create type public.marketplace_market_analysis_status as enum (
  'REQUESTED', 'COMPLETE', 'INSUFFICIENT_DATA',
  'PROVIDER_UNAVAILABLE', 'FAILED', 'STALE'
);
create type public.marketplace_market_analysis_source as enum (
  'PROVIDER', 'MANUAL', 'HYBRID', 'AI'
);
create type public.marketplace_market_confidence as enum (
  'HIGH', 'MEDIUM', 'LOW', 'INSUFFICIENT'
);
create type public.marketplace_price_viability as enum (
  'COMPETITIVE', 'SLIGHTLY_HIGH', 'OVERPRICED',
  'UNDERPRICED', 'INSUFFICIENT_DATA'
);
create type public.marketplace_tier_source as enum ('CALCULATED', 'OVERRIDE');

create table public.marketplace_pricing_rules (
  config_version_id uuid primary key
    references public.marketplace_config_versions (id) on delete cascade,
  payment_fee_config_code text not null
    references public.payment_fee_configs (code) on delete restrict,
  market_tolerance_bps integer not null default 1000,
  quote_expiry_days integer not null default 7,
  research_freshness_hours integer not null default 168,
  required_confidence_for_approval public.marketplace_market_confidence
    not null default 'MEDIUM',
  constraint marketplace_pricing_tolerance_range
    check (market_tolerance_bps between 0 and 5000),
  constraint marketplace_pricing_expiry_range
    check (quote_expiry_days between 1 and 90),
  constraint marketplace_research_freshness_range
    check (research_freshness_hours between 1 and 2160)
);

-- Commission VAT is the only fiscal rule approved for this phase. Mexican
-- withholding/CFDI treatment remains TBD_LEGAL_REVIEW.
update public.marketplace_financial_rules
set commission_tax_bps = 1600
where commission_tax_bps is null;

insert into public.marketplace_pricing_rules (
  config_version_id, payment_fee_config_code
)
select id, 'stripe_domestic_mx'
from public.marketplace_config_versions
on conflict (config_version_id) do nothing;

create table public.marketplace_market_analyses (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null
    references public.marketplace_listings (id) on delete restrict,
  listing_version_id uuid not null
    references public.marketplace_listing_versions (id) on delete restrict,
  partner_id uuid not null
    references public.partner_profiles (id) on delete restrict,
  canonical_product_model_id uuid not null
    references public.catalog_product_models (id) on delete restrict,
  source public.marketplace_market_analysis_source not null default 'PROVIDER',
  status public.marketplace_market_analysis_status not null default 'REQUESTED',
  provider text,
  provider_status text,
  input_fingerprint text,
  input_snapshot jsonb not null default '{}'::jsonb,
  result_snapshot jsonb not null default '{}'::jsonb,
  valid_comparable_count integer not null default 0,
  excluded_comparable_count integer not null default 0,
  median_price public.money_minor_units,
  average_price public.money_minor_units,
  low_market public.money_minor_units,
  high_market public.money_minor_units,
  recommended_price public.money_minor_units,
  confidence public.marketplace_market_confidence not null default 'INSUFFICIENT',
  flags jsonb not null default '[]'::jsonb,
  analysis_version text not null default 'marketplace-market-v1',
  idempotency_key uuid not null,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  completed_by uuid references public.profiles (id) on delete set null,
  requested_at timestamptz not null default now(),
  checked_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  constraint marketplace_market_analysis_listing_version_fk
    foreign key (listing_id, listing_version_id)
    references public.marketplace_listing_versions (listing_id, id) on delete restrict,
  constraint marketplace_market_analysis_shapes check (
    jsonb_typeof(input_snapshot) = 'object'
    and jsonb_typeof(result_snapshot) = 'object'
    and jsonb_typeof(flags) = 'array'
  ),
  constraint marketplace_market_analysis_counts
    check (valid_comparable_count >= 0 and excluded_comparable_count >= 0),
  constraint marketplace_market_analysis_fingerprint
    check (input_fingerprint is null or input_fingerprint ~ '^[a-f0-9]{64}$'),
  constraint marketplace_market_analysis_completed_shape check (
    (status = 'REQUESTED' and checked_at is null and completed_by is null)
    or (status <> 'REQUESTED' and checked_at is not null and completed_by is not null)
  ),
  constraint marketplace_market_analysis_market_shape check (
    (recommended_price is null and median_price is null)
    or (
      recommended_price > 0 and median_price > 0
      and (low_market is null or low_market <= recommended_price)
      and (high_market is null or high_market >= recommended_price)
    )
  ),
  constraint marketplace_market_analysis_expiry
    check (expires_at is null or (checked_at is not null and expires_at > checked_at)),
  unique (partner_id, idempotency_key)
);

create table public.marketplace_market_comparables (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null
    references public.marketplace_market_analyses (id) on delete restrict,
  provider_reference text,
  source text not null,
  title text not null,
  seller text not null,
  price public.money_minor_units not null,
  currency public.iso_currency_code not null default 'MXN',
  condition text not null,
  availability text not null,
  reference_url text,
  match_score integer not null check (match_score between 0 and 100),
  match_reasons jsonb not null default '[]'::jsonb,
  observed_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint marketplace_comparable_text_lengths check (
    char_length(btrim(source)) between 1 and 80
    and char_length(btrim(title)) between 1 and 500
    and char_length(btrim(seller)) between 1 and 200
  ),
  constraint marketplace_comparable_url_safe check (
    reference_url is null or reference_url ~ '^https?://'
  ),
  constraint marketplace_comparable_reasons_shape
    check (jsonb_typeof(match_reasons) = 'array')
);

create table public.marketplace_manual_market_references (
  id uuid primary key default gen_random_uuid(),
  analysis_id uuid not null unique
    references public.marketplace_market_analyses (id) on delete restrict,
  reference_price public.money_minor_units not null,
  low_market public.money_minor_units,
  high_market public.money_minor_units,
  source_description text not null,
  reason text not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint marketplace_manual_reference_range check (
    reference_price > 0
    and (low_market is null or low_market <= reference_price)
    and (high_market is null or high_market >= reference_price)
  ),
  constraint marketplace_manual_reference_text check (
    char_length(btrim(source_description)) between 3 and 300
    and char_length(btrim(reason)) between 3 and 1000
  )
);

create table public.marketplace_pricing_quotes (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null
    references public.marketplace_listings (id) on delete restrict,
  listing_version_id uuid not null
    references public.marketplace_listing_versions (id) on delete restrict,
  partner_id uuid not null
    references public.partner_profiles (id) on delete restrict,
  canonical_product_model_id uuid not null
    references public.catalog_product_models (id) on delete restrict,
  quote_version integer not null check (quote_version > 0),
  status public.marketplace_pricing_quote_status not null,
  lock_version integer not null default 1 check (lock_version > 0),
  config_version_id uuid not null
    references public.marketplace_config_versions (id) on delete restrict,
  effective_partner_tier public.marketplace_partner_tier not null,
  tier_source public.marketplace_tier_source not null,
  score_snapshot_id uuid
    references public.partner_score_snapshots (id) on delete restrict,
  commission_rate_bps integer not null check (commission_rate_bps between 0 and 9999),
  commission_tax_bps integer not null check (commission_tax_bps between 0 and 9999),
  payment_fee_config_code text not null
    references public.payment_fee_configs (code) on delete restrict,
  payment_processing_bps integer not null check (payment_processing_bps between 0 and 9999),
  payment_processing_fixed_fee public.money_minor_units not null,
  partner_processing_share_bps integer not null check (partner_processing_share_bps between 0 and 9999),
  admin_fee_bps integer not null check (admin_fee_bps between 0 and 9999),
  admin_fixed_fee public.money_minor_units not null,
  minimum_marketplace_revenue public.money_minor_units,
  market_tolerance_bps integer not null check (market_tolerance_bps between 0 and 5000),
  currency public.iso_currency_code not null default 'MXN',
  input_mode public.marketplace_pricing_input_mode not null,
  desired_public_price public.money_minor_units,
  desired_partner_net public.money_minor_units,
  calculated_public_price public.money_minor_units not null,
  commission_base public.money_minor_units not null,
  commission_amount public.money_minor_units not null,
  commission_vat public.money_minor_units not null,
  processing_total public.money_minor_units not null,
  partner_processing_share public.money_minor_units not null,
  best_round_processing_share public.money_minor_units not null,
  admin_percentage_fee public.money_minor_units not null,
  admin_fixed_fee_amount public.money_minor_units not null,
  other_configured_fees public.money_minor_units not null default 0,
  estimated_partner_net public.money_minor_units not null,
  gross_best_round_revenue public.money_minor_units not null,
  tax_pass_through public.money_minor_units not null,
  estimated_best_round_revenue public.money_minor_units not null,
  meets_minimum_marketplace_revenue boolean,
  market_analysis_id uuid
    references public.marketplace_market_analyses (id) on delete restrict,
  market_reference public.money_minor_units,
  market_lower_bound public.money_minor_units,
  market_upper_bound public.money_minor_units,
  market_delta_bps integer,
  viability public.marketplace_price_viability not null,
  calculation_version text not null default 'marketplace-economics-v1',
  idempotency_key uuid not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  approval_reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint marketplace_pricing_quote_listing_version_fk
    foreign key (listing_id, listing_version_id)
    references public.marketplace_listing_versions (listing_id, id) on delete restrict,
  constraint marketplace_pricing_quote_input check (
    (input_mode = 'PUBLIC_PRICE_PRIORITY' and desired_public_price > 0)
    or (input_mode = 'NET_PRIORITY' and desired_partner_net > 0)
  ),
  constraint marketplace_pricing_quote_economics check (
    calculated_public_price > 0
    and commission_base = calculated_public_price
    and partner_processing_share + best_round_processing_share = processing_total
    and estimated_partner_net >= 0
  ),
  constraint marketplace_pricing_quote_approval check (
    (status <> 'APPROVED')
    or (approved_by is not null and approved_at is not null)
  ),
  unique (listing_id, quote_version),
  unique (partner_id, idempotency_key)
);

create table public.marketplace_pricing_status_history (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null
    references public.marketplace_pricing_quotes (id) on delete restrict,
  from_status public.marketplace_pricing_quote_status,
  to_status public.marketplace_pricing_quote_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reason text,
  lock_version integer not null check (lock_version > 0),
  created_at timestamptz not null default now(),
  constraint marketplace_pricing_history_reason
    check (reason is null or char_length(btrim(reason)) between 3 and 1000)
);

create index marketplace_market_analysis_listing_idx
  on public.marketplace_market_analyses (listing_id, created_at desc);
create index marketplace_market_analysis_queue_idx
  on public.marketplace_market_analyses (status, requested_at, id);
create index marketplace_market_analysis_cache_idx
  on public.marketplace_market_analyses
  (input_fingerprint, provider, expires_at desc)
  where status = 'COMPLETE';
create index marketplace_comparables_analysis_idx
  on public.marketplace_market_comparables (analysis_id, match_score desc);
create index marketplace_pricing_partner_idx
  on public.marketplace_pricing_quotes (partner_id, status, created_at desc);
create index marketplace_pricing_queue_idx
  on public.marketplace_pricing_quotes (status, submitted_at, created_at, id);
create index marketplace_pricing_listing_idx
  on public.marketplace_pricing_quotes (listing_id, quote_version desc);
create index marketplace_pricing_history_idx
  on public.marketplace_pricing_status_history (quote_id, created_at desc);

create trigger marketplace_market_comparables_immutable
before update or delete on public.marketplace_market_comparables
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_manual_references_immutable
before update or delete on public.marketplace_manual_market_references
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_pricing_history_immutable
before update or delete on public.marketplace_pricing_status_history
for each row execute function public.reject_immutable_row_change();
create trigger marketplace_pricing_quotes_set_updated_at
before update on public.marketplace_pricing_quotes
for each row execute function public.set_updated_at();

create or replace function private.guard_marketplace_pricing_config_publication()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status='PUBLISHED' and old.status is distinct from 'PUBLISHED'
    and not exists (
      select 1 from public.marketplace_pricing_rules
      where config_version_id=new.id
    )
  then
    raise exception 'Marketplace pricing configuration is incomplete'
      using errcode='23514';
  end if;
  return new;
end;
$$;

create trigger marketplace_pricing_config_publication_guard
before update of status on public.marketplace_config_versions
for each row execute function private.guard_marketplace_pricing_config_publication();

create or replace function public.can_manage_marketplace_pricing()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.user_roles
    join public.roles on roles.id = user_roles.role_id
    where user_roles.user_id = (select auth.uid())
      and roles.name in ('operator', 'admin')
  );
$$;

create or replace function private.marketplace_pricing_owned_by_current_user(
  requested_partner_id uuid
)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.partner_profiles
    where id = requested_partner_id and user_id = (select auth.uid())
  );
$$;

create or replace function private.marketplace_multiply_bps_ceil(
  amount bigint, bps integer
)
returns bigint language sql immutable set search_path = '' as $$
  select ((amount * bps::bigint) + 9999) / 10000;
$$;

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
begin
  if requested_public_price <= 0 or requested_public_price > 99999999999999 then
    raise exception 'Marketplace price is outside allowed bounds' using errcode='22003';
  end if;
  commission_amount := private.marketplace_multiply_bps_ceil(requested_public_price, commission_bps);
  commission_vat := private.marketplace_multiply_bps_ceil(commission_amount, commission_vat_bps);
  processing_total := private.marketplace_multiply_bps_ceil(requested_public_price, processing_bps) + processing_fixed;
  partner_processing_share := private.marketplace_multiply_bps_ceil(processing_total, partner_processing_bps);
  best_round_processing_share := processing_total - partner_processing_share;
  admin_percentage_fee := private.marketplace_multiply_bps_ceil(requested_public_price, admin_bps);
  partner_net := requested_public_price - commission_amount - commission_vat
    - partner_processing_share - admin_percentage_fee - admin_fixed;
  gross_best_round_revenue := commission_amount + admin_percentage_fee + admin_fixed;
  estimated_best_round_revenue := gross_best_round_revenue - best_round_processing_share;
  if partner_net < 0 or estimated_best_round_revenue < 0 then
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
declare low_price bigint := 1; high_price bigint := greatest(desired_net + admin_fixed, 100);
  middle_price bigint; economics record;
begin
  if desired_net <= 0 then raise exception 'Desired net must be positive' using errcode='22023'; end if;
  loop
    begin
      select * into economics from private.marketplace_calculate_economics(
        high_price,commission_bps,commission_vat_bps,processing_bps,processing_fixed,
        partner_processing_bps,admin_bps,admin_fixed,minimum_revenue);
      if economics.partner_net >= desired_net then exit; end if;
    exception when check_violation then null;
    end;
    if high_price >= 49999999999999 then raise exception 'Desired net exceeds allowed bounds' using errcode='22003'; end if;
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

create or replace function public.request_marketplace_market_analysis(
  requested_listing_id uuid,
  requested_listing_version_id uuid,
  requested_idempotency_key uuid
)
returns public.marketplace_market_analyses
language plpgsql security definer set search_path = '' as $$
declare listing_record public.marketplace_listings; version_record public.marketplace_listing_versions;
  partner_record public.partner_profiles; analysis_record public.marketplace_market_analyses;
begin
  select * into listing_record from public.marketplace_listings where id=requested_listing_id;
  if not found then raise exception 'Marketplace listing not found' using errcode='P0002'; end if;
  select * into partner_record from public.partner_profiles where id=listing_record.partner_id;
  if not public.can_manage_marketplace_pricing() and (
    not private.marketplace_pricing_owned_by_current_user(listing_record.partner_id)
    or partner_record.status <> 'VERIFIED'
  ) then
    raise exception 'Marketplace pricing access denied' using errcode='42501';
  end if;
  if listing_record.status <> 'APPROVED' or listing_record.approved_version_id <> requested_listing_version_id then
    raise exception 'Pricing requires the approved listing version' using errcode='23514';
  end if;
  select * into strict version_record from public.marketplace_listing_versions
    where id=requested_listing_version_id and listing_id=requested_listing_id
      and state='APPROVED' and canonical_model_id is not null;
  perform pg_advisory_xact_lock(hashtextextended(
    'marketplace-analysis:'||listing_record.partner_id::text||':'||requested_idempotency_key::text,0
  ));
  select * into analysis_record
  from public.marketplace_market_analyses
  where partner_id=listing_record.partner_id and idempotency_key=requested_idempotency_key;
  if found then
    if analysis_record.listing_id<>requested_listing_id or analysis_record.listing_version_id<>requested_listing_version_id then
      raise exception 'Idempotency key belongs to different market analysis inputs' using errcode='23505';
    end if;
    return analysis_record;
  end if;
  insert into public.marketplace_market_analyses (
    listing_id,listing_version_id,partner_id,canonical_product_model_id,
    idempotency_key,requested_by
  ) values (
    listing_record.id,version_record.id,listing_record.partner_id,
    version_record.canonical_model_id,requested_idempotency_key,(select auth.uid())
  )
  returning * into analysis_record;
  perform private.write_marketplace_audit('marketplace.market_research_requested','marketplace_market_analysis',analysis_record.id,
    'Partner requested market research',null,jsonb_build_object('listing_id',listing_record.id,'listing_version_id',version_record.id));
  return analysis_record;
end;
$$;

create or replace function public.complete_marketplace_market_analysis(
  requested_analysis_id uuid,
  requested_provider text,
  requested_provider_status text,
  requested_input_fingerprint text,
  requested_input_snapshot jsonb,
  requested_result_snapshot jsonb,
  requested_comparables jsonb,
  requested_excluded_count integer
)
returns public.marketplace_market_analyses
language plpgsql security definer set search_path = '' as $$
declare analysis_record public.marketplace_market_analyses; item jsonb; freshness_hours integer;
  completed_status public.marketplace_market_analysis_status; completed_confidence public.marketplace_market_confidence;
begin
  if not public.can_manage_marketplace_pricing() then raise exception 'Marketplace pricing review denied' using errcode='42501'; end if;
  if jsonb_typeof(requested_input_snapshot)<>'object' or jsonb_typeof(requested_result_snapshot)<>'object'
    or jsonb_typeof(requested_comparables)<>'array' or requested_input_fingerprint !~ '^[a-f0-9]{64}$'
    or requested_excluded_count<0 then raise exception 'Invalid market analysis payload' using errcode='22023'; end if;
  select * into analysis_record from public.marketplace_market_analyses where id=requested_analysis_id for update;
  if not found or analysis_record.status<>'REQUESTED' then raise exception 'Market analysis request is unavailable' using errcode='23514'; end if;
  select pricing_rule.research_freshness_hours into strict freshness_hours
  from public.marketplace_pricing_rules pricing_rule
  join public.marketplace_config_versions config on config.id=pricing_rule.config_version_id
  where config.status='PUBLISHED' and config.effective_to is null;
  completed_status := case requested_result_snapshot->>'status'
    when 'COMPLETE' then 'COMPLETE'::public.marketplace_market_analysis_status
    when 'PROVIDER_UNAVAILABLE' then 'PROVIDER_UNAVAILABLE'::public.marketplace_market_analysis_status
    else 'INSUFFICIENT_DATA'::public.marketplace_market_analysis_status end;
  completed_confidence := coalesce((requested_result_snapshot->>'confidence')::public.marketplace_market_confidence,'INSUFFICIENT');
  update public.marketplace_market_analyses set
    status=completed_status,provider=left(btrim(requested_provider),80),provider_status=left(btrim(requested_provider_status),80),
    input_fingerprint=requested_input_fingerprint,input_snapshot=requested_input_snapshot,result_snapshot=requested_result_snapshot,
    valid_comparable_count=jsonb_array_length(requested_comparables),excluded_comparable_count=requested_excluded_count,
    median_price=nullif(requested_result_snapshot->>'medianPriceMinor','')::numeric,
    average_price=nullif(requested_result_snapshot->>'averagePriceMinor','')::numeric,
    low_market=nullif(requested_result_snapshot->>'lowMarketMinor','')::numeric,
    high_market=nullif(requested_result_snapshot->>'highMarketMinor','')::numeric,
    recommended_price=nullif(requested_result_snapshot->>'recommendedPriceMinor','')::numeric,
    confidence=completed_confidence,flags=coalesce(requested_result_snapshot->'flags','[]'::jsonb),
    analysis_version=coalesce(nullif(requested_result_snapshot->>'analysisVersion',''),'marketplace-market-v1'),
    completed_by=(select auth.uid()),checked_at=now(),expires_at=now()+make_interval(hours=>freshness_hours)
  where id=requested_analysis_id returning * into analysis_record;
  for item in select value from jsonb_array_elements(requested_comparables) loop
    if (item->>'referenceUrl') is not null and (item->>'referenceUrl') !~ '^https?://' then
      raise exception 'Unsafe comparable URL' using errcode='22023';
    end if;
    insert into public.marketplace_market_comparables (
      analysis_id,provider_reference,source,title,seller,price,currency,condition,
      availability,reference_url,match_score,match_reasons,observed_at
    ) values (
      analysis_record.id,nullif(item->>'providerReference',''),left(item->>'source',80),left(item->>'title',500),
      left(item->>'seller',200),(item->>'priceMinor')::numeric,'MXN',item->>'condition',item->>'availability',
      nullif(item->>'referenceUrl',''),(item->>'matchScore')::integer,coalesce(item->'matchReasons','[]'::jsonb),
      (item->>'observedAt')::timestamptz
    );
  end loop;
  perform private.write_marketplace_audit(
    case when completed_status='COMPLETE' then 'marketplace.market_research_completed' else 'marketplace.market_research_failed' end,
    'marketplace_market_analysis',analysis_record.id,'Operations completed market research',
    jsonb_build_object('status','REQUESTED'),jsonb_build_object('status',completed_status,'comparable_count',analysis_record.valid_comparable_count));
  return analysis_record;
end;
$$;

create or replace function public.create_marketplace_manual_market_reference(
  requested_listing_id uuid, requested_listing_version_id uuid,
  requested_reference_price public.money_minor_units,
  requested_low_market public.money_minor_units,
  requested_high_market public.money_minor_units,
  requested_source_description text, requested_reason text,
  requested_idempotency_key uuid
)
returns public.marketplace_market_analyses
language plpgsql security definer set search_path = '' as $$
declare listing_record public.marketplace_listings; version_record public.marketplace_listing_versions;
  analysis_record public.marketplace_market_analyses; freshness_hours integer;
begin
  if not public.can_manage_marketplace_pricing() then raise exception 'Marketplace pricing review denied' using errcode='42501'; end if;
  if requested_reference_price<=0 or char_length(btrim(requested_source_description)) not between 3 and 300
    or char_length(btrim(requested_reason)) not between 3 and 1000 then raise exception 'Invalid manual market reference' using errcode='22023'; end if;
  select * into strict listing_record from public.marketplace_listings where id=requested_listing_id;
  if listing_record.status<>'APPROVED' or listing_record.approved_version_id<>requested_listing_version_id then raise exception 'Manual reference requires approved listing version' using errcode='23514'; end if;
  select * into strict version_record from public.marketplace_listing_versions where id=requested_listing_version_id and canonical_model_id is not null;
  perform pg_advisory_xact_lock(hashtextextended(
    'marketplace-analysis:'||listing_record.partner_id::text||':'||requested_idempotency_key::text,0
  ));
  select * into analysis_record from public.marketplace_market_analyses
    where partner_id=listing_record.partner_id and idempotency_key=requested_idempotency_key;
  if found then
    if analysis_record.listing_id<>requested_listing_id or analysis_record.listing_version_id<>requested_listing_version_id
      or analysis_record.source<>'MANUAL' then
      raise exception 'Idempotency key belongs to different manual reference inputs' using errcode='23505';
    end if;
    return analysis_record;
  end if;
  select pricing_rule.research_freshness_hours into strict freshness_hours
  from public.marketplace_pricing_rules pricing_rule
  join public.marketplace_config_versions config on config.id=pricing_rule.config_version_id
  where config.status='PUBLISHED' and config.effective_to is null;
  insert into public.marketplace_market_analyses (
    listing_id,listing_version_id,partner_id,canonical_product_model_id,source,status,
    provider,provider_status,result_snapshot,valid_comparable_count,median_price,average_price,
    low_market,high_market,recommended_price,confidence,flags,analysis_version,idempotency_key,
    requested_by,completed_by,checked_at,expires_at
  ) values (
    listing_record.id,version_record.id,listing_record.partner_id,version_record.canonical_model_id,'MANUAL','COMPLETE',
    'manual','available',jsonb_build_object('source','MANUAL'),1,requested_reference_price,requested_reference_price,
    requested_low_market,requested_high_market,requested_reference_price,'MEDIUM','[]','marketplace-manual-v1',requested_idempotency_key,
    (select auth.uid()),(select auth.uid()),now(),now()+make_interval(hours=>freshness_hours)
  ) returning * into analysis_record;
  insert into public.marketplace_manual_market_references (
    analysis_id,reference_price,low_market,high_market,source_description,reason,actor_id
  ) values (analysis_record.id,requested_reference_price,requested_low_market,requested_high_market,
    btrim(requested_source_description),btrim(requested_reason),(select auth.uid()));
  perform private.write_marketplace_audit('marketplace.manual_market_reference_created','marketplace_market_analysis',analysis_record.id,
    btrim(requested_reason),null,jsonb_build_object('listing_id',listing_record.id,'reference_price',requested_reference_price));
  return analysis_record;
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
declare listing_record public.marketplace_listings; version_record public.marketplace_listing_versions;
  config_id uuid; financial public.marketplace_financial_rules; pricing_rule public.marketplace_pricing_rules;
  tier_rule public.marketplace_tier_rules; fee public.payment_fee_configs; tier_state public.partner_score_tier_state;
  tier_value public.marketplace_partner_tier := 'BOGEY'; tier_origin public.marketplace_tier_source := 'CALCULATED';
  analysis public.marketplace_market_analyses; economics record; public_price bigint; quote_number integer;
  market_ref bigint; lower_bound bigint; upper_bound bigint; delta_bps integer; viability public.marketplace_price_viability;
  quote_record public.marketplace_pricing_quotes; quote_status public.marketplace_pricing_quote_status;
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
  select * into tier_state from public.partner_score_tier_state where partner_id=listing_record.partner_id;
  if found then tier_value:=tier_state.current_tier; end if;
  if exists (select 1 from public.partner_score_tier_overrides where partner_id=listing_record.partner_id and status='ACTIVE'
    and override_type='TIER' and (expires_at is null or expires_at>now())) then tier_origin:='OVERRIDE'; end if;
  select * into strict tier_rule from public.marketplace_tier_rules where config_version_id=config_id and tier=tier_value;
  if requested_market_analysis_id is not null then
    select * into analysis from public.marketplace_market_analyses where id=requested_market_analysis_id
      and listing_id=requested_listing_id and listing_version_id=requested_listing_version_id;
    if not found or analysis.status not in ('COMPLETE','INSUFFICIENT_DATA','PROVIDER_UNAVAILABLE') then
      raise exception 'Market analysis is unavailable for this listing version' using errcode='23514'; end if;
    if analysis.expires_at is not null and analysis.expires_at<=now() then
      raise exception 'Market analysis is stale and must be refreshed' using errcode='23514';
    end if;
    market_ref:=analysis.recommended_price;
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
    config_version_id,effective_partner_tier,tier_source,score_snapshot_id,
    commission_rate_bps,commission_tax_bps,payment_fee_config_code,payment_processing_bps,
    payment_processing_fixed_fee,partner_processing_share_bps,admin_fee_bps,admin_fixed_fee,
    minimum_marketplace_revenue,market_tolerance_bps,input_mode,desired_public_price,desired_partner_net,
    calculated_public_price,commission_base,commission_amount,commission_vat,processing_total,
    partner_processing_share,best_round_processing_share,admin_percentage_fee,admin_fixed_fee_amount,
    estimated_partner_net,gross_best_round_revenue,tax_pass_through,estimated_best_round_revenue,
    meets_minimum_marketplace_revenue,market_analysis_id,market_reference,market_lower_bound,
    market_upper_bound,market_delta_bps,viability,idempotency_key,created_by,expires_at
  ) values (
    listing_record.id,version_record.id,listing_record.partner_id,version_record.canonical_model_id,quote_number,quote_status,
    config_id,tier_value,tier_origin,tier_state.latest_score_snapshot_id,
    tier_rule.commission_rate_bps,financial.commission_tax_bps,fee.code,fee.percentage_bps,
    fee.fixed_fee,financial.partner_processing_share_bps,financial.admin_fee_bps,financial.admin_fixed_fee,
    financial.minimum_marketplace_revenue,pricing_rule.market_tolerance_bps,requested_input_mode,requested_desired_public_price,requested_desired_partner_net,
    public_price,public_price,economics.commission_amount,economics.commission_vat,economics.processing_total,
    economics.partner_processing_share,economics.best_round_processing_share,economics.admin_percentage_fee,financial.admin_fixed_fee,
    economics.partner_net,economics.gross_best_round_revenue,economics.commission_vat,economics.estimated_best_round_revenue,
    economics.meets_minimum,requested_market_analysis_id,market_ref,lower_bound,upper_bound,delta_bps,viability,
    requested_idempotency_key,(select auth.uid()),now()+make_interval(days=>pricing_rule.quote_expiry_days)
  ) on conflict (partner_id,idempotency_key) do update set idempotency_key=excluded.idempotency_key
  returning * into quote_record;
  insert into public.marketplace_pricing_status_history (quote_id,to_status,actor_id,reason,lock_version)
    values (quote_record.id,quote_record.status,(select auth.uid()),'Deterministic Marketplace calculation created',quote_record.lock_version)
    on conflict do nothing;
  perform private.write_marketplace_audit('marketplace.pricing_quote_created','marketplace_pricing_quote',quote_record.id,
    'Deterministic Marketplace calculation created',null,jsonb_build_object('listing_version_id',version_record.id,'tier',tier_value,'status',quote_record.status));
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
    old.config_version_id,old.effective_partner_tier,old.commission_rate_bps,old.commission_tax_bps,
    old.payment_processing_bps,old.payment_processing_fixed_fee,old.partner_processing_share_bps,
    old.admin_fee_bps,old.admin_fixed_fee,old.input_mode,old.desired_public_price,old.desired_partner_net,
    old.calculated_public_price,old.estimated_partner_net,old.market_analysis_id,old.market_reference,old.viability)
    is distinct from row(new.listing_id,new.listing_version_id,new.partner_id,new.canonical_product_model_id,
    new.config_version_id,new.effective_partner_tier,new.commission_rate_bps,new.commission_tax_bps,
    new.payment_processing_bps,new.payment_processing_fixed_fee,new.partner_processing_share_bps,
    new.admin_fee_bps,new.admin_fixed_fee,new.input_mode,new.desired_public_price,new.desired_partner_net,
    new.calculated_public_price,new.estimated_partner_net,new.market_analysis_id,new.market_reference,new.viability)
  then raise exception 'Marketplace pricing economics are immutable' using errcode='55000'; end if;
  return new;
end;
$$;

create trigger marketplace_pricing_quotes_guard
before update or delete on public.marketplace_pricing_quotes
for each row execute function private.guard_marketplace_pricing_quote_change();

create or replace function public.transition_marketplace_pricing_quote(
  requested_quote_id uuid, expected_lock_version integer,
  requested_status public.marketplace_pricing_quote_status,
  requested_reason text
)
returns public.marketplace_pricing_quotes
language plpgsql security definer set search_path = '' as $$
declare quote_record public.marketplace_pricing_quotes; old_status public.marketplace_pricing_quote_status;
  partner_owner boolean; manager boolean:=public.can_manage_marketplace_pricing(); reason_value text:=nullif(btrim(requested_reason),'');
begin
  select * into quote_record from public.marketplace_pricing_quotes where id=requested_quote_id for update;
  if not found or quote_record.lock_version<>expected_lock_version then raise exception 'Marketplace pricing version conflict' using errcode='40001'; end if;
  partner_owner:=private.marketplace_pricing_owned_by_current_user(quote_record.partner_id);
  old_status:=quote_record.status;
  if partner_owner and requested_status in ('PARTNER_ACCEPTED','UNDER_REVIEW') then
    if not ((old_status in ('DRAFT','ANALYZED','CHANGES_REQUESTED') and requested_status='PARTNER_ACCEPTED')
      or (old_status='PARTNER_ACCEPTED' and requested_status='UNDER_REVIEW')) then
      raise exception 'Invalid Partner pricing transition' using errcode='42501'; end if;
  elsif manager then
    if not (old_status='UNDER_REVIEW' and requested_status in ('CHANGES_REQUESTED','APPROVED','REJECTED')) then
      raise exception 'Invalid Operations pricing transition' using errcode='23514'; end if;
    if char_length(coalesce(reason_value,'')) not between 3 and 1000 then raise exception 'Operations reason is required' using errcode='22023'; end if;
  else raise exception 'Marketplace pricing access denied' using errcode='42501'; end if;
  if requested_status='APPROVED' and not exists (
    select 1 from public.marketplace_listings listing
    where listing.id=quote_record.listing_id and listing.status='APPROVED'
      and listing.approved_version_id=quote_record.listing_version_id
  ) then
    raise exception 'Pricing quote no longer matches the approved listing version' using errcode='23514';
  end if;
  if requested_status='APPROVED' and quote_record.expires_at<=now() then raise exception 'Expired pricing quote cannot be approved' using errcode='23514'; end if;
  perform set_config('app.marketplace_pricing_transition_write','enabled',true);
  update public.marketplace_pricing_quotes set status=requested_status,lock_version=lock_version+1,
    submitted_at=case when requested_status='UNDER_REVIEW' then now() else submitted_at end,
    approved_by=case when requested_status='APPROVED' then (select auth.uid()) else approved_by end,
    approved_at=case when requested_status='APPROVED' then now() else approved_at end,
    approval_reason=case when requested_status in ('APPROVED','REJECTED','CHANGES_REQUESTED') then reason_value else approval_reason end
  where id=requested_quote_id returning * into quote_record;
  insert into public.marketplace_pricing_status_history (quote_id,from_status,to_status,actor_id,reason,lock_version)
    values (quote_record.id,old_status,requested_status,(select auth.uid()),reason_value,quote_record.lock_version);
  perform private.write_marketplace_audit('marketplace.pricing_status_changed','marketplace_pricing_quote',quote_record.id,
    coalesce(reason_value,'Partner pricing workflow action'),jsonb_build_object('status',old_status),jsonb_build_object('status',requested_status));
  return quote_record;
end;
$$;

-- Existing config workflows are extended so future drafts retain pricing rules.
create or replace function public.create_marketplace_config_draft(requested_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare source_config_id uuid; new_config_id uuid:=gen_random_uuid(); reason_value text:=btrim(requested_reason);
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
  insert into public.marketplace_pricing_rules select new_config_id,payment_fee_config_code,market_tolerance_bps,quote_expiry_days,research_freshness_hours,required_confidence_for_approval from public.marketplace_pricing_rules where config_version_id=source_config_id;
  perform private.write_marketplace_audit('marketplace.configuration_draft_created','marketplace_config_version',new_config_id,reason_value,jsonb_build_object('source_config_id',source_config_id),jsonb_build_object('status','DRAFT'));
  return new_config_id;
end;
$$;

alter table public.marketplace_pricing_rules enable row level security;
alter table public.marketplace_market_analyses enable row level security;
alter table public.marketplace_market_comparables enable row level security;
alter table public.marketplace_manual_market_references enable row level security;
alter table public.marketplace_pricing_quotes enable row level security;
alter table public.marketplace_pricing_status_history enable row level security;

create policy "Admins can read Marketplace pricing rules" on public.marketplace_pricing_rules
for select to authenticated using ((select public.can_manage_marketplace_configuration()));
create policy "Partners and pricing staff read analyses" on public.marketplace_market_analyses
for select to authenticated using (
  (select private.marketplace_pricing_owned_by_current_user(partner_id))
  or (select public.can_manage_marketplace_pricing())
);
create policy "Pricing staff read comparables" on public.marketplace_market_comparables
for select to authenticated using ((select public.can_manage_marketplace_pricing()));
create policy "Pricing staff read manual references" on public.marketplace_manual_market_references
for select to authenticated using ((select public.can_manage_marketplace_pricing()));
create policy "Partners and pricing staff read quotes" on public.marketplace_pricing_quotes
for select to authenticated using (
  (select private.marketplace_pricing_owned_by_current_user(partner_id))
  or (select public.can_manage_marketplace_pricing())
);
create policy "Partners and pricing staff read pricing history" on public.marketplace_pricing_status_history
for select to authenticated using (exists (
  select 1 from public.marketplace_pricing_quotes quote
  where quote.id=marketplace_pricing_status_history.quote_id
    and (private.marketplace_pricing_owned_by_current_user(quote.partner_id) or public.can_manage_marketplace_pricing())
));

revoke all on public.marketplace_pricing_rules,public.marketplace_market_analyses,
  public.marketplace_market_comparables,public.marketplace_manual_market_references,
  public.marketplace_pricing_quotes,public.marketplace_pricing_status_history from anon,authenticated;
grant select on public.marketplace_market_analyses,public.marketplace_pricing_quotes,
  public.marketplace_pricing_status_history to authenticated;
grant select on public.marketplace_market_comparables,public.marketplace_manual_market_references to authenticated;
grant select on public.marketplace_pricing_rules to authenticated;

revoke all on function public.can_manage_marketplace_pricing() from public,anon;
revoke all on function public.request_marketplace_market_analysis(uuid,uuid,uuid) from public,anon;
revoke all on function public.complete_marketplace_market_analysis(uuid,text,text,text,jsonb,jsonb,jsonb,integer) from public,anon;
revoke all on function public.create_marketplace_manual_market_reference(uuid,uuid,public.money_minor_units,public.money_minor_units,public.money_minor_units,text,text,uuid) from public,anon;
revoke all on function public.create_marketplace_pricing_quote(uuid,uuid,public.marketplace_pricing_input_mode,public.money_minor_units,public.money_minor_units,uuid,uuid) from public,anon;
revoke all on function public.transition_marketplace_pricing_quote(uuid,integer,public.marketplace_pricing_quote_status,text) from public,anon;
grant execute on function public.can_manage_marketplace_pricing() to authenticated;
grant execute on function public.request_marketplace_market_analysis(uuid,uuid,uuid) to authenticated;
grant execute on function public.complete_marketplace_market_analysis(uuid,text,text,text,jsonb,jsonb,jsonb,integer) to authenticated;
grant execute on function public.create_marketplace_manual_market_reference(uuid,uuid,public.money_minor_units,public.money_minor_units,public.money_minor_units,text,text,uuid) to authenticated;
grant execute on function public.create_marketplace_pricing_quote(uuid,uuid,public.marketplace_pricing_input_mode,public.money_minor_units,public.money_minor_units,uuid,uuid) to authenticated;
grant execute on function public.transition_marketplace_pricing_quote(uuid,integer,public.marketplace_pricing_quote_status,text) to authenticated;

comment on table public.marketplace_pricing_quotes is
  'Immutable deterministic Marketplace economics bound to one approved listing version.';
comment on table public.marketplace_market_analyses is
  'Provider/manual market intelligence only; never a source of financial fee truth.';
comment on column public.marketplace_pricing_rules.quote_expiry_days is
  'Technical MVP default of 7 days; configurable and not a permanent commercial policy.';
