-- PR73: explicit Operations intent when accepting a first-party recommendation.
create table public.product_pricing_recommendation_acceptances (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  research_id uuid not null references public.market_price_researches(id) on delete restrict,
  recommended_price public.money_minor_units not null check (recommended_price > 0),
  actor_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create index product_pricing_recommendation_acceptances_product_idx
  on public.product_pricing_recommendation_acceptances(product_id, created_at desc);

alter table public.product_pricing_recommendation_acceptances enable row level security;
revoke all on public.product_pricing_recommendation_acceptances from public, anon, authenticated;
create policy "Catalog managers read recommendation acceptances"
  on public.product_pricing_recommendation_acceptances for select to authenticated
  using (public.can_manage_catalog());

create or replace function public.record_product_pricing_recommendation_acceptance(
  requested_product_id uuid,
  requested_research_id uuid,
  requested_recommended_price public.money_minor_units
) returns uuid language plpgsql security definer set search_path='' as $$
declare acceptance_id uuid;
begin
  if auth.uid() is null or not public.can_manage_catalog() then
    raise exception 'Catalog management is not allowed' using errcode='42501';
  end if;
  if not exists (
    select 1 from public.market_price_researches
    where id = requested_research_id and product_id = requested_product_id
  ) then
    raise exception 'Recommendation research does not match product' using errcode='22023';
  end if;
  insert into public.product_pricing_recommendation_acceptances(
    product_id, research_id, recommended_price, actor_id
  ) values (
    requested_product_id, requested_research_id, requested_recommended_price, auth.uid()
  ) returning id into acceptance_id;
  return acceptance_id;
end; $$;

revoke all on function public.record_product_pricing_recommendation_acceptance(uuid, uuid, public.money_minor_units) from public, anon, authenticated;
grant execute on function public.record_product_pricing_recommendation_acceptance(uuid, uuid, public.money_minor_units) to authenticated;
