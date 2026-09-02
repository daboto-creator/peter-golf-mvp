-- PR69: immutable, PII-free Intelligence outcome snapshots.
create table if not exists public.intelligence_outcome_snapshots (
  id uuid primary key default gen_random_uuid(),
  outcome_key text not null unique,
  source text not null check (source in ('FIRST_PARTY','MARKETPLACE')),
  brand text,
  canonical_model text,
  category text,
  condition text,
  acquisition_cost_minor bigint,
  recommended_price_minor bigint,
  final_sold_price_minor bigint not null check (final_sold_price_minor > 0),
  market_reference_minor bigint,
  recommendation_accepted boolean,
  listed_at timestamptz,
  sold_at timestamptz not null,
  days_in_inventory integer check (days_in_inventory is null or days_in_inventory >= 0),
  research_confidence text,
  recommendation_version text,
  research_version text,
  economics_version text,
  learning_version text not null default 'intelligence-learning-v1',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists intelligence_outcomes_model_idx on public.intelligence_outcome_snapshots (brand, canonical_model, sold_at desc);
create index if not exists intelligence_outcomes_category_idx on public.intelligence_outcome_snapshots (category, condition, sold_at desc);
create index if not exists intelligence_outcomes_source_idx on public.intelligence_outcome_snapshots (source, sold_at desc);

alter table public.intelligence_outcome_snapshots enable row level security;
revoke all on public.intelligence_outcome_snapshots from anon, authenticated;
create policy "Operations read intelligence outcomes" on public.intelligence_outcome_snapshots
  for select to authenticated using (public.can_manage_marketplace_pricing());

create or replace function public.record_intelligence_outcome(
  requested_outcome_key text,
  requested_source text,
  requested_brand text,
  requested_canonical_model text,
  requested_category text,
  requested_condition text,
  requested_acquisition_cost_minor bigint,
  requested_recommended_price_minor bigint,
  requested_final_sold_price_minor bigint,
  requested_market_reference_minor bigint,
  requested_recommendation_accepted boolean,
  requested_listed_at timestamptz,
  requested_sold_at timestamptz,
  requested_days_in_inventory integer,
  requested_research_confidence text,
  requested_recommendation_version text,
  requested_research_version text,
  requested_economics_version text,
  requested_evidence jsonb default '{}'::jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid;
begin
  if auth.uid() is null or not public.can_manage_marketplace_pricing() then raise exception 'access denied' using errcode='42501'; end if;
  insert into public.intelligence_outcome_snapshots(outcome_key,source,brand,canonical_model,category,condition,acquisition_cost_minor,recommended_price_minor,final_sold_price_minor,market_reference_minor,recommendation_accepted,listed_at,sold_at,days_in_inventory,research_confidence,recommendation_version,research_version,economics_version,evidence)
  values (btrim(requested_outcome_key),requested_source,requested_brand,requested_canonical_model,requested_category,requested_condition,requested_acquisition_cost_minor,requested_recommended_price_minor,requested_final_sold_price_minor,requested_market_reference_minor,requested_recommendation_accepted,requested_listed_at,requested_sold_at,requested_days_in_inventory,requested_research_confidence,requested_recommendation_version,requested_research_version,requested_economics_version,coalesce(requested_evidence,'{}'::jsonb))
  on conflict (outcome_key) do update set updated_at=now()
  returning id into result_id;
  return result_id;
end; $$;
revoke all on function public.record_intelligence_outcome(text,text,text,text,text,text,bigint,bigint,bigint,bigint,boolean,timestamptz,timestamptz,integer,text,text,text,text,jsonb) from public, anon, authenticated;
grant execute on function public.record_intelligence_outcome(text,text,text,text,text,text,bigint,bigint,bigint,bigint,boolean,timestamptz,timestamptz,integer,text,text,text,text,jsonb) to authenticated;
