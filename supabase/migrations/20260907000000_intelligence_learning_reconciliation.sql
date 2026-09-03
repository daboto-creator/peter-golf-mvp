-- PR69 completion: idempotent reconciliation from authoritative completed sales.
create or replace function private.reconcile_intelligence_outcomes()
returns integer language plpgsql security definer set search_path='' as $$
declare inserted_count integer := 0; affected integer := 0;
begin
  insert into public.intelligence_outcome_snapshots(
    outcome_key, source, brand, canonical_model, category, condition,
    acquisition_cost_minor, recommended_price_minor, final_sold_price_minor,
    market_reference_minor, recommendation_accepted, listed_at, sold_at,
    days_in_inventory, research_confidence, recommendation_version,
    research_version, economics_version, evidence
  )
  select
    'first-party:' || oi.id::text, 'FIRST_PARTY', b.name, p.name, c.name,
    oi.condition_snapshot::text, p.cost, p.price, oi.unit_price_snapshot,
    null, null, p.created_at, o.updated_at,
    greatest(0, extract(epoch from (o.updated_at - oi.created_at))::integer / 86400),
    null, null, null, null, jsonb_build_object('reconciled_at', now())
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id
  join public.brands b on b.id = p.brand_id
  join public.categories c on c.id = p.category_id
  where o.status = 'delivered'::public.order_status
    and oi.currency = 'MXN'::public.iso_currency_code
  on conflict (outcome_key) do nothing;
  get diagnostics inserted_count = row_count;

  insert into public.intelligence_outcome_snapshots(
    outcome_key, source, brand, canonical_model, category, condition,
    acquisition_cost_minor, recommended_price_minor, final_sold_price_minor,
    market_reference_minor, recommendation_accepted, listed_at, sold_at,
    days_in_inventory, research_confidence, recommendation_version,
    research_version, economics_version, evidence
  )
  select
    'marketplace:' || s.order_item_id::text, 'MARKETPLACE', b.name,
    cpm.model_name, cat.name, s.condition_snapshot::text, null,
    a.recommended_price, s.public_unit_price, a.median_price,
    false, s.created_at, o.updated_at,
    greatest(0, extract(epoch from (o.updated_at - s.created_at))::integer / 86400),
    a.confidence, null, a.analysis_version, null,
    jsonb_build_object('reconciled_at', now(), 'partner_net', s.estimated_partner_net)
  from public.marketplace_order_item_snapshots s
  join public.order_items oi on oi.id = s.order_item_id
  join public.orders o on o.id = oi.order_id
  join public.marketplace_delivery_acceptances da on da.fulfillment_id = s.fulfillment_id
  left join public.marketplace_market_analyses a on a.id = (select q.market_analysis_id from public.marketplace_pricing_quotes q where q.id = s.pricing_quote_id)
  left join public.catalog_product_models cpm on cpm.id = s.canonical_product_model_id
  left join public.categories cat on cat.id = cpm.category_id
  left join public.brands b on b.id = cpm.brand_id
  where o.status = 'delivered'::public.order_status
    and da.status in ('BUYER_ACCEPTED'::public.marketplace_acceptance_status, 'AUTO_ACCEPTED'::public.marketplace_acceptance_status)
    and s.currency = 'MXN'::public.iso_currency_code
  on conflict (outcome_key) do nothing;
  get diagnostics affected = row_count;
  inserted_count := inserted_count + affected;
  return inserted_count;
end; $$;
revoke all on function private.reconcile_intelligence_outcomes() from public, anon, authenticated, service_role;

create or replace function public.reconcile_intelligence_outcomes()
returns integer language plpgsql security definer set search_path='' as $$
begin
  if auth.uid() is null or not public.can_manage_marketplace_pricing() then raise exception 'access denied' using errcode='42501'; end if;
  return private.reconcile_intelligence_outcomes();
end; $$;
revoke all on function public.reconcile_intelligence_outcomes() from public, anon;
grant execute on function public.reconcile_intelligence_outcomes() to authenticated;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'best-round-intelligence-outcomes-daily') then
    perform cron.unschedule('best-round-intelligence-outcomes-daily');
  end if;
  perform cron.schedule('best-round-intelligence-outcomes-daily', '30 6 * * *',
    $cron$select private.reconcile_intelligence_outcomes()$cron$);
end $$;
